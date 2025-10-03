// js/goals-service.js
// Goals and habits tracking system with AI-powered insights

import * as store from "../core/store.js";
import { generateId } from "../utils/utils.js";

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
 * Goal and habit tracking service
 */

// Goal types
export const GOAL_TYPES = {
  HABIT: "habit",
  PROJECT: "project",
  MILESTONE: "milestone",
};

// Goal statuses
export const GOAL_STATUS = {
  ACTIVE: "active",
  COMPLETED: "completed",
  PAUSED: "paused",
  ARCHIVED: "archived",
};

// Habit frequencies
export const HABIT_FREQUENCIES = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
};

/**
 * Creates a new goal or habit
 * @param {Object} goalData - Goal data object
 * @returns {Promise<Object>} Created goal
 */
export async function createGoal(goalData) {
  try {
    if (!goalData.title || !goalData.type) {
      throw new Error("Goal title and type are required");
    }

    const goal = {
      id: generateId(),
      title: goalData.title.trim(),
      description: goalData.description?.trim() || "",
      type: goalData.type,
      status: GOAL_STATUS.ACTIVE,
      frequency: goalData.frequency || HABIT_FREQUENCIES.DAILY,
      targetValue: goalData.targetValue || 1,
      currentValue: 0,
      streakCount: 0,
      longestStreak: 0,
      lastCompleted: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: goalData.targetDate || null,
      category: goalData.category || "general",
      color: goalData.color || "#007AFF",
      reminders: goalData.reminders || [],
      checkIns: [], // Array of check-in records
    };

    const savedGoal = await storeGoal(goal);
    return savedGoal;
  } catch (error) {
    console.error("Error creating goal:", error);
    throw error;
  }
}

/**
 * Records progress for a goal or habit
 * @param {string} goalId - Goal ID
 * @param {number} value - Progress value (default 1 for habits)
 * @param {string} note - Optional note about the progress
 * @returns {Promise<Object>} Updated goal
 */
export async function recordProgress(goalId, value = 1, note = "") {
  try {
    const goal = await getGoal(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // Create check-in record
    const checkIn = {
      id: generateId(),
      date: today,
      timestamp: now,
      value: value,
      note: note.trim(),
      mood: null, // Could be enhanced with mood tracking
    };

    // Update goal progress
    goal.currentValue += value;
    goal.lastCompleted = now;
    goal.checkIns = goal.checkIns || [];
    goal.checkIns.push(checkIn);

    // Update streak for habits
    if (goal.type === GOAL_TYPES.HABIT) {
      updateHabitStreak(goal, today);
    }

    // Check if goal is completed
    if (goal.targetValue && goal.currentValue >= goal.targetValue) {
      goal.status = GOAL_STATUS.COMPLETED;
    }

    goal.updatedAt = now;

    const updatedGoal = await storeGoal(goal);
    return updatedGoal;
  } catch (error) {
    console.error("Error recording progress:", error);
    throw error;
  }
}

/**
 * Updates habit streak based on check-in pattern
 * @param {Object} goal - Goal object
 * @param {string} today - Today's date string (YYYY-MM-DD)
 */
function updateHabitStreak(goal, today) {
  const checkIns = goal.checkIns || [];
  const recentCheckIns = checkIns
    .map((ci) => ci.date)
    .sort()
    .reverse();

  if (recentCheckIns.length === 0) {
    goal.streakCount = 1;
    goal.longestStreak = Math.max(goal.longestStreak, 1);
    return;
  }

  // Calculate current streak
  let currentStreak = 0;
  const todayDate = new Date(today);

  for (let i = 0; i < recentCheckIns.length; i++) {
    const checkInDate = new Date(recentCheckIns[i]);
    const daysDiff = Math.floor(
      (todayDate - checkInDate) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === i) {
      currentStreak++;
    } else {
      break;
    }
  }

  goal.streakCount = currentStreak;
  goal.longestStreak = Math.max(goal.longestStreak, currentStreak);
}

/**
 * Gets all active goals and habits
 * @returns {Promise<Array>} Array of goals
 */
export async function getAllGoals() {
  try {
    const request = indexedDB.open("AI_JournalGoals", 1);

    return new Promise((resolve, reject) => {
      request.onerror = () => resolve([]);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("goals")) {
          db.createObjectStore("goals", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["goals"], "readonly");
        const store = transaction.objectStore("goals");

        const getRequest = store.getAll();
        getRequest.onsuccess = () => {
          const goals = getRequest.result || [];
          // Sort by updatedAt descending
          goals.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
          resolve(goals);
        };
        getRequest.onerror = () => resolve([]);
      };
    });
  } catch (error) {
    console.error("Error getting goals:", error);
    return [];
  }
}

