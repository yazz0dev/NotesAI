import { alertService } from "./services/alert-service.js";
import { pinia, initializeStores, useNotesStore, useTagsStore, useSettingsStore } from "./stores/index.js";
import { noteActionsService } from "./services/note-actions-service.js";
import { aiEventService } from "./services/ai-event-service.js";
import { editorResizeService } from "./services/editor-resize-service.js";
import { openHelp } from "./services/openHelp.js"; // IMPORT THE NEW MODULE
import aiHandler from "./services/ai-handler.js";

import AppHeader from "./components/AppHeader.js";
import AppSidebar from "./components/AppSidebar.js";
import NotesList from "./components/NotesList.js";
import NoteEditor from "./components/NoteEditor.js";
import SettingsModal from "./components/SettingsModal.js";
import SkeletonLoader from "./components/SkeletonLoader.js";
import AlertModal from "./components/AlertModal.js";
import TagSelectionModal from "./components/TagSelectionModal.js";
import NoticeBoard from "./components/NoticeBoard.js";

const { createApp } = Vue;
const { mapState, mapActions, mapWritableState } = window.Pinia;

const app = createApp({
  components: {
    AppHeader, AppSidebar, NotesList, NoteEditor, SettingsModal, SkeletonLoader, AlertModal, TagSelectionModal, NoticeBoard
  },
  data() {
    return {
      // --- UI State (Local to the main component) ---
      noteToTag: null,
      isSettingsModalVisible: false,
      newTagName: "",

      // --- AI Interaction State ---
      aiStatus: { status: "disabled", message: "Initializing..." },
      isVoiceActive: false,
      contentBeforeDictation: "", // Context for dictation updates
      isNoticeBoardLoading: false,
    };
  },
  computed: {
    // --- Pinia State Mappers ---
    ...mapState(useNotesStore, ['notes', 'isLoading', 'saveStatus']),
    ...mapWritableState(useNotesStore, ['editingNote']),
    ...mapState(useTagsStore, ['allTags']),
    ...mapState(useSettingsStore, [
        'isSidebarCollapsed', 'handsFreeMode', 'saveVoiceRecordings', 
        'currentTheme', 'currentLayout', 'isNoticeBoardVisible', 'noticeBoardContent'
    ]),
    ...mapWritableState(useSettingsStore, ['searchQuery', 'currentFilter', 'currentTag', 'sortBy', 'sortOrder']),

    // --- Derived View Logic ---
    currentView: {
      get() {
        const settingsStore = useSettingsStore();
        if (settingsStore.currentTag) return `tag:${settingsStore.currentTag}`;
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
      const sortKey = settingsStore.sortBy || 'updatedAt';
      const sortDir = settingsStore.sortOrder || 'desc';
      return [...notesToFilter].sort((a, b) => {
        const comparison = sortKey.includes('At')
          ? new Date(b[sortKey]) - new Date(a[sortKey])
          : String(a[sortKey]).localeCompare(String(b[sortKey]));
        return sortDir === 'asc' ? comparison * -1 : comparison;
      });
    }
  },
  methods: {
    // --- Pinia Action Mappers ---
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
      setNoticeBoardVisibility: 'setNoticeBoardVisibility'
    }),

    // --- Note Actions (Delegated to Service) ---
    async saveNote(noteToSave) {
        const savedNote = await noteActionsService.saveNote(noteToSave);
        if (savedNote && this.editingNote && this.editingNote.id === savedNote.id) {
            const notesStore = useNotesStore();
            this.editingNote = { ...notesStore.getNoteById(savedNote.id) };
        }
    },
    async deleteNote(noteId) {
        const editorShouldClose = await noteActionsService.deleteNote(noteId, this.editingNote);
        if (editorShouldClose) {
            this.closeEditor();
        }
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
    createNewNote(payload = {}, shouldOpenEditor = true) {
      const isClickEvent = payload instanceof Event;
      const title = isClickEvent ? null : payload.title;
      const content = isClickEvent ? "" : payload.content || "";
      const newNoteData = {
        title: title || (content ? `Voice Note ${new Date().toLocaleTimeString()}` : "New Note"),
        content,
      };
      this.createNoteInStore(newNoteData).then(createdNote => {
        if (shouldOpenEditor) this.editNote(createdNote);
      });
    },
    editNote(note) { useNotesStore().setEditingNote(note ? JSON.parse(JSON.stringify(note)) : null); },
    closeEditor() {
        if (this.isVoiceActive) aiHandler.stopListening();
        useNotesStore().clearEditingNote();
    },
    
    // --- UI & View Handlers ---
    setTheme(theme) { this.setThemeInStore(theme); },
    toggleSidebar() { this.setSidebarCollapsedInStore(!this.isSidebarCollapsed); },
    toggleLayout() { this.setLayoutInStore(this.currentLayout === 'grid' ? 'list' : 'grid'); },
    handleSearch(queryText) { this.searchQuery = (queryText || '').trim().replace(/\s+/g, ' '); },
    switchView(view) {
      this.currentView = view;
      this.editingNote = null;
      if (!view.startsWith('tag:')) {
        this.searchQuery = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.textContent = '';
      }
    },
    getSortLabel() {
      const labels = { 'updatedAt-desc': 'Newest', 'createdAt-desc': 'Created', 'title-asc': 'A-Z' };
      return labels[`${this.sortBy}-${this.sortOrder}`] || 'Sort';
    },
    handleSortChange() {
      const sorts = ['updatedAt-desc', 'createdAt-desc', 'title-asc'];
      const currentSort = `${this.sortBy}-${this.sortOrder}`;
      const nextIndex = (sorts.indexOf(currentSort) + 1) % sorts.length;
      const [sortBy, sortOrder] = sorts[nextIndex].split('-');
      this.sortBy = sortBy;
      this.sortOrder = sortOrder;
    },
    
    // --- Notice Board ---
    async refreshNoticeBoard() {
        this.isNoticeBoardLoading = true;
        await this.generateNoticeBoardInStore();
        this.isNoticeBoardLoading = false;
    },
    toggleNoticeBoard() { this.setNoticeBoardVisibility(!this.isNoticeBoardVisible); },
    handleNavigateToNote(noteId) {
        const note = useNotesStore().getNoteById(noteId);
        if (note) this.editNote(note);
    },

    // --- Modal & Tag Handlers ---
    openTagModal(note) { this.noteToTag = note; },
    closeTagModal() { this.noteToTag = null; },
    handleTagClick(tagId) { this.currentTag = tagId; this.currentFilter = 'all'; this.searchQuery = ''; },
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
    
    // --- AI & Voice Interaction ---
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
    // **KEY CHANGE**: The openHelp method now just calls the imported function.
    openHelp,
  },
  watch: {
    isSidebarCollapsed(isCollapsed) { document.body.classList.toggle("sidebar-collapsed", isCollapsed); },
    handsFreeMode(newValue) { newValue ? aiHandler.startAmbientListening() : aiHandler.stopAmbientListening(); },
  },
  async created() {
    try {
      await initializeStores();
      this.setTheme(this.currentTheme);
      await aiHandler.init();
      
      aiEventService.setup(this); // Pass component instance to the service
      
      setInterval(this.checkReminders, 60000);

      if (!this.noticeBoardContent) {
          this.refreshNoticeBoard();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
      alertService.error('Initialization Failed', 'Could not initialize the application. Please refresh the page.');
    }
  },
  mounted() { 
    document.body.classList.toggle("sidebar-collapsed", this.isSidebarCollapsed); 
  },
  beforeUnmount() {
    aiEventService.teardown(); // Clean up listeners
    window.onerror = null;
    window.onunhandledrejection = null;
  },
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