// js/services/promptapi-service.js

// IMPORTANT: This key is a placeholder and should be replaced by the user.
const PROMPT_API_KEY = 'YOUR_PROMPT_API_KEY_REPLACE_ME';

// --- Mock Implementation ---
// This mock simulates the behavior of a real API for development and testing.
// It introduces a fake delay to mimic network latency.

const MOCK_API_DELAY = 800; // ms

function mockApiCall(data) {
  return new Promise(resolve => setTimeout(() => resolve(data), MOCK_API_DELAY));
}

async function search(query) {
  if (PROMPT_API_KEY === 'YOUR_PROMPT_API_KEY_REPLACE_ME') {
    console.warn("Using mock search API. Please set a real PromptAPI key.");
    const mockResults = [
      { title: `Result for "${query}"`, snippet: "This is a mock search result." },
      { title: "Another Result", snippet: "This is another mock search result." },
    ];
    return mockApiCall(mockResults);
  }
  // TODO: Implement real API call here
  return [];
}

async function summarize(text) {
  if (PROMPT_API_KEY === 'YOUR_PROMPT_API_KEY_REPLACE_ME') {
    console.warn("Using mock summarization API. Please set a real PromptAPI key.");
    const wordCount = text.split(' ').filter(Boolean).length;
    const summary = wordCount > 10
      ? `This is a mock summary of a note with ${wordCount} words. It appears to be about... well, something.`
      : "This note is too short to summarize.";
    return mockApiCall(summary);
  }
  // TODO: Implement real API call here
  return "Summarization is not available.";
}

async function proofread(text) {
  if (PROMPT_API_KEY === 'YOUR_PROMPT_API_KEY_REPLACE_ME') {
    console.warn("Using mock proofreading API. Please set a real PromptAPI key.");
    const words = text.split(' ').filter(Boolean);
    const mockCorrections = [];
    if (text.toLowerCase().includes('mistoke')) {
      mockCorrections.push({
        original: 'mistoke',
        correction: 'mistake',
        explanation: 'This is a common spelling error.',
      });
    }
    return mockApiCall({
      corrections: mockCorrections,
      stats: {
        words: words.length,
        errors: mockCorrections.length,
      },
    });
  }
  // TODO: Implement real API call here
  return { corrections: [], stats: { words: text.split(' ').filter(Boolean).length, errors: 0 } };
}

export { search, summarize, proofread };
