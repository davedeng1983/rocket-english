/**
 * Supabase 数据库类型定义（MVP + Ontology Layer）
 * 这些类型对应 schema.sql 中定义的表结构
 * 核心理念：简洁的 MVP 版本 + 本体论层（Palantir Inspired）
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// 1. Profiles (用户表)
// ============================================
export interface Profile {
  id: string // 对应 auth.users.id
  grade_level: string | null // e.g. '初三'
  target_score: number | null // e.g. 115
  created_at: string
}

// ============================================
// 2. Exam Papers (试卷表)
// ============================================
export interface ExamPaper {
  id: string
  title: string
  audio_url: string | null // 【扩展预留】音频字段
  structure_map: Json | null // 【扩展预留】结构图
  created_at: string
}

// ============================================
// 3. Questions (题目表 - 核心中的核心)
// ============================================
export interface Question {
  id: string
  paper_id: string
  section_type: 'single_choice' | 'cloze' | 'reading' | 'writing' | null
  order_index: number | null
  content: string
  options: Json | null
  correct_answer: string | null
  analysis: string | null
  
  // 【扩展1：多媒体】
  assets: Json | null
  // MVP 阶段：null
  // 未来扩展：{"image": "url...", "audio_segment": "00:15-00:30"}
  
  // 【扩展2：考情大数据】
  stats: Json | null
  // MVP 阶段：null 或 {"frequency": 3}
  // 未来扩展：{"frequency": 5, "error_rate": 0.4, "year_appeared": [2020, 2022]}
  
  // 【扩展3：大师级标签】
  meta: Json | null
  // MVP 阶段：只需填 "kps" 即可
  // 未来扩展：{"kps": ["grammar.tense"], "trap": ["visual_confusion"], "l1": true, "strategy": "elimination"}
}

// ============================================
// 4. User Exam Attempts (考试记录表)
// ============================================
export interface UserExamAttempt {
  id: string
  user_id: string
  paper_id: string
  score: number | null
  user_answers: Json // {"q_id_1": "A", "q_id_2": "C"}
  created_at: string
}

// ============================================
// 5. Learning Gaps (漏洞表 - 闭环的关键)
// ============================================
export interface LearningGap {
  id: string
  user_id: string
  question_id: string
  gap_type: 'vocab' | 'grammar' | 'logic' | 'careless' | null
  gap_detail: string | null // e.g. "不认识单词 ambition" 或 "不懂被动语态"
  root_cause: Json | null // 【扩展预留】根因分析
  status: 'active' | 'solved'
  created_at: string
}

// ============================================
// 6. Daily Tasks (每日任务表)
// ============================================
export interface DailyTask {
  id: string
  user_id: string
  scheduled_date: string | null // DATE 格式：YYYY-MM-DD
  task_type: 'vocab_card' | 'grammar_video' | 'exercise' | null
  content: Json | null // AI 生成的内容
  is_completed: boolean
}

// ============================================
// 本体论层 (Ontology Layer)
// ============================================

// ============================================
// 7. Knowledge Entities (知识实体表)
// ============================================
export interface KnowledgeEntity {
  id: string
  code: string // e.g. 'grammar.tense.future'
  name: string // '一般将来时'
  description: string | null
  properties: Json | null // 实体属性（难度、重要性、视频 URL 等）
  created_at: string
}

// ============================================
// 8. Knowledge Links (知识关系表 - The Graph)
// ============================================
export interface KnowledgeLink {
  id: string
  source_code: string // 源知识点代码
  target_code: string // 目标知识点代码
  link_type: 'prerequisite' | 'similar_to' | 'part_of' // 关系类型
  weight: number // 关系强度权重 (0.0 - 1.0)
  created_at: string
}

// ============================================
// 9. Learning Actions (学习事件流 - Event Sourcing)
// ============================================
export interface LearningAction {
  id: string
  user_id: string
  gap_id: string
  action_type: 'create_gap' | 'review_gap' | 'master_gap' | 'forget_gap'
  context_data: Json | null // 动作上下文
  occurred_at: string
}

// ============================================
// Master Layer (大师层)
// ============================================

// ============================================
// 10. Content Knowledge Edges (内容-知识图谱边表)
// ============================================
export interface ContentKnowledgeEdge {
  id: string
  question_id: string
  knowledge_code: string
  weight: number // 0.1 (只是沾边) - 1.0 (核心考点)
  dimension: string | null // 考察维度: 'application', 'memory' 等
  created_at: string
}

// ============================================
// 11. Student Knowledge States (学生知识状态孪生表)
// ============================================
export interface StudentKnowledgeState {
  id: string
  user_id: string
  knowledge_code: string
  mastery_score: number // 0-100
  confidence_level: number // 0.0 - 1.0
  last_interaction_at: string
  status: 'unexplored' | 'struggling' | 'mastered'
  created_at: string
  updated_at: string
}

// ============================================
// Gap Kinetic States View (Gap 动态状态视图)
// ============================================
export interface GapKineticState {
  gap_id: string
  user_id: string
  question_id: string
  gap_type: string | null
  gap_detail: string | null
  base_status: 'active' | 'solved'
  created_at: string
  computed_state: 'active' | 'mastered' | 'forgotten' | 'reviewing' // 基于最新 action 计算的状态
  last_action_type: string | null
  last_action_time: string | null
}

// ============================================
// Recommended Next Steps View (学习路径推荐视图)
// ============================================
export interface RecommendedNextStep {
  user_id: string
  recommended_concept: string // 推荐学的下一个知识点代码
  concept_name: string // 知识点名称
  current_score: number // 前置知识点的掌握度
  target_score: number | null // 目标知识点的当前掌握度
  reason: string // 推荐原因（如 'prerequisite'）
  link_weight: number // 关系权重
}

// ============================================
// 扩展类型定义（用于 JSONB 字段）
// ============================================

// Question Assets (多媒体资源)
export interface QuestionAssets {
  image?: string
  audio_segment?: string // "00:15-00:30"
  video?: string
  [key: string]: Json | undefined
}

// Question Stats (考情大数据)
export interface QuestionStats {
  frequency?: number // 出现频率
  error_rate?: number // 错误率 (0-1)
  year_appeared?: number[] // 出现的年份
  [key: string]: Json | undefined
}

// Question Meta (大师级标签)
export interface QuestionMeta {
  kps?: string[] // Knowledge Points: ["grammar.tense", "vocab.level3"]
  trap?: string[] // Trap types: ["visual_confusion", "l1_interference"]
  l1?: boolean // 是否有 L1 Interference
  strategy?: string // 解题策略
  [key: string]: Json | undefined
}

// Learning Gap Root Cause (根因分析)
export interface GapRootCause {
  hit_trap?: string // 如 "visual_confusion"
  l1_interference?: boolean
  knowledge_gap?: string
  [key: string]: Json | undefined
}

// Knowledge Entity Properties (知识实体属性)
export interface KnowledgeEntityProperties {
  difficulty?: number // 难度等级 (1-5)
  importance?: number // 重要性 (1-5)
  video_url?: string // 讲解视频 URL
  explanation?: string // 知识点解释
  [key: string]: Json | undefined
}

// Learning Action Context (学习动作上下文)
export interface LearningActionContext {
  task_id?: string // 关联的任务 ID
  question_id?: string // 关联的题目 ID
  review_method?: string // 复习方式
  mastery_level_before?: number // 动作前的掌握程度
  mastery_level_after?: number // 动作后的掌握程度
  [key: string]: Json | undefined
}

// Daily Task Content (任务内容)
export interface VocabTaskContent {
  word: string
  definition: string
  example: string
  exercises?: Json[]
}

export interface GrammarTaskContent {
  knowledge_point: string
  explanation: string
  examples: string[]
  practice_questions?: Json[]
}

export interface ExerciseTaskContent {
  questions: Json[]
  explanation?: string
}

export type TaskContent = VocabTaskContent | GrammarTaskContent | ExerciseTaskContent
