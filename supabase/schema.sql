-- =========================================================
-- Rocket English MVP Schema (Scalable Version)
-- 核心理念：一张试卷闭环，字段预留扩展
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- 用于全文搜索

-- ============================================
-- 1. 用户表 (MVP: 简单记录年级和目标)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  full_name TEXT, -- 用户自定义名称
  grade_level TEXT, -- e.g. '初三'
  target_score INTEGER, -- e.g. 115
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. 试卷表 (MVP: 存那张"北京2022真题")
-- ============================================
CREATE TABLE IF NOT EXISTS exam_papers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  
  -- 【扩展预留】音频字段
  -- MVP 阶段可以为空，未来有了听力资源直接填 URL 即可，无需改表
  audio_url TEXT,
  
  -- 【扩展预留】结构图
  -- 存储试卷包含哪些部分 (Section)，方便前端渲染目录
  structure_map JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为试卷表创建索引
CREATE INDEX IF NOT EXISTS idx_exam_papers_title ON exam_papers(title);

-- ============================================
-- 3. 题目表 (MVP: 核心中的核心)
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  paper_id UUID REFERENCES exam_papers(id) ON DELETE CASCADE NOT NULL,
  
  -- 基础字段
  section_type TEXT, -- 'single_choice', 'reading', ...
  order_index INTEGER,
  content TEXT,
  options JSONB,
  correct_answer TEXT,
  analysis TEXT,
  
  -- =====================================================
  -- 关键设计：用 JSONB 预留未来扩展，现在不需要填充数据
  -- =====================================================
  
  -- 【扩展1：多媒体】
  -- MVP 阶段：如果是纯文本题，这里存 null。
  -- 未来扩展：存 {"image": "url...", "audio_segment": "00:15-00:30"}
  assets JSONB,
  
  -- 【扩展2：考情大数据】
  -- MVP 阶段：全存 null，或者填入简单的 {"frequency": 3}。
  -- 未来扩展：接入大数据后，批量更新这个字段，不需要改表结构。
  -- 结构预设：{"frequency": 5, "error_rate": 0.4, "year_appeared": [2020, 2022]}
  stats JSONB,
  
  -- 【扩展3：大师级标签】
  -- MVP 阶段：只需填 "kps" (知识点) 即可跑通逻辑。
  -- 未来扩展：逐步让 AI 补全 trap, l1_interference, strategy 等高级标签。
  -- 结构预设：
  -- {
  --    "kps": ["grammar.tense"],
  --    "trap": ["visual_confusion"],
  --    "l1": true,
  --    "strategy": "elimination"
  -- }
  meta JSONB
);

-- 为题目表创建索引
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_type ON questions(section_type);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(paper_id, order_index);
CREATE INDEX IF NOT EXISTS idx_questions_meta ON questions USING GIN(meta);

-- ============================================
-- 4. 考试记录表 (MVP: 记录周日做题结果)
-- ============================================
CREATE TABLE IF NOT EXISTS user_exam_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  paper_id UUID REFERENCES exam_papers(id) ON DELETE CASCADE NOT NULL,
  score INTEGER,
  user_answers JSONB, -- 记录用户选了什么
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为考试记录表创建索引
CREATE INDEX IF NOT EXISTS idx_attempts_user ON user_exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_paper ON user_exam_attempts(paper_id);
CREATE INDEX IF NOT EXISTS idx_attempts_created_at ON user_exam_attempts(created_at DESC);

-- ============================================
-- 5. 漏洞表 (MVP: 记录错题归因 - 闭环的关键)
-- ============================================
CREATE TABLE IF NOT EXISTS learning_gaps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  
  -- MVP 核心逻辑：记录是哪种类型的漏洞
  gap_type TEXT, -- 'vocab', 'grammar', 'logic'
  
  -- 用户反馈的具体内容
  -- e.g. "不认识单词 ambition" 或 "不懂被动语态"
  gap_detail TEXT,
  
  -- 【扩展预留】根因分析
  -- MVP 阶段：可为空。
  -- 未来扩展：如果题目 meta 里有 trap 信息，这里自动记录 {"hit_trap": "visual_confusion"}
  root_cause JSONB,
  
  status TEXT DEFAULT 'active', -- active(待补), solved(已补)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为漏洞表创建索引
