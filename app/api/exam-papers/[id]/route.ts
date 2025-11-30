import { NextResponse } from 'next/server'
import { getExamPaperById } from '@/lib/supabase/exams'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const { data, error } = await getExamPaperById(resolvedParams.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const supabase = await createClient()
  
  // 鉴权
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 关键修改：添加 count: 'exact' 并在删除数为 0 时报错
  const { error, count } = await supabase
    .from('exam_papers')
    .delete({ count: 'exact' })
    .eq('id', resolvedParams.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 如果 RLS 阻止了删除，或者 ID 不存在，count 会是 0
  if (count === 0) {
    return NextResponse.json(
      { error: '删除失败：找不到试卷或没有权限。请检查 Supabase RLS 策略。' }, 
      { status: 403 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params
  const supabase = await createClient()
  
  // 鉴权
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { title } = body

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('exam_papers')
    .update({ title })
    .eq('id', resolvedParams.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
