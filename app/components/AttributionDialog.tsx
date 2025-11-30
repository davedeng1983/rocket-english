'use client'

import { useState } from 'react'
import type { Question } from '@/lib/supabase/types'

interface AttributionDialogProps {
  question: Question
  userAnswer: string
  correctAnswer: string
  attemptId?: string
  currentIndex?: number // 当前错题索引（从1开始）
  totalCount?: number // 总错题数
  onComplete: (gapType: 'vocab' | 'grammar' | 'logic', gapDetail: string, attemptId?: string) => void
  onSkip: () => void
}

export default function AttributionDialog({
  question,
  userAnswer,
  correctAnswer,
  attemptId,
  currentIndex,
  totalCount,
  onComplete,
  onSkip,
}: AttributionDialogProps) {
  const [selectedType, setSelectedType] = useState<'vocab' | 'grammar' | 'logic' | null>(null)
  const [gapDetail, setGapDetail] = useState('')

  const handleSubmit = () => {
    if (selectedType && gapDetail.trim()) {
      onComplete(selectedType, gapDetail.trim(), attemptId || '')
      setSelectedType(null)
      setGapDetail('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">
            🤔 请告诉我，这道题做错的原因是什么？
          </h3>
          {totalCount && totalCount > 1 && (
            <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
              {currentIndex || 1} / {totalCount}
            </span>
          )}
        </div>

        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-2 text-sm font-medium text-red-900">题目：</p>
          <p className="mb-3 text-sm text-slate-700">{question.content}</p>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="font-medium text-red-600">你的答案：</span>
              <span className="ml-2 text-slate-700">{userAnswer}</span>
            </div>
            <div>
              <span className="font-medium text-green-600">正确答案：</span>
              <span className="ml-2 text-slate-700">{correctAnswer}</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-3 text-sm font-medium text-slate-700">错误原因：</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setSelectedType('vocab')}
              className={`rounded-lg border-2 p-3 text-sm font-medium transition ${
                selectedType === 'vocab'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              📚 生词障碍
            </button>
            <button
              onClick={() => setSelectedType('grammar')}
              className={`rounded-lg border-2 p-3 text-sm font-medium transition ${
                selectedType === 'grammar'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              📖 语法模糊
            </button>
            <button
              onClick={() => setSelectedType('logic')}
              className={`rounded-lg border-2 p-3 text-sm font-medium transition ${
                selectedType === 'logic'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              🧠 逻辑不清
            </button>
          </div>
        </div>

        {selectedType && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              {selectedType === 'vocab' && '📝 请列出具体不认识的单词：'}
              {selectedType === 'grammar' && '📝 请指出不理解的句子或语法点：'}
              {selectedType === 'logic' && '📝 请指出不理解的句子或逻辑关系：'}
            </label>
            <textarea
              value={gapDetail}
              onChange={(e) => setGapDetail(e.target.value)}
              placeholder={
                selectedType === 'vocab'
                  ? '例如：ambition（雄心）, strategy（策略）, accomplish（完成）'
                  : selectedType === 'grammar'
                  ? '例如：第2句话的被动语态 "was asked" 不理解'
                  : '例如：第3句话 "If we truly want to..." 不理解其中的逻辑关系'
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={4}
            />
            <p className="mt-1 text-xs text-slate-500">
              {selectedType === 'vocab' && '💡 提示：多个单词请用逗号分隔，可以在括号内添加中文意思（可选）'}
              {selectedType !== 'vocab' && '💡 提示：请尽量具体，例如："第X句话的...不理解" 或 "XX语法点不清楚"'}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onSkip}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            跳过
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedType || !gapDetail.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}