CREATE INDEX IF NOT EXISTS idx_gaps_user ON learning_gaps(user_id);
CREATE INDEX IF NOT EXISTS idx_gaps_question ON learning_gaps(question_id);
CREATE INDEX IF NOT EXISTS idx_gaps_type ON learning_gaps(gap_type);
CREATE INDEX IF NOT EXISTS idx_gaps_status ON learning_gaps(status);
-- 复合索引：查询活跃的漏洞
CREATE INDEX IF NOT EXISTS idx_gaps_user_status ON learning_gaps(user_id, status) WHERE status = 'active';

-- ============================================
-- 6. 每日任务表 (MVP: 生成周中计划)
-- ============================================
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  scheduled_date DATE, -- 哪天做
  task_type TEXT, -- 'vocab_card', 'grammar_video'
  
  -- AI 生成的内容直接存这就行，不要建一堆子表
  content JSONB,
  
  is_completed BOOLEAN DEFAULT false
);

-- 为每日任务表创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_user ON daily_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON daily_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON daily_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON daily_tasks(is_completed);
-- 复合索引：查询某用户某日未完成的任务
CREATE INDEX IF NOT EXISTS idx_tasks_user_date_completed ON daily_tasks(user_id, scheduled_date, is_completed);

-- ============================================
-- 本体论层 (Ontology Layer) - Palantir Inspired
-- ============================================
-- 核心理念：引入"关系(Links)"和"状态流转(Kinetic State)"
-- ============================================

-- ============================================
-- 7. 知识实体表 (Ontology Object: Knowledge Point)
-- ============================================
-- 将原本散落在 questions.meta 里的字符串实体化
CREATE TABLE IF NOT EXISTS knowledge_entities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- e.g. 'grammar.tense.future'
  name TEXT NOT NULL, -- '一般将来时'
  description TEXT,
  
  -- 实体属性 (Properties)
  -- 存难度、重要性、甚至是对应的讲解视频 URL
  properties JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为知识实体表创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_code ON knowledge_entities(code);
CREATE INDEX IF NOT EXISTS idx_knowledge_entities_name ON knowledge_entities(name);

-- ============================================
-- 8. 知识关系表 (Ontology Links: The Graph)
-- ============================================
-- 【核心优化】这是借鉴 Palantir 最重要的一步
-- 它定义了知识点之间的逻辑关系，让 AI 可以进行"因果推理"
CREATE TABLE IF NOT EXISTS knowledge_links (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_code TEXT REFERENCES knowledge_entities(code) ON DELETE CASCADE NOT NULL,
  target_code TEXT REFERENCES knowledge_entities(code) ON DELETE CASCADE NOT NULL,
  
  -- 关系类型 (Link Type)
  -- 'prerequisite': 前置条件 (学 B 必须先学 A)
  -- 'similar_to': 相似混淆 (A 和 B 容易搞混，如 in/on)
  -- 'part_of': 包含关系
  link_type TEXT NOT NULL,
  
  -- 关系强度权重 (0.0 - 1.0)
  weight FLOAT DEFAULT 1.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：同一对实体不能有重复的关系类型
  UNIQUE(source_code, target_code, link_type)
);

-- 为知识关系表创建索引
CREATE INDEX IF NOT EXISTS idx_knowledge_links_source ON knowledge_links(source_code);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_target ON knowledge_links(target_code);
CREATE INDEX IF NOT EXISTS idx_knowledge_links_type ON knowledge_links(link_type);
-- 复合索引：查询某个知识点的所有关系
CREATE INDEX IF NOT EXISTS idx_knowledge_links_source_type ON knowledge_links(source_code, link_type);

