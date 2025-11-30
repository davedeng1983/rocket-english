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
    prompt = `作为初三英语老师，请仔细分析以下题目，识别学生可能不理解的语法点，生成3-5个具体的语法问题选项。

题目内容：
${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}
${correctAnswer ? `正确答案：${correctAnswer}` : ''}

请重点分析以下语法点：
1. **情态动词**：can/could/may/might/must/should 的用法和区别
2. **时态**：一般现在时、一般过去时、现在完成时、过去完成时等
3. **语态**：主动语态和被动语态
4. **从句**：定语从句、状语从句、宾语从句等
5. **非谓语动词**：to do, doing, done 的用法
6. **虚拟语气**：if条件句、wish等
7. **主谓一致**：单复数一致
8. **固定搭配**：动词短语、介词搭配等

要求：
1. 必须根据题目内容具体分析，不要生成通用选项
2. 每个选项要具体描述语法问题，例如：
   - "can/could/may 表示请求许可的用法不理解"
   - "被动语态 'was asked' 的结构不清楚"
   - "if引导的条件句的时态规则不理解"
   - "定语从句中 which 和 that 的区别不清楚"
3. 如果题目涉及多个语法点，优先选择最核心的3-5个
4. 返回JSON格式：{"options": [{"value": "具体语法问题描述", "label": "具体语法问题描述"}]}

只返回JSON，不要其他文字。`
  } else {
    // logic
    prompt = `作为初三英语老师，请仔细分析以下阅读理解题目，找出学生可能不理解的逻辑关系，生成3-5个具体的逻辑问题选项。

${article ? `文章内容：\n${article.substring(0, 2000)}\n\n` : ''}
题目：${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}

请重点分析以下逻辑关系：
1. **因果关系**：because, since, as, so, therefore, thus 等
2. **转折关系**：but, however, although, though, yet, while 等
3. **条件关系**：if, unless, provided that, as long as 等
4. **递进关系**：and, also, moreover, furthermore 等
5. **对比关系**：while, whereas, on the other hand 等
6. **时间顺序**：first, then, finally, after, before 等
7. **推理判断**：infer, imply, suggest, indicate, conclude 等
8. **指代关系**：this, that, these, those, it, they 等指代的内容

要求：
1. 必须根据文章和题目内容具体分析，不要生成通用选项
2. 每个选项要具体描述逻辑问题，例如：
   - "第2段中 'because' 引导的因果关系不理解"
   - "转折词 'however' 后面的意思不清楚"
   - "无法理解 'this' 指代的具体内容"
   - "推理题：无法从文章推断出答案"
3. 如果涉及多个逻辑关系，优先选择最核心的3-5个
4. 返回JSON格式：{"options": [{"value": "具体逻辑问题描述", "label": "具体逻辑问题描述"}]}

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
    
    // 检查情态动词（请求许可、能力、推测等）
    if (fullText.match(/\b(can|could|may|might|must|should|would)\b/)) {
      const modalVerbs = fullText.match(/\b(can|could|may|might|must|should|would)\b/g) || []
      const uniqueModals = Array.from(new Set(modalVerbs))
      if (uniqueModals.length > 0) {
        const modalStr = uniqueModals.join('/')
        if (fullText.match(/\b(can|could|may)\s+(i|you|we|they)\s+\w+/i)) {
          options.push({ value: `${modalStr} 表示请求许可的用法不理解`, label: `${modalStr} 表示请求许可的用法不理解` })
        } else if (fullText.match(/\b(can|could)\s+\w+/i)) {
          options.push({ value: `${modalStr} 表示能力的用法不理解`, label: `${modalStr} 表示能力的用法不理解` })
        } else {
          options.push({ value: `情态动词 ${modalStr} 的用法不理解`, label: `情态动词 ${modalStr} 的用法不理解` })
        }
      }
    }
    
    // 检查时态
    if (fullText.match(/\b(was|were|has|have|had|will|would|did|does|did)\b/)) {
      if (fullText.match(/\b(has|have)\s+\w+ed\b/)) {
        options.push({ value: '现在完成时的用法不理解', label: '现在完成时的用法不理解' })
      } else if (fullText.match(/\b(had)\s+\w+ed\b/)) {
        options.push({ value: '过去完成时的用法不理解', label: '过去完成时的用法不理解' })
      } else if (fullText.match(/\b(was|were)\b/)) {
        options.push({ value: '一般过去时的用法不理解', label: '一般过去时的用法不理解' })
      } else if (fullText.match(/\b(will|would)\b/)) {
        options.push({ value: '将来时的用法不理解', label: '将来时的用法不理解' })
      } else {
        options.push({ value: '时态用法不理解', label: '时态用法不理解' })
      }
    }
    
    // 检查被动语态
    if (fullText.match(/\b(was|were|is|are|been)\s+\w+ed\b/)) {
      options.push({ value: '被动语态的结构不理解', label: '被动语态的结构不理解' })
    }
    
    // 检查从句
    if (fullText.match(/\b(that|which|who|whom|whose|where|when|why)\b/)) {
      if (fullText.match(/\b(which|that)\b/)) {
        options.push({ value: '定语从句中 which 和 that 的区别不清楚', label: '定语从句中 which 和 that 的区别不清楚' })
      } else {
        options.push({ value: '定语从句的结构不理解', label: '定语从句的结构不理解' })
      }
    }
    if (fullText.match(/\b(if|because|although|though|when|while|since|as)\b/)) {
      if (fullText.match(/\bif\b/)) {
        options.push({ value: 'if 引导的条件句的时态规则不理解', label: 'if 引导的条件句的时态规则不理解' })
      } else {
        options.push({ value: '状语从句的结构不理解', label: '状语从句的结构不理解' })
      }
    }
    
    // 检查非谓语动词
    if (fullText.match(/\b(to\s+\w+|ing\s+\w+|ed\s+\w+)\b/)) {
      if (fullText.match(/\bto\s+\w+\b/)) {
        options.push({ value: '动词不定式 to do 的用法不清楚', label: '动词不定式 to do 的用法不清楚' })
      } else if (fullText.match(/\bing\s+\w+\b/)) {
        options.push({ value: '动名词 doing 的用法不清楚', label: '动名词 doing 的用法不清楚' })
      } else {
        options.push({ value: '非谓语动词的用法不清楚', label: '非谓语动词的用法不清楚' })
      }
    }
    
    // 检查虚拟语气
    if (fullText.match(/\b(if\s+\w+\s+would|wish|if\s+only|were)\b/)) {
      options.push({ value: '虚拟语气的用法不理解', label: '虚拟语气的用法不理解' })
    }
    
    // 检查主谓一致
    if (fullText.match(/\b(is|are|was|were|has|have)\b/)) {
      // 简单检查：如果同时出现 is/are 或 was/were，可能是主谓一致问题
      if ((fullText.includes('is') && fullText.includes('are')) || 
          (fullText.includes('was') && fullText.includes('were'))) {
        options.push({ value: '主谓一致的规则不理解', label: '主谓一致的规则不理解' })
      }
    }
    
    // 去重
    const uniqueOptions = Array.from(new Map(options.map(opt => [opt.value, opt])).values())
    
    // 如果选项不足，添加通用选项
    if (uniqueOptions.length < 3) {
      uniqueOptions.push({ 
        value: '其他语法点（请具体说明）', 
        label: '其他语法点（请具体说明）' 
      })
    }
    
    return uniqueOptions.slice(0, 5)
  } else {
    // logic
    const fullText = `${article || ''} ${questionContent}`.toLowerCase()
    
    const options: Array<{ value: string; label: string }> = []
    
    // 检查转折关系
    const contrastWords = fullText.match(/\b(but|however|although|though|yet|while|whereas|on the other hand)\b/g)
    if (contrastWords && contrastWords.length > 0) {
      const uniqueWords = Array.from(new Set(contrastWords))
      options.push({ 
        value: `转折关系不理解（如 ${uniqueWords.join('、')} 等）`, 
        label: `转折关系不理解（如 ${uniqueWords.join('、')} 等）` 
      })
    }
    
    // 检查因果关系
    const causeWords = fullText.match(/\b(because|since|as|so|therefore|thus|as a result|due to)\b/g)
    if (causeWords && causeWords.length > 0) {
      const uniqueWords = Array.from(new Set(causeWords))
      options.push({ 
        value: `因果关系不理解（如 ${uniqueWords.join('、')} 等）`, 
        label: `因果关系不理解（如 ${uniqueWords.join('、')} 等）` 
      })
    }
    
    // 检查条件关系
    const conditionWords = fullText.match(/\b(if|unless|provided|as long as|in case)\b/g)
    if (conditionWords && conditionWords.length > 0) {
      const uniqueWords = Array.from(new Set(conditionWords))
      options.push({ 
        value: `条件关系不理解（如 ${uniqueWords.join('、')} 等）`, 
        label: `条件关系不理解（如 ${uniqueWords.join('、')} 等）` 
      })
    }
    
    // 检查递进关系
    const additionWords = fullText.match(/\b(and|also|moreover|furthermore|in addition|besides)\b/g)
    if (additionWords && additionWords.length > 0) {
      options.push({ value: '递进关系不理解', label: '递进关系不理解' })
    }
    
    // 检查时间顺序
    const timeWords = fullText.match(/\b(first|then|finally|after|before|next|later|meanwhile)\b/g)
    if (timeWords && timeWords.length > 0) {
      options.push({ value: '时间顺序关系不理解', label: '时间顺序关系不理解' })
    }
    
    // 检查推理题
    if (fullText.match(/\b(infer|imply|suggest|indicate|conclude|inference|implication)\b/)) {
      options.push({ value: '推理题：无法从文章推断出答案', label: '推理题：无法从文章推断出答案' })
    }
    
    // 检查指代关系
    if (fullText.match(/\b(this|that|these|those|it|they|them)\b/)) {
      options.push({ value: '指代关系不理解（如 this/that/it 等指代的内容）', label: '指代关系不理解（如 this/that/it 等指代的内容）' })
    }
    
    // 检查对比关系
    if (fullText.match(/\b(while|whereas|on the other hand|in contrast)\b/)) {
      options.push({ value: '对比关系不理解', label: '对比关系不理解' })
    }
    
    // 去重
    const uniqueOptions = Array.from(new Map(options.map(opt => [opt.value, opt])).values())
    
    // 如果选项不足，添加通用选项
    if (uniqueOptions.length < 3) {
      uniqueOptions.push({ 
        value: '其他逻辑关系（请具体说明）', 
        label: '其他逻辑关系（请具体说明）' 
      })
    }
    
    return uniqueOptions.slice(0, 5)
  }
}

