# 🔍 检查数据库迁移状态

## 快速检查 attempt_id 字段是否存在

### 方法1：一键检查（推荐）

1. **打开 Supabase Dashboard**
   - 访问 https://app.supabase.com
   - 登录并选择你的项目

2. **打开 SQL Editor**
   - 点击左侧菜单的 **SQL Editor**
   - 点击 **New Query**

3. **复制并执行以下 SQL**

```sql
-- 检查 attempt_id 字段是否存在
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'learning_gaps'
  AND column_name = 'attempt_id';
```

4. **查看结果**
   - ✅ **如果有结果**：字段已存在，无需执行迁移
   - ❌ **如果没有结果**：字段不存在，需要执行迁移

---

### 方法2：查看完整表结构

如果想查看 `learning_gaps` 表的所有字段：

```sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'learning_gaps'
ORDER BY ordinal_position;
```

这会显示表中所有字段，你可以查看是否有 `attempt_id`。

---

### 方法3：使用检查脚本

项目中的 `supabase/migrations/check_attempt_id.sql` 文件包含了完整的检查脚本，你可以：
1. 打开该文件
2. 复制全部内容
3. 在 Supabase SQL Editor 中执行

---

## 📊 预期结果示例

### ✅ 字段已存在的情况

查询会返回类似这样的结果：

```
column_name  | data_type | is_nullable
-------------|-----------|------------
attempt_id   | uuid      | YES
```

### ❌ 字段不存在的情况

查询返回：
```
(0 rows)
```

---

## 🚀 根据检查结果执行操作

### 如果字段已存在 ✅

恭喜！你的数据库已经是最新的，**不需要执行任何操作**。

### 如果字段不存在 ❌

请按照 `QUICK_MIGRATION.md` 中的步骤执行迁移。

---

## 🔧 检查其他相关内容

### 检查索引是否存在

```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'learning_gaps'
  AND indexname = 'idx_gaps_attempt';
```

### 检查表是否存在

```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'learning_gaps'
);
```

---

## 💡 提示

- 所有检查都是**只读查询**，不会修改任何数据
- 可以安全地多次执行检查
- 如果遇到任何错误，请检查表名是否正确
