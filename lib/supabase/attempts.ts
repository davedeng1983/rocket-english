import { createClient } from './server'
import type { UserExamAttempt, LearningGap } from './types'

/**
 * 考试记录和学习漏洞相关操作
 */

/**
 * 创建考试记录
 */
export async function createExamAttempt(
  userId: string,
  paperId: string,
  userAnswers: Record<string, string>,
  sectionType: string = 'full' // 默认整卷
) {
  const supabase = await createClient()
  
  // 根据 sectionType 获取题目来计算分数
  // 如果是部分考试，只计算该部分的题目；如果是整卷，计算所有题目
  let query = supabase
    .from('questions')
    .select('id, correct_answer')
    .eq('paper_id', paperId)
  
  if (sectionType && sectionType !== 'full') {
    query = query.eq('section_type', sectionType)
  }
  
  const { data: questions } = await query

  if (!questions) {
    return { data: null, error: { message: '无法获取题目' } }
  }

  // 计算得分
  let correctCount = 0
  questions.forEach((q) => {
    if (userAnswers[q.id] === q.correct_answer) {
      correctCount++
    }
  })

  const totalQuestions = questions.length
  const score = Math.round((correctCount / totalQuestions) * 100)

  // 创建考试记录
  const { data, error } = await supabase
    .from('user_exam_attempts')
    .insert({
      user_id: userId,
      paper_id: paperId,
      score,
      user_answers: userAnswers,
      section_type: sectionType, // 记录是哪个部分的考试
    })
    .select()
    .single()

  return { data, error, correctCount, totalQuestions }
}

/**
 * 创建学习漏洞
 */
export async function createLearningGap(
  userId: string,
  questionId: string,
  attemptId: string,
  gapType: 'vocab' | 'grammar' | 'logic',
  gapDetail: string,
  knowledgePoints: string[] = [], // 新增：知识点列表
  userAnswer: string,
  correctAnswer: string
) {
  const supabase = await createClient()
  
  // 将知识点信息保存到 root_cause JSONB 字段中
  const rootCause = knowledgePoints.length > 0
    ? { knowledge_points: knowledgePoints }
    : null
  
  const { data, error } = await supabase
    .from('learning_gaps')
    .insert({
      user_id: userId,
      question_id: questionId,
      attempt_id: attemptId,
      gap_type: gapType,
      gap_detail: gapDetail,
      root_cause: rootCause, // 保存知识点信息
      status: 'active',
    })
    .select()
    .single()

  // 同时创建 learning_action 记录
  if (data && !error) {
    await supabase
      .from('learning_actions')
      .insert({
        user_id: userId,
        gap_id: data.id,
        action_type: 'create_gap',
        context_data: {
          user_answer: userAnswer,
          correct_answer: correctAnswer,
          knowledge_points: knowledgePoints,
        },
      })
  }

  return { data, error }
}

/**
 * 获取用户的考试记录
 */
export async function getUserExamAttempts(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_exam_attempts')
    .select('*, exam_papers(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * 获取用户的学习漏洞
 */
export async function getUserLearningGaps(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_gaps')
    .select('*, questions(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return { data, error }
}
