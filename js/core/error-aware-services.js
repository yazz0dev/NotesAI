// js/error-aware-services.js
// Error-aware wrappers for existing services

import errorHandler, {
  withErrorHandling,
  ERROR_TYPES,
  ERROR_SEVERITY,
} from "./error-handler.js";
import * as store from "./store.js";
import { analyzeSentiment, extractTopics } from "../services/ai-insights.js";
import { exportNotes } from "../services/export-service.js";
import { importFromFile } from "../services/import-service.js";
import {
  getAllGoals,
  createGoal,
  recordProgress,
} from "../services/goals-service.js";
import { startRecording, stopRecording } from "../services/voice-service.js";

/**
 * Error-aware store operations
 */
export const safeStore = {
  /**
   * Safely saves a note with error handling and retry logic
   */
  async saveNote(note) {
    return withErrorHandling(
      () => {
        // Determine if this is a new note or an update
        if (note.id && note.createdAt) {
          // Existing note - update it
          return store.updateNote(note);
        } else {
          // New note - add it
          return store.addNote(note.content, note.summary, note.oneLiner);
        }
      },
      {
        type: ERROR_TYPES.STORAGE,
        severity: ERROR_SEVERITY.HIGH,
        retryable: true,
        context: { operation: "saveNote", noteId: note.id },
        fallback: async () => {
          // Try to save to localStorage as backup
          try {
            const backup = JSON.parse(
              localStorage.getItem("notes_backup") || "[]"
            );
            backup.unshift(note);
            localStorage.setItem(
              "notes_backup",
              JSON.stringify(backup.slice(0, 10))
            );
            return note;
          } catch (e) {
            throw new Error("Failed to save note and backup failed");
          }
        },
      }
    );
  },

  /**
   * Safely loads all notes with error handling
   */
  async loadNotes() {
    return withErrorHandling(() => store.getNotes(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.HIGH,
      retryable: true,
      context: { operation: "loadNotes" },
      fallback: async () => {
        // Try to load from backup
        try {
          const backup = JSON.parse(
            localStorage.getItem("notes_backup") || "[]"
          );
          if (backup.length > 0) {
            console.warn("Loading from backup due to storage error");
            return backup;
          }
        } catch (e) {
          console.warn("Backup also failed, returning empty array");
        }
        return [];
      },
    });
  },

  /**
   * Safely deletes a note with confirmation
   */
  async deleteNote(noteId) {
    return withErrorHandling(() => store.deleteNote(noteId), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { operation: "deleteNote", noteId },
    });
  },

  /**
   * Safely gets all notebooks with error handling
   */
  async getNotebooks() {
    return withErrorHandling(() => store.getNotebooks(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.LOW,
      retryable: true,
      context: { operation: "getNotebooks" },
      fallback: () => [],
    });
  },

  /**
   * Safely gets all tags with error handling
   */
  async getTags() {
    return withErrorHandling(() => store.getTags(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.LOW,
      retryable: true,
      context: { operation: "getTags" },
      fallback: () => [],
    });
  },

  /**
   * Safely toggles favorite status of a note
   */
  async toggleFavoriteNote(noteId) {
    return withErrorHandling(() => store.toggleFavoriteNote(noteId), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.LOW,
      retryable: true,
      context: { operation: "toggleFavoriteNote", noteId },
    });
  },
};

/**
 * Error-aware AI services
 */
export const safeAI = {
  /**
   * Safely analyzes sentiment with fallback
   */
  async analyzeSentiment(content) {
    return withErrorHandling(() => analyzeSentiment(content), {
      type: ERROR_TYPES.AI_SERVICE,
      severity: ERROR_SEVERITY.LOW,
      retryable: true,
      maxRetries: 2,
      context: { operation: "analyzeSentiment", contentLength: content.length },
      fallback: () => ({
        sentiment: "neutral",
        confidence: 0.5,
        fallback: true,
      }),
    });
  },

  /**
   * Safely extracts topics with fallback
   */
  async extractTopics(content) {
    return withErrorHandling(() => extractTopics(content), {
      type: ERROR_TYPES.AI_SERVICE,
      severity: ERROR_SEVERITY.LOW,
      retryable: true,
      maxRetries: 2,
      context: { operation: "extractTopics", contentLength: content.length },
      fallback: () => {
        // Simple keyword extraction as fallback
        const words = content
          .toLowerCase()
          .replace(/[^\w\s]/g, "")
          .split(/\s+/)
          .filter((word) => word.length > 4);

        const wordCount = {};
        words.forEach((word) => {
          wordCount[word] = (wordCount[word] || 0) + 1;
        });

        return Object.entries(wordCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3)
          .map(([word]) => word);
      },
    });
  },
};

/**
 * Error-aware export/import services
 */
export const safeExportImport = {
  /**
   * Safely exports notes with progress tracking
   */
  async exportNotes(notes, format) {
    return withErrorHandling(() => exportNotes(notes, format), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false, // Don't retry exports automatically
      context: { operation: "exportNotes", format, noteCount: notes.length },
    });
  },

  /**
   * Safely imports note data with validation
   */
  async importFromFile(file) {
    return withErrorHandling(() => importFromFile(file), {
      type: ERROR_TYPES.VALIDATION,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false, // Don't retry imports automatically
      context: {
        operation: "importFromFile",
        fileName: file.name,
        fileSize: file.size,
      },
    });
  },
};

