'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rocket, BarChart2, BookOpen, RotateCw, User, LogOut, Upload, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch profile to get full_name
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
        
        setUser({ ...user, ...profile })
      } else {
        setUser(null)
      }
    }
    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (path: string) => pathname?.startsWith(path)

  // 如果在登录页面，不显示导航栏（或者是简化版）
  if (pathname === '/auth/login' || pathname === '/auth/signup') {
    return null
  }

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg">
            <Rocket className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold text-slate-900">Rocket English</span>
        </Link>

        {/* Main Navigation - Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {user && (
            <>
              <NavLink href="/dashboard" active={isActive('/dashboard')} icon={<BarChart2 className="h-4 w-4" />}>
                仪表盘
              </NavLink>
              <NavLink href="/study" active={isActive('/study')} icon={<BookOpen className="h-4 w-4" />}>
                开始测试
              </NavLink>
              <NavLink href="/review" active={isActive('/review')} icon={<RotateCw className="h-4 w-4" />}>
                错题重练
              </NavLink>
              <NavLink href="/import" active={isActive('/import')} icon={<Upload className="h-4 w-4" />}>
                导入试卷
              </NavLink>
            </>
          )}
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <Link href="/profile" className="hidden md:flex flex-col items-end transition hover:opacity-70">
                <span className="text-sm font-medium text-slate-900">{user.full_name || user.email?.split('@')?.[0] || 'User'}</span>
                <span className="text-xs text-slate-500">个人中心</span>
              </Link>
              
              {/* Mobile Profile Icon */}
              <Link href="/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-blue-50 hover:text-blue-600 md:hidden">
                 <User className="h-4 w-4" />
              </Link>

              <button
                onClick={handleSignOut}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 hover:shadow-lg"
            >
              登录
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function NavLink({ href, active, children, icon }: { href: string; active: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {icon}
      {children}
    </Link>
  )
}

