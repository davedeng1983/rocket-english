# Supabase 数据库设置指南（MVP 优化版）

## 快速开始

### 1. 创建 Supabase 项目

1. 访问 https://app.supabase.com
2. 点击 "New Project"
3. 填写项目信息：
   - **Name**: rocket-english
   - **Database Password**: 设置一个强密码（请保存好）
   - **Region**: 选择离你最近的区域（如 `Southeast Asia (Singapore)`）

### 2. 执行数据库 Schema

1. 在 Supabase Dashboard 中，进入 **SQL Editor**
2. 点击 **New Query**
3. 复制 `schema.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行

### 2.1. 执行数据库触发器

1. 在 Supabase Dashboard 中，进入 **SQL Editor**
2. 点击 **New Query**
3. 复制 `triggers.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行

**重要**：这个触发器会在新用户注册时自动创建对应的 Profile 记录。

### 2.2. 插入测试数据（可选）

1. 在 Supabase Dashboard 中，进入 **SQL Editor**
2. 点击 **New Query**
3. 复制 `seed.sql` 文件的全部内容
4. 粘贴到 SQL Editor 中
5. 点击 **Run** 执行

**测试数据包含**：
- 10 个知识实体
- 7 条知识关系
- 2 套试卷
- 10 道题目
- 12 条内容-知识边

详细说明请查看 `SEED_README.md`。

### 3. 获取 API 凭证

1. 在 Supabase Dashboard 中，进入 **Project Settings** > **API**
2. 复制以下信息：
   - **Project URL** → 填入 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → 填入 `.env.local` 的 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## 数据库表结构说明（MVP + Ontology Layer）

### 核心表（6 张）

#### 1. **profiles** - 用户表
- **MVP 阶段**：只存储年级和目标分数
- **字段**：
  - `grade_level`: 年级（如 '初三'）
  - `target_score`: 目标分数（如 115）
- **扩展性**：未来可添加更多个性化字段

#### 2. **exam_papers** - 试卷表
- **MVP 阶段**：存储试卷标题和结构
- **字段**：
  - `title`: 试卷标题
  - `audio_url`: 【扩展预留】音频 URL（MVP 可为空）
  - `structure_map`: 【扩展预留】试卷结构图（JSONB）
- **扩展性**：未来可直接添加音频资源，无需改表

#### 3. **questions** - 题目表（核心中的核心）
- **基础字段**：题目内容、选项、答案、解析
- **扩展字段**（JSONB，MVP 阶段可为空）：
  - `assets`: 【扩展1】多媒体资源（图片、音频片段等）
  - `stats`: 【扩展2】考情大数据（出现频率、错误率等）
  - `meta`: 【扩展3】大师级标签（知识点、陷阱、L1 干扰等）
- **设计理念**：用 JSONB 预留扩展，无需改表结构即可添加新功能

#### 4. **user_exam_attempts** - 考试记录表
- **MVP 阶段**：记录用户答题结果
- **字段**：
  - `score`: 得分
  - `user_answers`: 用户答案（JSONB 格式）
- **简化设计**：去掉状态字段，简化流程

#### 5. **learning_gaps** - 漏洞表（闭环的关键）
- **MVP 核心逻辑**：记录错题归因
- **字段**：
  - `gap_type`: 漏洞类型（'vocab', 'grammar', 'logic'）
  - `gap_detail`: 用户反馈的具体内容
  - `root_cause`: 【扩展预留】根因分析（JSONB）
  - `status`: 状态（'active' 待补, 'solved' 已补）
- **扩展性**：`root_cause` 字段可存储陷阱信息等高级分析

#### 6. **daily_tasks** - 每日任务表
- **MVP 阶段**：存储 AI 生成的补短板任务
- **字段**：
  - `scheduled_date`: 计划执行日期
  - `task_type`: 任务类型（'vocab_card', 'grammar_video', 'exercise'）
  - `content`: AI 生成的内容（JSONB）
  - `is_completed`: 是否完成
- **设计理念**：内容直接存 JSONB，不建子表

### 本体论层（3 张）- Palantir Inspired

#### 7. **knowledge_entities** - 知识实体表
- **核心理念**：将知识点实体化，不再只是字符串
- **字段**：
  - `code`: 知识点代码（如 'grammar.tense.future'）
  - `name`: 知识点名称（如 '一般将来时'）
  - `properties`: 实体属性（难度、重要性、视频 URL 等，JSONB）
- **作用**：为知识点建立统一的知识库，支持智能推荐

#### 8. **knowledge_links** - 知识关系表（The Graph）
- **核心理念**：定义知识点之间的逻辑关系，构建知识图谱
- **关系类型**：
  - `prerequisite`: 前置条件（学 B 必须先学 A）
  - `similar_to`: 相似混淆（A 和 B 容易搞混，如 in/on）
  - `part_of`: 包含关系
