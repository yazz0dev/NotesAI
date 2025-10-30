import voiceCommands from './voice-commands.js';

class CommandService {
  constructor() {
    this.ambientRecognition = null;
    this.activeRecognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isAmbientListening = false;
    this.isActive = false;
    this.currentMode = 'command';
    // NEW: Track last command to prevent rapid-fire duplicates
    this.lastCommand = null;
    this.lastCommandTime = 0;
  }

  init() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported.");
      this.dispatchEvent("command-status-update", { status: "disabled", message: "Speech not supported" });
      return false;
    }
    this.setupAmbientRecognition(SpeechRecognition);
    this.dispatchEvent("command-status-update", { status: "ready", message: "Voice commands ready" });
    return true;
  }

  setupAmbientRecognition(SpeechRecognition) {
    this.ambientRecognition = new SpeechRecognition();
    this.ambientRecognition.continuous = true;
    this.ambientRecognition.interimResults = false;
    this.ambientRecognition.lang = 'en-US';
    this.ambientRecognition.maxAlternatives = 1;

    this.ambientRecognition.onstart = () => {
      this.isAmbientListening = true;
      this.dispatchEvent("command-status-update", { status: "listening", message: "Listening for 'Hey Notes'..." });
    };

    this.ambientRecognition.onend = () => {
      this.isAmbientListening = false;
      if (localStorage.getItem("handsFreeMode") === "true" && !this.isActive) {
        setTimeout(() => this.startAmbientListening(), 500);
      }
    };

    this.ambientRecognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'audio-capture') {
        console.error("Ambient recognition error:", e.error);
      }
    };

    this.ambientRecognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (transcript.includes("hey notes")) {
        this.processTranscript(transcript, 'command');
      }
    };
  }

  startAmbientListening() {
    if (this.ambientRecognition && !this.isAmbientListening && !this.isActive) {
      try { this.ambientRecognition.start(); } catch (e) { console.warn("Failed to start ambient listening:", e); }
    }
  }

  stopAmbientListening() {
    if (this.ambientRecognition && this.isAmbientListening) {
      this.ambientRecognition.stop();
    }
  }

  async startListening({ mode = 'command' }) {
    if (this.isActive) {
        // If we are switching modes, we might need to restart.
        if (this.currentMode !== mode) {
             this.stopListening();
             // Allow a tiny setImmediate-like pause for cleanup before restarting
             await new Promise(resolve => setTimeout(resolve, 50));
        } else {
             return;
        }
    }
    
    this.stopAmbientListening();
    this.currentMode = mode;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.dispatchEvent("command-error", { message: "Speech recognition not supported" });
      return;
    }

    try {
      let stream;
      if (mode === 'dictation') {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
        this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
      }

      this.activeRecognition = new SpeechRecognition();
      this.activeRecognition.continuous = true;
      this.activeRecognition.interimResults = true;

      this.activeRecognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = (finalTranscript + interimTranscript).trim();
        if (currentText) {
          this.dispatchEvent("command-status-update", { status: "recording", message: `"${currentText}"` });
        }

        if (mode === 'dictation' && interimTranscript) {
          this.dispatchEvent("dictation-update", { transcript: interimTranscript });
        }

        if (finalTranscript) {
          const processed = this.processTranscript(finalTranscript.trim(), mode);
          if (!processed && mode === 'dictation') {
            this.dispatchEvent("dictation-finalized", { transcript: finalTranscript.trim() });
          }
        }
      };

      this.activeRecognition.onstart = () => {
        this.isActive = true;
        this.dispatchEvent("listening-started", { mode });
        this.dispatchEvent("command-status-update", {
          status: "recording",
          message: mode === 'dictation' ? "Dictating..." : "Listening for command..."
        });
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.mediaRecorder.start();
        }
      };

      this.activeRecognition.onend = () => {
        // If we are supposed to be active but stopped unexpectedly, try to restart
        // UNLESS we manually stopped it (isActive would be false then)
        if (this.isActive) {
             // Simple auto-restart for continuous listening
             try { this.activeRecognition.start(); } catch(e) { /* ignore if already started */ }
             return;
        }

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
            const audioDataUrl = await this.blobToDataURL(audioBlob);
            this.dispatchEvent("listening-finished", { mode: 'dictation', audioUrl: audioDataUrl });
            stream?.getTracks().forEach((track) => track.stop());
            this.cleanupActiveSession();
          };
          this.mediaRecorder.stop();
        } else {
          this.dispatchEvent("listening-finished", { mode: 'command' });
          this.cleanupActiveSession();
        }
      };

      this.activeRecognition.start();
    } catch (error) {
      console.error("Listening failed to start:", error);
      this.dispatchEvent("command-status-update", { status: "error", message: "Mic access denied" });
      this.cleanupActiveSession();
    }
  }

  processTranscript(transcript, mode) {
    const lowerTranscript = transcript.toLowerCase();
    const now = Date.now();

    for (const command of voiceCommands) {
      const isAppCommand = command.scope === 'app';
      const isEditorCommand = command.scope === 'editor' && mode === 'dictation';

      if (!isAppCommand && !isEditorCommand) continue;

      for (const keyword of command.keywords) {
        let argument = null;
        let match = false;

        if (command.requiresArgument) {
            const keywordRegex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
            const matchResult = lowerTranscript.match(keywordRegex);
            if (matchResult) {
                argument = transcript.substring(matchResult.index + keyword.length).trim();
                if (argument) match = true;
            }
        } else {
          const keywordRegex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
          if (keywordRegex.test(lowerTranscript)) {
            match = true;
          }
        }

        if (match) {
          if (this.lastCommand === keyword && (now - this.lastCommandTime) < 1500) {
               console.log(`Duplicate command ignored: ${keyword}`);
               return true; 
          }

          console.log(`Command matched: ${keyword}`, { argument });
          this.lastCommand = keyword;
          this.lastCommandTime = now;

          if (isAppCommand) {
            command.action(argument, transcript);
          }
          if (isEditorCommand) {
            this.dispatchEvent('editor-command', { command, value: argument });
          }
          return true;
        }
      }
    }
    return false;
  }

  stopListening() {
    this.isActive = false; // Mark as inactive so onend doesn't auto-restart
    if (this.activeRecognition) {
      try { this.activeRecognition.stop(); } catch(e) {}
    }
  }

  cleanupActiveSession() {
    this.isActive = false;
    this.activeRecognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    if (localStorage.getItem("handsFreeMode") === "true") {
      this.startAmbientListening();
    } else {
      this.dispatchEvent("command-status-update", { status: "ready", message: "Voice commands ready" });
    }
  }

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

const commandService = new CommandService();
export default commandService;