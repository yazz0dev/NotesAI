import * as store from "./core/store.js";
import * as view from "./view.js";
import {
  initAIService,
  startAmbientListening,
  stopAmbientListening,
} from "./services/ai-service.js";
import {
  extractTopics,
  analyzeSentiment,
  destroyAISession,
} from "./services/ai-insights.js";
import {
  importFromFile,
  validateImportData,
} from "./services/import-service.js";
import {
  initAudioService,
  startRecording,
  stopRecording,
  storeAudioData,
  getAudioData,
  formatDuration,
} from "./services/voice-service.js";
import {
  getAllGoals,
  createGoal,
  recordProgress,
  getGoalsDueToday,
  generateGoalInsights,
  GOAL_TYPES,
  GOAL_STATUS,
} from "./services/goals-service.js";
import {
  startMeasurement,
  endMeasurement,
  measureAsync,
} from "./utils/performance.js";
import { getCachedResult, setCachedResult } from "./utils/cache.js";
import {
  showGoalsModal,
  hideGoalsModal,
  showGoalForm,
  hideGoalForm,
  handleGoalTypeChange,
  handleGoalFormSubmit,
  handleGoalProgress,
  checkGoalsDueToday,
} from "./components/goals-ui.js";
// NEW: Error handling system
import errorHandler, {
  withErrorHandling,
  ERROR_TYPES,
  ERROR_SEVERITY,
} from "./core/error-handler.js";
import {
  safeStore,
  safeAI,
  safeExportImport,
  safeGoals,
  safeAudio,
  networkAware,
  permissionAware,
  safeValidation,
} from "./core/error-aware-services.js";
// NEW: Settings view component
import {
  showSettingsModal,
  getHandsFreeMode,
  setHandsFreeMode,
  initSettingsView,
} from "./components/settings-view.js";

let notes = [];
let currentOpenNote = null; // Track the currently open note object
// NEW: Application Context
let appContext = {
  view: "notes",
  openNoteId: null,
  sidebarCollapsed: false,
};
let searchTimeout = null;
// NEW: Voice state tracking for mic button logic
let voiceState = "IDLE";
let currentRecordingData = null; // Store audio recording data
let recordingTimer = null; // Timer for recording duration display
// NEW: Modern layout state
let currentView = "all-notes";
let currentFilter = "all";
let currentSort = "dateModified";
// NEW: Organization data cache
let notebooks = [];
let tags = [];
let tagColorMap = new Map();
let notebookNameMap = new Map();

/**
 * Cleans Chrome AI API response by removing markdown formatting
 * @param {string} response - Raw response from Chrome AI API
 * @returns {string} Clean text
 */
