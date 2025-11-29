# 环境变量配置说明

## 1. Supabase 配置 (必需)

在项目根目录创建 `.env.local` 文件，并添加以下内容：

```env
# Supabase Configuration
# 从 Supabase 项目设置中获取：https://app.supabase.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 获取 Supabase 凭证
1. 访问 https://app.supabase.com
2. 创建新项目或选择现有项目
3. 进入 Project Settings > API
4. 复制 `Project URL` 和 `anon public` key
5. 将值填入 `.env.local` 文件

## 2. AI 模型配置 (可选 - 推荐)

为了启用“智能计划生成”功能，你需要配置 AI 模型。目前代码使用 OpenAI 兼容接口。

### 选项 A: 使用 OpenAI
```env
OPENAI_API_KEY=sk-xxxxxx
OPENAI_MODEL=gpt-3.5-turbo
```

### 选项 B: 使用 Google Gemini (推荐用于测试)
你可以使用 Google AI Studio 获取免费的 API Key。由于 Google 的 API 格式不同，你需要一个兼容 OpenAI 格式的代理，或者直接使用支持 OpenAI 格式的 Gemini 端点（如果可用）。

目前代码支持 `OPENAI_BASE_URL`，你可以使用第三方中转服务（如 OpenRouter, DeepSeek 等）：

```env
# 示例：使用 DeepSeek
OPENAI_API_KEY=sk-xxxxxx
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat

# 示例：使用 OpenRouter (可调用 Gemini Pro)
OPENAI_API_KEY=sk-or-xxxxxx
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=google/gemini-pro
```

> **注意**: 如果未配置 AI 环境变量，系统将回退到使用默认的静态文本模板生成任务。
