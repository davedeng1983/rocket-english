'use client'

import { useState } from 'react'
import type { Question } from '@/lib/supabase/types'
import KnowledgePointSelector from './KnowledgePointSelector'
import ErrorOptionsSelector from './ErrorOptionsSelector'

interface AttributionDialogProps {
  question: Question
  userAnswer: string
  correctAnswer: string
  attemptId?: string
  currentIndex?: number // 当前错题索引（从1开始）
  totalCount?: number // 总错题数
  onComplete: (gapType: 'vocab' | 'grammar' | 'logic' | 'careless', gapDetail: string, knowledgePoints: string[], attemptId?: string) => void
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
  const [selectedType, setSelectedType] = useState<'vocab' | 'grammar' | 'logic' | 'careless' | null>(null)
  const [gapDetail, setGapDetail] = useState('')
  const [showKnowledgePoints, setShowKnowledgePoints] = useState(false) // 是否显示知识点选择

  const handleSubmit = () => {
    if (selectedType && gapDetail.trim()) {
      // 粗心大意不需要知识点选择，直接完成
      if (selectedType === 'careless') {
        onComplete(selectedType, gapDetail.trim() || '粗心大意', [], attemptId || '')
        setSelectedType(null)
        setGapDetail('')
        return
      }

      // 如果有题目知识点，显示知识点选择界面
      const questionKps = question.meta && typeof question.meta === 'object' && 'kps' in question.meta
        ? (question.meta as any).kps
        : []
      
      if (questionKps && Array.isArray(questionKps) && questionKps.length > 0) {
        // 显示知识点选择界面
        setShowKnowledgePoints(true)
      } else {
        // 没有知识点，直接完成（不选择知识点）
        onComplete(selectedType, gapDetail.trim(), [], attemptId || '')
        setSelectedType(null)
        setGapDetail('')
      }
    }
  }

  const handleKnowledgePointsComplete = (selectedKnowledgePoints: string[]) => {
    if (selectedType && gapDetail.trim()) {
      onComplete(selectedType, gapDetail.trim(), selectedKnowledgePoints, attemptId || '')
      setSelectedType(null)
      setGapDetail('')
      setShowKnowledgePoints(false)
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
              <span className="ml-2 text-slate-700">
                {correctAnswer || '(未设置正确答案)'}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-3 text-sm font-medium text-slate-700">错误原因：</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
            <button
              onClick={() => setSelectedType('careless')}
              className={`rounded-lg border-2 p-3 text-sm font-medium transition ${
                selectedType === 'careless'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              😅 粗心大意
            </button>
          </div>
        </div>

        {selectedType && !showKnowledgePoints && selectedType !== 'careless' && (
          <div className="mb-4">
            <label className="mb-3 block text-sm font-medium text-slate-700">
              {selectedType === 'vocab' && '📝 请选择不认识的单词（系统已根据题目智能分析）：'}
              {selectedType === 'grammar' && '📝 请选择不理解的语法点（系统已根据题目智能分析）：'}
              {selectedType === 'logic' && '📝 请选择不理解的逻辑关系（系统已根据题目智能分析）：'}
            </label>
            
            <ErrorOptionsSelector
              gapType={selectedType}
              questionContent={String(question.content || '')}
              questionOptions={
                question.options && Array.isArray(question.options)
                  ? question.options.map(String)
                  : undefined
              }
              correctAnswer={correctAnswer || undefined}
              userAnswer={userAnswer || undefined}
              article={
                question.meta && typeof question.meta === 'object' && 'article' in question.meta
                  ? String((question.meta as any).article || '')
                  : undefined
              }
              analysis={question.analysis || undefined}
              knowledgePoints={
                question.meta && typeof question.meta === 'object' && 'kps' in question.meta
                  ? (question.meta as any).kps || []
                  : undefined
              }
              sectionType={question.section_type || undefined}
              value={gapDetail}
              onChange={setGapDetail}
            />
          </div>
        )}

        {selectedType === 'careless' && (
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              📝 请简单描述一下粗心的原因（可选）：
            </label>
            <textarea
              value={gapDetail}
              onChange={(e) => setGapDetail(e.target.value)}
              placeholder="例如：看错了选项、计算错误、抄写错误等"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
            />
            <p className="mt-1 text-xs text-slate-500">
              💡 提示：粗心大意的原因可以简单描述，也可以不填写
            </p>
          </div>
        )}

        {/* 知识点选择界面 */}
        {showKnowledgePoints && selectedType && (
          <div className="mb-4">
            <KnowledgePointSelector
              gapType={selectedType}
              gapDetail={gapDetail}
              questionContent={String(question.content || '')}
              questionKnowledgePoints={
                question.meta && typeof question.meta === 'object' && 'kps' in question.meta
                  ? (question.meta as any).kps || []
                  : []
              }
              onComplete={handleKnowledgePointsComplete}
              onSkip={() => {
                // 跳过知识点选择，直接完成（不选择任何知识点）
                handleKnowledgePointsComplete([])
              }}
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onSkip}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            跳过
          </button>
          {!showKnowledgePoints && (
            <button
              onClick={handleSubmit}
              disabled={!selectedType || (selectedType !== 'careless' && !gapDetail.trim())}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedType === 'careless' ? '确认' : '下一步 →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