- **字段**：
  - `source_code`: 源知识点
  - `target_code`: 目标知识点
  - `weight`: 关系强度权重 (0.0 - 1.0)
- **作用**：让 AI 可以进行"因果推理"，智能推荐相关知识点

#### 9. **learning_actions** - 学习事件流（Event Sourcing）
- **核心理念**：记录对"漏洞(Gap)"的所有操作，支持状态流转
- **动作类型**：
  - `create_gap`: 发现漏洞
  - `review_gap`: 复习
  - `master_gap`: 标记掌握
  - `forget_gap`: 再次遗忘（状态回退）
- **字段**：
  - `action_type`: 动作类型
  - `context_data`: 动作上下文（JSONB，如关联的任务 ID）
  - `occurred_at`: 动作发生时间
- **作用**：通过查询最新动作来决定 Gap 的当前状态（Kinetic State）

#### 10. **gap_kinetic_states** - Gap 动态状态视图
- **核心理念**：将 `learning_gaps` 表优化为 Kinetic Object（动态对象）
- **设计**：不物理添加 `computed_state` 字段，而是通过视图动态计算
- **逻辑**：基于 `learning_actions` 的最新记录来决定 Gap 的当前状态
- **状态类型**：
  - `active`: 活跃状态（默认）
  - `mastered`: 已掌握（最新 action 是 'master_gap'）
  - `forgotten`: 已遗忘（最新 action 是 'forget_gap'）
  - `reviewing`: 复习中（最新 action 是 'review_gap'）
- **作用**：提供 Gap 的实时状态，支持状态流转追踪

### Master Layer（大师层 - 2 张表 + 2 个视图）

#### 10. **content_knowledge_edges** - 内容-知识图谱边表
- **核心理念**：显性化"题目-知识点"关系（Edge Materialization）
- **字段**：
  - `question_id`: 题目 ID
  - `knowledge_code`: 知识点代码
  - `weight`: 考察程度（0.1 沾边 - 1.0 核心考点）
  - `dimension`: 考察维度（如 'application', 'memory'）
- **作用**：支持高效的图算法推荐，不再需要从 JSONB 中解析关系

#### 11. **student_knowledge_states** - 学生知识状态孪生表（Digital Twin）
- **核心理念**：实时反映学生对每个知识点的掌握情况（热力图）
- **字段**：
  - `mastery_score`: 掌握度（0-100）
  - `confidence_level`: 置信度（0.0-1.0）
  - `status`: 状态（'unexplored', 'struggling', 'mastered'）
  - `last_interaction_at`: 最后交互时间（用于遗忘衰减）
- **作用**：AI 推荐算法的直接查询来源，无需翻几千条做题记录

#### 12. **recommended_next_steps** - 学习路径推荐视图
- **核心理念**：结合知识图谱 + 学生状态 + 题目，直接算出推荐
- **逻辑**：由于 A 知识点是 B 的前置，且学生 A 掌握了，B 没掌握，所以推 B 的题
- **作用**：给前端提供"上帝视角"的推荐结果

### 自动同步机制（Action Physics）

#### 触发器函数
1. **update_student_knowledge_state()**
   - 当创建新的 `learning_gap` 时触发
   - 自动更新 `student_knowledge_states` 的掌握度（下降 10 分）

2. **update_knowledge_state_from_action()**
   - 当发生 `learning_action` 时触发
   - 根据动作类型自动更新掌握度：
     - `master_gap`: +20 分
     - `review_gap`: +5 分
     - `forget_gap`: -15 分

**设计理念**：Ontology 是活的，必须在数据库层保证数据一致性，不依赖应用层代码。

## 关键设计亮点

### 1. Master Layer（大师层）- 三层架构
- **显性化边表**：`content_knowledge_edges` 将题目-知识点关系从 JSONB 中提取出来
- **数字孪生**：`student_knowledge_states` 实时反映学生知识掌握情况
- **自动同步**：触发器函数保证数据一致性（Action Physics）
- **智能推荐**：`recommended_next_steps` 视图直接提供推荐结果

### 2. 本体论层（Ontology Layer）- Palantir Inspired
- **知识实体化**：将知识点从字符串提升为实体对象
- **知识图谱**：通过 `knowledge_links` 构建知识点之间的关系网络
- **事件溯源**：通过 `learning_actions` 记录所有状态变化，支持时间旅行
- **智能推理**：AI 可以根据知识图谱进行因果推理，推荐相关知识点

### 3. JSONB 扩展预留
所有扩展功能都通过 JSONB 字段实现，无需频繁改表：
- `questions.assets`: 多媒体资源
- `questions.stats`: 考情大数据
- `questions.meta`: 大师级标签
- `learning_gaps.root_cause`: 根因分析