function cleanAIResponse(response) {
  if (!response) return "";

  // Remove markdown code block markers and extra whitespace
  let cleaned = response
    .replace(/```json\s*/gi, "") // Remove ```json (case insensitive)
    .replace(/```\s*/g, "") // Remove ```
    .replace(/`+/g, "") // Remove any remaining backticks
    .trim();

  // Remove any leading/trailing whitespace and newlines
  cleaned = cleaned.replace(/^\s+|\s+$/g, "");

  return cleaned;
}

/**
 * Shows the app loading overlay with initial state
 */
function showAppLoading() {
  const overlay = document.getElementById("app-loading-overlay");
  const progressBar = document.getElementById("loading-progress-bar");
  const statusText = document.getElementById("loading-status");

  if (overlay) {
    // Ensure page is at top and prevent scrolling
    window.scrollTo(0, 0);

    // Force show the overlay immediately
    overlay.classList.remove("hidden");
    overlay.style.display = "flex";

    // Add loading-active class to body to prevent interference
    document.body.classList.add("loading-active");

    // Ensure overlay is properly positioned and centered
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.zIndex = "10002";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";

    // Reset progress
    if (progressBar) progressBar.style.width = "0%";
    if (statusText) statusText.textContent = "Initializing your workspace...";

    // Reset all steps to inactive
    const steps = document.querySelectorAll(".loading-step");
    steps.forEach((step) => {
      step.classList.remove("active", "completed");
    });

    console.log("🚀 Loading overlay shown - positioned at viewport center");
  } else {
    console.error("❌ Loading overlay element not found!");
  }
}

/**
 * Updates the loading progress and step indicators
 * @param {string} step - The current step name
 * @param {string} status - Status message to display
 * @param {number} progress - Progress percentage (0-100)
 */
function updateLoadingProgress(step, status, progress = null) {
  const statusText = document.getElementById("loading-status");
  const progressBar = document.getElementById("loading-progress-bar");
  const stepElements = document.querySelectorAll(".loading-step");

  // Update status text
  if (statusText && status) {
    statusText.textContent = status;
  }

  // Update progress bar
  if (progressBar && progress !== null) {
    progressBar.style.width = `${progress}%`;
  }

  // Update step indicators
  stepElements.forEach((stepEl) => {
    const stepName = stepEl.dataset.step;

    if (stepName === step) {
      stepEl.classList.add("active");
      stepEl.classList.remove("completed");
    } else if (
      stepEl.classList.contains("active") ||
      stepEl.classList.contains("completed")
    ) {
      // Mark previous steps as completed
      stepEl.classList.remove("active");
      stepEl.classList.add("completed");
    }
  });
}

/**
 * Hides the app loading overlay
 */
function hideAppLoading() {
  const overlay = document.getElementById("app-loading-overlay");
  if (overlay) {
    // Add a small delay for smooth transition
    setTimeout(() => {
      overlay.classList.add("hidden");
      // Remove loading-active class from body
      document.body.classList.remove("loading-active");
      console.log("✅ Loading overlay hidden");
    }, 500);
  }
}

/**
 * Initializes header elements that are dynamically created
 */
function initHeaderElements() {
  const header = document.getElementById("app-header");
  if (!header) return;

  // Create header controls container
  const headerControls = document.createElement("div");
  headerControls.className = "header-controls";

  // Create mic button
  const micButton = document.createElement("button");
  micButton.id = "mic-button";
  micButton.className = "mic-button";
  micButton.title = "Voice control";
  micButton.innerHTML =
    '<span class="iconify" data-icon="material-symbols:mic"></span>';
  headerControls.appendChild(micButton);

  // Create settings button
  const settingsBtn = document.createElement("button");
  settingsBtn.id = "settings-btn";
  settingsBtn.className = "settings-btn";
  settingsBtn.title = "Settings";
  settingsBtn.innerHTML =
    '<span class="iconify" data-icon="material-symbols:settings"></span>';
  headerControls.appendChild(settingsBtn);

  // Create add image button
  const addImageBtn = document.createElement("button");
  addImageBtn.id = "add-image-btn";
  addImageBtn.className = "add-image-btn";
  addImageBtn.title = "Add image";
  addImageBtn.innerHTML =
    '<span class="iconify" data-icon="material-symbols:image"></span>';
  headerControls.appendChild(addImageBtn);

  // Insert controls before the recording indicator
  const recordingIndicator = document.getElementById("recording-indicator");
  if (recordingIndicator) {
    header.insertBefore(headerControls, recordingIndicator);
  } else {
    header.appendChild(headerControls);
  }
}

/**
 * Initializes the application.
 */
async function init() {
  console.log("🚀 Initializing Notes & Tasks with error handling...");
  startMeasurement("app_initialization");

  // Show loading overlay immediately
  showAppLoading();

  try {
    // Step 1: Initialize basic UI
    updateLoadingProgress("ui", "Setting up interface...", 10);
    initHeaderElements();

    // Step 2: Initialize database
    updateLoadingProgress("database", "Setting up database...", 25);
    await withErrorHandling(() => store.initDB(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.CRITICAL,
      context: { operation: "initDB" },
    });

    // Step 3: Load notes
    updateLoadingProgress("notes", "Loading your entries...", 50);
    notes = await safeStore.loadNotes();

    // Step 4: Load organization data and initialize modern layout
    updateLoadingProgress("notes", "Loading organization data...", 60);
    await loadOrganizationData();

    // Step 4.5: Initialize modern layout after DOM is ready
    updateLoadingProgress("ui", "Setting up interface...", 65);
    await initModernLayout();
    await updateNotesList();

    // Step 5: Set up event listeners and AI
    updateLoadingProgress("ai", "Preparing AI features...", 75);
    setupEventListeners();
    setupComponentEventListeners();
    initAI();

    // Step 6: Initialize audio service
    updateLoadingProgress("ai", "Initializing audio features...", 85);
    await withErrorHandling(() => initAudioService(), {
      type: ERROR_TYPES.AUDIO,
      severity: ERROR_SEVERITY.MEDIUM,
      context: { operation: "initAudioService" },
    });

    // Step 7: Finalize with background tasks
    updateLoadingProgress("ui", "Finalizing...", 95);
    await checkGoalsDueToday();

    // Auto-start ambient listening if user enabled it previously
    if (getHandsFreeMode()) {
      await withErrorHandling(() => startAmbientListening(), {
        type: ERROR_TYPES.PERMISSION,
        severity: ERROR_SEVERITY.MEDIUM,
        context: { operation: "startAmbientListening" },
      });
    }

    // Complete initialization
    updateLoadingProgress("ui", "Ready!", 100);
    console.log("✅ Notes & Tasks initialized successfully");
    endMeasurement("app_initialization");

    // Hide loading overlay after a brief moment
    setTimeout(() => {
      hideAppLoading();
    }, 1000);
  } catch (error) {
    endMeasurement("app_initialization");
    updateLoadingProgress("ui", "Error during initialization", 0);

    errorHandler.handleError({
      type: ERROR_TYPES.UNKNOWN,
      severity: ERROR_SEVERITY.CRITICAL,
      message: `Failed to initialize application: ${error.message}`,
      userMessage:
        "Failed to start the application. Please refresh the page and try again.",
      context: { operation: "init" },
    });

    // Hide loading overlay after error
    setTimeout(() => {
      hideAppLoading();
    }, 3000);
  }

  console.log("App ready.");
}

/**
 * Loads organization data (notebooks and tags)
 */
async function loadOrganizationData() {
  try {
    notebooks = await safeStore.getNotebooks();
    tags = await safeStore.getTags();

    // Build lookup maps
    notebooks.forEach((notebook) => {
      notebookNameMap.set(notebook.id, notebook.name);
    });

    tags.forEach((tag) => {
      tagColorMap.set(tag.id, tag.color);
    });
  } catch (error) {
    console.error("Error loading organization data:", error);
  }
}

/**
 * Helper function to get notebook name by ID
 */
function getNotebookName(notebookId) {
  return notebookNameMap.get(notebookId) || "Unknown Notebook";
}

/**
 * Helper function to get tag name by ID
 */
function getTagName(tagId) {
  const tag = tags.find((t) => t.id === tagId);
  return tag ? tag.name : "Unknown";
}

/**
 * Helper function to get tag color by ID
 */
function getTagColor(tagId) {
  return tagColorMap.get(tagId) || "#666";
}

/**
 * Toggles favorite status of a note
 */
async function toggleFavorite(noteId) {
  try {
    await safeStore.toggleFavoriteNote(noteId);
    // Reload notes to reflect changes
    notes = await safeStore.loadNotes();
    await updateNotesList();
    updateSidebarCounts();
  } catch (error) {
    console.error("Error toggling favorite:", error);
  }
}

/**
 * Initializes the modern layout and UI components
 */
async function initModernLayout() {
  // Ensure DOM is ready before setting up event listeners
  if (document.readyState !== "loading") {
    setupUIEventListeners();
  } else {
    document.addEventListener("DOMContentLoaded", setupUIEventListeners);
  }
}

function setupUIEventListeners() {
  // Set up sidebar toggle
  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", toggleSidebar);
  }

  // Set up navigation items
  setupNavigationListeners();

  // Set up toolbar buttons
  setupToolbarListeners();

  // Set up editor listeners
  setupEditorListeners();

  // Set up search functionality
  setupSearchFunctionality();

  // Set up keyboard shortcuts
  setupKeyboardShortcuts();

  // Update counts and UI
  updateSidebarCounts();

  // Set up quick capture functionality
  setupQuickCapture();

  // Set up mobile-specific features
  setupMobileFeatures();
}

/**
 * Toggles the sidebar visibility
 */
function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;

  const isCollapsed = sidebar.classList.contains("collapsed");

  if (isCollapsed) {
    sidebar.classList.remove("collapsed");
    appContext.sidebarCollapsed = false;
  } else {
    sidebar.classList.add("collapsed");
    appContext.sidebarCollapsed = true;
  }

  // Save state to localStorage
  localStorage.setItem("sidebarCollapsed", appContext.sidebarCollapsed);
}

/**
 * Sets up navigation item click listeners
 */
function setupNavigationListeners() {
  const navItems = document.querySelectorAll(".nav-item");

  if (navItems.length > 0) {
    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        const view = item.dataset.view;
        const notebook = item.dataset.notebook;

        if (view) {
          switchView(view);
        } else if (notebook) {
          switchView("notebook", notebook);
        }

        // Update active state
        navItems.forEach((nav) => nav.classList.remove("active"));
        item.classList.add("active");
      });
    });
  }

  // Load saved sidebar state
  const savedState = localStorage.getItem("sidebarCollapsed");
  const sidebar = document.getElementById("sidebar");
  if (savedState === "true" && sidebar) {
    sidebar.classList.add("collapsed");
    appContext.sidebarCollapsed = true;
  }
}

/**
 * Switches between different views (all-notes, favorites, recent, etc.)
 */
function switchView(view, filter = null) {
  currentView = view;
  currentFilter = filter || "all";

  // Update UI
  updateNotesList();

  // Update toolbar
  updateToolbarForView(view);
}

/**
 * Updates the notes list based on current view and filter
 */
async function updateNotesList() {
  console.log(
    `Updating notes list - View: ${currentView}, Filter: ${currentFilter}`
  );
  // Notes list functionality will be implemented when UI is added
  // For now, just log the current state
  console.log(`Total notes: ${notes.length}`);
}

/**
 * Filters notes by search query
 */
async function filterNotesBySearch(notes, query) {
  if (!query) return notes;

  console.log(`Filtering notes by search: ${query}`);
  // Search functionality will be implemented when notes list UI is added
  return notes;
}

/**
 * Sorts notes based on current sort option
 */
function sortNotes(notes, sortBy) {
  console.log(`Sorting notes by: ${sortBy}`);
  // Sorting functionality will be implemented when notes list UI is added
  return notes;
}

/**
 * Renders the notes list with modern cards
 */
async function renderNotesList(notesToRender) {
  console.log(`Rendering ${notesToRender?.length || 0} notes`);
  // Notes rendering will be implemented when notes list UI is added
}

/**
 * Opens a note in the editor panel
 */
function openNoteInEditor(noteId) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;

  currentOpenNote = note;
  console.log(`Opening note in editor: ${note.summary || "Untitled"}`);
  // Editor functionality will be implemented when editor UI is added
}

/**
 * Creates a new note and opens it in editor
 */
async function createNewNote() {
  try {
    const newNote = await store.addNote(
      "<p>Start writing...</p>",
      "New Note",
      "A new note"
    );
    notes.unshift(newNote);
    await updateNotesList();
    openNoteInEditor(newNote.id);
  } catch (error) {
    console.error("Error creating new note:", error);
  }
}

/**
 * Updates the editor state indicator
 */
function updateEditorState(state) {
  console.log(`Editor state: ${state}`);
  // Editor state will be implemented when editor UI is added
}

/**
 * Gets word count from content
 */
function getWordCount(content) {
  if (!content) return 0;
  const text = content.replace(/<[^>]*>/g, "").trim();
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Formats a date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return "Today";
  } else if (diffInDays === 1) {
    return "Yesterday";
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Sets up toolbar button listeners
 */
function setupToolbarListeners() {
  console.log("Setting up toolbar listeners");
  // Toolbar functionality will be implemented when UI is added
}

/**
 * Sets up editor button listeners
 */
function setupEditorListeners() {
  console.log("Setting up editor listeners");
  // Editor functionality will be implemented when editor UI is added
}

/**
 * Sets up search functionality
 */
function setupSearchFunctionality() {
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(handleSearch, 300));
  }

  // Search filter buttons (placeholder for future implementation)
  const filterBtns = document.querySelectorAll(".filter-btn");
  if (filterBtns.length > 0) {
    filterBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        filterBtns.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentFilter = btn.dataset.filter;
        console.log(`Filter changed to: ${currentFilter}`);
        // TODO: Implement filtering when notes list is added
      });
    });
  }
}

/**
 * Sets up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    // Global shortcuts
    if (isCtrlOrCmd && e.key === "n") {
      e.preventDefault();
      createNewNote();
      console.log("New note created");
    }

    if (isCtrlOrCmd && e.key === "k") {
      e.preventDefault();
      const searchInput = document.getElementById("search-input");
      if (searchInput) {
        searchInput.focus();
        console.log("Search focused");
      }
    }

    if (isCtrlOrCmd && e.key === ",") {
      e.preventDefault();
      console.log("Settings shortcut pressed");
      // Settings will be implemented when settings UI is added
    }

    if (isCtrlOrCmd && e.key === "e" && currentOpenNote) {
      e.preventDefault();
      console.log("Edit shortcut pressed");
      // Edit functionality will be implemented when editor UI is added
    }

    if (e.key === "Escape") {
      console.log("Escape pressed");
      // Escape handling will be implemented when editor UI is added
    }

    // Navigation shortcuts
    if (isCtrlOrCmd && isShift) {
      switch (e.key) {
        case "F":
          e.preventDefault();
          toggleFavorite(currentOpenNote?.id);
          showToast(
            currentOpenNote?.isFavorite
              ? "Removed from favorites"
              : "Added to favorites"
          );
          break;
        case "A":
          e.preventDefault();
          archiveNote(currentOpenNote?.id);
          console.log("Note archived");
          break;
        case "V":
          e.preventDefault();
          startQuickCapture();
          break;
      }
    }

    // Quick actions with Alt key
    if (isAlt) {
      switch (e.key) {
        case "1":
          e.preventDefault();
          switchView("all-notes");
          console.log("All notes view");
          break;
        case "2":
          e.preventDefault();
          switchView("favorites");
          console.log("Switched to favorites view");
          break;
        case "3":
          e.preventDefault();
          switchView("recent");
          console.log("Switched to recent notes view");
          break;
      }
    }
  });

  // Global click listener (placeholder for future functionality)
  document.addEventListener("click", (e) => {
    // Global click handling will be implemented when UI is added
  });
}

/**
 * Handles editor-specific keyboard shortcuts
 */
function handleEditorShortcuts(e) {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey;

  if (isCtrlOrCmd && e.key === "s") {
    e.preventDefault();
    console.log("Save shortcut pressed");
    // Save functionality will be implemented when editor UI is added
  }

  // Editor formatting shortcuts will be implemented when rich text editor is added
  console.log(`Editor shortcut: ${isCtrlOrCmd ? "Ctrl+" : ""}${e.key}`);
}

/**
 * Shows a toast notification
 */
function showToast(message, duration = 2000) {
  console.log(`Toast: ${message}`);
  // Toast UI will be implemented when notification system is added
}

/**
 * Quick capture functionality
 */
function setupQuickCapture() {
  // Add quick capture button to sidebar footer
  const sidebarFooter = document.querySelector(".sidebar-footer");
  if (sidebarFooter) {
    const quickCaptureBtn = document.createElement("button");
    quickCaptureBtn.className = "quick-capture-btn";
    quickCaptureBtn.innerHTML = `
      <span class="iconify" data-icon="material-symbols:mic"></span>
      <span>Quick Capture</span>
    `;
    quickCaptureBtn.title = "Start voice note-taking (Ctrl+Shift+V)";
    quickCaptureBtn.addEventListener("click", startQuickCapture);

    sidebarFooter.insertBefore(quickCaptureBtn, sidebarFooter.firstChild);
  }
}

/**
 * Sets up mobile-specific features
 */
function setupMobileFeatures() {
  // Check if we're on a mobile device
  const isMobile =
    window.innerWidth <= 768 ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  if (isMobile) {
    // Add mobile-specific CSS class to body for styling
    document.body.classList.add("mobile-device");

    // Set up touch-friendly interactions
    setupTouchInteractions();

    // Adjust UI for mobile viewport
    adjustMobileViewport();
  }
}

/**
 * Sets up touch-friendly interactions for mobile devices
 */
function setupTouchInteractions() {
  // Add touch event listeners for better mobile UX
  let touchStartTime = 0;

  document.addEventListener(
    "touchstart",
    (e) => {
      touchStartTime = Date.now();
    },
    { passive: true }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      const touchDuration = Date.now() - touchStartTime;

      // If touch was very brief, it might be a tap
      if (touchDuration < 200) {
        // Add any mobile-specific tap handling here
      }
    },
    { passive: true }
  );

  // Prevent default zoom on double tap for certain elements
  const noZoomElements = document.querySelectorAll(
    ".note-card, .nav-item, button"
  );
  noZoomElements.forEach((element) => {
    element.addEventListener("touchend", (e) => {
      const now = Date.now();
      if (now - touchStartTime < 300) {
        e.preventDefault();
      }
    });
  });
}

/**
 * Adjusts UI elements for mobile viewport
 */
function adjustMobileViewport() {
  // Ensure proper viewport handling
  const viewport = document.querySelector("meta[name=viewport]");
  if (viewport) {
    viewport.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
  }

  // Add mobile-specific CSS if needed
  const mobileCSS = `
    .mobile-device .note-card {
      min-height: 120px;
    }
    .mobile-device .editor-toolbar {
      position: sticky;
      bottom: 0;
      background: var(--bg-primary);
      border-top: 1px solid var(--border-color);
    }
  `;

  const style = document.createElement("style");
  style.textContent = mobileCSS;
  document.head.appendChild(style);
}

/**
 * Starts quick capture mode
 */
async function startQuickCapture() {
  try {
    // Start ambient listening for dictation
    await startAmbientListening();
    console.log("Quick capture started - speak your thoughts!");

    // Set a timeout to stop listening after 30 seconds
    setTimeout(() => {
      if (
        voiceState === "DICTATION_MODE" ||
        voiceState === "AMBIENT_LISTENING"
      ) {
        stopAmbientListening();
        console.log("Quick capture ended");
      }
    }, 30000);
  } catch (error) {
    console.error("Error starting quick capture:", error);
    console.log("Failed to start quick capture");
  }
}

/**
 * Sets up rich text editor functionality
 */
function setupRichTextEditor() {
  const editor = document.getElementById("note-editor-content");
  if (!editor) return;

  // Auto-save functionality
  let autoSaveTimer = null;
  const autoSave = () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      if (currentOpenNote) {
        saveNoteFromEditor();
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  };

  // Format buttons
  document.querySelectorAll(".format-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const command = btn.dataset.command;
      const value = btn.dataset.value;

      if (command) {
        // Special handling for different commands
        switch (command) {
          case "insertImage":
            document.getElementById("image-input").click();
            break;
          case "createLink":
            const url = prompt("Enter URL:");
            if (url) {
              document.execCommand("createLink", false, url);
            }
            break;
          case "formatBlock":
            document.execCommand(command, false, `<${value}>`);
            break;
          default:
            document.execCommand(command, false, value);
        }

        editor.focus();
        updateToolbarState();
      }
    });
  });

  // Update word count and toolbar state on input
  editor.addEventListener("input", () => {
    const wordCount = getWordCount(editor.innerHTML);
    document.getElementById(
      "note-word-count"
    ).textContent = `${wordCount} words`;

    updateToolbarState();
    autoSave();
  });

  // Update toolbar state on selection change
  editor.addEventListener("keyup", updateToolbarState);
  editor.addEventListener("mouseup", updateToolbarState);

  // Handle paste events for images and text
  editor.addEventListener("paste", handlePasteInEditor);

  // Handle keyboard shortcuts
  editor.addEventListener("keydown", handleEditorKeydown);

  // Handle drag and drop for images
  editor.addEventListener("drop", handleDropInEditor);
  editor.addEventListener("dragover", (e) => e.preventDefault());
}

/**
 * Handles paste events in the editor
 */
function handlePasteInEditor(e) {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf("image") !== -1) {
      e.preventDefault();
      const file = items[i].getAsFile();
      insertImageInEditor(file);
      break;
    }
  }
}

/**
 * Updates toolbar button states based on current selection
 */
function updateToolbarState() {
  const buttons = document.querySelectorAll(".format-btn[data-command]");

  buttons.forEach((btn) => {
    const command = btn.dataset.command;
    if (command && document.queryCommandState) {
      try {
        const isActive = document.queryCommandState(command);
        btn.classList.toggle("active", isActive);
      } catch (e) {
        // Some commands may not be supported
      }
    }
  });
}

/**
 * Handles keyboard shortcuts in the editor
 */
function handleEditorKeydown(e) {
  // Bold: Ctrl/Cmd + B
  if ((e.ctrlKey || e.metaKey) && e.key === "b") {
    e.preventDefault();
    document.execCommand("bold");
    updateToolbarState();
  }

  // Italic: Ctrl/Cmd + I
  if ((e.ctrlKey || e.metaKey) && e.key === "i") {
    e.preventDefault();
    document.execCommand("italic");
    updateToolbarState();
  }

  // Underline: Ctrl/Cmd + U
  if ((e.ctrlKey || e.metaKey) && e.key === "u") {
    e.preventDefault();
    document.execCommand("underline");
    updateToolbarState();
  }

  // Save: Ctrl/Cmd + S
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    saveNoteFromEditor();
  }
}

/**
 * Handles drop events for images in the editor
 */
function handleDropInEditor(e) {
  e.preventDefault();

  const files = e.dataTransfer?.files;
  if (files && files[0] && files[0].type.startsWith("image/")) {
    insertImageInEditor(files[0]);
  }
}

/**
 * Inserts an image in the editor
 */
async function insertImageInEditor(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.createElement("img");
    img.src = e.target.result;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.borderRadius = "8px";
    img.style.margin = "1rem 0";

    // Add image caption placeholder
    const figure = document.createElement("figure");
    figure.appendChild(img);

    const caption = document.createElement("figcaption");
    caption.contentEditable = true;
    caption.textContent = "Add a caption...";
    caption.style.fontSize = "0.9rem";
    caption.style.color = "var(--text-secondary)";
    caption.style.fontStyle = "italic";
    caption.style.textAlign = "center";
    caption.style.marginTop = "0.5rem";

    figure.appendChild(caption);
    figure.style.margin = "1rem 0";

    const editor = document.getElementById("note-editor-content");
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    range.insertNode(figure);

    // Focus on caption for editing
    caption.focus();
  };
  reader.readAsDataURL(file);
}

/**
 * Updates toolbar based on current view
 */
function updateToolbarForView(view) {
  // Update view toggle button icon
  const viewToggle = document.getElementById("view-toggle");
  if (viewToggle) {
    const icon = viewToggle.querySelector(".iconify");
    if (icon) {
      icon.dataset.icon =
        view === "list"
          ? "material-symbols:grid-view"
          : "material-symbols:list";
    }
  }
}

/**
 * Updates sidebar note counts
 */
function updateSidebarCounts() {
  const allNotesCount = notes.length;
  const favoritesCount = notes.filter((note) => note.isFavorite).length;
  const archivedCount = notes.filter((note) => note.isArchived).length;

  console.log(
    `Sidebar counts - All: ${allNotesCount}, Favorites: ${favoritesCount}, Archived: ${archivedCount}`
  );

  // Sidebar UI will be implemented when navigation is added
}

/**
 * Updates the tags list in the sidebar
 */
function updateSidebarTags() {
  console.log(`Updating sidebar tags - Total tags: ${tags.length}`);
  // Tag list functionality will be implemented when sidebar UI is added
}

/**
 * Filters notes by a specific tag
 */
function filterByTag(tagId) {
  currentFilter = `tag:${tagId}`;
  console.log(`Filtering by tag: ${tagId}`);
  // Tag filtering will be implemented when notes list UI is added
}

/**
 * Sets up all the primary event listeners for the application.
 */
function setupEventListeners() {
  const actionBar = document.querySelector(".action-bar");
  const micButton = document.getElementById("mic-button");

  const searchInput = view.searchInputEl && view.searchInputEl();
  if (searchInput && actionBar) {
    searchInput.addEventListener("focus", () =>
      actionBar.classList.add("is-focused")
    );
    searchInput.addEventListener("blur", () => {
      if (searchInput.textContent.trim() === "") {
        actionBar.classList.remove("is-focused");
      }
    });
    searchInput.addEventListener("input", handleSearchInput);
  }

  if (micButton) {
    micButton.addEventListener("click", handleMicButtonClick);
  }

  // Note: Edit/delete functionality will be added when notes editor is implemented

  // Settings listeners
  document
    .getElementById("settings-btn")
    .addEventListener("click", () => showSettingsModal(true));

  // Initialize settings view
  initSettingsView();

  // Image listeners
  const addImageBtn = document.getElementById("add-image-btn");
  if (addImageBtn) {
    addImageBtn.addEventListener("click", () =>
      document.getElementById("image-input").click()
    );
  }

  document
    .getElementById("image-input")
    .addEventListener("change", handleImageUpload);

  // Use event delegation for dynamically created elements
  // This handles all dynamically created buttons in settings modal and other areas
  document.addEventListener("click", (e) => {
    const target = e.target;

    // Export buttons (dynamically created in settings modal)
    if (target.id === "export-json-btn") {
      handleExport("json");
    } else if (target.id === "export-txt-btn") {
      handleExport("txt");
    } else if (target.id === "export-pdf-btn") {
      handleExport("pdf");
    }

    // Import buttons (dynamically created in settings modal)
    else if (target.id === "import-file-btn") {
      const importInput = document.getElementById("import-file-input");
      if (importInput) importInput.click();
    } else if (target.id === "confirm-import-btn") {
      handleConfirmImport();
    } else if (target.id === "cancel-import-btn") {
      handleCancelImport();
    }

    // Goals buttons (dynamically created in goals modal)
    else if (target.id === "view-goals-btn") {
      showGoalsModal();
    } else if (target.id === "add-goal-btn") {
      showGoalsModal(true);
    } else if (target.id === "goals-close-btn") {
      hideGoalsModal();
    } else if (target.id === "add-new-goal-btn") {
      showGoalForm();
    } else if (target.id === "cancel-goal-btn") {
      hideGoalForm();
    }
  });

  // Form submit event delegation
  document.addEventListener("submit", (e) => {
    if (e.target.id === "goal-form-element") {
      handleGoalFormSubmit(e, notes);
    }
  });

  // Form change event delegation
  document.addEventListener("change", (e) => {
    if (e.target.id === "goal-type-select") {
      handleGoalTypeChange();
    } else if (e.target.id === "import-file-input") {
      handleImportFileSelect(e);
    }
  });
}

/**
 * Sets up event listeners for component communication
 */
function setupComponentEventListeners() {}

/**
 * Handles clicks on note cards to open the note editor.
 * @param {Event} event - The click event.
 */
function handleCardClick(event) {
  const cardEl = event.target.closest(".note-card");
  if (cardEl) {
    const noteId = cardEl.dataset.noteId;
    currentOpenNote = notes.find((note) => note.id === noteId);
    if (currentOpenNote) {
      // Open note in editor
      openNoteInEditor(noteId);
      setAppContext({ view: "editor", openNoteId: currentOpenNote.id });
    }
  }
}

/**
 * Handles state changes from the AI service to update the UI.
 * @param {string} state - The new AI state (e.g., 'listening', 'processing').
 */
function handleAIStateChange(state) {
  view.setMicButtonState(state);
  const isBusy = ["listening", "hearing", "capturing", "processing"].includes(
    state
  );
  view.setHeaderListeningState(isBusy);
}

/**
 * Updates the search input with the live transcript from the AI service.
 * @param {string} transcript - The interim transcript.
 */
function handleAITranscriptUpdate(transcript) {
  const searchInput = view.searchInputEl && view.searchInputEl();
  if (searchInput) {
    searchInput.textContent = transcript;
  }
  document.querySelector(".action-bar").classList.add("is-focused");
}

/**
 * Processes the final formatted text from the AI service with optional audio.
 * @param {string} formattedText - The final, cleaned-up note content.
 */
async function handleAIFinalResult(formattedText) {
  const searchInput = view.searchInputEl && view.searchInputEl();
  if (searchInput) {
    searchInput.textContent = "";
  }
  document.querySelector(".action-bar").classList.remove("is-focused");
  if (!formattedText) return;

  try {
    view.setHeaderListeningState(true); // Show processing state

    // Use optimized AI processing
    let title = "New Entry";
    let oneLiner = "A new note was created.";

    try {
      // AI Task 1: Generate a short, creative title for the card.
      const titlePrompt = `Create a short, creative title (1-5 words) for the following note. Note: "${formattedText}"`;
      const titleResult = await chrome.ai.prompt({ prompt: titlePrompt });
      title = cleanAIResponse(titleResult.text).replace(/"/g, "");

      // AI Task 2: Generate a single, descriptive sentence for the card snippet.
      const oneLinerPrompt = `Generate a single, descriptive sentence summarizing the following note. Be concise. Note: "${formattedText}"`;
      const oneLinerResult = await chrome.ai.prompt({ prompt: oneLinerPrompt });
      oneLiner = cleanAIResponse(oneLinerResult.text);
    } catch (aiError) {
      console.warn("AI processing failed, using fallback:", aiError);
      // Fallback will use the default values set above
    }

    // Save the new note to the database.
    const newNote = await store.addNote(
      `<p>${formattedText.replace(/\n/g, "</p><p>")}</p>`,
      title,
      oneLiner
    );

    // Store audio recording if available
    if (currentRecordingData) {
      try {
        await storeAudioData(newNote.id, currentRecordingData);
        console.log("Audio recording saved for entry:", newNote.id);
      } catch (error) {
        console.error("Failed to save audio recording:", error);
      }
      currentRecordingData = null; // Clear after saving
    }

    // Update the local state and use efficient UI update:
    notes.unshift(newNote);
    await view.prependCard(newNote);
  } catch (error) {
    console.error("Error creating note with AI summary:", error);
    // Fallback if AI fails, to ensure the user's entry is not lost.
    const newNote = await store.addNote(
      `<p>${formattedText.replace(/\n/g, "</p><p>")}</p>`,
      "Untitled Entry",
      "A new note was saved."
    );

    // Store audio even if AI processing fails
    if (currentRecordingData) {
      try {
        await storeAudioData(newNote.id, currentRecordingData);
      } catch (audioError) {
        console.error("Failed to save audio recording:", audioError);
      }
      currentRecordingData = null;
    }

    notes.unshift(newNote);
    await view.prependCard(newNote);
  } finally {
    view.setHeaderListeningState(false);
    hideRecordingIndicator();
  }
}

/**
 * Handles search input with debouncing and suggestions
 */
async function handleSearch() {
  const searchInput = document.getElementById("search-input");
  const query = searchInput?.textContent?.trim();

  if (!query) {
    await updateNotesList();
    return;
  }

  await updateNotesList();
}

/**
 * Debounce utility function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Toggles between grid and list view modes
 */
function toggleViewMode() {
  const notesList = document.getElementById("notes-list");
  const isGrid = notesList.classList.contains("grid-view");

  if (isGrid) {
    notesList.classList.remove("grid-view");
    notesList.classList.add("list-view");
  } else {
    notesList.classList.remove("list-view");
    notesList.classList.add("grid-view");
  }

  // Update button icon
  const viewToggle = document.getElementById("view-toggle");
  if (viewToggle) {
    const icon = viewToggle.querySelector(".iconify");
    if (icon) {
      icon.dataset.icon = isGrid
        ? "material-symbols:grid-view"
        : "material-symbols:list";
    }
  }
}

/**
 * Shows sort options dropdown
 */
function showSortOptions() {
  // Simple implementation - cycle through sort options
  const sortOptions = ["dateModified", "dateCreated", "title"];
  const currentIndex = sortOptions.indexOf(currentSort);
  const nextIndex = (currentIndex + 1) % sortOptions.length;
  currentSort = sortOptions[nextIndex];

  // Update sort button text
  const sortBtn = document.getElementById("sort-btn");
  if (sortBtn) {
    const sortTexts = {
      dateModified: "Date Modified",
      dateCreated: "Date Created",
      title: "Title",
    };
    sortBtn.querySelector(".sort-text").textContent = sortTexts[currentSort];
  }

  // Re-render notes list
  updateNotesList();
}

/**
 * Closes the note editor
 */
function closeEditor() {
  const editor = document.getElementById("note-editor");
  if (editor) {
    editor.classList.add("hidden");
    currentOpenNote = null;
  }
}

/**
 * Saves the current note from the editor
 */
async function saveNoteFromEditor() {
  if (!currentOpenNote) return;

  const titleInput = document.getElementById("editor-note-title");
  const contentEditor = document.getElementById("note-editor-content");

  const newTitle = titleInput.value.trim() || "Untitled";
  const newContent = contentEditor.innerHTML.trim();

  if (
    newContent === currentOpenNote.content &&
    newTitle === currentOpenNote.summary
  ) {
    closeEditor();
    return;
  }

  updateEditorState("saving");

  try {
    // Update note
    currentOpenNote.summary = newTitle;
    currentOpenNote.content = newContent;
    currentOpenNote.updatedAt = new Date().toISOString();

    await store.updateNote(currentOpenNote);

    // Update in local array
    const index = notes.findIndex((n) => n.id === currentOpenNote.id);
    if (index !== -1) {
      notes[index] = currentOpenNote;
    }

    // Update notes list
    await updateNotesList();

    // Close editor
    closeEditor();
  } catch (error) {
    console.error("Error saving note:", error);
    updateEditorState("error");
  }
}

/**
 * Edits a note (placeholder function)
 */
async function editNote(noteId) {
  openNoteInEditor(noteId);
}

/**
 * Deletes a note (placeholder function)
 */
async function deleteNote(noteId) {
  const confirmed = confirm("Are you sure you want to delete this note?");
  if (!confirmed) return;

  try {
    await store.deleteNote(noteId);
    notes = notes.filter((n) => n.id !== noteId);
    await updateNotesList();

    // Close editor if this note was open
    if (currentOpenNote && currentOpenNote.id === noteId) {
      closeEditor();
    }
  } catch (error) {
    console.error("Error deleting note:", error);
  }
}

/**
 * Handles user input in the search bar to filter notes.
 */
async function handleSearchInput() {
  const searchInput = view.searchInputEl && view.searchInputEl();
  const query = searchInput ? searchInput.textContent.trim() : "";

  // If the query is empty, clear search state
  if (query === "") {
    console.log("Search cleared");
    return;
  }

  // For short queries, provide basic feedback
  if (query.length <= 2) {
    console.log(`Searching for: ${query}`);
    return;
  }

  // Debounce longer searches
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    console.log(`Searching for: ${query}`);
    // Search functionality will be implemented when notes list is added
  }, 250);
}

/**
 * Search function placeholder - will be implemented when notes list is added
 * @param {string} query - The user's search query.
 */
async function filterNotes(query) {
  console.log(`Search functionality will be implemented for query: ${query}`);
  // TODO: Implement search when notes list UI is added
}

/**
 * Search functions will be implemented when notes list UI is added
 */
async function performOptimizedTextSearch(query) {
  console.log(`Text search will be implemented for query: ${query}`);
  return [];
}

async function performOptimizedAISearch(query) {
  console.log(`AI search will be implemented for query: ${query}`);
  return [];
}

// --- Edit/Delete Handlers ---

function handleEditClick() {
  // Edit functionality will be implemented with note editor
  console.log("Edit clicked for note:", currentOpenNote?.id);
}

async function handleSaveClick() {
  // Save functionality will be implemented with note editor
  console.log("Save clicked");
}

async function handleDeleteClick() {
  const confirmed = await view.showConfirmation(
    "Delete Note",
    "Are you sure you want to permanently delete this note? This action cannot be undone."
  );

  if (confirmed && currentOpenNote) {
    await store.deleteNote(currentOpenNote.id);
    notes = notes.filter((note) => note.id !== currentOpenNote.id);
    closeEditor();
    await updateNotesList();
  }
}

// --- Application Context Manager ---
function setAppContext(newContext) {
  appContext = { ...appContext, ...newContext };
  console.log("App context updated:", appContext);
}

function closeEditorAndResetContext() {
  closeEditor();
  setAppContext({ view: "notes", openNoteId: null });
}

// --- Command Dispatcher ---
function onAICommand(command) {
  // Handle unknown commands
  if (command.action === "unknown") {
    view.showCommandNotUnderstood();
    return;
  }

  // Show command understood feedback before executing
  let feedbackMessage = "";
  switch (command.action) {
    case "search_notes":
      feedbackMessage = `Searching for "${command.params.query}"...`;
      break;
    case "go_back":
      feedbackMessage = "Going back...";
      break;
    case "delete_current":
      feedbackMessage = "Deleting entry...";
      break;
    case "edit_current":
      feedbackMessage = "Opening edit mode...";
      break;
    case "add_image":
      feedbackMessage = "Adding image...";
      break;
    case "stop_listening":
      feedbackMessage = "Stopping voice control...";
      break;
    default:
      feedbackMessage = "Processing command...";
  }

  if (feedbackMessage) {
    view.showCommandUnderstood(feedbackMessage);
  }

  // Execute the command after a brief delay to show feedback
  setTimeout(() => {
    executeCommand(command);
  }, 300);
}

function executeCommand(command) {
  switch (command.action) {
    case "search_notes":
      const searchInput = view.searchInputEl && view.searchInputEl();
      if (searchInput) {
        searchInput.textContent = command.params.query;
      }
      filterNotes(command.params.query);
      break;
    case "go_back":
      if (appContext.view === "editor") closeEditorAndResetContext();
      break;
    case "delete_current":
      if (appContext.view === "editor") handleDeleteClick();
      break;
    case "edit_current":
      if (appContext.view === "editor") handleEditClick();
      break;
    case "add_image":
      if (appContext.view === "reader")
        document.getElementById("image-input").click();
      break;
    case "stop_listening":
      stopAmbientListening();
      view.setHandsFreeMode(false);
      break;
  }
}

function handleMicButtonClick() {
  if (getHandsFreeMode()) {
    // In hands-free mode, toggle ambient listening
    if (voiceState === "AMBIENT_LISTENING" || voiceState === "COMMAND_MODE") {
      stopAmbientListening();
    } else {
      startAmbientListening();
    }
  } else {
    // In traditional mode, start dictation (old behavior)
    if (voiceState === "IDLE") {
      startAmbientListening(); // This will trigger intent detection for dictation
    }
  }
}

function initAI() {
  const callbacks = {
    onStateChange: onAIStateChange,
    onCommandReceived: onAICommand,
    onTranscriptUpdate: (t) => {
      const searchInput = view.searchInputEl && view.searchInputEl();
      if (searchInput) {
        searchInput.textContent = t;
      }
    },
    onFinalResult: handleAIFinalResult,
  };
  initAIService(callbacks);
  setHandsFreeMode(getHandsFreeMode()); // Sync toggle on startup
}

// --- Image Handling ---
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const imageDataUrl = e.target.result;
    view.setHeaderListeningState(true); // Show processing state

    try {
      // Check if multimodal AI is available
      if (chrome?.ai?.prompt) {
        // Use Multimodal AI to generate a caption
        const captionResult = await chrome.ai.prompt({
          prompt: `Describe this image for a personal note.`,
          image: { data: imageDataUrl },
        });
        view.insertImage(imageDataUrl, cleanAIResponse(captionResult.text));
      } else {
        console.warn(
          "Chrome AI API not available for image captioning, using fallback"
        );
        // Fallback to a generic caption
        view.insertImage(imageDataUrl, "A captured moment.");
      }
    } catch (error) {
      console.error("AI captioning failed:", error);
      // Fallback to a generic caption
      view.insertImage(imageDataUrl, "A captured moment.");
    } finally {
      view.setHeaderListeningState(false);
      event.target.value = ""; // Reset input for next upload
    }
  };
  reader.readAsDataURL(file);
}

// Start the application once the DOM is loaded.
document.addEventListener("DOMContentLoaded", () => {
  console.log("📱 DOM loaded, showing loading overlay...");
  // Show loading immediately when DOM is ready
  showAppLoading();
  console.log("🚀 Starting initialization...");
  // Then start initialization
  init();
});

// --- Export System Handlers ---

/**
 * Handles export button clicks
 * @param {string} format - Export format (json, txt, pdf)
 */
async function handleExport(format) {
  const exportBtn = document.getElementById(`export-${format}-btn`);

  try {
    // Show loading state
    exportBtn.classList.add("loading");
    exportBtn.disabled = true;

    // Check if there are notes to export
    if (notes.length === 0) {
      throw new Error("No notes to export");
    }

    // Perform export with error handling
    const result = await safeExportImport.exportNotes(notes, format);

    if (result.success) {
      // Show success feedback
      const originalText = exportBtn.textContent;
      exportBtn.textContent = `✅ Exported!`;

      setTimeout(() => {
        exportBtn.textContent = originalText;
      }, 2000);

      console.log(
        `Successfully exported ${notes.length} notes as ${format.toUpperCase()}`
      );
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error(`Export failed:`, error);

    // Show error feedback on button
    const originalText = exportBtn.textContent;
    exportBtn.textContent = `❌ Failed`;

    setTimeout(() => {
      exportBtn.textContent = originalText;
    }, 3000);
  } finally {
    // Remove loading state
    exportBtn.classList.remove("loading");
    exportBtn.disabled = false;
  }
}

// --- Import System Handlers ---

let pendingImportData = null; // Store import data before confirmation

/**
 * Handles file selection for import
 */
async function handleImportFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const importStatus = document.getElementById("import-status");
  const importPreview = importStatus.querySelector(".import-preview");

  try {
    // Show loading state
    importPreview.innerHTML =
      '<div class="import-info">🔄 Analyzing file...</div>';
    importStatus.classList.remove("hidden");

    // Validate file
    if (file.size > 10 * 1024 * 1024) {
      // 10MB limit
      throw new Error(
        "File too large. Please select a file smaller than 10MB."
      );
    }

    // Read and validate file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const validation = validateImportData(content);

        if (!validation.isValid) {
          throw new Error(
            validation.issues.join(", ") || "Invalid file format"
          );
        }

        // Store for later import
        pendingImportData = { file, content, validation };

        // Show preview
        showImportPreview(file, validation);
      } catch (error) {
        showImportError(error.message);
      }
    };

    reader.onerror = () => {
      showImportError("Failed to read file");
    };

    reader.readAsText(file);
  } catch (error) {
    showImportError(error.message);
  }

  // Reset file input
  event.target.value = "";
}

/**
 * Shows import preview with file details
 */
function showImportPreview(file, validation) {
  const importPreview = document.querySelector(".import-preview");

  const fileSize = (file.size / 1024).toFixed(1);
  const formatIcon = validation.format === "json" ? "📄" : "📝";

  importPreview.innerHTML = `
        <div class="import-info">
            ${formatIcon} <strong>${file.name}</strong> (${fileSize} KB)
        </div>
        <div class="import-info">
            Format: ${validation.format.toUpperCase()} • Entries found: ${
    validation.entriesCount
  }
        </div>
        ${
          notes.length > 0
            ? `
            <div class="import-warning">
                ⚠️ This will add ${validation.entriesCount} notes to your existing ${notes.length} notes. 
                Consider exporting a backup first.
            </div>
        `
            : ""
        }
    `;
}

/**
 * Shows import error message
 */
function showImportError(errorMessage) {
  const importPreview = document.querySelector(".import-preview");
  importPreview.innerHTML = `
        <div class="import-warning">
            ❌ Import Error: ${errorMessage}
        </div>
    `;

  // Hide action buttons
  document.querySelector(".import-actions").style.display = "none";

  // Auto-hide after 5 seconds
  setTimeout(() => {
    handleCancelImport();
  }, 5000);
}

/**
 * Handles import confirmation
 */
async function handleConfirmImport() {
  if (!pendingImportData) return;

  const confirmBtn = document.getElementById("confirm-import-btn");
  const cancelBtn = document.getElementById("cancel-import-btn");
  const importPreview = document.querySelector(".import-preview");

  try {
    // Show loading state
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "⏳ Importing...";

    // Add progress bar
    const progressHtml = `
            <div class="import-progress">
                <div class="import-progress-bar" id="import-progress-bar"></div>
            </div>
        `;
    importPreview.insertAdjacentHTML("beforeend", progressHtml);

    // Perform import
    const result = await importFromFile(pendingImportData.file);

    // Update progress
    const progressBar = document.getElementById("import-progress-bar");
    if (progressBar) progressBar.style.width = "100%";

    if (result.success) {
      // Update local notes array
      const newNotes = await store.getNotes();
      notes.length = 0;
      notes.push(...newNotes);

      // Refresh UI
      await view.renderBookshelf(notes);

      // Show success message
      importPreview.innerHTML = `
                <div class="import-info" style="color: #28a745; font-weight: 500;">
                    ✅ Successfully imported ${result.imported} of ${
        result.total
      } notes!
                </div>
                ${
                  result.errors
                    ? `
                    <div class="import-info" style="color: #ff9500;">
                        ⚠️ ${result.errors.length} notes had issues but import continued.
                    </div>
                `
                    : ""
                }
            `;

      // Auto-close after success
      setTimeout(() => {
        handleCancelImport();
      }, 3000);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error("Import failed:", error);
    showImportError(error.message);
  } finally {
    confirmBtn.disabled = false;
    cancelBtn.disabled = false;
    confirmBtn.textContent = "✅ Import";
  }
}

/**
 * Handles import cancellation
 */
function handleCancelImport() {
  const importStatus = document.getElementById("import-status");
  importStatus.classList.add("hidden");

  // Reset state
  pendingImportData = null;

  // Reset buttons
  const confirmBtn = document.getElementById("confirm-import-btn");
  const cancelBtn = document.getElementById("cancel-import-btn");
  confirmBtn.textContent = "✅ Import";
  confirmBtn.disabled = false;
  cancelBtn.disabled = false;

  // Show action buttons again
  document.querySelector(".import-actions").style.display = "flex";
}

// --- Audio Recording System ---

/**
 * Shows the recording indicator with timer
 */
function showRecordingIndicator() {
  const indicator = document.getElementById("recording-indicator");
  const timeDisplay = document.getElementById("recording-time");

  indicator.classList.remove("hidden");

  let startTime = Date.now();
  recordingTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    timeDisplay.textContent = `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }, 1000);
}

/**
 * Hides the recording indicator and clears timer
 */
function hideRecordingIndicator() {
  const indicator = document.getElementById("recording-indicator");
  indicator.classList.add("hidden");

  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }

  // Reset display
  document.getElementById("recording-time").textContent = "0:00";
}

