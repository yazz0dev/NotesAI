import store from "./services/store.js";
// js/main.js
import aiHandler from "./services/ai-handler.js";
import { alertService } from "./services/alert-service.js";
import { pinia, initializeStores, useNotesStore, useTagsStore, useSettingsStore } from "./stores/index.js";
import AppHeader from "./components/AppHeader.js";
import AppSidebar from "./components/AppSidebar.js";
import NotesList from "./components/NotesList.js";
import NoteEditor from "./components/NoteEditor.js";
import SettingsModal from "./components/SettingsModal.js";
import SkeletonLoader from "./components/SkeletonLoader.js";
import AlertModal from "./components/AlertModal.js";
import TagSelectionModal from "./components/TagSelectionModal.js";

const { createApp } = Vue;
const { mapState, mapActions, mapWritableState } = window.Pinia;

const app = createApp({
  components: {
    AppHeader, AppSidebar, NotesList, NoteEditor, SettingsModal, SkeletonLoader, AlertModal, TagSelectionModal
  },
  data() {
    return {
      // UI-only state (not persisted in Pinia)
      noteToTag: null,
      aiStatus: { status: "disabled", message: "Initializing..." },
      isVoiceActive: false,
      contentBeforeDictation: "",
      isSettingsModalVisible: false,
      isResizing: false,
      newTagName: "",
    };
  },
  computed: {
    // Map Pinia store state to component computed properties
    ...mapState(useNotesStore, {
      notes: 'allNotes',
      isLoading: 'isLoading',
      saveStatus: 'saveStatus'
    }),
    ...mapWritableState(useNotesStore, ['editingNote']),
    ...mapState(useTagsStore, {
      allTags: 'allTags'
    }),
    ...mapState(useSettingsStore, {
      isSidebarCollapsed: 'sidebarCollapsed',
      handsFreeMode: 'handsFreeMode',
      saveVoiceRecordings: 'saveVoiceRecordings',
      currentTheme: 'theme',
      currentLayout: 'currentLayout'
    }),
    ...mapWritableState(useSettingsStore, [
      'searchQuery',
      'currentFilter',
      'currentTag',
      'sortBy',
      'sortOrder'
    ]),

    // Computed property for current view (backward compatibility)
    currentView: {
      get() {
        const settingsStore = useSettingsStore();
        if (settingsStore.currentTag) {
          return `tag:${settingsStore.currentTag}`;
        }
        switch (settingsStore.currentFilter) {
          case 'favorites': return 'favorites';
          case 'archived': return 'archived';
          default: return 'all-notes';
        }
      },
      set(value) {
        const settingsStore = useSettingsStore();
        if (value.startsWith('tag:')) {
          settingsStore.currentTag = value.split(':')[1];
          settingsStore.currentFilter = 'all';
        } else {
          settingsStore.currentTag = null;
          settingsStore.currentFilter = value === 'all-notes' ? 'all' : value;
        }
      }
    },

    // --- Performance Optimization: Memoized filtering and sorting ---
    filteredNotes() {
      const notesStore = useNotesStore();
      const settingsStore = useSettingsStore();
      
      // Step 1: Filter based on view (favorites, archived, tags)
      let notesToFilter = [];
      
      switch (settingsStore.currentFilter) {
        case 'favorites':
          notesToFilter = notesStore.favoriteNotes;
          break;
        case 'archived':
          notesToFilter = notesStore.archivedNotes;
          break;
        case 'active':
          notesToFilter = notesStore.activeNotes;
          break;
        default:
          if (settingsStore.currentTag) {
            notesToFilter = notesStore.notesByTag(settingsStore.currentTag);
          } else {
            notesToFilter = notesStore.activeNotes;
          }
      }

      // Step 2: Filter based on search query
      if (settingsStore.searchQuery?.trim()) {
        const searchKeywords = settingsStore.searchQuery.toLowerCase().split(' ').filter(Boolean);
        notesToFilter = notesToFilter.filter(note => {
          // Memoize note text to avoid re-computation
          if (!note._searchText) {
            note._searchText = [note.title, note.content]
              .join(' ')
              .toLowerCase()
              .replace(/<[^>]*>/g, "");
          }
          return searchKeywords.every(keyword => note._searchText.includes(keyword));
        });
      }

      // Step 3: Sort the filtered notes
      const sortKey = settingsStore.sortBy || 'updatedAt';
      const sortDir = settingsStore.sortOrder || 'desc';
      
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
    // Map Pinia store actions
    ...mapActions(useNotesStore, {
      createNoteInStore: 'createNote',
      updateNoteInStore: 'updateNote',
      deleteNoteInStore: 'deleteNote',
      toggleFavoriteInStore: 'toggleFavorite',
      toggleArchiveInStore: 'toggleArchive',
      setReminderInStore: 'setReminder',
      removeReminderInStore: 'removeReminder',
      updateNoteTagsInStore: 'updateNoteTags',
      initializeNotesStore: 'initialize'
    }),
    ...mapActions(useTagsStore, {
      createTagInStore: 'createTag',
      initializeTagsStore: 'initialize'
    }),
    ...mapActions(useSettingsStore, {
      setThemeInStore: 'setTheme',
      setSidebarCollapsedInStore: 'setSidebarCollapsed',
      setLayoutInStore: 'setLayout',
      setHandsFreeModeInStore: 'setHandsFreeMode',
      setSaveVoiceRecordingsInStore: 'setSaveVoiceRecordings',
      initializeSettingsStore: 'initialize'
    }),
    
    async saveNote(noteToSave) {
      const notesStore = useNotesStore();
      try {
        if (noteToSave.id) {
          await this.updateNoteInStore(noteToSave.id, noteToSave);
        } else {
          await this.createNoteInStore(noteToSave);
        }
        // Update editing note if it's the same
        if (this.editingNote && this.editingNote.id === noteToSave.id) {
          this.editingNote = { ...notesStore.getNoteById(noteToSave.id) };
        }
      } catch (error) {
        console.error("Failed to save note:", error);
        alertService.error('Save Failed', `There was an issue saving your note: ${error.message}`);
      }
    },
    async deleteNote(noteId) {
      try {
        const confirmed = await alertService.confirm('Delete Note', 'Are you sure you want to permanently delete this note?', { confirmText: 'Delete' });
        if (confirmed) {
          if (this.editingNote && this.editingNote.id === noteId) {
            this.closeEditor();
          }
          await this.deleteNoteInStore(noteId);
        }
      } catch (error) {
        console.error("Failed to delete note:", error);
        alertService.error('Delete Failed', 'Could not delete the note. Please try again.');
      }
    },

    // --- KEY FIX: This function now handles both types of calls ---
    createNewNote(payload = {}, shouldOpenEditor = true) {
      const notesStore = useNotesStore();
      
      // Check if the payload is a MouseEvent from a button click, or our data object.
      const isClickEvent = payload instanceof Event;

      const title = isClickEvent ? null : payload.title;
      const content = isClickEvent ? "" : payload.content || "";

      const timestamp = new Date();
      const newTitle = title || (content ? `Voice Note ${timestamp.toLocaleTimeString()}` : "New Note");

      const newNote = {
        title: newTitle,
        content: content,
        tags: [],
        isFavorite: false,
        isArchived: false,
        reminderAt: null,
        aiSummary: null
      };

      // Create note in Pinia store
      this.createNoteInStore(newNote).then(createdNote => {
        if (shouldOpenEditor) {
          this.editNote(createdNote);
        }
      });

      return newNote;
    },

    editNote(note) { 
      const notesStore = useNotesStore();
      notesStore.setEditingNote(note ? JSON.parse(JSON.stringify(note)) : null);
    },
    closeEditor() {
      const notesStore = useNotesStore();
      if (this.isVoiceActive) aiHandler.stopListening();
      notesStore.clearEditingNote();
    },
    setTheme(theme) {
      this.setThemeInStore(theme);
    },
    watchSystemTheme() {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', this.handleSystemThemeChange.bind(this));
    },
    stopWatchingSystemTheme() {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.removeEventListener('change', this.handleSystemThemeChange.bind(this));
    },
    handleSystemThemeChange(e) { 
      const settingsStore = useSettingsStore();
      if (settingsStore.theme === "auto") {
        console.log('System theme changed:', e.matches ? 'dark' : 'light');
      }
    },
    getSortLabel() {
      const settingsStore = useSettingsStore();
      const currentSort = `${settingsStore.sortBy}-${settingsStore.sortOrder}`;
      const labels = { 'updatedAt-desc': 'Newest', 'createdAt-desc': 'Created', 'title-asc': 'A-Z' };
      return labels[currentSort] || 'Sort';
    },
    handleSearch(queryText) {
      const settingsStore = useSettingsStore();
      settingsStore.searchQuery = (queryText || '').trim().replace(/\s+/g, ' ');
    },
    switchView(view) {
      const settingsStore = useSettingsStore();
      this.currentView = view;
      this.editingNote = null;
      if (view !== 'search' && !view.startsWith('tag:')) {
        settingsStore.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.textContent = '';
      }
    },
    toggleSidebar() {
      this.setSidebarCollapsedInStore(!this.isSidebarCollapsed);
    },
    toggleLayout() { 
      const settingsStore = useSettingsStore();
      this.setLayoutInStore(settingsStore.currentLayout === 'grid' ? 'list' : 'grid');
    },
    handleSortChange() {
      const settingsStore = useSettingsStore();
      const sorts = ['updatedAt-desc', 'createdAt-desc', 'title-asc'];
      const currentSort = `${settingsStore.sortBy}-${settingsStore.sortOrder}`;
      const nextSort = sorts[(sorts.indexOf(currentSort) + 1) % sorts.length];
      const [sortBy, sortOrder] = nextSort.split('-');
      settingsStore.sortBy = sortBy;
      settingsStore.sortOrder = sortOrder;
    },
    openTagModal(note) { this.noteToTag = note; },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) {
      const settingsStore = useSettingsStore();
      settingsStore.currentTag = tagId;
      settingsStore.currentFilter = 'all';
      
      if (settingsStore.searchQuery) {
        settingsStore.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.textContent = '';
      }
    },
    async handleCreateTag(tagName = null) {
      const name = (tagName || this.newTagName || '').trim();
      if (!name) return;
      
      try {
        await this.createTagInStore({ name });
        this.newTagName = "";
      } catch (error) { 
        console.error("Failed to save tag:", error); 
        alertService.confirm('Error', 'Could not save the new tag. Please try again.'); 
      }
    },
    async handleToggleFavorite(note) {
      await this.toggleFavoriteInStore(note.id);
    },
    async handleArchiveNote(note) {
      if (this.editingNote && this.editingNote.id === note.id) {
        this.closeEditor();
      }
      await this.toggleArchiveInStore(note.id);
    },
    async handleRemoveReminder(note) {
      const confirmed = await alertService.confirm('Remove Reminder', `Are you sure you want to remove the reminder for "${note.title}"?`, { confirmText: 'Remove', type: 'warning' });
      if (confirmed) {
        await this.removeReminderInStore(note.id);
      }
    },
    async setReminder(note) {
      const currentReminder = note.reminderAt ? new Date(note.reminderAt).toISOString().slice(0, 16) : '';
      const message = note.reminderAt ? 'Edit the date and time. To remove this reminder, clear the field and click Update.' : 'Enter a date and time for the reminder:';
      const result = await alertService.input(note.reminderAt ? 'Edit Reminder' : 'Set Reminder', message, { inputType: 'datetime-local', defaultValue: currentReminder, confirmText: note.reminderAt ? 'Update' : 'Set Reminder' });
      if (result !== null) {
        if (result) {
          await this.setReminderInStore(note.id, new Date(result).toISOString());
        } else {
          await this.removeReminderInStore(note.id);
        }
      }
    },
    async handleUpdateTags({ noteId, tagIds }) {
      await this.updateNoteTagsInStore(noteId, tagIds);
    },
    handleVoiceToggle() {
      if (this.isVoiceActive) {
        aiHandler.stopListening();
      } else {
        if (this.editingNote) {
          this.contentBeforeDictation = this.editingNote.content || '';
          this.$nextTick(() => aiHandler.startListening({ mode: 'dictation' }));
        } else {
          aiHandler.startListening({ mode: 'command' });
        }
      }
    },
    handleAICreateNote(event) {
      this.createNewNote({ title: event.detail.summary, content: event.detail.content });
      this.$nextTick(() => {
        if (this.editingNote && !this.isVoiceActive) {
          this.handleVoiceToggle();
        }
      });
    },
    handleAISearch(event) {
      const settingsStore = useSettingsStore();
      settingsStore.searchQuery = event.detail.query;
      const searchInput = document.getElementById("search-input");
      if (searchInput) searchInput.textContent = settingsStore.searchQuery;
    },
    async handleAIDeleteNote(event) {
      const notesStore = useNotesStore();
      const query = event.detail.query.toLowerCase();
      if (!query) return;
      const noteToDelete = notesStore.activeNotes.find(n => 
        (n.title || '').toLowerCase().includes(query)
      );
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
      const titles = this.filteredNotes.slice(0, 2).map(n => `"${n.title}"`).join(', ');
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
      if (this.editingNote && event?.detail?.transcript) {
        const interimText = event.detail.transcript;
        // Ensure contentBeforeDictation is initialized
        if (typeof this.contentBeforeDictation !== 'string') {
          this.contentBeforeDictation = this.editingNote.content || '';
        }
        const separator = this.contentBeforeDictation.trim() === '' ? '' : ' ';
        this.editingNote.content = this.contentBeforeDictation + separator + interimText;
      }
    },
    handleAIDictationFinalized(event) {
      if (this.editingNote && event?.detail?.transcript) {
        const finalText = event.detail.transcript.trim();
        if (!finalText) return; // Ignore empty transcripts

        // Ensure contentBeforeDictation is initialized
        if (typeof this.contentBeforeDictation !== 'string') {
          this.contentBeforeDictation = this.editingNote.content || '';
        }

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
    handleVoiceCreateNote() {
      // Create a new note and immediately start dictation
      this.createNewNote();
      // Wait for the editor to be ready, then start dictation
      this.$nextTick(() => {
        if (this.editingNote) {
          this.contentBeforeDictation = '';
          setTimeout(() => {
            aiHandler.startListening({ mode: 'dictation' });
          }, 300); // Small delay to ensure editor is fully mounted
        }
      });
    },
    handleVoiceStartDictation() {
      if (!this.editingNote) {
        // If no editor is open, create a new note first
        this.createNewNote();
        this.$nextTick(() => {
          if (this.editingNote) {
            this.contentBeforeDictation = this.editingNote.content || '';
            setTimeout(() => {
              aiHandler.startListening({ mode: 'dictation' });
            }, 300);
          }
        });
      } else {
        // Editor is already open, just start dictation
        this.contentBeforeDictation = this.editingNote.content || '';
        aiHandler.startListening({ mode: 'dictation' });
      }
    },
    handleVoiceStopDictation() {
      // Stop the current dictation session
      if (this.isVoiceActive) {
        aiHandler.stopListening();
      }
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
      const notesStore = useNotesStore();
      const now = new Date();
      
      notesStore.notesWithReminders.forEach(async (note) => {
        if (!note.isArchived && !note.reminderSeen && new Date(note.reminderAt) <= now) {
          await alertService.confirm('Reminder', `Your note titled "${note.title}" is due now.`, { confirmText: 'Mark as Done', cancelText: 'Snooze' });
          // Mark as seen in the store
          await notesStore.updateNote(note.id, { reminderSeen: true });
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
            <li><i class="bi bi-plus-circle me-2 text-success"></i>To create a new note and start dictating: <br><em>"Create note" or "New note"</em></li>
            <li><i class="bi bi-pencil-square me-2 text-primary"></i>To create a note with a title: <br><em>"Create note titled <strong>My Meeting</strong> with content <strong>agenda items...</strong>"</em></li>
            <li><i class="bi bi-search me-2 text-primary"></i>To search: <em>"Search for <strong>AI project</strong>"</em></li>
            <li><i class="bi bi-trash me-2 text-primary"></i>To delete: <em>"Delete note <strong>My Meeting</strong>"</em></li>
          </ul>

          <h6 class="fw-bold mt-4">Dictation Control</h6>
          <ul class="list-unstyled lh-lg">
            <li><i class="bi bi-mic-fill me-2 text-success"></i>To start dictating: <em>"Start writing" or "Start dictating"</em></li>
            <li><i class="bi bi-mic-mute me-2 text-danger"></i>To stop dictating: <em>"Stop writing" or "Exit"</em></li>
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
    isSidebarCollapsed(isCollapsed) { 
      document.body.classList.toggle("sidebar-collapsed", isCollapsed); 
    },
    handsFreeMode(newValue) { 
      newValue ? aiHandler.startAmbientListening() : aiHandler.stopAmbientListening(); 
    },
    saveVoiceRecordings(newValue) { 
      // Handled by Pinia store
    },
  },
  async created() {
    try {
      // Initialize Pinia stores first
      await initializeStores();
      
      // Get settings store and apply theme
      const settingsStore = useSettingsStore();
      this.setTheme(settingsStore.theme);
      
      // Initialize AI service
      await aiHandler.init();
      
      // Setup event listeners
      window.addEventListener("command-status-update", this.handleAIStatusUpdate);
      window.addEventListener("command-create-note", this.handleAICreateNote);
      window.addEventListener("command-search", this.handleAISearch);
      window.addEventListener("listening-started", this.handleAIListeningStarted);
      window.addEventListener("dictation-update", this.handleAIDictationUpdate);
      window.addEventListener("dictation-finalized", this.handleAIDictationFinalized);
      window.addEventListener("listening-finished", this.handleAIListeningFinished);
      window.addEventListener("command-delete-note", this.handleAIDeleteNote);
      window.addEventListener("command-summarize-notes", this.handleAISummarizeNotes);
      window.addEventListener("command-execute", this.handleAICommandExecuted);
      window.addEventListener("voice-create-note", this.handleVoiceCreateNote);
      window.addEventListener("voice-start-dictation", this.handleVoiceStartDictation);
      window.addEventListener("voice-stop-dictation", this.handleVoiceStopDictation);
      
      // Start reminder checks
      setInterval(this.checkReminders, 60000);
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      alertService.error('Initialization Failed', 'Could not initialize the application. Please refresh the page.');
    }
  },
  mounted() { 
    const settingsStore = useSettingsStore();
    document.body.classList.toggle("sidebar-collapsed", settingsStore.sidebarCollapsed); 
  },
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
    window.removeEventListener("voice-create-note", this.handleVoiceCreateNote);
    window.removeEventListener("voice-start-dictation", this.handleVoiceStartDictation);
    window.removeEventListener("voice-stop-dictation", this.handleVoiceStopDictation);
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

// Use Pinia with the Vue app
app.use(pinia);

app.mount("#app");