import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { gapId, actionType, contextData } = body

  if (!gapId || !actionType) {
    return NextResponse.json(
      { error: 'gapId and actionType are required' },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('learning_actions')
    .insert({
      user_id: user.id,
      gap_id: gapId,
      action_type: actionType,
      context_data: contextData || {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ action: data })
}
