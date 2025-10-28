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

      // Check both Prompt API and Proofreader APIs
      const [promptAvailability, proofreaderAvailability] = await Promise.all([
        this.checkAIAvailability(),
        this.checkProofreaderAvailability()
      ]);

      const capabilities = [];
      if (promptAvailability.available) {
        capabilities.push("AI chat", "summarization");
      }
      if (proofreaderAvailability.available) {
        capabilities.push("proofreading");
      }

      if (capabilities.length > 0) {
        this.dispatchAIEvent("ai-status-update", {
          status: "ready",
          message: `AI ready for: ${capabilities.join(", ")}`
        });
      } else {
        const reasons = [promptAvailability.reason, proofreaderAvailability.reason].filter(Boolean);
        this.dispatchAIEvent("ai-status-update", {
          status: "disabled",
          message: reasons.length > 0 ? reasons[0] : "AI unavailable"
        });
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
    this.ambientRecognition.lang = 'en-US'; // Set language for better recognition
    this.ambientRecognition.maxAlternatives = 1;

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
      // Check if the Prompt API (LanguageModel) is available
      if (!('ai' in window) || !('languageModel' in window.ai)) {
        return { available: false, reason: "Chrome Prompt API is not available. Please use Chrome 138+ with AI features enabled." };
      }

      // Check availability status
      const availability = await window.ai.languageModel.availability();

      if (availability === 'unavailable') {
        return { available: false, reason: "Chrome Prompt API is not available on this device." };
      }

      if (availability === 'downloadable') {
        return { available: false, reason: "Chrome AI model needs to be downloaded. The download will start automatically when you first use AI features." };
      }

      return { available: true };
    } catch (error) {
      console.error("AI availability check error:", error);
      return { available: false, reason: `AI check failed: ${error.message}` };
    }
  }

  async getModelParams() {
    try {
      if (!('ai' in window) || !('languageModel' in window.ai)) {
        return {
          defaultTopK: 3,
          maxTopK: 128,
          defaultTemperature: 1,
          maxTemperature: 2
        };
      }
      return await window.ai.languageModel.params();
    } catch (error) {
      console.warn("Could not get model params, using defaults:", error);
      return {
        defaultTopK: 3,
        maxTopK: 128,
        defaultTemperature: 1,
        maxTemperature: 2
      };
    }
  }

  async _runStreamingPrompt(session, prompt, options = {}) {
    try {
      const stream = session.promptStreaming(prompt, options.promptOptions);
      let fullResponse = '';

      for await (const chunk of stream) {
        fullResponse = chunk;
        // Dispatch streaming progress if callback provided
        if (options.onChunk) {
          options.onChunk(chunk);
        }
      }

      return fullResponse;
    } catch (error) {
      console.error("Streaming prompt error:", error);
      throw error;
    }
  }

  async checkProofreaderAvailability() {
    try {
      // Check if the Proofreader API is available
      if (!('Proofreader' in self)) {
        return { available: false, reason: "Chrome Proofreader API is not available. Please use Chrome 141+ with AI features enabled." };
      }

      // Check availability status
      const availability = await Proofreader.availability();

      if (availability === 'unavailable') {
        return { available: false, reason: "Chrome Proofreader API is not available on this device." };
      }

      if (availability === 'downloadable') {
        return { available: false, reason: "Chrome Proofreader model needs to be downloaded. The download will start automatically when you first use proofreading." };
      }

      return { available: true };
    } catch (error) {
      console.error("Proofreader availability check error:", error);
      return { available: false, reason: `Proofreader check failed: ${error.message}` };
    }
  }

  async _runAI(prompt, systemPrompt = null, options = {}) {
    const availability = await this.checkAIAvailability();
    if (!availability.available) {
      throw new Error(availability.reason);
    }

    this.dispatchAIEvent("ai-status-update", { status: "processing", message: "AI is thinking..." });

    try {
      // Get model parameters for optimal configuration
      const modelParams = await this.getModelParams();

      // Build initial prompts using the new format
      const initialPrompts = [];
      if (systemPrompt) {
        initialPrompts.push({ role: 'system', content: systemPrompt });
      }

      // Create session with enhanced configuration
      const sessionOptions = {
        initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
        temperature: options.temperature || modelParams.defaultTemperature,
        topK: options.topK || modelParams.defaultTopK,
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
        ...options.sessionOptions
      };

      const session = await window.ai.languageModel.create(sessionOptions);

      // Run the prompt (support both streaming and non-streaming)
      let response;
      if (options.stream) {
        response = await this._runStreamingPrompt(session, prompt, options);
      } else {
        response = await session.prompt(prompt, options.promptOptions);
      }

      // Clean up session unless specified to keep it
      if (!options.keepSession) {
        session.destroy();
      }

      this.dispatchAIEvent("ai-status-update", { status: "ready", message: "AI processing complete" });
      return response;
    } catch (error) {
      console.error("AI execution error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "error", message: `AI Error: ${error.message}` });
      throw error;
    }
  }

  async summarizeText(content, type = 'key-points') {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 20) {
      return "This note is too short to summarize.";
    }

    this.dispatchAIEvent("ai-status-update", { status: "processing", message: "AI is summarizing..." });

    try {
      // Try Summarizer API first (if available)
      if ('Summarizer' in self) {
        const availability = await Summarizer.availability();
        if (availability === 'available') {
          const summarizerType = type === 'concise' ? 'tl;dr' : 'key-points';
          const summarizer = await Summarizer.create({
            type: summarizerType,
            format: 'markdown',
            length: type === 'detailed' ? 'long' : 'medium'
          });
          const summary = await summarizer.summarize(cleanContent);
          this.dispatchAIEvent("ai-status-update", { status: "ready", message: "Summary complete" });
          return summary;
        }
      }

      // Fallback to Prompt API for summarization with different styles
      let systemPrompt, prompt;

      switch (type) {
        case 'concise':
          systemPrompt = "You are a helpful assistant that creates very brief, to-the-point summaries.";
          prompt = `Provide a very concise one-paragraph summary of this text:\n\n${cleanContent}`;
          break;

        case 'detailed':
          systemPrompt = "You are a helpful assistant that creates comprehensive, detailed summaries with multiple sections.";
          prompt = `Please provide a detailed summary of the following text in well-formatted markdown with multiple sections:

**Guidelines:**
- Start with an overview paragraph
- Break down into main sections with headers
- Include key details and insights
- Use bullet points for important items
- Provide context and implications

**Text to summarize:**
${cleanContent}

**Detailed Summary:**`;
          break;

        case 'key-points':
        default:
          systemPrompt = "You are a helpful assistant that creates well-structured summaries in markdown format. Use headers, bullet points, and proper formatting to make summaries clear and readable.";
          prompt = `Please provide a concise summary of the following text in well-formatted markdown:

**Guidelines:**
- Start with a brief overview paragraph
- Use bullet points for key points
- Use subheadings if appropriate
- Keep it concise but comprehensive
- Use proper markdown formatting

**Text to summarize:**
${cleanContent}

**Summary:**`;
          break;
      }

      return await this._runAI(prompt, systemPrompt);

    } catch (error) {
      console.error("Summarization error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "error", message: `AI Error: ${error.message}` });
      throw error;
    }
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

  async proofreadTextWithDetails(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 3) {
      return { corrected: content, corrections: [], hasCorrections: false }; // Not enough to proofread
    }

    // First try the new Proofreader API
    const proofreaderAvailability = await this.checkProofreaderAvailability();
    if (proofreaderAvailability.available) {
      try {
        return await this._proofreadWithAPI(cleanContent);
      } catch (error) {
        console.warn("Proofreader API failed, falling back to generic AI:", error);
        // Fall back to generic AI if Proofreader API fails
      }
    }

    // Fallback to generic AI proofreading
    try {
      const correctedText = await this.proofreadText(cleanContent);
      return {
        corrected: correctedText,
        corrections: [], // No detailed corrections available from generic AI
        hasCorrections: correctedText.trim() !== cleanContent.trim()
      };
    } catch (error) {
      console.error("Fallback proofreading failed:", error);
      throw error;
    }
  }

  async _proofreadWithAPI(content) {
    this.dispatchAIEvent("ai-status-update", { status: "processing", message: "AI is proofreading..." });

    try {
      // Create proofreader session with download progress monitoring
      const session = await Proofreader.create({
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
        monitor(m) {
          m.addEventListener('downloadprogress', (e) => {
            const progressPercent = Math.round(e.loaded * 100);
            console.log(`Proofreader download progress: ${progressPercent}%`);
            // Dispatch download progress event
            window.dispatchEvent(new CustomEvent('ai-download-progress', {
              detail: {
                api: 'proofreader',
                progress: progressPercent,
                message: `Downloading proofreading model... ${progressPercent}%`
              }
            }));
          });
        }
      });

      // Run proofreading
      const proofreadResult = await session.proofread(content);

      // Clean up session
      session.destroy();

      this.dispatchAIEvent("ai-status-update", { status: "ready", message: "Proofreading complete" });

      return {
        corrected: proofreadResult.corrected,
        corrections: proofreadResult.corrections,
        hasCorrections: proofreadResult.corrections.length > 0
      };
    } catch (error) {
      console.error("Proofreader API execution error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "error", message: `Proofreading Error: ${error.message}` });
      throw error;
    }
  }

  async customPrompt(userPrompt, noteContent = '', options = {}) {
    const cleanContent = noteContent ? noteContent.replace(/<[^>]*>/g, " ").trim().substring(0, 3000) : '';

    let prompt = userPrompt;
    if (cleanContent) {
      prompt += `\n\nContext (current note content):\n${cleanContent}`;
    }

    return this._runAI(prompt, null, options);
  }

  async structuredPrompt(prompt, schema, options = {}) {
    const promptOptions = {
      responseConstraint: schema,
      omitResponseConstraintInput: options.omitSchemaFromPrompt || false,
      ...options.promptOptions
    };

    try {
      const response = await this._runAI(prompt, null, {
        ...options,
        promptOptions
      });

      // Try to parse JSON response
      try {
        return JSON.parse(response);
      } catch (parseError) {
        console.warn("Response is not valid JSON, returning as string:", response);
        return response;
      }
    } catch (error) {
      console.error("Structured prompt error:", error);
      throw error;
    }
  }

  async streamPrompt(prompt, onChunk, systemPrompt = null, options = {}) {
    return this._runAI(prompt, systemPrompt, {
      ...options,
      stream: true,
      onChunk
    });
  }

  // Session management for persistent conversations
  _activeSession = null;

  async createPersistentSession(systemPrompt = null, options = {}) {
    if (this._activeSession) {
      this._activeSession.destroy();
    }

    const availability = await this.checkAIAvailability();
    if (!availability.available) {
      throw new Error(availability.reason);
    }

    const modelParams = await this.getModelParams();
    const initialPrompts = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];

    const sessionOptions = {
      initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
      temperature: options.temperature || modelParams.defaultTemperature,
      topK: options.topK || modelParams.defaultTopK,
      expectedInputs: [{ type: "text", languages: ["en"] }],
      expectedOutputs: [{ type: "text", languages: ["en"] }],
      ...options
    };

    this._activeSession = await window.ai.languageModel.create(sessionOptions);
    return this._activeSession;
  }

  async promptPersistentSession(prompt, options = {}) {
    if (!this._activeSession) {
      throw new Error("No active session. Call createPersistentSession first.");
    }

    try {
      if (options.stream && options.onChunk) {
        return await this._runStreamingPrompt(this._activeSession, prompt, options);
      } else {
        return await this._activeSession.prompt(prompt, options.promptOptions);
      }
    } catch (error) {
      console.error("Persistent session prompt error:", error);
      throw error;
    }
  }

  appendToPersistentSession(messages) {
    if (!this._activeSession) {
      throw new Error("No active session. Call createPersistentSession first.");
    }

    return this._activeSession.append(messages);
  }

  clonePersistentSession(options = {}) {
    if (!this._activeSession) {
      throw new Error("No active session to clone.");
    }

    return this._activeSession.clone(options);
  }

  destroyPersistentSession() {
    if (this._activeSession) {
      this._activeSession.destroy();
      this._activeSession = null;
    }
  }

  getSessionUsage() {
    if (!this._activeSession) {
      return null;
    }

    return {
      inputUsage: this._activeSession.inputUsage,
      inputQuota: this._activeSession.inputQuota,
      usageRatio: this._activeSession.inputUsage / this._activeSession.inputQuota
    };
  }

  // Enhanced AI chat functionality for interactive assistance
  async startAIChat(systemPrompt = "You are a helpful AI assistant for note-taking and productivity.") {
    try {
      await this.createPersistentSession(systemPrompt, {
        temperature: 0.7, // More creative for chat
        topK: 40
      });
      return true;
    } catch (error) {
      console.error("Failed to start AI chat:", error);
      throw error;
    }
  }

  async chatWithAI(message, options = {}) {
    if (!this._activeSession) {
      await this.startAIChat();
    }

    return this.promptPersistentSession(message, options);
  }

  async chatWithStreaming(message, onChunk, options = {}) {
    if (!this._activeSession) {
      await this.startAIChat();
    }

    return this.promptPersistentSession(message, {
      ...options,
      stream: true,
      onChunk
    });
  }

  endAIChat() {
    this.destroyPersistentSession();
  }

  // Utility method for extracting structured data from notes
  async extractNoteMetadata(content) {
    const schema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Suggested title for the note" },
        tags: { type: "array", items: { type: "string" }, description: "Relevant tags or categories" },
        summary: { type: "string", description: "Brief summary of the content" },
        priority: { type: "string", enum: ["low", "medium", "high"], description: "Priority level" }
      },
      required: ["title", "tags", "summary"]
    };

    const prompt = `Analyze this note content and extract metadata. Focus on the main topic, key themes, and overall importance:\n\n${content.substring(0, 2000)}`;

    try {
      return await this.structuredPrompt(prompt, schema, {
        omitSchemaFromPrompt: true
      });
    } catch (error) {
      console.error("Metadata extraction failed:", error);
      // Fallback to basic extraction
      return {
        title: content.split('\n')[0]?.substring(0, 50) || "Untitled Note",
        tags: ["note"],
        summary: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
        priority: "medium"
      };
    }
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