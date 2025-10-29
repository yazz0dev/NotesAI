import voiceCommands from './voice-commands.js';

class CommandService {
  constructor() {
    this.ambientRecognition = null;
    this.activeRecognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isAmbientListening = false;
    this.isActive = false;
    this.pendingTranscript = '';
    this.lastCommandTime = 0;
  }

  init() {
    // Check speech recognition support
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
      // Only log actual errors, not normal events like "no-speech"
      if (e.error !== 'no-speech' && e.error !== 'audio-capture') {
        console.error("Ambient recognition error:", e.error);
      }
    };

    this.ambientRecognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (transcript.includes("hey notes")) {
        this.processCommand(transcript);
      }
    };
  }

  processCommand(transcript) {
    this.dispatchEvent("command-status-update", { status: "active", message: `Command: ${transcript}` });

    // Enhanced command parsing
    const createNoteRegex = /create note(?: titled| called)?\s*(.*?)\s*(?:with content|that says|with)\s*(.*)/i;
    const simpleCreateNoteRegex = /create note\s(.*)/i;
    const searchRegex = /search for\s(.*)/i;
    const deleteRegex = /delete note\s(.*)/i;

    let match;

    if ((match = createNoteRegex.exec(transcript)) !== null) {
      this.dispatchEvent("command-create-note", { summary: match[1].trim(), content: match[2].trim() });
    } else if ((match = simpleCreateNoteRegex.exec(transcript)) !== null) {
      this.dispatchEvent("command-create-note", { content: match[1].trim() });
    } else if ((match = searchRegex.exec(transcript)) !== null) {
      this.dispatchEvent("command-search", { query: match[1].trim() });
    } else if ((match = deleteRegex.exec(transcript)) !== null) {
      this.dispatchEvent("command-delete-note", { query: match[1].trim() });
    } else if (transcript.includes("summarize")) {
      this.dispatchEvent("command-summarize-notes", {});
    }
  }

  startAmbientListening() {
    if (this.ambientRecognition && !this.isAmbientListening && !this.isActive) {
      try { 
        this.ambientRecognition.start(); 
      } catch (e) { 
        console.warn("Failed to start ambient listening:", e);
      }
    }
  }

  stopAmbientListening() {
    if (this.ambientRecognition && this.isAmbientListening) {
      this.ambientRecognition.stop();
    }
  }

  async startListening({ mode = 'command' }) {
    if (this.isActive) return;
    this.stopAmbientListening();

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

      this.activeRecognition.onresult = (e) => {
        let interim_transcript = '';
        let final_transcript = '';

        for (let i = e.resultIndex; i < e.results.length; ++i) {
          const transcript = e.results[i][0].transcript;
          if (e.results[i].isFinal) {
            final_transcript += transcript.trim() + ' ';
          } else {
            interim_transcript += transcript;
          }
        }

        // Show all voice activity in the header for feedback
        if (interim_transcript || final_transcript) {
          const displayText = (final_transcript + interim_transcript).trim();
          this.dispatchEvent("command-status-update", { status: "recording", message: `"${displayText}"` });
        }

        if (mode === 'dictation') {
          // Check for commands in the final transcript
          if (final_transcript) {
            const command = this.findCommand(final_transcript.toLowerCase());
            if (command) {
              // Execute command and don't add text to note
              this.dispatchEvent("command-execute", { command });
              this.lastCommandTime = Date.now();
              // Don't dispatch dictation events for command text
              return;
            }

            // Not a command, add to note
            this.dispatchEvent("dictation-finalized", { transcript: final_transcript });
          }

          // Handle interim results - only show if not potentially part of a command
          if (interim_transcript) {
            const trimmedInterim = interim_transcript.toLowerCase().trim();

            // Check if this interim result could be the start of a command
            if (this.couldBeCommand(trimmedInterim)) {
              // This might be part of a command, show command detection status
              this.dispatchEvent("command-status-update", {
                status: "recording",
                message: `Command detected: "${interim_transcript}"`
              });
            } else {
              // This doesn't look like a command, send to dictation
              this.dispatchEvent("dictation-update", { transcript: interim_transcript });
            }
          }
        } else {
          if (final_transcript) {
            this.processCommand(final_transcript.toLowerCase());
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
      };

      this.activeRecognition.onend = () => {
        if (!this.isActive) return;
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
            const audioDataUrl = await this.blobToDataURL(audioBlob);
            this.dispatchEvent("listening-finished", { mode: 'dictation', audioUrl: audioDataUrl });
            stream.getTracks().forEach((track) => track.stop());
            this.cleanupActiveSession();
          };
          this.mediaRecorder.stop();
        } else {
          this.dispatchEvent("listening-finished", { mode: 'command' });
          this.cleanupActiveSession();
        }
      };

      this.mediaRecorder?.start();
      this.activeRecognition.start();
    } catch (error) {
      console.error("Listening failed to start:", error);
      this.dispatchEvent("command-status-update", { status: "error", message: "Mic access denied" });
      this.cleanupActiveSession();
    }
  }

  stopListening() {
    if (this.isActive && this.activeRecognition) {
      this.activeRecognition.stop();
    }
  }

  cleanupActiveSession() {
    this.isActive = false;
    this.activeRecognition = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    if (localStorage.getItem("handsFreeMode") === "true") {
      setTimeout(() => this.startAmbientListening(), 500);
    }
  }

  findCommand(transcript) {
    if (!transcript) return null;
    for (const command of voiceCommands) {
      for (const keyword of command.keywords) {
        if (transcript.includes(keyword)) {
          // Execute app-level commands immediately
          if (command.type === 'app-level' && command.action) {
            try {
              command.action();
              return null; // Don't return the command since we executed it
            } catch (error) {
              console.error('Error executing app-level command:', error);
            }
          }
          return command;
        }
      }
    }
    return null;
  }

  // Check if transcript could be the start of a command (for interim results)
  couldBeCommand(transcript) {
    if (!transcript) return false;
    const words = transcript.toLowerCase().trim().split(' ');
    for (const command of voiceCommands) {
      for (const keyword of command.keywords) {
        const keywordWords = keyword.split(' ');
        // Check if the transcript words match the beginning of any keyword
        const matchesStart = keywordWords.slice(0, words.length).every((kwWord, i) => kwWord === words[i]);
        if (matchesStart) {
          return true;
        }
      }
    }
    return false;
  }

  // Utility methods
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