// js/state-manager.js
// Centralized state management system for the AI Journal

import { withErrorHandling, ERROR_TYPES, ERROR_SEVERITY } from './error-handler.js';

/**
 * State management system with reactive updates and persistence
 */
class StateManager {
    constructor() {
        this.state = this.getInitialState();
        this.subscribers = new Map(); // Component subscriptions
        this.middleware = []; // Middleware functions
        this.history = []; // State history for debugging
        this.maxHistorySize = 50;
        
        // Persistence settings
        this.persistenceKey = 'ai_journal_state';
        this.persistedKeys = ['ui', 'settings', 'goals']; // Keys to persist
        
        this.setupPerformanceMonitoring();
        this.loadPersistedState();
    }

    /**
     * Gets the initial application state
     */
    getInitialState() {
        return {
            // Application state
            app: {
                initialized: false,
                loading: false,
                error: null,
                version: '2.0.0'
            },
            
            // UI state
            ui: {
                view: 'bookshelf', // bookshelf, reader, settings
                theme: 'dark',
                sidebarOpen: false,
                modalsOpen: [],
                searchQuery: '',
                selectedNoteId: null,
                isEditing: false,
                promptsVisible: false
            },
            
            // Data state
            data: {
                notes: [],
                goals: [],
                searchResults: [],
                filteredNotes: [],
                recentTopics: [],
                currentSentiment: 'neutral'
            },
            
            // Audio state
            audio: {
                isRecording: false,
                recordingData: null,
                recordingDuration: 0,
                playingAudioId: null
            },
            
            // Voice control state
            voice: {
                isListening: false,
                isAmbientMode: false,
                lastCommand: null,
                state: 'IDLE' // IDLE, AMBIENT_LISTENING, DICTATION_MODE
            },
            
            // Settings state
            settings: {
                handsFreeMode: false,
                autoSave: true,
                exportFormat: 'json',
                aiInsights: true,
                notifications: true,
                darkMode: true
            },
            
            // Goals state
            goals: {
                activeGoals: [],
                completedGoals: [],
                insights: null,
                streakCount: 0,
                todaysDue: []
            },
            
            // Performance state
            performance: {
                renderTime: 0,
                stateUpdates: 0,
                lastUpdate: null
            }
        };
    }

    /**
     * Gets the current state or a specific slice
     * @param {string} path - Optional path to specific state slice (e.g., 'ui.view')
     * @returns {*} State value
     */
    getState(path = null) {
        if (!path) return { ...this.state };
        
        return this.getNestedValue(this.state, path);
    }

    /**
     * Updates state with optional validation and middleware
     * @param {Object|Function} update - State update object or updater function
     * @param {Object} options - Update options
     */
    async setState(update, options = {}) {
        return withErrorHandling(
            async () => {
                const { 
                    merge = true, 
                    validate = true, 
                    persist = true,
                    silent = false,
                    source = 'unknown'
                } = options;

                const startTime = performance.now();
                const previousState = { ...this.state };
                
                // Apply update
                let newState;
                if (typeof update === 'function') {
                    newState = update(previousState);
                } else {
                    newState = merge ? this.deepMerge(previousState, update) : update;
                }
                
                // Validate state if enabled
                if (validate && !this.validateState(newState)) {
                    throw new Error('State validation failed');
                }
                
                // Apply middleware
                for (const middleware of this.middleware) {
                    newState = await middleware(newState, previousState, { source });
                }
                
                // Update state
                this.state = newState;
                
                // Add to history
                this.addToHistory(previousState, newState, source);
                
                // Update performance metrics
                this.state.performance.renderTime = performance.now() - startTime;
                this.state.performance.stateUpdates++;
                this.state.performance.lastUpdate = new Date().toISOString();
                
                // Persist state if enabled
                if (persist) {
                    this.persistState();
                }
                
                // Notify subscribers
                if (!silent) {
                    this.notifySubscribers(newState, previousState);
                }
                
                return newState;
            },
            {
                type: ERROR_TYPES.UNKNOWN,
                severity: ERROR_SEVERITY.MEDIUM,
                context: { operation: 'setState', source }
            }
        );
    }

