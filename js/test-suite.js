// js/test-suite.js - AI Notes Test Suite
// Optimized version that integrates with main app services

import { getAISession } from "./services/ai-service.js";
import { cleanAIResponse } from "./utils/ai-utils.js";

// Performance tracking for test suite
let operationCount = 0;
let totalLatency = 0;
let sessionCreationTime = 0;
let startTime = Date.now();

/**
 * Enhanced performance-aware AI operation wrapper
 */
async function performAIOperation(prompt) {
  const opStart = performance.now();
  const session = await getAISession();
  const result = await session.prompt(prompt);
  const latency = performance.now() - opStart;

  operationCount++;
  totalLatency += latency;

  return result;
}

/**
 * Performance metrics for the test suite
 */
function getPerformanceMetrics() {
  const avgLatency =
    operationCount > 0 ? (totalLatency / operationCount).toFixed(2) : 0;
  const uptime = ((Date.now() - startTime) / 1000).toFixed(1);
  const sessionStatus = "Active (reused)"; // Using main app's persistent session

  return {
    sessionStatus,
    sessionCreationTime,
    operationCount,
    avgLatency,
    uptime,
    totalLatency: totalLatency.toFixed(2),
  };
}

/**
 * Reset performance metrics
 */
function resetPerformanceMetrics() {
  operationCount = 0;
  totalLatency = 0;
  sessionCreationTime = 0;
}

/**
 * Chrome AI Availability Check
 */
async function checkChromeAIAvailability() {
  try {
    if ("LanguageModel" in self) {
      return {
        available: true,
        message: `✅ Chrome LanguageModel API is available!\n\nOptimized features:\n- Persistent session management\n- Performance monitoring\n- Reduced latency\n- Enhanced caching\n\nAvailable methods:\n- LanguageModel.create()\n- session.prompt()\n- session.destroy()`,
      };
    } else {
      return {
        available: false,
        message: `❌ Chrome LanguageModel API is not available.\n\nTo enable:\n1. Go to chrome://flags\n2. Enable "Experimental Web Platform features"\n3. Enable "Prompt API for Gemini Nano"\n4. Restart Chrome\n5. Serve this page from localhost`,
      };
    }
  } catch (error) {
    return {
      available: false,
      message: `❌ Error checking Chrome AI: ${error.message}`,
    };
  }
}

/**
 * Command Parsing Test
 */
async function testCommandParsing(command) {
  if (!command?.trim()) {
    return { success: false, message: "❌ Please enter a command to test" };
  }

  try {
    const commandPrompt = `Analyze: "${command}". JSON: {"action":"create_note|search_notes|delete_current|edit_current|add_image|go_back|stop_listening","params":{"query":"text"}}`;

    const result = await performAIOperation(commandPrompt);
    const cleanedResult = cleanAIResponse(result);
    const parsedCommand = JSON.parse(cleanedResult);

    return {
      success: true,
      message: `✅ Command parsed successfully!\n\nInput: "${command}"\n\nOutput: ${JSON.stringify(
        parsedCommand,
        null,
        2
      )}`,
      data: parsedCommand,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error parsing command: ${error.message}`,
    };
  }
}

/**
 * Sentiment Analysis Test
 */
async function testSentimentAnalysis(text) {
  if (!text?.trim()) {
    return { success: false, message: "❌ Please enter text to analyze" };
  }

  try {
    const textContent = text.replace(/<[^>]*>/g, "").trim();
    const sentimentPrompt = `Sentiment: "${textContent}". JSON: {"sentiment":"positive|negative|neutral","confidence":0.0-1.0,"emoji":"😊|😞|😐","keywords":["word1","word2"]}`;

    const result = await performAIOperation(sentimentPrompt);
    const cleanedResult = cleanAIResponse(result);
    const analysis = JSON.parse(cleanedResult);

    const sentiment = ["positive", "negative", "neutral"].includes(
      analysis.sentiment
    )
      ? analysis.sentiment
      : "neutral";
    const confidence = Math.max(0, Math.min(1, analysis.confidence || 0.5));
    const emoji = analysis.emoji || "😐";
    const keywords = Array.isArray(analysis.keywords)
      ? analysis.keywords.slice(0, 4)
      : [];

    return {
      success: true,
      message: `✅ Sentiment analysis completed!\n\nText: "${text.substring(
        0,
        100
      )}${
        text.length > 100 ? "..." : ""
      }"\n\nResult: ${sentiment} ${emoji}\nConfidence: ${Math.round(
        confidence * 100
      )}%\nKeywords: ${keywords.join(", ") || "none"}`,
      data: { sentiment, confidence, emoji, keywords },
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error analyzing sentiment: ${error.message}`,
    };
  }
}

