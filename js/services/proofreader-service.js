import promptAPIService from './promptapi-service.js';

class ProofreaderService {
  constructor() {
    this.promptAPIService = promptAPIService;
  }

  async checkAvailability() {
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

  async proofreadText(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 3) {
      return content; // Not enough to proofread, return original
    }

    const systemPrompt = "You are a professional proofreader. Correct spelling and grammar errors while preserving the original meaning and style.";
    const prompt = `Proofread and correct the following text. Return ONLY the corrected text without any explanations:\n\n${cleanContent}`;
    
    try {
      const correctedText = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      // Clean up any potential formatting from the AI response
      return correctedText.trim().replace(/^["']|["']$/g, '');
    } catch (error) {
      console.error("Proofreading fallback error:", error);
      throw error;
    }
  }

  async proofreadTextWithDetails(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 3) {
      return { corrected: content, corrections: [], hasCorrections: false }; // Not enough to proofread
    }

    // First try the new Proofreader API
    const proofreaderAvailability = await this.checkAvailability();
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
    this.dispatchEvent("proofreader-status-update", { status: "processing", message: "AI is proofreading..." });

    try {
      // Create proofreader session with download progress monitoring and language specification
      const session = await Proofreader.create({
        sharedContext: 'This is a note-taking application. Proofread for grammar, spelling, and clarity.',
        correctionExplanationLanguage: 'en',
        expectedInputLanguagues: ['en'],
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

      // Run proofreading with context
      const proofreadResult = await session.proofread(content, {
        context: 'Note content that may contain informal writing, bullet points, or lists.'
      });

      // Clean up session
      session.destroy();

      this.dispatchEvent("proofreader-status-update", { status: "ready", message: "Proofreading complete" });

      return {
        corrected: proofreadResult.corrected,
        corrections: proofreadResult.corrections,
        hasCorrections: proofreadResult.corrections.length > 0
      };
    } catch (error) {
      console.error("Proofreader API execution error:", error);
      this.dispatchEvent("proofreader-status-update", { status: "error", message: `Proofreading Error: ${error.message}` });
      throw error;
    }
  }

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const proofreaderService = new ProofreaderService();
export default proofreaderService;