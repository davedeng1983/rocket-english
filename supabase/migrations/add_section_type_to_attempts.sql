-- 为 user_exam_attempts 表添加 section_type 字段
-- 用于记录用户完成了试卷的哪个部分（单项选择、完形填空等）

ALTER TABLE user_exam_attempts 
ADD COLUMN IF NOT EXISTS section_type TEXT; -- 'single_choice', 'cloze', 'reading', 'writing', 'full' (整卷)

-- 创建索引以优化按部分查询
CREATE INDEX IF NOT EXISTS idx_attempts_section ON user_exam_attempts(paper_id, user_id, section_type);

-- 刷新 schema 缓存
NOTIFY pgrst, 'reload config';
