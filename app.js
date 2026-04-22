// app.js - SIRI AI WITH ADVANCED ANIMATIONS
class SiriAI {
    constructor() {
        this.config = {
            apiKey: localStorage.getItem('siri_api_key') || '',
            model: localStorage.getItem('siri_model') || 'openai/gpt-oss-120b:free',
            autoSpeak: localStorage.getItem('siri_auto_speak') !== 'false',
            continuous: localStorage.getItem('siri_continuous') === 'true'
        };

        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.isThinking = false;
        this.conversation = [];
        this.vizInterval = null;

        this.init();
    }

    init() {
        // Load settings
        document.getElementById('apiKey').value = this.config.apiKey ? '••••••••••••••••' : '';
        document.getElementById('modelSelect').value = this.config.model;
        
        if (!this.config.autoSpeak) {
            document.getElementById('autoSpeakToggle').classList.remove('active');
        }
        if (this.config.continuous) {
            document.getElementById('continuousToggle').classList.add('active');
        }

        // Init speech
        this.initSpeech();

        // Create particles
        this.createParticles();

        // Welcome
        setTimeout(() => {
            this.speak("Hello, I'm ready. Tap the microphone and ask me anything.");
        }, 500);

        // Scroll handler
        document.getElementById('chatArea').addEventListener('scroll', () => this.handleScroll());
    }

