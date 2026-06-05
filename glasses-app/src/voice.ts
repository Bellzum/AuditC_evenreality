export type VoiceCallback = (text: string) => void

export class VoiceInput {
  private recognition: SpeechRecognition | null = null
  private callback: VoiceCallback
  private active = false
  private supported = false

  constructor(callback: VoiceCallback) {
    this.callback = callback
    const SR = (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition })
      .SpeechRecognition ?? (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition })
      .webkitSpeechRecognition

    if (!SR) {
      console.warn('Web Speech API not available — HTTPS required on non-localhost')
      return
    }

    this.supported = true
    this.recognition = new SR()
    this.recognition.continuous = false
    this.recognition.interimResults = false
    this.recognition.lang = 'en-US'
    this.recognition.maxAlternatives = 1

    this.recognition.onresult = (event) => {
      const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim()
      if (text) this.callback(text)
    }

    this.recognition.onend = () => {
      if (this.active) {
        setTimeout(() => {
          try { this.recognition?.start() } catch {}
        }, 150)
      }
    }

    this.recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      console.error('Speech recognition error:', event.error)
      if (this.active) {
        setTimeout(() => {
          try { this.recognition?.start() } catch {}
        }, 800)
      }
    }
  }

  isSupported(): boolean {
    return this.supported
  }

  start() {
    if (!this.supported) return
    this.active = true
    try { this.recognition?.start() } catch {}
  }

  stop() {
    this.active = false
    try { this.recognition?.stop() } catch {}
  }
}
