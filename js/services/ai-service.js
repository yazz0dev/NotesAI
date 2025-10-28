import voiceCommands from './voice-commands.js';

class AIService {
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

  async init() {
    // Check speech recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech Recognition not supported.");
      this.dispatchAIEvent("ai-status-update", { status: "disabled", message: "Speech not supported" });
      return;
    }
    this.setupAmbientRecognition(SpeechRecognition);

    // Check AI availability asynchronously
    try {
      this.dispatchAIEvent("ai-status-update", { status: "checking", message: "Checking AI availability..." });
      const availability = await this.checkAIAvailability();
      if (availability.available) {
        this.dispatchAIEvent("ai-status-update", { status: "ready", message: "AI ready" });
      } else {
        this.dispatchAIEvent("ai-status-update", { status: "disabled", message: availability.reason });
      }
    } catch (error) {
      console.error("AI initialization error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "disabled", message: "AI unavailable" });
    }
  }

  setupAmbientRecognition(SpeechRecognition) {
    this.ambientRecognition = new SpeechRecognition();
    this.ambientRecognition.continuous = true;
    this.ambientRecognition.interimResults = false;

    this.ambientRecognition.onstart = () => {
      this.isAmbientListening = true;
      this.dispatchAIEvent("ai-status-update", { status: "listening", message: "Listening for 'Hey Notes'..." });
    };
    this.ambientRecognition.onend = () => {
      this.isAmbientListening = false;
      if (localStorage.getItem("handsFreeMode") === "true" && !this.isActive) {
        setTimeout(() => this.startAmbientListening(), 500);
      }
    };
    this.ambientRecognition.onerror = (e) => console.error("Ambient recognition error:", e.error);
    this.ambientRecognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
      if (transcript.includes("hey notes")) {
        this.processCommand(transcript);
      }
    };
  }

  processCommand(transcript) {
    this.dispatchAIEvent("ai-status-update", { status: "active", message: `Command: ${transcript}` });

    // Enhanced command parsing
    const createNoteRegex = /create note(?: titled| called)?\s*(.*?)\s*(?:with content|that says|with)\s*(.*)/i;
    const simpleCreateNoteRegex = /create note\s(.*)/i;
    const searchRegex = /search for\s(.*)/i;
    const deleteRegex = /delete note\s(.*)/i;

    let match;

    if ((match = createNoteRegex.exec(transcript)) !== null) {
      this.dispatchAIEvent("ai-create-note", { summary: match[1].trim(), content: match[2].trim() });
    } else if ((match = simpleCreateNoteRegex.exec(transcript)) !== null) {
      this.dispatchAIEvent("ai-create-note", { content: match[1].trim() });
    } else if ((match = searchRegex.exec(transcript)) !== null) {
      this.dispatchAIEvent("ai-search", { query: match[1].trim() });
    } else if ((match = deleteRegex.exec(transcript)) !== null) {
      this.dispatchAIEvent("ai-delete-note", { query: match[1].trim() });
    } else if (transcript.includes("summarize")) {
      this.dispatchAIEvent("ai-summarize-notes", {});
    }
  }

  startAmbientListening() {
    if (this.ambientRecognition && !this.isAmbientListening && !this.isActive) {
      try { this.ambientRecognition.start(); } catch (e) { /* Ignore */ }
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
    if (!SpeechRecognition) { return; }

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
          this.dispatchAIEvent("ai-status-update", { status: "recording", message: `"${displayText}"` });
        }

        if (mode === 'dictation') {
          // Check for commands in the final transcript
          if (final_transcript) {
            const command = this.findCommand(final_transcript.toLowerCase());
            if (command) {
              // Execute command and don't add text to note
              this.dispatchAIEvent("ai-execute-command", { command });
              this.lastCommandTime = Date.now();
              // Don't dispatch dictation events for command text
              return;
            }

            // Not a command, add to note
            this.dispatchAIEvent("ai-dictation-finalized", { transcript: final_transcript });
          }

          // Handle interim results - only show if not potentially part of a command
          if (interim_transcript) {
            const trimmedInterim = interim_transcript.toLowerCase().trim();

            // Check if this interim result could be the start of a command
            if (this.couldBeCommand(trimmedInterim)) {
              // This might be part of a command, show command detection status
              this.dispatchAIEvent("ai-status-update", {
                status: "recording",
                message: `Command detected: "${interim_transcript}"`
              });
            } else {
              // This doesn't look like a command, send to dictation
              this.dispatchAIEvent("ai-dictation-update", { transcript: interim_transcript });
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
        this.dispatchAIEvent("ai-listening-started", { mode });
        this.dispatchAIEvent("ai-status-update", { status: "recording", message: mode === 'dictation' ? "Dictating..." : "Listening for command..." });
      };

      this.activeRecognition.onend = () => {
        if (!this.isActive) return;
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
            const audioDataUrl = await this.blobToDataURL(audioBlob);
            this.dispatchAIEvent("ai-listening-finished", { mode: 'dictation', audioUrl: audioDataUrl });
            stream.getTracks().forEach((track) => track.stop());
            this.cleanupActiveSession();
          };
          this.mediaRecorder.stop();
        } else {
          this.dispatchAIEvent("ai-listening-finished", { mode: 'command' });
          this.cleanupActiveSession();
        }
      };

      this.mediaRecorder?.start();
      this.activeRecognition.start();
    } catch (error) {
      console.error("Listening failed to start:", error);
      this.dispatchAIEvent("ai-status-update", { status: "error", message: "Mic access denied" });
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

  // --- Chrome AI Integration ---
  async checkAIAvailability() {
    try {
      // Check if the AI API is available
      if (!window.ai || typeof window.ai.languageModel !== 'function') {
        return { available: false, reason: "Chrome Built-in AI is not available. Please use Chrome 131+ with AI features enabled." };
      }

      // Get capabilities - this is now async in the latest API
      const capabilities = await window.ai.languageModel.capabilities();

      if (capabilities.available === "no") {
        return { available: false, reason: "Chrome Built-in AI is not available on this device." };
      }

      if (capabilities.available === "after-download") {
        return { available: false, reason: "Chrome AI model needs to be downloaded. Please wait or check chrome://components/" };
      }

      return { available: true };
    } catch (error) {
      console.error("AI availability check error:", error);
      return { available: false, reason: `AI check failed: ${error.message}` };
    }
  }

  async _runAI(prompt, systemPrompt = null) {
    const availability = await this.checkAIAvailability();
    if (!availability.available) {
      throw new Error(availability.reason);
    }

    this.dispatchAIEvent("ai-status-update", { status: "processing", message: "AI is thinking..." });

    try {
      // Create session with system prompt if provided
      const session = await window.ai.languageModel.create({
        systemPrompt: systemPrompt || undefined
      });

      // Run the prompt
      const response = await session.prompt(prompt);

      // Clean up session
      session.destroy();

      this.dispatchAIEvent("ai-status-update", { status: "ready", message: "AI processing complete" });
      return response;
    } catch (error) {
      console.error("AI execution error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "error", message: `AI Error: ${error.message}` });
      throw error;
    }
  }

  async summarizeText(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 20) {
      return "This note is too short to summarize.";
    }

    const systemPrompt = "You are a helpful assistant that creates concise summaries.";
    const prompt = `Provide a concise, one-paragraph summary of the following text:\n\n${cleanContent}`;
    return this._runAI(prompt, systemPrompt);
  }

  async proofreadText(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 3) {
      return content; // Not enough to proofread, return original
    }

    const systemPrompt = "You are a professional proofreader. Correct spelling and grammar errors while preserving the original meaning and style.";
    const prompt = `Proofread and correct the following text. Return ONLY the corrected text without any explanations:\n\n${cleanContent}`;
    const correctedText = await this._runAI(prompt, systemPrompt);
    // Clean up any potential formatting from the AI response
    return correctedText.trim().replace(/^["']|["']$/g, '');
  }

  async customPrompt(userPrompt, noteContent = '') {
    const cleanContent = noteContent ? noteContent.replace(/<[^>]*>/g, " ").trim().substring(0, 3000) : '';

    let prompt = userPrompt;
    if (cleanContent) {
      prompt += `\n\nContext (current note content):\n${cleanContent}`;
    }

    return this._runAI(prompt);
  }

  dispatchAIEvent(name, detail) {
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

const aiService = new AIService();
export default aiService;