/**
 * Error-aware goals services
 */
export const safeGoals = {
  /**
   * Safely loads all goals
   */
  async getAllGoals() {
    return withErrorHandling(() => getAllGoals(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { operation: "getAllGoals" },
      fallback: () => [],
    });
  },

  /**
   * Safely creates a new goal
   */
  async createGoal(goalData) {
    return withErrorHandling(() => createGoal(goalData), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.HIGH,
      retryable: true,
      context: { operation: "createGoal", goalType: goalData.type },
    });
  },

  /**
   * Safely records goal progress
   */
  async recordProgress(goalId, value, note) {
    return withErrorHandling(() => recordProgress(goalId, value, note), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { operation: "recordProgress", goalId, value },
    });
  },
};

/**
 * Error-aware audio services
 */
export const safeAudio = {
  /**
   * Safely starts audio recording with permission handling
   */
  async startRecording() {
    return withErrorHandling(() => startRecording(), {
      type: ERROR_TYPES.AUDIO,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: false, // Don't auto-retry permission requests
      context: { operation: "startRecording" },
    });
  },

  /**
   * Safely stops audio recording
   */
  async stopRecording() {
    return withErrorHandling(() => stopRecording(), {
      type: ERROR_TYPES.AUDIO,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      context: { operation: "stopRecording" },
    });
  },
};

/**
 * Network-aware operations
 */
export const networkAware = {
  /**
   * Checks if operation should proceed based on network status
   */
  shouldProceedWithNetworkOperation() {
    if (!navigator.onLine) {
      errorHandler.handleError({
        type: ERROR_TYPES.NETWORK,
        severity: ERROR_SEVERITY.MEDIUM,
        message: "Operation requires internet connection",
        userMessage:
          "This feature requires an internet connection. Please check your network and try again.",
        recoverable: true,
      });
      return false;
    }
    return true;
  },

  /**
   * Wraps network operations with connectivity checks
   */
  async withNetworkCheck(operation, options = {}) {
    if (!this.shouldProceedWithNetworkOperation()) {
      throw new Error("Network unavailable");
    }

    return withErrorHandling(operation, {
      type: ERROR_TYPES.NETWORK,
      severity: ERROR_SEVERITY.MEDIUM,
      retryable: true,
      ...options,
    });
  },
};

/**
 * Permission-aware operations
 */
export const permissionAware = {
  /**
   * Safely requests permissions with user-friendly messaging
   */
  async requestPermission(permissionName, description) {
    try {
      const permission = await navigator.permissions.query({
        name: permissionName,
      });

      if (permission.state === "denied") {
        errorHandler.handleError({
          type: ERROR_TYPES.PERMISSION,
          severity: ERROR_SEVERITY.HIGH,
          message: `${permissionName} permission denied`,
          userMessage: `${description} requires ${permissionName} permission. Please enable it in your browser settings.`,
          recoverable: false,
        });
        return false;
      }

      return true;
    } catch (error) {
      // Permissions API not supported, try the operation anyway
      console.warn("Permissions API not supported:", error);
      return true;
    }
  },
};

/**
 * Validation helpers with error handling
 */
export const safeValidation = {
  /**
   * Validates required fields with user-friendly messages
   */
  validateRequired(data, requiredFields, context = "") {
    const missing = [];

    requiredFields.forEach((field) => {
      if (
        !data[field] ||
        (typeof data[field] === "string" && !data[field].trim())
      ) {
        missing.push(field);
      }
    });

    if (missing.length > 0) {
      errorHandler.handleError({
        type: ERROR_TYPES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        message: `Missing required fields: ${missing.join(", ")}`,
        userMessage: `Please fill in all required fields: ${missing.join(
          ", "
        )}`,
        context: { context, missing },
        recoverable: true,
      });
      return false;
    }

    return true;
  },

  /**
   * Validates file types and sizes
   */
  validateFile(file, allowedTypes = [], maxSize = 10 * 1024 * 1024) {
    if (!file) {
      errorHandler.handleError({
        type: ERROR_TYPES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        message: "No file selected",
        userMessage: "Please select a file to upload.",
        recoverable: true,
      });
      return false;
    }

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errorHandler.handleError({
        type: ERROR_TYPES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        message: `Invalid file type: ${file.type}`,
        userMessage: `Please select a valid file type: ${allowedTypes.join(
          ", "
        )}`,
        context: { fileType: file.type, allowedTypes },
        recoverable: true,
      });
      return false;
    }

    if (file.size > maxSize) {
      errorHandler.handleError({
        type: ERROR_TYPES.VALIDATION,
        severity: ERROR_SEVERITY.MEDIUM,
        message: `File too large: ${file.size} bytes`,
        userMessage: `File is too large. Maximum size is ${Math.round(
          maxSize / 1024 / 1024
        )}MB.`,
        context: { fileSize: file.size, maxSize },
        recoverable: true,
      });
      return false;
    }

    return true;
  },
};

// Export error handler for direct access
export { errorHandler };
