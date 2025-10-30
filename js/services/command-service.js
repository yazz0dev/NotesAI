// File to edit: NotesAi/js/services/command-service.js

import voiceCommands from './voice-commands.js';
import { aiToolsService } from './ai-tools-service.js';

class CommandService {
  constructor() {
    this.ambientRecognition = null;
    this.activeRecognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isAmbientListening = false;
    this.isActive = false; // CRITICAL: This flag controls the recognition lifecycle
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
        console.log("Wake word 'Hey Notes' detected.");
        this.stopAmbientListening();
        this.startListening({ mode: 'command' });
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
             // Allow a tiny pause for cleanup before restarting
             await new Promise(resolve => setTimeout(resolve, 50));
        } else {
             return; // Already active in the correct mode
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

      this.activeRecognition.onresult = async (event) => {
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
          const statusMessage = this.currentMode === 'dictation' ? `"${currentText}"` : `Heard: "${currentText}"`;
          this.dispatchEvent("command-status-update", { status: "recording", message: statusMessage });
        }

        if (mode === 'dictation' && interimTranscript) {
          this.dispatchEvent("dictation-update", { transcript: interimTranscript });
        }

        if (finalTranscript) {
          const trimmedFinalTranscript = finalTranscript.trim();
          // CORE CHANGE: processTranscript now returns true if a local command was matched
          const wasSpecificCommand = this.processTranscript(trimmedFinalTranscript, mode);
          
          if (!wasSpecificCommand && mode === 'command') {
            console.log(`Unrecognized command, passing to AI tools: "${trimmedFinalTranscript}"`);
            await aiToolsService.processQueryWithTools(trimmedFinalTranscript);
            this.stopListening();
          } else if (!wasSpecificCommand && mode === 'dictation') {
            this.dispatchEvent("dictation-finalized", { transcript: trimmedFinalTranscript });
          }
        }
      };

      this.activeRecognition.onstart = () => {
        this.isActive = true; // Set active flag HERE
        this.dispatchEvent("listening-started", { mode });
        const message = mode === 'dictation' ? "Dictating... Speak now." : "Listening for a command...";
        this.dispatchEvent("command-status-update", { status: "recording", message });
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.mediaRecorder.start();
        }
      };

      this.activeRecognition.onend = () => {
        // Only restart if the session is supposed to be active
        if (this.isActive) {
             try { this.activeRecognition.start(); } catch(e) { /* ignore if already started */ }
             return;
        }

        // If not active, proceed with cleanup
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
        // Match command scope to current recognition mode
        const isAppCommand = command.scope === 'app' && (mode === 'command' || mode === 'dictation'); // App commands can be global
        const isEditorCommand = command.scope === 'editor' && mode === 'dictation';

        if (!isAppCommand && !isEditorCommand) continue;

        for (const keyword of command.keywords) {
            const keywordRegex = new RegExp(`^${keyword.toLowerCase()}\\b`, 'i');
            if (keywordRegex.test(lowerTranscript)) {
                // Prevent duplicate command execution
                if (this.lastCommand === keyword && (now - this.lastCommandTime) < 1500) {
                    console.log(`Duplicate command ignored: ${keyword}`);
                    return true; // Consume the transcript
                }
                
                console.log(`Local command matched: "${keyword}"`);
                this.lastCommand = keyword;
                this.lastCommandTime = now;

                if (command.action) { // App-level command
                    command.action();
                } else if (command.method) { // Editor-level command
                    this.dispatchEvent('editor-command', { command });
                }
                
                // Special case for commands that should stop listening
                if (['stop dictating', 'close editor'].some(k => keyword.includes(k))) {
                    this.stopListening();
                }
                
                return true; // IMPORTANT: Indicate that the command was handled
            }
        }
    }
    return false; // No local command matched
  }

  stopListening() {
    this.isActive = false; // CRITICAL: This prevents onend from restarting
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