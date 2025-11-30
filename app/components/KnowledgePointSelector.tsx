'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2 } from 'lucide-react'

interface KnowledgePoint {
  code: string
  name: string
  description?: string
}

interface KnowledgePointSelectorProps {
  gapType: 'vocab' | 'grammar' | 'logic'
  gapDetail: string
  questionContent: string
  questionKnowledgePoints?: string[] // 题目已有的知识点代码
  onComplete: (selectedKnowledgePoints: string[]) => void
  onSkip: () => void
}

export default function KnowledgePointSelector({
  gapType,
  gapDetail,
  questionContent,
  questionKnowledgePoints = [],
  onComplete,
  onSkip,
}: KnowledgePointSelectorProps) {
  const [selectedPoints, setSelectedPoints] = useState<Set<string>>(new Set())
  const [knowledgePoints, setKnowledgePoints] = useState<KnowledgePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadKnowledgePoints()
  }, [gapType, gapDetail, questionContent, questionKnowledgePoints])

  const loadKnowledgePoints = async () => {
    setLoading(true)
    
    try {
      // 优先使用题目已有的知识点
      if (questionKnowledgePoints.length > 0) {
        const response = await fetch(`/api/knowledge-points?codes=${questionKnowledgePoints.join(',')}`)
        const data = await response.json()
        if (Array.isArray(data) && data.length > 0) {
          setKnowledgePoints(data)
          setLoading(false)
          return
        }
      }

      // 如果没有题目知识点，使用默认的知识点列表
      // 可以根据错误类型和详情生成更精准的知识点（未来可以接入AI）
      const defaultPoints = getDefaultKnowledgePoints(gapType)
      setKnowledgePoints(defaultPoints)
    } catch (error) {
      console.error('Failed to load knowledge points:', error)
      // 如果失败，使用默认的知识点列表
      setKnowledgePoints(getDefaultKnowledgePoints(gapType))
    } finally {
      setLoading(false)
    }
  }

  const getDefaultKnowledgePoints = (type: 'vocab' | 'grammar' | 'logic'): KnowledgePoint[] => {
    // 根据错误类型提供默认知识点选项
    if (type === 'vocab') {
      return [
        { code: 'vocab.common', name: '常用词汇' },
        { code: 'vocab.academic', name: '学术词汇' },
        { code: 'vocab.collocation', name: '词汇搭配' },
      ]
    } else if (type === 'grammar') {
      return [
        { code: 'grammar.tense', name: '时态' },
        { code: 'grammar.voice', name: '语态' },
        { code: 'grammar.sentence', name: '句子结构' },
      ]
    } else {
      return [
        { code: 'logic.inference', name: '推理能力' },
        { code: 'logic.connection', name: '逻辑连接' },
        { code: 'logic.comprehension', name: '理解能力' },
      ]
    }
  }

  const togglePoint = (code: string) => {
    setSelectedPoints((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(code)) {
        newSet.delete(code)
      } else {
        newSet.add(code)
      }
      return newSet
    })
  }

  const handleConfirm = () => {
    onComplete(Array.from(selectedPoints))
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <div className="text-sm text-blue-700">正在分析相关知识点...</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <h4 className="mb-3 text-base font-bold text-blue-900">
        📚 请选择你未掌握的知识点（可多选）：
      </h4>
      
      <div className="mb-4 space-y-2">
        {knowledgePoints.map((kp) => {
          const isSelected = selectedPoints.has(kp.code)
          return (
            <button
              key={kp.code}
              onClick={() => togglePoint(kp.code)}
              className={`w-full rounded-lg border-2 p-3 text-left transition ${
                isSelected
                  ? 'border-blue-500 bg-blue-100'
                  : 'border-slate-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {isSelected && <CheckCircle2 className="text-blue-600" size={18} />}
                    <span className={`font-medium ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}>
                      {kp.name}
                    </span>
                  </div>
                  {kp.description && (
                    <p className="mt-1 text-xs text-slate-600">{kp.description}</p>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={onSkip}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          跳过
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedPoints.size === 0}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          确认 ({selectedPoints.size}个)
        </button>
      </div>
    </div>
  )
}

