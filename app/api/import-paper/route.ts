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

    // 使用 mammoth 解析 Word 文档
    const result = await mammoth.extractRawText({ arrayBuffer })
    const text = result.value

    // 提取试卷信息
    const title = extractTitle(text) || file.name.replace(/\.(docx|doc)$/i, '')
    const metadata = extractMetadata(text)

    // 提取题目
    const questions = extractQuestions(text)

    if (questions.length === 0) {
      return NextResponse.json(
        { error: '未能从文档中提取到题目，请检查文档格式' },
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
      analysis: null,
      meta: {
        kps: [], // 将在下一步填充
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
      const knowledge = extractKnowledgeFromQuestion(originalQuestion)

      knowledge.knowledgeCodes.forEach((code) => {
        edgesToInsert.push({
          question_id: question.id,
          knowledge_code: code,
          weight: knowledge.confidence,
          dimension: 'application',
        })
      })

      // 更新题目的 meta 字段
      supabase
        .from('questions')
        .update({
          meta: {
            kps: knowledge.knowledgeCodes,
          },
        })
        .eq('id', question.id)
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

  // 匹配题目的正则表达式
  // 格式：1. 题干内容 A. 选项A B. 选项B C. 选项C D. 选项D
  const questionPattern =
    /(\d+)\.\s*([^A-Z]+?)\s*(A\.\s*[^\n]+)\s*(B\.\s*[^\n]+)\s*(C\.\s*[^\n]+)\s*(D\.\s*[^\n]+)/g

  let match
  let orderIndex = 0

  while ((match = questionPattern.exec(text)) !== null) {
    const number = match[1]
    const content = match[2].trim()
    const options = [
      match[3].replace(/^A\.\s*/, '').trim(),
      match[4].replace(/^B\.\s*/, '').trim(),
      match[5].replace(/^C\.\s*/, '').trim(),
      match[6].replace(/^D\.\s*/, '').trim(),
    ]

    questions.push({
      number,
      content,
      options,
      sectionType: 'single_choice',
      orderIndex: orderIndex++,
    })
  }

  return questions
}

/**
 * 从题目内容中提取知识点
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
      keywords: [
        'i',
        'you',
        'he',
        'she',
        'we',
        'they',
        'my',
        'your',
        'his',
        'her',
        'our',
        'their',
      ],
      knowledgeCode: 'grammar.pronoun.subject',
      confidence: 0.8,
    },
    {
      keywords: ['is spoken', 'was spoken', 'be done', 'be made', 'be used'],
      knowledgeCode: 'grammar.passive',
      confidence: 0.9,
    },
    {
      keywords: ['yesterday', 'last week', 'last year', 'ago', 'was', 'were', 'did'],
      knowledgeCode: 'grammar.tense.past',
      confidence: 0.8,
    },
    {
      keywords: ['will', 'going to', 'next week', 'next year', 'tomorrow'],
      knowledgeCode: 'grammar.tense.future',
      confidence: 0.8,
    },
    {
      keywords: ['every day', 'often', 'usually', 'always', 'sometimes'],
      knowledgeCode: 'grammar.tense.present',
      confidence: 0.7,
    },
    {
      keywords: ['confident', 'ambition', 'strategy', 'achieve'],
      knowledgeCode: 'vocab.level3',
      confidence: 0.6,
    },
    {
      keywords: ['interesting', 'interested', 'excited', 'exciting'],
      knowledgeCode: 'vocab.level2',
      confidence: 0.6,
    },
    {
      keywords: ['read', 'understand', 'passage', 'article', 'text'],
      knowledgeCode: 'logic.reading',
      confidence: 0.7,
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

  // 如果没有匹配到，返回通用知识点
  if (knowledgeCodes.length === 0) {
    knowledgeCodes.push('vocab.level2')
    confidence = 0.3
  }

  return {
    knowledgeCodes: [...new Set(knowledgeCodes)], // 去重
    confidence,
  }
}
