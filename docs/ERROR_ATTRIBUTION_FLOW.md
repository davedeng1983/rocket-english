# 错题归因流程说明

## 功能概述

当学生答题错误时，系统会自动弹出归因对话框，让学生选择错误原因（单词、语法或逻辑），并将这些信息记录到"补短板"错题本中。

## 完整流程

### 1. 学生提交试卷

```
学生完成试卷 → 点击"提交"按钮
```

### 2. 系统自动识别错题

```javascript
// 系统会自动找出所有错题
const wrongQuestions = questions.filter(
  (q) => userAnswers[q.id] !== q.correct_answer
)
```

### 3. 显示错题归因对话框

如果有错题，系统会：
- 显示第一个错题
- 弹出归因对话框（`AttributionDialog`）
- 显示题目内容、学生答案和正确答案

### 4. 学生选择错误原因

归因对话框提供三个选项：

#### 📚 生词障碍 (vocab)
- 学生可以列出不认识的单词
- 示例：`ambition（雄心）, strategy（策略）`

#### 📖 语法模糊 (grammar)
- 学生可以指出不理解的语法点或句子
- 示例：`第2句话的被动语态 "was asked" 不理解`

#### 🧠 逻辑不清 (logic)
- 学生可以指出不理解的逻辑关系
- 示例：`第3句话 "If we truly want to..." 不理解其中的逻辑关系`

### 5. 保存到数据库

选择错误类型并填写详细信息后，系统会：

1. **保存到 `learning_gaps` 表**：
   - `gap_type`: 'vocab' | 'grammar' | 'logic'
   - `gap_detail`: 学生填写的具体内容
   - `question_id`: 错题的ID
   - `user_id`: 学生ID
   - `attempt_id`: 考试记录ID（可选）
   - `status`: 'active'（待补）

2. **创建学习动作记录**：
   - 在 `learning_actions` 表中记录 `create_gap` 动作
   - 包含用户答案和正确答案作为上下文

### 6. 继续处理下一个错题

- 如果有多个错题，系统会自动显示下一个错题的归因对话框
- 重复步骤 4-5，直到所有错题都处理完成

### 7. 查看错题本

学生可以在"错题重练"页面（`/review`）查看所有记录的错题：

- 显示错误类型图标（📚 生词 / 📖 语法 / 🧠 逻辑）
- 显示之前记录的详细信息
- 可以重新练习这些错题

## 数据库结构

### learning_gaps 表

```sql
CREATE TABLE learning_gaps (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  question_id UUID REFERENCES questions(id),
  attempt_id UUID REFERENCES user_exam_attempts(id), -- 可选
  gap_type TEXT, -- 'vocab', 'grammar', 'logic'
  gap_detail TEXT, -- 学生填写的具体内容
  status TEXT DEFAULT 'active', -- 'active' | 'solved'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### learning_actions 表

```sql
CREATE TABLE learning_actions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  gap_id UUID REFERENCES learning_gaps(id),
  action_type TEXT, -- 'create_gap', 'review_gap', 'master_gap'
  context_data JSONB, -- 包含 user_answer, correct_answer 等
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);
```

## API 端点

### 创建学习漏洞

```http
POST /api/learning-gaps/create
Content-Type: application/json

{
  "questionId": "uuid",
  "attemptId": "uuid",
  "gapType": "vocab" | "grammar" | "logic",
  "gapDetail": "不认识的单词：ambition, strategy",
  "userAnswer": "B",
  "correctAnswer": "A"
}
```

### 获取学习漏洞列表

```http
GET /api/learning-gaps
```

返回当前用户的所有活跃错题，包含题目信息。

## 用户体验优化

### 当前实现的功能

✅ 自动弹出归因对话框
✅ 清晰的错误类型选择（三个选项）
✅ 详细的输入提示和示例
✅ 自动处理多个错题（逐个显示）
✅ 在错题本中显示记录的信息

### 可以改进的地方

1. **进度提示**：显示"第 X 个错题，共 Y 个"
2. **跳过功能**：允许跳过某些错题的归因
3. **批量处理**：允许一次性为多个错题选择相同的错误类型
4. **智能建议**：根据题目内容自动推荐可能的错误类型

## 使用示例

### 场景1：单词不认识

1. 学生答错第5题
2. 选择"📚 生词障碍"
3. 输入："ambition（雄心）, accomplish（完成）"
4. 点击"确认"
5. 系统记录到错题本

### 场景2：语法不理解

1. 学生答错第12题
2. 选择"📖 语法模糊"
3. 输入："第2句话的被动语态 'was asked' 不理解"
4. 点击"确认"
5. 系统记录到错题本

### 场景3：逻辑不清

1. 学生答错第25题（阅读理解）
2. 选择"🧠 逻辑不清"
3. 输入："第3段的理解有偏差，不理解作者的观点"
4. 点击"确认"
5. 系统记录到错题本

## 数据利用

记录的错误原因可以用于：

1. **个性化学习计划**：根据错误类型生成针对性的练习
2. **知识图谱**：识别学生的薄弱知识点
3. **统计分析**：分析常见错误模式
4. **智能推荐**：推荐相关学习资源
