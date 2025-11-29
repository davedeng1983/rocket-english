import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import mammoth from 'mammoth'

/**
 * 试卷导入 API
 * 接收 Word 文档，自动解析并入库
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // 检查文件类型
    if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
      return NextResponse.json(
        { error: 'Only .docx and .doc files are supported' },
        { status: 400 }
      )
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 使用 mammoth 解析 Word 文档
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value

    // 提取试卷信息
    const title = extractTitle(text) || file.name.replace(/\.(docx|doc)$/i, '')
    const metadata = extractMetadata(text)

    // 提取题目
    const questions = extractQuestions(text)

    if (questions.length === 0) {
      console.log('Parsed Text Sample:', text.substring(0, 1000)) // Log to server console
      return NextResponse.json(
        { 
            error: '未能从文档中提取到题目。',
            debug_text: text.substring(0, 800) // Return raw text to client for debugging
        },
        { status: 400 }
      )
    }

    // 1. 创建试卷记录
    const { data: examPaper, error: paperError } = await supabase
      .from('exam_papers')
      .insert({
        title,
        year: metadata.year,
        region: metadata.region,
        structure_map: {
          sections: [],
          total_questions: questions.length,
        },
      })
      .select()
      .single()

    if (paperError || !examPaper) {
      return NextResponse.json(
        { error: paperError?.message || 'Failed to create exam paper' },
        { status: 500 }
      )
    }

    // 2. 批量创建题目
    const questionsToInsert = questions.map((q, index) => ({
      paper_id: examPaper.id,
      section_type: q.sectionType,
      order_index: index + 1,
      content: q.content,
      options: q.options,
      correct_answer: q.correctAnswer || null,
      analysis: q.analysis || null,
      meta: {
        kps: q.knowledgeCodes.length > 0 ? q.knowledgeCodes : [], // 优先使用解析提取的知识点
      },
    }))

    const { data: createdQuestions, error: questionsError } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select()

    if (questionsError || !createdQuestions) {
      return NextResponse.json(
        { error: questionsError?.message || 'Failed to create questions' },
        { status: 500 }
      )
    }

    // 3. 自动识别知识点并创建内容-知识边
    const edgesToInsert: Array<{
      question_id: string
      knowledge_code: string
      weight: number
      dimension: string
    }> = []

    createdQuestions.forEach((question, index) => {
      const originalQuestion = questions[index]
      // 如果题目解析里已经有知识点了，优先使用
      const knowledgeCodes = originalQuestion.knowledgeCodes.length > 0 
        ? originalQuestion.knowledgeCodes 
        : extractKnowledgeFromQuestion(originalQuestion).knowledgeCodes

      knowledgeCodes.forEach((code) => {
        edgesToInsert.push({
          question_id: question.id,
          knowledge_code: code,
          weight: 0.8, // 默认权重
          dimension: 'application',
        })
      })
      
      // 确保 meta 里存了 knowledgeCodes
      if (originalQuestion.knowledgeCodes.length === 0 && knowledgeCodes.length > 0) {
          supabase
            .from('questions')
            .update({
              meta: {
                kps: knowledgeCodes,
              },
            })
            .eq('id', question.id)
      }
    })

    // 批量插入内容-知识边
    if (edgesToInsert.length > 0) {
      const { error: edgesError } = await supabase
        .from('content_knowledge_edges')
        .insert(edgesToInsert)

      if (edgesError) {
        console.error('Failed to create knowledge edges:', edgesError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `成功导入试卷：${title}`,
      data: {
        paperId: examPaper.id,
        paperTitle: examPaper.title,
        questionsCount: createdQuestions.length,
        knowledgeEdgesCount: edgesToInsert.length,
      },
    })
  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error.message || '导入失败，请检查文件格式' },
      { status: 500 }
    )
  }
}

// ============================================
// 辅助函数
// ============================================

interface ParsedQuestion {
  number: string
  content: string
  options: string[]
  correctAnswer?: string
  analysis?: string
  knowledgeCodes: string[]
  sectionType: 'single_choice' | 'cloze' | 'reading' | 'writing'
  orderIndex: number
}

/**
 * 提取试卷标题
 */
