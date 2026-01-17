import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest'
import Home from '../app/page'

const jsonResponse = <T,>(data: T, ok = true): Response =>
  ({
    ok,
    json: async () => data,
  } as Response)

const getFetchMock = () => vi.mocked(globalThis.fetch)

const getRecognitionInstance = (): SpeechRecognitionMockInstance => {
  const instances = globalThis.SpeechRecognition?.instances ?? []
  const instance = instances[instances.length - 1]
  if (!instance) {
    throw new Error('SpeechRecognition instance not created')
  }
  return instance
}

const MOCK_INVENTORY = [
  { id: '1', name: '现有库存', quantity: 5, unit: '个', category: '测试', location: '位置', expireDate: '2026-01-01', status: 'normal' }
]

const MOCK_HABITS = [
  { name: '早起', type: '生活', details: '6点起床', frequency: '每天', comment: '' }
]

const MOCK_SUGGESTIONS = [
  {
    id: 's1',
    title: '语音识别结果不稳定',
    category: 'bug',
    details: '连续输入时偶发丢字，导致库存数量不准确。',
    status: 'open',
    count: 2,
    source_text: '刚刚说了两遍，还是识别不准，数量都错了。',
    merged_from: '["识别不准"]',
    created_at: '2024-06-01T12:34:56.000Z',
    updated_at: '2024-06-02T09:10:11.000Z',
  },
]

