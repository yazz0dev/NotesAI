const { defineStore } = window.Pinia;

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    // Theme settings
    theme: 'light', // 'light', 'dark', 'auto'
    
    // Voice settings
    handsFreeMode: false,
    saveVoiceRecordings: false,
    voiceLanguage: 'en-US',
    
    // Editor settings
    fontSize: 14,
    fontFamily: 'system-ui',
    lineHeight: 1.6,
    autoSave: true,
    autoSaveDelay: 1000, // milliseconds
    
    // UI settings
    sidebarCollapsed: false,
    currentLayout: 'grid', // 'grid', 'list', 'compact'
    sortBy: 'updatedAt', // 'updatedAt', 'createdAt', 'summary', 'title'
    sortOrder: 'desc', // 'asc', 'desc'
    
    // Filter settings
    currentFilter: 'all', // 'all', 'active', 'archived', 'favorites'
    currentTag: null,
    searchQuery: '',
    
    // Notification settings
    enableNotifications: true,
    reminderSound: true,
    
    // AI settings
    aiEnabled: true,
    aiAutoSuggest: true,
    
    // Sync settings
    lastSyncTime: null,
    syncInterval: 300000, // 5 minutes in milliseconds
    
    // Export/Import settings
    exportFormat: 'json', // 'json', 'markdown', 'txt'
    includeArchived: false,
    
    // Privacy settings
    enableAnalytics: false,
    shareUsageData: false
  }),

  getters: {
    // Get effective theme (resolve 'auto' to actual theme)
    effectiveTheme: (state) => {
      if (state.theme === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return state.theme;
    },

    // Check if dark mode is active
    isDarkMode: (state) => {
      return state.effectiveTheme === 'dark';
    },

    // Get all settings as object
    allSettings: (state) => {
      return { ...state };
    },

    // Get editor settings
    editorSettings: (state) => {
      return {
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        lineHeight: state.lineHeight,
        autoSave: state.autoSave,
        autoSaveDelay: state.autoSaveDelay
      };
    },

    // Get voice settings
    voiceSettings: (state) => {
      return {
        handsFreeMode: state.handsFreeMode,
        saveVoiceRecordings: state.saveVoiceRecordings,
        voiceLanguage: state.voiceLanguage
      };
    }
  },

  actions: {
    // Initialize settings from localStorage
    initialize() {
      this.loadFromLocalStorage();
      this.applyTheme();
      this.setupThemeWatcher();
    },

    // Load settings from localStorage
    loadFromLocalStorage() {
      const savedSettings = localStorage.getItem('app-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          this.$patch(parsed);
        } catch (e) {
          console.error('Failed to load settings:', e);
        }
      }
    },

    // Save settings to localStorage
    saveToLocalStorage() {
      try {
        localStorage.setItem('app-settings', JSON.stringify(this.$state));
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    },

    // Update theme
    setTheme(theme) {
      this.theme = theme;
      this.applyTheme();
      this.saveToLocalStorage();
    },

    // Apply theme to document
    applyTheme() {
      const effectiveTheme = this.effectiveTheme;
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      document.body.className = effectiveTheme === 'dark' ? 'dark-mode' : '';
    },

    // Setup watcher for auto theme changes
    setupThemeWatcher() {
      if (this.theme === 'auto') {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', () => {
          this.applyTheme();
        });
      }
    },

    // Update hands-free mode
    setHandsFreeMode(enabled) {
      this.handsFreeMode = enabled;
      localStorage.setItem('handsFreeMode', enabled.toString());
      this.saveToLocalStorage();
    },

    // Update voice recordings setting
    setSaveVoiceRecordings(enabled) {
      this.saveVoiceRecordings = enabled;
      this.saveToLocalStorage();
    },

    // Update voice language
    setVoiceLanguage(language) {
      this.voiceLanguage = language;
      this.saveToLocalStorage();
    },

    // Update sidebar collapsed state
    setSidebarCollapsed(collapsed) {
      this.sidebarCollapsed = collapsed;
      this.saveToLocalStorage();
    },

    // Update layout
    setLayout(layout) {
      this.currentLayout = layout;
      this.saveToLocalStorage();
    },

    // Update sort settings
    setSortBy(sortBy) {
      this.sortBy = sortBy;
      this.saveToLocalStorage();
    },

    setSortOrder(order) {
      this.sortOrder = order;
      this.saveToLocalStorage();
    },

    // Update filter settings
    setFilter(filter) {
      this.currentFilter = filter;
      this.saveToLocalStorage();
    },

    setCurrentTag(tag) {
      this.currentTag = tag;
      this.saveToLocalStorage();
    },

    setSearchQuery(query) {
      this.searchQuery = query;
    },

    // Update editor settings
    setFontSize(size) {
      this.fontSize = Math.max(10, Math.min(24, size));
      this.saveToLocalStorage();
    },

    setFontFamily(family) {
      this.fontFamily = family;
      this.saveToLocalStorage();
    },

    setLineHeight(height) {
      this.lineHeight = height;
      this.saveToLocalStorage();
    },

    setAutoSave(enabled) {
      this.autoSave = enabled;
      this.saveToLocalStorage();
    },

    setAutoSaveDelay(delay) {
      this.autoSaveDelay = delay;
      this.saveToLocalStorage();
    },

    // Update notification settings
    setEnableNotifications(enabled) {
      this.enableNotifications = enabled;
      this.saveToLocalStorage();
      
      // Request notification permission if enabled
      if (enabled && 'Notification' in window) {
        Notification.requestPermission();
      }
    },

    setReminderSound(enabled) {
      this.reminderSound = enabled;
      this.saveToLocalStorage();
    },

    // Update AI settings
    setAIEnabled(enabled) {
      this.aiEnabled = enabled;
      this.saveToLocalStorage();
    },

    setAIAutoSuggest(enabled) {
      this.aiAutoSuggest = enabled;
      this.saveToLocalStorage();
    },

    // Update sync settings
    updateLastSyncTime() {
      this.lastSyncTime = new Date().toISOString();
      this.saveToLocalStorage();
    },

    setSyncInterval(interval) {
      this.syncInterval = interval;
      this.saveToLocalStorage();
    },

    // Export settings
    exportSettings() {
      return JSON.stringify(this.$state, null, 2);
    },

    // Import settings
    importSettings(jsonData) {
      try {
        const settings = JSON.parse(jsonData);
        this.$patch(settings);
        this.saveToLocalStorage();
        this.applyTheme();
      } catch (e) {
        console.error('Failed to import settings:', e);
        throw e;
      }
    },

    // Reset to default settings
    resetToDefaults() {
      this.$reset();
      this.saveToLocalStorage();
      this.applyTheme();
    },

    // Toggle setting (for boolean values)
    toggleSetting(key) {
      if (typeof this[key] === 'boolean') {
        this[key] = !this[key];
        this.saveToLocalStorage();
      }
    }
  }
});
