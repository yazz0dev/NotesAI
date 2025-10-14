// js/main.js - Vue.js Version
// Note: Using direct script loading instead of ES6 imports for CDN compatibility

// Define error handling constants and functions locally for Vue.js compatibility
const ERROR_TYPES = {
  NETWORK: "network",
  STORAGE: "storage",
  AI_SERVICE: "ai_service",
  AUDIO: "audio",
  VALIDATION: "validation",
  PERMISSION: "permission",
  UNKNOWN: "unknown",
};

const ERROR_SEVERITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

// Simple error handling function for Vue.js compatibility
function withErrorHandling(operation, options = {}) {
  try {
    return operation();
  } catch (error) {
    console.error("Error in operation:", error);
    if (options.fallback) {
      return options.fallback();
    }
    throw error;
  }
}

// Create Vue app
const { createApp } = Vue;

const app = createApp({
  data() {
    return {
      // App state - progressive loading
      isLoading: true,
      loadingMessage: "Loading your data...",
      isSidebarLoading: true,
      isNotesLoading: true,
      isHeaderLoading: true,

      // Navigation state
      currentView: "all-notes",
      currentSort: "dateModified",

      // Notes data
      notes: [],
      selectedNote: null,

      // Organization data
      notebooks: [],
      tags: [],

      // UI state
      sidebarState: "expanded", // 'expanded', 'collapsed', 'hidden'
      searchQuery: "",

      // Recording state
      isRecording: false,
      recordingTime: "0:00",

      // Goals data
      goals: [],
      activeGoalsCount: 0,
      completedGoalsCount: 0,
      totalStreakCount: 0,

      // Editor state
      editorVisible: false,
      editingNote: null,
      editorTitle: "",
      editorContent: "",

      // Modal states
      showSettingsModal: false,
      showGoalsModal: false,
      showConfirmationModal: false,
      showNotebookModal: false,
      showTagModal: false,
      showTagSelectionModal: false,
      showGoalSelectionModal: false,

      // Confirmation modal state
      confirmMessage: "Are you sure you want to proceed?",
    };
  },

  computed: {
    // Filter notes based on current view and search
    filteredNotes() {
      let filtered = this.notes;

      // Filter by view
      switch (this.currentView) {
        case "favorites":
          filtered = filtered.filter((note) => note.isFavorite);
          break;
        case "recent":
          filtered = filtered.filter((note) => {
            const noteDate = new Date(note.updatedAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return noteDate > weekAgo;
          });
          break;
        case "archived":
          filtered = filtered.filter((note) => note.isArchived);
          break;
      }

      // Filter by search query
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        filtered = filtered.filter(
          (note) =>
            note.summary.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query) ||
            (note.tags &&
              note.tags.some((tag) => tag.name.toLowerCase().includes(query)))
        );
      }

      // Sort notes
      return this.sortNotes(filtered);
    },

    // Get counts for sidebar
    allNotesCount() {
      return this.notes.length;
    },

    favoritesCount() {
      return this.notes.filter((note) => note.isFavorite).length;
    },

    archivedCount() {
      return this.notes.filter((note) => note.isArchived).length;
    },

    // Sidebar visibility for mobile (hidden state)
    isSidebarVisible() {
      return this.sidebarState !== "hidden";
    },
  },

  methods: {
    // Initialize the app with progressive loading
    async init() {
      console.log("🚀 Initializing Notes & Tasks Vue App...");
      window.startMeasurement("app_initialization");

      try {
        // Step 1: Initialize database first (critical)
        await withErrorHandling(() => window.store.initDB(), {
          type: ERROR_TYPES.STORAGE,
          severity: ERROR_SEVERITY.CRITICAL,
          context: { operation: "initDB" },
        });

        // Step 2: Load organization data first (sidebar)
        this.loadingMessage = "Loading organization data...";
        await this.loadOrganizationData();
        this.isSidebarLoading = false;

        // Step 3: Load notes data (main content)
        this.loadingMessage = "Loading your notes...";
        await this.loadNotes();
        this.isNotesLoading = false;

        // Step 4: Initialize services (can run in background)
        this.loadingMessage = "Initializing services...";
        window.initAI();
        await withErrorHandling(() => window.initAudioService(), {
          type: ERROR_TYPES.AUDIO,
          severity: ERROR_SEVERITY.MEDIUM,
          context: { operation: "initAudioService" },
        });

        // Step 5: Setup background tasks
        await window.checkGoalsDueToday();

        if (window.getHandsFreeMode()) {
          await withErrorHandling(() => window.startAmbientListening(), {
            type: ERROR_TYPES.PERMISSION,
            severity: ERROR_SEVERITY.MEDIUM,
            context: { operation: "startAmbientListening" },
          });
        }

        // Step 6: Initialize UI and complete loading
        this.loadingMessage = "Finalizing...";
        this.isHeaderLoading = false;

        // Small delay to ensure smooth transition
        setTimeout(() => {
          this.isLoading = false;
          console.log("✅ Notes & Tasks Vue App initialized successfully");
          window.endMeasurement("app_initialization");
        }, 500);
      } catch (error) {
        console.error("Fatal initialization error:", error);
        this.loadingMessage = "Error during initialization";
        this.isLoading = false;
        this.isSidebarLoading = false;
        this.isNotesLoading = false;
        this.isHeaderLoading = false;
      }
    },

    // Load notes from store
    async loadNotes() {
      const notes = await window.store.getNotes();
      this.notes = notes;
    },

    // Load organization data
    async loadOrganizationData() {
      // Load notebooks and tags from store
      this.notebooks = await window.store.getNotebooks();
      this.tags = await window.store.getTags();
    },

    // Sort notes based on current sort setting
    sortNotes(notes) {
      const sorted = [...notes];
      switch (this.currentSort) {
        case "dateModified":
          return sorted.sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
          );
        case "dateCreated":
          return sorted.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
        case "title":
          return sorted.sort((a, b) => a.summary.localeCompare(b.summary));
        default:
          return sorted;
      }
    },

    // Navigation methods
    switchView(view) {
      this.currentView = view;
    },

    // Note management methods
    createNote() {
      const newNote = {
        id: Date.now().toString(),
        summary: "",
        content: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isFavorite: false,
        isArchived: false,
        tags: [],
        notebookId: null,
      };

      this.notes.unshift(newNote);
      this.editNote(newNote);
    },

    editNote(note) {
      this.selectedNote = note;
      this.editingNote = { ...note };
      this.editorTitle = note.summary;
      this.editorContent = note.content;
      this.editorVisible = true;
    },

    saveNote() {
      if (this.editingNote) {
        const index = this.notes.findIndex((n) => n.id === this.editingNote.id);
        if (index !== -1) {
          this.notes[index] = {
            ...this.editingNote,
            summary: this.editorTitle,
            content: this.editorContent,
            updatedAt: new Date().toISOString(),
          };
          window.store.saveNote(this.notes[index]);
        }
      }

      this.closeEditor();
    },

    closeEditor() {
      this.editorVisible = false;
      this.selectedNote = null;
      this.editingNote = null;
      this.editorTitle = "";
      this.editorContent = "";
    },

    deleteNote(note) {
      this.confirmAction = () => {
        const index = this.notes.findIndex((n) => n.id === note.id);
        if (index !== -1) {
          this.notes.splice(index, 1);
          window.store.deleteNote(note.id);
        }
        this.closeConfirmationModal();
      };
      this.confirmMessage = "Are you sure you want to delete this note?";
      this.showConfirmationModal = true;
    },

    // Modal methods
    openModal(modalName) {
      this[`show${modalName}Modal`] = true;
    },

    closeModal(modalName) {
      this[`show${modalName}Modal`] = false;
    },

    closeConfirmationModal() {
      this.showConfirmationModal = false;
      this.confirmAction = null;
    },

    confirmAction() {
      if (this.confirmAction) {
        this.confirmAction();
      }
      this.closeConfirmationModal();
    },

    // Search method
    onSearch(event) {
      this.searchQuery = event.target.textContent || "";
    },

    // Sidebar toggle - cycles through expanded -> collapsed -> expanded
    toggleSidebar() {
      if (this.sidebarState === "expanded") {
        this.sidebarState = "collapsed";
      } else if (this.sidebarState === "collapsed") {
        this.sidebarState = "expanded";
      } else {
        this.sidebarState = "expanded"; // fallback
      }
      this.updateSidebarClasses();
    },

    // Update CSS classes on body based on sidebar state
    updateSidebarClasses() {
      const body = document.body;
      body.classList.remove("has-collapsed-sidebar", "has-expanded-sidebar");

      if (this.sidebarState === "collapsed" && this.isSidebarVisible) {
        body.classList.add("has-collapsed-sidebar");
      } else if (this.sidebarState === "expanded" && this.isSidebarVisible) {
        body.classList.add("has-expanded-sidebar");
      }
      // Note: No classes added when sidebar is hidden (mobile behavior)
    },

    // Enhanced sidebar toggle with animation classes
    toggleSidebar() {
      const currentState = this.sidebarState;

      if (this.sidebarState === "expanded") {
        this.sidebarState = "collapsed";
      } else if (this.sidebarState === "collapsed") {
        this.sidebarState = "expanded";
        // Add expanding class for staggered animations when expanding from collapsed
        this.$nextTick(() => {
          const sidebar = document.querySelector(".sidebar");
          if (sidebar) {
            sidebar.classList.add("sidebar-expanding");
            setTimeout(() => {
              sidebar.classList.remove("sidebar-expanding");
            }, 600);
          }
        });
      } else {
        this.sidebarState = "expanded";
      }

      this.updateSidebarClasses();
    },

    // Recording methods (placeholder for now)
    startRecording() {
      this.isRecording = true;
      this.recordingTime = "0:00";
    },

    stopRecording() {
      this.isRecording = false;
      this.recordingTime = "0:00";
    },
  },

  async mounted() {
    await this.init();
    this.updateSidebarClasses(); // Set initial sidebar classes
    window.initSettingsView();
  },
});