-- ============================================
-- 9. 学习事件流 (Ontology Actions: Event Sourcing)
-- ============================================
-- 记录对"漏洞(Gap)"这个对象的所有操作(Actions)
-- 这比简单的 gap_reviews 表更通用
CREATE TABLE IF NOT EXISTS learning_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  gap_id UUID REFERENCES learning_gaps(id) ON DELETE CASCADE NOT NULL,
  
  -- 动作类型 (Action Type)
  -- 'create_gap': 发现漏洞
  -- 'review_gap': 复习
  -- 'master_gap': 标记掌握
  -- 'forget_gap': 再次遗忘 (状态回退)
  action_type TEXT NOT NULL,
  
  -- 动作上下文
  -- 比如：是因为做了 task_id=123 的题触发了这个动作
  context_data JSONB,
  
  -- 动作发生时间
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

-- 为学习事件流表创建索引
CREATE INDEX IF NOT EXISTS idx_learning_actions_user ON learning_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_actions_gap ON learning_actions(gap_id);
CREATE INDEX IF NOT EXISTS idx_learning_actions_type ON learning_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_learning_actions_occurred ON learning_actions(occurred_at DESC);
-- 复合索引：查询某个漏洞的最新动作（用于计算当前状态）
CREATE INDEX IF NOT EXISTS idx_learning_actions_gap_occurred ON learning_actions(gap_id, occurred_at DESC);

-- ============================================
-- 优化 learning_gaps 表 (使其成为 Kinetic Object)
-- ============================================
-- [大师视角]: 我们通过查询 learning_actions 的最新记录来决定 Gap 的当前状态
-- 不需要在 learning_gaps 表中物理添加 computed_state 字段
-- 而是通过视图或函数动态计算状态（Kinetic State）

-- 创建视图：计算每个 Gap 的当前状态（基于最新的 action）
CREATE OR REPLACE VIEW gap_kinetic_states AS
SELECT 
  g.id AS gap_id,
  g.user_id,
  g.question_id,
  g.gap_type,
  g.gap_detail,
  g.status AS base_status,
  g.created_at,
  -- 计算当前状态（基于最新的 action）
  COALESCE(
    CASE latest_action.action_type
      WHEN 'master_gap' THEN 'mastered'
      WHEN 'forget_gap' THEN 'forgotten'
      WHEN 'review_gap' THEN 'reviewing'
      ELSE 'active'
    END,
    'active'
  ) AS computed_state,
  latest_action.action_type AS last_action_type,
  latest_action.occurred_at AS last_action_time
FROM learning_gaps g
LEFT JOIN LATERAL (
  SELECT action_type, occurred_at
  FROM learning_actions
  WHERE gap_id = g.id
  ORDER BY occurred_at DESC
  LIMIT 1
) latest_action ON true;

-- 为视图创建索引（通过物化视图或函数索引优化查询性能）
-- 注意：PostgreSQL 不支持直接为视图创建索引，但可以通过物化视图实现
-- 这里先创建视图，后续可以根据需要改为物化视图

-- ============================================
-- Master Layer (大师层) - Ontology Optimization
-- ============================================
-- 核心目标：
-- 1. 显性化 "题目-知识点" 关系 (Edge Materialization)
-- 2. 构建 "学生数字孪生" (Digital Twin)
-- 3. 固化 "行动物理法则" (Action Physics)
-- ============================================

-- ============================================
-- 10. 内容-知识图谱边表 (Content-Knowledge Edges)
-- ============================================
-- [大师视角]: 不要把关系藏在 JSONB 里。将 "题目(Object)" 和 "知识点(Object)"
-- 的关系显性化，才能支持高效的图算法推荐。
CREATE TABLE IF NOT EXISTS content_knowledge_edges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- "源"对象：题目
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  
  -- "目标"对象：知识实体
  knowledge_code TEXT REFERENCES knowledge_entities(code) ON DELETE CASCADE NOT NULL,
  
  -- 边的属性：这道题对这个知识点的考察程度
  -- weight: 0.1 (只是沾边) - 1.0 (核心考点)
  weight FLOAT DEFAULT 1.0,
  
  -- 边的属性：考察维度 (Cognitive Dimension)
  -- e.g., 'application', 'memory'
  dimension TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 唯一约束：一道题对一个知识点只有一条边
  UNIQUE(question_id, knowledge_code)
);

