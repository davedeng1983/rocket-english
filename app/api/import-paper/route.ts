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

    // 提取题目 (使用新的智能元数据解析器，带详细日志)
    const { questions, parsingLog } = extractQuestions(text)

    // 调试模式：即使成功也附带文本样本和解析日志
    const splitPoint = Math.floor(text.length * 0.4)
    const debugText = "--- PARSING LOG ---\n" + parsingLog.join('\n') + 
                      "\n\n--- DEBUG MODE: SHOWING LAST 60% OF TEXT ---\n" + text.substring(splitPoint)

    if (questions.length === 0) {
      console.log('Parsed Text Sample:', text.substring(0, 1000))
      return NextResponse.json(
        { 
            error: '未能从文档中提取到题目。',
            debug_text: debugText
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
      options: q.options, // 可能为空 (对于问答题)
      correct_answer: q.correctAnswer || null,
      analysis: q.analysis || null,
      meta: {
        kps: q.knowledgeCodes.length > 0 ? q.knowledgeCodes : [],
        article: q.article || null
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
          weight: 0.8,
          dimension: 'application',
        })
      })
      
      if (originalQuestion.knowledgeCodes.length === 0 && knowledgeCodes.length > 0) {
          supabase
            .from('questions')
            .update({
              meta: {
                kps: knowledgeCodes,
                article: originalQuestion.article || null
              },
            })
            .eq('id', question.id)
      }
    })

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
      message: `成功导入试卷：${title} (共${questions.length}题)`,
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
  options: string[] | null // 允许为空
  correctAnswer?: string
  analysis?: string
  knowledgeCodes: string[]
  sectionType: 'single_choice' | 'cloze' | 'reading' | 'writing'
  orderIndex: number
  article?: string
}