// Define components before mounting the app
const AppHeader = {
  template: `
    <header class="app-header">
      <div v-if="isRecording" class="recording-indicator">
        <div class="recording-dot"></div>
        <span>Recording</span>
        <span class="recording-time">{{ recordingTime }}</span>
      </div>
    </header>
  `,
  props: ["isRecording", "recordingTime"],
};

const AppSidebar = {
  template: `
    <nav class="sidebar bg-light border-end d-flex flex-column" style="width: 280px; min-height: 100vh;">
      <div class="sidebar-header d-flex justify-content-between align-items-center p-3 border-bottom">
        <h1 class="app-title h5 mb-0 text-primary">Notes & Tasks</h1>
        <button @click="$emit('toggle-sidebar')" class="sidebar-toggle btn btn-outline-secondary btn-sm">
          <i class="bi bi-list"></i>
        </button>
      </div>

      <div class="sidebar-nav flex-fill overflow-auto">
        <div class="nav-section mb-4">
          <div
            class="nav-item d-flex align-items-center justify-content-between p-2 mb-1 rounded"
            :class="{ active: currentView === 'all-notes' }"
            @click="$emit('switch-view', 'all-notes')"
            style="cursor: pointer;"
          >
            <div class="d-flex align-items-center">
              <i class="bi bi-journal-text me-2"></i>
              <span class="nav-text">All Notes</span>
            </div>
            <span class="nav-count badge bg-secondary">{{ allNotesCount }}</span>
          </div>
          <div
            class="nav-item d-flex align-items-center justify-content-between p-2 mb-1 rounded"
            :class="{ active: currentView === 'favorites' }"
            @click="$emit('switch-view', 'favorites')"
            style="cursor: pointer;"
          >
            <div class="d-flex align-items-center">
              <i class="bi bi-star me-2"></i>
              <span class="nav-text">Favorites</span>
            </div>
            <span class="nav-count badge bg-secondary">{{ favoritesCount }}</span>
          </div>
          <div
            class="nav-item d-flex align-items-center justify-content-between p-2 mb-1 rounded"
            :class="{ active: currentView === 'recent' }"
            @click="$emit('switch-view', 'recent')"
            style="cursor: pointer;"
          >
            <div class="d-flex align-items-center">
              <i class="bi bi-clock me-2"></i>
              <span class="nav-text">Recent</span>
            </div>
          </div>
          <div
            class="nav-item d-flex align-items-center justify-content-between p-2 mb-1 rounded"
            :class="{ active: currentView === 'archived' }"
            @click="$emit('switch-view', 'archived')"
            style="cursor: pointer;"
          >
            <div class="d-flex align-items-center">
              <i class="bi bi-archive me-2"></i>
              <span class="nav-text">Archived</span>
            </div>
            <span class="nav-count badge bg-secondary">{{ archivedCount }}</span>
          </div>
        </div>
      </div>

      <div class="sidebar-footer p-3 border-top mt-auto">
        <button @click="$emit('create-note')" class="new-note-btn btn btn-primary w-100 d-flex align-items-center justify-content-center">
          <i class="bi bi-plus-lg me-2"></i>
          <span>New Note</span>
        </button>
      </div>
    </nav>
  `,
  props: ["currentView", "allNotesCount", "favoritesCount", "archivedCount"],
  emits: ["toggle-sidebar", "switch-view", "create-note"],
};

