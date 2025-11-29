'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
import DailyTaskView from '@/app/components/DailyTaskView'
import { format, startOfWeek, addDays } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [weekDates, setWeekDates] = useState<string[]>([])

  useEffect(() => {
    checkAuth()
    generateWeekDates()
  }, [])

  const checkAuth = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/dashboard')
      return
    }
    setUser(user)
    setLoading(false)
  }

  const generateWeekDates = () => {
    const today = new Date()
    const monday = startOfWeek(today, { weekStartsOn: 1 }) // 本周一
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = addDays(monday, i)
      dates.push(date.toISOString().split('T')[0])
    }
    setWeekDates(dates)
  }

  const handleGeneratePlan = async () => {
    try {
      const response = await fetch('/api/generate-plan', {
        method: 'POST',
      })
      const result = await response.json()
      if (response.ok) {
        alert(`✅ ${result.message}`)
        // 重新加载任务
        window.location.reload()
      } else {
        alert(`❌ ${result.error || '生成失败'}`)
      }
    } catch (error) {
      console.error('Failed to generate plan:', error)
      alert('生成计划失败，请重试')
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
            📚 学习仪表盘
          </h1>
          <p className="text-slate-600">
            查看你的每日任务和学习进度
          </p>
        </div>

        {/* 生成计划按钮 */}
        <div className="mb-6">
          <button
            onClick={handleGeneratePlan}
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            🎯 生成本周补短板计划
          </button>
        </div>

        {/* 周视图 */}
        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">本周任务</h2>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const dateObj = new Date(date)
              const isToday = date === new Date().toISOString().split('T')[0]
              const isSelected = date === selectedDate
              const dayName = format(dateObj, 'EEE', { locale: zhCN })

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`rounded-lg border-2 p-3 text-center transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isToday
                      ? 'border-green-300 bg-green-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-medium text-slate-600">
                    {dayName}
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-900">
                    {dateObj.getDate()}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 每日任务列表 */}
        <div>
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            {format(new Date(selectedDate), 'yyyy年MM月dd日 EEEE', {
              locale: zhCN,
            })}
          </h2>
          <DailyTaskView date={selectedDate} />
        </div>
      </div>
    </div>
  )
}

