// js/error-handler.js
// Comprehensive error handling system with user-friendly messages and recovery

// Error types and categories
const ERROR_TYPES = {
  NETWORK: "network",
  STORAGE: "storage",
  AI_SERVICE: "ai_service",
  AUDIO: "audio",
  VALIDATION: "validation",
  PERMISSION: "permission",
  UNKNOWN: "unknown",
};

const ERROR_SEVERITY = {
  LOW: "low", // Minor issues, app continues normally
  MEDIUM: "medium", // Some functionality affected
  HIGH: "high", // Major functionality broken
  CRITICAL: "critical", // App unusable
};

// Error tracking and analytics
let errorLog = [];
const MAX_ERROR_LOG_SIZE = 100;

/**
 * Main error handler class
 */
class ErrorHandler {
  constructor() {
    this.setupGlobalErrorHandlers();
    this.retryAttempts = new Map(); // Track retry attempts per operation
    this.maxRetries = 3;
  }

  /**
   * Sets up global error handlers for unhandled errors
   */
  setupGlobalErrorHandlers() {
    // Handle JavaScript errors
    window.addEventListener("error", (event) => {
      this.handleError({
        type: ERROR_TYPES.UNKNOWN,
        severity: ERROR_SEVERITY.HIGH,
        message: event.message,
        stack: event.error?.stack,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this.handleError({
        type: ERROR_TYPES.UNKNOWN,
        severity: ERROR_SEVERITY.MEDIUM,
        message: `Unhandled promise rejection: ${event.reason}`,
        stack: event.reason?.stack,
        promise: event.promise,
      });

      // Prevent the default browser behavior
      event.preventDefault();
    });

    // Handle network errors
    window.addEventListener("offline", () => {
      this.handleError({
        type: ERROR_TYPES.NETWORK,
        severity: ERROR_SEVERITY.MEDIUM,
        message: "Network connection lost",
        userMessage:
          "You're currently offline. Some features may not work properly.",
        recoverable: true,
      });
    });

    window.addEventListener("online", () => {
      showToast("Connection restored", "success");
    });
  }

  /**
   * Main error handling method
   * @param {Object} errorInfo - Error information object
   */
  handleError(errorInfo) {
    const error = this.normalizeError(errorInfo);

    // Log the error
    this.logError(error);

    // Show user-friendly message based on severity
    this.showUserMessage(error);

    // Attempt recovery if possible
    if (error.recoverable) {
      this.attemptRecovery(error);
    }

    // Report to analytics (if implemented)
    this.reportError(error);

    return error;
  }

  /**
   * Normalizes error information into a standard format
   * @param {Object|Error|string} errorInfo - Raw error information
   * @returns {Object} Normalized error object
   */
  normalizeError(errorInfo) {
    let error = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: ERROR_TYPES.UNKNOWN,
      severity: ERROR_SEVERITY.MEDIUM,
      message: "An unexpected error occurred",
      userMessage: null,
      stack: null,
      context: {},
      recoverable: false,
      retryable: false,
    };

    if (typeof errorInfo === "string") {
      error.message = errorInfo;
    } else if (errorInfo instanceof Error) {
      error.message = errorInfo.message;
      error.stack = errorInfo.stack;
      error.name = errorInfo.name;
    } else if (typeof errorInfo === "object") {
      error = { ...error, ...errorInfo };
    }

    // Set user-friendly message if not provided
    if (!error.userMessage) {
      error.userMessage = this.getUserFriendlyMessage(error);
    }

    return error;
  }

  /**
   * Generates user-friendly error messages
   * @param {Object} error - Error object
   * @returns {string} User-friendly message
   */
  getUserFriendlyMessage(error) {
    const messages = {
      [ERROR_TYPES.NETWORK]: {
        [ERROR_SEVERITY.LOW]: "Connection is slow. Please be patient.",
        [ERROR_SEVERITY.MEDIUM]:
          "Network connection issues detected. Some features may be limited.",
        [ERROR_SEVERITY.HIGH]:
          "Unable to connect to the internet. Please check your connection.",
        [ERROR_SEVERITY.CRITICAL]:
          "No internet connection. The app is running in offline mode.",
      },
      [ERROR_TYPES.STORAGE]: {
        [ERROR_SEVERITY.LOW]: "Minor storage issue. Your data is safe.",
        [ERROR_SEVERITY.MEDIUM]:
          "Having trouble saving your data. Please try again.",
        [ERROR_SEVERITY.HIGH]:
          "Unable to save your journal entry. Please check available storage.",
        [ERROR_SEVERITY.CRITICAL]:
          "Critical storage error. Your data may be at risk. Please backup immediately.",
      },
      [ERROR_TYPES.AI_SERVICE]: {
        [ERROR_SEVERITY.LOW]: "AI features are temporarily slower than usual.",
        [ERROR_SEVERITY.MEDIUM]: "Some AI features are currently unavailable.",
        [ERROR_SEVERITY.HIGH]:
          "AI services are experiencing issues. Basic features still work.",
        [ERROR_SEVERITY.CRITICAL]: "AI services are completely unavailable.",
      },
      [ERROR_TYPES.AUDIO]: {
        [ERROR_SEVERITY.LOW]: "Audio quality may be affected.",
        [ERROR_SEVERITY.MEDIUM]:
          "Having trouble with audio recording. Please check your microphone.",
        [ERROR_SEVERITY.HIGH]:
          "Unable to access your microphone. Please check permissions.",
        [ERROR_SEVERITY.CRITICAL]: "Audio features are completely unavailable.",
      },
      [ERROR_TYPES.VALIDATION]: {
        [ERROR_SEVERITY.LOW]: "Please check your input and try again.",
        [ERROR_SEVERITY.MEDIUM]: "The information provided is not valid.",
        [ERROR_SEVERITY.HIGH]: "Required information is missing or invalid.",
        [ERROR_SEVERITY.CRITICAL]:
          "Critical validation error. Please refresh and try again.",
      },
      [ERROR_TYPES.PERMISSION]: {
        [ERROR_SEVERITY.LOW]: "Some features require additional permissions.",
        [ERROR_SEVERITY.MEDIUM]:
          "Please grant the necessary permissions to continue.",
        [ERROR_SEVERITY.HIGH]:
          "Required permissions are missing. Some features won't work.",
        [ERROR_SEVERITY.CRITICAL]:
          "Critical permissions denied. The app cannot function properly.",
      },
    };

    return (
      messages[error.type]?.[error.severity] ||
      "Something went wrong. Please try again or contact support if the problem persists."
    );
  }

  /**
   * Shows appropriate user message based on error severity
   * @param {Object} error - Error object
   */
  showUserMessage(error) {
    const message = error.userMessage;

    switch (error.severity) {
      case ERROR_SEVERITY.LOW:
        // Don't show anything for low severity errors
        console.info("Low severity error:", error);
        break;

      case ERROR_SEVERITY.MEDIUM:
        showToast(message, "warning", 4000);
        break;

      case ERROR_SEVERITY.HIGH:
        showToast(message, "error", 6000);
        break;

      case ERROR_SEVERITY.CRITICAL:
        showAlert("Critical Error", message);
        break;
    }
  }

  /**
   * Logs error for debugging and analytics
   * @param {Object} error - Error object
   */
  logError(error) {
    // Add to error log
    errorLog.unshift(error);

    // Maintain log size
    if (errorLog.length > MAX_ERROR_LOG_SIZE) {
      errorLog = errorLog.slice(0, MAX_ERROR_LOG_SIZE);
    }

    // Console logging based on severity
    switch (error.severity) {
      case ERROR_SEVERITY.LOW:
        console.info("Error (Low):", error);
        break;
      case ERROR_SEVERITY.MEDIUM:
        console.warn("Error (Medium):", error);
        break;
      case ERROR_SEVERITY.HIGH:
      case ERROR_SEVERITY.CRITICAL:
        console.error("Error (High/Critical):", error);
        break;
    }

    // Store in localStorage for debugging
    try {
      const recentErrors = errorLog.slice(0, 10);
      localStorage.setItem("ai_journal_errors", JSON.stringify(recentErrors));
    } catch (e) {
      console.warn("Could not store error log:", e);
    }
  }

  /**
   * Attempts to recover from recoverable errors
   * @param {Object} error - Error object
   */
  async attemptRecovery(error) {
    const recoveryStrategies = {
      [ERROR_TYPES.NETWORK]: async () => {
        // Wait and retry network operations
        await this.delay(2000);
        return navigator.onLine;
      },

      [ERROR_TYPES.STORAGE]: async () => {
        // Try to clear some space or use alternative storage
        try {
          // Clear old error logs
          localStorage.removeItem("ai_journal_errors");
          return true;
        } catch (e) {
          return false;
        }
      },

      [ERROR_TYPES.AI_SERVICE]: async () => {
        // Fallback to basic functionality
        return true; // Always recoverable with fallbacks
      },

      [ERROR_TYPES.AUDIO]: async () => {
        // Try to re-request permissions
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          return true;
        } catch (e) {
          return false;
        }
      },
    };

    const strategy = recoveryStrategies[error.type];
    if (strategy) {
      try {
        const recovered = await strategy();
        if (recovered) {
          showToast("Issue resolved automatically", "success");
          return true;
        }
      } catch (recoveryError) {
        console.warn("Recovery attempt failed:", recoveryError);
      }
    }

    return false;
  }

