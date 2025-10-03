// js/prompts-service.js
// AI-generated journaling prompts system

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

/**
 * Categories of journaling prompts with different focuses
 */
const PROMPT_CATEGORIES = {
  gratitude: {
    name: "Gratitude & Appreciation",
    themes: ["thankfulness", "positive moments", "appreciation", "blessings"],
  },
  reflection: {
    name: "Self-Reflection",
    themes: [
      "personal growth",
      "lessons learned",
      "self-awareness",
      "introspection",
    ],
  },
  goals: {
    name: "Goals & Aspirations",
    themes: ["future planning", "dreams", "ambitions", "progress"],
  },
  creativity: {
    name: "Creative Expression",
    themes: ["imagination", "artistic thoughts", "innovation", "inspiration"],
  },
  relationships: {
    name: "Relationships & Connection",
    themes: ["family", "friends", "community", "love", "communication"],
  },
  wellbeing: {
    name: "Health & Wellbeing",
    themes: ["mental health", "physical wellness", "balance", "self-care"],
  },
  adventure: {
    name: "Adventure & Discovery",
    themes: ["exploration", "new experiences", "travel", "learning"],
  },
};

/**
 * Generates AI-powered journaling prompts based on user's mood and recent entries
 * @param {string} sentiment - Current mood/sentiment (positive, negative, neutral)
 * @param {Array} recentTopics - Recent topics from user's entries
 * @param {string} timeOfDay - morning, afternoon, evening
 * @returns {Promise<Array>} Array of generated prompts
 */
export async function generateDailyPrompts(
  sentiment = "neutral",
  recentTopics = [],
  timeOfDay = "morning"
) {
  try {
    // Check if Chrome AI is available
    if (!chrome?.ai?.prompt) {
      console.warn(
        "Chrome AI API not available for prompt generation, using fallback"
      );
      return getFallbackPrompts(sentiment, timeOfDay);
    }

    // Select appropriate category based on sentiment and time
    const suggestedCategory = selectCategoryBySentiment(sentiment, timeOfDay);
    const recentTopicsStr =
      recentTopics.length > 0 ? recentTopics.join(", ") : "general life";

    const promptGenerationPrompt = `
            Generate 3 thoughtful journaling prompts for a ${timeOfDay} journal session.
            
            Context:
            - User's current mood: ${sentiment}
            - Recent topics they've written about: ${recentTopicsStr}
            - Suggested focus: ${suggestedCategory.name}
            - Time of day: ${timeOfDay}
            
            Guidelines:
            - Make prompts personal and engaging
            - Avoid repetitive themes from recent topics unless building on them meaningfully
            - Match the mood appropriately (encouraging for negative moods, celebratory for positive)
            - Keep each prompt to 1-2 sentences
            - Make them specific enough to inspire writing but open enough for personal interpretation
            
            Respond with ONLY a JSON array of 3 prompt strings:
            ["prompt 1", "prompt 2", "prompt 3"]
        `;

    const result = await chrome.ai.prompt({ prompt: promptGenerationPrompt });
    const cleanedResult = cleanAIResponse(result.text);
    const prompts = JSON.parse(cleanedResult);

    // Validate and return
    return Array.isArray(prompts)
      ? prompts.slice(0, 3)
      : getFallbackPrompts(sentiment, timeOfDay);
  } catch (error) {
    console.error("Error generating AI prompts:", error);
    return getFallbackPrompts(sentiment, timeOfDay);
  }
}

/**
 * Selects appropriate prompt category based on sentiment and time of day
 */
function selectCategoryBySentiment(sentiment, timeOfDay) {
  if (sentiment === "negative") {
    return timeOfDay === "evening"
      ? PROMPT_CATEGORIES.reflection
      : PROMPT_CATEGORIES.wellbeing;
  }

  if (sentiment === "positive") {
    return timeOfDay === "morning"
      ? PROMPT_CATEGORIES.goals
      : PROMPT_CATEGORIES.gratitude;
  }

  // Neutral sentiment - vary by time of day
  switch (timeOfDay) {
    case "morning":
      return PROMPT_CATEGORIES.goals;
    case "afternoon":
      return PROMPT_CATEGORIES.creativity;
    case "evening":
      return PROMPT_CATEGORIES.reflection;
    default:
      return PROMPT_CATEGORIES.reflection;
  }
}

/**
 * Fallback prompts when AI is not available
 */
