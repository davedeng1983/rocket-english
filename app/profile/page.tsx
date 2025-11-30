'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User, Mail, Target, GraduationCap, BookOpen, BarChart2, AlertCircle, CheckCircle, LogOut, Save } from 'lucide-react'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile Data
  const [fullName, setFullName] = useState('')
  const [grade, setGrade] = useState('初三')
  const [targetScore, setTargetScore] = useState(110)
  const [isEditing, setIsEditing] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    examCount: 0,
    avgScore: 0,
    masteredPoints: 0,
    activeGaps: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const supabase = createClient()
    
    // 1. Check Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login?redirect=/profile')
      return
    }
    setUser(user)

    try {
      // 2. Fetch Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profile) {
        setFullName(profile.full_name || '')
        setGrade(profile.grade_level || '初三')
        setTargetScore(profile.target_score || 110)
      }

      // 3. Fetch Stats (Parallel)
      const [examsRes, gapsRes, kpsRes] = await Promise.all([
        supabase.from('user_exam_attempts').select('score'),
        supabase.from('learning_gaps').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('student_knowledge_states').select('id', { count: 'exact', head: true }).gte('mastery_score', 80)
      ])

      // Calculate Exam Stats
      const exams = examsRes.data || []
      const examCount = exams.length
      const totalScore = exams.reduce((sum, e) => sum + (e.score || 0), 0)
      const avgScore = examCount > 0 ? Math.round(totalScore / examCount) : 0

      setStats({
        examCount,
        avgScore,
        masteredPoints: kpsRes.count || 0,
        activeGaps: gapsRes.count || 0
      })

    } catch (error) {
      console.error('Failed to load profile data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setSaving(true)
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          grade_level: grade,
          target_score: Number(targetScore),
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      
      setIsEditing(false)
      alert('保存成功')
    } catch (error) {
      console.error('Error saving profile:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
        <div className="flex min-h-screen items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 px-4 pb-24 pt-12 text-white">
        <div className="container mx-auto max-w-4xl">
            <div className="flex flex-col items-center gap-6 md:flex-row md:gap-8">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20 text-3xl font-bold shadow-xl backdrop-blur-sm">
                    {user.email?.[0].toUpperCase() || 'U'}
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-2xl font-bold">{fullName || user.email?.split('@')[0]}</h1>
                    <div className="mt-2 flex items-center justify-center gap-4 text-blue-100 md:justify-start">
                        <span className="flex items-center gap-1 text-sm bg-white/10 px-3 py-1 rounded-full">
                            <Mail size={14} /> {user.email}
                        </span>
                        <span className="flex items-center gap-1 text-sm bg-white/10 px-3 py-1 rounded-full">
                            <GraduationCap size={14} /> {grade}
                        </span>
                    </div>
                </div>
                <div className="ml-auto hidden md:block">
                     <button 
                        onClick={handleSignOut}
                        className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20 transition"
                     >
                        <LogOut size={16} /> 退出登录
                     </button>
                </div>
            </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 -mt-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
            <StatsCard 
                icon={<BarChart2 className="text-blue-500" />} 
                label="做题数量" 
                value={stats.examCount} 
                suffix="套" 
            />
            <StatsCard 
                icon={<Target className="text-purple-500" />} 
                label="平均得分" 
                value={stats.avgScore} 
                suffix="分" 
            />
            <StatsCard 
                icon={<CheckCircle className="text-green-500" />} 
                label="掌握知识点" 
                value={stats.masteredPoints} 
                suffix="个" 
            />
            <StatsCard 
                icon={<AlertCircle className="text-orange-500" />} 
                label="待补漏洞" 
                value={stats.activeGaps} 
                suffix="个" 
            />
        </div>

        {/* Profile Settings */}
        <div className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <User size={20} className="text-blue-600" /> 个人资料设置
                </h2>
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="text-sm text-blue-600 hover:underline font-medium"
                    >
                        编辑资料
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setIsEditing(false)}
                            className="px-3 py-1 text-sm text-slate-500 hover:bg-slate-50 rounded"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center gap-1 px-4 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                )}
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-500 mb-2">姓名 / 昵称</label>
                    {isEditing ? (
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="请输入您的姓名或昵称"
                        />
                    ) : (
                        <div className="p-2.5 text-slate-800 font-medium">{fullName || '未设置'}</div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">当前年级</label>
                    {isEditing ? (
                        <select
                            value={grade}
                            onChange={(e) => setGrade(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="初一">初一</option>
                            <option value="初二">初二</option>
                            <option value="初三">初三</option>
                            <option value="高一">高一</option>
                            <option value="高二">高二</option>
                            <option value="高三">高三</option>
                        </select>
                    ) : (
                        <div className="p-2.5 text-slate-800 font-medium">{grade}</div>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-500 mb-2">目标分数</label>
                    {isEditing ? (
                        <div className="relative">
                            <input
                                type="number"
                                value={targetScore}
                                onChange={(e) => setTargetScore(Number(e.target.value))}
                                className="w-full rounded-lg border border-slate-300 p-2.5 text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="absolute right-3 top-2.5 text-slate-400 text-sm">分</span>
                        </div>
                    ) : (
                        <div className="p-2.5 text-slate-800 font-medium">{targetScore} 分</div>
                    )}
                </div>
                
                <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-2">
                    <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                        <BookOpen className="mt-0.5 shrink-0" size={16} />
                        <div>
                            <p className="font-semibold mb-1">备考建议</p>
                            <p className="opacity-80">
                                {grade === '初三' 
                                    ? '距离中考越来越近了，建议每周至少完成 2 套真题，并重点关注错题归因。'
                                    : '基础阶段请多积累词汇和语法知识，为未来的考试打好基础。'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Mobile Logout */}
        <div className="mt-8 md:hidden">
             <button 
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-white p-4 text-red-600 shadow-sm hover:bg-red-50 transition"
             >
                <LogOut size={18} /> 退出登录
             </button>
        </div>
      </div>
    </div>
  )
}

function StatsCard({ icon, label, value, suffix }: { icon: React.ReactNode, label: string, value: number, suffix: string }) {
    return (
        <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center hover:shadow-md transition-shadow">
            <div className="mb-3 rounded-full bg-slate-50 p-3">
                {icon}
            </div>
            <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
            <div className="text-2xl font-bold text-slate-800">
                {value} <span className="text-xs font-normal text-slate-400">{suffix}</span>
            </div>
        </div>
    )
}

