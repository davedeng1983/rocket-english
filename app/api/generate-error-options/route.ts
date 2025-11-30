import { NextResponse } from 'next/server'
import OpenAI from 'openai'

// 初始化 OpenAI 客户端（如果环境变量存在）
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    })
  : null

interface GenerateOptionsRequest {
  gapType: 'vocab' | 'grammar' | 'logic'
  questionContent: string
  questionOptions?: string[]
  correctAnswer?: string
  article?: string // 阅读理解的文章内容
}

/**
 * 根据题目内容，智能生成错误归因选项
 */
export async function POST(request: Request) {
  try {
    const body: GenerateOptionsRequest = await request.json()
    const { gapType, questionContent, questionOptions, correctAnswer, article } = body

    // 如果有AI，使用AI生成；否则使用规则生成
    if (openai) {
      const aiOptions = await generateOptionsWithAI(gapType, questionContent, questionOptions, correctAnswer, article)
      if (aiOptions && aiOptions.length > 0) {
        return NextResponse.json({ options: aiOptions })
      }
    }

    // 降级策略：基于规则生成选项
    const ruleBasedOptions = generateOptionsByRules(gapType, questionContent, questionOptions, article)
    return NextResponse.json({ options: ruleBasedOptions })
  } catch (error) {
    console.error('Failed to generate error options:', error)
    return NextResponse.json(
      { error: 'Failed to generate error options' },
      { status: 500 }
    )
  }
}

/**
 * 使用AI生成选项
 */
async function generateOptionsWithAI(
  gapType: 'vocab' | 'grammar' | 'logic',
  questionContent: string,
  questionOptions?: string[],
  correctAnswer?: string,
  article?: string
): Promise<Array<{ value: string; label: string }> | null> {
  if (!openai) return null

  let prompt = ''

  if (gapType === 'vocab') {
    prompt = `作为初三英语老师，请从以下题目中筛选出3-5个最有可能学生不认识的单词（按难度排序，从最难的开始）。

题目内容：
${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}
${article ? `文章：${article.substring(0, 500)}...` : ''}

要求：
1. 选择中等及以上难度的词汇（排除简单词汇如 the, is, are 等）
2. 优先选择学术词汇、高级词汇
3. 每个单词提供中文释义（放在括号内）
4. 返回JSON格式：{"options": [{"value": "单词（中文释义）", "label": "单词（中文释义）"}]}

只返回JSON，不要其他文字。`
  } else if (gapType === 'grammar') {
    prompt = `作为初三英语老师，请分析以下题目可能涉及的语法点，生成3-5个可能的语法问题选项。

题目内容：
${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}
${correctAnswer ? `正确答案：${correctAnswer}` : ''}

要求：
1. 识别题目中可能存在的语法点（时态、语态、从句、非谓语等）
2. 每个选项描述具体的语法问题，例如："第X句话的被动语态不理解"、"if引导的条件句不清楚"等
3. 返回JSON格式：{"options": [{"value": "语法问题描述", "label": "语法问题描述"}]}

只返回JSON，不要其他文字。`
  } else {
    // logic
    prompt = `作为初三英语老师，请分析以下阅读理解题目，找出可能的逻辑理解难点，生成3-5个选项。

${article ? `文章内容：\n${article}\n\n` : ''}
题目：${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}

要求：
1. 识别文章中的逻辑关系（因果关系、转折关系、条件关系等）
2. 找出可能理解困难的句子或段落
3. 每个选项描述具体的逻辑问题，例如："第2段的因果关系不理解"、"转折词but后面的意思不清楚"等
4. 返回JSON格式：{"options": [{"value": "逻辑问题描述", "label": "逻辑问题描述"}]}

只返回JSON，不要其他文字。`
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      response_format: { type: 'json_object' },
      temperature: 0.7,
    })

    const content = completion.choices[0].message.content
    if (!content) return null

    const parsed = JSON.parse(content)
    const options = parsed.options || []
    
    // 确保返回的格式正确
    return Array.isArray(options) 
      ? options.map((opt: any) => ({
          value: typeof opt === 'string' ? opt : (opt.value || opt.label || opt),
          label: typeof opt === 'string' ? opt : (opt.label || opt.value || opt),
        }))
      : null
  } catch (error) {
    console.error('AI generation failed:', error)
    return null
  }
}