    /**
     * Subscribes to state changes
     * @param {string|Array} paths - State paths to watch
     * @param {Function} callback - Callback function
     * @param {Object} options - Subscription options
     * @returns {Function} Unsubscribe function
     */
    subscribe(paths, callback, options = {}) {
        const { 
            immediate = false,
            debounce = 0,
            filter = null
        } = options;
        
        const subscriptionId = this.generateId();
        const pathsArray = Array.isArray(paths) ? paths : [paths];
        
        let debouncedCallback = callback;
        if (debounce > 0) {
            let timeoutId;
            debouncedCallback = (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => callback(...args), debounce);
            };
        }
        
        const subscription = {
            id: subscriptionId,
            paths: pathsArray,
            callback: debouncedCallback,
            filter,
            active: true
        };
        
        this.subscribers.set(subscriptionId, subscription);
        
        // Call immediately if requested
        if (immediate) {
            const currentValues = pathsArray.map(path => this.getState(path));
            callback(currentValues, currentValues, this.state);
        }
        
        // Return unsubscribe function
        return () => {
            const sub = this.subscribers.get(subscriptionId);
            if (sub) {
                sub.active = false;
                this.subscribers.delete(subscriptionId);
            }
        };
    }

    /**
     * Adds middleware for state updates
     * @param {Function} middleware - Middleware function
     */
    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }

    /**
     * Creates action creators for common state updates
     */
    createActions() {
        return {
            // App actions
            setLoading: (loading) => this.setState({ app: { loading } }),
            setError: (error) => this.setState({ app: { error } }),
            clearError: () => this.setState({ app: { error: null } }),
            
            // UI actions
            setView: (view) => this.setState({ ui: { view } }),
            setTheme: (theme) => this.setState({ ui: { theme } }),
            toggleSidebar: () => this.setState(state => ({ 
                ui: { sidebarOpen: !state.ui.sidebarOpen } 
            })),
            openModal: (modalId) => this.setState(state => ({
                ui: { modalsOpen: [...state.ui.modalsOpen, modalId] }
            })),
            closeModal: (modalId) => this.setState(state => ({
                ui: { modalsOpen: state.ui.modalsOpen.filter(id => id !== modalId) }
            })),
            setSearchQuery: (query) => this.setState({ ui: { searchQuery: query } }),
            selectNote: (noteId) => this.setState({ ui: { selectedNoteId: noteId } }),
            setEditing: (isEditing) => this.setState({ ui: { isEditing } }),
            togglePrompts: () => this.setState(state => ({
                ui: { promptsVisible: !state.ui.promptsVisible }
            })),
            
            // Data actions
            setNotes: (notes) => this.setState({ data: { notes } }),
            addNote: (note) => this.setState(state => ({
                data: { notes: [note, ...state.data.notes] }
            })),
            updateNote: (noteId, updates) => this.setState(state => ({
                data: { 
                    notes: state.data.notes.map(note => 
                        note.id === noteId ? { ...note, ...updates } : note
                    )
                }
            })),
            deleteNote: (noteId) => this.setState(state => ({
                data: { notes: state.data.notes.filter(note => note.id !== noteId) }
            })),
            setSearchResults: (results) => this.setState({ data: { searchResults: results } }),
            setRecentTopics: (topics) => this.setState({ data: { recentTopics: topics } }),
            setSentiment: (sentiment) => this.setState({ data: { currentSentiment: sentiment } }),
            
            // Audio actions
            setRecording: (isRecording, data = null) => this.setState({
                audio: { isRecording, recordingData: data }
            }),
            setRecordingDuration: (duration) => this.setState({
                audio: { recordingDuration: duration }
            }),
            setPlayingAudio: (audioId) => this.setState({
                audio: { playingAudioId: audioId }
            }),
            
            // Voice actions
            setVoiceState: (state) => this.setState({ voice: { state } }),
            setListening: (isListening) => this.setState({ voice: { isListening } }),
            setAmbientMode: (isAmbientMode) => this.setState({ voice: { isAmbientMode } }),
            setLastCommand: (command) => this.setState({ voice: { lastCommand: command } }),
            
            // Settings actions
            updateSettings: (settings) => this.setState({ settings }),
            toggleSetting: (key) => this.setState(state => ({
                settings: { [key]: !state.settings[key] }
            })),
            
            // Goals actions
            setGoals: (goals) => this.setState({ goals: { activeGoals: goals } }),
            addGoal: (goal) => this.setState(state => ({
                goals: { activeGoals: [...state.goals.activeGoals, goal] }
            })),
            updateGoal: (goalId, updates) => this.setState(state => ({
                goals: {
                    activeGoals: state.goals.activeGoals.map(goal =>
                        goal.id === goalId ? { ...goal, ...updates } : goal
                    )
                }
            })),
            setGoalsInsights: (insights) => this.setState({ goals: { insights } }),
            setTodaysDue: (goals) => this.setState({ goals: { todaysDue: goals } })
        };
    }

    /**
     * Notifies subscribers of state changes
     */
    notifySubscribers(newState, previousState) {
        for (const subscription of this.subscribers.values()) {
            if (!subscription.active) continue;
            
            try {
                // Check if any watched paths changed
                const changedPaths = subscription.paths.filter(path => {
                    const newValue = this.getNestedValue(newState, path);
                    const oldValue = this.getNestedValue(previousState, path);
                    return !this.deepEqual(newValue, oldValue);
                });
                
                if (changedPaths.length > 0) {
                    const newValues = subscription.paths.map(path => 
                        this.getNestedValue(newState, path)
                    );
                    const oldValues = subscription.paths.map(path => 
                        this.getNestedValue(previousState, path)
                    );
                    
                    // Apply filter if provided
                    if (subscription.filter && !subscription.filter(newValues, oldValues, newState)) {
                        continue;
                    }
                    
                    subscription.callback(newValues, oldValues, newState);
                }
            } catch (error) {
                console.error('Error in state subscription:', error);
            }
        }
    }

    /**
     * Validates state structure
     */
    validateState(state) {
        const requiredKeys = ['app', 'ui', 'data', 'audio', 'voice', 'settings', 'goals'];
        return requiredKeys.every(key => key in state);
    }

    /**
     * Persists state to localStorage
     */
    persistState() {
        try {
            const stateToPersist = {};
            this.persistedKeys.forEach(key => {
                if (key in this.state) {
                    stateToPersist[key] = this.state[key];
                }
            });
            
            localStorage.setItem(this.persistenceKey, JSON.stringify(stateToPersist));
        } catch (error) {
            console.warn('Failed to persist state:', error);
        }
    }

    /**
     * Loads persisted state from localStorage
     */
    loadPersistedState() {
        try {
            const persistedState = localStorage.getItem(this.persistenceKey);
            if (persistedState) {
                const parsed = JSON.parse(persistedState);
                this.state = this.deepMerge(this.state, parsed);
            }
        } catch (error) {
            console.warn('Failed to load persisted state:', error);
        }
    }

    /**
     * Adds state change to history
     */
    addToHistory(previousState, newState, source) {
        this.history.unshift({
            timestamp: Date.now(),
            source,
            previousState: { ...previousState },
            newState: { ...newState }
        });
        
        // Maintain history size
        if (this.history.length > this.maxHistorySize) {
            this.history = this.history.slice(0, this.maxHistorySize);
        }
    }

    /**
     * Sets up performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor memory usage
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > 50 * 1024 * 1024) { // 50MB
                    console.warn('High memory usage detected:', {
                        used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
                        total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
                        subscribers: this.subscribers.size,
                        historySize: this.history.length
                    });
                }
            }, 30000); // Check every 30 seconds
        }
    }

    /**
     * Utility methods
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    }

    deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        
        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);
            
            if (keysA.length !== keysB.length) return false;
            
            return keysA.every(key => this.deepEqual(a[key], b[key]));
        }
        
        return false;
    }

    generateId() {
        return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Debug methods
     */
    getDebugInfo() {
        return {
            stateSize: JSON.stringify(this.state).length,
            subscriberCount: this.subscribers.size,
            historySize: this.history.length,
            middlewareCount: this.middleware.length,
            performance: this.state.performance
        };
    }

    exportState() {
        return {
            state: this.state,
            history: this.history.slice(0, 10), // Last 10 changes
            debug: this.getDebugInfo()
        };
    }

    reset() {
        this.state = this.getInitialState();
        this.history = [];
        localStorage.removeItem(this.persistenceKey);
    }
}

// Create global state manager instance
const stateManager = new StateManager();

// Create and export actions
export const actions = stateManager.createActions();

// Export main functions
export const getState = (path) => stateManager.getState(path);
export const setState = (update, options) => stateManager.setState(update, options);
export const subscribe = (paths, callback, options) => stateManager.subscribe(paths, callback, options);
export const addMiddleware = (middleware) => stateManager.addMiddleware(middleware);

// Export state manager instance
export default stateManager;
