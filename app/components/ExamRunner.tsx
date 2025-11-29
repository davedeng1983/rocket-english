'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
// 使用 API 路由获取数据，不再直接导入
// 使用 API 路由保存数据
import type { Question } from '@/lib/supabase/types'
import AttributionDialog from './AttributionDialog'

interface ExamRunnerProps {
  paperId: string
  onComplete?: () => void
}

export default function ExamRunner({ paperId, onComplete }: ExamRunnerProps) {
  const router = useRouter()
  const [paper, setPaper] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({})
  const [showAttribution, setShowAttribution] = useState(false)
  const [currentWrongQuestion, setCurrentWrongQuestion] = useState<Question | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [examCompleted, setExamCompleted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    loadExamData()
  }, [paperId])

  const loadExamData = async () => {
    // 检查用户登录
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/study')
      return
    }

    // 加载试卷和题目（使用 API 路由）
    try {
      const [paperResponse, questionsResponse] = await Promise.all([
        fetch(`/api/exam-papers/${paperId}`),
        fetch(`/api/questions?paperId=${paperId}`),
      ])

      const paperData = await paperResponse.json()
      const questionsData = await questionsResponse.json()

      if (paperData && !paperData.error) setPaper(paperData)
      if (questionsData && Array.isArray(questionsData)) {
        setQuestions(questionsData)
        // 初始化答案记录
        const initialAnswers: Record<string, string> = {}
        questionsData.forEach((q: Question) => {
          initialAnswers[q.id] = ''
        })
        setUserAnswers(initialAnswers)
      }
    } catch (error) {
      console.error('Failed to load exam data:', error)
    }
  }

  const handleSelectAnswer = (answer: string) => {
    const currentQuestion = questions[currentIndex]
    if (!currentQuestion) return

    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: answer,
    }))
  }

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const handleSubmit = async () => {
    if (isSubmitting) return

    // 检查是否所有题目都已作答
    const unanswered = questions.filter((q) => !userAnswers[q.id])
    if (unanswered.length > 0) {
      const confirm = window.confirm(
        `还有 ${unanswered.length} 道题未作答，确定要提交吗？`
      )
      if (!confirm) return
    }

    setIsSubmitting(true)

    // 获取当前用户
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login')
      return
    }

    // 创建考试记录（使用 API 路由）
    try {
      const response = await fetch('/api/exam-attempts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          userAnswers,
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        alert('提交失败，请重试')
        setIsSubmitting(false)
        return
      }

      const { attempt, correctCount, totalQuestions } = result

      // 找出错题
      const wrongQuestions = questions.filter(
        (q) => userAnswers[q.id] !== q.correct_answer
      )

      setScore(Math.round((correctCount! / totalQuestions!) * 100))
      setExamCompleted(true)

      // 如果有错题，显示归因弹窗
      if (wrongQuestions.length > 0) {
        setCurrentWrongQuestion(wrongQuestions[0])
        setShowAttribution(true)
        // 保存 attemptId 以便后续使用
        ;(window as any).__currentAttemptId = attempt.id
      } else {
        // 没有错题，直接完成
        if (onComplete) {
          setTimeout(() => {
            onComplete()
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Failed to submit exam:', error)
      alert('提交失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAttributionComplete = async (
    gapType: 'vocab' | 'grammar' | 'logic',
    gapDetail: string,
    attemptId?: string
  ) => {
    if (!currentWrongQuestion) return

    // 创建学习漏洞（使用 API 路由）
    try {
      await fetch('/api/learning-gaps/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentWrongQuestion.id,
          attemptId,
          gapType,
          gapDetail,
          userAnswer: userAnswers[currentWrongQuestion.id] || '',
          correctAnswer: currentWrongQuestion.correct_answer || '',
        }),
      })
    } catch (error) {
      console.error('Failed to create learning gap:', error)
    }

    // 处理下一个错题
    const wrongQuestions = questions.filter(
      (q) => userAnswers[q.id] !== q.correct_answer
    )
    const currentWrongIndex = wrongQuestions.findIndex(
      (q) => q.id === currentWrongQuestion.id
    )

    if (currentWrongIndex < wrongQuestions.length - 1) {
      // 还有错题，显示下一个
      setCurrentWrongQuestion(wrongQuestions[currentWrongIndex + 1])
    } else {
      // 所有错题都已处理
      setShowAttribution(false)
      setCurrentWrongQuestion(null)
      if (onComplete) {
        setTimeout(() => {
          onComplete()
        }, 1000)
      }
    }
  }

  const currentQuestion = questions[currentIndex]

  if (!currentQuestion && questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-2xl">⏳</div>
          <p className="text-slate-600">加载题目中...</p>
        </div>
      </div>
    )
  }

  if (examCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-lg">
          <div className="mb-4 text-5xl">🎉</div>
          <h2 className="mb-2 text-2xl font-bold text-green-900">考试完成！</h2>
          <p className="mb-4 text-3xl font-bold text-green-700">
            得分：{score} 分
          </p>
          <p className="text-green-600">
            {score && score >= 80
              ? '太棒了！继续保持！'
              : '发现了薄弱环节，系统已为你生成补短板计划'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto max-w-3xl px-4 py-8">
        {/* 进度条 */}
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>题目 {currentIndex + 1} / {questions.length}</span>
            <span>
              {Object.values(userAnswers).filter((a) => a).length} / {questions.length} 已作答
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* 题目卡片 */}
        {currentQuestion && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <div className="mb-4">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                {currentQuestion.section_type === 'single_choice'
                  ? '单选题'
                  : currentQuestion.section_type === 'reading'
                  ? '阅读理解'
                  : currentQuestion.section_type}
              </span>
            </div>

            <div className="mb-6">
              <p className="text-lg leading-relaxed text-slate-900">
                {currentQuestion.content}
              </p>
            </div>

            {/* 选项 */}
            {currentQuestion.options && Array.isArray(currentQuestion.options) && (
              <div className="space-y-3">
                {(currentQuestion.options as string[]).map((option: string, index: number) => {
                  const optionLabel = String.fromCharCode(65 + index) // A, B, C, D
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
        )}

        {/* 导航按钮 */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="rounded-lg border border-slate-300 bg-white px-6 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            上一题
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-green-600 px-6 py-2 font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? '提交中...' : '提交试卷'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition hover:bg-blue-700"
            >
              下一题
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
          attemptId={(window as any).__currentAttemptId || ''}
          onComplete={handleAttributionComplete}
          onSkip={() => {
            setShowAttribution(false)
            if (onComplete) onComplete()
          }}
        />
      )}
    </div>
  )
}

