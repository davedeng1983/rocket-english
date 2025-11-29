'use server'

import { createClient } from './server'
import type { DailyTask, LearningGap } from './types'

/**
 * 每日任务相关操作
 */

/**
 * 获取用户的每日任务
 */
export async function getDailyTasks(userId: string, date?: string) {
  const supabase = await createClient()
  let query = supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_date', { ascending: true })

  if (date) {
    query = query.eq('scheduled_date', date)
  }

  const { data, error } = await query
  return { data, error }
}

/**
 * 获取用户待完成的任务
 */
export async function getPendingTasks(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .gte('scheduled_date', new Date().toISOString().split('T')[0])
    .order('scheduled_date', { ascending: true })

  return { data, error }
}

/**
 * 更新任务完成状态
 */
export async function completeTask(taskId: string, completionData?: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_tasks')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completion_data: completionData || {},
    })
    .eq('id', taskId)
    .select()
    .single()

  return { data, error }
}

/**
 * 创建每日任务
 */
export async function createDailyTask(
  userId: string,
  scheduledDate: string,
  taskType: 'vocab_card' | 'grammar_video' | 'exercise',
  content: any,
  sourceGapId?: string
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert({
      user_id: userId,
      scheduled_date: scheduledDate,
      task_type: taskType,
      content,
      source_gap_id: sourceGapId,
      is_completed: false,
    })
    .select()
    .single()

  return { data, error }
}

/**
 * 批量创建每日任务（用于生成周计划）
 */
export async function createDailyTasks(tasks: Array<{
  user_id: string
  scheduled_date: string
  task_type: 'vocab_card' | 'grammar_video' | 'exercise'
  content: any
  source_gap_id?: string
}>) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_tasks')
    .insert(tasks)
    .select()

  return { data, error }
}

/**
 * 获取用户的学习漏洞（用于生成任务）
 */
export async function getActiveLearningGaps(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('learning_gaps')
    .select('*, questions(*)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return { data, error }
}

