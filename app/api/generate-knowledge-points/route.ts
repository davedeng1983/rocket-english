import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { gapType, gapDetail, questionContent } = body

    // 根据错误类型和题目内容，生成可能的知识点
    // 这里可以调用AI API，或者基于规则生成
    
    // 临时实现：基于规则生成知识点选项
    const knowledgePoints = generateKnowledgePointsByType(gapType, gapDetail, questionContent)

    return NextResponse.json({ knowledgePoints })
  } catch (error) {
    console.error('Failed to generate knowledge points:', error)
    return NextResponse.json(
      { error: 'Failed to generate knowledge points' },
      { status: 500 }
    )
  }
}

function generateKnowledgePointsByType(
  gapType: 'vocab' | 'grammar' | 'logic',
  gapDetail: string,
  questionContent: string
): Array<{ code: string; name: string; description?: string }> {
  
  if (gapType === 'vocab') {
    return [
      { code: 'vocab.common', name: '常用词汇', description: '日常交流和阅读中常用的词汇' },
      { code: 'vocab.academic', name: '学术词汇', description: '学术文献和正式文本中使用的词汇' },
      { code: 'vocab.collocation', name: '词汇搭配', description: '固定搭配和常用短语' },
      { code: 'vocab.context', name: '语境理解', description: '根据上下文理解词义' },
    ]
  } else if (gapType === 'grammar') {
    return [
      { code: 'grammar.tense', name: '时态', description: '各种时态的用法和区别' },
      { code: 'grammar.voice', name: '语态', description: '主动语态和被动语态' },
      { code: 'grammar.sentence', name: '句子结构', description: '复合句、从句等复杂句式' },
      { code: 'grammar.word_order', name: '语序', description: '英语句子的语序规则' },
    ]
  } else {
    return [
      { code: 'logic.inference', name: '推理能力', description: '根据已知信息推断未知信息' },
      { code: 'logic.connection', name: '逻辑连接', description: '句子和段落之间的逻辑关系' },
      { code: 'logic.comprehension', name: '理解能力', description: '对文本整体意思的理解' },
      { code: 'logic.deduction', name: '演绎推理', description: '从一般到特殊的推理过程' },
    ]
  }
}

