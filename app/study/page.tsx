'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import ExamRunner from '@/app/components/ExamRunner'
import { getCurrentUser } from '@/lib/supabase/auth'
import { Trash2, Edit2, X, Check, PlayCircle } from 'lucide-react'

export default function StudyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [papers, setPapers] = useState<any[]>([])
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  
  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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
      }
    } catch (error) {
      console.error('Failed to load papers:', error)
    }
    
    setLoading(false)
  }

  // 删除试卷
  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation() // 防止触发选择试卷
    if (!window.confirm(`确定要删除试卷 "${title}" 吗？此操作不可恢复！`)) {
      return
    }

    try {
      const res = await fetch(`/api/exam-papers/${id}`, {
        method: 'DELETE',
      })
      
      if (res.ok) {
        setPapers(papers.filter(p => p.id !== id))
      } else {
        // 尝试获取后端返回的具体错误信息
        const data = await res.json().catch(() => ({}))
        alert(data.error || '删除失败，请稍后重试')
      }
    } catch (err) {
      console.error(err)
      alert('删除出错，请检查网络连接')
    }
  }

  // 开始重命名
  const handleStartRename = (e: React.MouseEvent, paper: any) => {
    e.stopPropagation()
    setEditingId(paper.id)
    setEditTitle(paper.title)
  }

  // 保存重命名
  const handleSaveRename = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!editTitle.trim()) return

    try {
      const res = await fetch(`/api/exam-papers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      })
      if (res.ok) {
        setPapers(papers.map(p => p.id === id ? { ...p, title: editTitle } : p))
        setEditingId(null)
      } else {
        alert('重命名失败')
      }
    } catch (err) {
      console.error(err)
      alert('保存出错')
    }
  }

  // 取消重命名
  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(null)
    setEditTitle('')
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
          <div className="mx-auto grid max-w-3xl gap-4">
            {papers.map((paper) => (
              <div
                key={paper.id}
                className="group relative flex items-center justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
              >
                {/* 左侧内容区：点击也可进入考试，但在编辑模式下禁用 */}
                <div 
                  className="flex-1 cursor-pointer pr-4"
                  onClick={() => !editingId && setSelectedPaperId(paper.id)}
                >
                  {editingId === paper.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="flex-1 rounded border border-blue-300 px-2 py-1 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div>
                      <h3 className="mb-1 text-lg font-semibold text-slate-900 group-hover:text-blue-600">
                        {paper.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500">
                         <span>{paper.year || '年份未知'}</span>
                         <span>•</span>
                         <span>{paper.region || '地区未知'}</span>
                         {paper.audio_url && (
                           <>
                             <span>•</span>
                             <span>🎵 包含听力</span>
                           </>
                         )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 右侧操作区 */}
                <div className="flex items-center gap-2">
                  {editingId === paper.id ? (
                    <>
                      <button
                        onClick={(e) => handleSaveRename(e, paper.id)}
                        className="rounded-full bg-green-100 p-2 text-green-600 hover:bg-green-200"
                        title="保存"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"
                        title="取消"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                       <button
                        onClick={() => setSelectedPaperId(paper.id)}
                        className="hidden rounded-full bg-blue-50 p-2 text-blue-600 hover:bg-blue-100 group-hover:block md:hidden"
                        title="开始考试"
                      >
                        <PlayCircle size={18} />
                      </button>
                      <button
                        onClick={(e) => handleStartRename(e, paper)}
                        className="rounded-full bg-slate-50 p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
                        title="重命名"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, paper.id, paper.title)}
                        className="rounded-full bg-slate-50 p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 opacity-0 transition-opacity group-hover:opacity-100"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
