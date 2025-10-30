import promptAPIService from './promptapi-service.js';

class SummaryService {
  constructor() {
    this.promptAPIService = promptAPIService;
    console.log("[SummaryService] Initialized with language specifications (expectedInputLanguages/expectedOutputLanguages)");
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
    
    // Retry logic for offline AI models
    const maxRetries = 2;
    let lastError = null;
    
    try {
      const summarizerAvailability = await this.checkSummarizerAvailability();
      if (summarizerAvailability.available) {
        // Try Summarizer API with retry
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[SummaryService] Attempt ${attempt}/${maxRetries} to use Summarizer API`);
            const summarizerType = type === 'concise' ? 'tldr' : 'key-points';
            const summarizer = await Summarizer.create({
              type: summarizerType,
              format: 'markdown',
              length: type === 'detailed' ? 'long' : 'medium',
              expectedInputLanguages: ['en'],
              expectedOutputLanguages: ['en'],
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
          } catch (error) {
            lastError = error;
            console.warn(`[SummaryService] Summarizer attempt ${attempt} failed:`, error.message);
            if (attempt < maxRetries) {
              // Wait before retrying (exponential backoff)
              await new Promise(resolve => setTimeout(resolve, attempt * 500));
            }
          }
        }
      }
      
      // Fallback to PromptAPI
      console.log("[SummaryService] Summarizer unavailable, falling back to PromptAPI");
      const systemPrompt = "You are a helpful assistant that creates well-structured summaries in markdown format.";
      const prompt = `Please provide a concise summary of the following text in well-formatted markdown using bullet points:\n\n${cleanContent}`;
      const summary = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      this.dispatchEvent("summary-status-update", { status: "ready", message: "Summary complete" });
      return summary;
    } catch (error) {
      console.error("[SummaryService] Summarization error:", error);
      this.dispatchEvent("summary-status-update", { status: "error", message: `AI Error: ${error.message}` });
      if (window._isAiModelDownloading) window._isAiModelDownloading = false;
      throw error;
    }
  }

  async generateNoticeBoardSummary(notes) {
    if (!notes || notes.length === 0) {
      return "No notes provided for summary.";
    }

    const systemPrompt = `You are an assistant creating a summary for a user's notice board. Extract actionable items, deadlines, and key info. Format output using simple markdown (headings, bold, lists). When mentioning an item from a note, you MUST reference it using the format [Note ID: note-id-here] at the end of the line. If notes are empty, say so.`;

    const notesContent = notes.map(note => {
      const cleanContent = note.content.replace(/<[^>]*>/g, " ").trim().substring(0, 500);
      return `
---
Note ID: ${note.id}
Title: ${note.title}
Content:
${cleanContent}
---
        `;
    }).join('\n');

    const userPrompt = `Generate a notice board summary from these notes:\n\n${notesContent}`;

    this.dispatchEvent("summary-status-update", { status: "processing", message: "Updating Notice Board..." });
    
    // Retry logic for offline AI (handles model crashes gracefully)
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[SummaryService] Attempt ${attempt}/${maxRetries} to generate notice board summary with PromptAPI`);
        const summary = await this.promptAPIService.runPrompt(userPrompt, systemPrompt);
        this.dispatchEvent("summary-status-update", { status: "ready", message: "Notice Board updated" });
        return summary;
      } catch (error) {
        lastError = error;
        console.warn(`[SummaryService] Attempt ${attempt} failed:`, error.message);
        
        // If this is the last attempt, use fallback
        if (attempt === maxRetries) {
          console.log("[SummaryService] All retry attempts failed, using fallback summary");
          break;
        }
        
        // Wait before retrying (exponential backoff: 500ms, 1000ms, 1500ms)
        const delay = attempt * 500;
        console.log(`[SummaryService] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Fallback: Generate a simple summary without AI
    console.log("[SummaryService] Using fallback summary generation");
    try {
      const fallbackSummary = this.generateFallbackSummary(notes);
      this.dispatchEvent("summary-status-update", { status: "ready", message: "Notice Board (Offline Mode)" });
      return fallbackSummary;
    } catch (fallbackError) {
      console.error("[SummaryService] Fallback summary generation failed:", fallbackError);
      this.dispatchEvent("summary-status-update", { status: "error", message: `Notice Board: ${lastError.message}` });
      throw lastError;
    }
  }

  generateFallbackSummary(notes) {
    /**
     * Generates a basic summary without AI when both Summarizer and PromptAPI are unavailable
     * Extracts titles and first 100 chars of content
     */
    if (!notes || notes.length === 0) {
      return "## Notice Board\n\nNo notes available.";
    }

    let summary = "## Notice Board (Offline Mode)\n\n";
    summary += `*Last updated: ${new Date().toLocaleString()}*\n\n`;
    
    notes.forEach((note, index) => {
      const cleanContent = note.content.replace(/<[^>]*>/g, " ").trim().substring(0, 150);
      summary += `### ${index + 1}. ${note.title}\n`;
      summary += `${cleanContent}${cleanContent.length >= 150 ? '...' : ''}\n`;
      summary += `[Note ID: ${note.id}]\n\n`;
    });
    
    return summary;
  }

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const summaryService = new SummaryService();
export default summaryService;