function extractTitle(text: string): string | null {
  const titlePatterns = [
    /([^。\n]+年[^。\n]+中考[^。\n]+真题)/,
    /([^。\n]+年[^。\n]+英语[^。\n]+试卷)/,
    /([^。\n]+年[^。\n]+试题)/,
  ]

  for (const pattern of titlePatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * 提取年份和地区
 */
function extractMetadata(text: string): { year?: number; region?: string } {
  const yearMatch = text.match(/(\d{4})年/)
  const regionMatch = text.match(
    /(北京|上海|天津|重庆|广东|江苏|浙江|山东|河南|四川|湖北|湖南|安徽|河北|福建|江西|山西|辽宁|吉林|黑龙江|陕西|甘肃|青海|云南|贵州|广西|内蒙古|新疆|西藏|宁夏|海南)/
  )

  return {
    year: yearMatch ? parseInt(yearMatch[1]) : undefined,
    region: regionMatch ? regionMatch[1] : undefined,
  }
}

/**
 * 从文本中提取题目
 */
function extractQuestions(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []

  // 分割题目块
  // 策略：使用数字加点或顿号作为题目开始的标志
  // 比如 "1." 或 "1、"
  // 同时利用【答案】等标签来辅助定位
  const rawBlocks = text.split(/(?=\d+[\.、]\s*（?\d*\.?\d*\s*分）?)/g)
  
  let orderIndex = 0

  for (const block of rawBlocks) {
    // 过滤掉太短的块或者不是题目的块
    if (block.length < 10 || !block.match(/^\d+[\.、]/)) {
        continue
    }

    try {
        // 1. 提取题号和分数
        const headerMatch = block.match(/^(\d+)[\.、]\s*(?:（(\d*\.?\d*)\s*分）)?\s*/)
        if (!headerMatch) continue
        
        const number = headerMatch[1]
        const rawContent = block.substring(headerMatch[0].length)

        // 2. 提取答案、解析、知识点
        let correctAnswer: string | undefined
        let analysis: string | undefined
        let knowledgeStr: string | undefined
        let contentAndOptions = rawContent

        // 提取【答案】
        const answerMatch = rawContent.match(/【答案】\s*([A-D])/)
        if (answerMatch) {
            correctAnswer = answerMatch[1]
            // 从内容中移除答案部分
            contentAndOptions = contentAndOptions.replace(/【答案】\s*[A-D]/, '')
        }

        // 提取【解析】
        const analysisMatch = rawContent.match(/【解析】([\s\S]*?)(?=【|$)/)
        if (analysisMatch) {
             // 如果有【分析】子标签，也包含进去
             analysis = analysisMatch[1].trim()
             contentAndOptions = contentAndOptions.replace(analysisMatch[0], '')
        }

        // 提取【知识点】
        const knowledgeMatch = rawContent.match(/【知识点】([\s\S]*?)(?=【|$)/)
        if (knowledgeMatch) {
            knowledgeStr = knowledgeMatch[1].trim()
            contentAndOptions = contentAndOptions.replace(knowledgeMatch[0], '')
        }
        
        // 清理其他可能的标签，如【点评】
        contentAndOptions = contentAndOptions.replace(/【[^】]+】[\s\S]*?(?=【|$)/g, '')

        // 3. 分离题干和选项
        // 寻找选项 A. B. C. D.
        // 选项可能有多种排版：
        // A. xxx B. xxx
        // A. xxx
        // B. xxx
        
        // 查找第一个选项 A. 的位置
        const optionAIndex = contentAndOptions.search(/\sA[\.\s]/)
        
        let content = ''
        let options: string[] = []

        if (optionAIndex !== -1) {
            content = contentAndOptions.substring(0, optionAIndex).trim()
            const optionsPart = contentAndOptions.substring(optionAIndex)
            
            // 提取选项
            // 简单的分割策略：按 A., B., C., D. 分割
            const optionMatches = [
                optionsPart.match(/A[\.\s]([\s\S]*?)(?=B[\.\s]|$)/),
                optionsPart.match(/B[\.\s]([\s\S]*?)(?=C[\.\s]|$)/),
                optionsPart.match(/C[\.\s]([\s\S]*?)(?=D[\.\s]|$)/),
                optionsPart.match(/D[\.\s]([\s\S]*?)$/)
            ]

            if (optionMatches[0] && optionMatches[1] && optionMatches[2] && optionMatches[3]) {
                options = [
                    optionMatches[0][1].trim(),
                    optionMatches[1][1].trim(),
                    optionMatches[2][1].trim(),
                    optionMatches[3][1].trim()
                ]
            }
        } else {
            // 没找到选项，可能是非选择题或者格式极度不规范
            content = contentAndOptions.trim()
        }

        // 处理知识点字符串转 code
        const knowledgeCodes: string[] = []
        if (knowledgeStr) {
            // 简单的关键词映射，实际项目中可能需要更复杂的 NLP
            if (knowledgeStr.includes('代词')) knowledgeCodes.push('grammar.pronoun')
            if (knowledgeStr.includes('时态')) knowledgeCodes.push('grammar.tense')
            if (knowledgeStr.includes('被动')) knowledgeCodes.push('grammar.passive')
            if (knowledgeStr.includes('情态')) knowledgeCodes.push('grammar.modal')
            if (knowledgeStr.includes('形容词')) knowledgeCodes.push('grammar.adjective')
             // ... 更多映射
        }

        if (options.length === 4) {
             questions.push({
                number,
                content,
                options,
                correctAnswer,
                analysis,
                knowledgeCodes,
                sectionType: 'single_choice',
                orderIndex: orderIndex++,
            })
        }

    } catch (e) {
        console.warn(`Error parsing block: ${block.substring(0, 20)}...`, e)
    }
  }

  return questions
}

/**
 * 兜底逻辑：从题目内容中提取知识点
 */
function extractKnowledgeFromQuestion(question: ParsedQuestion): {
  knowledgeCodes: string[]
  confidence: number
} {
  const { content, options } = question
  const fullText = `${content} ${options.join(' ')}`.toLowerCase()

  const knowledgeCodes: string[] = []
  let confidence = 0.5

  // 关键词匹配规则
  const rules = [
    {
      keywords: ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her'],
      knowledgeCode: 'grammar.pronoun',
      confidence: 0.8,
    },
    {
      keywords: ['is spoken', 'was spoken', 'be done', 'be made'],
      knowledgeCode: 'grammar.passive',
      confidence: 0.9,
    },
    {
      keywords: ['yesterday', 'ago', 'last', 'was', 'were', 'did'],
      knowledgeCode: 'grammar.tense.past',
      confidence: 0.8,
    },
    {
      keywords: ['will', 'going to', 'tomorrow', 'next'],
      knowledgeCode: 'grammar.tense.future',
      confidence: 0.8,
    },
     {
      keywords: ['can', 'could', 'may', 'must', 'should', 'need'],
      knowledgeCode: 'grammar.modal',
      confidence: 0.8,
    },
  ]

  for (const rule of rules) {
    const hasKeyword = rule.keywords.some((keyword) =>
      fullText.includes(keyword)
    )
    if (hasKeyword) {
      knowledgeCodes.push(rule.knowledgeCode)
      confidence = Math.max(confidence, rule.confidence)
    }
  }

  if (knowledgeCodes.length === 0) {
    knowledgeCodes.push('vocab.general')
    confidence = 0.3
  }

  return {
    knowledgeCodes: [...new Set(knowledgeCodes)],
    confidence,
  }
}