const NotesList = {
  template: `
    <div class="notes-list-container flex-fill overflow-auto">
      <div class="notes-list row g-3 p-3">
        <div
          v-for="note in notes"
          :key="note.id"
          class="note-card col-md-6 col-lg-4 col-xl-3"
          @click="$emit('edit-note', note)"
        >
          <div class="card h-100">
            <div class="card-body">
              <h5 class="card-title">{{ note.summary || 'Untitled' }}</h5>
              <p class="card-text">{{ note.content.substring(0, 150) }}...</p>
              <small class="text-muted">{{ formatDate(note.updatedAt) }}</small>
            </div>
          </div>
        </div>
      </div>

      <div v-if="notes.length === 0" class="empty-state-container d-flex flex-column align-items-center justify-content-center p-5 text-center">
        <div class="empty-state-content">
          <i class="bi bi-journal-x display-1 text-muted mb-3"></i>
          <h2 class="h4 mb-3">No notes yet</h2>
          <p class="text-muted mb-4">Start writing your first note or create a task to get organized.</p>
          <button @click="$emit('create-note')" class="btn btn-primary">
            <i class="bi bi-plus-lg me-2"></i>
            Create your first note
          </button>
        </div>
      </div>
    </div>
  `,
  props: ["notes"],
  emits: ["edit-note", "create-note"],
  methods: {
    formatDate(dateString) {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
          return "Invalid date";
        }
        return (
          date.toLocaleDateString() +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      } catch (error) {
        console.error("Error formatting date:", error, dateString);
        return "Invalid date";
      }
    },
  },
};

