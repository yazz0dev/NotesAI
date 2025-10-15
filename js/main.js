import store from "./services/store.js";
import aiService from "./services/ai-service.js";
import { alertService } from "./services/alert-service.js";
import AppHeader from "./components/AppHeader.js";
import AppSidebar from "./components/AppSidebar.js";
import NotesList from "./components/NotesList.js";
import NoteEditor from "./components/NoteEditor.js";
import SettingsModal from "./components/SettingsModal.js";
import SkeletonLoader from "./components/SkeletonLoader.js";
import AlertModal from "./components/AlertModal.js";
import TagSelectionModal from "./components/TagSelectionModal.js";

const { createApp } = Vue;

const app = createApp({
  components: {
    AppHeader, AppSidebar, NotesList, NoteEditor, SettingsModal, SkeletonLoader, AlertModal, TagSelectionModal
  },
  data() {
    return {
      notes: [], allTags: [], noteToTag: null, currentView: "all-notes", editingNote: null,
      isLoading: true, searchQuery: "",
      isSidebarCollapsed: localStorage.getItem("sidebarCollapsed") === "true",
      handsFreeMode: localStorage.getItem("handsFreeMode") === "true",
      currentTheme: localStorage.getItem("theme") || "auto",
      aiStatus: { status: "disabled", message: "Initializing..." }, isDictating: false,
      contentBeforeDictation: "", isSettingsModalVisible: false, currentSort: "updatedAt-desc",
      currentLayout: "grid", saveStatus: 'idle', newTagName: "", isResizing: false,
    };
  },
  computed: {
    filteredNotes() {
      let notesToFilter;
      // 1. Filter by View
      if (this.currentView === "favorites") notesToFilter = this.notes.filter((n) => n.isFavorite && !n.isArchived);
      else if (this.currentView === "archived") notesToFilter = this.notes.filter((n) => n.isArchived);
      else if (this.currentView.startsWith("tag:")) {
        const tagId = this.currentView.split(':')[1];
        const filteredNotes = this.notes.filter(n => !n.isArchived && n.tags && n.tags.includes(tagId));
        notesToFilter = filteredNotes;
      } 
      else notesToFilter = this.notes.filter((n) => !n.isArchived);

      // 2. Filter by Search Query
      if (this.searchQuery.trim()) {
        const searchKeywords = this.searchQuery.toLowerCase().split(' ').filter(Boolean);
        notesToFilter = notesToFilter.filter(note => {
          const noteText = (note.summary + ' ' + (note.content || '')).toLowerCase().replace(/<[^>]*>/g, "");
          return searchKeywords.every(keyword => noteText.includes(keyword));
        });
      }

      // 3. Sort
      const [sortKey, sortDir] = this.currentSort.split('-');
      notesToFilter.sort((a, b) => {
        let valA = a[sortKey], valB = b[sortKey];
        if (sortKey.includes('At')) { valA = new Date(valA); valB = new Date(valB); }
        if (valA < valB) return sortDir === 'asc' ? -1 : 1;
        if (valA > valB) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });

      return notesToFilter;
    },
  },
  methods: {
    // --- DATA & CORE LOGIC ---
    async fetchAllData() { await this.fetchNotes(); await this.fetchTags(); },
    async fetchNotes() {
      const notes = await store.getNotes();
      this.notes = await Promise.all(notes.map(async (note) => {
        if (note.audioUrl && note.audioUrl.startsWith("blob:")) {
          try {
            note.audioUrl = await this.convertBlobUrlToDataUrl(note.audioUrl);
            await store.saveNote(note);
          } catch (error) { console.warn(`Failed to migrate blob URL for note ${note.id}:`, error); }
        }
        // Ensure all notes have a tags array
        if (!note.tags) {
          note.tags = [];
        }
        return note;
      }));
    },
    async fetchTags() {
        this.allTags = await store.getTags();
    },
    async saveNote(noteToSave) {
      console.log('Main: Saving note:', noteToSave);
      this.saveStatus = 'saving';
      try {
        const analysis = await aiService.analyzeNote(noteToSave.content);
        const noteToStore = { ...noteToSave, ...analysis, updatedAt: new Date().toISOString() };
        console.log('Main: Note to store:', noteToStore);
        const savedNote = await store.saveNote(noteToStore);
        console.log('Main: Saved note:', savedNote);
        this.updateNoteInState(savedNote);
        if (this.editingNote && this.editingNote.id === savedNote.id) this.editingNote = { ...savedNote };
        this.saveStatus = 'saved';
        setTimeout(() => { if (this.saveStatus === 'saved') this.saveStatus = 'idle' }, 2000);
      } catch (error) { console.error("Failed to save note:", error); this.saveStatus = 'error'; }
    },
    async deleteNote(noteId) {
      const confirmed = await alertService.confirm('Delete Note', 'Are you sure you want to permanently delete this note?', { confirmText: 'Delete' });
      if (confirmed) {
        if (this.editingNote && this.editingNote.id === noteId) this.closeEditor();
        await store.deleteNote(noteId);
        await this.fetchNotes();
      }
    },
    createNewNote(content = "", shouldOpenEditor = true) {
        const timestamp = new Date();
        const summary = content ? `Voice Note ${timestamp.toLocaleTimeString()}` : "New Note";
        const newNote = { id: `note_${timestamp.getTime()}`, summary, content, createdAt: timestamp.toISOString(), updatedAt: timestamp.toISOString(), isFavorite: false, isArchived: false, topics: [], tags: [], sentiment: "neutral", reminderAt: null };
        this.notes.unshift(newNote);
        if (shouldOpenEditor) this.editNote(newNote);
        return newNote;
    },
    editNote(note) {
        this.editingNote = JSON.parse(JSON.stringify(note));
        // Position the resizer after the editor becomes visible
        this.$nextTick(() => {
            this.positionResizer();
        });
    },
    positionResizer() {
        const editor = document.querySelector('.note-editor');
        const resizer = document.querySelector('.editor-resizer');
        if (editor && resizer) {
            // Use computed style to get the actual rendered width
            const computedStyle = window.getComputedStyle(editor);
            const editorWidth = parseInt(computedStyle.width) || editor.offsetWidth || 400; // fallback to 400px

            // Position the resizer at the left edge of the editor
            // The editor is positioned from right: 0, so we need to position
            // the resizer at the same position as the editor's left edge
            const container = editor.parentElement;
            const containerWidth = container.offsetWidth;

            // The editor's left edge is at: containerWidth - editorWidth
            // So the resizer should be positioned at: containerWidth - editorWidth
            const resizerLeft = containerWidth - editorWidth;
            resizer.style.left = `${resizerLeft}px`;
        }
    },
    closeEditor() {
        if (this.isDictating) aiService.stopDictation();
        this.editingNote = null;
        // Reset widths and resizer position when closing editor
        const mainContent = document.querySelector('.main-content');
        const resizer = document.querySelector('.editor-resizer');
        if (mainContent) {
            mainContent.style.width = '';
        }
        if (resizer) {
            resizer.style.left = '';
        }
    },
    
    // --- THEME MANAGEMENT ---
    setTheme(theme) {
      this.currentTheme = theme;
      localStorage.setItem("theme", theme);

      // Apply theme to document
      if (theme === "auto") {
        // Remove data-theme attribute for auto mode (uses CSS media queries)
        document.documentElement.removeAttribute("data-theme");
        // Listen for system theme changes
        this.watchSystemTheme();
      } else {
        document.documentElement.setAttribute("data-theme", theme);
        // Stop watching system theme when manual mode is selected
        this.stopWatchingSystemTheme();
      }
    },

    watchSystemTheme() {
      // Watch for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
      }
    },

    stopWatchingSystemTheme() {
      // Stop watching for system theme changes
      if (window.matchMedia) {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
      }
    },

    handleSystemThemeChange(e) {
      // Only apply system theme changes if current theme is set to auto
      if (this.currentTheme === "auto") {
        // The CSS will automatically handle the theme change via media queries
        // We don't need to do anything here as the CSS variables will update automatically
        console.log('System theme changed:', e.matches ? 'dark' : 'light');
      }
    },
    getCurrentTheme() {
      return this.currentTheme;
    },
    openHelp() {
      // Simple help modal or redirect to help documentation
      alertService.confirm(
        'Help & Documentation',
        'Welcome to Notes & Tasks!\n\n' +
        '• Click the microphone button to start voice dictation\n' +
        '• Use the sidebar to navigate between notes, favorites, and archived items\n' +
        '• Click the search bar to find specific notes\n' +
        '• Use the grid/list toggle to change your view\n' +
        '• Tag your notes for better organization\n' +
        '• Set reminders for important notes\n\n' +
        'For more detailed help, visit our documentation.',
        { confirmText: 'Got it!', cancelText: false }
      );
    },

    // --- UI & VIEW HANDLERS ---
    switchView(view) {
        console.log('Switching to view:', view);
        this.currentView = view;
        this.editingNote = null;
        // Clear search when switching views (except for search view itself)
        if (view !== 'search' && !view.startsWith('tag:')) {
            this.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
        }
    },
    toggleSidebar() { 
        this.isSidebarCollapsed = !this.isSidebarCollapsed; 
        localStorage.setItem("sidebarCollapsed", this.isSidebarCollapsed);
    },
    toggleLayout() { this.currentLayout = this.currentLayout === 'grid' ? 'list' : 'grid'; },
    handleSortChange() {
      const sorts = ['updatedAt-desc', 'createdAt-desc', 'summary-asc'];
      this.currentSort = sorts[(sorts.indexOf(this.currentSort) + 1) % sorts.length];
    },
    getSortLabel() {
      const labels = {
        'updatedAt-desc': 'Newest',
        'createdAt-desc': 'Created',
        'summary-asc': 'A-Z'
      };
      return labels[this.currentSort] || 'Sort';
    },
    handleSearch(event) { this.searchQuery = event.target.value.trim().replace(/\s+/g, ' '); },
    openTagModal(note) { this.noteToTag = note; },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) {
        console.log('Filtering by tag:', tagId);
        this.currentView = `tag:${tagId}`;
        // Don't set searchQuery for pure tag filtering
        // Clear search if it was previously set to a tag name to avoid confusion
        if (this.searchQuery && this.allTags.find(t => t.name === this.searchQuery)) {
            this.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
        }
    },
    // **REVISED & CORRECTED TAG CREATION LOGIC**
    async handleCreateTag(tagName = null) {
        // If tagName is not provided, use newTagName (for backward compatibility)
        const name = (tagName || this.newTagName || '').trim();
        if (!name) return;

        const newTag = {
            id: `tag_${Date.now()}`,
            name,
            color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
        };

        try {
            // Save to the database
            const savedTag = await store.saveTag(newTag);

            // **FIX:** Directly update the local state for instant reactivity
            this.allTags.push(savedTag);

            // Keep the list sorted consistently
            this.allTags.sort((a,b) => a.name.localeCompare(b.name));

            // Clear the input field
            this.newTagName = "";
        } catch (error) {
            console.error("Failed to save tag:", error);
            // Show an error to the user
            alertService.confirm('Error', 'Could not save the new tag. Please try again.');
        }
    },
    
    // --- CARD ACTION HANDLERS ---
    async handleToggleFavorite(note) {
      const updatedNote = { ...note, isFavorite: !note.isFavorite };
      this.updateNoteInState(updatedNote);
      await store.saveNote(updatedNote);
    },
    async handleArchiveNote(note) {
      const isArchived = !!note.isArchived;
      if (this.editingNote && this.editingNote.id === note.id) this.closeEditor();
      const updatedNote = { ...note, isArchived: !isArchived };
      this.updateNoteInState(updatedNote);
      await store.saveNote(updatedNote);
      await this.fetchNotes();
    },
    async setReminder(note) {
      const currentReminder = note.reminderAt ? new Date(note.reminderAt).toISOString().slice(0, 16) : '';
      const result = await alertService.input(
        note.reminderAt ? 'Edit Reminder' : 'Set Reminder',
        note.reminderAt ? 'Edit the reminder date and time:' : 'Enter date and time for the reminder:',
        {
          inputType: 'datetime-local',
          inputPlaceholder: 'YYYY-MM-DDTHH:MM',
          defaultValue: currentReminder,
          confirmText: note.reminderAt ? 'Update Reminder' : 'Set Reminder',
          cancelText: 'Cancel'
        }
      );

      if (result !== null) {
        const updatedNote = {
          ...note,
          reminderAt: result ? new Date(result).toISOString() : null
        };
        this.updateNoteInState(updatedNote);
        await store.saveNote(updatedNote);
      }
    },
    async handleUpdateTags({ noteId, tagIds }) {
      const noteToUpdate = this.notes.find(n => n.id === noteId);
      if (noteToUpdate) {
        const updatedNote = { ...noteToUpdate, tags: tagIds };
        this.updateNoteInState(updatedNote);
        await store.saveNote(updatedNote);
      }
    },

    // --- AI & DICTATION HANDLERS ---
    handleDictateToggle() {
      if (this.isDictating) aiService.stopDictation();
      else {
        if (this.editingNote) {
          this.contentBeforeDictation = this.editingNote.content;
          this.$nextTick(() => { const editorEl = document.querySelector('.note-content-editable'); if(editorEl) editorEl.focus(); });
        } else {
          this.contentBeforeDictation = "";
          this.createNewNote("", true);
        }
        aiService.startDictation();
      }
    },
    handleAIStatusUpdate(event) { this.aiStatus = event.detail; },
    handleAICreateNote(event) { this.createNewNote(event.detail.content); },
    handleAISearch(event) {
      this.searchQuery = event.detail.query;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.value = this.searchQuery;
    },
    handleAIDictationStarted() { this.isDictating = true; },
    handleAIDictationUpdate(event) {
      if (this.editingNote) {
        const newText = event.detail.transcript;
        const separator = this.contentBeforeDictation.trim() === '' ? '' : ' ';
        this.editingNote.content = this.contentBeforeDictation + separator + newText;
      }
    },
    handleAIDictationFinished(event) {
      if (this.editingNote) this.editingNote.audioUrl = event.detail.audioUrl;
      this.isDictating = false;
    },
    
    // --- EDITOR RESIZE HANDLERS ---
    startResize(event) {
        event.preventDefault();
        this.isResizing = true;
        document.body.classList.add('is-resizing');

        // Ensure the editor has an explicit width set for the resize operation
        const editor = document.querySelector('.note-editor');
        const mainContent = document.querySelector('.main-content');
        const resizer = document.querySelector('.editor-resizer');
        if (editor && mainContent && resizer) {
            // Set initial widths if not already set
            if (!editor.style.width) {
                const containerWidth = mainContent.parentElement.offsetWidth;
                const initialEditorWidth = Math.min(500, Math.max(350, containerWidth * 0.4));
                editor.style.width = `${initialEditorWidth}px`;
                mainContent.style.width = `${containerWidth - initialEditorWidth}px`;
            }

            // Position the resizer at the left edge of the editor
            const editorWidth = parseInt(editor.style.width) || editor.offsetWidth || 400;
            const containerWidth = mainContent.parentElement.offsetWidth;
            const resizerLeft = containerWidth - editorWidth;
            resizer.style.left = `${resizerLeft}px`;
        }

        window.addEventListener('mousemove', this.doResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    doResize(event) {
        if (!this.isResizing) return;
        const editor = document.querySelector('.note-editor');
        const mainContent = document.querySelector('.main-content');
        const resizer = document.querySelector('.editor-resizer');
        const sidebar = document.querySelector('.sidebar');
        const container = mainContent.parentElement;
        if (!editor || !mainContent || !resizer || !sidebar || !container) return;

        const containerRect = container.getBoundingClientRect();

        // Calculate mouse position relative to the container
        const relativeX = event.clientX - containerRect.left;

        // Ensure minimum widths
        const minMainWidth = 300;
        const minEditorWidth = 350;
        const maxEditorWidth = Math.max(minEditorWidth, containerRect.width * 0.8);

        // For left-side dragging:
        // - Editor width = distance from left edge to mouse position
        // - Main content width = distance from mouse position to right edge
        const newEditorWidth = Math.max(minEditorWidth, Math.min(maxEditorWidth, relativeX));
        const newMainWidth = Math.max(minMainWidth, containerRect.width - relativeX);

        // Apply the new widths
        editor.style.width = `${newEditorWidth}px`;
        mainContent.style.width = `${newMainWidth}px`;

        // Position the resizer at the left edge of the editor (same as editor's left edge)
        const containerWidth = container.offsetWidth;
        const resizerLeft = containerWidth - newEditorWidth;
        resizer.style.left = `${resizerLeft}px`;
    },
    stopResize() {
        this.isResizing = false; document.body.classList.remove('is-resizing');
        window.removeEventListener('mousemove', this.doResize); window.removeEventListener('mouseup', this.stopResize);
    },

    // --- HELPERS & REMINDERS ---
    updateNoteInState(updatedNote) {
      const index = this.notes.findIndex(n => n.id === updatedNote.id);
      if (index !== -1) this.notes.splice(index, 1, updatedNote);
    },
    async convertBlobUrlToDataUrl(blobUrl) {
        const response = await fetch(blobUrl); const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result); reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    checkReminders() {
        const now = new Date();
        const upcomingNotes = this.notes.filter(note => {
            if (!note.reminderAt || note.isArchived || note.reminderSeen) return false;
            return new Date(note.reminderAt) <= now;
        });
        upcomingNotes.forEach(async (note) => {
            await alertService.confirm('Reminder', `Your note titled "${note.summary}" is due now.`, { confirmText: 'Mark as Done', cancelText: 'Snooze' });
            const updatedNote = { ...note, reminderSeen: true };
            this.updateNoteInState(updatedNote);
            await store.saveNote(updatedNote);
        });
    },
  },
  watch: {
    isSidebarCollapsed(isCollapsed) {
      document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    },
    handsFreeMode(newValue) {
      localStorage.setItem("handsFreeMode", newValue);
      newValue ? aiService.startAmbientListening() : aiService.stopAmbientListening();
    },
    newTagName(newValue, oldValue) {
      // Ensure newTagName is never undefined
      if (newValue === undefined) {
        this.newTagName = '';
      }
    },
    editingNote: {
      handler(newNote, oldNote) {
        if (newNote && !oldNote) {
          // Editor just opened - position the resizer
          this.$nextTick(() => {
            setTimeout(() => {
              this.positionResizer();
            }, 100); // Small delay to ensure DOM is fully updated
          });
        } else if (!newNote && oldNote) {
          // Editor just closed - reset resizer position
          const resizer = document.querySelector('.editor-resizer');
          if (resizer) {
            resizer.style.left = '';
          }
        }
      },
      immediate: true
    }
  },
  async created() {
    // Apply initial theme
    this.setTheme(this.currentTheme);

    await store.initDB();
    await this.fetchAllData();
    aiService.init();
    window.addEventListener("ai-status-update", this.handleAIStatusUpdate);
    window.addEventListener("ai-create-note", this.handleAICreateNote);
    window.addEventListener("ai-search", this.handleAISearch);
    window.addEventListener("ai-dictation-started", this.handleAIDictationStarted);
    window.addEventListener("ai-dictation-update", this.handleAIDictationUpdate);
    window.addEventListener("ai-dictation-finished", this.handleAIDictationFinished);
    this.isLoading = false;
    setInterval(this.checkReminders, 60000);
  },
  mounted() {
    document.body.classList.toggle("sidebar-collapsed", this.isSidebarCollapsed);
    // Position resizer when component mounts and window resizes
    if (this.editingNote) {
      this.positionResizer();
    }
    window.addEventListener('resize', () => {
      if (this.editingNote) {
        this.positionResizer();
      }
    });
  },
  beforeUnmount() {
    window.removeEventListener("ai-status-update", this.handleAIStatusUpdate);
    window.removeEventListener("ai-create-note", this.handleAICreateNote);
    window.removeEventListener("ai-search", this.handleAISearch);
    window.removeEventListener("ai-dictation-started", this.handleAIDictationStarted);
    window.removeEventListener("ai-dictation-update", this.handleAIDictationUpdate);
    window.removeEventListener("ai-dictation-finished", this.handleAIDictationFinished);
    window.removeEventListener('resize', this.handleResize);
    // Clean up system theme watcher
    this.stopWatchingSystemTheme();
  },
});
app.mount("#app");