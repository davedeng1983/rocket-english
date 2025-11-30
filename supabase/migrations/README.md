# 数据库迁移指南

## 快速执行迁移

如果你需要在现有数据库中添加新字段，请按照以下步骤操作：

### 方法1：通过 Supabase Dashboard（推荐）

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 点击左侧菜单的 **SQL Editor**
4. 点击 **New Query**
5. 复制并粘贴以下 SQL 代码：

```sql
-- 为 learning_gaps 表添加 attempt_id 字段
-- 用于追踪错题是在哪次考试中产生的

ALTER TABLE learning_gaps 
ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES user_exam_attempts(id) ON DELETE SET NULL;

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_gaps_attempt ON learning_gaps(attempt_id);

-- 刷新 schema 缓存
NOTIFY pgrst, 'reload config';
```

6. 点击 **Run** 按钮执行
7. 看到 "Success. No rows returned" 表示执行成功 ✅

### 方法2：直接复制迁移文件内容

迁移文件位置：`supabase/migrations/add_attempt_id_to_gaps.sql`

你可以：
- 打开该文件
- 复制全部内容
- 在 Supabase SQL Editor 中执行

### 验证迁移是否成功

执行以下查询验证字段是否添加成功：

```sql
-- 查看 learning_gaps 表结构
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'learning_gaps'
AND column_name = 'attempt_id';
```

如果看到 `attempt_id` 字段，说明迁移成功！

### 注意事项

- 使用 `IF NOT EXISTS` 确保字段不存在时才添加，重复执行不会报错
- 如果数据库中已经有数据，新字段会为 NULL（这是正常的）
- 索引会自动创建，优化查询性能

## 常见问题

**Q: 执行后显示错误怎么办？**
A: 检查错误信息。如果显示字段已存在，说明迁移已经执行过了，可以忽略。

**Q: 需要备份数据吗？**
A: 这个迁移只是添加新字段，不会修改或删除现有数据，但建议定期备份数据库。

**Q: 字段可以为空吗？**
A: 是的，`attempt_id` 是可选的（允许 NULL），用于追踪错题来源，但不是必须的。
