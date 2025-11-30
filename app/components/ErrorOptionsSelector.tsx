'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, X } from 'lucide-react'

interface ErrorOptionsSelectorProps {
  gapType: 'vocab' | 'grammar' | 'logic'
  questionContent: string
  questionOptions?: string[]
  correctAnswer?: string
  userAnswer?: string // 学生的错误答案
  article?: string // 阅读理解的文章内容
  analysis?: string // 题目解析
  knowledgePoints?: string[] // 题目知识点
  sectionType?: string // 题目类型
  value: string // 当前选中的值
  onChange: (value: string) => void
}

export default function ErrorOptionsSelector({
  gapType,
  questionContent,
  questionOptions,
  correctAnswer,
  userAnswer,
  article,
  analysis,
  knowledgePoints,
  sectionType,
  value,
  onChange,
}: ErrorOptionsSelectorProps) {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([])
  const [loading, setLoading] = useState(true)
  const [customInput, setCustomInput] = useState('') // 用户自定义输入
  const [showCustomInput, setShowCustomInput] = useState(false)

  useEffect(() => {
    loadOptions()
  }, [gapType, questionContent])

  const loadOptions = async () => {
    setLoading(true)
    
    try {
      const response = await fetch('/api/generate-error-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapType,
          questionContent,
          questionOptions,
          correctAnswer,
          userAnswer,
          article,
          analysis,
          knowledgePoints,
          sectionType,
        }),
      })

      const data = await response.json()
      if (data.options && Array.isArray(data.options)) {
        setOptions(data.options)
      }
    } catch (error) {
      console.error('Failed to load error options:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOption = (optionValue: string) => {
    // 支持多选（用逗号分隔）
    const currentValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
    
    if (currentValues.includes(optionValue)) {
      // 如果已选中，则取消选择
      const newValues = currentValues.filter(v => v !== optionValue)
      onChange(newValues.join(', '))
    } else {
      // 如果未选中，则添加
      onChange([...currentValues, optionValue].join(', '))
    }
  }

  const handleCustomInput = (inputValue: string) => {
    const oldCustomValue = customInput.trim()
    setCustomInput(inputValue)
    const currentValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
    
    if (inputValue.trim()) {
      // 移除旧的自定义值，添加新的自定义值
      const valuesWithoutOldCustom = currentValues.filter(v => v !== oldCustomValue)
      const allValues = [...valuesWithoutOldCustom, inputValue.trim()]
      onChange(allValues.join(', '))
    } else {
      // 如果清空，只保留已选择的选项（移除旧的自定义值）
      onChange(currentValues.filter(v => v !== oldCustomValue).join(', '))
    }
  }

  const selectedValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []

  if (loading) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
        <div className="text-sm text-blue-700">正在分析题目，生成选项...</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* 智能生成的选项 */}
      {options.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate-600">
            💡 根据题目分析，以下是最可能的原因（可多选）：
          </p>
          <div className="space-y-2">
            {options.map((option, index) => {
              const isSelected = selectedValues.includes(option.value)
              return (
                <button
                  key={index}
                  onClick={() => handleSelectOption(option.value)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition ${
                    isSelected
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${isSelected ? 'font-medium text-blue-900' : 'text-slate-700'}`}>
                      {option.label}
                    </span>
                    {isSelected && <CheckCircle2 className="text-blue-600" size={18} />}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 显示已选择的内容 */}
      {selectedValues.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-green-800">已选择：</span>
            <button
              onClick={() => onChange('')}
              className="text-xs text-green-600 hover:text-green-800"
            >
              清空
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedValues.map((val, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"
              >
                {val}
                <button
                  onClick={() => handleSelectOption(val)}
                  className="hover:text-green-900"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 自定义输入 */}
      <div>
        {!showCustomInput ? (
          <button
            onClick={() => setShowCustomInput(true)}
            className="w-full rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-100"
          >
            + 如果以上选项都不对，点击这里自己填写
          </button>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-600">
              自己填写：
            </label>
            <textarea
              value={customInput}
              onChange={(e) => handleCustomInput(e.target.value)}
              placeholder={
                gapType === 'vocab'
                  ? '例如：ambition（雄心）, strategy（策略）'
                  : gapType === 'grammar'
                  ? '例如：第2句话的被动语态 "was asked" 不理解'
                  : '例如：第3句话 "If we truly want to..." 不理解其中的逻辑关系'
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
            />
            <button
              onClick={() => {
                setShowCustomInput(false)
                const currentValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : []
                onChange(currentValues.filter(v => v !== customInput.trim()).join(', '))
                setCustomInput('')
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              收起
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

