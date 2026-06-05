export class VoiceInput {
    constructor(callback) {
        this.recognition = null;
        this.active = false;
        this.supported = false;
        this.callback = callback;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window;
        const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        if (!SR) {
            console.warn('Web Speech API not available — HTTPS required on non-localhost');
            return;
        }
        this.supported = true;
        this.recognition = new SR();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
        this.recognition.onresult = (event) => {
            const text = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            if (text)
                this.callback(text);
        };
        this.recognition.onend = () => {
            if (this.active) {
                setTimeout(() => {
                    try {
                        this.recognition?.start();
                    }
                    catch { }
                }, 150);
            }
        };
        this.recognition.onerror = (event) => {
            if (event.error === 'aborted' || event.error === 'no-speech')
                return;
            console.error('Speech recognition error:', event.error);
            if (this.active) {
                setTimeout(() => {
                    try {
                        this.recognition?.start();
                    }
                    catch { }
                }, 800);
            }
        };
    }
    isSupported() {
        return this.supported;
    }
    start() {
        if (!this.supported)
            return;
        this.active = true;
        try {
            this.recognition?.start();
        }
        catch { }
    }
    stop() {
        this.active = false;
        try {
            this.recognition?.stop();
        }
        catch { }
    }
}
