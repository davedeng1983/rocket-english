import { NextResponse } from 'next/server'
import { getExamPaperById } from '@/lib/supabase/exams'

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
