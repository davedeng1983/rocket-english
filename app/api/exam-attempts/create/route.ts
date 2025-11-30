import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createExamAttempt } from '@/lib/supabase/attempts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { paperId, userAnswers, sectionType } = body

  if (!paperId || !userAnswers) {
    return NextResponse.json(
      { error: 'paperId and userAnswers are required' },
      { status: 400 }
    )
  }

  const { data, error, correctCount, totalQuestions } = await createExamAttempt(
    user.id,
    paperId,
    userAnswers,
    sectionType || 'full' // 默认为整卷
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    attempt: data,
    correctCount,
    totalQuestions,
  })
}