describe('Home Page Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(MOCK_INVENTORY))

    const speechRecognition = globalThis.SpeechRecognition
    if (speechRecognition) {
      speechRecognition.instances = []
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const runCountdown = async () => {
    await act(async () => {
      vi.advanceTimersByTime(6000)
    })
  }

  it('Flow 1: Inventory Voice Update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))

    try {
      render(<Home />)

      // Check initial load
      expect(await screen.findByText('现有库存')).not.toBeNull()

      // 1. Start Recording
      const recordBtn = screen.getByText('开始录音')
      fireEvent.click(recordBtn)

      const recognition = getRecognitionInstance()

      // 2. Speak
      act(() => {
        if (recognition.onstart) {
          recognition.onstart()
        }
        if (recognition.onresult) {
          recognition.onresult({ results: [[{ transcript: '买了两瓶可乐' }]] })
        }
      })

      expect(screen.getByDisplayValue('买了两瓶可乐')).not.toBeNull()

      // 3. Stop Recording
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            target: 'INVENTORY',
            retrieval: false,
            items: [{ name: '可乐', quantity: 2, unit: '瓶', action: 'ADD' }],
          },
          message: '识别成功',
        })
      )

      await act(async () => {
        if (recognition.onend) {
          recognition.onend()
        }
      })

      // 4. Verify Countdown
      expect(await screen.findByText(/自动更新/, {}, { timeout: 2000 })).not.toBeNull()

      // Prepare update mocks
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          changes: [],
          items: [
            {
              id: '2',
              name: '可乐',
              quantity: 2,
              unit: '瓶',
              category: '饮品',
              location: '冰箱',
              expireDate: '2026-12-31',
              status: 'normal',
            },
          ],
          message: '更新成功',
        })
      )

      fetchMock.mockResolvedValueOnce(
        jsonResponse([...MOCK_INVENTORY, { id: '2', name: '可乐', quantity: 2 }])
      )

      await runCountdown()

      // 6. Verify Result
      await waitFor(
        () => {
          expect(screen.queryAllByText(/更新成功|已更新/).length).toBeGreaterThan(0)
          expect(screen.queryByText('可乐')).not.toBeNull()
        },
        { timeout: 3000 }
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('Flow 2: Habit Voice Update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))

    try {
      render(<Home />)
      expect(await screen.findByText('现有库存')).not.toBeNull()

      // 1. Start Recording
      const recordBtn = screen.getByText('开始录音')
      fireEvent.click(recordBtn)

      const recognition = getRecognitionInstance()

      // 2. Speak
      act(() => {
        if (recognition.onstart) {
          recognition.onstart()
        }
        if (recognition.onresult) {
          recognition.onresult({ results: [[{ transcript: '多吃蔬菜' }]] })
        }
      })

      expect(screen.getByDisplayValue('多吃蔬菜')).not.toBeNull()

      // 4. Stop Recording
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            target: 'HABIT',
            retrieval: false,
            items: [{ name: '蔬菜', type: '习惯', details: '多吃' }],
          },
          message: '识别为习惯更新',
        })
      )

      await act(async () => {
        if (recognition.onend) {
          recognition.onend()
        }
      })

      expect(await screen.findByText(/自动更新/, {}, { timeout: 2000 })).not.toBeNull()

      // Mock Update Habits
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          success: true,
          habits: [...MOCK_HABITS, { name: '蔬菜', type: '习惯', details: '多吃', frequency: '经常', comment: '' }],
          message: '习惯已更新',
        })
      )

      await runCountdown()

      // 7. Verify UI
      await waitFor(
        async () => {
          expect(screen.queryByText('习惯已更新')).not.toBeNull()
          expect((await screen.findAllByText('蔬菜')).length).toBeGreaterThanOrEqual(1)
        },
        { timeout: 3000 }
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('Flow 3: Delete Inventory Item', async () => {
    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(MOCK_INVENTORY))
    
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Home />)
    expect(await screen.findByText('现有库存')).not.toBeNull();
    
    // Find delete button (Trash icon)
    const deleteBtns = await screen.findAllByTitle('删除');
    const deleteBtn = deleteBtns[0];
    
    // Mock Delete API
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: '已删除物品: 现有库存',
        deleted_id: '1',
      })
    )

    await act(async () => {
        fireEvent.click(deleteBtn);
    });

    // Verify item is removed from UI (or API called)
    await waitFor(() => {
         expect(screen.queryByText('现有库存')).toBeNull();
    });
  })

  it('Flow 4: Edit Inventory Item', async () => {
    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(MOCK_INVENTORY))

    render(<Home />)
    const itemEl = await screen.findByText('现有库存');
    
    // Click item to open modal
    fireEvent.click(itemEl);
    expect(await screen.findByText('✏️ 编辑物品')).not.toBeNull();

    // Mock Edit API
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: '已更新物品',
        item: { ...MOCK_INVENTORY[0], name: '更新后的库存', quantity: 99 },
      })
    )

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
    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(MOCK_INVENTORY))

    render(<Home />)
    await screen.findByText('现有库存');

    // Mock Meal Plan API
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        suggestions: [
          {
            day: '今天',
            date: '2026-01-17',
            meal: '早餐',
            title: '测试食谱',
            rationale: '消耗库存',
            description: '好吃',
          },
        ],
        summary: '为您推荐',
      })
    )

    const chefBtn = screen.getByTitle('饮食推荐');
    await act(async () => {
        fireEvent.click(chefBtn);
    });

    expect(await screen.findByText('AI 膳食推荐')).not.toBeNull();
    expect(await screen.findByText('测试食谱')).not.toBeNull();
  })

  it('Flow 6: Search Inventory via Voice', async () => {
    const fetchMock = getFetchMock()
    fetchMock.mockResolvedValue(jsonResponse(MOCK_INVENTORY))

    render(<Home />)
    await screen.findByText('现有库存');

    // Mock Voice Process -> Retrieval
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        data: {
          target: 'INVENTORY',
          retrieval: true,
          items: [{ name: '搜索物品' }],
        },
        message: '正在搜索',
      })
    )

    const transcriptInput = screen.getByPlaceholderText('点击麦克风说话，或直接在此输入...');
    fireEvent.change(transcriptInput, { target: { value: '查找搜索物品' } });
    
    const sendBtn = screen.getByTitle('发送');
    
    // Mock Search API
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        results: [
          {
            query: '搜索物品',
            matches: [
              {
                id: '99',
                name: '搜索到的物品',
                quantity: 1,
                unit: '个',
                category: '搜索',
                location: '位置',
                expireDate: '2026-01-01',
                status: 'normal',
              },
            ],
          },
        ],
      })
    )

    await act(async () => {
        fireEvent.click(sendBtn);
    });

    // Verify Search Results Mode
    expect(await screen.findByText('查询结果')).not.toBeNull();
    expect(await screen.findByText('搜索到的物品')).not.toBeNull();
  })

  it('Flow 7: Weekly Purchase Recommendation', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          suggestions: [
            {
              name: '鸡蛋',
              suggested_quantity: 12,
              unit: '个',
              reason: '常备必需品，且曾经购买过，现在库存为0',
              current_stock: { quantity: 0, unit: '个' },
              last_purchase_at: '2024-06-01T12:34:56.000Z',
            },
          ],
        })
      )

    render(<Home />)
    await screen.findByText('现有库存')

    const weeklyBtn = screen.getByTitle('本周采购')
    await act(async () => {
      fireEvent.click(weeklyBtn)
    })

    expect(await screen.findByText('本周采购推荐')).not.toBeNull()
    expect(await screen.findByText('鸡蛋')).not.toBeNull()
    expect(await screen.findByText('建议购买 12个')).not.toBeNull()
    expect(await screen.findByText('当前库存: 0个')).not.toBeNull()
    expect(await screen.findByText('最近购买: 2024-06-01')).not.toBeNull()
  })

  it('Flow 8: Delete Habit', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
    vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<Home />)

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '生活习惯' }));
    });
    expect(await screen.findByText('早起')).not.toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true, message: '已删除习惯' }))

    // In modal, find delete button. We use findAllByTitle and take the one that's likely the habit one
    const deleteBtns = screen.getAllByTitle('删除');
    const habitDeleteBtn = deleteBtns[0];

    await act(async () => {
        fireEvent.click(habitDeleteBtn);
    });

    await waitFor(() => {
        expect(screen.queryByText('早起')).toBeNull();
    });
  })

  it('Flow 9: Edit Habit', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))

    render(<Home />)

    await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '生活习惯' }));
    });
    await screen.findByText('早起');

    await act(async () => {
        fireEvent.click(screen.getByText('早起'));
    });
    expect(await screen.findByText('✏️ 编辑习惯/清单')).not.toBeNull();

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        habit: { ...MOCK_HABITS[0], name: '晚起', details: '10点起床' },
      })
    )

    fireEvent.change(screen.getByDisplayValue('早起'), { target: { value: '晚起' } });

    await act(async () => {
        fireEvent.click(screen.getByText('保存'));
    });

    await waitFor(() => {
        expect(screen.queryByText('晚起')).not.toBeNull();
        expect(screen.queryByText('10点起床')).not.toBeNull();
    });
  })

  it('Flow 10: View Suggestions', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
      .mockResolvedValueOnce(jsonResponse(MOCK_SUGGESTIONS))

    render(<Home />)
    await screen.findByText('现有库存')

    const suggestionsBtn = screen.getByTitle('Suggestions')
    await act(async () => {
      fireEvent.click(suggestionsBtn)
    })

    expect(await screen.findByText('Suggestions 清单')).not.toBeNull()
    expect(await screen.findByText('语音识别结果不稳定')).not.toBeNull()
    expect(await screen.findByText('Count: 2')).not.toBeNull()
  })

  it('Flow 11: Delete Suggestion', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
      .mockResolvedValueOnce(jsonResponse(MOCK_SUGGESTIONS))

    vi.spyOn(window, 'confirm').mockImplementation(() => true)

    render(<Home />)
    await screen.findByText('现有库存')

    const suggestionsBtn = screen.getByTitle('Suggestions')
    await act(async () => {
      fireEvent.click(suggestionsBtn)
    })

    expect(await screen.findByText('语音识别结果不稳定')).not.toBeNull()

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, message: '已删除建议', deleted_id: 's1' })
    )

    const deleteBtn = screen.getByTitle('删除建议')
    await act(async () => {
      fireEvent.click(deleteBtn)
    })

    await waitFor(() => {
      expect(screen.queryByText('语音识别结果不稳定')).toBeNull()
    })
  })

  it('Flow 12: Receipt Upload Auto Update', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          changes: [
            { type: 'ADD', name: '华夫饼', desc: '新增物品: 1 盒', expire_date: null },
          ],
          items: [
            {
              id: '2',
              name: '华夫饼',
              quantity: 1,
              unit: '盒',
              category: '冷冻',
              location: '冰箱',
              expireDate: null,
              status: 'normal',
              comment: '',
            },
          ],
          receipt_items: [
            { name: 'Eggo 华夫饼', quantity: 1, unit: '盒', action: 'ADD', comment: '' },
          ],
          message: '处理完成',
        })
      )
      .mockResolvedValueOnce(jsonResponse([...MOCK_INVENTORY, { id: '2', name: '华夫饼', quantity: 1, unit: '盒' }]))

    try {
      render(<Home />)
      await screen.findByText('现有库存')

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' })

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } })
      })

      expect(await screen.findByText('小票识别')).not.toBeNull()
      expect(await screen.findByText('Eggo 华夫饼')).not.toBeNull()
      expect(await screen.findByText(/自动更新/)).not.toBeNull()

      await runCountdown()

      await waitFor(() => {
        expect(screen.queryAllByText(/处理完成|已更新/).length).toBeGreaterThan(0)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('Flow 13: Main Input Suggestion Updates List', async () => {
    const fetchMock = getFetchMock()
    fetchMock
      .mockResolvedValueOnce(jsonResponse(MOCK_INVENTORY))
      .mockResolvedValueOnce(jsonResponse(MOCK_HABITS))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            target: 'SUGGESTION',
            retrieval: false,
            items: [],
          },
          message: '识别为建议',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          message: 'Suggestions updated successfully',
          suggestions: [
            {
              id: 's2',
              title: '离线模式体验',
              category: 'improvement',
              details: '希望在无网时也能记录',
              status: 'open',
              count: 1,
              source_text: '希望离线也能记录',
              merged_from: '[]',
              created_at: '2024-06-10T12:00:00.000Z',
              updated_at: '2024-06-10T12:00:00.000Z',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: 's2',
            title: '离线模式体验',
            category: 'improvement',
            details: '希望在无网时也能记录',
            status: 'open',
            count: 1,
            source_text: '希望离线也能记录',
            merged_from: '[]',
            created_at: '2024-06-10T12:00:00.000Z',
            updated_at: '2024-06-10T12:00:00.000Z',
          },
        ])
      )

    render(<Home />)
    await screen.findByText('现有库存')

    const transcriptInput = screen.getByPlaceholderText('点击麦克风说话，或直接在此输入...')
    fireEvent.change(transcriptInput, { target: { value: '希望离线也能记录' } })

    const sendBtn = screen.getByTitle('发送')
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(await screen.findByText('建议已更新')).not.toBeNull()

    const suggestionsBtn = screen.getByTitle('Suggestions')
    await act(async () => {
      fireEvent.click(suggestionsBtn)
    })

    expect(await screen.findByText('离线模式体验')).not.toBeNull()
  })
})
