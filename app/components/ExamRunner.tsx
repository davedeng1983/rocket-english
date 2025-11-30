'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
import type { Question } from '@/lib/supabase/types'
import AttributionDialog from './AttributionDialog'
import ReactMarkdown from 'react-markdown'
import { 
  CheckCircle2, 
  BookOpen, 
  PenTool, 
  FileText, 
  Play, 
  Clock,
  AlertCircle,
  ChevronRight,
  List,
  ArrowLeft
} from 'lucide-react'

interface ExamRunnerProps {
  paperId: string
  onComplete?: () => void
}

interface SectionGroup {
  id: string
  title: string
  icon: any
  questions: Question[]
  startIndex: number
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
  const [viewState, setViewState] = useState<'overview' | 'running' | 'result'>('overview')

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

  // 计算试卷结构分组
  const sections = useMemo(() => {
    const groups: SectionGroup[] = []
    let currentGroup: SectionGroup | null = null
    
    questions.forEach((q, index) => {
      let typeKey = q.section_type
      let title = '其他题目'
      let icon = FileText

      if (typeKey === 'single_choice') {
        title = '单项选择'
        icon = CheckCircle2
      } else if (typeKey === 'cloze') {
        title = '完形填空'
        icon = List
      } else if (typeKey === 'reading') {
        if (q.options && Array.isArray(q.options) && q.options.length > 0) {
          title = '阅读理解'
          icon = BookOpen
        } else {
          title = '阅读表达'
          icon = BookOpen
        }
      } else if (typeKey === 'writing') {
        title = '书面表达'
        icon = PenTool
      }

      // 如果当前没有分组，或者分组标题变了，创建新分组
      if (!currentGroup || currentGroup.title !== title) {
        // 只有当上一个分组有内容时才推入（其实 always true except first）
        currentGroup = {
          id: `${typeKey}_${index}`,
          title,
          icon,
          questions: [],
          startIndex: index
        }
        groups.push(currentGroup)
      }

      currentGroup.questions.push(q)
    })

    return groups
  }, [questions])

  const handleStartExam = (startIndex: number = 0) => {
    setCurrentIndex(startIndex)
    setViewState('running')
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
      setViewState('result')

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

  if (!paper || questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-2xl">⏳</div>
          <p className="text-slate-600">加载试卷中...</p>
        </div>
      </div>
    )
  }

  // === 视图 1: 试卷概览 ===
  if (viewState === 'overview') {
    return (
      <div className="min-h-screen bg-slate-50 pb-12">
        {/* 头部 */}
        <div className="bg-white px-4 py-8 shadow-sm">
          <div className="container mx-auto max-w-3xl">
            <button 
              onClick={() => router.back()}
              className="mb-4 flex items-center text-sm text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={16} className="mr-1" />
              返回列表
            </button>
            <h1 className="mb-2 text-2xl font-bold text-slate-900">{paper.title}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500">
               <span className="flex items-center gap-1"><Clock size={14}/> {paper.year || '年份未知'}</span>
               <span>{paper.region || '地区未知'}</span>
               <span>共 {questions.length} 题</span>
            </div>
          </div>
        </div>

        {/* 大题列表 */}
        <div className="container mx-auto mt-8 max-w-3xl px-4">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">试卷结构</h2>
          <div className="space-y-4">
            {sections.map((section, idx) => (
              <div 
                key={section.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md"
                onClick={() => handleStartExam(section.startIndex)}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <section.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{section.title}</h3>
                    <p className="text-sm text-slate-500">
                      {section.questions.length} 道题 
                      <span className="mx-2 text-slate-300">|</span>
                      第 {section.startIndex + 1} - {section.startIndex + section.questions.length} 题
                    </p>
                  </div>
                </div>
                <div className="rounded-full bg-slate-50 p-2 text-slate-400">
                   <Play size={20} className="ml-0.5" />
                </div>
              </div>
            ))}
          </div>

          {/* 开始按钮 */}
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => handleStartExam(0)}
              className="flex w-full max-w-md items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 hover:shadow-xl active:scale-95"
            >
              <Play size={24} />
              开始整卷测试
            </button>
          </div>
        </div>
      </div>
    )
  }

