# 测试数据插入指南

## 快速开始

### 方法 1：使用 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 https://app.supabase.com
   - 选择你的项目

2. **执行 Seed SQL**
   - 进入 **SQL Editor**
   - 点击 **New Query**
   - 复制 `seed.sql` 文件的全部内容
   - 粘贴到 SQL Editor 中
   - 点击 **Run** 执行

3. **验证数据**
   - 进入 **Table Editor**
   - 检查以下表是否有数据：
     - `knowledge_entities` - 应该有 10 条记录
     - `knowledge_links` - 应该有 7 条记录
     - `exam_papers` - 应该有 2 条记录
     - `questions` - 应该有 10 条记录
     - `content_knowledge_edges` - 应该有 12 条记录

### 方法 2：使用 Supabase CLI（可选）

如果你安装了 Supabase CLI：

```bash
# 在项目根目录执行
supabase db reset --db-url "your-supabase-db-url"
# 或者
psql "your-supabase-db-url" < supabase/seed.sql
```

## 测试数据说明

### 1. 知识实体（10 个）
- 语法类：时态（现在/过去/将来）、被动语态、人称代词
- 词汇类：L1/L2/L3 三个级别
- 逻辑类：阅读理解、逻辑推理

### 2. 知识关系（7 条）
- 前置关系：时态的前置顺序
- 相似混淆：容易搞混的知识点

### 3. 试卷（2 套）
- 北京市2022年中考英语真题
- 北京市2023年中考英语真题

### 4. 题目（10 道）
- 涵盖不同知识点和难度
- 包含单选题
- 每道题都有完整的选项、答案、解析

### 5. 内容-知识边（12 条）
- 将题目与知识点关联
- 设置考察权重和维度

## 测试流程

### 1. 注册/登录
- 访问 `/auth/signup` 注册新用户
- 或访问 `/auth/login` 登录

### 2. 完成测试
- 访问 `/study` 选择试卷
- 完成 10 道题目
- 提交试卷

### 3. 错题归因
- 系统会自动识别错题
- 弹出归因弹窗
- 选择错误原因并填写详情

### 4. 生成补短板计划
- 访问 `/dashboard`
- 点击"生成本周补短板计划"
- 系统会根据漏洞生成任务

### 5. 完成任务
- 在仪表盘中查看每日任务
- 完成任务并标记完成

### 6. 错题重练
- 访问 `/review`
- 重新练习之前的错题
- 答对会标记为掌握

## 注意事项

1. **数据冲突**：脚本使用了 `ON CONFLICT DO NOTHING`，重复执行不会报错
2. **UUID 固定**：测试数据使用了固定的 UUID，便于测试
3. **真实场景**：这些是简化版测试数据，实际使用时需要更完整的题目

## 清理测试数据

如果需要清理测试数据：

```sql
-- 注意：这会删除所有数据，包括用户数据
DELETE FROM content_knowledge_edges;
DELETE FROM questions;
DELETE FROM exam_papers;
DELETE FROM knowledge_links;
DELETE FROM knowledge_entities;
```

## 扩展测试数据

如果需要更多测试数据，可以：
1. 复制 `seed.sql` 中的 INSERT 语句
2. 修改 UUID 和内容
3. 添加更多题目和知识点

