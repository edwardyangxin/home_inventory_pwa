import { vi } from 'vitest'

// Mock Fetch
global.fetch = vi.fn()

// Mock SpeechRecognition
class MockSpeechRecognition {
  static instances: MockSpeechRecognition[] = []

  start = vi.fn()
  stop = vi.fn()
  abort = vi.fn()
  lang = ''
  continuous = false
  interimResults = false
  onstart = null
  onend = null
  onerror = null
  onresult = null

  constructor() {
    MockSpeechRecognition.instances.push(this)
  }
}

global.SpeechRecognition = MockSpeechRecognition as any
global.webkitSpeechRecognition = MockSpeechRecognition as any