function getFallbackPrompts(sentiment, timeOfDay) {
  const fallbackPrompts = {
    morning: {
      positive: [
        "What are you most excited about today, and how can you make the most of that energy?",
        "Describe a recent accomplishment that still makes you smile when you think about it.",
        "What's one small step you can take today toward a goal that matters to you?",
      ],
      negative: [
        "What's one thing you can do today to take care of yourself, even if it's small?",
        "Write about a time when you overcame a challenge. What strengths did you discover?",
        "What would you tell a good friend who was feeling the way you feel right now?",
      ],
      neutral: [
        "What are you curious about today? What would you like to explore or learn?",
        "Describe your ideal version of today. What would make it meaningful?",
        "What's something you're grateful for that you might normally take for granted?",
      ],
    },
    afternoon: {
      positive: [
        "What has surprised you most about today so far?",
        "Describe a moment from this morning that brought you joy or satisfaction.",
        "How are you feeling different now compared to when you woke up?",
      ],
      negative: [
        "What part of your day, no matter how small, went better than expected?",
        "What would help you feel more grounded right now?",
        "Write about something in your environment that brings you comfort.",
      ],
      neutral: [
        "What thoughts have been occupying your mind today?",
        "Describe the rhythm of your day so far. What patterns do you notice?",
        "What's one thing you've learned about yourself today?",
      ],
    },
    evening: {
      positive: [
        "What made today special? How can you carry that feeling forward?",
        "Describe the best conversation you had today and why it mattered.",
        "What are you most proud of accomplishing today, big or small?",
      ],
      negative: [
        "What challenged you today, and what did you learn from navigating it?",
        "How did you show resilience today, even in small ways?",
        "What's one thing you're looking forward to tomorrow?",
      ],
      neutral: [
        "As you reflect on today, what moments stand out to you and why?",
        "What thoughts or feelings are you carrying into the evening?",
        "How do you want to prepare your mind and heart for tomorrow?",
      ],
    },
  };

  return fallbackPrompts[timeOfDay] && fallbackPrompts[timeOfDay][sentiment]
    ? fallbackPrompts[timeOfDay][sentiment]
    : fallbackPrompts.morning.neutral;
}

/**
 * Gets the current time of day for prompt selection
 */
export function getCurrentTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/**
 * Generates weekly reflection prompts based on recent journal entries
 * @param {Array} weekEntries - Journal entries from the past week
 * @returns {Promise<Array>} Array of reflection prompts
 */
export async function generateWeeklyReflection(weekEntries) {
  try {
    if (!chrome?.ai?.prompt || weekEntries.length === 0) {
      return getWeeklyFallbackPrompts();
    }

    // Analyze the week's themes and patterns
    const weekContent = weekEntries
      .map((entry) => {
        const div = document.createElement("div");
        div.innerHTML = entry.content;
        return div.textContent.substring(0, 200);
      })
      .join("\n---\n");

    const weeklyReflectionPrompt = `
            Based on this week's journal entries, generate 3 thoughtful weekly reflection prompts:

            Week's entries summary:
            ${weekContent}

            Create prompts that:
            - Help the user identify patterns or themes from their week
            - Encourage deeper reflection on growth and learning
            - Look forward while honoring the week's experiences
            - Are specific to their actual experiences

            Respond with ONLY a JSON array:
            ["reflection prompt 1", "reflection prompt 2", "reflection prompt 3"]
        `;

    const result = await chrome.ai.prompt({ prompt: weeklyReflectionPrompt });
    const cleanedResult = cleanAIResponse(result.text);
    const prompts = JSON.parse(cleanedResult);
    return Array.isArray(prompts)
      ? prompts.slice(0, 3)
      : getWeeklyFallbackPrompts();
  } catch (error) {
    console.error("Error generating weekly reflection prompts:", error);
    return getWeeklyFallbackPrompts();
  }
}

/**
 * Fallback weekly reflection prompts
 */
function getWeeklyFallbackPrompts() {
  return [
    "Looking back at this week, what patterns do you notice in your thoughts, feelings, or experiences?",
    "What's one thing you learned about yourself this week that surprised you?",
    "How do you want to approach the coming week differently based on this week's experiences?",
  ];
}

/**
 * Creates a prompt suggestion based on user's current entry context
 * @param {string} currentText - User's current entry text
 * @returns {Promise<string>} A contextual prompt suggestion
 */
export async function generateContextualPrompt(currentText) {
  try {
    if (!chrome?.ai?.prompt || !currentText.trim()) {
      return null;
    }

    const contextualPrompt = `
            The user is writing a journal entry and has written:
            "${currentText}"

            Generate ONE thoughtful follow-up prompt that would help them:
            - Dive deeper into their thoughts
            - Explore their feelings more fully
            - Connect to broader themes or patterns
            - Reflect on implications or next steps

            Respond with ONLY the prompt text, no quotes or formatting.
        `;

    const result = await chrome.ai.prompt({ prompt: contextualPrompt });
    return cleanAIResponse(result.text);
  } catch (error) {
    console.error("Error generating contextual prompt:", error);
    return null;
  }
}
