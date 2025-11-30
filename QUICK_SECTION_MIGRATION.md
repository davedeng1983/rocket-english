# ⚡ 快速迁移：添加 section_type 字段

## 是的，需要手动执行

项目没有配置 Supabase CLI，所以需要**手动执行** SQL 迁移。

---

## 🚀 一分钟完成迁移

### 步骤 1：打开 Supabase Dashboard

1. 访问：https://app.supabase.com
2. 登录并选择你的项目

### 步骤 2：打开 SQL Editor

在左侧菜单中找到 **SQL Editor** 并点击

### 步骤 3：复制并执行以下 SQL

```sql
-- 为 user_exam_attempts 表添加 section_type 字段
ALTER TABLE user_exam_attempts 
ADD COLUMN IF NOT EXISTS section_type TEXT;

-- 创建索引以优化按部分查询
CREATE INDEX IF NOT EXISTS idx_attempts_section ON user_exam_attempts(paper_id, user_id, section_type);

-- 刷新 schema 缓存
NOTIFY pgrst, 'reload config';
```

### 步骤 4：点击运行

点击右上角的 **Run** 按钮（或按 `Ctrl/Cmd + Enter`）

### ✅ 完成！

看到 "Success" 提示就表示迁移成功了。

---

## 🔍 验证迁移是否成功

可以运行以下查询检查：

```sql
-- 检查 section_type 字段是否存在
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_exam_attempts'
  AND column_name = 'section_type';
```

如果看到 `section_type` 字段，说明成功了！

---

## 📋 或者直接复制文件内容

迁移脚本位置：`supabase/migrations/add_section_type_to_attempts.sql`

你可以：
1. 打开该文件
2. 复制全部内容
3. 在 Supabase SQL Editor 中执行

---

## ❓ 常见问题

**Q: 如果字段已经存在怎么办？**  
A: 使用了 `IF NOT EXISTS`，重复执行不会报错，可以安全执行。

**Q: 会影响现有数据吗？**  
A: 不会。只是添加一个新字段，现有数据保持不变。新字段会为 NULL（这是正常的）。

**Q: 可以不执行吗？**  
A: 如果不执行，按部分考试功能可能无法正常工作，因为系统无法记录 `section_type`。

---

## 💡 提示

- 所有检查都是**只读查询**，不会修改任何数据
- 可以安全地多次执行
- 执行后立即生效，无需重启服务

