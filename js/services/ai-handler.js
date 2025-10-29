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

    // FINAL FIX: Initialize a global flag to track download state across all services.
    window._isAiModelDownloading = false;

    this.dispatchAIEvent("ai-status-update", { status: "checking", message: "Initializing AI services..." });

    try {
      const speechSupported = this.commandService.init();
      if (speechSupported) {
        this.capabilities.add("voice-commands");
        this.capabilities.add("dictation");
      }

      // Check availability for all AI services.
      const promptAvailability = await this.promptAPIService.checkAvailability();
      const proofreaderAvailability = await this.proofreaderService.checkAvailability();
      const summarizerAvailability = await this.summaryService.checkSummarizerAvailability();
      
      if (promptAvailability.available) {
        this.capabilities.add("ai-chat");
        this.capabilities.add("summarization"); // General summarization via Prompt API
      }
      if (proofreaderAvailability.available) {
        this.capabilities.add("proofreading");
      }
      if (summarizerAvailability.available) {
        // If the specific Summarizer API is available, we can consider it "advanced".
        this.capabilities.add("advanced-summarization");
      }

      this.isInitialized = true;
      const message = this.capabilities.size > 0 ? "AI services ready." : "No AI capabilities available.";
      const status = this.capabilities.size > 0 ? "ready" : "disabled";
      this.dispatchAIEvent("ai-status-update", { status, message });

    } catch (error) {
      console.error("AI initialization error:", error);
      this.dispatchAIEvent("ai-status-update", { status: "disabled", message: "AI initialization failed" });
    }
  }

  // Voice Commands API
  startListening(options) { return this.commandService.startListening(options); }
  stopListening() { return this.commandService.stopListening(); }

  // Proofreading API
  async proofreadTextWithDetails(content) { return this.proofreaderService.proofreadTextWithDetails(content); }
  async checkProofreaderAvailability() { return this.proofreaderService.checkAvailability(); }

  // Summarization API
  async summarizeText(content, type = 'key-points') { return this.summaryService.summarizeText(content, type); }
  async checkSummarizerAvailability() { return this.summaryService.checkSummarizerAvailability(); }
  
  // Prompt API (for direct access if needed)
  async customPrompt(userPrompt, noteContent = '', options = {}) {
    return this.promptAPIService.customPrompt(userPrompt, noteContent, options);
  }

  // Utility methods
  hasCapability(capability) { return this.capabilities.has(capability); }
  dispatchAIEvent(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
}

const aiService = new AIService();
export default aiService;