    // ===== PARTICLE SYSTEM =====
    createParticles() {
        const field = document.getElementById('particleField');
        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            
            const angle = (Math.PI * 2 * i) / 20;
            const dist = 80 + Math.random() * 40;
            
            p.style.left = `calc(50% + ${Math.cos(angle) * 20}px)`;
            p.style.top = `calc(50% + ${Math.sin(angle) * 20}px)`;
            p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
            p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
            p.style.setProperty('--bx', `${Math.cos(angle) * 150}px`);
            p.style.setProperty('--by', `${Math.sin(angle) * 150}px`);
            p.style.animationDelay = `${Math.random() * 2}s`;
            p.style.animationDuration = `${2 + Math.random() * 2}s`;
            
            field.appendChild(p);
        }
    }

    // ===== SPEECH RECOGNITION =====
    initSpeech() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.updateStatus('Speech not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = this.config.continuous;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateOrb('listening');
            this.updateStatus('Listening...');
            this.startVisualizer();
            
            document.getElementById('micButton').classList.add('listening');
            document.getElementById('micIcon').className = 'fas fa-stop';
            document.getElementById('micWrap').classList.add('active');
        };

        this.recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(r => r[0].transcript)
                .join('');
            
            document.getElementById('textInput').value = transcript;
            
            if (event.results[0].isFinal && this.config.continuous) {
                this.processInput(transcript);
            }
        };

        this.recognition.onerror = (e) => {
            console.error('Speech error:', e.error);
            this.updateStatus('Error: ' + e.error);
            this.stopListen();
        };

        this.recognition.onend = () => {
            if (!this.config.continuous) {
                const input = document.getElementById('textInput').value.trim();
                if (input && !this.isThinking) {
                    this.processInput(input);
                }
            }
            this.stopListen();
        };
    }

    toggleListen() {
        if (this.isListening) {
            this.stopListen();
        } else {
            this.stopSpeak();
            try {
                this.recognition.start();
            } catch (e) {
                this.updateStatus('Microphone blocked');
            }
        }
    }

    stopListen() {
        this.isListening = false;
        if (this.recognition) this.recognition.stop();
        
        this.stopVisualizer();
        document.getElementById('micButton').classList.remove('listening');
        document.getElementById('micIcon').className = 'fas fa-microphone';
        document.getElementById('micWrap').classList.remove('active');
        
        if (!this.isThinking && !this.isSpeaking) {
            this.updateOrb('idle');
            this.updateStatus('Tap microphone to speak');
        }
    }

    // ===== VISUALIZER =====
    startVisualizer() {
        const bars = document.querySelectorAll('.viz-bar');
        document.getElementById('visualizer').classList.add('active');
        
        this.vizInterval = setInterval(() => {
            bars.forEach(bar => {
                const height = Math.random() * 40 + 4;
                bar.style.height = height + 'px';
            });
        }, 100);
    }

    stopVisualizer() {
        clearInterval(this.vizInterval);
        document.getElementById('visualizer').classList.remove('active');
    }

    // ===== TEXT INPUT =====
    sendText() {
        const input = document.getElementById('textInput').value.trim();
        if (!input) return;
        document.getElementById('textInput').value = '';
        this.processInput(input);
    }

    // ===== PROCESS & RESPOND =====
    async processInput(text) {
        this.stopListen();
        
        this.addMessage('user', text);
        this.conversation.push({ role: 'user', content: text });

        this.isThinking = true;
        this.updateOrb('thinking');
        this.updateStatus('Thinking...');

        try {
            const response = await this.getAIResponse();
            
            this.isThinking = false;
            this.addMessage('ai', response);
            this.conversation.push({ role: 'assistant', content: response });
            
            if (this.config.autoSpeak) {
                this.speak(response);
            } else {
                this.updateOrb('idle');
                this.updateStatus('Tap microphone to speak');
            }

            this.saveConversation();

        } catch (error) {
            this.isThinking = false;
            this.updateStatus('Error occurred');
            this.updateOrb('idle');
            console.error(error);
            this.addMessage('ai', 'Sorry, I encountered an error. Please check your API key.');
        }
    }

    async getAIResponse() {
        if (!this.config.apiKey) throw new Error('No API key');

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.config.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'Siri AI'
            },
            body: JSON.stringify({
                model: this.config.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are Siri, a helpful AI assistant. Be concise, natural, and conversational. Keep responses brief but informative.'
                    },
                    ...this.conversation.slice(-10)
                ],
                stream: false
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message);
        }

        const data = await res.json();
        return data.choices[0]?.message?.content || 'No response';
    }

    // ===== TEXT-TO-SPEECH =====
    speak(text) {
        if (!this.synthesis) return;
        this.stopSpeak();

        const clean = text
            .replace(/```[\s\S]*?```/g, ' code ')
            .replace(/`[^`]+`/g, '$1')
            .replace(/\*\*/g, '').replace(/\*/g, '')
            .replace(/https?:\/\/\S+/g, ' link ')
            .replace(/\n/g, ' ');

        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = 1.1;
        utterance.pitch = 1;
        utterance.volume = 1;

        const voices = this.synthesis.getVoices();
        const voice = voices.find(v => 
            v.name.includes('Samantha') ||
            v.name.includes('Karen') ||
            v.name.includes('Google US English') ||
            (v.lang === 'en-US' && v.name.includes('Female'))
        );
        if (voice) utterance.voice = voice;

        utterance.onstart = () => {
            this.isSpeaking = true;
            this.updateOrb('speaking');
            this.updateStatus('Speaking...');
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            this.updateOrb('idle');
            this.updateStatus('Tap microphone to speak');
            
            if (this.config.continuous && this.recognition) {
                setTimeout(() => this.toggleListen(), 500);
            }
        };

        this.synthesis.speak(utterance);
    }

    stopSpeak() {
        if (this.synthesis) this.synthesis.cancel();
        this.isSpeaking = false;
    }

    // ===== UI =====
    addMessage(role, text) {
        const chat = document.getElementById('chatArea');
        const time = new Date().toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });

        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `
            ${this.formatText(text)}
            <div class="msg-time">${time}</div>
        `;

        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    }

    formatText(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 6px;border-radius:4px;">$1</code>')
            .replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;overflow-x:auto;margin:8px 0;"><code>$1</code></pre>')
            .replace(/\n/g, '<br>');
    }

    updateOrb(state) {
        const orb = document.getElementById('siriOrb');
        orb.className = 'siri-orb';
        if (state !== 'idle') orb.classList.add(state);
    }

    updateStatus(text) {
        const el = document.getElementById('statusText');
        el.textContent = text;
        el.classList.toggle('active', text !== 'Tap microphone to speak');
    }

    handleScroll() {
        const chat = document.getElementById('chatArea');
        const hint = document.getElementById('scrollHint');
        const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 100;
        hint.classList.toggle('visible', !nearBottom);
    }

    scrollToBottom() {
        const chat = document.getElementById('chatArea');
        chat.scrollTop = chat.scrollHeight;
    }

    // ===== SETTINGS =====
    toggleSettings() {
        document.getElementById('settingsModal').classList.toggle('active');
    }

    toggleSetting(key, toggleId) {
        this.config[key] = !this.config[key];
        document.getElementById(toggleId).classList.toggle('active');
    }

    saveSettings() {
        const newKey = document.getElementById('apiKey').value.trim();
        if (newKey && newKey !== '••••••••••••••••') {
            this.config.apiKey = newKey;
            localStorage.setItem('siri_api_key', newKey);
        }
        
        this.config.model = document.getElementById('modelSelect').value;
        
        localStorage.setItem('siri_model', this.config.model);
        localStorage.setItem('siri_auto_speak', this.config.autoSpeak);
        localStorage.setItem('siri_continuous', this.config.continuous);
        
        this.toggleSettings();
        this.updateStatus('Settings saved');
        this.speak('Settings saved');
    }

    saveConversation() {
        localStorage.setItem('siri_chat', JSON.stringify(this.conversation.slice(-20)));
    }
}

// Initialize
const siri = new SiriAI();

// Load voices
if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
        console.log('Voices ready:', window.speechSynthesis.getVoices().length);
    };
}