/**
 * Topic Extraction Test
 */
async function testTopicExtraction(text) {
  if (!text?.trim()) {
    return { success: false, message: "❌ Please enter text to analyze" };
  }

  try {
    const textContent = text.replace(/<[^>]*>/g, "").trim();
    const topicPrompt = `Extract 2-5 topics from: "${textContent}". JSON array: ["topic1","topic2"]`;

    const result = await performAIOperation(topicPrompt);
    const cleanedResult = cleanAIResponse(result);
    const topics = JSON.parse(cleanedResult);

    const validTopics = Array.isArray(topics)
      ? topics
          .filter((topic) => typeof topic === "string" && topic.length > 0)
          .slice(0, 5)
      : [];

    return {
      success: true,
      message: `✅ Topics extracted successfully!\n\nText: "${text.substring(
        0,
        100
      )}${text.length > 100 ? "..." : ""}"\n\nTopics: ${
        validTopics.length > 0
          ? validTopics.map((t) => `"${t}"`).join(", ")
          : "none found"
      }`,
      data: validTopics,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error extracting topics: ${error.message}`,
    };
  }
}

/**
 * Mood Insights Test - Enhanced version
 */
async function testMoodInsights(entries) {
  if (!entries?.length || entries.every((entry) => !entry.content?.trim())) {
    return {
      success: false,
      message: "❌ Please add at least one note with content",
    };
  }

  try {
    const sentimentPromises = entries.map(async (entry) => {
      const textContent = entry.content.replace(/<[^>]*>/g, "").trim();
      const sentimentPrompt = `Sentiment: "${textContent}". JSON: {"sentiment":"positive|negative|neutral","confidence":0.0-1.0,"emoji":"😊|😞|😐","keywords":["word1","word2"]}`;

      const result = await performAIOperation(sentimentPrompt);
      const cleanedResult = cleanAIResponse(result);
      const analysis = JSON.parse(cleanedResult);

      return {
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
        title: entry.title,
      };
    });

    const sentiments = await Promise.all(sentimentPromises);

    // Calculate mood distribution
    const moodCounts = sentiments.reduce((acc, s) => {
      acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
      return acc;
    }, {});

    const totalEntries = sentiments.length;
    const positiveRatio = (moodCounts.positive || 0) / totalEntries;
    const negativeRatio = (moodCounts.negative || 0) / totalEntries;

    let pattern = "balanced";
    if (positiveRatio > 0.6) pattern = "mostly_positive";
    else if (negativeRatio > 0.6) pattern = "mostly_negative";
    else if (positiveRatio > negativeRatio * 1.5) pattern = "leaning_positive";
    else if (negativeRatio > positiveRatio * 1.5) pattern = "leaning_negative";

    return {
      success: true,
      message:
        `✅ Mood insights generated!\n\nAnalyzed ${totalEntries} notes:\n` +
        `• Positive: ${moodCounts.positive || 0} (${Math.round(
          positiveRatio * 100
        )}%)\n` +
        `• Negative: ${moodCounts.negative || 0} (${Math.round(
          negativeRatio * 100
        )}%)\n` +
        `• Neutral: ${moodCounts.neutral || 0} (${Math.round(
          (1 - positiveRatio - negativeRatio) * 100
        )}%)\n\n` +
        `Pattern: ${pattern.replace("_", " ")}\n\n` +
        `Individual results:\n${sentiments
          .map((s) => `• "${s.title}": ${s.sentiment} ${s.emoji}`)
          .join("\n")}`,
      data: { sentiments, pattern, moodCounts },
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error generating mood insights: ${error.message}`,
    };
  }
}

/**
 * Initialize test suite with prewarming
 */
async function initTestSuite() {
  try {
    // Prewarm AI session for better first-call performance
    await getAISession();
    console.log("✅ Test suite initialized with AI session prewarmed");
    return true;
  } catch (error) {
    console.log("❌ Test suite initialization failed:", error.message);
    return false;
  }
}

/**
 * Cleanup function for test suite
 */
function cleanupTestSuite() {
  // Cleanup is handled by main app's AI service
  console.log("✅ Test suite cleanup completed");
}

// Make functions available globally for Vue.js compatibility
window.getPerformanceMetrics = getPerformanceMetrics;
window.resetPerformanceMetrics = resetPerformanceMetrics;
window.checkChromeAIAvailability = checkChromeAIAvailability;
window.testCommandParsing = testCommandParsing;
window.testSentimentAnalysis = testSentimentAnalysis;
window.testTopicExtraction = testTopicExtraction;
window.testMoodInsights = testMoodInsights;
window.initTestSuite = initTestSuite;
window.cleanupTestSuite = cleanupTestSuite;
