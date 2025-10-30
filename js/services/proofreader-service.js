import promptAPIService from './promptapi-service.js';

class ProofreaderService {
  constructor() {
    this.promptAPIService = promptAPIService;
    this.currentAbortController = null;
    this.lastProofreadTime = 0;
    this.minTimeBetweenRequests = 1000;
    console.log("[ProofreaderService] Initialized with language specifications (expectedInputLanguages/expectedOutputLanguages)");
  }

  async checkAvailability() {
    try {
      // Robustly check for the API and catch any crashes.
      if (!('Proofreader' in self)) {
        return { available: false, reason: "Proofreader API is not available." };
      }
      const availability = await Proofreader.availability();
      if (availability === 'available' || availability === 'downloadable') {
        return { available: true };
      }
      return { available: false, reason: `Proofreader is unavailable. Status: ${availability}` };
    } catch (error) {
      console.error("CRITICAL: Proofreader.availability() check failed, likely due to a model crash.", error);
      return { available: false, reason: `Proofreader check failed catastrophically: ${error.message}` };
    }
  }

  async proofreadText(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 3) { return content; }
    const systemPrompt = "You are a professional proofreader. Correct spelling and grammar errors while preserving the original meaning and style.";
    const prompt = `Proofread and correct the following text. Return ONLY the corrected text without any explanations:\n\n${cleanContent}`;
    try {
      const correctedText = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      return correctedText.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      console.error("Proofreading fallback error:", error);
      throw error;
    }
  }

  async proofreadTextWithDetails(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').filter(Boolean).length < 3) {
      return { corrected: content, corrections: [], hasCorrections: false };
    }
    const now = Date.now();
    if (now - this.lastProofreadTime < this.minTimeBetweenRequests) {
      return { corrected: content, corrections: [], hasCorrections: false, skipped: true };
    }
    this.lastProofreadTime = now;
    if (this.currentAbortController) { this.currentAbortController.abort(); }
    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;
    const proofreaderAvailability = await this.checkAvailability();
    if (proofreaderAvailability.available) {
      try {
        if (signal.aborted) { return { corrected: content, corrections: [], hasCorrections: false, aborted: true }; }
        return await this._proofreadWithAPI(cleanContent, signal);
      } catch (error) {
        if (error.name === 'AbortError') { return { corrected: content, corrections: [], hasCorrections: false, aborted: true }; }
        console.warn("Proofreader API failed, falling back to generic AI:", error);
      }
    }
    // Fallback logic
    console.log("Proofreader API unavailable, falling back to general Prompt API for proofreading.");
    try {
      if (signal.aborted) { return { corrected: content, corrections: [], hasCorrections: false, aborted: true }; }
      const correctedText = await this.proofreadText(cleanContent);
      return { corrected: correctedText, corrections: [], hasCorrections: correctedText.trim() !== cleanContent.trim() };
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('AbortError')) { return { corrected: content, corrections: [], hasCorrections: false, aborted: true }; }
      console.error("Fallback proofreading failed:", error);
      throw error;
    } finally {
      if (this.currentAbortController && this.currentAbortController.signal === signal) { this.currentAbortController = null; }
    }
  }

  async _proofreadWithAPI(content, signal = null) {
    this.dispatchEvent("proofreader-status-update", { status: "processing", message: "AI is proofreading..." });
    let session = null;
    try {
      if (signal && signal.aborted) { throw new DOMException('Request was aborted', 'AbortError'); }
      // Specify expected inputs and outputs with language codes to avoid Chrome warnings
      session = await Proofreader.create({
        expectedInputLanguages: ["en"],
        expectedOutputLanguages: ["en"],
        monitor: (m) => {
          m.addEventListener("downloadprogress", e => {
            if (!window._isAiModelDownloading) {
              window._isAiModelDownloading = true;
              this.dispatchEvent("prompt-status-update", { status: "checking", message: `Downloading AI model...` });
            }
            if (e.loaded >= e.total) {
              window._isAiModelDownloading = false;
            }
          });
        }
      });
      if (signal && signal.aborted) { throw new DOMException('Request was aborted', 'AbortError'); }
      const proofreadResult = await session.proofread(content);
      this.dispatchEvent("proofreader-status-update", { status: "ready", message: "Proofreading complete" });
      return { corrected: proofreadResult.corrected, corrections: proofreadResult.corrections, hasCorrections: proofreadResult.corrections.length > 0 };
    } catch (error) {
      if (error.name !== 'AbortError') { console.error("Proofreader API execution error:", error); }
      this.dispatchEvent("proofreader-status-update", { status: "error", message: `Proofreading Error: ${error.message}` });
      if (window._isAiModelDownloading) window._isAiModelDownloading = false;
      throw error;
    } finally {
      if (session) {
        try { session.destroy(); } catch (e) { console.warn("Failed to destroy proofreader session:", e); }
      }
    }
  }

  dispatchEvent(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
}

const proofreaderService = new ProofreaderService();
export default proofreaderService;