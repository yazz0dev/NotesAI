import { alertService } from "./services/alert-service.js";
import { toastService } from "./services/toast-service.js";
import { pinia, initializeStores, useNotesStore, useTagsStore, useSettingsStore } from "./stores/index.js";
import { noteActionsService } from "./services/note-actions-service.js";
import { aiEventService } from "./services/ai-event-service.js";
import { aiToolsService } from "./services/ai-tools-service.js";
import { editorResizeService } from "./services/editor-resize-service.js";
import { noticeBoardCacheService } from "./services/notice-board-cache-service.js";
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
import Toast from "./components/Toast.js";
import TagSelectionOverlay from "./components/TagSelectionOverlay.js";
import NoticeBoard from "./components/NoticeBoard.js";
import HelpModal from "./components/HelpModal.js";
import AIResponseModal from "./components/AIResponseModal.js";

const { createApp } = Vue;
const { mapState, mapActions, mapWritableState } = window.Pinia;

const app = createApp({
  components: {
    AppHeader, AppSidebar, NotesList, NoteEditor, SettingsModal, SkeletonLoader, AlertModal, Toast, TagSelectionOverlay, NoticeBoard, HelpModal,
    AIResponseModal
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
      tagModalPosition: null,
    };
  },
  computed: {
    ...mapState(useNotesStore, ['notes', 'isLoading', 'saveStatus']),
    ...mapWritableState(useNotesStore, ['editingNote']),
    ...mapState(useTagsStore, ['allTags']),
    ...mapState(useSettingsStore, [
        'theme', 'sidebarCollapsed', 'handsFreeMode', 'saveVoiceRecordings', 
        'currentLayout', 'isNoticeBoardVisible', 'noticeBoardContent',
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
      
      // Apply sorting
      const sorted = [...notesToFilter].sort((a, b) => {
        let compareValue = 0;
        const sortBy = settingsStore.sortBy || 'updatedAt';
        const sortOrder = settingsStore.sortOrder || 'desc';
        
        switch (sortBy) {
          case 'title':
            compareValue = (a.title || '').localeCompare(b.title || '');
            break;
          case 'createdAt':
            compareValue = new Date(a.createdAt) - new Date(b.createdAt);
            break;
          case 'updatedAt':
          default:
            compareValue = new Date(a.updatedAt) - new Date(b.updatedAt);
            break;
        }
        
        return sortOrder === 'desc' ? -compareValue : compareValue;
      });
      
      return sorted;
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
      setNoticeBoardAvailability: 'setNoticeBoardAvailability',
      setHandsFreeModeInStore: 'setHandsFreeMode',
      setSaveVoiceRecordingsInStore: 'setSaveVoiceRecordings'
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
        const settingsStore = useSettingsStore();

        if (!notesContext || notesContext.length === 0) {
            this.setNoticeBoardAvailability(false);
            settingsStore.setNoticeBoardContent(null);
            return;
        }
        this.setNoticeBoardAvailability(true);

        const currentViewId = this.currentView;
        const currentSignature = this.filteredNotesSignature;

        // Check cache before doing anything else
        const { valid, cached } = await noticeBoardCacheService.isValidCache(currentViewId, currentSignature);

        if (valid && cached) {
            console.log(`[main.js] Using cached notice board for view: ${currentViewId}`);
            settingsStore.setNoticeBoardContent(cached.content);
            this.isNoticeBoardLoading = false;
            return; // Cache hit, we are done.
        }
        
        // Cache miss, proceed with generation
        console.log(`[main.js] No valid cache for view: ${currentViewId}. Regenerating...`);
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
    /**
     * Handle notice board cache updates
     * Called when the NoticeBoard component successfully caches content
     */
    handleNoticeBoardCacheUpdated(payload) {
        console.log(`Notice board cached for view: ${payload.viewId}`);
        // You can add analytics or logging here if needed
    },
    
    // ... Other methods remain unchanged
    openTagModal(note, event) { 
      this.noteToTag = note;
      if (event && event.target) {
        const rect = event.target.getBoundingClientRect();
        this.tagModalPosition = {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom
        };
      }
    },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) { this.currentView = `tag:${tagId}`; },
    async handleCreateTag(tagName = null) {
      // tagName comes from the emit, or fall back to newTagName
      const name = (tagName || this.newTagName || '').trim();
      console.log('[main.js] handleCreateTag called with:', { tagName, newTagName: this.newTagName, finalName: name });
      if (!name) {
        console.log('[main.js] Tag name is empty, returning');
        return;
      }
      try {
        console.log('[main.js] Creating tag:', name);
        await this.createTagInStore({ name });
        this.newTagName = "";
        toastService.success('Tag Created', `"${name}" was created successfully`);
        console.log('[main.js] Tag created successfully');
      } catch (error) { 
        console.error("Failed to save tag:", error); 
        alertService.error('Error', 'Could not save the new tag. Please try again.'); 
      }
    },
    async handleDeleteTag(tagId) {
      const tagsStore = useTagsStore();
      const tag = tagsStore.getTagById(tagId);
      if (!tag) return;
      
      const confirmed = await alertService.confirm(
        'Delete Tag',
        `Are you sure you want to delete the tag "${tag.name}"? Notes with this tag will not be deleted.`,
        { confirmText: 'Delete', cancelText: 'Cancel' }
      );
      
      if (confirmed) {
        try {
          await tagsStore.deleteTag(tagId);
          // If we're viewing this tag, switch to all notes
          if (this.currentView === `tag:${tagId}`) {
            this.currentView = 'all-notes';
          }
          toastService.success('Tag Deleted', `"${tag.name}" was deleted.`);
        } catch (error) {
          console.error('Failed to delete tag:', error);
          toastService.error('Error', 'Could not delete the tag. Please try again.');
        }
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
    /**
     * Clear notice board cache for all views or a specific view
     * Useful when settings change or when you want to force regeneration
     */
    async clearNoticeBoardCache(viewId = null) {
      try {
        if (viewId) {
          await noticeBoardCacheService.deleteCached(viewId);
          console.log(`Cleared notice board cache for view: ${viewId}`);
        } else {
          await noticeBoardCacheService.clearAll();
          console.log('Cleared all notice board caches');
        }
      } catch (error) {
        console.error('Error clearing notice board cache:', error);
      }
    },
    async initializeApp() {
      try {
        await initializeStores();
        this.setThemeInStore(this.theme);
        await aiHandler.init();
        
        aiEventService.setup(this);
        aiToolsService.setVueInstance(this);
        
        setInterval(this.checkReminders, 60000);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        alertService.error('Initialization Failed', 'Could not initialize the application. Please refresh the page.');
      }
    },
    debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
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
             // FIX: Add a guard to ensure the debounced function exists before calling it.
             // This prevents a race condition on initial load.
             if (this.debouncedUpdateNoticeBoard) {
                this.debouncedUpdateNoticeBoard(this.filteredNotes);
             }
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