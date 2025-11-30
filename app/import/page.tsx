'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/auth'

export default function ImportPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    data?: any
    debug_text?: string
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (
        !selectedFile.name.endsWith('.docx') &&
        !selectedFile.name.endsWith('.doc')
      ) {
        alert('请选择 .docx 或 .doc 格式的 Word 文档')
        return
      }
      setFile(selectedFile)
      setResult(null)
    }
  }

  const [progress, setProgress] = useState(0)

  // ...

  const handleUpload = async () => {
    if (!file) {
      alert('请先选择文件')
      return
    }

    // 检查用户登录
    const { user } = await getCurrentUser()
    if (!user) {
      router.push('/auth/login?redirect=/import')
      return
    }

    setUploading(true)
    setProgress(0) // 重置进度
    setResult(null)

    // 模拟进度条 (因为 fetch 不支持原生的上传进度，除非用 XHR)
    // 这是一个视觉欺骗，让用户感觉系统在工作
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 100;
        }
        const diff = Math.random() * 10;
        return Math.min(oldProgress + diff, 95);
      });
    }, 500);

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import-paper', {
        method: 'POST',
        body: formData,
      })

      clearInterval(timer);
      setProgress(100); // 完成

      const data = await response.json()

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          data: data.data,
          debug_text: data.debug_text, 
        })
        setFile(null)
        const fileInput = document.getElementById('file-input') as HTMLInputElement
        if (fileInput) fileInput.value = ''
      } else {
        setResult({
          success: false,
          message: data.error || '导入失败',
          debug_text: data.debug_text,
        })
      }
    } catch (error) {
      clearInterval(timer);
      console.error('Upload error:', error)
      setResult({
        success: false,
        message: '上传失败，请重试',
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            📥 导入试卷
          </h1>
          <p className="text-slate-600">
            上传 Word 版中考真题，系统将自动解析并入库
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
          {/* 文件选择 */}
          <div className="mb-6">
            <label
              htmlFor="file-input"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              选择 Word 文档
            </label>
            <input
              id="file-input"
              type="file"
              accept=".docx,.doc"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />
            {file && (
              <p className="mt-2 text-sm text-slate-600">
                已选择：{file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* 上传按钮 */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading && (
              <div 
                className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            )}
            <span className="relative z-10">
              {uploading ? `正在解析中... ${Math.round(progress)}%` : '开始导入'}
            </span>
          </button>

          {/* 结果提示 */}
          {result && (
            <div
              className={`mt-6 rounded-lg p-4 ${
                result.success
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              <div className="mb-2 font-semibold">
                {result.success ? '✅ 导入成功' : '❌ 导入失败'}
              </div>
              <p className="text-sm">{result.message}</p>
              
              {/* Debug Text Display - Always show if present */}
              {result.debug_text && (
                <div className="mt-4">
                   <details className="group">
                     <summary className="mb-1 cursor-pointer text-xs font-semibold text-gray-700 hover:text-blue-600">
                       ▶️ 查看解析日志与文本 (调试用)
                     </summary>
                     <div className="mt-2">
                        <pre className="max-h-60 overflow-y-auto rounded bg-gray-800 p-3 text-xs text-green-400 whitespace-pre-wrap break-all font-mono">
                          {result.debug_text}
                        </pre>
                        <p className="mt-1 text-xs text-gray-500">如果题目数量不对，请将上方黑框内的内容复制给开发者。</p>
                     </div>
                   </details>
                </div>
              )}

              {result.success && result.data && (
                <div className="mt-3 space-y-1 text-sm">
                  <p>试卷标题：{result.data.paperTitle}</p>
                  <p>题目数量：{result.data.questionsCount}</p>
                  <p>知识点关联：{result.data.knowledgeEdgesCount}</p>
                  <button
                    onClick={() => router.push('/study')}
                    className="mt-3 text-blue-600 hover:underline"
                  >
                    立即开始测试 →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 使用说明 */}
          <div className="mt-8 rounded-lg border border-blue-100 bg-blue-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-blue-900">
              📋 使用说明
            </h3>
            <ul className="space-y-1 text-xs text-blue-800">
              <li>• 支持 .docx 和 .doc 格式的 Word 文档</li>
              <li>• 系统会自动识别题目、选项和知识点</li>
              <li>• 建议文档格式：题号. 题干 A. 选项A B. 选项B ...</li>
              <li>• 导入后可在"开始测试"页面查看新试卷</li>
            </ul>
          </div>
        </div>

        {/* 已导入的试卷列表 */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            已导入的试卷
          </h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-600">
              导入的试卷会显示在"开始测试"页面
            </p>
            <button
              onClick={() => router.push('/study')}
              className="mt-4 text-blue-600 hover:underline"
            >
              查看试卷列表 →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
