import { NextResponse } from 'next/server'
import { getQuestionsByPaperId } from '@/lib/supabase/exams'

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

