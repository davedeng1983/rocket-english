import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing Supabase environment variables')
    // 返回一个空的或者假的客户端防止报错崩溃，但在控制台输出错误
    // 或者抛出明确的错误
    // throw new Error('Missing Supabase environment variables')
  }

  return createBrowserClient(
    url || '',
    key || ''
  )
}
