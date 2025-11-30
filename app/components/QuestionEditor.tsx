'use client'

import { useState, useRef } from 'react'
import { Save, Trash2, ImageIcon, X } from 'lucide-react'
import type { Question } from '@/lib/supabase/types'
import ReactMarkdown from 'react-markdown'

interface QuestionEditorProps {
  question: Question
  index: number
  onSave: (id: string, updates: Partial<Question>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function QuestionEditor({ question, index, onSave, onDelete }: QuestionEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(question.content)
  const [options, setOptions] = useState<string[]>(
    Array.isArray(question.options) ? (question.options as string[]) : []
  )
  const [correctAnswer, setCorrectAnswer] = useState(question.correct_answer || '')
  const [analysis, setAnalysis] = useState(question.analysis || '')
  const [isSaving, setIsSaving] = useState(false)
  
  // Image upload ref
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSave = async () => {
    setIsSaving(true)
    await onSave(question.id, {
      content,
      options: options.length > 0 ? options : null,
      correct_answer: correctAnswer,
      analysis
    })
    setIsSaving(false)
    setIsEditing(false)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
        const base64 = event.target?.result as string
        // Insert markdown image at cursor or end
        // For simplicity, just append to end for now, or we could try to be smarter
        const imageMarkdown = `\n\n![image](${base64})\n\n`
        setContent(prev => prev + imageMarkdown)
    }
    reader.readAsDataURL(file)
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const updateOption = (idx: number, value: string) => {
    const newOptions = [...options]
    newOptions[idx] = value
    setOptions(newOptions)
  }

  if (!isEditing) {
    return (
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300">
        <div className="flex justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                    #{index + 1} {question.section_type}
                </span>
                <span className="text-xs text-slate-400">ID: {question.id.substring(0, 8)}</span>
            </div>
            
            <div className="mb-4 text-slate-800 markdown-content">
               <ReactMarkdown 
                 urlTransform={(url) => url}
                 components={{
                    img: ({node, ...props}) => <img {...props} className="max-h-40 rounded border border-slate-200" />
                 }}
               >
                 {content.substring(0, 100) + (content.length > 100 ? '...' : '')}
               </ReactMarkdown>
            </div>

            {options.length > 0 && (
              <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                {options.map((opt, i) => (
                  <div key={i} className={`rounded border p-2 text-sm ${String.fromCharCode(65+i) === correctAnswer ? 'border-green-500 bg-green-50' : 'border-slate-100'}`}>
                    <span className="font-bold">{String.fromCharCode(65+i)}.</span> {opt}
                  </div>
                ))}
              </div>
            )}
            
            <div className="text-sm text-slate-500">
                <span className="font-bold">解析：</span> {analysis ? analysis.substring(0, 50) + (analysis.length > 50 ? '...' : '') : '暂无'}
            </div>
          </div>

          <div className="ml-4 flex flex-col gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="rounded bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
              title="编辑"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            </button>
            <button
              onClick={() => {
                  if(window.confirm('确定删除此题吗？')) onDelete(question.id)
              }}
              className="rounded bg-red-50 p-2 text-red-600 hover:bg-red-100"
              title="删除"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 rounded-lg border-2 border-blue-500 bg-white p-6 shadow-lg">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-bold text-slate-700">编辑题目 #{index + 1}</span>
        <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
        </button>
      </div>

      {/* 题干 */}
      <div className="mb-4">
        <label className="mb-1 block text-sm font-semibold text-slate-700">
            题干 (支持 Markdown 图片)
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
            >
                <ImageIcon size={12} className="mr-1" /> 插入图片
            </button>
            <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
            />
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px] w-full rounded border border-slate-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          placeholder="输入题目内容..."
        />
      </div>

      {/* 选项 (如果是选择题) */}
      {options.length > 0 && (
         <div className="mb-4">
            <label className="mb-1 block text-sm font-semibold text-slate-700">选项</label>
            <div className="grid gap-2">
                {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <span className="w-6 text-center font-bold text-slate-500">{String.fromCharCode(65+i)}</span>
                        <input 
                            type="text"
                            value={opt}
                            onChange={(e) => updateOption(i, e.target.value)}
                            className="flex-1 rounded border border-slate-300 p-2 text-sm focus:border-blue-500"
                        />
                    </div>
                ))}
            </div>
         </div>
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 答案 */}
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">正确答案</label>
            {options.length > 0 ? (
                <select 
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 text-sm"
                >
                    <option value="">请选择</option>
                    {options.map((_, i) => (
                        <option key={i} value={String.fromCharCode(65+i)}>{String.fromCharCode(65+i)}</option>
                    ))}
                </select>
            ) : (
                <input 
                    type="text" 
                    value={correctAnswer}
                    onChange={(e) => setCorrectAnswer(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 text-sm"
                    placeholder="输入参考答案"
                />
            )}
          </div>
          
          {/* 知识点 (暂不支持编辑，仅展示) */}
          <div>
             <label className="mb-1 block text-sm font-semibold text-slate-700">知识点 (自动生成)</label>
             <div className="text-sm text-slate-500 p-2 bg-slate-50 rounded border border-slate-200">
                 {question.meta && typeof question.meta === 'object' && 'kps' in question.meta 
                    ? (question.meta as any).kps?.join(', ') 
                    : '无'}
             </div>
          </div>
      </div>

      {/* 解析 */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-semibold text-slate-700">解析</label>
        <textarea
          value={analysis}
          onChange={(e) => setAnalysis(e.target.value)}
          className="min-h-[80px] w-full rounded border border-slate-300 p-3 text-sm focus:border-blue-500"
          placeholder="输入题目解析..."
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
            onClick={() => setIsEditing(false)}
            className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
        >
            取消
        </button>
        <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
            <Save size={18} />
            {isSaving ? '保存中...' : '保存修改'}
        </button>
      </div>
    </div>
  )
}

