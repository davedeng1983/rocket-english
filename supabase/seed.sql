-- ============================================
-- Rocket English 测试数据 (Seed Data)
-- ============================================
-- 用于快速测试系统功能
-- ============================================

-- ============================================
-- 1. 插入知识实体 (Knowledge Entities)
-- ============================================
INSERT INTO knowledge_entities (code, name, description, properties) VALUES
('grammar.tense.present', '一般现在时', '表示经常性、习惯性的动作或状态', '{"difficulty": 2, "importance": 5}'),
('grammar.tense.past', '一般过去时', '表示过去发生的动作或状态', '{"difficulty": 2, "importance": 5}'),
('grammar.tense.future', '一般将来时', '表示将来要发生的动作', '{"difficulty": 3, "importance": 5}'),
('grammar.passive', '被动语态', 'be + 过去分词的结构', '{"difficulty": 4, "importance": 5}'),
('grammar.pronoun.subject', '人称代词主格', 'I, you, he, she, it, we, they', '{"difficulty": 1, "importance": 4}'),
('vocab.level1', 'L1 词汇', '基础词汇（初一水平）', '{"difficulty": 1, "importance": 3}'),
('vocab.level2', 'L2 词汇', '进阶词汇（初二水平）', '{"difficulty": 2, "importance": 4}'),
('vocab.level3', 'L3 词汇', '高级词汇（初三水平）', '{"difficulty": 3, "importance": 5}'),
('logic.reading', '阅读理解', '理解文章主旨和细节', '{"difficulty": 4, "importance": 5}'),
('logic.inference', '逻辑推理', '根据上下文推断', '{"difficulty": 5, "importance": 5}')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. 插入知识关系 (Knowledge Links)
-- ============================================
INSERT INTO knowledge_links (source_code, target_code, link_type, weight) VALUES
-- 时态的前置关系
('grammar.tense.present', 'grammar.tense.past', 'prerequisite', 0.8),
('grammar.tense.past', 'grammar.tense.future', 'prerequisite', 0.8),
-- 被动语态需要先掌握时态
('grammar.tense.present', 'grammar.passive', 'prerequisite', 0.9),
-- 词汇的层级关系
('vocab.level1', 'vocab.level2', 'prerequisite', 0.7),
('vocab.level2', 'vocab.level3', 'prerequisite', 0.7),
-- 相似混淆
('grammar.tense.present', 'grammar.tense.past', 'similar_to', 0.6),
('grammar.pronoun.subject', 'grammar.pronoun.object', 'similar_to', 0.5)
ON CONFLICT (source_code, target_code, link_type) DO NOTHING;

