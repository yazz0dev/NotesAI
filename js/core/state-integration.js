// js/state-integration.js
// Integration helpers for connecting components to state management

// Note: Using global window object for Vue.js compatibility instead of ES6 imports

/**
 * React-like hooks for state management
 */
const useAppState = {
  /**
   * Hook for accessing state values
   * @param {string} path - State path
   * @returns {*} State value
   */
  useState: (path) => {
    return window.getState(path);
  },

  /**
   * Hook for subscribing to state changes
   * @param {string|Array} paths - State paths to watch
   * @param {Function} callback - Callback function
   * @param {Object} options - Subscription options
   * @returns {Function} Unsubscribe function
   */
  useSubscription: (paths, callback, options = {}) => {
    return window.subscribe(paths, callback, {
      immediate: true,
      debounce: 16, // ~60fps
      ...options,
    });
  },

  /**
   * Hook for component-specific state management
   * @param {string} componentName - Component identifier
   * @returns {Object} Component state helpers
   */
  useComponentState: (componentName) => {
    const componentPath = `ui.components.${componentName}`;

    return {
      getState: (key = null) => {
        const fullPath = key ? `${componentPath}.${key}` : componentPath;
        return window.getState(fullPath);
      },

      setState: (update) => {
        return window.setState({
          ui: {
            components: {
              [componentName]: update,
            },
          },
        });
      },

      subscribe: (callback, options = {}) => {
        return window.subscribe(componentPath, callback, options);
      },
    };
  },
};

/**
 * State-aware component wrapper
 */
class StateAwareComponent {
  constructor(name, options = {}) {
    this.name = name;
    this.subscriptions = [];
    this.state = useAppState.useComponentState(name);
    this.options = options;

    // Auto-cleanup on page unload
    window.addEventListener("beforeunload", () => this.cleanup());
  }

