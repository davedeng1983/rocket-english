'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamRunner from '@/app/components/ExamRunner'
import { getCurrentUser } from '@/lib/supabase/auth'

export default function StudyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [papers, setPapers] = useState<any[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuthAndLoadPapers()
  }, [])

  const checkAuthAndLoadPapers = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/study')
      return
    }

    setUser(user)
    
    // 加载试卷列表
    try {
      const response = await fetch('/api/exam-papers')
      const data = await response.json()
      if (Array.isArray(data)) {
        setPapers(data)
        // 如果有试卷，默认不自动选择，让用户自己选
        // if (data.length > 0) {
        //   setSelectedPaperId(data[0].id)
        // }
      }
    } catch (error) {
      console.error('Failed to load papers:', error)
    }
    
    setLoading(false)
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

  if (papers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <div className="mb-4 text-4xl">📝</div>
          <h2 className="mb-2 text-xl font-bold text-slate-900">暂无试卷</h2>
          <p className="text-slate-600">
            请联系管理员添加试卷数据
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      {selectedPaperId ? (
        <ExamRunner
          paperId={selectedPaperId}
          onComplete={() => {
            setSelectedPaperId(null)
            router.push('/progress')
          }}
        />
      ) : (
        <div className="container mx-auto px-4 py-12">
          <h1 className="mb-8 text-center text-3xl font-bold text-slate-900">
            📚 选择试卷
          </h1>
          <div className="mx-auto grid max-w-2xl gap-4">
            {papers.map((paper) => (
              <button
                key={paper.id}
                onClick={() => setSelectedPaperId(paper.id)}
                className="rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                <h3 className="mb-2 text-lg font-semibold text-slate-900">
                  {paper.title}
                </h3>
                {paper.audio_url && (
                  <p className="text-sm text-slate-500">🎵 包含听力</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