### 4. 简洁的 MVP 设计
- 去掉不必要的字段（如 `username`, `avatar_url` 等）
- 简化状态管理（如考试记录只记录结果，不跟踪过程）
- 核心功能优先，扩展功能预留

### 5. 一张试卷闭环
- 试卷 → 题目 → 考试记录 → 漏洞 → 任务
- 完整的"测-诊-补-测"闭环流程
- 所有数据都围绕一张试卷展开

## 安全策略

所有表都启用了 **Row Level Security (RLS)**：
- **profiles**: 用户只能访问自己的档案
- **exam_papers**: 公开可读（所有认证用户）
- **questions**: 公开可读（所有认证用户）
- **user_exam_attempts**: 用户只能访问自己的考试记录
- **learning_gaps**: 用户只能访问自己的学习漏洞
- **daily_tasks**: 用户只能访问自己的每日任务
- **knowledge_entities**: 公开可读（所有认证用户）
- **knowledge_links**: 公开可读（所有认证用户）
- **learning_actions**: 用户只能访问自己的学习动作
- **content_knowledge_edges**: 公开可读（所有认证用户）
- **student_knowledge_states**: 用户只能访问自己的知识状态

## 索引优化

数据库已针对以下查询场景创建了索引：
- 按用户查询考试记录、漏洞、任务
- 按日期查询任务
- 按类型查询漏洞
- 按状态查询活跃漏洞
- JSONB 字段的 GIN 索引（支持快速查询标签和元数据）
- 复合索引优化常用查询组合

## 数据流程示例

### 周日诊断流程
1. 用户完成试卷 → `user_exam_attempts` 记录
2. 系统识别错题 → 用户选择归因类型 → `learning_gaps` 记录
3. 系统分析漏洞 → 生成补短板计划

### 周中补短板流程
1. 系统读取 `learning_gaps` 中 `status = 'active'` 的漏洞
2. 根据 `gap_type` 和 `gap_detail` 生成任务
3. 调用 AI 生成内容 → 存入 `daily_tasks`
4. 用户完成任务 → 更新 `daily_tasks.is_completed`

## Master Layer 的使用场景

### 场景 1：实时知识状态查询
通过 `student_knowledge_states` 表，系统可以：
1. 快速查询学生对某个知识点的掌握情况
2. 生成知识掌握热力图
3. 识别薄弱环节（status = 'struggling'）

### 场景 2：基于图算法的智能推荐
通过 `content_knowledge_edges` + `knowledge_links`：
1. 查询某个知识点的所有相关题目
2. 根据 `weight` 和 `dimension` 筛选最适合的题目
3. 支持复杂的图遍历算法

### 场景 3：自动状态同步
通过触发器函数：
1. 用户做错题 → 自动创建 `learning_gap` → 触发器更新 `student_knowledge_states`
2. 用户复习 → 创建 `learning_action` → 触发器更新掌握度
3. 无需应用层代码手动同步，保证数据一致性

### 场景 4：学习路径推荐
通过 `recommended_next_steps` 视图：
1. 系统自动识别前置知识点已掌握、目标知识点未掌握的情况
2. 直接返回推荐列表，无需复杂计算
3. 前端可以直接展示推荐结果

## 本体论层的使用场景

### 场景 1：智能推荐相关知识点
当用户在某知识点上出错时，系统可以：
1. 查询 `knowledge_links`，找到与该知识点相关的知识点
2. 根据 `link_type` 和 `weight` 决定推荐优先级
3. 生成针对性的补短板任务

### 场景 2：前置条件检查
当用户想学习某个知识点时，系统可以：
1. 查询 `knowledge_links` 中 `link_type = 'prerequisite'` 的关系
2. 检查用户是否已掌握前置知识点
3. 如果未掌握，先推荐前置知识点

### 场景 3：状态流转追踪
通过 `learning_actions` 可以：
1. 追踪漏洞的完整生命周期
2. 分析用户的学习模式（多久会遗忘、复习效果等）
3. 优化复习算法

## 未来扩展建议

### 阶段 1：完善 Meta 标签
- 逐步填充 `questions.meta` 字段
- 添加知识点（kps）、陷阱（trap）、L1 干扰（l1）等标签

### 阶段 2：添加多媒体资源
- 填充 `questions.assets` 字段
- 支持图片、音频、视频等多媒体题目

### 阶段 3：接入考情大数据
- 填充 `questions.stats` 字段
- 分析题目出现频率、错误率等数据

### 阶段 4：根因分析
- 填充 `learning_gaps.root_cause` 字段
- 自动识别陷阱类型、L1 干扰等根因

## 下一步

执行完 Schema 后，可以：
1. 在 Supabase Dashboard 的 **Table Editor** 中查看表结构
2. 插入示例试卷和题目数据
3. 测试插入考试记录和漏洞数据
4. 继续开发前端功能
