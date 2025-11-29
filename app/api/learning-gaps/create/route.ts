import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLearningGap } from '@/lib/supabase/attempts'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    questionId,
    attemptId,
    gapType,
    gapDetail,
    userAnswer,
    correctAnswer,
  } = body

  if (!questionId || !attemptId || !gapType || !gapDetail) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    )
  }

  const { data, error } = await createLearningGap(
    user.id,
    questionId,
    attemptId,
    gapType,
    gapDetail,
    userAnswer,
    correctAnswer
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ gap: data })
}