  /**
   * Subscribes to state changes with automatic cleanup
   */
  subscribe(paths, callback, options = {}) {
    const unsubscribe = useAppState.useSubscription(paths, callback, options);
    this.subscriptions.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Updates component state
   */
  setState(update) {
    return this.state.setState(update);
  }

  /**
   * Gets component state
   */
  getState(key = null) {
    return this.state.getState(key);
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions = [];
  }
}

/**
 * State middleware for logging and debugging
 */
const loggingMiddleware = async (newState, previousState, context) => {
  if (
    process.env.NODE_ENV === "development" ||
    window.getState("settings.debugMode")
  ) {
    console.group(`🔄 State Update: ${context.source}`);
    console.log("Previous:", previousState);
    console.log("New:", newState);
    console.log("Context:", context);
    console.groupEnd();
  }
  return newState;
};

/**
 * State middleware for performance monitoring
 */
const performanceMiddleware = async (newState, previousState, context) => {
  const startTime = performance.now();

  // Monitor large state objects
  const stateSize = JSON.stringify(newState).length;
  if (stateSize > 1024 * 1024) {
    // 1MB
    console.warn("Large state detected:", {
      size: `${Math.round(stateSize / 1024)}KB`,
      source: context.source,
    });
  }

  // Monitor frequent updates
  const updateFrequency = newState.performance.stateUpdates;
  if (updateFrequency > 0 && updateFrequency % 100 === 0) {
    console.log("State update milestone:", {
      updates: updateFrequency,
      averageTime: newState.performance.renderTime,
      source: context.source,
    });
  }

  return newState;
};

/**
 * State persistence middleware
 */
const persistenceMiddleware = async (newState, previousState, context) => {
  // Only persist certain state changes
  const persistableSources = ["user-action", "settings-change", "data-update"];

  if (persistableSources.includes(context.source)) {
    // Trigger persistence (handled by StateManager)
    return newState;
  }

  return newState;
};

/**
 * Integration helpers for existing components
 */
const stateIntegration = {
  /**
   * Connects bookshelf component to state
   */
  connectBookshelf: (bookshelfComponent) => {
    return window.withErrorHandling(
      () => {
        // Subscribe to notes changes
        const unsubscribeNotes = window.subscribe(
          "data.notes",
          ([notes]) => {
            bookshelfComponent.updateNotes?.(notes);
          },
          { immediate: true }
        );

        // Subscribe to search changes
        const unsubscribeSearch = window.subscribe(
          ["data.searchResults", "ui.searchQuery"],
          ([results, query]) => {
            if (query) {
              bookshelfComponent.showSearchResults?.(results, query);
            } else {
              bookshelfComponent.showAllNotes?.();
            }
          }
        );

        // Subscribe to view changes
        const unsubscribeView = window.subscribe("ui.view", ([view]) => {
          if (view === "bookshelf") {
            bookshelfComponent.show?.();
          } else {
            bookshelfComponent.hide?.();
          }
        });

        return () => {
          unsubscribeNotes();
          unsubscribeSearch();
          unsubscribeView();
        };
      },
      {
        type: window.ERROR_TYPES.UNKNOWN,
        severity: window.ERROR_SEVERITY.MEDIUM,
        context: { operation: "connectBookshelf" },
      }
    );
  },

  /**
   * Connects goals component to state
   */
  connectGoals: (goalsComponent) => {
    return window.withErrorHandling(
      () => {
        // Subscribe to goals changes
        const unsubscribeGoals = window.subscribe(
          "goals.activeGoals",
          ([goals]) => {
            goalsComponent.updateGoals?.(goals);
          },
          { immediate: true }
        );

        // Subscribe to insights changes
        const unsubscribeInsights = window.subscribe(
          "goals.insights",
          ([insights]) => {
            goalsComponent.updateInsights?.(insights);
          }
        );

        // Subscribe to today's due goals
        const unsubscribeDue = window.subscribe("goals.todaysDue", ([due]) => {
          goalsComponent.updateTodaysDue?.(due);
        });

        return () => {
          unsubscribeGoals();
          unsubscribeInsights();
          unsubscribeDue();
        };
      },
      {
        type: window.ERROR_TYPES.UNKNOWN,
        severity: window.ERROR_SEVERITY.MEDIUM,
        context: { operation: "connectGoals" },
      }
    );
  },

  /**
   * Connects audio component to state
   */
  connectAudio: (audioComponent) => {
    return window.withErrorHandling(
      () => {
        // Subscribe to recording state
        const unsubscribeRecording = subscribe(
          ["audio.isRecording", "audio.recordingDuration"],
          ([isRecording, duration]) => {
            audioComponent.updateRecordingState?.(isRecording, duration);
          }
        );

        // Subscribe to playback state
        const unsubscribePlayback = subscribe(
          "audio.playingAudioId",
          ([audioId]) => {
            audioComponent.updatePlaybackState?.(audioId);
          }
        );

        return () => {
          unsubscribeRecording();
          unsubscribePlayback();
        };
      },
      {
        type: window.ERROR_TYPES.UNKNOWN,
        severity: window.ERROR_SEVERITY.MEDIUM,
        context: { operation: "connectAudio" },
      }
    );
  },

  /**
   * Connects voice control to state
   */
  connectVoice: (voiceComponent) => {
    return window.withErrorHandling(
      () => {
        // Subscribe to voice state
        const unsubscribeVoice = subscribe(
          ["voice.state", "voice.isListening"],
          ([state, isListening]) => {
            voiceComponent.updateVoiceState?.(state, isListening);
          }
        );

        // Subscribe to settings changes
        const unsubscribeSettings = subscribe(
          "settings.handsFreeMode",
          ([enabled]) => {
            voiceComponent.updateHandsFreeMode?.(enabled);
          }
        );

        return () => {
          unsubscribeVoice();
          unsubscribeSettings();
        };
      },
      {
        type: window.ERROR_TYPES.UNKNOWN,
        severity: window.ERROR_SEVERITY.MEDIUM,
        context: { operation: "connectVoice" },
      }
    );
  },
};

/**
 * State debugging utilities
 */
const stateDebug = {
  /**
   * Logs current state to console
   */
  logState: (path = null) => {
    const state = window.getState(path);
    console.log("Current State:", state);
    return state;
  },

  /**
   * Gets state history
   */
  getHistory: () => {
    return window.stateManager.history;
  },

  /**
   * Gets performance info
   */
  getPerformance: () => {
    return window.stateManager.getDebugInfo();
  },

  /**
   * Exports state for debugging
   */
  exportState: () => {
    return window.stateManager.exportState();
  },

  /**
   * Resets state to initial values
   */
  resetState: () => {
    return window.stateManager.reset();
  },

  /**
   * Monitors state changes
   */
  monitorChanges: (duration = 10000) => {
    console.log(`Monitoring state changes for ${duration}ms...`);

    const unsubscribe = subscribe("", (newValues, oldValues, newState) => {
      console.log("State changed:", {
        timestamp: new Date().toISOString(),
        performance: newState.performance,
      });
    });

    setTimeout(() => {
      unsubscribe();
      console.log("State monitoring ended");
    }, duration);

    return unsubscribe;
  },
};

/**
 * Initialize state management system
 */
function initStateManagement() {
  // Add middleware
  stateManager.addMiddleware(loggingMiddleware);
  stateManager.addMiddleware(performanceMiddleware);
  stateManager.addMiddleware(persistenceMiddleware);

  // Set initial app state
  window.actions.setState({ app: { initialized: true } });

  console.log("🔄 State management system initialized");

  return window.stateManager;
}

// Export actions for convenience
// Make functions available globally for Vue.js compatibility
window.useAppState = useAppState;
window.StateAwareComponent = StateAwareComponent;
window.loggingMiddleware = loggingMiddleware;
window.performanceMiddleware = performanceMiddleware;
window.persistenceMiddleware = persistenceMiddleware;
window.stateIntegration = stateIntegration;
window.stateDebug = stateDebug;
window.initStateManagement = initStateManagement;
window.actions = window.actions;

// Export state manager for direct access
window.stateManager = window.stateManager;
window.getState = window.getState;
window.setState = window.setState;
window.subscribe = window.subscribe;
window.addMiddleware = window.addMiddleware;
window.actions = window.actions;
window.default = window.stateManager;