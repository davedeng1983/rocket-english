# 部署指南 (Deployment Guide)

你的 Rocket English 应用已经准备好部署了！推荐使用 **Vercel** 进行一键部署。

## 1. 准备工作

确保你已经：
1. 将代码推送到 GitHub/GitLab/Bitbucket 仓库。
2. 拥有 Supabase 项目的 URL 和 Anon Key。
3. (可选) 拥有 OpenAI 或兼容的 API Key。

## 2. 部署到 Vercel

1. 访问 [Vercel](https://vercel.com) 并登录。
2. 点击 **"Add New..."** -> **"Project"**。
3. 导入你的 Git 仓库。
4. 在 **"Environment Variables"** (环境变量) 部分，添加以下变量：

| 变量名 | 说明 | 示例值 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 公钥 | `eyJhb...` |
| `OPENAI_API_KEY` | (可选) AI 功能密钥 | `sk-...` |
| `OPENAI_BASE_URL` | (可选) AI 代理地址 | `https://api.deepseek.com` |
| `OPENAI_MODEL` | (可选) 模型名称 | `deepseek-chat` |

5. 点击 **"Deploy"**。

## 3. 验证部署

部署完成后，Vercel 会提供一个生产环境 URL (如 `rocket-english.vercel.app`)。

访问该 URL 并进行以下测试：
1. **注册/登录**：验证 Auth 是否正常。
2. **导入试卷**：上传一个 Word 文档测试解析。
3. **生成计划**：验证 AI 是否能正常生成内容。

## 常见问题 (Troubleshooting)

- **构建失败 (Font Error)**: 如果提示无法下载 Google 字体，通常是暂时的网络问题，重试即可。
- **500 Error (Database)**: 检查 Supabase 环境变量是否正确，以及 RLS 策略是否允许操作。
- **AI 生成失败**: 检查 `OPENAI_API_KEY` 是否有效，或者余额是否充足。