-- ============================================
-- 3. 插入试卷 (Exam Papers)
-- ============================================
INSERT INTO exam_papers (id, title, audio_url, structure_map) VALUES
(
  '00000000-0000-0000-0000-000000000001',
  '北京市2022年中考英语真题',
  NULL,
  '{"sections": ["单项选择", "完形填空", "阅读理解", "书面表达"], "total_questions": 10}'
),
(
  '00000000-0000-0000-0000-000000000002',
  '北京市2023年中考英语真题',
  NULL,
  '{"sections": ["单项选择", "完形填空", "阅读理解", "书面表达"], "total_questions": 10}'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. 插入题目 (Questions)
-- ============================================
-- 试卷 1 的题目
INSERT INTO questions (id, paper_id, section_type, order_index, content, options, correct_answer, analysis, meta) VALUES
-- 题目 1: 人称代词主格
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  1,
  'My friends and I like sports. ____ often play basketball together after school.',
  '["A. We", "B. I", "C. They", "D. You"]',
  'A',
  '主语是 My friends and I（我和我的朋友们），即"我们"，且在句中作主语，故选 We。',
  '{"kps": ["grammar.pronoun.subject"]}'
),
-- 题目 2: 被动语态
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  2,
  'Chinese ____ by more people these days.',
  '["A. speaks", "B. spoke", "C. is spoken", "D. was spoken"]',
  'C',
  '中文是被说的，these days 提示一般现在时，用 is spoken。',
  '{"kps": ["grammar.passive", "grammar.tense.present"], "trap": ["l1_interference"], "l1": true}'
),
-- 题目 3: 一般过去时
(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  3,
  'I ____ to the park yesterday.',
  '["A. go", "B. went", "C. will go", "D. am going"]',
  'B',
  'yesterday 表示过去时间，用一般过去时 went。',
  '{"kps": ["grammar.tense.past"]}'
),
-- 题目 4: L3 词汇
(
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  4,
  'We feel ____ to win the match because we are training hard.',
  '["A. lonely", "B. sorry", "C. confident", "D. strange"]',
  'C',
  'confident 意为自信的，符合语境。',
  '{"kps": ["vocab.level3"]}'
),
-- 题目 5: 一般将来时
(
  '10000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  5,
  'I ____ visit my grandparents next week.',
  '["A. am", "B. will", "C. was", "D. have"]',
  'B',
  'next week 表示将来时间，用 will + 动词原形。',
  '{"kps": ["grammar.tense.future"]}'
),
-- 题目 6-10: 更多题目
(
  '10000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  6,
  'She ____ English for three years.',
  '["A. studies", "B. studied", "C. has studied", "D. will study"]',
  'C',
  'for three years 表示持续一段时间，用现在完成时。',
  '{"kps": ["grammar.tense.present"]}'
),
(
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  7,
  'The book ____ by many students.',
  '["A. reads", "B. read", "C. is read", "D. was read"]',
  'C',
  '书被读，用被动语态，一般现在时。',
  '{"kps": ["grammar.passive"]}'
),
(
  '10000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  8,
  'He is ____ in science.',
  '["A. interest", "B. interesting", "C. interested", "D. interests"]',
  'C',
  'be interested in 是固定搭配，表示"对...感兴趣"。',
  '{"kps": ["vocab.level2"]}'
),
(
  '10000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  9,
  'They ____ to the cinema last night.',
  '["A. go", "B. goes", "C. went", "D. going"]',
  'C',
  'last night 表示过去时间，用一般过去时 went。',
  '{"kps": ["grammar.tense.past"]}'
),
(
  '10000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'single_choice',
  10,
  'I will call you when I ____ there.',
  '["A. arrive", "B. arrived", "C. will arrive", "D. am arriving"]',
  'A',
  '主将从现：主句用将来时，when 引导的时间状语从句用一般现在时。',
  '{"kps": ["grammar.tense.future", "grammar.tense.present"]}'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 5. 插入内容-知识边 (Content-Knowledge Edges)
-- ============================================
INSERT INTO content_knowledge_edges (question_id, knowledge_code, weight, dimension) VALUES
-- 题目 1 的知识点
('10000000-0000-0000-0000-000000000001', 'grammar.pronoun.subject', 1.0, 'application'),
-- 题目 2 的知识点
('10000000-0000-0000-0000-000000000002', 'grammar.passive', 1.0, 'application'),
('10000000-0000-0000-0000-000000000002', 'grammar.tense.present', 0.8, 'application'),
-- 题目 3 的知识点
('10000000-0000-0000-0000-000000000003', 'grammar.tense.past', 1.0, 'memory'),
-- 题目 4 的知识点
('10000000-0000-0000-0000-000000000004', 'vocab.level3', 1.0, 'memory'),
-- 题目 5 的知识点
('10000000-0000-0000-0000-000000000005', 'grammar.tense.future', 1.0, 'application'),
-- 题目 6 的知识点
('10000000-0000-0000-0000-000000000006', 'grammar.tense.present', 0.9, 'application'),
-- 题目 7 的知识点
('10000000-0000-0000-0000-000000000007', 'grammar.passive', 1.0, 'application'),
-- 题目 8 的知识点
('10000000-0000-0000-0000-000000000008', 'vocab.level2', 1.0, 'memory'),
-- 题目 9 的知识点
('10000000-0000-0000-0000-000000000009', 'grammar.tense.past', 1.0, 'memory'),
-- 题目 10 的知识点
('10000000-0000-0000-0000-000000000010', 'grammar.tense.future', 0.9, 'application'),
('10000000-0000-0000-0000-000000000010', 'grammar.tense.present', 0.8, 'application')
ON CONFLICT (question_id, knowledge_code) DO NOTHING;

-- ============================================
-- 完成提示
-- ============================================
-- 测试数据已插入完成！
-- 现在你可以：
-- 1. 登录系统
-- 2. 访问 /study 选择试卷进行测试
-- 3. 完成考试后，系统会自动识别错题
-- 4. 访问 /dashboard 生成补短板计划
-- 5. 访问 /review 进行错题重练

