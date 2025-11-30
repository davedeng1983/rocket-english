# 数据验证指南

## 检查导入的试卷数据是否完整

### 方法1: 通过 Supabase Dashboard

1. 登录 Supabase Dashboard
2. 进入 Table Editor
3. 查看 `questions` 表，检查以下字段：
   - `correct_answer`: 应该有答案（如 "A", "B", "C", "D" 或文本答案）
   - `analysis`: 应该有解析内容
   - `meta`: JSON 格式，应该包含 `kps` 数组，例如：
     ```json
     {
       "kps": ["grammar.tense", "vocab.general"],
       "article": "阅读材料内容（如果有）"
     }
     ```

### 方法2: 通过 SQL 查询

```sql
-- 查看所有题目的答案、解析和知识点
SELECT 
  id,
  order_index,
  content,
  correct_answer,
  analysis,
  meta->>'kps' as knowledge_points
FROM questions
WHERE paper_id = 'YOUR_PAPER_ID'
ORDER BY order_index;

-- 查看知识点关联
SELECT 
  q.order_index,
  q.content,
  cke.knowledge_code
FROM questions q
LEFT JOIN content_knowledge_edges cke ON q.id = cke.question_id
WHERE q.paper_id = 'YOUR_PAPER_ID'
ORDER BY q.order_index;
```

### 方法3: 通过代码验证

在导入后，可以通过 API 检查：

```javascript
// 检查题目数据
const response = await fetch(`/api/questions?paperId=${paperId}`);
const questions = await response.json();

questions.forEach(q => {
  console.log(`题目 ${q.order_index}:`);
  console.log(`  答案: ${q.correct_answer || '无'}`);
  console.log(`  解析: ${q.analysis ? '有' : '无'}`);
  console.log(`  知识点: ${q.meta?.kps?.join(', ') || '无'}`);
});
```

## 常见问题

### 1. 为什么有些题目没有答案？

- Word 文档中可能没有 `【答案】` 标签
- 解析器可能没有正确识别答案格式

### 2. 为什么知识点为空？

- 文档中可能没有 `【知识点】` 标签
- 自动识别逻辑可能无法匹配到知识点

### 3. 如何改进？

- 使用 Exam Editor 手动补充缺失的答案、解析和知识点
- 或者优化 Word 文档格式，确保包含标准标签
