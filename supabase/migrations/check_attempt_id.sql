-- ============================================
-- 检查 attempt_id 字段是否存在
-- ============================================
-- 使用方法：在 Supabase SQL Editor 中执行此查询

-- 1. 检查 learning_gaps 表是否有 attempt_id 字段
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'learning_gaps'
  AND column_name = 'attempt_id';

-- ============================================
-- 结果说明：
-- ============================================
-- 如果查询返回一行结果：
--   ✅ 字段已存在！不需要执行迁移
-- 
-- 如果查询返回 0 行结果：
--   ❌ 字段不存在！需要执行迁移脚本
-- 
-- ============================================

-- 2. 同时检查相关索引是否存在
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'learning_gaps'
  AND indexname = 'idx_gaps_attempt';

-- ============================================
-- 完整检查：查看 learning_gaps 表的所有字段
-- ============================================
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'learning_gaps'
ORDER BY ordinal_position;