const NoteEditor = {
  template: `
    <aside v-if="visible" class="note-editor d-flex flex-column border-start bg-white">
      <div class="editor-header border-bottom p-3">
        <div class="editor-title mb-3">
          <input
            v-model="title"
            placeholder="Note title..."
            class="note-title-input form-control form-control-lg border-0 px-0"
            style="font-size: 1.5rem; font-weight: 600;"
          />
          <div class="note-meta d-flex justify-content-between align-items-center mt-2 text-muted small">
            <span class="note-date">{{ formatDate(note.updatedAt) }}</span>
            <span class="note-word-count">{{ wordCount }} words</span>
          </div>
        </div>
        <div class="editor-actions d-flex gap-2">
          <button class="editor-btn btn btn-outline-secondary btn-sm">
            <i class="bi bi-pin"></i>
          </button>
          <button class="editor-btn btn btn-outline-secondary btn-sm">
            <i class="bi bi-tag"></i>
          </button>
          <button class="editor-btn btn btn-outline-secondary btn-sm">
            <i class="bi bi-flag"></i>
          </button>
          <button class="editor-btn btn btn-outline-secondary btn-sm">
            <i class="bi bi-share"></i>
          </button>
          <button class="editor-btn btn btn-outline-secondary btn-sm">
            <i class="bi bi-archive"></i>
          </button>
          <button @click="$emit('close')" class="editor-btn btn btn-outline-danger btn-sm">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>

      <div class="editor-content flex-fill p-3">
        <div
          contenteditable="true"
          class="note-content-editable form-control border-0 p-0 h-100"
          style="resize: none; overflow-y: auto;"
          @input="updateContent"
          v-html="content"
        ></div>
      </div>

      <div class="editor-footer border-top p-3 d-flex justify-content-between align-items-center">
        <div class="editor-status">
          <span class="status-text text-muted small">Ready</span>
        </div>
        <div class="editor-actions-footer d-flex gap-2">
          <button @click="$emit('save')" class="editor-btn btn btn-primary btn-sm">
            Save
          </button>
          <button @click="$emit('cancel')" class="editor-btn btn btn-outline-secondary btn-sm">
            Cancel
          </button>
        </div>
      </div>
    </aside>
  `,
  props: ["visible", "note"],
  emits: ["close", "save", "cancel"],
  data() {
    return {
      title: this.note?.summary || "",
      content: this.note?.content || "",
    };
  },
  computed: {
    wordCount() {
      return this.content.trim().split(/\s+/).length;
    },
  },
  methods: {
    formatDate(dateString) {
      if (!dateString) return "";
      try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) {
          return "Invalid date";
        }
        return (
          date.toLocaleDateString() +
          " " +
          date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        );
      } catch (error) {
        console.error("Error formatting date:", error, dateString);
        return "Invalid date";
      }
    },

    updateContent(event) {
      this.content = event.target.innerHTML;
    },
  },
  watch: {
    note: {
      handler(newNote) {
        this.title = newNote?.summary || "";
        this.content = newNote?.content || "";
      },
      deep: true,
      immediate: true,
    },
  },
};

