import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveLearningGaps, createDailyTasks } from '@/lib/supabase/tasks'
import OpenAI from 'openai'

// 初始化 OpenAI 客户端（如果环境变量存在）
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL, // 支持兼容 OpenAI 接口的其他服务（如 DeepSeek, Google Gemini via Proxy）
    })
  : null

/**
 * 使用 AI 生成针对性学习内容
 */
async function generateContentWithAI(gap: any) {
  if (!openai) return null

  const question = gap.questions
  const prompt = `
作为一名初三英语老师，请根据学生的错题生成补习内容。返回纯 JSON 格式。

【错题信息】
题目：${question.content}
选项：${JSON.stringify(question.options)}
正确答案：${question.correct_answer}
用户归因：${gap.gap_detail} (类型：${gap.gap_type})

【生成要求】
1. 如果是生词(vocab)：返回 {"word": "核心词", "definition": "中文释义", "example": "英文例句"}
2. 如果是语法(grammar)：返回 {"knowledge_point": "语法点名称", "explanation": "针对该题的解析(100字内)", "example": "一个简单的正确例句"}
3. 如果是逻辑/阅读(logic)：返回 {"explanation": "解题思路或逻辑分析(100字内)", "reading_tip": "一句阅读技巧"}

只返回 JSON，不要 Markdown 格式。
`

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo', // 允许通过环境变量配置模型
      response_format: { type: 'json_object' },
    })

    const content = completion.choices[0].message.content
    return content ? JSON.parse(content) : null
  } catch (error) {
    console.error('AI Generation Error:', error)
    return null
  }
}

/**
 * 生成周中补短板计划
 * 根据用户的学习漏洞，生成周一至周五的每日任务
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
    // 1. 获取用户的所有活跃漏洞
    const { data: gaps, error: gapsError } = await getActiveLearningGaps(
      user.id
    )

    if (gapsError || !gaps || gaps.length === 0) {
      return NextResponse.json({
        message: '暂无需要补短板的漏洞',
        tasks: [],
      })
    }

    // 2. 按类型分组漏洞
    const vocabGaps = gaps.filter((g) => g.gap_type === 'vocab')
    const grammarGaps = gaps.filter((g) => g.gap_type === 'grammar')
    const logicGaps = gaps.filter((g) => g.gap_type === 'logic')

    // 3. 计算本周的日期（周一至周五）
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, ...
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + 1) // 本周一

    const weekdays: string[] = []
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      weekdays.push(date.toISOString().split('T')[0]) // YYYY-MM-DD
    }

    // 4. 生成任务（并发生成 AI 内容）
    const tasks: Array<{
      user_id: string
      scheduled_date: string
      task_type: 'vocab_card' | 'grammar_video' | 'exercise'
      content: any
      source_gap_id?: string
    }> = []

    // 辅助函数：生成并添加任务
    const addTask = async (gap: any, date: string, type: 'vocab_card' | 'grammar_video' | 'exercise') => {
      let content = await generateContentWithAI(gap)

      // 降级策略：如果 AI 未配置或失败，使用默认模版
      if (!content) {
        if (type === 'vocab_card') {
          content = {
            word: gap.gap_detail || 'unknown',
            definition: '需要记忆的单词（AI 未配置）',
            example: '请查看题目上下文',
            gap_id: gap.id,
          }
        } else if (type === 'grammar_video') {
          content = {
            knowledge_point: gap.gap_detail || '语法点',
            explanation: '请查看相关语法讲解（AI 未配置）',
            examples: [],
            practice_questions: [],
            gap_id: gap.id,
          }
        } else {
          content = {
            questions: [],
            explanation: '请练习相关阅读题（AI 未配置）',
            reading_tip: '注意上下文逻辑',
            gap_id: gap.id,
          }
        }
      }
      
      // 确保 content 里有 gap_id
      content.gap_id = gap.id

      tasks.push({
        user_id: user.id,
        scheduled_date: date,
        task_type: type,
        content,
        source_gap_id: gap.id,
      })
    }

    const promises: Promise<void>[] = []

    // 周一、周三：单词任务
    vocabGaps.forEach((gap, index) => {
      const dayIndex = index % 2 // 0 或 1
      promises.push(addTask(gap, weekdays[dayIndex * 2], 'vocab_card'))
    })

    // 周二、周四：语法任务
    grammarGaps.forEach((gap, index) => {
      const dayIndex = index % 2 // 0 或 1
      promises.push(addTask(gap, weekdays[dayIndex * 2 + 1], 'grammar_video'))
    })

    // 周五：逻辑/阅读任务
    logicGaps.forEach((gap) => {
      promises.push(addTask(gap, weekdays[4], 'exercise'))
    })

    // 等待所有 AI 生成完成
    await Promise.all(promises)

    // 5. 批量创建任务
    if (tasks.length > 0) {
      const { data: createdTasks, error: createError } =
        await createDailyTasks(tasks)

      if (createError) {
        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `成功生成 ${createdTasks?.length || 0} 个任务${openai ? ' (AI Enhanced)' : ''}`,
        tasks: createdTasks,
      })
    }

    return NextResponse.json({
      message: '没有需要生成的任务',
      tasks: [],
    })
  } catch (error: any) {
    console.error('Generate Plan Error:', error)
    return NextResponse.json(
      { error: error.message || '生成计划失败' },
      { status: 500 }
    )
  }
}

