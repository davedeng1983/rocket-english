'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, signOut } from '@/lib/supabase/auth'

export default function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { user } = await getCurrentUser()
    setUser(user)
    setLoading(false)
  }

  const handleSignOut = async () => {
    await signOut()
    setUser(null)
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="h-10 w-20 animate-pulse rounded-lg bg-slate-200" />
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/study"
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          开始学习
        </Link>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          登出
        </button>
      </div>
    )
  }

  return (
    <Link
      href="/auth/login"
      className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
    >
      登录
    </Link>
  )
}

