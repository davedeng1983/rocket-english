import { NextResponse } from 'next/server'
import { getQuestionsByPaperId } from '@/lib/supabase/exams'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const paperId = searchParams.get('paperId')

  if (!paperId) {
    return NextResponse.json({ error: 'paperId is required' }, { status: 400 })
  }

  const { data, error } = await getQuestionsByPaperId(paperId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { paper_id, ...rest } = body

    if (!paper_id) {
        return NextResponse.json({ error: 'paper_id is required' }, { status: 400 })
    }

    // Get current max order_index to append
    const { data: maxOrderData } = await supabase
        .from('questions')
        .select('order_index')
        .eq('paper_id', paper_id)
        .order('order_index', { ascending: false })
        .limit(1)
        .single()

    const nextOrderIndex = (maxOrderData?.order_index || 0) + 1

    const { data, error } = await supabase
      .from('questions')
      .insert({
        paper_id,
        order_index: nextOrderIndex,
        ...rest
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error creating question:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

