import promptAPIService from './promptapi-service.js';

class SummaryService {
  constructor() {
    this.promptAPIService = promptAPIService;
  }

  async checkSummarizerAvailability() {
    try {
      // Check if the Summarizer API is available
      if (!('Summarizer' in self)) {
        return { available: false, reason: "Chrome Summarizer API is not available." };
      }

      // Check availability status
      const availability = await Summarizer.availability();

      if (availability === 'unavailable') {
        return { available: false, reason: "Chrome Summarizer API is not available on this device." };
      }

      if (availability === 'downloadable') {
        return { available: false, reason: "Chrome Summarizer model needs to be downloaded. The download will start automatically when you first use summarization." };
      }

      return { available: true };
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
      // Try Summarizer API first (if available)
      const summarizerAvailability = await this.checkSummarizerAvailability();
      if (summarizerAvailability.available) {
        const summarizerType = type === 'concise' ? 'tl;dr' : 'key-points';
        const summarizer = await Summarizer.create({
          type: summarizerType,
          format: 'markdown',
          length: type === 'detailed' ? 'long' : 'medium'
        });
        const summary = await summarizer.summarize(cleanContent);
        this.dispatchEvent("summary-status-update", { status: "ready", message: "Summary complete" });
        return summary;
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

      const summary = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      this.dispatchEvent("summary-status-update", { status: "ready", message: "Summary complete" });
      return summary;

    } catch (error) {
      console.error("Summarization error:", error);
      this.dispatchEvent("summary-status-update", { status: "error", message: `AI Error: ${error.message}` });
      throw error;
    }
  }

  async summarizeNotes(notes, type = 'overview') {
    if (!notes || notes.length === 0) {
      return "No notes to summarize.";
    }

    // Combine all note content
    const combinedContent = notes.map(note => {
      const title = note.title || 'Untitled';
      const content = note.content || '';
      return `## ${title}\n${content}`;
    }).join('\n\n');

    const cleanContent = combinedContent.replace(/<[^>]*>/g, " ").trim().substring(0, 5000);

    this.dispatchEvent("summary-status-update", { status: "processing", message: "Summarizing notes collection..." });

    try {
      let systemPrompt, prompt;

      switch (type) {
        case 'overview':
          systemPrompt = "You are a helpful assistant that creates comprehensive overviews of note collections.";
          prompt = `Create an overview summary of this collection of notes in markdown format:

**Guidelines:**
- Provide a high-level overview of the main themes
- Identify connections between different notes
- Highlight key insights and patterns
- Use proper markdown formatting
- Organize by themes or topics if appropriate

**Notes Collection:**
${cleanContent}

**Overview Summary:**`;
          break;

        case 'detailed':
          systemPrompt = "You are a helpful assistant that creates detailed analysis of note collections.";
          prompt = `Create a detailed analysis of this collection of notes:

**Guidelines:**
- Analyze each major topic or theme
- Show relationships between different notes
- Extract key insights and conclusions
- Provide actionable takeaways
- Use markdown headers and bullet points

**Notes Collection:**
${cleanContent}

**Detailed Analysis:**`;
          break;

        case 'topics':
          systemPrompt = "You are a helpful assistant that organizes content by topics and themes.";
          prompt = `Organize this collection of notes by topics and themes:

**Guidelines:**
- Group related content under topic headers
- Identify main themes across all notes
- Summarize key points for each topic
- Use markdown formatting for clarity
- Show connections between topics

**Notes Collection:**
${cleanContent}

**Topic-Based Summary:**`;
          break;

        default:
          return await this.summarizeText(cleanContent, type);
      }

      const summary = await this.promptAPIService.runPrompt(prompt, systemPrompt);
      this.dispatchEvent("summary-status-update", { status: "ready", message: "Notes summary complete" });
      return summary;

    } catch (error) {
      console.error("Notes summarization error:", error);
      this.dispatchEvent("summary-status-update", { status: "error", message: `Notes Summary Error: ${error.message}` });
      throw error;
    }
  }

  async extractKeyInsights(content) {
    const cleanContent = content.replace(/<[^>]*>/g, " ").trim().substring(0, 3000);
    if (cleanContent.split(' ').length < 10) {
      return ["Content too short for insight extraction."];
    }

    const systemPrompt = "You are an expert at extracting key insights and actionable information from text.";
    const prompt = `Extract key insights from the following text. Return as a JSON array of strings, each representing one key insight:

**Text:**
${cleanContent}

**Instructions:**
- Focus on actionable insights and important takeaways
- Keep each insight concise but meaningful
- Return 3-7 insights maximum
- Format as valid JSON array only`;

    try {
      const response = await this.promptAPIService.structuredPrompt(prompt, {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 7
      });

      return Array.isArray(response) ? response : [response];
    } catch (error) {
      console.error("Insight extraction error:", error);
      // Fallback to simple summary
      const fallbackSummary = await this.summarizeText(content, 'concise');
      return [fallbackSummary];
    }
  }

  dispatchEvent(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

const summaryService = new SummaryService();
export default summaryService;