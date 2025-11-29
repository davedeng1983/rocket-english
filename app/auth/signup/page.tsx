'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/supabase/auth'

export default function SignUpPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [gradeLevel, setGradeLevel] = useState('初三')
  const [targetScore, setTargetScore] = useState('115')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error } = await signUp(email, password)
      if (error) {
        setError(error.message)
      } else if (data.user) {
        // 注册成功，Profile 会通过数据库触发器自动创建
        // 这里可以显示成功消息
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
          router.refresh()
        }, 2000)
      }
    } catch (err) {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-green-200 bg-green-50 p-8 text-center shadow-lg">
          <div className="text-4xl">✅</div>
          <h2 className="text-2xl font-bold text-green-900">注册成功！</h2>
          <p className="text-green-700">正在跳转...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">🚀 火箭英语</h1>
          <p className="mt-2 text-sm text-slate-600">每天1小时，6个月冲刺中考满分</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                邮箱
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                密码
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="至少6位字符"
              />
            </div>

            <div>
              <label htmlFor="gradeLevel" className="block text-sm font-medium text-slate-700">
                年级
              </label>
              <select
                id="gradeLevel"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="初三">初三</option>
                <option value="初二">初二</option>
                <option value="初一">初一</option>
              </select>
            </div>

            <div>
              <label htmlFor="targetScore" className="block text-sm font-medium text-slate-700">
                目标分数
              </label>
              <input
                id="targetScore"
                type="number"
                min="0"
                max="150"
                value={targetScore}
                onChange={(e) => setTargetScore(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="115"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <div className="text-center text-sm">
          <span className="text-slate-600">已有账号？</span>{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
            立即登录
          </Link>
        </div>
      </div>
    </div>
  )
}

