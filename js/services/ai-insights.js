// js/ai-insights.js
// AI-powered insights for notes including sentiment analysis and topic modeling

import { getCachedResult, setCachedResult } from "../utils/cache.js";

// Persistent session management for improved performance
let globalAISession = null;
let sessionCreationPromise = null;

/**
 * Gets or creates a persistent AI session for better performance
 * @returns {Promise<Object>} AI session object
 */
async function getAISession() {
  if (globalAISession) {
    return globalAISession;
  }

  if (sessionCreationPromise) {
    return await sessionCreationPromise;
  }

  sessionCreationPromise = (async () => {
    try {
      if (!("LanguageModel" in self)) {
        throw new Error("LanguageModel not available");
      }

      globalAISession = await LanguageModel.create({
        expectedOutputs: [
          {
            type: "text",
            languages: ["en"],
          },
        ],
      });

      return globalAISession;
    } catch (error) {
      sessionCreationPromise = null;
      throw error;
    }
  })();

  return await sessionCreationPromise;
}

/**
 * Destroys the global AI session
 */
function destroyAISession() {
  if (globalAISession) {
    try {
      globalAISession.destroy();
    } catch (error) {
      console.warn("Error destroying AI session:", error);
    }
    globalAISession = null;
  }
  sessionCreationPromise = null;
}

/**
 * Cleans Chrome AI API response by removing markdown formatting
 * @param {string} response - Raw response from Chrome AI API
 * @returns {string} Clean JSON string
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

/**
 * Analyzes the sentiment of a note using Chrome AI
 * @param {string} content - The note content (HTML)
 * @returns {Promise<Object>} Sentiment analysis result
 */
export async function analyzeSentiment(content) {
  try {
    // Strip HTML tags for better analysis
    const textContent = content.replace(/<[^>]*>/g, "").trim();

    if (!textContent) {
      return { sentiment: "neutral", confidence: 0, emoji: "😐" };
    }

    // Check cache first for performance
    const cached = getCachedResult("sentiment", textContent);
    if (cached) {
      return cached;
    }

    // Get persistent session for better performance
    const session = await getAISession();

    const sentimentPrompt =
      'Analyze sentiment: "' +
      textContent +
      '". JSON: {"sentiment":"positive|negative|neutral","confidence":0.0-1.0,"emoji":"😊|😞|😐","keywords":["word1","word2"]}';

    const result = await session.prompt(sentimentPrompt);
    const cleanedResult = cleanAIResponse(result);

    let analysis;
    try {
      analysis = JSON.parse(cleanedResult);
    } catch (parseError) {
      console.warn(
        "Failed to parse AI response as JSON, using fallback:",
        cleanedResult
      );
      // Fallback: try to extract sentiment from text response
      const text = cleanedResult.toLowerCase();
      let sentiment = "neutral";
      if (
        text.includes("positive") ||
        text.includes("good") ||
        text.includes("happy")
      ) {
        sentiment = "positive";
      } else if (
        text.includes("negative") ||
        text.includes("bad") ||
        text.includes("sad")
      ) {
        sentiment = "negative";
      }

      analysis = {
        sentiment: sentiment,
        confidence: 0.5,
        emoji:
          sentiment === "positive"
            ? "😊"
            : sentiment === "negative"
            ? "😞"
            : "😐",
        keywords: [],
      };
    }

    // Validate and set defaults
    const sentimentResult = {
      sentiment: ["positive", "negative", "neutral"].includes(
        analysis.sentiment
      )
        ? analysis.sentiment
        : "neutral",
      confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
      emoji: analysis.emoji || "😐",
      keywords: Array.isArray(analysis.keywords)
        ? analysis.keywords.slice(0, 4)
        : [],
    };

    // Cache the result
    setCachedResult("sentiment", textContent, {}, sentimentResult);

    return sentimentResult;
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return { sentiment: "neutral", confidence: 0, emoji: "😐", keywords: [] };
  }
}

/**
 * Extracts topics and themes from a note
 * @param {string} content - The note content (HTML)
 * @returns {Promise<Array>} Array of detected topics/tags
 */
export async function extractTopics(content) {
  try {
    // Strip HTML tags for better analysis
    const textContent = content.replace(/<[^>]*>/g, "").trim();

    if (!textContent) {
      return [];
    }

    // Check cache first
    const cachedTopics = getCachedResult("topics", textContent);
    if (cachedTopics) {
      return cachedTopics;
    }

    // Get persistent session for better performance
    const session = await getAISession();

    const topicPrompt =
      'Extract 2-5 topics from: "' +
      textContent +
      '". JSON array: ["topic1", "topic2"]';

    const result = await session.prompt(topicPrompt);
    const cleanedResult = cleanAIResponse(result);
    const topics = JSON.parse(cleanedResult);

    // Cache the result for future use
    setCachedResult("topics", textContent, {}, topics);

    // Validate and filter
    const validTopics = Array.isArray(topics)
      ? topics
          .filter((topic) => typeof topic === "string" && topic.length > 0)
          .slice(0, 5)
      : [];

    return validTopics;
  } catch (error) {
    console.error("Error extracting topics:", error);
    return [];
  }
}

/**
 * Extracts the first image from a note's HTML content
 * @param {string} htmlContent - The HTML content of the note
 * @returns {string|null} The src of the first image, or null if no images found
 */
export function extractFirstImage(htmlContent) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, "text/html");
    const firstImage = doc.querySelector("img");
    return firstImage ? firstImage.src : null;
  } catch (error) {
    console.error("Error extracting image:", error);
    return null;
  }
}

// Export session management functions for cleanup
export { destroyAISession };