-- 建立索引，让 "查某个知识点的所有题" 飞快
CREATE INDEX IF NOT EXISTS idx_edges_k_to_q ON content_knowledge_edges(knowledge_code, question_id);
CREATE INDEX IF NOT EXISTS idx_edges_q_to_k ON content_knowledge_edges(question_id, knowledge_code);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON content_knowledge_edges(weight);

-- ============================================
-- 11. 学生知识状态孪生表 (Student Knowledge State / Digital Twin)
-- ============================================
-- [大师视角]: Learning Gaps 只是 "工单"。我们需要一张表来实时反映
-- 学生大脑中对每一个知识点的掌握情况 (热力图)。
-- 这是 AI 推荐算法最直接的查询来源，而不是去翻几千条做题记录。
CREATE TABLE IF NOT EXISTS student_knowledge_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- 对应知识图谱中的实体
  knowledge_code TEXT REFERENCES knowledge_entities(code) ON DELETE CASCADE NOT NULL,
  
  -- 当前掌握度 (0-100)
  mastery_score FLOAT DEFAULT 0.0,
  
  -- 置信度 (Confidence): 0.0 - 1.0
  -- 如果学生只做了一道题，置信度很低；做了10道题，置信度高。
  confidence_level FLOAT DEFAULT 0.0,
  
  -- 最后一次交互时间 (用于艾宾浩斯遗忘衰减)
  last_interaction_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 状态快照
  -- 'unexplored' (未探索), 'struggling' (挣扎), 'mastered' (掌握)
  status TEXT DEFAULT 'unexplored',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 约束：一个学生对一个知识点只有一条状态记录
  UNIQUE(user_id, knowledge_code)
);

-- 为学生知识状态表创建索引
CREATE INDEX IF NOT EXISTS idx_states_user ON student_knowledge_states(user_id);
CREATE INDEX IF NOT EXISTS idx_states_knowledge ON student_knowledge_states(knowledge_code);
CREATE INDEX IF NOT EXISTS idx_states_status ON student_knowledge_states(status);
CREATE INDEX IF NOT EXISTS idx_states_mastery ON student_knowledge_states(mastery_score);
-- 复合索引：查询某用户需要复习的知识点（掌握度低且最近有交互）
CREATE INDEX IF NOT EXISTS idx_states_user_mastery_interaction ON student_knowledge_states(user_id, mastery_score, last_interaction_at);

-- ============================================
-- 物理法则：自动同步触发器 (Action Physics)
-- ============================================
-- [大师视角]: Ontology 是活的。当 learning_actions 发生时 (比如 'master_gap')，
-- 它必须自动更新 student_knowledge_states。不能依赖应用层代码去同步，
-- 必须在数据库层保证数据一致性。

-- 定义函数：当漏洞状态变更时，自动更新知识孪生状态
CREATE OR REPLACE FUNCTION update_student_knowledge_state()
RETURNS TRIGGER AS $$
DECLARE
  v_knowledge_code TEXT;
