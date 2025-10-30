class PromptAPIService {
  constructor() {
    this._activeSession = null;
    this._crashCount = 0;
    this._maxCrashThreshold = 3;
    this._isCrashRecovered = false;
    this._crashDetectionTimeout = null;
    console.log("[PromptAPIService] Initialized with language specifications (expectedInputs/expectedOutputs)");
  }

  async checkAvailability() {
    try {
      // Use the top-level `self.LanguageModel` object.
      if (!('LanguageModel' in self)) {
        return { available: false, reason: "Chrome Prompt API is not available." };
      }
      
      // Check if model has crashed too many times
      if (this._crashCount >= this._maxCrashThreshold) {
        console.warn("[PromptAPIService] Model has crashed too many times, disabling AI");
        return { available: false, reason: "Model process crashed too many times. Please restart the browser." };
      }
      
      const availability = await self.LanguageModel.availability();
      if (availability === 'available' || availability === 'downloadable') {
        return { available: true };
      }
      return { available: false, reason: `Prompt API is in an unsupported state: ${availability}` };
    } catch (error) {
      console.error("[PromptAPIService] AI availability check error:", error);
      return { available: false, reason: `AI check failed: ${error.message}` };
    }
  }

  async getModelParams() {
    try {
      if (!('LanguageModel' in self)) { throw new Error("LanguageModel API not available."); }
      return await self.LanguageModel.params();
    } catch (error) {
      console.warn("[PromptAPIService] Could not get model params, using defaults:", error);
      return { defaultTopK: 3, maxTopK: 128, defaultTemperature: 1, maxTemperature: 2 };
    }
  }

  _recordCrash() {
    this._crashCount++;
    console.error(`[PromptAPIService] Model crash detected (${this._crashCount}/${this._maxCrashThreshold})`);
    
    // Clear any pending timeout
    if (this._crashDetectionTimeout) {
      clearTimeout(this._crashDetectionTimeout);
    }
    
    // Reset crash count after 30 seconds of stability
    this._crashDetectionTimeout = setTimeout(() => {
      console.log("[PromptAPIService] Crash counter reset after stability period");
      this._crashCount = 0;
      this._isCrashRecovered = false;
    }, 30000);
  }

  async _runStreamingPrompt(session, prompt, options = {}) {
    try {
      const stream = session.promptStreaming(prompt, options.promptOptions);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse = chunk;
        if (options.onChunk) {
          options.onChunk(fullResponse);
        }
      }
      return fullResponse;
    } catch (error) {
      console.error("[PromptAPIService] Streaming prompt error:", error);
      this._recordCrash();
      throw error;
    }
  }

  async runPrompt(prompt, systemPrompt = null, options = {}) {
    const availability = await this.checkAvailability();
    if (!availability.available) { throw new Error(availability.reason); }
    this.dispatchEvent("prompt-status-update", { status: "processing", message: "AI is thinking..." });
    let session;
    try {
      const modelParams = await this.getModelParams();
      const initialPrompts = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
      const sessionOptions = {
        initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
        temperature: options.temperature || modelParams.defaultTemperature,
        topK: options.topK || modelParams.defaultTopK,
        // Specify expected inputs and outputs with language codes to avoid Chrome warnings
        expectedInputs: [
          { type: 'text', languages: ['en'] }
        ],
        expectedOutputs: [
          { type: 'text', languages: ['en'] }
        ],
        monitor: (m) => {
          m.addEventListener('downloadprogress', (e) => {
            // Use global flag to show download message only once.
            if (!window._isAiModelDownloading) {
              window._isAiModelDownloading = true;
              this.dispatchEvent("prompt-status-update", { status: "checking", message: `Downloading AI model...` });
            }
            if (e.loaded >= e.total) {
              window._isAiModelDownloading = false;
            }
          });
        },
        ...options.sessionOptions
      };
      // Use the top-level `self.LanguageModel` object.
      session = await self.LanguageModel.create(sessionOptions);
      let response;
      const promptOpts = options.promptOptions || {};
      
      if (options.stream) {
        response = await this._runStreamingPrompt(session, prompt, { ...options, promptOptions: promptOpts });
      } else {
        response = await session.prompt(prompt, promptOpts);
      }
      
      this.dispatchEvent("prompt-status-update", { status: "ready", message: "AI processing complete" });
      return response;
    } catch (error) {
      console.error("AI execution error:", error);
      // Provide a more specific error message in the AI status header.
      this.dispatchEvent("prompt-status-update", { status: "error", message: `AI Error: Model failed to run.` });
      if (window._isAiModelDownloading) window._isAiModelDownloading = false;
      throw error;
    } finally {
        if (session && !options.keepSession) { session.destroy(); }
    }
  }

  async customPrompt(userPrompt, noteContent = '', options = {}) {
    const cleanContent = noteContent ? noteContent.replace(/<[^>]*>/g, " ").trim().substring(0, 3000) : '';
    let prompt = userPrompt;
    if (cleanContent) {
      prompt += `\n\nContext (current note content):\n${cleanContent}`;
    }
    return this.runPrompt(prompt, null, options);
  }

  async structuredPrompt(prompt, schema, options = {}) {
    const promptOptions = {
      responseConstraint: schema,
      omitResponseConstraintInput: options.omitSchemaFromPrompt || false,
      ...options.promptOptions
    };
    try {
      const response = await this.runPrompt(prompt, options.systemPrompt || null, { ...options, promptOptions });
      return JSON.parse(response);
    } catch (error) {
      console.error("Structured prompt error:", error);
      throw error;
    }
  }
  
  async streamPrompt(prompt, onChunk, systemPrompt = null, options = {}) {
    return this.runPrompt(prompt, systemPrompt, { ...options, stream: true, onChunk });
  }

  async createPersistentSession(systemPrompt = null, options = {}) {
    if (this._activeSession) { this._activeSession.destroy(); }
    const availability = await this.checkAvailability();
    if (!availability.available) { throw new Error(availability.reason); }
    const modelParams = await this.getModelParams();
    const initialPrompts = systemPrompt ? [{ role: 'system', content: systemPrompt }] : [];
    const sessionOptions = {
      initialPrompts: initialPrompts.length > 0 ? initialPrompts : undefined,
      temperature: options.temperature || modelParams.defaultTemperature,
      topK: options.topK || modelParams.defaultTopK,
      // Specify expected inputs and outputs with language codes to avoid Chrome warnings
      expectedInputs: [
        { type: 'text', languages: ['en'] }
      ],
      expectedOutputs: [
        { type: 'text', languages: ['en'] }
      ],
      monitor: (m) => {
        m.addEventListener('downloadprogress', (e) => {
          if (!window._isAiModelDownloading) {
            window._isAiModelDownloading = true;
            this.dispatchEvent("prompt-status-update", { status: "checking", message: `Downloading AI model...` });
          }
          if (e.loaded >= e.total) {
            window._isAiModelDownloading = false;
          }
        });
      },
      ...options
    };
    this._activeSession = await self.LanguageModel.create(sessionOptions);
    return this._activeSession;
  }

  async promptPersistentSession(prompt, options = {}) {
    if (!this._activeSession) { throw new Error("No active session. Call createPersistentSession first."); }
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

  destroyPersistentSession() {
    if (this._activeSession) {
      this._activeSession.destroy();
      this._activeSession = null;
    }
  }

  dispatchEvent(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
}

const promptAPIService = new PromptAPIService();
export default promptAPIService;