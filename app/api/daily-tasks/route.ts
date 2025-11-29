import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailyTasks, getPendingTasks } from '@/lib/supabase/tasks'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')

  const { data, error } = date
    ? await getDailyTasks(user.id, date)
    : await getPendingTasks(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}
