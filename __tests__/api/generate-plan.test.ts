import { POST } from '@/app/api/generate-plan/route'
import { NextResponse } from 'next/server'

// Mock 依赖
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))
jest.mock('@/lib/supabase/tasks', () => ({
  getActiveLearningGaps: jest.fn(),
  createDailyTasks: jest.fn(),
}))

// 导入 mock 对象以便设置返回值
import { createClient } from '@/lib/supabase/server'
import { getActiveLearningGaps, createDailyTasks } from '@/lib/supabase/tasks'

describe('Generate Plan API', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
    }
    ;(createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  test('Unauthorized user should receive 401', async () => {
    // 模拟未登录
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const request = new Request('http://localhost/api/generate-plan', {
      method: 'POST',
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  test('User with no gaps should receive empty tasks message', async () => {
    // 模拟登录
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user_123' } },
    })
    // 模拟无漏洞
    ;(getActiveLearningGaps as jest.Mock).mockResolvedValue({
      data: [],
      error: null,
    })

    const request = new Request('http://localhost/api/generate-plan', {
      method: 'POST',
    })
    const response = await POST(request)
    const json = await response.json()

    expect(json.message).toContain('暂无需要补短板的漏洞')
    expect(json.tasks).toEqual([])
  })

  test('User with gaps should generate tasks', async () => {
    // 模拟登录
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user_123' } },
    })
    
    // 模拟有漏洞 (Vocab, Grammar, Logic)
    const mockGaps = [
      { id: 'g1', gap_type: 'vocab', gap_detail: 'word1', questions: { content: 'q1' } },
      { id: 'g2', gap_type: 'grammar', gap_detail: 'grammar1', questions: { content: 'q2' } },
      { id: 'g3', gap_type: 'logic', gap_detail: 'logic1', questions: { content: 'q3' } },
    ]
    ;(getActiveLearningGaps as jest.Mock).mockResolvedValue({
      data: mockGaps,
      error: null,
    })

    // 模拟创建任务成功
    ;(createDailyTasks as jest.Mock).mockResolvedValue({
      data: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
      error: null,
    })

    const request = new Request('http://localhost/api/generate-plan', {
      method: 'POST',
    })
    const response = await POST(request)
    const json = await response.json()

    expect(json.message).toContain('成功生成')
    // 应该调用 createDailyTasks
    expect(createDailyTasks).toHaveBeenCalled()
    
    // 验证调用参数包含 user_id (数据隔离的关键)
    const calledTasks = (createDailyTasks as jest.Mock).mock.calls[0][0]
    expect(calledTasks[0].user_id).toBe('user_123')
    expect(calledTasks.length).toBe(3) // 3个漏洞生成3个任务
  })
})

