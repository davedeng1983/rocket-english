-- 为 learning_gaps 表添加 attempt_id 字段
-- 用于追踪错题是在哪次考试中产生的

ALTER TABLE learning_gaps 
ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES user_exam_attempts(id) ON DELETE SET NULL;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_gaps_attempt ON learning_gaps(attempt_id);

-- 刷新 schema 缓存
NOTIFY pgrst, 'reload config';
