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

    // DEBUG MODE: Attach text sample to success response
    const splitPoint = Math.floor(text.length * 0.4)
    const debugText = "--- DEBUG MODE: SHOWING LAST 60% OF TEXT ---\n" + text.substring(splitPoint)

    return NextResponse.json({
      success: true,
      message: `成功导入试卷：${title} (调试模式：已附带文本样本)`,
      data: {
        paperId: examPaper.id,
        paperTitle: examPaper.title,
        questionsCount: createdQuestions.length,
        knowledgeEdgesCount: edgesToInsert.length,
      },
      debug_text: debugText
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

  // 关键修复：支持全角点 "．" 和全角括号 "（）" 以及多变的空白字符
  // 目标格式：1．（0.5分） My sister...
  const questionSplitPattern = /(?=\d+[.．、]\s*[（(]?\s*\d*\.?\d*\s*分?[）)]?)/g
  
  const rawBlocks = text.split(questionSplitPattern)
  
  let orderIndex = 0

  for (const block of rawBlocks) {
    // 过滤掉太短的块
    if (block.length < 10 || !block.match(/^\d+[.．、]/)) {
        continue
    }

    try {
        // 1. 提取题号和分数
        // 关键修复：更宽容的正则
        const headerMatch = block.match(/^(\d+)[.．、]\s*(?:[（(](\d*\.?\d*)\s*分?[）)])?\s*/)
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
             analysis = analysisMatch[1].trim()
             contentAndOptions = contentAndOptions.replace(analysisMatch[0], '')
        }

        // 提取【知识点】
        const knowledgeMatch = rawContent.match(/【知识点】([\s\S]*?)(?=【|$)/)
        if (knowledgeMatch) {
            knowledgeStr = knowledgeMatch[1].trim()
            contentAndOptions = contentAndOptions.replace(knowledgeMatch[0], '')
        }
        
        // 清理其他标签
        contentAndOptions = contentAndOptions.replace(/【[^】]+】[\s\S]*?(?=【|$)/g, '')

        // 3. 分离题干和选项
        // 关键修复：支持 A．I	B．He (全角点 + Tab/空格)
        // 正则说明：匹配 A, B, C, D 后面跟 . 或 ． 或 、，然后是内容
        
        // 先找到第一个选项的位置 (A. 或 A． 或 A、)
        const optionAIndex = contentAndOptions.search(/\sA[.．、]/)
        
        let content = ''
        let options: string[] = []

        if (optionAIndex !== -1) {
            content = contentAndOptions.substring(0, optionAIndex).trim()
            const optionsPart = contentAndOptions.substring(optionAIndex)
            
            // 提取选项
            // 分割策略：查找 "B." "C." "D." 并在此处分割
            // 注意要处理全角点和顿号
            const optionRegex = /([A-D])[.．、]\s*([^\t\nA-D]+)(?=\s*[B-D][.．、]|$)/g
            
            // 由于 JS 的 exec 循环匹配比较麻烦，这里用一种更粗暴有效的方法：
            // 直接用 split 切割，但要小心把 ABCD 切没了
            
            // 尝试用 A.xxx B.xxx 的模式去匹配四项
            // 这里的正则假设选项是 A, B, C, D 顺序出现的
            const optionMatches = optionsPart.match(
                /A[.．、]\s*([\s\S]*?)\s*B[.．、]\s*([\s\S]*?)\s*C[.．、]\s*([\s\S]*?)\s*D[.．、]\s*([\s\S]*?)$/
            )

            if (optionMatches) {
                options = [
                    optionMatches[1].trim(),
                    optionMatches[2].trim(),
                    optionMatches[3].trim(),
                    optionMatches[4].trim()
                ]
            } else {
                 // 如果没匹配上，尝试用 split
                 // 这种方式比较脆弱，但在标准 ABCD 格式下通常有效
                 const parts = optionsPart.split(/\s*[A-D][.．、]\s*/)
                 // parts[0] 是空字符串，parts[1] 是 A 的内容，以此类推
                 if (parts.length >= 5) {
                     options = [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()]
                 }
            }
        } else {
            content = contentAndOptions.trim()
        }

        // 处理知识点
        const knowledgeCodes: string[] = []
        if (knowledgeStr) {
            if (knowledgeStr.includes('代词')) knowledgeCodes.push('grammar.pronoun')
            if (knowledgeStr.includes('时态')) knowledgeCodes.push('grammar.tense')
            if (knowledgeStr.includes('被动')) knowledgeCodes.push('grammar.passive')
            if (knowledgeStr.includes('情态')) knowledgeCodes.push('grammar.modal')
            if (knowledgeStr.includes('形容词')) knowledgeCodes.push('grammar.adjective')
            if (knowledgeStr.includes('介词')) knowledgeCodes.push('grammar.preposition')
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
