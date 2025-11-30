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
  userAnswer?: string // 学生的错误答案
  article?: string // 阅读理解的文章内容
  analysis?: string // 题目解析
  knowledgePoints?: string[] // 题目知识点
  sectionType?: string // 题目类型：single_choice, cloze, reading, writing
}

/**
 * 根据题目内容，智能生成错误归因选项
 */
export async function POST(request: Request) {
  try {
    const body: GenerateOptionsRequest = await request.json()
    const { 
      gapType, 
      questionContent, 
      questionOptions, 
      correctAnswer, 
      userAnswer,
      article, 
      analysis,
      knowledgePoints,
      sectionType
    } = body

    // 策略1：如果有题目解析，尝试从解析中提取关键信息
    if (analysis && analysis.trim().length > 0) {
      const extractedOptions = extractFromAnalysis(analysis, gapType, questionContent, userAnswer, correctAnswer)
      if (extractedOptions && extractedOptions.length > 0) {
        return NextResponse.json({ options: extractedOptions })
      }
    }

    // 策略2：如果有知识点标签，优先使用
    if (knowledgePoints && knowledgePoints.length > 0 && gapType !== 'logic') {
      const kpOptions = generateFromKnowledgePoints(knowledgePoints, gapType, questionContent)
      if (kpOptions && kpOptions.length > 0) {
        // 如果有AI，可以进一步优化；否则直接返回
        if (openai) {
          const aiOptions = await generateOptionsWithAI(
            gapType, 
            questionContent, 
            questionOptions, 
            correctAnswer, 
            userAnswer,
            article,
            analysis,
            knowledgePoints,
            sectionType
          )
          if (aiOptions && aiOptions.length > 0) {
            return NextResponse.json({ options: aiOptions })
          }
        }
        return NextResponse.json({ options: kpOptions })
      }
    }

    // 策略3：如果有AI，使用AI生成（包含更多上下文）
    if (openai) {
      const aiOptions = await generateOptionsWithAI(
        gapType, 
        questionContent, 
        questionOptions, 
        correctAnswer, 
        userAnswer,
        article,
        analysis,
        knowledgePoints,
        sectionType
      )
      if (aiOptions && aiOptions.length > 0) {
        return NextResponse.json({ options: aiOptions })
      }
    }

    // 策略4：降级策略：基于规则生成选项（包含错误答案分析）
    const ruleBasedOptions = generateOptionsByRules(
      gapType, 
      questionContent, 
      questionOptions, 
      article, 
      userAnswer, 
      correctAnswer,
      sectionType
    )
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
/**
 * 从题目解析中提取错误原因
 */
function extractFromAnalysis(
  analysis: string,
  gapType: 'vocab' | 'grammar' | 'logic',
  questionContent: string,
  userAnswer?: string,
  correctAnswer?: string
): Array<{ value: string; label: string }> | null {
  const options: Array<{ value: string; label: string }> = []
  const analysisLower = analysis.toLowerCase()
  
  if (gapType === 'vocab') {
    // 从解析中提取生词
    const vocabPatterns = [
      /(?:单词|词汇|生词)[：:]\s*([^，,。\n]+)/g,
      /([a-zA-Z]+)\s*（[^）)]+）/g, // 单词（中文）
      /([a-zA-Z]+)\s*\([^)]+\)/g, // word (meaning)
    ]
    
    for (const pattern of vocabPatterns) {
      const matches = analysis.matchAll(pattern)
      for (const match of matches) {
        const word = match[1]?.trim()
        if (word && word.length > 3 && !['the', 'and', 'are', 'was', 'were'].includes(word.toLowerCase())) {
          options.push({ value: word, label: word })
        }
      }
    }
  } else if (gapType === 'grammar') {
    // 从解析中提取语法点
    const grammarKeywords = [
      { pattern: /(?:时态|tense)/i, label: '时态用法不理解' },
      { pattern: /(?:被动|passive|语态)/i, label: '被动语态不理解' },
      { pattern: /(?:从句|clause)/i, label: '从句结构不理解' },
      { pattern: /(?:非谓语|non-finite)/i, label: '非谓语动词用法不清楚' },
      { pattern: /(?:虚拟|subjunctive)/i, label: '虚拟语气不理解' },
      { pattern: /(?:情态|modal)/i, label: '情态动词用法不理解' },
      { pattern: /(?:主谓一致|subject-verb)/i, label: '主谓一致不理解' },
    ]
    
    for (const { pattern, label } of grammarKeywords) {
      if (pattern.test(analysis)) {
        options.push({ value: label, label })
      }
    }
  } else if (gapType === 'logic') {
    // 从解析中提取逻辑关系
    const logicKeywords = [
      { pattern: /(?:因果|because|since|as|so)/i, label: '因果关系不理解' },
      { pattern: /(?:转折|but|however|although)/i, label: '转折关系不理解' },
      { pattern: /(?:条件|if|unless)/i, label: '条件关系不理解' },
      { pattern: /(?:推理|infer|imply|suggest)/i, label: '推理理解困难' },
      { pattern: /(?:指代|this|that|it)/i, label: '指代关系不理解' },
    ]
    
    for (const { pattern, label } of logicKeywords) {
      if (pattern.test(analysis)) {
        options.push({ value: label, label })
      }
    }
  }
  
  return options.length > 0 ? options.slice(0, 5) : null
}

