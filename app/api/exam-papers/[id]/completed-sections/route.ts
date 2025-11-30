import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 获取用户完成了试卷的哪些部分
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: paperId } = await params

  try {
    // 查询用户对该试卷的所有考试记录
    const { data: attempts, error } = await supabase
      .from('user_exam_attempts')
      .select('section_type')
      .eq('user_id', user.id)
      .eq('paper_id', paperId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 提取已完成的 section_type，去重
    const completedSections = new Set<string>()
    attempts?.forEach((attempt: any) => {
      if (attempt.section_type) {
        completedSections.add(attempt.section_type)
      }
    })

    return NextResponse.json({
      completedSections: Array.from(completedSections),
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch completed sections' },
      { status: 500 }
    )
  }
}