// Compact sidebar component for collapsed state
const CompactSidebar = {
  template: `
    <nav class="sidebar-compact bg-light border-end d-flex flex-column align-items-center" style="width: 60px; min-height: 100vh;">
      <div class="sidebar-header-compact p-3 border-bottom w-100 text-center">
        <button @click="$emit('toggle-sidebar')" class="sidebar-toggle-compact btn btn-outline-primary btn-sm p-2" title="Expand Sidebar">
          <i class="bi bi-chevron-right"></i>
        </button>
      </div>

      <div class="sidebar-nav-compact flex-fill d-flex flex-column align-items-center py-3">
        <button
          @click="$emit('switch-view', 'all-notes')"
          class="nav-btn-compact btn btn-sm mb-2 p-2"
          :class="{ active: currentView === 'all-notes' }"
          title="All Notes"
        >
          <i class="bi bi-journal-text"></i>
        </button>
        <button
          @click="$emit('switch-view', 'favorites')"
          class="nav-btn-compact btn btn-sm mb-2 p-2"
          :class="{ active: currentView === 'favorites' }"
          title="Favorites"
        >
          <i class="bi bi-star"></i>
        </button>
        <button
          @click="$emit('switch-view', 'recent')"
          class="nav-btn-compact btn btn-sm mb-2 p-2"
          :class="{ active: currentView === 'recent' }"
          title="Recent"
        >
          <i class="bi bi-clock"></i>
        </button>
        <button
          @click="$emit('switch-view', 'archived')"
          class="nav-btn-compact btn btn-sm mb-2 p-2"
          :class="{ active: currentView === 'archived' }"
          title="Archived"
        >
          <i class="bi bi-archive"></i>
        </button>
      </div>

      <div class="sidebar-footer-compact p-3 border-top w-100 text-center">
        <button @click="$emit('create-note')" class="new-note-compact btn btn-primary btn-sm p-2" title="New Note">
          <i class="bi bi-plus-lg"></i>
        </button>
      </div>
    </nav>
  `,
  props: ["currentView"],
  emits: ["toggle-sidebar", "switch-view", "create-note"],
};