/**
 * 从知识点标签生成选项
 */
function generateFromKnowledgePoints(
  knowledgePoints: string[],
  gapType: 'vocab' | 'grammar' | 'logic',
  questionContent: string
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  
  const kpMap: Record<string, string> = {
    // 语法点
    'grammar.tense': '时态用法不理解',
    'grammar.voice': '被动语态不理解',
    'grammar.sentence': '从句结构不理解',
    'grammar.modal': '情态动词用法不理解',
    'grammar.non_finite': '非谓语动词用法不清楚',
    'grammar.subjunctive': '虚拟语气不理解',
    'grammar.agreement': '主谓一致不理解',
    // 词汇
    'vocab.common': '常用词汇不理解',
    'vocab.academic': '学术词汇不理解',
    'vocab.collocation': '词汇搭配不理解',
    // 逻辑
    'logic.inference': '推理能力不足',
    'logic.connection': '逻辑连接不理解',
    'logic.comprehension': '理解能力不足',
  }
  
  for (const kp of knowledgePoints) {
    if (kpMap[kp]) {
      options.push({ value: kpMap[kp], label: kpMap[kp] })
    } else {
      // 如果没有映射，使用知识点名称
      const displayName = kp.replace(/\./g, ' / ').replace(/_/g, ' ')
      options.push({ value: `${displayName}不理解`, label: `${displayName}不理解` })
    }
  }
  
  return options.slice(0, 5)
}

