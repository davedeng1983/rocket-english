import { createClient } from './server'
import type { ExamPaper, Question } from './types'

/**
 * 试卷和题目相关数据操作
 */

/**
 * 获取所有已发布的试卷
 */
export async function getExamPapers() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exam_papers')
    .select('*')
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * 根据 ID 获取试卷详情
 */
export async function getExamPaperById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exam_papers')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error }
}

/**
 * 获取试卷的所有题目
 */
export async function getQuestionsByPaperId(paperId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('paper_id', paperId)
    .order('order_index', { ascending: true })

  return { data, error }
}

/**
 * 根据 ID 获取单个题目
 */
export async function getQuestionById(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', id)
    .single()

  return { data, error }
}

/**
 * 获取题目的知识点关联
 */
export async function getQuestionKnowledgeEdges(questionId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('content_knowledge_edges')
    .select('*, knowledge_entities(*)')
    .eq('question_id', questionId)

  return { data, error }
}
