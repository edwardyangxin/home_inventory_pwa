import { vi } from 'vitest'

type FetchArgs = [RequestInfo | URL, RequestInit?]

declare global {
  interface SpeechRecognitionMockResultEvent {
    results: Array<Array<{ transcript: string }>>
  }

  interface SpeechRecognitionMockInstance {
    start: () => void
    stop: () => void
    abort: () => void
    lang: string
    continuous: boolean
    interimResults: boolean
    onstart: ((event?: Event) => void) | null
    onend: ((event?: Event) => void) | null
    onerror: ((event?: Event) => void) | null
    onresult: ((event: SpeechRecognitionMockResultEvent) => void) | null
  }

  interface SpeechRecognitionMockConstructor {
    new (): SpeechRecognitionMockInstance
    instances: SpeechRecognitionMockInstance[]
  }

  var SpeechRecognition: SpeechRecognitionMockConstructor | undefined
  var webkitSpeechRecognition: SpeechRecognitionMockConstructor | undefined
}

// Mock Fetch
globalThis.fetch = vi.fn<Promise<Response>, FetchArgs>()

// Mock SpeechRecognition
class MockSpeechRecognition implements SpeechRecognitionMockInstance {
  static instances: SpeechRecognitionMockInstance[] = []

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

globalThis.SpeechRecognition = MockSpeechRecognition
globalThis.webkitSpeechRecognition = MockSpeechRecognition
if (typeof window !== 'undefined') {
  window.SpeechRecognition = MockSpeechRecognition
  window.webkitSpeechRecognition = MockSpeechRecognition
  window.fetch = globalThis.fetch
}