/**
 * Gets a specific goal by ID
 * @param {string} goalId - Goal ID
 * @returns {Promise<Object|null>} Goal object or null
 */
export async function getGoal(goalId) {
  try {
    const request = indexedDB.open("AI_JournalGoals", 1);

    return new Promise((resolve) => {
      request.onerror = () => resolve(null);
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["goals"], "readonly");
        const store = transaction.objectStore("goals");

        const getRequest = store.get(goalId);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };
    });
  } catch (error) {
    console.error("Error getting goal:", error);
    return null;
  }
}

/**
 * Stores a goal in IndexedDB
 * @param {Object} goal - Goal object
 * @returns {Promise<Object>} Stored goal
 */
async function storeGoal(goal) {
  try {
    const request = indexedDB.open("AI_JournalGoals", 1);

    return new Promise((resolve, reject) => {
      request.onerror = () =>
        reject(new Error("Failed to open goals database"));

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("goals")) {
          db.createObjectStore("goals", { keyPath: "id" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["goals"], "readwrite");
        const store = transaction.objectStore("goals");

        const putRequest = store.put(goal);
        putRequest.onsuccess = () => resolve(goal);
        putRequest.onerror = () => reject(new Error("Failed to store goal"));
      };
    });
  } catch (error) {
    console.error("Error storing goal:", error);
    throw error;
  }
}

/**
 * Updates a goal
 * @param {string} goalId - Goal ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} Updated goal
 */
