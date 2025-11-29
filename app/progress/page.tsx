'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase/auth'

export default function ProgressPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalAttempts: 0,
    averageScore: 0,
    totalGaps: 0,
    activeGaps: 0,
    completedTasks: 0,
    pendingTasks: 0,
  })

  useEffect(() => {
    checkAuthAndLoadStats()
  }, [])

  const checkAuthAndLoadStats = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/progress')
      return
    }

    setUser(user)

    // 加载统计数据
    try {
      const [attemptsRes, gapsRes, tasksRes] = await Promise.all([
        fetch('/api/exam-attempts'),
        fetch('/api/learning-gaps'),
        fetch('/api/daily-tasks'),
      ])

      const attempts = await attemptsRes.json()
      const gaps = await gapsRes.json()
      const tasks = await tasksRes.json()

      // 计算统计数据
      const totalAttempts = Array.isArray(attempts) ? attempts.length : 0
      const scores = Array.isArray(attempts)
        ? attempts.map((a: any) => a.score).filter((s: number) => s !== null)
        : []
      const averageScore =
        scores.length > 0
          ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
          : 0

      const totalGaps = Array.isArray(gaps) ? gaps.length : 0
      const activeGaps = Array.isArray(gaps)
        ? gaps.filter((g: any) => g.status === 'active').length
        : 0

      const allTasks = Array.isArray(tasks) ? tasks : []
      const completedTasks = allTasks.filter((t: any) => t.is_completed).length
      const pendingTasks = allTasks.filter((t: any) => !t.is_completed).length

      setStats({
        totalAttempts,
        averageScore,
        totalGaps,
        activeGaps,
        completedTasks,
        pendingTasks,
      })
    } catch (error) {
      console.error('Failed to load stats:', error)
    } finally {
      setLoading(false)
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            📊 学习进度
          </h1>
          <p className="text-slate-600">查看你的学习数据和统计</p>
        </div>

        {/* 统计卡片 */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">📝</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalAttempts}
            </div>
            <div className="text-sm text-slate-600">完成考试</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">🎯</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.averageScore}
            </div>
            <div className="text-sm text-slate-600">平均分数</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">⚠️</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.activeGaps}
            </div>
            <div className="text-sm text-slate-600">待补漏洞</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">✅</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.completedTasks}
            </div>
            <div className="text-sm text-slate-600">完成任务</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">📋</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.pendingTasks}
            </div>
            <div className="text-sm text-slate-600">待办任务</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 text-2xl">📚</div>
            <div className="text-2xl font-bold text-slate-900">
              {stats.totalGaps}
            </div>
            <div className="text-sm text-slate-600">总漏洞数</div>
          </div>
        </div>

        {/* 快速操作 */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/study"
            className="rounded-xl border-2 border-blue-200 bg-blue-50 p-6 text-center transition hover:border-blue-300 hover:bg-blue-100"
          >
            <div className="mb-2 text-3xl">🚀</div>
            <h3 className="mb-1 font-semibold text-blue-900">开始测试</h3>
            <p className="text-sm text-blue-700">完成一套真题测试</p>
          </Link>

          <Link
            href="/review"
            className="rounded-xl border-2 border-red-200 bg-red-50 p-6 text-center transition hover:border-red-300 hover:bg-red-100"
          >
            <div className="mb-2 text-3xl">🔄</div>
            <h3 className="mb-1 font-semibold text-red-900">错题重练</h3>
            <p className="text-sm text-red-700">复习之前的错题</p>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center transition hover:border-green-300 hover:bg-green-100"
          >
            <div className="mb-2 text-3xl">📚</div>
            <h3 className="mb-1 font-semibold text-green-900">学习仪表盘</h3>
            <p className="text-sm text-green-700">查看每日任务</p>
          </Link>

          <Link
            href="/dashboard"
            className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 text-center transition hover:border-purple-300 hover:bg-purple-100"
          >
            <div className="mb-2 text-3xl">🎯</div>
            <h3 className="mb-1 font-semibold text-purple-900">生成计划</h3>
            <p className="text-sm text-purple-700">生成本周补短板计划</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

