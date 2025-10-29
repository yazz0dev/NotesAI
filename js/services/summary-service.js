import promptAPIService from './promptapi-service.js';

class SummaryService {
  constructor() {
    this.promptAPIService = promptAPIService;
  }

  async checkSummarizerAvailability() {
    try {
      if (!('Summarizer' in self)) {
        return { available: false, reason: "Chrome Summarizer API is not available." };
      }
      const availability = await Summarizer.availability();
      if (availability === 'available' || availability === 'downloadable') {
        return { available: true };
      }
      return { available: false, reason: `Summarizer is unavailable. Status: ${availability}` };
    } catch (error) {
      console.error("Summarizer availability check error:", error);
      return { available: false, reason: `Summarizer check failed: ${error.message}` };
    }
  }

  async summarizeText(content, type = 'key-points') {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 20) {
      return "This note is too short to summarize.";
    }
    this.dispatchEvent("summary-status-update", { status: "processing", message: "AI is summarizing..." });
    try {
      const summarizerAvailability = await this.checkSummarizerAvailability();
      if (summarizerAvailability.available) {
        const summarizerType = type === 'concise' ? 'tldr' : 'key-points';
        // FINAL FIX: Added `expectedInputLanguages` and global download flag logic.
        const summarizer = await Summarizer.create({
          type: summarizerType,
          format: 'markdown',
          length: type === 'detailed' ? 'long' : 'medium',
          expectedInputLanguages: ['en'],
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
          }
        });
        const summary = await summarizer.summarize(cleanContent);
        this.dispatchEvent("summary-status-update", { status: "ready", message: "Summary complete" });
        return summary;
      }
      // Fallback logic
      console.log("Summarizer API unavailable, falling back to general Prompt API.");
      const systemPrompt = "You are a helpful assistant that creates well-structured summaries in markdown format.";
      const prompt = `Please provide a concise summary of the following text in well-formatted markdown using bullet points:\n\n${cleanContent}`;
      const summary = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      this.dispatchEvent("summary-status-update", { status: "ready", message: "Summary complete" });
      return summary;
    } catch (error) {
      console.error("Summarization error:", error);
      this.dispatchEvent("summary-status-update", { status: "error", message: `AI Error: ${error.message}` });
      if (window._isAiModelDownloading) window._isAiModelDownloading = false;
      throw error;
    }
  }

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const summaryService = new SummaryService();
export default summaryService;