BEGIN
  -- 场景：当用户产生一个新的 learning_gap (gap_type='grammar')
  IF (TG_OP = 'INSERT') THEN
    -- 找到这个 gap 对应的知识点（通过 content_knowledge_edges 关联）
    SELECT knowledge_code INTO v_knowledge_code
    FROM content_knowledge_edges
    WHERE question_id = NEW.question_id
    LIMIT 1;
    
    -- 如果找到了对应的知识点，更新学生知识状态
    IF v_knowledge_code IS NOT NULL THEN
      INSERT INTO student_knowledge_states (
        user_id,
        knowledge_code,
        mastery_score,
        confidence_level,
        status,
        last_interaction_at,
        updated_at
      )
      VALUES (
        NEW.user_id,
        v_knowledge_code,
        GREATEST(0.0, (SELECT COALESCE(mastery_score, 50.0) FROM student_knowledge_states 
                      WHERE user_id = NEW.user_id AND knowledge_code = v_knowledge_code) - 10.0),
        0.3, -- 发现漏洞，置信度降低
        'struggling',
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id, knowledge_code) DO UPDATE SET
        mastery_score = GREATEST(0.0, student_knowledge_states.mastery_score - 10.0),
        confidence_level = LEAST(1.0, student_knowledge_states.confidence_level + 0.1),
        status = 'struggling',
        last_interaction_at = NOW(),
        updated_at = NOW();
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器：当创建新的 learning_gap 时，自动更新知识状态
CREATE TRIGGER on_gap_created
  AFTER INSERT ON learning_gaps
  FOR EACH ROW
  EXECUTE FUNCTION update_student_knowledge_state();

-- 定义函数：当学习动作发生时，更新知识状态
CREATE OR REPLACE FUNCTION update_knowledge_state_from_action()
RETURNS TRIGGER AS $$
DECLARE
  v_gap_type TEXT;
  v_knowledge_code TEXT;
  v_score_delta FLOAT;
BEGIN
  -- 获取 gap 的信息
  SELECT gap_type, 
         (SELECT knowledge_code FROM content_knowledge_edges 
          WHERE question_id = (SELECT question_id FROM learning_gaps WHERE id = NEW.gap_id) LIMIT 1)
  INTO v_gap_type, v_knowledge_code
  FROM learning_gaps
  WHERE id = NEW.gap_id;
  
  IF v_knowledge_code IS NOT NULL THEN
    -- 根据动作类型计算分数变化
    CASE NEW.action_type
      WHEN 'master_gap' THEN
        v_score_delta := 20.0;
      WHEN 'review_gap' THEN
        v_score_delta := 5.0;
      WHEN 'forget_gap' THEN
        v_score_delta := -15.0;
      ELSE
        v_score_delta := 0.0;
    END CASE;
    
    -- 更新或插入学生知识状态
    INSERT INTO student_knowledge_states (
      user_id,
      knowledge_code,
      mastery_score,
      confidence_level,
      status,
      last_interaction_at,
      updated_at
    )
    VALUES (
      NEW.user_id,
      v_knowledge_code,
      LEAST(100.0, GREATEST(0.0, COALESCE((SELECT mastery_score FROM student_knowledge_states 
                                           WHERE user_id = NEW.user_id AND knowledge_code = v_knowledge_code), 50.0) + v_score_delta)),
      LEAST(1.0, COALESCE((SELECT confidence_level FROM student_knowledge_states 
                          WHERE user_id = NEW.user_id AND knowledge_code = v_knowledge_code), 0.5) + 0.1),
      CASE 
        WHEN v_score_delta > 0 AND COALESCE((SELECT mastery_score FROM student_knowledge_states 
                                           WHERE user_id = NEW.user_id AND knowledge_code = v_knowledge_code), 0) + v_score_delta >= 80 THEN 'mastered'
        WHEN v_score_delta < 0 THEN 'struggling'
        ELSE 'unexplored'
      END,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id, knowledge_code) DO UPDATE SET
      mastery_score = LEAST(100.0, GREATEST(0.0, student_knowledge_states.mastery_score + v_score_delta)),
      confidence_level = LEAST(1.0, student_knowledge_states.confidence_level + 0.1),
      status = CASE 
        WHEN student_knowledge_states.mastery_score + v_score_delta >= 80 THEN 'mastered'
        WHEN student_knowledge_states.mastery_score + v_score_delta < 40 THEN 'struggling'
        ELSE student_knowledge_states.status
      END,
      last_interaction_at = NOW(),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 绑定触发器：当学习动作发生时，自动更新知识状态