async function generateOptionsWithAI(
  gapType: 'vocab' | 'grammar' | 'logic',
  questionContent: string,
  questionOptions?: string[],
  correctAnswer?: string,
  userAnswer?: string,
  article?: string,
  analysis?: string,
  knowledgePoints?: string[],
  sectionType?: string
): Promise<Array<{ value: string; label: string }> | null> {
  if (!openai) return null

  let prompt = ''

  if (gapType === 'vocab') {
    const isReadingComprehension = !!article && article.length > 100
    
    // 构建上下文信息
    let contextInfo = ''
    if (userAnswer && correctAnswer) {
      contextInfo += `\n学生错误答案：${userAnswer}\n正确答案：${correctAnswer}\n`
      if (questionOptions) {
        const wrongOption = questionOptions.find((opt, idx) => {
          const optionLetter = String.fromCharCode(65 + idx) // A, B, C, D
          return userAnswer === optionLetter || userAnswer === opt
        })
        if (wrongOption) {
          contextInfo += `学生选择了：${wrongOption}\n`
        }
      }
    }
    if (analysis) {
      contextInfo += `\n题目解析：${analysis.substring(0, 500)}\n`
    }
    if (knowledgePoints && knowledgePoints.length > 0) {
      contextInfo += `\n题目知识点：${knowledgePoints.join('、')}\n`
    }
    
    if (isReadingComprehension) {
      // 阅读理解题：优先分析文章中的生词
      prompt = `作为初三英语老师，请从以下阅读理解题的文章和题目中筛选出3-5个最有可能学生不认识的单词（按难度排序，从最难的开始）。

文章内容：
${article.substring(0, 3000)}

题目：${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}${contextInfo}

要求：
1. **优先分析文章中的生词**：从文章中找出可能不认识的单词（排除简单词汇如 the, is, are 等）
2. **结合错误答案分析**：如果学生选错了，分析错误选项中可能不认识的单词
3. **其次分析题目和选项中的生词**：如果文章中没有足够的生词，再分析题目和选项
4. 选择中等及以上难度的词汇，优先选择学术词汇、高级词汇
5. 每个单词提供中文释义（放在括号内）
6. 如果单词在文章中出现，可以标注"（文章中）"，例如："ambition（雄心，文章中）"
7. 返回JSON格式：{"options": [{"value": "单词（中文释义）", "label": "单词（中文释义）"}]}

只返回JSON，不要其他文字。`
    } else {
      // 非阅读理解题：只分析题目和选项
      prompt = `作为初三英语老师，请从以下题目中筛选出3-5个最有可能学生不认识的单词（按难度排序，从最难的开始）。

题目内容：
${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}

要求：
1. 选择中等及以上难度的词汇（排除简单词汇如 the, is, are 等）
2. 优先选择学术词汇、高级词汇
3. 每个单词提供中文释义（放在括号内）
4. 返回JSON格式：{"options": [{"value": "单词（中文释义）", "label": "单词（中文释义）"}]}

只返回JSON，不要其他文字。`
    }
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
    const isReadingComprehension = !!article && article.length > 100
    
    if (isReadingComprehension) {
      // 阅读理解题：提供更全面的分析
      prompt = `作为初三英语老师，请仔细分析以下阅读理解题目，找出学生可能不理解的原因，生成3-5个具体的错误原因选项。

文章内容：
${article.substring(0, 3000)}

题目：${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}
${correctAnswer ? `正确答案：${correctAnswer}` : ''}

请从以下角度分析学生可能的错误原因：

【阅读理解题型分析】
1. **细节理解题**：找不到题目问的关键信息在文章的哪个位置
2. **推理判断题**：无法从文章内容推断出答案（infer, imply, suggest等）
3. **主旨大意题**：不理解文章或段落的主旨大意
4. **词义猜测题**：不理解文章中某个词或短语的意思
5. **作者意图题**：不理解作者的写作目的或态度

【逻辑关系分析】
6. **因果关系**：不理解 because, since, as, so, therefore, thus 等引导的因果关系
7. **转折关系**：不理解 but, however, although, though, yet 等转折词的含义
8. **条件关系**：不理解 if, unless, provided that 等条件关系
9. **指代关系**：不理解 this, that, these, those, it, they 等指代的具体内容
10. **时间顺序**：不理解 first, then, finally, after, before 等时间顺序关系

【理解能力分析】
11. **复杂句式**：不理解文章中的长句、复合句或从句结构
12. **段落结构**：不理解段落之间的逻辑关系或文章结构
13. **隐含意思**：无法理解文章的言外之意或深层含义

要求：
1. 必须根据文章和题目内容具体分析，不要生成通用选项
2. 优先识别题目类型（细节题、推理题、主旨题等），然后分析对应的理解难点
3. 每个选项要具体描述问题，例如：
   - "细节理解题：找不到题目问的关键信息在文章中的位置"
   - "推理题：无法从第2段的内容推断出答案"
   - "不理解第1段中 'however' 转折词后面的意思"
   - "无法理解 'this' 在文章中指代的具体内容"
   - "不理解文章的主旨大意"
   - "复杂句式：第3段的长句结构不清楚"
4. 如果涉及多个问题，优先选择最核心的3-5个
5. 返回JSON格式：{"options": [{"value": "具体问题描述", "label": "具体问题描述"}]}

只返回JSON，不要其他文字。`
    } else {
      // 非阅读理解题：主要关注逻辑关系
      prompt = `作为初三英语老师，请仔细分析以下题目，找出学生可能不理解的逻辑关系，生成3-5个具体的逻辑问题选项。

题目：${questionContent}
${questionOptions ? `选项：${questionOptions.join(' | ')}` : ''}
${correctAnswer ? `正确答案：${correctAnswer}` : ''}

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
1. 必须根据题目内容具体分析，不要生成通用选项
2. 每个选项要具体描述逻辑问题，例如：
   - "第2段中 'because' 引导的因果关系不理解"
   - "转折词 'however' 后面的意思不清楚"
   - "无法理解 'this' 指代的具体内容"
   - "推理题：无法从文章推断出答案"
3. 如果涉及多个逻辑关系，优先选择最核心的3-5个
4. 返回JSON格式：{"options": [{"value": "具体逻辑问题描述", "label": "具体逻辑问题描述"}]}

只返回JSON，不要其他文字。`
    }
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
  article?: string,
  userAnswer?: string,
  correctAnswer?: string,
  sectionType?: string
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
    
    // 错误答案分析：如果学生选错了，分析错误选项的干扰点
    if (userAnswer && correctAnswer && questionOptions) {
      const userOptionIndex = userAnswer.charCodeAt(0) - 65 // A=0, B=1, C=2, D=3
      const correctOptionIndex = correctAnswer.charCodeAt(0) - 65
      
      if (userOptionIndex >= 0 && userOptionIndex < questionOptions.length &&
          correctOptionIndex >= 0 && correctOptionIndex < questionOptions.length) {
        const wrongOption = questionOptions[userOptionIndex].toLowerCase()
        const rightOption = questionOptions[correctOptionIndex].toLowerCase()
        
        // 分析错误选项和正确选项的差异
        // 如果错误选项包含某些语法结构，可能是干扰点
        if (wrongOption.match(/\b(was|were|is|are)\s+\w+ed\b/) && 
            !rightOption.match(/\b(was|were|is|are)\s+\w+ed\b/)) {
          options.push({ value: '被动语态的结构不理解', label: '被动语态的结构不理解' })
        }
        
        if (wrongOption.match(/\b(can|could|may|might|must|should|would)\b/) &&
            rightOption.match(/\b(can|could|may|might|must|should|would)\b/)) {
          const wrongModals = wrongOption.match(/\b(can|could|may|might|must|should|would)\b/gi) || []
          const rightModals = rightOption.match(/\b(can|could|may|might|must|should|would)\b/gi) || []
          if (wrongModals.length > 0 && rightModals.length > 0 && wrongModals[0] !== rightModals[0]) {
            options.push({ value: `情态动词 ${wrongModals[0]}/${rightModals[0]} 的用法和区别不理解`, label: `情态动词 ${wrongModals[0]}/${rightModals[0]} 的用法和区别不理解` })
          }
        }
      }
    }
    
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
    const isReadingComprehension = !!article && article.length > 100
    const fullText = `${article || ''} ${questionContent}`.toLowerCase()
    
    const options: Array<{ value: string; label: string }> = []
    
    if (isReadingComprehension) {
      // 阅读理解题：提供更全面的错误类型识别
      
      // 1. 检查题目类型关键词
      if (questionContent.match(/\b(what|which|who|where|when|why|how)\b/i)) {
        if (questionContent.match(/\b(main idea|主旨|主题|purpose|目的)\b/i)) {
          options.push({ value: '主旨大意题：不理解文章或段落的主旨', label: '主旨大意题：不理解文章或段落的主旨' })
        } else if (questionContent.match(/\b(infer|imply|suggest|indicate|conclude|推断|推理)\b/i)) {
          options.push({ value: '推理判断题：无法从文章内容推断出答案', label: '推理判断题：无法从文章内容推断出答案' })
        } else {
          options.push({ value: '细节理解题：找不到题目问的关键信息在文章中的位置', label: '细节理解题：找不到题目问的关键信息在文章中的位置' })
        }
      }
      
      // 2. 检查推理题关键词
      if (fullText.match(/\b(infer|imply|suggest|indicate|conclude|inference|implication|推断|推理)\b/)) {
        options.push({ value: '推理题：无法从文章推断出答案', label: '推理题：无法从文章推断出答案' })
      }
      
      // 3. 检查转折关系
      const contrastWords = fullText.match(/\b(but|however|although|though|yet|while|whereas|on the other hand)\b/g)
      if (contrastWords && contrastWords.length > 0) {
        const uniqueWords = Array.from(new Set(contrastWords))
        options.push({ 
          value: `转折关系不理解（如 ${uniqueWords.join('、')} 等）`, 
          label: `转折关系不理解（如 ${uniqueWords.join('、')} 等）` 
        })
      }
      
      // 4. 检查因果关系
      const causeWords = fullText.match(/\b(because|since|as|so|therefore|thus|as a result|due to)\b/g)
      if (causeWords && causeWords.length > 0) {
        const uniqueWords = Array.from(new Set(causeWords))
        options.push({ 
          value: `因果关系不理解（如 ${uniqueWords.join('、')} 等）`, 
          label: `因果关系不理解（如 ${uniqueWords.join('、')} 等）` 
        })
      }
      
      // 5. 检查指代关系
      if (fullText.match(/\b(this|that|these|those|it|they|them)\b/)) {
        options.push({ value: '指代关系不理解（如 this/that/it 等指代的内容）', label: '指代关系不理解（如 this/that/it 等指代的内容）' })
      }
      
      // 6. 检查复杂句式（长句、复合句）
      const sentences = article.split(/[.!?]/).filter(s => s.trim().length > 0)
      const longSentences = sentences.filter(s => s.split(/\s+/).length > 20)
      if (longSentences.length > 0) {
        options.push({ value: '复杂句式：文章中的长句或复合句结构不清楚', label: '复杂句式：文章中的长句或复合句结构不清楚' })
      }
      
      // 7. 检查段落结构
      const paragraphs = article.split(/\n\s*\n/).filter(p => p.trim().length > 0)
      if (paragraphs.length > 2) {
        options.push({ value: '段落结构：不理解段落之间的逻辑关系', label: '段落结构：不理解段落之间的逻辑关系' })
      }
    } else {
      // 非阅读理解题：主要关注逻辑关系
      
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
    }
    
    // 去重
    const uniqueOptions = Array.from(new Map(options.map(opt => [opt.value, opt])).values())
    
    // 如果选项不足，添加通用选项
    if (uniqueOptions.length < 3) {
      if (isReadingComprehension) {
        uniqueOptions.push({ 
          value: '其他理解问题（请具体说明）', 
          label: '其他理解问题（请具体说明）' 
        })
      } else {
        uniqueOptions.push({ 
          value: '其他逻辑关系（请具体说明）', 
          label: '其他逻辑关系（请具体说明）' 
        })
      }
    }
    
    return uniqueOptions.slice(0, 5)
  }
}

