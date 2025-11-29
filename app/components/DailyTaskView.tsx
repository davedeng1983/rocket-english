'use client'

import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/supabase/auth'
import type { DailyTask } from '@/lib/supabase/types'

interface DailyTaskViewProps {
  date?: string // YYYY-MM-DD，如果不提供则显示今天
}

export default function DailyTaskView({ date }: DailyTaskViewProps) {
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState<DailyTask | null>(null)

  useEffect(() => {
    loadTasks()
  }, [date])

  const loadTasks = async () => {
    const { user } = await getCurrentUser()
    if (!user) return

    const targetDate = date || new Date().toISOString().split('T')[0]
    try {
      const response = await fetch(`/api/daily-tasks?date=${targetDate}`)
      const data = await response.json()
      if (Array.isArray(data)) {
        setTasks(data)
      }
    } catch (error) {
      console.error('Failed to load tasks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteTask = async (taskId: string) => {
    try {
      const response = await fetch('/api/daily-tasks/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })

      if (response.ok) {
        // 重新加载任务
        loadTasks()
      }
    } catch (error) {
      console.error('Failed to complete task:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-600">加载中...</div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mb-4 text-4xl">✨</div>
        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          今天没有任务
        </h3>
        <p className="text-sm text-slate-600">
          太棒了！所有任务都已完成，或者还没有生成任务计划
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`rounded-xl border-2 p-6 transition ${
            task.is_completed
              ? 'border-green-200 bg-green-50'
              : 'border-slate-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                  {task.task_type === 'vocab_card'
                    ? '📚 单词卡'
                    : task.task_type === 'grammar_video'
                    ? '📖 语法微课'
                    : '✏️ 练习题'}
                </span>
                {task.is_completed && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    ✅ 已完成
                  </span>
                )}
              </div>

              {task.content && (
                <div className="space-y-3">
                  {task.task_type === 'vocab_card' && (
                    <div>
                      <h4 className="mb-2 font-semibold text-slate-900">
                        单词：{(task.content as any).word || '未知'}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {(task.content as any).definition || '暂无定义'}
                      </p>
                      {(task.content as any).example && (
                        <p className="mt-2 text-sm italic text-slate-500">
                          例句：{(task.content as any).example}
                        </p>
                      )}
                    </div>
                  )}

                  {task.task_type === 'grammar_video' && (
                    <div>
                      <h4 className="mb-2 font-semibold text-slate-900">
                        语法点：{(task.content as any).knowledge_point || '未知'}
                      </h4>
                      <p className="text-sm text-slate-600">
                        {(task.content as any).explanation || '暂无解释'}
                      </p>
                    </div>
                  )}

                  {task.task_type === 'exercise' && (
                    <div>
                      <h4 className="mb-2 font-semibold text-slate-900">
                        练习题
                      </h4>
                      <p className="text-sm text-slate-600">
                        {(task.content as any).explanation || '请完成相关练习题'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4 text-xs text-slate-500">
                计划日期：{task.scheduled_date}
              </div>
            </div>

            {!task.is_completed && (
              <button
                onClick={() => handleCompleteTask(task.id)}
                className="ml-4 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
              >
                完成
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

