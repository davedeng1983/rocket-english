import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  
  const { searchParams } = new URL(request.url)
  const codesParam = searchParams.get('codes')
  
  if (!codesParam) {
    return NextResponse.json({ error: 'codes parameter is required' }, { status: 400 })
  }

  const codes = codesParam.split(',').filter(Boolean)

  if (codes.length === 0) {
    return NextResponse.json([])
  }

  // 从数据库获取知识点信息
  const { data, error } = await supabase
    .from('knowledge_entities')
    .select('code, name, description')
    .in('code', codes)

  if (error) {
    console.error('Failed to fetch knowledge points:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 如果数据库中没有，返回代码对应的默认名称
  const result = codes.map((code) => {
    const found = data?.find((item) => item.code === code)
    return found || {
      code,
      name: code.split('.').pop() || code, // 使用代码的最后一部分作为名称
      description: null,
    }
  })

  return NextResponse.json(result)
}

