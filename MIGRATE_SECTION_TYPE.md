# 🔧 数据库迁移指南：添加 section_type 字段

## 是的，需要手动执行 ✅

由于项目没有配置 Supabase CLI 自动迁移，需要**手动执行** SQL。

---

## ⚡ 快速执行（3 步完成）

### 1️⃣ 打开 Supabase Dashboard
- 访问：https://app.supabase.com
- 登录并选择你的项目

### 2️⃣ 打开 SQL Editor
- 点击左侧菜单的 **SQL Editor**
- 点击 **New Query**

### 3️⃣ 复制并执行以下 SQL

```sql
-- 为 user_exam_attempts 表添加 section_type 字段
ALTER TABLE user_exam_attempts 
ADD COLUMN IF NOT EXISTS section_type TEXT;

-- 创建索引以优化按部分查询
CREATE INDEX IF NOT EXISTS idx_attempts_section ON user_exam_attempts(paper_id, user_id, section_type);

-- 刷新 schema 缓存
NOTIFY pgrst, 'reload config';
```

点击 **Run** 按钮执行。

---

## ✅ 验证迁移成功

执行以下查询检查字段是否已添加：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_exam_attempts' 
AND column_name = 'section_type';
```

**如果有结果** → 迁移成功 ✅  
**如果没有结果** → 需要重新执行迁移

---

## 📁 迁移文件位置

SQL 文件位置：`supabase/migrations/add_section_type_to_attempts.sql`

你可以直接打开该文件，复制内容到 Supabase SQL Editor 执行。

---

## 💡 重要提示

- ✅ 使用了 `IF NOT EXISTS`，**重复执行不会报错**
- ✅ 只添加字段，**不会影响现有数据**
- ✅ 新字段可以为空（NULL），这是正常的
- ⚠️ 如果不执行，按部分考试功能可能无法正常工作

---

## ❓ 需要帮助？

如果执行过程中遇到任何问题，告诉我具体的错误信息，我会帮你解决。