// Skeleton loader components
const SkeletonSidebar = {
  template: `
    <nav class="sidebar bg-light border-end d-flex flex-column skeleton-sidebar" style="width: 280px; min-height: 100vh;">
      <div class="skeleton-sidebar-header skeleton p-3"></div>

      <div class="sidebar-nav flex-fill overflow-auto p-2">
        <div class="skeleton-nav-item skeleton mb-2"></div>
        <div class="skeleton-nav-item skeleton mb-2"></div>
        <div class="skeleton-nav-item skeleton mb-2"></div>
        <div class="skeleton-nav-item skeleton mb-2"></div>
        <div class="skeleton-nav-item skeleton mb-2"></div>
      </div>

      <div class="sidebar-footer p-3 border-top">
        <div class="skeleton-toolbar skeleton"></div>
      </div>
    </nav>
  `,
};

const SkeletonHeader = {
  template: `
    <header class="content-toolbar d-flex justify-content-between align-items-center p-3 border-bottom skeleton-notes-header">
      <div class="toolbar-left d-flex align-items-center flex-grow-1 me-3">
        <div class="search-container d-flex align-items-center position-relative flex-grow-1 me-3">
          <div class="skeleton-search skeleton"></div>
        </div>
      </div>
      <div class="toolbar-right d-flex gap-2 skeleton-header-controls">
        <div class="skeleton-header-btn skeleton"></div>
        <div class="skeleton-header-btn skeleton"></div>
      </div>
    </header>
  `,
};

const SkeletonNoteCard = {
  template: `
    <div class="skeleton-note-card skeleton">
      <div class="skeleton-note-title skeleton"></div>
      <div class="skeleton-note-content skeleton"></div>
      <div class="skeleton-note-meta skeleton"></div>
    </div>
  `,
};

const SkeletonNotesList = {
  template: `
    <div class="notes-list-container flex-fill overflow-auto">
      <div class="notes-list row g-3 p-3">
        <div v-for="n in 8" :key="n" class="col-md-6 col-lg-4 col-xl-3">
          <skeleton-note-card></skeleton-note-card>
        </div>
      </div>
    </div>
  `,
  components: {
    SkeletonNoteCard,
  },
};

const SkeletonLoader = {
  template: `
    <div class="app-layout d-flex">
      <skeleton-sidebar></skeleton-sidebar>
      <main class="main-content flex-fill" role="main">
        <skeleton-header></skeleton-header>
        <skeleton-notes-list></skeleton-notes-list>
      </main>
    </div>
  `,
  components: {
    SkeletonSidebar,
    SkeletonHeader,
    SkeletonNotesList,
  },
};

// Register components with the app
app.component("AppHeader", AppHeader);
app.component("AppSidebar", AppSidebar);
app.component("CompactSidebar", CompactSidebar);
app.component("NotesList", NotesList);
app.component("NoteEditor", NoteEditor);
app.component("SkeletonLoader", SkeletonLoader);
app.component("SkeletonSidebar", SkeletonSidebar);
app.component("SkeletonHeader", SkeletonHeader);
app.component("SkeletonNoteCard", SkeletonNoteCard);
app.component("SkeletonNotesList", SkeletonNotesList);

// Mount the app
app.mount("#app");
