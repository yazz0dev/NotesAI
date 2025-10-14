// js/utils/ai-utils.js

/**
 * Cleans Chrome AI API response by removing markdown formatting
 * @param {string} response - Raw response from Chrome AI API
 * @returns {string} Clean JSON string or text
 */
function cleanAIResponse(response) {
  if (!response) return "";

  // Remove markdown code block markers and extra whitespace
  let cleaned = response
    .replace(/```json\s*/gi, "") // Remove ```json (case insensitive)
    .replace(/```\s*/g, "") // Remove ```
    .replace(/`+/g, "") // Remove any remaining backticks
    .trim();

  // Remove any leading/trailing whitespace and newlines
  cleaned = cleaned.replace(/^\s+|\s+$/g, "");

  return cleaned;
}

// Make function available globally for Vue.js compatibility
window.cleanAIResponse = cleanAIResponse;