/**
 * Enhanced voice state change handler with audio recording
 */
function onAIStateChange(newState) {
  // Update global voice state for mic button logic
  voiceState = newState;

  // Handle audio recording based on state
  if (newState === "DICTATION_MODE") {
    // Start audio recording when dictation begins
    startRecording().then((success) => {
      if (success) {
        showRecordingIndicator();
        console.log("Audio recording started");
      } else {
        console.warn("Failed to start audio recording");
      }
    });
  } else if (voiceState === "DICTATION_MODE" && newState !== "DICTATION_MODE") {
    // Stop audio recording when leaving dictation mode
    stopRecording().then((audioData) => {
      hideRecordingIndicator();
      if (audioData) {
        currentRecordingData = audioData;
        console.log(
          "Audio recording completed:",
          formatDuration(audioData.duration / 1000)
        );
      }
    });
  }

  // Pass state to UI for indicator
  view.setAmbientIndicatorState(newState);

  // Update main mic button to reflect dictation state
  if (newState === "DICTATION_MODE") {
    view.setMicButtonState("capturing");
  } else if (newState === "IDLE") {
    view.setMicButtonState("idle");
  } else {
    view.setMicButtonState("listening");
  }
}

// Performance optimizations: Cleanup AI sessions when page unloads
window.addEventListener("beforeunload", () => {
  try {
    destroyAISession();
    console.log("AI sessions cleaned up on page unload");
  } catch (error) {
    console.warn("Error during AI session cleanup:", error);
  }
});

// Performance optimization: Preload critical AI functions on idle
window.addEventListener("load", () => {
  // Use requestIdleCallback to preload AI capabilities when browser is idle
  if (window.requestIdleCallback) {
    requestIdleCallback(() => {
      try {
        // Pre-warm AI sessions in the background for better responsiveness
        analyzeSentiment("test").catch(() => {}); // Silent fail is ok for preload
      } catch (error) {
        // Silent fail - this is just performance optimization
      }
    });
  }
});

// Enable hot module replacement for development
if (import.meta.hot) {
  import.meta.hot.accept();
}
