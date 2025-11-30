# 📝 如何在 Supabase Dashboard 中执行 SQL

## 完整步骤指南

### 步骤 1：登录 Supabase Dashboard

1. 打开浏览器，访问：**https://app.supabase.com**
2. 登录你的账号
3. 在项目列表中选择你的项目（Rocket English 项目）

---

### 步骤 2：打开 SQL Editor

1. 在左侧菜单栏中找到 **"SQL Editor"**（SQL 编辑器）
   - 菜单图标通常是一个代码符号 `</>` 或者直接显示 "SQL Editor"
   - 如果没有看到，可以点击菜单底部的 "..." 查看更多选项

2. 点击 **"SQL Editor"** 进入 SQL 编辑器页面

3. 点击页面上的 **"New Query"**（新建查询）按钮
   - 或者点击 "+ New query" 按钮

---

### 步骤 3：执行迁移 SQL

#### 第一次执行：添加字段

1. 在 SQL 编辑器中，**复制粘贴**以下 SQL：

```sql
ALTER TABLE user_exam_attempts 
ADD COLUMN IF NOT EXISTS section_type TEXT;

CREATE INDEX IF NOT EXISTS idx_attempts_section ON user_exam_attempts(paper_id, user_id, section_type);

NOTIFY pgrst, 'reload config';
```

2. 点击右上角的 **"Run"** 按钮（或按快捷键 `Ctrl + Enter` / `Cmd + Enter`）

3. 等待执行完成，应该看到：
   - 绿色提示："Success. No rows returned" 
   - 或者类似的成功提示

---

### 步骤 4：验证迁移是否成功

#### 验证查询

1. 在同一个 SQL Editor 页面中，点击 **"New Query"** 创建一个新的查询

2. **复制粘贴**以下验证 SQL：

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_exam_attempts' 
AND column_name = 'section_type';
```

3. 点击 **"Run"** 按钮执行

4. **查看结果**：
   - ✅ **如果看到结果**（显示 `section_type` 字段信息），说明迁移成功！
   - ❌ **如果没有结果**（显示 "0 rows"），说明字段还没添加，需要重新执行步骤 3

---

## 📸 预期结果示例

### 执行迁移 SQL 后：

应该看到类似这样的提示：
```
Success. No rows returned
```

### 验证查询后：

应该看到类似这样的结果表格：

| column_name   | data_type |
|---------------|-----------|
| section_type  | text      |

如果看到这个表格，说明 **迁移成功** ✅

---

## 🖼️ 界面位置参考

Supabase Dashboard 界面结构：

```
左侧菜单栏
├── Dashboard
├── Table Editor
├── SQL Editor  ← 点击这里
├── Authentication
└── ...

SQL Editor 页面
├── 上方：+ New query 按钮
├── 中间：SQL 代码编辑区域
├── 右上角：Run 按钮 ← 点击这里执行
└── 下方：执行结果区域
```

---

## ⚠️ 常见问题

### Q1: 找不到 SQL Editor？
**A:** 
- 确认你已经登录
- 确认你已经选择了正确的项目
- 如果还是找不到，可以尝试访问：`https://app.supabase.com/project/[你的项目ID]/sql/new`

### Q2: 执行后报错怎么办？
**A:** 
- 复制完整的错误信息给我
- 检查 SQL 是否完整复制（不要遗漏分号）
- 确保你在正确的数据库中

### Q3: 如何确认我在正确的项目？
**A:** 
- 查看页面左上角的项目名称
- 或者查看 URL，应该包含你的项目 ID

### Q4: Run 按钮在哪里？
**A:** 
- 在 SQL Editor 页面的**右上角**
- 图标可能是一个播放按钮 ▶️ 或者显示 "Run"
- 也可以使用快捷键：`Ctrl + Enter`（Windows）或 `Cmd + Enter`（Mac）

---

## 💡 小技巧

1. **可以同时打开多个查询**：点击 "+ New query" 可以创建多个查询标签页
2. **保存常用查询**：Supabase 可以保存查询，方便下次使用
3. **查看执行历史**：可以查看之前执行过的 SQL 历史

---

## 🎯 快速检查清单

执行前确认：
- [ ] 已登录 Supabase Dashboard
- [ ] 已选择正确的项目
- [ ] 已打开 SQL Editor
- [ ] 已创建 New Query

执行迁移：
- [ ] 已复制迁移 SQL 代码
- [ ] 已点击 Run 按钮
- [ ] 看到成功提示

验证结果：
- [ ] 已创建新的查询
- [ ] 已复制验证 SQL
- [ ] 已执行验证查询
- [ ] 看到 `section_type` 字段信息

---

如果执行过程中遇到任何问题，把错误信息或截图发给我，我会帮你解决！
