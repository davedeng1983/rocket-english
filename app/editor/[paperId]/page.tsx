'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'
import type { Question } from '@/lib/supabase/types'
import QuestionEditor from '@/app/components/QuestionEditor'
import { ArrowLeft, PlusCircle, Save, FileText, X } from 'lucide-react'

export default function EditorPage({ params }: { params: Promise<{ paperId: string }> }) {
  const { paperId } = use(params)
  const router = useRouter()
  const [paper, setPaper] = useState<any>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [showRawText, setShowRawText] = useState(false)
  
  // To refresh data
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    loadData()
  }, [paperId, refreshKey])

  const loadData = async () => {
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/editor/' + paperId)
      return
    }

    try {
      const [pRes, qRes] = await Promise.all([
        fetch(`/api/exam-papers/${paperId}`),
        fetch(`/api/questions?paperId=${paperId}`)
      ])

      const pData = await pRes.json()
      const qData = await qRes.json()

      if (pRes.ok) setPaper(pData)
      if (qRes.ok && Array.isArray(qData)) {
        // Sort by order_index
        setQuestions(qData.sort((a, b) => a.order_index - b.order_index))
      }
    } catch (error) {
      console.error('Failed to load editor data:', error)
      alert('加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuestion = async (id: string, updates: Partial<Question>) => {
    try {
        const res = await fetch(`/api/questions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
        if (!res.ok) throw new Error('Update failed')
        
        // Local update
        setQuestions(questions.map(q => q.id === id ? { ...q, ...updates } : q))
    } catch (error) {
        console.error(error)
        alert('保存失败')
    }
  }

  const handleDeleteQuestion = async (id: string) => {
    try {
        const res = await fetch(`/api/questions/${id}`, {
            method: 'DELETE'
        })
        if (!res.ok) throw new Error('Delete failed')
        
        // Local update
        setQuestions(questions.filter(q => q.id !== id))
    } catch (error) {
        console.error(error)
        alert('删除失败')
    }
  }

  const handleAddQuestion = async () => {
    try {
        const res = await fetch('/api/questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                paper_id: paperId,
                content: '新题目',
                section_type: 'single_choice', // default
                options: ['选项A', '选项B', '选项C', '选项D'],
                correct_answer: 'A',
                analysis: '暂无解析'
            })
        })
        
        if (!res.ok) throw new Error('Create failed')
        const { data } = await res.json()
        
        // Add to list and scroll to bottom
        setQuestions([...questions, data])
        setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
        }, 100)
    } catch (error) {
        console.error(error)
        alert('添加失败')
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="container mx-auto flex max-w-4xl items-center justify-between">
            <div className="flex items-center gap-4">
                <button 
                    onClick={() => router.push('/study')}
                    className="flex items-center text-slate-500 hover:text-slate-800"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-lg font-bold text-slate-900">试卷编辑器</h1>
                    <p className="text-xs text-slate-500">{paper?.title}</p>
                </div>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowRawText(true)}
                    className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                    <FileText size={16} /> 查看原始文稿
                </button>
                <button 
                    onClick={handleAddQuestion}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                    <PlusCircle size={16} /> 添加题目
                </button>
            </div>
        </div>
      </div>

      {/* Raw Text Sidebar */}
      {showRawText && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b p-4">
                    <h2 className="font-bold text-slate-800">原始识别文稿</h2>
                    <button onClick={() => setShowRawText(false)} className="text-slate-500 hover:text-slate-800">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-slate-600">
                    <div className="mb-4 rounded bg-blue-50 p-3 text-xs text-blue-700">
                        💡 提示：在此处找到丢失的原文或题目，复制并粘贴到左侧编辑器中。
                    </div>
                    {paper?.structure_map?.sections ? (
                        (paper.structure_map.sections as any[]).map((section, idx) => (
                            <div key={idx} className="mb-6">
                                <h3 className="mb-2 font-bold text-slate-900 bg-slate-100 p-1 rounded">{section.title}</h3>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{section.content}</pre>
                            </div>
                        ))
                    ) : (
                        <p>暂无原始文稿数据 (请重新导入试卷以获取)</p>
                    )}
                </div>
            </div>
        </div>
      )}

      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Statistics */}
        <div className="mb-6 flex gap-4 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-center">
                <div className="text-2xl font-bold text-slate-800">{questions.length}</div>
                <div className="text-xs text-slate-500">总题数</div>
            </div>
            <div className="border-l border-slate-100 pl-4">
                <p className="text-sm text-slate-600">
                    在此页面，您可以：<br/>
                    1. 修正解析错误的题干文字<br/>
                    2. <b>插入图片</b> (点击题干编辑框上方的图片按钮)<br/>
                    3. 补录缺失的题目或删除多余题目
                </p>
            </div>
        </div>

        {/* Question List */}
        <div className="space-y-4">
            {questions.map((q, index) => (
                <QuestionEditor 
                    key={q.id} 
                    question={q} 
                    index={index}
                    onSave={handleSaveQuestion}
                    onDelete={handleDeleteQuestion}
                />
            ))}
        </div>

        {/* Bottom Action */}
        <div className="mt-8 text-center">
            <button 
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 bg-white px-6 py-3 text-slate-500 hover:border-blue-500 hover:text-blue-600"
            >
                <PlusCircle size={20} />
                在底部添加新题目
            </button>
        </div>
      </div>
    </div>
  )
}

