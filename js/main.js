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
      saveVoiceRecordings: localStorage.getItem("saveVoiceRecordings") === "true",
      currentTheme: localStorage.getItem("theme") || "auto",
      aiStatus: { status: "disabled", message: "Initializing..." },
      isVoiceActive: false,
      contentBeforeDictation: "",
      isSettingsModalVisible: false, currentSort: "updatedAt-desc",
      currentLayout: "grid", saveStatus: 'idle', newTagName: "", isResizing: false,
    };
  },
  computed: {
    // --- Performance Optimization: Memoized filtering and sorting ---
    filteredNotes() {
      // Step 1: Filter based on view (favorites, archived, tags)
      let notesToFilter = this.notes.filter(note => {
        if (note.isArchived) {
          return this.currentView === "archived";
        }
        switch (this.currentView) {
          case "favorites":
            return note.isFavorite;
          case "archived":
            return false; // Already handled
          default:
            if (this.currentView.startsWith("tag:")) {
              const tagId = this.currentView.split(':')[1];
              return (note.tags || []).includes(tagId);
            }
            return true; // all-notes view
        }
      });

      // Step 2: Filter based on search query
      if (this.searchQuery.trim()) {
        const searchKeywords = this.searchQuery.toLowerCase().split(' ').filter(Boolean);
        notesToFilter = notesToFilter.filter(note => {
          // Memoize note text to avoid re-computation
          if (!note._searchText) {
            note._searchText = [note.summary, note.content]
              .join(' ')
              .toLowerCase()
              .replace(/<[^>]*>/g, "");
          }
          return searchKeywords.every(keyword => note._searchText.includes(keyword));
        });
      }

      // Step 3: Sort the filtered notes
      const [sortKey, sortDir] = this.currentSort.split('-');
      return notesToFilter.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        const comparison = sortKey.includes('At')
          ? new Date(valB) - new Date(valA) // Descending for dates
          : String(valA).localeCompare(String(valB));

        return sortDir === 'asc' ? comparison * -1 : comparison;
      });
    },
  },
  methods: {
    async fetchAllData() {
      try {
        await Promise.all([this.fetchNotes(), this.fetchTags()]);
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
        alertService.error('Initialization Failed', 'Could not load notes and tags. Please refresh the page.');
      }
    },
    async fetchNotes() {
      const notes = await store.getNotes();
      // Optimization: Avoid processing audioUrl here, do it on-demand
      this.notes = notes.map(note => ({
        ...note,
        tags: note.tags || [],
        aiSummary: note.aiSummary || null,
      }));
    },
    async fetchTags() { this.allTags = await store.getTags(); },
    async saveNote(noteToSave) {
      this.saveStatus = 'saving';
      try {
        const noteToStore = { ...noteToSave, updatedAt: new Date().toISOString() };
        const savedNote = await store.saveNote(noteToStore);
        this.updateNoteInState(savedNote);
        if (this.editingNote && this.editingNote.id === savedNote.id) this.editingNote = { ...savedNote };
        this.saveStatus = 'saved';
        setTimeout(() => { if (this.saveStatus === 'saved') this.saveStatus = 'idle'; }, 2000);
      } catch (error) {
        console.error("Failed to save note:", error);
        this.saveStatus = 'error';
        alertService.error('Save Failed', `There was an issue saving your note: ${error.message}`);
      }
    },
    async deleteNote(noteId) {
      try {
        const confirmed = await alertService.confirm('Delete Note', 'Are you sure you want to permanently delete this note?', { confirmText: 'Delete' });
        if (confirmed) {
          if (this.editingNote && this.editingNote.id === noteId) this.closeEditor();
          await store.deleteNote(noteId);
          this.notes = this.notes.filter(n => n.id !== noteId);
        }
      } catch (error) {
        console.error("Failed to delete note:", error);
        alertService.error('Delete Failed', 'Could not delete the note. Please try again.');
      }
    },

    // --- KEY FIX: This function now handles both types of calls ---
    createNewNote(payload = {}, shouldOpenEditor = true) {
      // Check if the payload is a MouseEvent from a button click, or our data object.
      const isClickEvent = payload instanceof Event;

      const summary = isClickEvent ? null : payload.summary;
      const content = isClickEvent ? "" : payload.content || "";

      const timestamp = new Date();
      const newSummary = summary || (content ? `Voice Note ${timestamp.toLocaleTimeString()}` : "New Note");

      const newNote = {
        id: `note_${timestamp.getTime()}`,
        summary: newSummary,
        content: content,
        createdAt: timestamp.toISOString(),
        updatedAt: timestamp.toISOString(),
        isFavorite: false,
        isArchived: false,
        tags: [],
        reminderAt: null,
        aiSummary: null  // AI-generated summary
      };

      this.notes.unshift(newNote);
      if (shouldOpenEditor) {
        this.editNote(newNote);
      }
      return newNote;
    },

    editNote(note) { this.editingNote = JSON.parse(JSON.stringify(note)); },
    closeEditor() {
      if (this.isVoiceActive) aiService.stopListening();
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
      const newTag = { id: `tag_${Date.now()}`, name, color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}` };
      try {
        const savedTag = await store.saveTag(newTag);
        this.allTags.push(savedTag);
        this.allTags.sort((a, b) => a.name.localeCompare(b.name));
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
    handleVoiceToggle() {
      if (this.isVoiceActive) {
        aiService.stopListening();
      } else {
        if (this.editingNote) {
          this.contentBeforeDictation = this.editingNote.content;
          this.$nextTick(() => aiService.startListening({ mode: 'dictation' }));
        } else {
          aiService.startListening({ mode: 'command' });
        }
      }
    },
    handleAICreateNote(event) {
      this.createNewNote({ summary: event.detail.summary, content: event.detail.content });
      this.$nextTick(() => {
        if (this.editingNote && !this.isVoiceActive) {
          this.handleVoiceToggle();
        }
      });
    },
    handleAISearch(event) {
      this.searchQuery = event.detail.query;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.textContent = this.searchQuery;
    },
    async handleAIDeleteNote(event) {
      const query = event.detail.query.toLowerCase();
      if (!query) return;
      const noteToDelete = this.notes.find(n => n.summary.toLowerCase().includes(query) && !n.isArchived);
      if (noteToDelete) {
        this.deleteNote(noteToDelete.id);
      } else {
        alertService.info('Note Not Found', `Could not find an active note matching "${query}".`);
      }
    },
    handleAISummarizeNotes() {
      const count = this.filteredNotes.length;
      if (count === 0) {
        alertService.info("No Notes", "There are no notes in the current view to summarize.");
        return;
      }
      const titles = this.filteredNotes.slice(0, 2).map(n => `"${n.summary}"`).join(', ');
      alertService.info("Summarize Notes (Demo)", `This feature would summarize the ${count} notes currently visible, starting with ${titles}...`);
    },
    handleAIListeningStarted() {
      this.isVoiceActive = true;
      // Capture the current content when starting dictation
      if (this.editingNote) {
        this.contentBeforeDictation = this.editingNote.content || '';
      }
    },
    handleAIDictationUpdate(event) {
      if (this.editingNote) {
        const interimText = event.detail.transcript;
        const separator = this.contentBeforeDictation.trim() === '' ? '' : ' ';
        this.editingNote.content = this.contentBeforeDictation + separator + interimText;
      }
    },
    handleAIDictationFinalized(event) {
      if (this.editingNote) {
        const finalText = event.detail.transcript.trim();
        if (!finalText) return; // Ignore empty transcripts

        const separator = this.contentBeforeDictation.trim() === '' ? '' : ' ';
        const newContent = this.contentBeforeDictation + separator + finalText;

        // Update both the editing note and the base content
        this.editingNote.content = newContent;
        this.contentBeforeDictation = newContent;

        // Force a save to persist the change
        this.$nextTick(() => {
          this.saveNote(this.editingNote);
        });
      }
    },
    handleAIListeningFinished(event) {
      if (this.editingNote && event.detail.mode === 'dictation') {
        if (this.saveVoiceRecordings && event.detail.audioUrl) {
          this.editingNote.audioUrl = event.detail.audioUrl;
        }
        this.saveNote(this.editingNote);
      }
      this.isVoiceActive = false;
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
    handleAIStatusUpdate(event) {
      this.aiStatus = event.detail;
    },
    getAIStatusClass() {
      const status = this.aiStatus.status;
      switch (status) {
        case 'ready':
          return 'text-success';
        case 'processing':
        case 'recording':
        case 'listening':
        case 'active':
          return 'text-info';
        case 'error':
          return 'text-danger';
        case 'checking':
          return 'text-warning';
        default:
          return 'text-muted';
      }
    },
    handleAICommandExecuted(event) {
      // When a command is executed, update the base content to prevent reverting
      if (this.editingNote) {
        this.contentBeforeDictation = event.detail.content;
      }
    },
    openHelp() {
      const helpContent = `
        <div style="text-align: left; font-size: 0.9rem;">
          <h5 class="mb-3"><i class="bi bi-mic-fill me-2"></i>Voice Control Guide</h5>
          
          <h6 class="fw-bold">General Commands (Notes List View)</h6>
          <ul class="list-unstyled lh-lg">
            <li><i class="bi bi-pencil-square me-2 text-primary"></i>To create a note with a title: <br><em>"Create note titled <strong>My Meeting</strong> with content <strong>agenda items...</strong>"</em></li>
            <li><i class="bi bi-search me-2 text-primary"></i>To search: <em>"Search for <strong>AI project</strong>"</em></li>
            <li><i class="bi bi-trash me-2 text-primary"></i>To delete: <em>"Delete note <strong>My Meeting</strong>"</em></li>
          </ul>

          <h6 class="fw-bold mt-4">In-Editor Commands (Dictation Mode)</h6>
          <p class="small text-muted">While editing a note, you can format, edit, and manage your text with voice.</p>
          <div class="row">
            <div class="col-md-6">
              <strong>Formatting & Insertion:</strong>
              <ul class="list-unstyled lh-lg">
                <li><i class="bi bi-type-bold me-2"></i>"Make it bold"</li>
                <li><i class="bi bi-type-italic me-2"></i>"Italicize this"</li>
                <li><i class="bi bi-type-underline me-2"></i>"Underline this"</li>
                <li><i class="bi bi-list-task me-2"></i>"Add a task"</li>
                <li><i class="bi bi-list-ul me-2"></i>"Start bullet points"</li>
                <li><i class="bi bi-braces-asterisk me-2"></i>"Clear formatting"</li>
              </ul>
            </div>
            <div class="col-md-6">
              <strong>Editing & Actions:</strong>
              <ul class="list-unstyled lh-lg">
                <li><i class="bi bi-arrow-return-left me-2"></i>"Next line"</li>
                <li><i class="bi bi-scissors me-2"></i>"Delete last word"</li>
                <li><i class="bi bi-scissors me-2"></i>"Delete sentence"</li>
                <li><i class="bi bi-arrow-counterclockwise me-2"></i>"Undo that"</li>
                <li><i class="bi bi-arrow-clockwise me-2"></i>"Redo that"</li>
                <li><i class="bi bi-x-circle me-2"></i>"Close note" / "Finish note"</li>
              </ul>
            </div>
          </div>
          
          <h6 class="fw-bold mt-4">Chrome AI Features (In-Editor)</h6>
          <ul class="list-unstyled lh-lg">
            <li><i class="bi bi-card-text me-2 text-success"></i>To summarize: <em>"Summarize this note"</em></li>
            <li><i class="bi bi-spellcheck me-2 text-success"></i>To proofread: <em>"Check my writing"</em></li>
          </ul>
        </div>
      `;
      alertService.info('Help & Voice Commands', helpContent, { confirmText: 'Got it!', cancelText: false });
    }
  },
  watch: {
    isSidebarCollapsed(isCollapsed) { document.body.classList.toggle("sidebar-collapsed", isCollapsed); },
    handsFreeMode(newValue) { localStorage.setItem("handsFreeMode", newValue); newValue ? aiService.startAmbientListening() : aiService.stopAmbientListening(); },
    saveVoiceRecordings(newValue) { localStorage.setItem("saveVoiceRecordings", newValue); },
  },
  async created() {
    this.setTheme(this.currentTheme);
    await store.initDB();
    await this.fetchAllData();
    await aiService.init();
    window.addEventListener("ai-status-update", this.handleAIStatusUpdate);
    window.addEventListener("ai-create-note", this.handleAICreateNote);
    window.addEventListener("ai-search", this.handleAISearch);
    window.addEventListener("ai-listening-started", this.handleAIListeningStarted);
    window.addEventListener("ai-dictation-update", this.handleAIDictationUpdate);
    window.addEventListener("ai-dictation-finalized", this.handleAIDictationFinalized);
    window.addEventListener("ai-listening-finished", this.handleAIListeningFinished);
    window.addEventListener("ai-delete-note", this.handleAIDeleteNote);
    window.addEventListener("ai-summarize-notes", this.handleAISummarizeNotes);
    window.addEventListener("ai-command-executed", this.handleAICommandExecuted);
    this.isLoading = false;
    setInterval(this.checkReminders, 60000);
  },
  mounted() { document.body.classList.toggle("sidebar-collapsed", this.isSidebarCollapsed); },
  beforeUnmount() {
    window.removeEventListener("ai-status-update", this.handleAIStatusUpdate);
    window.removeEventListener("ai-create-note", this.handleAICreateNote);
    window.removeEventListener("ai-search", this.handleAISearch);
    window.removeEventListener("ai-listening-started", this.handleAIListeningStarted);
    window.removeEventListener("ai-dictation-update", this.handleAIDictationUpdate);
    window.removeEventListener("ai-dictation-finalized", this.handleAIDictationFinalized);
    window.removeEventListener("ai-listening-finished", this.handleAIListeningFinished);
    window.removeEventListener("ai-delete-note", this.handleAIDeleteNote);
    window.removeEventListener("ai-summarize-notes", this.handleAISummarizeNotes);
    window.removeEventListener("ai-command-executed", this.handleAICommandExecuted);
    this.stopWatchingSystemTheme();
    window.onerror = null; // Clean up global error handler
    window.onunhandledrejection = null;
  },
});

// --- Global Error Handling ---
const globalErrorHandler = (message, source, lineno, colno, error) => {
  console.error("A global error occurred:", error);
  alertService.error('An Unexpected Error Occurred', 'Please refresh the application. If the problem persists, please contact support.');
  // Returning true prevents the default browser error handling
  return true;
};

const unhandledRejectionHandler = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  alertService.error('An Unexpected Error Occurred', 'An unhandled promise rejection occurred. Please check the console for details.');
};

window.onerror = globalErrorHandler;
window.onunhandledrejection = unhandledRejectionHandler;

app.mount("#app");