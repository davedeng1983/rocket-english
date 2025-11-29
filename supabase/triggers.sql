-- ============================================
-- Supabase 数据库触发器
-- ============================================
-- 用于自动创建和管理用户 Profile
-- ============================================

-- ============================================
-- 1. 自动创建 Profile 触发器
-- ============================================
-- 当新用户注册时，自动在 profiles 表中创建对应的记录

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, grade_level, target_score)
  VALUES (
    NEW.id,
    NULL, -- 默认值，用户可以在注册时填写
    NULL  -- 默认值，用户可以在注册时填写
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器：当 auth.users 表插入新用户时触发
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. 更新 Profile 的 updated_at 触发器
-- ============================================
-- 如果 profiles 表有 updated_at 字段，可以添加这个触发器

-- 注意：当前 schema 中 profiles 表没有 updated_at 字段
-- 如果需要，可以在 schema.sql 中添加，然后启用这个触发器

-- CREATE OR REPLACE FUNCTION update_profiles_updated_at()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   NEW.updated_at = NOW();
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;

-- CREATE TRIGGER update_profiles_updated_at
--   BEFORE UPDATE ON profiles
--   FOR EACH ROW
--   EXECUTE FUNCTION update_profiles_updated_at();