  /**
   * Reports error to analytics service (placeholder)
   * @param {Object} error - Error object
   */
  reportError(error) {
    // In a real app, this would send to an analytics service
    // For now, we'll just track locally

    if (
      error.severity === ERROR_SEVERITY.CRITICAL ||
      error.severity === ERROR_SEVERITY.HIGH
    ) {
      // Could send to error tracking service like Sentry, LogRocket, etc.
      console.log("Would report to analytics:", {
        id: error.id,
        type: error.type,
        severity: error.severity,
        message: error.message,
        timestamp: error.timestamp,
        userAgent: navigator.userAgent,
        url: window.location.href,
      });
    }
  }

  /**
   * Wraps async operations with error handling and retry logic
   * @param {Function} operation - Async operation to wrap
   * @param {Object} options - Options for error handling
   * @returns {Promise} Wrapped operation
   */
  async withErrorHandling(operation, options = {}) {
    const {
      type = ERROR_TYPES.UNKNOWN,
      severity = ERROR_SEVERITY.MEDIUM,
      retryable = false,
      maxRetries = this.maxRetries,
      context = {},
      fallback = null,
    } = options;

    const operationId = this.generateErrorId();
    let lastError = null;

    for (let attempt = 0; attempt <= (retryable ? maxRetries : 0); attempt++) {
      try {
        const result = await operation();

        // Clear retry count on success
        if (this.retryAttempts.has(operationId)) {
          this.retryAttempts.delete(operationId);
        }

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries && retryable) {
          // Wait before retry with exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await this.delay(delay);

          this.retryAttempts.set(operationId, attempt + 1);
          continue;
        }

        // All retries exhausted or not retryable
        const errorInfo = {
          type,
          severity,
          message: error.message || "Operation failed",
          stack: error.stack,
          context: {
            ...context,
            attempts: attempt + 1,
            operationId,
          },
          recoverable: retryable,
          retryable,
        };

        this.handleError(errorInfo);

        // Use fallback if provided
        if (fallback && typeof fallback === "function") {
          try {
            return await fallback();
          } catch (fallbackError) {
            console.warn("Fallback also failed:", fallbackError);
          }
        }

        throw error;
      }
    }
  }

  /**
   * Creates a safe wrapper for DOM operations
   * @param {Function} operation - DOM operation
   * @param {Object} options - Error handling options
   * @returns {*} Operation result or null on error
   */
  safeDOMOperation(operation, options = {}) {
    try {
      return operation();
    } catch (error) {
      this.handleError({
        type: ERROR_TYPES.UNKNOWN,
        severity: ERROR_SEVERITY.LOW,
        message: `DOM operation failed: ${error.message}`,
        context: options.context || {},
        recoverable: false,
      });

      return options.fallback || null;
    }
  }

  /**
   * Utility methods
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets error statistics for debugging
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      total: errorLog.length,
      byType: {},
      bySeverity: {},
      recent: errorLog.slice(0, 5),
    };

    errorLog.forEach((error) => {
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }

  /**
   * Clears error log
   */
  clearErrorLog() {
    errorLog = [];
    localStorage.removeItem("ai_journal_errors");
  }
}

// Create global error handler instance
const errorHandler = new ErrorHandler();

// Export convenience functions
const handleError = (error) => errorHandler.handleError(error);
const withErrorHandling = (operation, options) =>
  errorHandler.withErrorHandling(operation, options);
const safeDOMOperation = (operation, options) =>
  errorHandler.safeDOMOperation(operation, options);
const getErrorStats = () => errorHandler.getErrorStats();
const clearErrorLog = () => errorHandler.clearErrorLog();

// Make functions available globally for Vue.js compatibility
window.ERROR_TYPES = ERROR_TYPES;
window.ERROR_SEVERITY = ERROR_SEVERITY;
window.handleError = handleError;
window.withErrorHandling = withErrorHandling;
window.safeDOMOperation = safeDOMOperation;
window.getErrorStats = getErrorStats;
window.clearErrorLog = clearErrorLog;
