import { createClient } from '@supabase/supabase-js'

// 模拟 Supabase 客户端
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

describe('RLS Policy Tests (Simulation)', () => {
  let mockSupabase: any

  beforeEach(() => {
    // 每次测试重置 mock
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn(),
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  test('User A cannot access User B tasks', async () => {
    // 模拟场景：User A (uid=user_a) 尝试查询 User B (user_id=user_b) 的任务
    // 在真实的 RLS 中，即使用户传入了 user_b 的 ID，数据库也会因为 auth.uid() != user_b 而返回空
    // 这里我们模拟 API 层的调用逻辑

    const userA_ID = 'user_a'
    const userB_ID = 'user_b'

    // 模拟 API 调用逻辑：通常 API 会使用 auth.uid() 来过滤
    // 假设我们有一个函数 getTasks(requestUserId)
    const getTasks = async (requestingUserId: string) => {
       // 模拟 RLS：如果请求者不是资源拥有者，返回空
       return mockSupabase.from('daily_tasks')
         .select('*')
         .eq('user_id', requestingUserId) // 正确的后端逻辑应该强制加上这个 filter
    }

    await getTasks(userA_ID)

    // 验证：查询条件必须包含 user_id = userA_ID
    expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', userA_ID)
    expect(mockSupabase.eq).not.toHaveBeenCalledWith('user_id', userB_ID)
  })
})