/**
 * 基于规则生成选项（降级策略）
 */
function generateOptionsByRules(
  gapType: 'vocab' | 'grammar' | 'logic',
  questionContent: string,
  questionOptions?: string[],
  article?: string
): Array<{ value: string; label: string }> {
  
  if (gapType === 'vocab') {
    // 提取可能的生词（简单的规则：提取较长的单词）
    const fullText = `${questionContent} ${questionOptions?.join(' ') || ''} ${article || ''}`
    const words = fullText.match(/\b[a-zA-Z]{5,}\b/g) || []
    
    // 去重并限制数量
    const uniqueWords = Array.from(new Set(words))
      .filter(w => !['which', 'their', 'there', 'would', 'could', 'should'].includes(w.toLowerCase()))
      .slice(0, 5)
    
    return uniqueWords.map(word => ({
      value: word,
      label: word
    }))
  } else if (gapType === 'grammar') {
    // 基于关键词识别可能的语法点
    const fullText = `${questionContent} ${questionOptions?.join(' ') || ''}`.toLowerCase()
    
    const options: Array<{ value: string; label: string }> = []
    
    // 检查时态
    if (fullText.match(/\b(was|were|has|have|had|will|would)\b/)) {
      options.push({ value: '时态用法不理解', label: '时态用法不理解' })
    }
    
    // 检查被动语态
    if (fullText.match(/\b(was|were|is|are|been)\s+\w+ed\b/)) {
      options.push({ value: '被动语态不理解', label: '被动语态不理解' })
    }
    
    // 检查从句
    if (fullText.match(/\b(that|which|who|where|when|if|because|although)\b/)) {
      options.push({ value: '从句结构不理解', label: '从句结构不理解' })
    }
    
    // 检查非谓语动词
    if (fullText.match(/\b(to\s+\w+|ing\s+\w+)\b/)) {
      options.push({ value: '非谓语动词用法不清楚', label: '非谓语动词用法不清楚' })
    }
    
    // 检查虚拟语气
    if (fullText.match(/\b(if\s+\w+\s+would|wish|if\s+only)\b/)) {
      options.push({ value: '虚拟语气不理解', label: '虚拟语气不理解' })
    }
    
    // 如果选项不足，添加通用选项
    while (options.length < 3) {
      options.push({ 
        value: `其他语法点（请具体说明）`, 
        label: `其他语法点（请具体说明）` 
      })
    }
    
    return options.slice(0, 5)
  } else {
    // logic
    const fullText = `${article || ''} ${questionContent}`.toLowerCase()
    
    const options: Array<{ value: string; label: string }> = []
    
    // 检查转折关系
    if (fullText.match(/\b(but|however|although|though|yet)\b/)) {
      options.push({ value: '转折关系不理解', label: '转折关系不理解' })
    }
    
    // 检查因果关系
    if (fullText.match(/\b(because|since|as|so|therefore|thus)\b/)) {
      options.push({ value: '因果关系不理解', label: '因果关系不理解' })
    }
    
    // 检查条件关系
    if (fullText.match(/\b(if|unless|provided|as long as)\b/)) {
      options.push({ value: '条件关系不理解', label: '条件关系不理解' })
    }
    
    // 检查推理
    if (fullText.match(/\b(infer|imply|suggest|indicate)\b/)) {
      options.push({ value: '推理理解困难', label: '推理理解困难' })
    }
    
    // 如果选项不足，添加通用选项
    while (options.length < 3) {
      options.push({ 
        value: '其他逻辑关系（请具体说明）', 
        label: '其他逻辑关系（请具体说明）' 
      })
    }
    
    return options.slice(0, 5)
  }
}