  // === 视图 3: 考试结果 ===
  if (viewState === 'result') {
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
          <button 
            onClick={() => onComplete ? onComplete() : router.push('/progress')}
            className="mt-8 w-full rounded-lg bg-green-600 py-3 font-bold text-white hover:bg-green-700"
          >
            查看分析报告
          </button>
        </div>
        
        {/* 错题归因弹窗 (放在这里以防 Result 页面下也需要显示) */}
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

  // === 视图 2: 考试进行中 (原 Question View) ===
  const isSplitView = currentQuestion && 
    (currentQuestion.section_type === 'cloze' || currentQuestion.section_type === 'reading') && 
    currentQuestion.meta && 
    typeof currentQuestion.meta === 'object' && 
    'article' in currentQuestion.meta && 
    (currentQuestion.meta as any).article;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className={`container mx-auto px-4 py-8 ${isSplitView ? 'max-w-6xl' : 'max-w-3xl'}`}>
        {/* 顶部栏：返回概览 + 进度 */}
        <div className="mb-6">
          <button 
             onClick={() => {
               if (window.confirm('退出考试将不保存进度，确定退出吗？')) {
                 setViewState('overview')
               }
             }}
             className="mb-4 flex items-center text-xs text-slate-400 hover:text-slate-600"
          >
             <ArrowLeft size={12} className="mr-1" /> 退出考试
          </button>

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

        {currentQuestion && (
          <div className={`grid gap-6 ${isSplitView ? 'lg:grid-cols-2 lg:items-start' : 'grid-cols-1'}`}>
            
            {/* 左侧文章区域 (仅在 Split View 且是大屏时显示) */}
            {isSplitView && (
                <div className="hidden lg:block sticky top-4 max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-md">
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                        <BookOpen className="text-blue-500" size={20} />
                        <h3 className="font-bold text-slate-700">阅读材料</h3>
                    </div>
                    <div className="text-base leading-relaxed text-slate-700 markdown-content">
                        <ReactMarkdown
                            urlTransform={(url) => url}
                            components={{
                                img: ({ node, ...props }) => (
                                    <img 
                                        {...props} 
                                        className="my-4 max-h-[400px] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                                        onError={(e) => console.error('Image load error:', typeof props.src === 'string' ? props.src.substring(0, 50) + '...' : 'Blob image')}
                                    />
                                ),
                                p: ({ node, ...props }) => <p className="mb-4" {...props} />
                            }}
                        >
                            {(currentQuestion.meta as any).article}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* 右侧题目区域 (或主要区域) */}
            <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
                    <div className="mb-4 flex items-center justify-between">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                        {currentQuestion.section_type === 'single_choice'
                        ? '单选题'
                        : currentQuestion.section_type === 'cloze'
                        ? '完形填空'
                        : currentQuestion.section_type === 'writing'
                        ? '书面表达'
                        : (currentQuestion.options ? '阅读理解' : '阅读表达')}
                    </span>
                    {/* 显示题号 */}
                    <span className="text-sm font-bold text-slate-300">#{currentIndex + 1}</span>
                    </div>
                    
                    {/* 移动端文章显示 (或者非 Split View 时显示) */}
                    {/* 如果是 Split View，但在移动端 (lg:hidden)，则显示文章 */}
                    {/* 如果不是 Split View，且有文章，则始终显示 */}
                    {currentQuestion.meta && 
                    typeof currentQuestion.meta === 'object' && 
                    'article' in currentQuestion.meta && 
                    (currentQuestion.meta as any).article && (
                        <div className={`mb-6 rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 markdown-content ${isSplitView ? 'lg:hidden' : ''}`}>
                            <h4 className="mb-2 font-bold text-slate-500">阅读材料</h4>
                            <ReactMarkdown
                                urlTransform={(url) => url}
                                components={{
                                img: ({ node, ...props }) => (
                                    <img 
                                    {...props} 
                                    className="my-4 max-h-[400px] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                                    onError={(e) => console.error('Image load error:', typeof props.src === 'string' ? props.src.substring(0, 50) + '...' : 'Blob image')}
                                    />
                                ),
                                p: ({ node, ...props }) => <p className="mb-4" {...props} />
                                }}
                            >
                                {(currentQuestion.meta as any).article}
                            </ReactMarkdown>
                        </div>
                    )}

                    {/* 题目内容 */}
                    <div className="mb-6 text-lg leading-relaxed text-slate-900 markdown-content">
                    <ReactMarkdown
                        urlTransform={(url) => url}
                        components={{
                            img: ({ node, ...props }) => (
                            <img 
                                {...props} 
                                className="my-4 max-h-[400px] max-w-full rounded-lg border border-slate-200 object-contain shadow-sm"
                                onError={(e) => console.error('Image load error:', typeof props.src === 'string' ? props.src.substring(0, 50) + '...' : 'Blob image')}
                            />
                            ),
                            p: ({ node, ...props }) => <p className="mb-4" {...props} />
                        }}
                    >
                        {currentQuestion.content}
                    </ReactMarkdown>
                    </div>

                    {/* 选项 */}
                    {currentQuestion.options && Array.isArray(currentQuestion.options) ? (
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
                    ) : (
                        // 无选项题目（主观题）的输入框
                        <div className="mt-4">
                            <textarea
                                value={userAnswers[currentQuestion.id] || ''}
                                onChange={(e) => handleSelectAnswer(e.target.value)}
                                placeholder="请输入你的答案..."
                                className="w-full rounded-lg border border-slate-300 p-4 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                rows={5}
                            />
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
          </div>
        )}
      </div>

      {/* 错题归因弹窗 (Running 状态下显示) */}
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
