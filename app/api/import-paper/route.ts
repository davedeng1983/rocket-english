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

    // 提取题目 (使用新的分模块解析器)
    const questions = extractQuestions(text)

    // 调试模式：即使成功也附带文本样本
    const splitPoint = Math.floor(text.length * 0.4)
    const debugText = "--- DEBUG MODE: SHOWING LAST 60% OF TEXT ---\n" + text.substring(splitPoint)

    if (questions.length === 0) {
      console.log('Parsed Text Sample:', text.substring(0, 1000))
      return NextResponse.json(
        { 
            error: '未能从文档中提取到题目。',
            debug_text: text.substring(0, 800)
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
        kps: q.knowledgeCodes.length > 0 ? q.knowledgeCodes : [],
        article: q.article || null // 存储阅读理解或完形填空的文章内容
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
  options: string[]
  correctAnswer?: string
  analysis?: string
  knowledgeCodes: string[]
  sectionType: 'single_choice' | 'cloze' | 'reading' | 'writing'
  orderIndex: number
  article?: string // 新增：存储所属的文章内容
}

// ... (extractTitle 和 extractMetadata 保持不变) ...
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
 * 核心解析逻辑：基于大模块切分
 */
function extractQuestions(text: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  let orderIndex = 0

  // 1. 按大题切分模块
  // 匹配 "一、" "二、" "三、" "四、" "五、" ...
  const sectionRegex = /(?:^|\n)\s*([一二三四五六七八九十]+)、\s*([^\n]+)/g
  const sections: { title: string; content: string }[] = []
  
  let lastIndex = 0
  let match
  
  while ((match = sectionRegex.exec(text)) !== null) {
    if (sections.length > 0) {
      // 结束上一个 section
      sections[sections.length - 1].content = text.substring(lastIndex, match.index)
    }
    // 开启新 section
    sections.push({
      title: match[1] + '、' + match[2],
      content: '' // 暂时为空，等待下一个匹配来截断
    })
    lastIndex = match.index + match[0].length
  }
  // 补上最后一个 section 的内容
  if (sections.length > 0) {
    sections[sections.length - 1].content = text.substring(lastIndex)
  } else {
    // 如果没有找到大题号，就把全文当做一个 Section 处理（降级兼容）
    sections.push({ title: '默认部分', content: text })
  }

  // 2. 遍历每个模块，根据标题决定解析策略
  for (const section of sections) {
    const { title, content } = section
    
    // 策略分发
    if (title.includes('单项') || title.includes('选择')) {
       // A. 单项选择策略
       questions.push(...parseSingleChoice(content, orderIndex))
    } else if (title.includes('完形') || title.includes('完型')) {
       // B. 完形填空策略
       questions.push(...parseCloze(content, orderIndex))
    } else if (title.includes('阅读')) {
       // C. 阅读理解策略
       questions.push(...parseReading(content, orderIndex))
    } else {
       // D. 默认策略（尝试按单选解析）
       questions.push(...parseSingleChoice(content, orderIndex))
    }
    
    // 更新 orderIndex，避免题号冲突
    orderIndex += questions.length
  }

  return questions
}

// === 策略 A: 单项选择解析 (复用之前的逻辑) ===
function parseSingleChoice(text: string, startIndex: number): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  const questionSplitPattern = /(?=\d+[.．、]\s*[（(]?\s*\d*\.?\d*\s*分?[）)]?)/g
  const rawBlocks = text.split(questionSplitPattern)
  let currentOrder = startIndex

  for (const block of rawBlocks) {
    if (block.length < 10 || !block.match(/^\d+[.．、]/)) continue
    try {
        const q = parseQuestionBlock(block)
        if (q) {
            q.sectionType = 'single_choice'
            q.orderIndex = ++currentOrder
            questions.push(q)
        }
    } catch (e) {}
  }
  return questions
}

// === 策略 B: 完形填空解析 ===
function parseCloze(text: string, startIndex: number): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []
  let currentOrder = startIndex

  // 完形填空通常先有一大段文章，然后才是题目
  // 题目特征：13. A... B...
  // 我们尝试找到第一个题目开始的位置，前面的都算文章
  const firstQuestionIndex = text.search(/\d+[.．、]\s*A[.．、]/)
  
  let article = ''
  let questionsText = text

  if (firstQuestionIndex !== -1) {
      article = text.substring(0, firstQuestionIndex).trim()
      questionsText = text.substring(firstQuestionIndex)
  }

  // 解析题目部分
  const rawBlocks = questionsText.split(/(?=\d+[.．、])/g)
  for (const block of rawBlocks) {
      if (block.length < 5 || !block.match(/^\d+[.．、]/)) continue
      const q = parseQuestionBlock(block)
      if (q) {
          q.sectionType = 'cloze'
          q.orderIndex = ++currentOrder
          q.article = article // 关联文章
          questions.push(q)
      }
  }
  return questions
}

// === 策略 C: 阅读理解解析 ===
function parseReading(text: string, startIndex: number): ParsedQuestion[] {
    const questions: ParsedQuestion[] = []
    let currentOrder = startIndex

    // 阅读理解通常包含 A、B、C、D 篇
    // 简单的策略：也是先分离文章和题目，但每篇文章对应一组题目
    // 这里简化处理：假设每篇文章以 "A" "B" "C" 等大写字母单独一行开头，或者直接是文章
    // 这是一个难点，MVP 阶段我们采用简单的策略：
    // 只要看到大段文字就认为是文章，看到 1. A. B. 就认为是题目
    
    // 我们复用完形填空的逻辑，把前面的一大段文字当做文章
    // 注意：这会将多篇阅读理解混在一起，但起码能把题目抓出来
    
    // 更好的做法是再次切分 "Passage A" 或 "A"
    // 暂时复用 parseCloze，因为它能通用处理 "文章 + 题目" 的结构
    const subQuestions = parseCloze(text, startIndex)
    subQuestions.forEach(q => {
        q.sectionType = 'reading'
        questions.push(q)
    })
    
    return questions
}

// === 通用：解析单个题目块 ===
function parseQuestionBlock(block: string): ParsedQuestion | null {
    const headerMatch = block.match(/^(\d+)[.．、]\s*(?:[（(](\d*\.?\d*)\s*分?[）)])?\s*/)
    if (!headerMatch) return null
    
    const number = headerMatch[1]
    const rawContent = block.substring(headerMatch[0].length)

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

    // 知识点映射
    const knowledgeCodes: string[] = []
    if (knowledgeStr) {
        if (knowledgeStr.includes('代词')) knowledgeCodes.push('grammar.pronoun')
        if (knowledgeStr.includes('时态')) knowledgeCodes.push('grammar.tense')
        if (knowledgeStr.includes('被动')) knowledgeCodes.push('grammar.passive')
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
            sectionType: 'single_choice', // 默认为单选，外部可覆盖
            orderIndex: 0, // 外部覆盖
        }
    }
    return null
}

// ... (extractKnowledgeFromQuestion 保持不变) ...
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
