# 🚀 快速迁移指南：添加 attempt_id 字段

## ⚡ 一分钟完成迁移

### 步骤 1：打开 Supabase Dashboard

1. 访问 https://app.supabase.com
2. 登录并选择你的项目

### 步骤 2：打开 SQL Editor

在左侧菜单中找到 **SQL Editor** 并点击

### 步骤 3：复制并执行以下 SQL

```sql
-- 为 learning_gaps 表添加 attempt_id 字段
ALTER TABLE learning_gaps 
ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES user_exam_attempts(id) ON DELETE SET NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_gaps_attempt ON learning_gaps(attempt_id);

-- 刷新缓存
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
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'learning_gaps' 
AND column_name = 'attempt_id';
```

如果看到 `attempt_id` 字段，说明成功了！

---

## ❓ 常见问题

**Q: 如果字段已经存在怎么办？**  
A: 使用了 `IF NOT EXISTS`，重复执行不会报错，可以安全执行。

**Q: 会影响现有数据吗？**  
A: 不会。只是添加一个新字段，现有数据保持不变。

**Q: 可以不执行吗？**  
A: 可以，但不执行的话，`attempt_id` 字段可能不存在，保存错题归因时可能会报错。
