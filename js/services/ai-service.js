// Re-export the new centralized AI handler for backward compatibility
import aiHandler from './ai-handler.js';

class AIService {
  constructor() {
    // Delegate to the new AI handler
    this.aiHandler = aiHandler;
  }

  async init() {
    return this.aiHandler.init();
  }

  // Delegate all methods to the AI handler for backward compatibility
  
  // Voice Commands
  startAmbientListening() {
    return this.aiHandler.startAmbientListening();
  }

  stopAmbientListening() {
    return this.aiHandler.stopAmbientListening();
  }

  async startListening(options) {
    return this.aiHandler.startListening(options);
  }

  stopListening() {
    return this.aiHandler.stopListening();
  }

  // AI Chat and Prompts
  async customPrompt(userPrompt, noteContent = '', options = {}) {
    return this.aiHandler.customPrompt(userPrompt, noteContent, options);
  }

  async structuredPrompt(prompt, schema, options = {}) {
    return this.aiHandler.structuredPrompt(prompt, schema, options);
  }

  async streamPrompt(prompt, onChunk, systemPrompt = null, options = {}) {
    return this.aiHandler.streamPrompt(prompt, onChunk, systemPrompt, options);
  }

  // Session Management
  async startAIChat(systemPrompt) {
    return this.aiHandler.startAIChat(systemPrompt);
  }

  async chatWithAI(message, options = {}) {
    return this.aiHandler.chatWithAI(message, options);
  }

  async chatWithStreaming(message, onChunk, options = {}) {
    return this.aiHandler.chatWithStreaming(message, onChunk, options);
  }

  endAIChat() {
    return this.aiHandler.endAIChat();
  }

  async createPersistentSession(systemPrompt, options) {
    return this.aiHandler.createPersistentSession(systemPrompt, options);
  }

  async promptPersistentSession(prompt, options) {
    return this.aiHandler.promptPersistentSession(prompt, options);
  }

  destroyPersistentSession() {
    return this.aiHandler.destroyPersistentSession();
  }

  getSessionUsage() {
    return this.aiHandler.getSessionUsage();
  }

  // Proofreading
  async proofreadText(content) {
    return this.aiHandler.proofreadText(content);
  }

  async proofreadTextWithDetails(content) {
    return this.aiHandler.proofreadTextWithDetails(content);
  }

  // Summarization
  async summarizeText(content, type = 'key-points') {
    return this.aiHandler.summarizeText(content, type);
  }

  async summarizeNotes(notes, type = 'overview') {
    return this.aiHandler.summarizeNotes(notes, type);
  }

  async extractKeyInsights(content) {
    return this.aiHandler.extractKeyInsights(content);
  }

  // Metadata
  async extractNoteMetadata(content) {
    return this.aiHandler.extractNoteMetadata(content);
  }

  // Utility methods
  hasCapability(capability) {
    return this.aiHandler.hasCapability(capability);
  }

  getCapabilities() {
    return this.aiHandler.getCapabilities();
  }

  getStatus() {
    return this.aiHandler.getStatus();
  }

  dispatchAIEvent(name, detail) {
    return this.aiHandler.dispatchAIEvent(name, detail);
  }
}

const aiService = new AIService();
export default aiService;