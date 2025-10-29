import commandService from './command-service.js';
import promptAPIService from './promptapi-service.js';
import proofreaderService from './proofreader-service.js';
import summaryService from './summary-service.js';

class AIService {
  constructor() {
    this.commandService = commandService;
    this.promptAPIService = promptAPIService;
    this.proofreaderService = proofreaderService;
    this.summaryService = summaryService;
    
    this.isInitialized = false;
    this.capabilities = new Set();
  }

  async init() {
    if (this.isInitialized) return;

    this.dispatchAIEvent("ai-status-update", { status: "checking", message: "Initializing AI services..." });

    try {
      // Initialize command service (speech recognition)
      const speechSupported = this.commandService.init();
      if (speechSupported) {
        this.capabilities.add("voice-commands");
        this.capabilities.add("dictation");
      }

      // Check AI service availability
      const [promptAvailability, proofreaderAvailability] = await Promise.all([
        this.promptAPIService.checkAvailability(),
        this.proofreaderService.checkAvailability()
      ]);

      if (promptAvailability.available) {
        this.capabilities.add("ai-chat");
        this.capabilities.add("summarization");
        this.capabilities.add("custom-prompts");
        this.capabilities.add("structured-data");
      }

      if (proofreaderAvailability.available) {
        this.capabilities.add("proofreading");
      }

      // Check summarizer availability
      const summarizerAvailability = await this.summaryService.checkSummarizerAvailability();
      if (summarizerAvailability.available) {
        this.capabilities.add("advanced-summarization");
      }

      this.isInitialized = true;

      if (this.capabilities.size > 0) {
        const capabilityList = Array.from(this.capabilities).join(", ");
        this.dispatchAIEvent("ai-status-update", {
          status: "ready",
          message: `AI ready with: ${capabilityList}`
        });
      } else {
        this.dispatchAIEvent("ai-status-update", {
          status: "disabled",
          message: "No AI capabilities available"
        });
      }

      // Set up event forwarding
      this.setupEventForwarding();

    } catch (error) {
      console.error("AI initialization error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "disabled", message: "AI initialization failed" });
    }
  }

  setupEventForwarding() {
    // Forward command service events with ai- prefix for backward compatibility
    window.addEventListener('command-status-update', (e) => {
      this.dispatchAIEvent("ai-status-update", e.detail);
    });

    window.addEventListener('command-create-note', (e) => {
      this.dispatchAIEvent("ai-create-note", e.detail);
    });

    window.addEventListener('command-search', (e) => {
      this.dispatchAIEvent("ai-search", e.detail);
    });

    window.addEventListener('command-delete-note', (e) => {
      this.dispatchAIEvent("ai-delete-note", e.detail);
    });

    window.addEventListener('command-summarize-notes', (e) => {
      this.dispatchAIEvent("ai-summarize-notes", e.detail);
    });

    window.addEventListener('command-execute', (e) => {
      this.dispatchAIEvent("ai-execute-command", e.detail);
    });

    window.addEventListener('listening-started', (e) => {
      this.dispatchAIEvent("ai-listening-started", e.detail);
    });

    window.addEventListener('listening-finished', (e) => {
      this.dispatchAIEvent("ai-listening-finished", e.detail);
    });

    window.addEventListener('dictation-update', (e) => {
      this.dispatchAIEvent("ai-dictation-update", e.detail);
    });

    window.addEventListener('dictation-finalized', (e) => {
      this.dispatchAIEvent("ai-dictation-finalized", e.detail);
    });
  }

  // Voice Commands API
  startAmbientListening() {
    return this.commandService.startAmbientListening();
  }

  stopAmbientListening() {
    return this.commandService.stopAmbientListening();
  }

  async startListening(options) {
    return this.commandService.startListening(options);
  }

  stopListening() {
    return this.commandService.stopListening();
  }

  // AI Chat and Prompts API
  async customPrompt(userPrompt, noteContent = '', options = {}) {
    if (!this.capabilities.has("ai-chat")) {
      throw new Error("AI chat capability not available");
    }
    return this.promptAPIService.customPrompt(userPrompt, noteContent, options);
  }

  async structuredPrompt(prompt, schema, options = {}) {
    if (!this.capabilities.has("structured-data")) {
      throw new Error("Structured data capability not available");
    }
    return this.promptAPIService.structuredPrompt(prompt, schema, options);
  }

  async streamPrompt(prompt, onChunk, systemPrompt = null, options = {}) {
    if (!this.capabilities.has("ai-chat")) {
      throw new Error("AI chat capability not available");
    }
    return this.promptAPIService.streamPrompt(prompt, onChunk, systemPrompt, options);
  }

  // AI Chat Session Management
  async startAIChat(systemPrompt) {
    if (!this.capabilities.has("ai-chat")) {
      throw new Error("AI chat capability not available");
    }
    return this.promptAPIService.startAIChat(systemPrompt);
  }

  async chatWithAI(message, options = {}) {
    if (!this.capabilities.has("ai-chat")) {
      throw new Error("AI chat capability not available");
    }
    return this.promptAPIService.chatWithAI(message, options);
  }

  async chatWithStreaming(message, onChunk, options = {}) {
    if (!this.capabilities.has("ai-chat")) {
      throw new Error("AI chat capability not available");
    }
    return this.promptAPIService.chatWithStreaming(message, onChunk, options);
  }

  endAIChat() {
    return this.promptAPIService.endAIChat();
  }

  // Proofreading API
  async proofreadText(content) {
    if (!this.capabilities.has("proofreading")) {
      throw new Error("Proofreading capability not available");
    }
    return this.proofreaderService.proofreadText(content);
  }

  async proofreadTextWithDetails(content) {
    if (!this.capabilities.has("proofreading")) {
      throw new Error("Proofreading capability not available");
    }
    return this.proofreaderService.proofreadTextWithDetails(content);
  }

  // Summarization API
  async summarizeText(content, type = 'key-points') {
    if (!this.capabilities.has("summarization")) {
      throw new Error("Summarization capability not available");
    }
    return this.summaryService.summarizeText(content, type);
  }

  async summarizeNotes(notes, type = 'overview') {
    if (!this.capabilities.has("summarization")) {
      throw new Error("Summarization capability not available");
    }
    return this.summaryService.summarizeNotes(notes, type);
  }

  async extractKeyInsights(content) {
    if (!this.capabilities.has("summarization")) {
      throw new Error("Insight extraction capability not available");
    }
    return this.summaryService.extractKeyInsights(content);
  }

  // Metadata extraction (using prompt API)
  async extractNoteMetadata(content) {
    if (!this.capabilities.has("structured-data")) {
      throw new Error("Metadata extraction capability not available");
    }
    return this.promptAPIService.extractNoteMetadata(content);
  }

  // Utility methods
  hasCapability(capability) {
    return this.capabilities.has(capability);
  }

  getCapabilities() {
    return Array.from(this.capabilities);
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      capabilities: this.getCapabilities(),
      services: {
        commands: this.commandService.isAmbientListening || this.commandService.isActive,
        promptAPI: this.capabilities.has("ai-chat"),
        proofreader: this.capabilities.has("proofreading"),
        summarizer: this.capabilities.has("advanced-summarization")
      }
    };
  }

  // Session management delegation
  async createPersistentSession(systemPrompt, options) {
    return this.promptAPIService.createPersistentSession(systemPrompt, options);
  }

  async promptPersistentSession(prompt, options) {
    return this.promptAPIService.promptPersistentSession(prompt, options);
  }

  destroyPersistentSession() {
    return this.promptAPIService.destroyPersistentSession();
  }

  getSessionUsage() {
    return this.promptAPIService.getSessionUsage();
  }

  dispatchAIEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const aiService = new AIService();
export default aiService;