export async function updateGoal(goalId, updates) {
  try {
    const goal = await getGoal(goalId);
    if (!goal) {
      throw new Error("Goal not found");
    }

    const updatedGoal = {
      ...goal,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    return await storeGoal(updatedGoal);
  } catch (error) {
    console.error("Error updating goal:", error);
    throw error;
  }
}

/**
 * Deletes a goal
 * @param {string} goalId - Goal ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteGoal(goalId) {
  try {
    const request = indexedDB.open("AI_JournalGoals", 1);

    return new Promise((resolve) => {
      request.onerror = () => resolve(false);
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["goals"], "readwrite");
        const store = transaction.objectStore("goals");

        const deleteRequest = store.delete(goalId);
        deleteRequest.onsuccess = () => resolve(true);
        deleteRequest.onerror = () => resolve(false);
      };
    });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return false;
  }
}

/**
 * Gets goals due today for reminders
 * @returns {Promise<Array>} Goals due today
 */
export async function getGoalsDueToday() {
  try {
    const allGoals = await getAllGoals();
    const today = new Date().toISOString().split("T")[0];

    return allGoals.filter((goal) => {
      if (goal.status !== GOAL_STATUS.ACTIVE) return false;

      // For habits, check if they need to be done today
      if (goal.type === GOAL_TYPES.HABIT) {
        const lastCompleted = goal.lastCompleted
          ? new Date(goal.lastCompleted).toISOString().split("T")[0]
          : null;

        // Daily habits need to be done if not completed today
        if (goal.frequency === HABIT_FREQUENCIES.DAILY) {
          return lastCompleted !== today;
        }

        // Weekly habits - check if it's been a week
        if (goal.frequency === HABIT_FREQUENCIES.WEEKLY && lastCompleted) {
          const daysSince = Math.floor(
            (new Date(today) - new Date(lastCompleted)) / (1000 * 60 * 60 * 24)
          );
          return daysSince >= 7;
        }

        return true; // Show new habits
      }

      // For projects and milestones, check target date
      if (goal.targetDate) {
        return goal.targetDate === today;
      }

      return false;
    });
  } catch (error) {
    console.error("Error getting goals due today:", error);
    return [];
  }
}

/**
 * Generates AI-powered insights about goals and habits
 * @param {Array} goals - Array of goals
 * @param {Array} recentEntries - Recent journal entries for context
 * @returns {Promise<Object>} Insights object
 */
export async function generateGoalInsights(goals, recentEntries = []) {
  try {
    if (!chrome?.ai?.prompt || goals.length === 0) {
      return getFallbackInsights(goals);
    }

    // Prepare data for AI analysis
    const goalsData = goals.map((goal) => ({
      title: goal.title,
      type: goal.type,
      status: goal.status,
      progress: goal.targetValue
        ? `${goal.currentValue}/${goal.targetValue}`
        : goal.currentValue,
      streak: goal.streakCount,
      lastCompleted: goal.lastCompleted,
    }));

    const recentJournalContext = recentEntries
      .slice(0, 3)
      .map((entry) => entry.content.replace(/<[^>]*>/g, "").substring(0, 200))
      .join("\n---\n");

    const insightsPrompt = `
            Analyze this person's goals and recent journal entries to provide encouraging insights:

            Goals & Habits:
            ${JSON.stringify(goalsData, null, 2)}

            Recent Journal Context:
            ${recentJournalContext}

            Provide insights in this JSON format:
            {
                "summary": "Brief encouraging summary of progress",
                "strengths": ["strength 1", "strength 2"],
                "opportunities": ["suggestion 1", "suggestion 2"],
                "streakHighlight": "Celebrate any notable streaks",
                "motivation": "Personalized motivational message"
            }

            Keep it positive, specific, and actionable. Focus on progress made and gentle encouragement.
        `;

    const result = await chrome.ai.prompt({ prompt: insightsPrompt });
    const cleanedResult = cleanAIResponse(result.text);
    const insights = JSON.parse(cleanedResult);

    return {
      ...insights,
      totalGoals: goals.length,
      activeGoals: goals.filter((g) => g.status === GOAL_STATUS.ACTIVE).length,
      completedGoals: goals.filter((g) => g.status === GOAL_STATUS.COMPLETED)
        .length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error generating goal insights:", error);
    return getFallbackInsights(goals);
  }
}

/**
 * Fallback insights when AI is not available
 * @param {Array} goals - Array of goals
 * @returns {Object} Basic insights
 */
function getFallbackInsights(goals) {
  const activeGoals = goals.filter((g) => g.status === GOAL_STATUS.ACTIVE);
  const completedGoals = goals.filter(
    (g) => g.status === GOAL_STATUS.COMPLETED
  );
  const habits = goals.filter((g) => g.type === GOAL_TYPES.HABIT);

  const totalStreak = habits.reduce((sum, habit) => sum + habit.streakCount, 0);
  const longestStreak = Math.max(...habits.map((h) => h.longestStreak), 0);

  return {
    summary: `You have ${activeGoals.length} active goals and ${completedGoals.length} completed goals.`,
    strengths: [
      completedGoals.length > 0
        ? "Great job completing goals!"
        : "You're building momentum",
      totalStreak > 0
        ? `${totalStreak} total habit streak days`
        : "Starting your habit journey",
    ],
    opportunities: [
      "Consider breaking large goals into smaller milestones",
      "Reflect on your progress in your journal entries",
    ],
    streakHighlight:
      longestStreak > 0
        ? `Your longest streak is ${longestStreak} days - keep it up!`
        : "Every day is a chance to build a new streak",
    motivation: "Progress, not perfection. Every small step counts!",
    totalGoals: goals.length,
    activeGoals: activeGoals.length,
    completedGoals: completedGoals.length,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Gets habit completion data for visualization
 * @param {string} goalId - Goal ID
 * @param {number} days - Number of days to analyze (default 30)
 * @returns {Promise<Array>} Array of daily completion data
 */
export async function getHabitCompletionData(goalId, days = 30) {
  try {
    const goal = await getGoal(goalId);
    if (!goal || goal.type !== GOAL_TYPES.HABIT) {
      return [];
    }

    const checkIns = goal.checkIns || [];
    const today = new Date();
    const data = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toISOString().split("T")[0];

      const checkIn = checkIns.find((ci) => ci.date === dateString);
      data.push({
        date: dateString,
        completed: !!checkIn,
        value: checkIn?.value || 0,
        note: checkIn?.note || "",
      });
    }

    return data;
  } catch (error) {
    console.error("Error getting habit completion data:", error);
    return [];
  }
}
