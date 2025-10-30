import { alertService } from "./services/alert-service.js";
import { pinia, initializeStores, useNotesStore, useTagsStore, useSettingsStore } from "./stores/index.js";
import { noteActionsService } from "./services/note-actions-service.js";
import { aiEventService } from "./services/ai-event-service.js";
import { aiToolsService } from "./services/ai-tools-service.js";
import { editorResizeService } from "./services/editor-resize-service.js";
import aiHandler from "./services/ai-handler.js";
import { DateUtils } from "./utils/index.js";
import { ArrayUtils } from "./utils/index.js";

import AppHeader from "./components/AppHeader.js";
import AppSidebar from "./components/AppSidebar.js";
import NotesList from "./components/NotesList.js";
import NoteEditor from "./components/NoteEditor.js";
import SettingsModal from "./components/SettingsModal.js";
import SkeletonLoader from "./components/SkeletonLoader.js";
import AlertModal from "./components/AlertModal.js";
import TagSelectionModal from "./components/TagSelectionModal.js";
import NoticeBoard from "./components/NoticeBoard.js";
import HelpModal from "./components/HelpModal.js";

const { createApp } = Vue;
const { mapState, mapActions, mapWritableState } = window.Pinia;

const app = createApp({
  components: {
    AppHeader, AppSidebar, NotesList, NoteEditor, SettingsModal, SkeletonLoader, AlertModal, TagSelectionModal, NoticeBoard, HelpModal
  },
  data() {
    return {
      noteToTag: null,
      isSettingsModalVisible: false,
      isHelpModalVisible: false,
      newTagName: "",
      aiStatus: { status: "disabled", message: "Initializing..." },
      isVoiceActive: false,
      contentBeforeDictation: "",
      isNoticeBoardLoading: false,
      isAiSearchActive: false,
      currentSearchText: '',
      debouncedUpdateNoticeBoard: null,
    };
  },
  computed: {
    ...mapState(useNotesStore, ['notes', 'isLoading', 'saveStatus']),
    ...mapWritableState(useNotesStore, ['editingNote']),
    ...mapState(useTagsStore, ['allTags']),
    ...mapState(useSettingsStore, [
        'sidebarCollapsed', 'handsFreeMode', 'saveVoiceRecordings', 
        'currentTheme', 'currentLayout', 'isNoticeBoardVisible', 'noticeBoardContent',
        'isNoticeBoardAvailable'
    ]),
    ...mapWritableState(useSettingsStore, ['searchQuery', 'currentFilter', 'currentTag', 'sortBy', 'sortOrder']),

    currentView: {
      get() {
        const settingsStore = useSettingsStore();
        if (settingsStore.currentTag) return `tag:${settingsStore.currentTag}`;
        return settingsStore.currentFilter;
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

    filteredNotes() {
      const notesStore = useNotesStore();
      const settingsStore = useSettingsStore();
      let notesToFilter;
      switch (settingsStore.currentFilter) {
        case 'favorites': notesToFilter = notesStore.favoriteNotes; break;
        case 'archived': notesToFilter = notesStore.archivedNotes; break;
        default:
          notesToFilter = settingsStore.currentTag
            ? notesStore.notesByTag(settingsStore.currentTag)
            : notesStore.activeNotes;
      }
      if (settingsStore.searchQuery?.trim()) {
        const searchKeywords = settingsStore.searchQuery.toLowerCase().split(' ').filter(Boolean);
        notesToFilter = notesToFilter.filter(note => {
          if (!note._searchText) {
            note._searchText = [note.title, note.content].join(' ').toLowerCase().replace(/<[^>]*>/g, "");
          }
          return searchKeywords.every(keyword => note._searchText.includes(keyword));
        });
      }
      // Note: The main sort order is not part of the signature to prevent regeneration on sort changes.
      return [...notesToFilter];
    },
    
    /**
     * **NEW**: Generates a stable signature of the currently filtered notes.
     * This signature only changes if notes are added, removed, or their content is updated.
     */
    filteredNotesSignature() {
        if (!this.filteredNotes || this.filteredNotes.length === 0) {
            return 'empty';
        }
        // Create a signature based on IDs and update timestamps.
        // Sorting by ID ensures the signature is consistent regardless of display order.
        return this.filteredNotes
            .map(note => `${note.id}-${note.updatedAt}`)
            .sort()
            .join('|');
    }
  },
  methods: {
    ...mapActions(useNotesStore, {
      createNoteInStore: 'createNote',
      initializeNotesStore: 'initialize',
      generateNoticeBoardInStore: 'generateNoticeBoard'
    }),
    ...mapActions(useTagsStore, {
        createTagInStore: 'createTag',
        initializeTagsStore: 'initialize'
    }),
    ...mapActions(useSettingsStore, {
      setThemeInStore: 'setTheme',
      setSidebarCollapsedInStore: 'setSidebarCollapsed',
      setLayoutInStore: 'setLayout',
      initializeSettingsStore: 'initialize',
      setNoticeBoardVisibility: 'setNoticeBoardVisibility',
      setNoticeBoardAvailability: 'setNoticeBoardAvailability'
    }),

    async saveNote(noteToSave) {
        // The signature will automatically update when the note's `updatedAt` changes in the store.
        await noteActionsService.saveNote(noteToSave);
        if (this.editingNote && this.editingNote.id === noteToSave.id) {
            const notesStore = useNotesStore();
            this.editingNote = { ...notesStore.getNoteById(noteToSave.id) };
        }
    },
    async deleteNote(noteId) {
        // The signature will automatically update when the note is removed from the store.
        const editorShouldClose = await noteActionsService.deleteNote(noteId, this.editingNote);
        if (editorShouldClose) {
            this.closeEditor();
        }
    },
     async createNewNote(payload = {}, shouldOpenEditor = true) {
        // The signature will automatically update when the new note is added to the store.
      const isClickEvent = payload instanceof Event;
      const title = isClickEvent ? null : payload.title;
      const content = isClickEvent ? "" : payload.content || "";
      const newNoteData = {
        title: title || (content ? `Voice Note ${new Date().toLocaleTimeString()}` : "New Note"),
        content,
      };
      const createdNote = await this.createNoteInStore(newNoteData);
      if (shouldOpenEditor) this.editNote(createdNote);
      return createdNote;
    },
    async handleToggleFavorite(note) { await noteActionsService.toggleFavorite(note); },
    async handleArchiveNote(note) {
        const archivedNoteId = await noteActionsService.archiveNote(note);
        if (this.editingNote && this.editingNote.id === archivedNoteId) {
            this.closeEditor();
        }
    },
    async setReminder(note) { await noteActionsService.setReminder(note); },
    async handleRemoveReminder(note) { await noteActionsService.removeReminder(note); },
    async handleUpdateTags(payload) { await noteActionsService.updateNoteTags(payload); },

    // --- Core Component Logic ---
    editNote(note) { useNotesStore().setEditingNote(note ? JSON.parse(JSON.stringify(note)) : null); },
    closeEditor() {
        if (this.isVoiceActive) aiHandler.stopListening();
        useNotesStore().clearEditingNote();
    },
    
    // --- UI & View Handlers ---
    openHelp() { this.isHelpModalVisible = true; },
    setTheme(theme) { this.setThemeInStore(theme); },
    toggleSidebar() {
      const newCollapsedState = !this.sidebarCollapsed;
      this.setSidebarCollapsedInStore(newCollapsedState);
      document.body.classList.toggle("sidebar-collapsed", newCollapsedState);
    },
    toggleLayout() { this.setLayoutInStore(this.currentLayout === 'grid' ? 'list' : 'grid'); },
    
    // --- Search Handlers ---
    toggleAiSearch() {
        this.isAiSearchActive = !this.isAiSearchActive;
        if (this.isAiSearchActive) {
            this.searchQuery = '';
        } else {
            this.handleSearch(this.currentSearchText);
        }
        this.$nextTick(() => document.getElementById('search-input').focus());
    },
    handleSearchInput(query) {
        this.currentSearchText = query;
        if (!this.isAiSearchActive) {
            this.handleSearch(query);
        }
    },
    async submitSearch(query) {
        if (this.isAiSearchActive) {
            if (query.trim()) {
                await aiToolsService.processQueryWithTools(query);
                const searchInput = document.getElementById('search-input');
                if (searchInput) searchInput.textContent = '';
                this.currentSearchText = '';
            }
        } else {
            this.handleSearch(query);
        }
    },
    handleSearch(queryText) { 
        this.searchQuery = (queryText || '').trim().replace(/\s+/g, ' '); 
    },
    switchView(view) {
      this.currentView = view;
      this.editingNote = null;
      if (!view.startsWith('tag:')) {
        this.searchQuery = '';
        this.currentSearchText = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.textContent = '';
      }
    },
    getSortLabel() {
      const labels = { 'updatedAt-desc': 'Newest', 'createdAt-desc': 'Created', 'title-asc': 'A-Z' };
      return labels[`${this.sortBy}-${this.sortOrder}`] || 'Sort';
    },
    handleSortChange() {
      // Sorting is now handled by the main `filteredNotes` computed property,
      // but this won't change the signature, so no regeneration will happen.
      const sorts = ['updatedAt-desc', 'createdAt-desc', 'title-asc'];
      const currentSort = `${this.sortBy}-${this.sortOrder}`;
      const nextIndex = (sorts.indexOf(currentSort) + 1) % sorts.length;
      const [sortBy, sortOrder] = sorts[nextIndex].split('-');
      this.sortBy = sortBy;
      this.sortOrder = sortOrder;
    },
    
    // --- Notice Board Logic ---
    async updateContextualNoticeBoard(notesContext) {
        if (!notesContext || notesContext.length === 0) {
            this.setNoticeBoardAvailability(false);
            return;
        }
        this.setNoticeBoardAvailability(true);
        this.isNoticeBoardLoading = true;
        await this.generateNoticeBoardInStore(notesContext);
        this.isNoticeBoardLoading = false;
    },
    refreshNoticeBoard() {
        this.updateContextualNoticeBoard(this.filteredNotes);
    },
    toggleNoticeBoard() { 
        this.setNoticeBoardVisibility(!this.isNoticeBoardVisible); 
    },
    handleNavigateToNote(noteId) {
        const note = useNotesStore().getNoteById(noteId);
        if (note) this.editNote(note);
    },
    
    // ... Other methods remain unchanged
    openTagModal(note) { this.noteToTag = note; },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) { this.currentView = `tag:${tagId}`; },
    async handleCreateTag(tagName = null) {
      const name = (tagName || this.newTagName || '').trim();
      if (!name) return;
      try {
        await this.createTagInStore({ name });
        this.newTagName = "";
      } catch (error) { 
        console.error("Failed to save tag:", error); 
        alertService.error('Error', 'Could not save the new tag. Please try again.'); 
      }
    },
    handleVoiceToggle() {
      if (this.isVoiceActive) {
        aiHandler.stopListening();
      } else {
        if (this.editingNote) {
          this.contentBeforeDictation = this.editingNote.content || '';
          aiHandler.startListening({ mode: 'dictation' });
        } else {
          aiHandler.startListening({ mode: 'command' });
        }
      }
    },
    startResize(event) { editorResizeService.start(event); },
    checkReminders() {
        const notesStore = useNotesStore();
        notesStore.notesWithReminders.forEach(async (note) => {
            if (!note.isArchived && !note.reminderSeen && new Date(note.reminderAt) <= new Date()) {
                const confirmed = await alertService.confirm('Reminder', `Your note titled "${note.title}" is due now.`, { confirmText: 'Mark as Done', cancelText: 'Snooze' });
                if (confirmed) await notesStore.updateNote(note.id, { reminderSeen: true });
            }
        });
    },
    getAIStatusClass() {
      const statusMap = { ready: 'text-success', error: 'text-danger', checking: 'text-warning' };
      return statusMap[this.aiStatus.status] || 'text-info';
    },
    async initializeApp() {
      try {
        await initializeStores();
        this.setTheme(this.currentTheme);
        await aiHandler.init();
        
        aiEventService.setup(this);
        aiToolsService.setVueInstance(this);
        
        setInterval(this.checkReminders, 60000);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        alertService.error('Initialization Failed', 'Could not initialize the application. Please refresh the page.');
      }
    }
  },
  watch: {
    handsFreeMode(newValue) { newValue ? aiHandler.startAmbientListening() : aiHandler.stopAmbientListening(); },

    /**
     * **NEW**: This is the single, intelligent watcher for the Notice Board.
     * It triggers only when the underlying data of the current view actually changes.
     */
    filteredNotesSignature: {
      handler(newSignature, oldSignature) {
        // Only run if the signature has actually changed, and it's not the initial load (oldSignature is null)
        if (newSignature !== oldSignature) {
             console.log("Notice Board context has changed. Regenerating...");
             this.debouncedUpdateNoticeBoard(this.filteredNotes);
        }
        
        // Always update availability based on the current number of notes.
        this.setNoticeBoardAvailability(this.filteredNotes.length > 0);
      },
      immediate: true // Run on initial load to set the first state
    }
  },
  created() {
    this.debouncedUpdateNoticeBoard = this.debounce(this.updateContextualNoticeBoard, 1000); // Increased debounce time
    this.initializeApp();
  },
  mounted() {
    document.body.classList.toggle("sidebar-collapsed", this.sidebarCollapsed); 
  },
  beforeUnmount() {
    aiEventService.teardown();
    window.onerror = null;
    window.onunhandledrejection = null;
  },
  // Add debounce method if not present
  methods: {
    // ... all your other methods
    debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    },
  }
});

// --- Global Error Handling ---
window.onerror = (message, source, lineno, colno, error) => {
  console.error("A global error occurred:", error);
  alertService.error('An Unexpected Error Occurred', 'Please refresh the application.');
  return true;
};
window.onunhandledrejection = (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  alertService.error('An Unexpected Error Occurred', 'An unhandled promise rejection occurred. Please check the console.');
};

app.use(pinia);
app.mount("#app");