class PromptAPIService {
  constructor() {
    this._activeSession = null;
  }

  async checkAvailability() {
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

  async runPrompt(prompt, systemPrompt = null, options = {}) {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      throw new Error(availability.reason);
    }

    this.dispatchEvent("prompt-status-update", { status: "processing", message: "AI is thinking..." });

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

      this.dispatchEvent("prompt-status-update", { status: "ready", message: "AI processing complete" });
      return response;
    } catch (error) {
      console.error("AI execution error:", error);
      this.dispatchEvent("prompt-status-update", { status: "error", message: `AI Error: ${error.message}` });
      throw error;
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
      const response = await this.runPrompt(prompt, null, {
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
    return this.runPrompt(prompt, systemPrompt, {
      ...options,
      stream: true,
      onChunk
    });
  }

  // Session management for persistent conversations
  async createPersistentSession(systemPrompt = null, options = {}) {
    if (this._activeSession) {
      this._activeSession.destroy();
    }

    const availability = await this.checkAvailability();
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

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const promptAPIService = new PromptAPIService();
export default promptAPIService;