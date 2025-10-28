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
      if (this.currentView === "favorites") notesToFilter = this.notes.filter((n) => n.isFavorite && !n.isArchived);
      else if (this.currentView === "archived") notesToFilter = this.notes.filter((n) => n.isArchived);
      else if (this.currentView.startsWith("tag:")) {
        const tagId = this.currentView.split(':')[1];
        notesToFilter = this.notes.filter(n => !n.isArchived && n.tags && n.tags.includes(tagId));
      } 
      else notesToFilter = this.notes.filter((n) => !n.isArchived);

      if (this.searchQuery.trim()) {
        const searchKeywords = this.searchQuery.toLowerCase().split(' ').filter(Boolean);
        notesToFilter = notesToFilter.filter(note => {
          const noteText = (note.summary + ' ' + (note.content || '')).toLowerCase().replace(/<[^>]*>/g, "");
          return searchKeywords.every(keyword => noteText.includes(keyword));
        });
      }

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
        if (!note.tags) note.tags = [];
        return note;
      }));
    },
    async fetchTags() { this.allTags = await store.getTags(); },
    async saveNote(noteToSave) {
      this.saveStatus = 'saving';
      try {
        const analysis = await aiService.analyzeNote(noteToSave.content);
        const noteToStore = { ...noteToSave, ...analysis, updatedAt: new Date().toISOString() };
        const savedNote = await store.saveNote(noteToStore);
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
    editNote(note) { this.editingNote = JSON.parse(JSON.stringify(note)); },
    closeEditor() {
        if (this.isDictating) aiService.stopDictation();
        this.editingNote = null;
    },
    setTheme(theme) {
      this.currentTheme = theme;
      localStorage.setItem("theme", theme);
      if (theme === "auto") {
        document.documentElement.removeAttribute("data-theme");
        this.watchSystemTheme();
      } else {
        document.documentElement.setAttribute("data-theme", theme);
        this.stopWatchingSystemTheme();
      }
    },
    watchSystemTheme() {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
    },
    stopWatchingSystemTheme() {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
    },
    handleSystemThemeChange(e) { if (this.currentTheme === "auto") console.log('System theme changed:', e.matches ? 'dark' : 'light'); },
    getSortLabel() {
      const labels = { 'updatedAt-desc': 'Newest', 'createdAt-desc': 'Created', 'summary-asc': 'A-Z' };
      return labels[this.currentSort] || 'Sort';
    },
    handleSearch(queryText) { 
        this.searchQuery = (queryText || '').trim().replace(/\s+/g, ' '); 
    },
    switchView(view) {
        this.currentView = view;
        this.editingNote = null;
        if (view !== 'search' && !view.startsWith('tag:')) {
            this.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.textContent = '';
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
    openTagModal(note) { this.noteToTag = note; },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) {
        this.currentView = `tag:${tagId}`;
        if (this.searchQuery) {
            this.searchQuery = '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.textContent = '';
        }
    },
    async handleCreateTag(tagName = null) {
        const name = (tagName || this.newTagName || '').trim();
        if (!name) return;
        const newTag = { id: `tag_${Date.now()}`, name, color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}` };
        try {
            const savedTag = await store.saveTag(newTag);
            this.allTags.push(savedTag);
            this.allTags.sort((a,b) => a.name.localeCompare(b.name));
            this.newTagName = "";
        } catch (error) { console.error("Failed to save tag:", error); alertService.confirm('Error', 'Could not save the new tag. Please try again.'); }
    },
    async handleToggleFavorite(note) {
      const updatedNote = { ...note, isFavorite: !note.isFavorite };
      this.updateNoteInState(updatedNote);
      await store.saveNote(updatedNote);
    },
    async handleArchiveNote(note) {
      if (this.editingNote && this.editingNote.id === note.id) this.closeEditor();
      const updatedNote = { ...note, isArchived: !note.isArchived };
      this.updateNoteInState(updatedNote);
      await store.saveNote(updatedNote);
      await this.fetchNotes();
    },
    async handleRemoveReminder(note) {
        const confirmed = await alertService.confirm('Remove Reminder', `Are you sure you want to remove the reminder for "${note.summary}"?`, { confirmText: 'Remove', type: 'warning' });
        if (confirmed) {
            const updatedNote = { ...note, reminderAt: null, reminderSeen: null };
            this.updateNoteInState(updatedNote);
            await store.saveNote(updatedNote);
        }
    },
    async setReminder(note) {
      const currentReminder = note.reminderAt ? new Date(note.reminderAt).toISOString().slice(0, 16) : '';
      const message = note.reminderAt ? 'Edit the date and time. To remove this reminder, clear the field and click Update.' : 'Enter a date and time for the reminder:';
      const result = await alertService.input(note.reminderAt ? 'Edit Reminder' : 'Set Reminder', message, { inputType: 'datetime-local', defaultValue: currentReminder, confirmText: note.reminderAt ? 'Update' : 'Set Reminder' });
      if (result !== null) {
        const updatedNote = { ...note, reminderAt: result ? new Date(result).toISOString() : null, reminderSeen: result ? null : note.reminderSeen };
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
    handleDictateToggle() {
      if (this.isDictating) aiService.stopDictation();
      else {
        this.contentBeforeDictation = this.editingNote ? this.editingNote.content : "";
        if (!this.editingNote) this.createNewNote("", true);
        this.$nextTick(() => aiService.startDictation());
      }
    },
    handleAIStatusUpdate(event) { this.aiStatus = event.detail; },
    handleAICreateNote(event) { this.createNewNote(event.detail.content); },
    handleAISearch(event) {
      this.searchQuery = event.detail.query;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.textContent = this.searchQuery;
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
    startResize(event) {
        event.preventDefault();
        this.isResizing = true;
        document.body.classList.add('is-resizing');
        window.addEventListener('mousemove', this.doResize);
        window.addEventListener('mouseup', this.stopResize);
    },
    doResize(event) {
        if (!this.isResizing) return;
        const editor = document.querySelector('.note-editor');
        const container = document.querySelector('.main-content-wrapper');
        if (!editor || !container) return;
        const containerRect = container.getBoundingClientRect();
        let newEditorWidth = containerRect.right - event.clientX;
        const minEditorWidth = 350;
        const maxEditorWidth = containerRect.width * 0.8;
        if (newEditorWidth < minEditorWidth) newEditorWidth = minEditorWidth;
        if (newEditorWidth > maxEditorWidth) newEditorWidth = maxEditorWidth;
        editor.style.width = `${newEditorWidth}px`;
        editor.style.flexBasis = `${newEditorWidth}px`;
    },
    stopResize() {
        this.isResizing = false;
        document.body.classList.remove('is-resizing');
        window.removeEventListener('mousemove', this.doResize);
        window.removeEventListener('mouseup', this.stopResize);
    },
    updateNoteInState(updatedNote) {
      const index = this.notes.findIndex(n => n.id === updatedNote.id);
      if (index !== -1) this.notes.splice(index, 1, updatedNote);
    },
    async convertBlobUrlToDataUrl(blobUrl) {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    checkReminders() {
        const now = new Date();
        this.notes.forEach(async (note) => {
            if (note.reminderAt && !note.isArchived && !note.reminderSeen && new Date(note.reminderAt) <= now) {
                await alertService.confirm('Reminder', `Your note titled "${note.summary}" is due now.`, { confirmText: 'Mark as Done', cancelText: 'Snooze' });
                const updatedNote = { ...note, reminderSeen: true };
                this.updateNoteInState(updatedNote);
                await store.saveNote(updatedNote);
            }
        });
    },
    openHelp() { /* ... */ }
  },
  watch: {
    isSidebarCollapsed(isCollapsed) { document.body.classList.toggle("sidebar-collapsed", isCollapsed); },
    handsFreeMode(newValue) { localStorage.setItem("handsFreeMode", newValue); newValue ? aiService.startAmbientListening() : aiService.stopAmbientListening(); },
  },
  async created() {
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
  mounted() { document.body.classList.toggle("sidebar-collapsed", this.isSidebarCollapsed); },
  beforeUnmount() {
    window.removeEventListener("ai-status-update", this.handleAIStatusUpdate);
    window.removeEventListener("ai-create-note", this.handleAICreateNote);
    window.removeEventListener("ai-search", this.handleAISearch);
    window.removeEventListener("ai-dictation-started", this.handleAIDictationStarted);
    window.removeEventListener("ai-dictation-update", this.handleAIDictationUpdate);
    window.removeEventListener("ai-dictation-finished", this.handleAIDictationFinished);
    this.stopWatchingSystemTheme();
  },
});
app.mount("#app");