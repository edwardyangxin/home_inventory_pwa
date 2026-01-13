import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import Home from '../app/page'

const getRecognitionInstance = () => {
  const instances = (global.SpeechRecognition as any).instances
  return instances[instances.length - 1]
}

const MOCK_INVENTORY = [
  { id: '1', name: '现有库存', quantity: 5, unit: '个', category: '测试', location: '位置', expireDate: '2026-01-01', status: 'normal' }
]

const MOCK_HABITS = [
  { name: '早起', type: '生活', details: '6点起床', frequency: '每天', comment: '' }
]

describe('Home Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    global.fetch = vi.fn();
    
    const MockSR = global.SpeechRecognition as any;
    if (MockSR) {
        MockSR.instances = [];
    }
    
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });
  })

  afterEach(() => {
    vi.useRealTimers();
  })

  const runCountdown = async () => {
      await act(async () => {
          vi.advanceTimersByTime(6000);
      });
  }

  it('Flow 1: Inventory Voice Update', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });

    render(<Home />)
    
    // Check initial load
    expect(await screen.findByText('现有库存')).not.toBeNull();

    // 1. Start Recording
    const recordBtn = screen.getByText('开始录音')
    fireEvent.click(recordBtn)
    
    const recognition = getRecognitionInstance()
    
    // 2. Speak
    act(() => {
      recognition.onstart && recognition.onstart()
      recognition.onresult && recognition.onresult({ results: [[{ transcript: '买了两瓶可乐' }]] })
    })
    
    expect(screen.getByDisplayValue('买了两瓶可乐')).not.toBeNull();

    // 3. Stop Recording
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            data: {
                target: 'INVENTORY',
                retrieval: false,
                items: [{ name: '可乐', quantity: 2, unit: '瓶', action: 'ADD' }]
            },
            message: '识别成功'
        })
    });

    await act(async () => {
      recognition.onend && recognition.onend()
    })

    // 4. Verify Countdown
    expect(await screen.findByText(/自动更新/, {}, { timeout: 2000 })).not.toBeNull();

    // Prepare update mocks
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            changes: [],
            items: [{ id: '2', name: '可乐', quantity: 2, unit: '瓶', category: '饮品', location: '冰箱', expireDate: '2026-12-31', status: 'normal' }],
            message: '更新成功'
        })
    });
    
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => [...MOCK_INVENTORY, { id: '2', name: '可乐', quantity: 2 }]
    });

    await runCountdown();

    // 6. Verify Result
    await waitFor(() => {
        expect(screen.queryByText('已更新 1 项物品')).not.toBeNull();
        expect(screen.queryByText('可乐')).not.toBeNull();
    }, { timeout: 3000 });
  })

  it('Flow 2: Habit Voice Update', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });

    render(<Home />)
    expect(await screen.findByText('现有库存')).not.toBeNull();

    // 1. Open Habits Modal
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_HABITS
    })

    const habitsBtn = screen.getByTitle('生活习惯')
    await act(async () => {
        fireEvent.click(habitsBtn)
    })

    expect(await screen.findByText('生活习惯 & 购物清单')).not.toBeNull();

    // 2. Start Recording in Modal
    const modalMicBtn = screen.getByTitle('语音输入')
    fireEvent.click(modalMicBtn)
    
    const recognition = getRecognitionInstance()

    // 3. Speak
    act(() => {
        recognition.onstart && recognition.onstart()
        recognition.onresult && recognition.onresult({ results: [[{ transcript: '多吃蔬菜' }]] })
    })
    
    expect(screen.getByDisplayValue('多吃蔬菜')).not.toBeNull();

    // 4. Stop Recording
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            data: {
                target: 'HABIT',
                retrieval: false,
                items: [{ name: '蔬菜', type: '习惯', details: '多吃' }]
            },
            message: '识别为习惯更新'
        })
    });

    await act(async () => {
        recognition.onend && recognition.onend()
    })

    expect(await screen.findByText(/自动更新/, {}, { timeout: 2000 })).not.toBeNull();

    // Mock Update Habits
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            habits: [...MOCK_HABITS, { name: '蔬菜', type: '习惯' }],
            message: '习惯已更新'
        })
    })

    await runCountdown();
    
    // 7. Verify UI
    await waitFor(async () => {
        expect(screen.queryByText('已更新 2 项习惯')).not.toBeNull();
        expect((await screen.findAllByText('蔬菜')).length).toBeGreaterThanOrEqual(1);
    }, { timeout: 3000 });
  })

  it('Flow 3: Delete Inventory Item', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });
    
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Home />)
    expect(await screen.findByText('现有库存')).not.toBeNull();
    
    // Find delete button (Trash icon)
    const deleteBtns = await screen.findAllByTitle('删除');
    const deleteBtn = deleteBtns[0];
    
    // Mock Delete API
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            message: '已删除物品: 现有库存',
            deleted_id: '1'
        })
    });

    await act(async () => {
        fireEvent.click(deleteBtn);
    });

    // Verify item is removed from UI (or API called)
    await waitFor(() => {
         expect(screen.queryByText('现有库存')).toBeNull();
    });
  })

  it('Flow 4: Edit Inventory Item', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });

    render(<Home />)
    const itemEl = await screen.findByText('现有库存');
    
    // Click item to open modal
    fireEvent.click(itemEl);
    expect(await screen.findByText('✏️ 编辑物品')).not.toBeNull();

    // Mock Edit API
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            message: '已更新物品',
            item: { ...MOCK_INVENTORY[0], name: '更新后的库存', quantity: 99 }
        })
    });

    // Change input
    const nameInput = screen.getByDisplayValue('现有库存');
    fireEvent.change(nameInput, { target: { value: '更新后的库存' } });
    
    // Save
    const saveBtn = screen.getByText('保存');
    await act(async () => {
        fireEvent.click(saveBtn);
    });

    // Verify update
    await waitFor(() => {
        expect(screen.queryByText('更新后的库存')).not.toBeNull();
        expect(screen.queryByText('99')).not.toBeNull();
    });
  })

  it('Flow 5: Meal Plan Recommendation', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });

    render(<Home />)
    await screen.findByText('现有库存');

    // Mock Meal Plan API
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            suggestions: [
                { title: '测试食谱', rationale: '消耗库存', description: '好吃' }
            ],
            summary: '为您推荐'
        })
    });

    const chefBtn = screen.getByTitle('饮食推荐');
    await act(async () => {
        fireEvent.click(chefBtn);
    });

    expect(await screen.findByText('AI 膳食推荐')).not.toBeNull();
    expect(await screen.findByText('测试食谱')).not.toBeNull();
  })

  it('Flow 6: Search Inventory via Voice', async () => {
     (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => MOCK_INVENTORY,
    });

    render(<Home />)
    await screen.findByText('现有库存');

    // Mock Voice Process -> Retrieval
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            data: {
                target: 'INVENTORY',
                retrieval: true,
                items: [{ name: '搜索物品' }]
            },
            message: '正在搜索'
        })
    });

    const transcriptInput = screen.getByPlaceholderText('点击麦克风说话，或直接在此输入...');
    fireEvent.change(transcriptInput, { target: { value: '查找搜索物品' } });
    
    const sendBtn = screen.getByTitle('发送');
    
    // Mock Search API
    (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            success: true,
            results: [
                {
                    query: '搜索物品',
                    matches: [{ id: '99', name: '搜索到的物品', quantity: 1, unit: '个', category: '搜索', location: '位置', expireDate: '2026-01-01', status: 'normal' }]
                }
            ]
        })
    });

    await act(async () => {
        fireEvent.click(sendBtn);
    });

    // Verify Search Results Mode
    expect(await screen.findByText('查询结果')).not.toBeNull();
    expect(await screen.findByText('搜索到的物品')).not.toBeNull();
  })
})
