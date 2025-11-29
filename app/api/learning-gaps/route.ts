import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserLearningGaps } from '@/lib/supabase/attempts'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await getUserLearningGaps(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
