# 多用户数据隔离测试计划

我们将通过手动模拟流程来验证数据隔离。由于涉及真实数据库交互和 Auth 状态，手动验证比单元测试更可靠。

## 测试步骤

### 1. 准备工作
- 确保 Supabase 本地环境或云端环境正常运行。
- 确保 `exam_papers` 表中至少有一份试卷。

### 2. 模拟用户 A (Student A)
1.  **注册/登录**: 使用邮箱 `studentA@example.com` / 密码 `password123`。
2.  **做题**: 进入 `/study`，完成一份试卷。
    *   故意做错一道题（如第1题）。
    *   在归因弹窗中选择 "生词障碍"，输入 "test_word_A"。
3.  **生成计划**: 点击仪表盘的 "生成计划"。
4.  **验证**: 确认仪表盘出现 "test_word_A" 的背单词任务。

### 3. 模拟用户 B (Student B)
1.  **无痕模式/登出**: 登出用户 A，或使用隐身窗口。
2.  **注册/登录**: 使用邮箱 `studentB@example.com` / 密码 `password123`。
3.  **验证隔离 (关键点)**:
    *   查看 `/dashboard`: **不应该** 看到用户 A 的 "test_word_A" 任务。
    *   查看 `/review`: **不应该** 看到用户 A 的错题。
    *   查看 `/progress`: 统计数据应为 0（或是 B 自己的数据）。
4.  **做题**: 完成同一份试卷。
    *   故意做错第1题。
    *   归因输入 "test_word_B"。
5.  **验证独立性**: 确认 B 的仪表盘出现 "test_word_B" 任务。

### 4. 再次验证用户 A
1.  重新登录用户 A。
2.  确认 A 依然只看到 "test_word_A"，看不到 "test_word_B"。

## RLS 策略审计 (已实施)
我们已经在数据库层面实施了 Row Level Security (RLS)：

```sql
-- 用户只能访问自己的每日任务
CREATE POLICY "User access own tasks"
  ON daily_tasks FOR ALL
  USING (auth.uid() = user_id);

-- 用户只能访问自己的学习漏洞
CREATE POLICY "User access own gaps"
  ON learning_gaps FOR ALL
  USING (auth.uid() = user_id);
```

这意味着即使 API 出现 Bug，数据库层也会拦截非法的跨用户查询。