CREATE TRIGGER on_action_occurred
  AFTER INSERT ON learning_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_state_from_action();

-- ============================================
-- 学习路径推荐视图 (The Ontology View)
-- ============================================
-- [大师视角]: 最终，我们需要给前端一个"上帝视角"。
-- 结合 知识图谱(Links) + 学生状态(Twin) + 题目(Content)
-- 直接算出：由于A知识点是B的前置，且学生A掌握了，B没掌握，所以推B的题。
CREATE OR REPLACE VIEW recommended_next_steps AS
SELECT 
  s.user_id,
  target_entity.code AS recommended_concept, -- 推荐学的下一个知识点
  target_entity.name AS concept_name,
  s.mastery_score AS current_score,
  target_state.mastery_score AS target_score,
  link.link_type AS reason,
  link.weight AS link_weight
FROM student_knowledge_states s
JOIN knowledge_links link ON s.knowledge_code = link.source_code
JOIN knowledge_entities target_entity ON link.target_code = target_entity.code
LEFT JOIN student_knowledge_states target_state 
  ON target_state.user_id = s.user_id 
  AND target_state.knowledge_code = target_entity.code
WHERE 
  s.mastery_score > 80 -- 前置知识点已掌握
  AND link.link_type = 'prerequisite' -- 且它是前置条件
  -- 排除掉已经掌握的目标知识点
  AND (target_state.mastery_score IS NULL OR target_state.mastery_score < 60)
  AND s.status != 'unexplored';

-- ============================================
-- Row Level Security (RLS) 安全策略
-- ============================================
-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_knowledge_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_knowledge_states ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Profiles 策略
-- ============================================
-- 用户只能访问自己的档案
CREATE POLICY "User access own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- ============================================
-- Exam Papers 策略
-- ============================================
-- 试卷是公开可读的
CREATE POLICY "Public read papers"
  ON exam_papers FOR SELECT
  USING (true);

-- ============================================
-- Questions 策略
-- ============================================
-- 题目是公开可读的
CREATE POLICY "Public read questions"
  ON questions FOR SELECT
  USING (true);

-- ============================================
-- User Exam Attempts 策略
-- ============================================
-- 用户只能访问自己的考试记录
CREATE POLICY "User access own attempts"
  ON user_exam_attempts FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- Learning Gaps 策略
-- ============================================
-- 用户只能访问自己的学习漏洞
CREATE POLICY "User access own gaps"
  ON learning_gaps FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- Daily Tasks 策略
-- ============================================
-- 用户只能访问自己的每日任务
CREATE POLICY "User access own tasks"
  ON daily_tasks FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- Knowledge Entities 策略
-- ============================================
-- 知识实体是公开可读的（所有认证用户）
CREATE POLICY "Public read entities"
  ON knowledge_entities FOR SELECT
  USING (true);

-- ============================================
-- Knowledge Links 策略
-- ============================================
-- 知识关系是公开可读的（所有认证用户）
CREATE POLICY "Public read links"
  ON knowledge_links FOR SELECT
  USING (true);

-- ============================================
-- Learning Actions 策略
-- ============================================
-- 用户只能访问自己的学习动作
CREATE POLICY "User own actions"
  ON learning_actions FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- Gap Kinetic States 视图策略
-- ============================================
-- 用户只能查看自己的 Gap 状态
-- 注意：视图的 RLS 策略需要通过底层表的策略来实现
-- 由于 gap_kinetic_states 基于 learning_gaps，会自动继承其 RLS 策略

-- ============================================
-- Content Knowledge Edges 策略
-- ============================================
-- 内容-知识边是公开可读的（所有认证用户）
CREATE POLICY "Public read edges"
  ON content_knowledge_edges FOR SELECT
  USING (true);

-- ============================================
-- Student Knowledge States 策略
-- ============================================
-- 用户只能访问自己的知识状态
CREATE POLICY "User own knowledge state"
  ON student_knowledge_states FOR ALL
  USING (auth.uid() = user_id);