// ... (extractTitle, extractMetadata 保持不变) ...
function extractTitle(text: string): string | null {
  const titlePatterns = [
    /([^。\n]+年[^。\n]+中考[^。\n]+真题)/,
    /([^。\n]+年[^。\n]+英语[^。\n]+试卷)/,
    /([^。\n]+年[^。\n]+试题)/,
  ]
  for (const pattern of titlePatterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

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
 * 智能解析器：基于元数据进行目标导向解析
 * 返回题目数组和解析日志
 */
function extractQuestions(text: string): { questions: ParsedQuestion[], parsingLog: string[] } {
  const questions: ParsedQuestion[] = []
  const parsingLog: string[] = []
  let orderIndex = 0

  // 1. 按大题切分模块
  const sectionRegex = /(?:^|\n)\s*(?:([一二三四五六七八九十]+)、|(Part\s+[IVX]+)|(第[一二三四五六七八九十]+部分))\s*([^\n]*)/g
  const sections: { title: string; content: string; targetCount: number }[] = []
  
  let lastIndex = 0
  let match
  
  while ((match = sectionRegex.exec(text)) !== null) {
    if (sections.length > 0) {
      sections[sections.length - 1].content = text.substring(lastIndex, match.index)
    }
    
    const titlePart = match[1] || match[2] || match[3]
    const contentPart = match[4] || ''
    const fullTitle = titlePart + ' ' + contentPart
    
    // 从标题中提取目标题目数量
    let targetCount = 0
    const countMatch = fullTitle.match(/共\s*(\d+)\s*(?:小)?题/)
    if (countMatch) {
        targetCount = parseInt(countMatch[1])
    } else {
        // 尝试从 "第 34-36 题" 这种格式推断
        const rangeMatch = fullTitle.match(/第\s*(\d+)\s*[—\-]\s*(\d+)\s*题/)
        if (rangeMatch) {
            targetCount = parseInt(rangeMatch[2]) - parseInt(rangeMatch[1]) + 1
        }
    }

    sections.push({
      title: fullTitle,
      content: '',
      targetCount
    })
    lastIndex = match.index + match[0].length
  }
  
  if (sections.length > 0) {
    sections[sections.length - 1].content = text.substring(lastIndex)
  }

  // 兜底：如果没切分出模块，全文当做一个模块
  if (sections.length === 0) {
      sections.push({ title: '默认部分', content: text, targetCount: 0 })
  }

  parsingLog.push(`Parsed ${sections.length} sections.`)

  // 2. 遍历每个模块
  for (const section of sections) {
    const { title, content, targetCount } = section
    let sectionQuestions: ParsedQuestion[] = []
    parsingLog.push(`Processing section: "${title}" (Expected: ${targetCount})`)

    // 策略分发
    if (title.includes('单项') || title.includes('选择') || title.includes('Grammar')) {
       sectionQuestions = parseStandardBlock(content, orderIndex, 'single_choice')
    } else if (title.includes('完形') || title.includes('完型') || title.includes('Cloze')) {
       sectionQuestions = parseStandardBlock(content, orderIndex, 'cloze', true)
    } else if (title.includes('阅读理解') || (title.includes('阅读') && !title.includes('表达'))) {
       sectionQuestions = parseReading(content, orderIndex)
    } else if (title.includes('阅读表达') || title.includes('任务型阅读')) {
       // 默认尝试严格模式
       sectionQuestions = parseNoOptionBlock(content, orderIndex, 'reading', true)
       parsingLog.push(`  - Strict mode yielded ${sectionQuestions.length} questions`)
       
       // 智能熔断与降级
       if ((targetCount > 0 && sectionQuestions.length < targetCount) || (sectionQuestions.length === 0 && targetCount > 0)) {
           parsingLog.push(`  - Falling back to loose mode + continuity check`)
           sectionQuestions = parseNoOptionBlock(content, orderIndex, 'reading', false)
       }
    } else if (title.includes('文段表达') || title.includes('书面表达') || title.includes('写作')) {
       sectionQuestions = parseNoOptionBlock(content, orderIndex, 'writing', true)
       if (sectionQuestions.length === 0) {
            sectionQuestions = parseNoOptionBlock(content, orderIndex, 'writing', false)
       }
    } else {
       // 默认策略
       const results = parseStandardBlock(content, orderIndex, 'single_choice')
       if (results.length === 0) {
           sectionQuestions = parseNoOptionBlock(content, orderIndex, 'reading', true)
       } else {
           sectionQuestions = results
       }
    }

    parsingLog.push(`  - Final count for section: ${sectionQuestions.length}`)

    // 异常过量熔断
    if (targetCount > 0 && sectionQuestions.length > targetCount + 5) {
        parsingLog.push(`  - WARNING: Too many questions (${sectionQuestions.length} > ${targetCount}). Forcing strict mode.`)
        if (title.includes('阅读表达') || title.includes('任务型阅读') || title.includes('文段表达') || title.includes('写作')) {
             sectionQuestions = parseNoOptionBlock(content, orderIndex, title.includes('写作') ? 'writing' : 'reading', true)
        }
    }
    
    questions.push(...sectionQuestions)
    
    // 更新 orderIndex
    if (questions.length > 0) {
        orderIndex = questions[questions.length - 1].orderIndex
    }
  }

  return { questions, parsingLog }
}

// === 标准带选项题目解析 (单选、完形) ===
// supportArticle: 是否支持文章前置（如完形）
function parseStandardBlock(text: string, startIndex: number, type: ParsedQuestion['sectionType'], supportArticle = false): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  let currentOrder = startIndex
  let article = ''
  let contentText = text

  if (supportArticle) {
      const firstQuestionIndex = text.search(/\d+[.．、]\s*[（(]?\s*\d*\.?\d*\s*分?[）)]?.*A[.．、]/)
      if (firstQuestionIndex !== -1) {
          article = text.substring(0, firstQuestionIndex).trim()
          contentText = text.substring(firstQuestionIndex)
      }
  }

  // 宽松的题号分割：支持 (1), ①, [1], 1., 1、 等格式
  // 关键更新：增强了分割正则
  const questionSplitPattern = /(?=(?:^|\n)\s*(?:\d+[.．、]|[（(]\d+[）)]|\[\d+\]|①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩))/g
  const rawBlocks = contentText.split(questionSplitPattern)

  for (const block of rawBlocks) {
    // 必须包含 A. B. C. D. 选项才算标准题
    // 检查是否有题号
    const hasNumber = block.match(/(?:^|\n)\s*(?:(\d+)[.．、]|[（(](\d+)[）)]|\[(\d+)\]|(①|②|③|④|⑤|⑥|⑦|⑧|⑨|⑩))/)
    if (block.length < 10 || !hasNumber || !block.includes('A')) continue
    
    const q = parseQuestionBlock(block)
    if (q) {
        q.sectionType = type
        // 尝试从题号字符串解析数字，如果失败则递增
        let numStr = q.number
        // 处理特殊序号
        const specialMap: Record<string, number> = { '①':1, '②':2, '③':3, '④':4, '⑤':5 } // ...
        let num = parseInt(numStr)
        if (isNaN(num) && specialMap[numStr]) num = specialMap[numStr]
        
        q.orderIndex = !isNaN(num) ? num : ++currentOrder
        if (supportArticle) q.article = article
        questions.push(q)
    }
  }
  return questions
}

// === 阅读理解解析 (多篇文章) ===
function parseReading(text: string, startIndex: number): ParsedQuestion[] {
    // 增强：阅读理解可能包含 41-45 这种连字符题号
    // 但由于我们还是按单题拆分，这里主要依赖 parseStandardBlock 的增强
    return parseStandardBlock(text, startIndex, 'reading', true)
}

// === 无选项题目解析 (阅读表达、作文) ===
function parseNoOptionBlock(text: string, startIndex: number, type: ParsedQuestion['sectionType'], strictMode: boolean): ParsedQuestion[] {
    const questions: ParsedQuestion[] = []
    let currentOrder = startIndex
    
    let article = ''
    let contentText = text
    
    const firstQuestionIndex = text.search(/\d+[.．、]/)
    
    if (firstQuestionIndex > 50) { 
        article = text.substring(0, firstQuestionIndex).trim()
        contentText = text.substring(firstQuestionIndex)
    } else if (type === 'writing') {
        if (firstQuestionIndex === -1) {
             questions.push({
                number: 'writing',
                content: text.trim(),
                options: null,
                correctAnswer: undefined,
                analysis: undefined,
                knowledgeCodes: ['writing'],
                sectionType: 'writing',
                orderIndex: ++currentOrder,
                article: undefined
            })
            return questions
        }
    }

    // 增强的分割正则
    const rawBlocks = contentText.split(/(?=(?:^|\n)\s*(?:\d+[.．、]|[（(]\d+[）)]|\[\d+\]))/g)
    
    for (const block of rawBlocks) {
        if (block.length < 5) continue
        
        // 增强的题号提取：支持 1. 或 (1) 或 [1]
        // 并且支持忽略前面的 (2分) 等干扰
        const headerMatch = block.match(/(?:^|\n)\s*(?:(?:[（(]\d+分[）)])\s*)?(?:(\d+)[.．、]|[（(](\d+)[）)]|\[(\d+)\])/)
        if (!headerMatch) continue
        
        const numberStr = headerMatch[1] || headerMatch[2] || headerMatch[3]
        const number = parseInt(numberStr)
        // 提取内容：去掉题号部分
        let content = block.replace(headerMatch[0], '').trim()

        // 智能校验
        let isQuestion = false;

        if (strictMode) {
            const hasScore = block.match(/[（(]\s*\d+\s*分\s*[）)]/)
            const hasAnswerKey = block.includes('【答案】') || block.includes('【解析】')
            if (hasScore || hasAnswerKey) isQuestion = true;
        } else {
            // 宽松模式
            const hasScore = block.match(/[（(]\s*\d+\s*分\s*[）)]/)
            const hasAnswerKey = block.includes('【答案】') || block.includes('【解析】')
            if (hasScore || hasAnswerKey) {
                isQuestion = true;
            } 
            // 允许适度的断号 (1-5)
            // 关键修改：防止题号倒退 (过滤 "题目1")
            else if (!isNaN(number)) {
                if (number <= currentOrder) continue; // 过滤倒退题号
                if (number > currentOrder + 5) continue; // 过滤跳跃过大
                isQuestion = true;
            }
        }

        if (!isQuestion) continue;
        
        // ... 提取答案解析 ...
        let correctAnswer, analysis
        const answerMatch = content.match(/【答案】\s*([^\n【]+)/)
        if (answerMatch) {
            correctAnswer = answerMatch[1].trim()
            content = content.replace(answerMatch[0], '')
        }
        
        const analysisMatch = content.match(/【解析】([\s\S]*?)(?=【|$)/)
        if (analysisMatch) {
            analysis = analysisMatch[1].trim()
            content = content.replace(analysisMatch[0], '')
        }
        
        const knowledgeMatch = content.match(/【知识点】([\s\S]*?)(?=【|$)/)
        if (knowledgeMatch) {
            content = content.replace(knowledgeMatch[0], '')
        }
        
        content = content.replace(/【[^】]+】[\s\S]*?(?=【|$)/g, '').trim()

        if (content.length < 2) continue;

        if (!isNaN(number)) currentOrder = number;

        questions.push({
            number: numberStr,
            content,
            options: null,
            correctAnswer,
            analysis,
            knowledgeCodes: [type === 'writing' ? 'writing' : 'reading_response'],
            sectionType: type,
            orderIndex: number || ++currentOrder,
            article: article || undefined
        })
    }
    
    return questions
}

// ... parseQuestionBlock 保持不变 ...
function parseQuestionBlock(block: string): ParsedQuestion | null {
    // 增强题号匹配
    const headerMatch = block.match(/(?:^|\n)\s*(?:(?:[（(]\d+分[）)])\s*)?(?:(\d+)[.．、]|[（(](\d+)[）)]|\[(\d+)\]|(①|②|③|④|⑤))/)
    if (!headerMatch) return null
    
    const number = headerMatch[1] || headerMatch[2] || headerMatch[3] || headerMatch[4]
    // 移除题号
    const rawContent = block.replace(headerMatch[0], '').trim()

    let correctAnswer: string | undefined
    let analysis: string | undefined
    let knowledgeStr: string | undefined
    let contentAndOptions = rawContent

    // 提取【答案】
    const answerMatch = rawContent.match(/【答案】\s*([A-D])/)
    if (answerMatch) {
        correctAnswer = answerMatch[1]
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
    
    contentAndOptions = contentAndOptions.replace(/【[^】]+】[\s\S]*?(?=【|$)/g, '')

    // 分离题干和选项
    const optionAIndex = contentAndOptions.search(/\sA[.．、]/)
    
    let content = ''
    let options: string[] = []

    if (optionAIndex !== -1) {
        content = contentAndOptions.substring(0, optionAIndex).trim()
        const optionsPart = contentAndOptions.substring(optionAIndex)
        
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
                const parts = optionsPart.split(/\s*[A-D][.．、]\s*/)
                if (parts.length >= 5) {
                    options = [parts[1].trim(), parts[2].trim(), parts[3].trim(), parts[4].trim()]
                }
        }
    } else {
        content = contentAndOptions.trim()
    }

    const knowledgeCodes: string[] = []
    if (knowledgeStr) {
        if (knowledgeStr.includes('代词')) knowledgeCodes.push('grammar.pronoun')
        // ...
    }

    if (options.length === 4) {
        return {
            number,
            content,
            options,
            correctAnswer,
            analysis,
            knowledgeCodes,
            sectionType: 'single_choice',
            orderIndex: 0,
        }
    }
    return null
}

// ... extractKnowledgeFromQuestion 保持不变 ...
function extractKnowledgeFromQuestion(question: ParsedQuestion): {
  knowledgeCodes: string[]
  confidence: number
} {
  const { content, options } = question
  const fullText = `${content} ${options ? options.join(' ') : ''}`.toLowerCase()

  const knowledgeCodes: string[] = []
  let confidence = 0.5

  const rules = [
    { keywords: ['i', 'you', 'he'], knowledgeCode: 'grammar.pronoun', confidence: 0.8 },
    // ...
  ]

  for (const rule of rules) {
    if (rule.keywords.some((k) => fullText.includes(k))) {
      knowledgeCodes.push(rule.knowledgeCode)
    }
  }

  if (knowledgeCodes.length === 0) {
    knowledgeCodes.push('vocab.general')
    confidence = 0.3
  }

  return { knowledgeCodes: [...new Set(knowledgeCodes)], confidence }
}
