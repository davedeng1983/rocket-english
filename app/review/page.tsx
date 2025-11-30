'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
import type { LearningGap, Question } from '@/lib/supabase/types'
import AttributionDialog from '@/app/components/AttributionDialog'
import ReactMarkdown from 'react-markdown'
import { BookOpen } from 'lucide-react'

type LearningGapWithQuestion = LearningGap & { questions: Question | null }

// 稳定的 ReactMarkdown 组件配置
const markdownComponents = {
  img: ({ node, ...props }: any) => (
    <img 
      {...props} 
      className="my-4 max-h-[400px] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
      onError={(e: any) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  ),
  p: ({ node, ...props }: any) => <p className="mb-4" {...props} />,
};

export default function ReviewPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [gaps, setGaps] = useState<LearningGapWithQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [showAttribution, setShowAttribution] = useState(false)
  const [currentWrongQuestion, setCurrentWrongQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [reviewCompleted, setReviewCompleted] = useState(false)

  useEffect(() => {
    checkAuthAndLoadGaps()
  }, [])

  const checkAuthAndLoadGaps = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/review')
      return
    }

    setUser(user)

    // 加载错题
    try {
      const response = await fetch('/api/learning-gaps')
      const data = await response.json()
      if (Array.isArray(data)) {
        setGaps(data)
        // 初始化答案记录
        const initialAnswers: Record<string, string> = {}
        data.forEach((gap: LearningGap & { questions?: Question }) => {
          if (gap.questions) {
            initialAnswers[gap.questions.id] = ''
          }
        })
        setUserAnswers(initialAnswers)
      }
    } catch (error) {
      console.error('Failed to load gaps:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAnswer = (answer: string) => {
    const currentGap = gaps[currentIndex]
    if (!currentGap || !currentGap.questions) return

    setUserAnswers((prev) => ({
      ...prev,
      [currentGap.questions!.id]: answer,
    }))
  }

  const handleNext = () => {
    if (currentIndex < gaps.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = () => {
    const currentGap = gaps[currentIndex]
    if (!currentGap || !currentGap.questions) return

    const userAnswer = userAnswers[currentGap.questions.id] || ''
    const correctAnswer = currentGap.questions.correct_answer || ''

    if (userAnswer === correctAnswer) {
      // 答对了，创建 learning_action 标记掌握
      createMasterAction(currentGap.id)
      
      // 如果还有下一题，继续
      if (currentIndex < gaps.length - 1) {
        setCurrentIndex(currentIndex + 1)
      } else {
        setReviewCompleted(true)
      }
    } else {
      // 答错了，显示归因弹窗
      setCurrentWrongQuestion(currentGap.questions)
      setShowAttribution(true)
    }
  }

  const createMasterAction = async (gapId: string) => {
    if (!user) return

    try {
      await fetch('/api/learning-actions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapId,
          actionType: 'master_gap',
        }),
      })
    } catch (error) {
      console.error('Failed to create action:', error)
    }
  }

  const handleAttributionComplete = async (
    gapType: 'vocab' | 'grammar' | 'logic',
    gapDetail: string,
    attemptId?: string
  ) => {
    if (!currentWrongQuestion) return

    // 创建 forget_gap action（表示又错了）
    const currentGap = gaps[currentIndex]
    if (currentGap) {
      try {
        await fetch('/api/learning-actions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gapId: currentGap.id,
            actionType: 'forget_gap',
          }),
        })
      } catch (error) {
        console.error('Failed to create action:', error)
      }
    }

    setShowAttribution(false)
    setCurrentWrongQuestion(null)

    // 继续下一题
    if (currentIndex < gaps.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      setReviewCompleted(true)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-2xl">⏳</div>
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (gaps.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">🎉</div>
          <h2 className="mb-2 text-2xl font-bold text-green-900">
            太棒了！
          </h2>
          <p className="text-green-700">
            目前没有需要复习的错题
          </p>
        </div>
      </div>
    )
  }

  if (reviewCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="mb-2 text-2xl font-bold text-green-900">
            复习完成！
          </h2>
          <p className="text-green-700">
            继续加油，保持学习节奏！
          </p>
        </div>
      </div>
    )
  }

  const currentGap = gaps[currentIndex]
  const currentQuestion = currentGap?.questions

  if (!currentQuestion) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* 进度条 */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>错题 {currentIndex + 1} / {gaps.length}</span>
            <span className="text-red-600">
              {currentGap.gap_type === 'vocab' && '📚 生词'}
              {currentGap.gap_type === 'grammar' && '📖 语法'}
              {currentGap.gap_type === 'logic' && '🧠 逻辑'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-red-600 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / gaps.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        <div className="mb-6 rounded-2xl border-2 border-red-200 bg-red-50 p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              ⚠️ 错题重练
            </span>
            <span className="text-xs text-slate-500">
              {new Date(currentGap.created_at).toLocaleDateString('zh-CN')}
            </span>
          </div>

          {/* 显示之前记录的问题详情 */}
          {currentGap.gap_detail && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-800">
                  {currentGap.gap_type === 'vocab' && '📚 不认识的单词：'}
                  {currentGap.gap_type === 'grammar' && '📖 不理解的语法点：'}
                  {currentGap.gap_type === 'logic' && '🧠 不理解的句子：'}
                  {!currentGap.gap_type && '❓ 问题记录：'}
                </span>
              </div>
              <p className="text-sm font-medium text-amber-900">
                {currentGap.gap_detail}
              </p>
            </div>
          )}

          {/* 阅读理解原文 */}
          {currentQuestion.meta && 
          typeof currentQuestion.meta === 'object' && 
          'article' in currentQuestion.meta && 
          (currentQuestion.meta as any).article && (
            <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="text-blue-500" size={16} />
                <h4 className="font-bold text-slate-600">阅读材料</h4>
              </div>
              <div className="markdown-content">
                <ReactMarkdown urlTransform={(url) => url} components={markdownComponents}>
                  {String((currentQuestion.meta as any).article || '')}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* 题目内容 */}
          <div className="mb-6 text-lg leading-relaxed text-slate-900 markdown-content">
            <ReactMarkdown urlTransform={(url) => url} components={markdownComponents}>
              {String(currentQuestion.content || '')}
            </ReactMarkdown>
          </div>

          {/* 选项 */}
          {currentQuestion.options && Array.isArray(currentQuestion.options) && (
            <div className="space-y-3">
              {(currentQuestion.options as string[]).map((option: string, index: number) => {
                const optionLabel = String.fromCharCode(65 + index)
                const isSelected = userAnswers[currentQuestion.id] === optionLabel

                return (
                  <button
                    key={index}
                    onClick={() => handleSelectAnswer(optionLabel)}
                    className={`w-full rounded-lg border-2 p-4 text-left transition ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span className="font-medium text-slate-700">
                      {optionLabel}. {option}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 导航按钮 */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="rounded-lg border border-slate-300 bg-white px-6 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一题
          </button>

          {currentIndex === gaps.length - 1 ? (
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition hover:bg-green-700"
            >
              提交答案
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              提交并下一题
            </button>
          )}
        </div>
      </div>

      {/* 错题归因弹窗 */}
      {showAttribution && currentWrongQuestion && (
        <AttributionDialog
          question={currentWrongQuestion}
          userAnswer={userAnswers[currentWrongQuestion.id] || ''}
          correctAnswer={currentWrongQuestion.correct_answer || ''}
          attemptId="" // 复习模式不需要 attemptId
          onComplete={handleAttributionComplete}
          onSkip={() => {
            setShowAttribution(false)
            if (currentIndex < gaps.length - 1) {
              setCurrentIndex(currentIndex + 1)
            } else {
              setReviewCompleted(true)
            }
          }}
        />
      )}
    </div>
  )
}

