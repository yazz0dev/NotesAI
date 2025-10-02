import * as store from "./core/store.js";
import * as view from "./view.js";
import {
  initAIService,
  startAmbientListening,
  stopAmbientListening,
} from "./services/ai-service.js";
import {
  findThematicConnections,
  generateMoodInsights,
  extractTopics,
  analyzeSentiment,
} from "./services/ai-insights.js";
import { exportJournal } from "./services/export-service.js";
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
} from "./services/audio-service.js";
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
let appContext = { view: "bookshelf", openNoteId: null };
let searchTimeout = null;
// NEW: Voice state tracking for mic button logic
let voiceState = "IDLE";
let currentRecordingData = null; // Store audio recording data
let recordingTimer = null; // Timer for recording duration display

/**
 * Initializes the application.
 */
async function init() {
  console.log("🚀 Initializing AI Journal with error handling...");

  try {
    view.initCalendar();

    // Initialize database with error handling
    await withErrorHandling(() => store.initDB(), {
      type: ERROR_TYPES.STORAGE,
      severity: ERROR_SEVERITY.CRITICAL,
      context: { operation: "initDB" },
    });

    // Load notes with error handling
    notes = await safeStore.loadNotes();

    // Clear the container before the initial render
    document.getElementById("bookshelf-container").innerHTML = "";
    await view.renderBookshelf(notes);

    setupEventListeners();
    setupComponentEventListeners(); // New component communication
    initAI();

    // Initialize audio service with error handling
    await withErrorHandling(() => initAudioService(), {
      type: ERROR_TYPES.AUDIO,
      severity: ERROR_SEVERITY.MEDIUM,
      context: { operation: "initAudioService" },
    });

    schedulePeelAnimation(); // Start the random animation loop
    checkForOnThisDayMemories(); // Check for memories on startup
    await checkGoalsDueToday(); // Check for goals due today

    // Auto-start ambient listening if user enabled it previously
    if (getHandsFreeMode()) {
      await withErrorHandling(() => startAmbientListening(), {
        type: ERROR_TYPES.PERMISSION,
        severity: ERROR_SEVERITY.MEDIUM,
        context: { operation: "startAmbientListening" },
      });
    }

    console.log("✅ AI Journal initialized successfully");
  } catch (error) {
    errorHandler.handleError({
      type: ERROR_TYPES.UNKNOWN,
      severity: ERROR_SEVERITY.CRITICAL,
      message: `Failed to initialize application: ${error.message}`,
      userMessage:
        "Failed to start the application. Please refresh the page and try again.",
      context: { operation: "init" },
    });
  }

  console.log("App ready.");
}

/**
 * Sets up all the primary event listeners for the application.
 */
function setupEventListeners() {
  const actionBar = document.querySelector(".action-bar");
  const micButton = document.getElementById("mic-button");

  view.searchInputEl.addEventListener("focus", () =>
    actionBar.classList.add("is-focused")
  );
  view.searchInputEl.addEventListener("blur", () => {
    if (view.searchInputEl.textContent.trim() === "") {
      actionBar.classList.remove("is-focused");
    }
  });

  micButton.addEventListener("click", handleMicButtonClick);
  view.searchInputEl.addEventListener("input", handleSearchInput);

  view.bookshelfContainerEl.addEventListener("click", handleCardClick);
  document
    .getElementById("close-viewer-btn")
    .addEventListener("click", () => view.closeBook());

  // Add new listeners for edit/delete
  document
    .getElementById("edit-btn")
    .addEventListener("click", handleEditClick);
  document
    .getElementById("save-btn")
    .addEventListener("click", handleSaveClick);
  document
    .getElementById("delete-btn")
    .addEventListener("click", handleDeleteClick);

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

  // Prompts listeners
  document
    .getElementById("prompts-btn")
    .addEventListener("click", handlePromptsClick);

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

    // Prompts refresh button (dynamically created)
    else if (target.id === "refresh-prompts-btn") {
      handleRefreshPrompts();
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
function setupComponentEventListeners() {
  // Listen for prompts loading requests from components
  window.addEventListener("loadPromptsRequested", async () => {
    const recentTopics = getRecentTopics();
    const sentiment = await getRecentSentiment();
    await view.loadDailyPrompts(recentTopics, sentiment);
  });

  // Listen for prompts refresh requests from components
  window.addEventListener("refreshPromptsRequested", async () => {
    const recentTopics = getRecentTopics();
    const sentiment = await getRecentSentiment();
    await view.refreshPrompts(recentTopics, sentiment);
  });
}

/**
 * Schedules the next calendar peel animation at a random interval for a subtle effect.
 */
function schedulePeelAnimation() {
  const minDelay = 8000; // 8 seconds
  const maxDelay = 20000; // 20 seconds
  const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;

  setTimeout(() => {
    view.triggerPeelAnimation();
    schedulePeelAnimation(); // Re-schedule the next one
  }, randomDelay);
}

/**
 * Handles clicks on journal cards to open the detailed reading view.
 * @param {Event} event - The click event.
 */
function handleCardClick(event) {
  const cardEl = event.target.closest(".journal-card");
  if (cardEl) {
    const noteId = cardEl.dataset.noteId;
    currentOpenNote = notes.find((note) => note.id === noteId);
    if (currentOpenNote) {
      view.openBook(currentOpenNote);
      setAppContext({ view: "reader", openNoteId: currentOpenNote.id });
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
  view.searchInputEl.textContent = transcript;
  document.querySelector(".action-bar").classList.add("is-focused");
}

/**
 * Processes the final formatted text from the AI service with optional audio.
 * @param {string} formattedText - The final, cleaned-up journal entry.
 */
async function handleAIFinalResult(formattedText) {
  view.searchInputEl.textContent = "";
  document.querySelector(".action-bar").classList.remove("is-focused");
  if (!formattedText) return;

  try {
    view.setHeaderListeningState(true); // Show processing state

    // Check if chrome.ai is available
    if (!chrome?.ai?.prompt) {
      console.warn(
        "Chrome AI API not available for entry processing, using fallback"
      );
      const title = "New Entry";
      const oneLiner = "A new journal entry was created.";
    } else {
      // AI Task 1: Generate a short, creative title for the card.
      const titlePrompt = `Create a short, creative title (1-5 words) for the following journal entry. Entry: "${formattedText}"`;
      const titleResult = await chrome.ai.prompt({ prompt: titlePrompt });
      const title = titleResult.text.trim().replace(/"/g, "");

      // AI Task 2: Generate a single, descriptive sentence for the card snippet.
      const oneLinerPrompt = `Generate a single, descriptive sentence summarizing the following journal entry. Be concise. Entry: "${formattedText}"`;
      const oneLinerResult = await chrome.ai.prompt({ prompt: oneLinerPrompt });
      const oneLiner = oneLinerResult.text.trim();
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
      "A new journal entry was saved."
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
 * Handles user input in the search bar to filter notes.
 */
async function handleSearchInput() {
  const query = view.searchInputEl.textContent.trim();
  // If the query is empty, render all notes.
  if (query === "") {
    document.getElementById("bookshelf-container").innerHTML = "";
    await view.renderBookshelf(notes);
    return;
  }
  // Debounce the search to avoid excessive AI calls.
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => filterNotes(query), 300);
}

/**
 * Uses the AI to filter notes based on a natural language query.
 * @param {string} query - The user's search query.
 */
async function filterNotes(query) {
  view.setHeaderListeningState(true);

  // Check if chrome.ai is available
  if (!chrome?.ai?.prompt) {
    console.warn(
      "Chrome AI API not available, falling back to simple text search"
    );
    // Fallback to simple text-based filtering
    const filteredNotes = notes.filter(
      (note) =>
        note.summary?.toLowerCase().includes(query.toLowerCase()) ||
        note.oneLiner?.toLowerCase().includes(query.toLowerCase()) ||
        note.content?.toLowerCase().includes(query.toLowerCase())
    );

    if (filteredNotes.length > 0) {
      await view.renderBookshelf(filteredNotes);
    } else {
      view.showEmptySearchState(query);
    }
    view.setHeaderListeningState(false);
    return;
  }

  const promises = notes.map((note) => {
    const prompt = `Does the user's search query "${query}" relate to a journal entry with the title: "${note.summary}"? Respond with only "YES" or "NO".`;
    return chrome.ai
      .prompt({ prompt })
      .then((result) => {
        return result.text.trim().toUpperCase() === "YES" ? note : null;
      })
      .catch(() => null); // Ignore errors for individual prompts
  });

  const filteredResults = await Promise.all(promises);
  const matchingNotes = filteredResults.filter((note) => note !== null);

  // Update to handle empty state
  if (matchingNotes.length > 0) {
    await view.renderBookshelf(matchingNotes);
  } else {
    view.showEmptySearchState(query);
  }
  view.setHeaderListeningState(false);
}

// --- New Edit/Delete Handlers ---

function handleEditClick() {
  view.toggleEditMode(true);
}

async function handleSaveClick() {
  const newContent = view.getEditedContent();
  if (currentOpenNote && currentOpenNote.content !== newContent) {
    currentOpenNote.content = newContent;

    // Also update summary and one-liner with AI
    view.setHeaderListeningState(true);

    if (chrome?.ai?.prompt) {
      const titlePrompt = `Create a short, creative title (1-5 words) for the entry: "${newContent}"`;
      const titleResult = await chrome.ai.prompt({ prompt: titlePrompt });
      currentOpenNote.summary = titleResult.text.trim().replace(/"/g, "");

      const oneLinerPrompt = `Generate a single, descriptive sentence for the entry: "${newContent}"`;
      const oneLinerResult = await chrome.ai.prompt({ prompt: oneLinerPrompt });
      currentOpenNote.oneLiner = oneLinerResult.text.trim();
    } else {
      console.warn(
        "Chrome AI API not available for save operation, using fallback"
      );
      // Generate simple fallback titles
      currentOpenNote.summary = "Updated Entry";
      currentOpenNote.oneLiner = "This journal entry has been modified.";
    }

    view.setHeaderListeningState(false);

    const updatedNote = await store.updateNote(currentOpenNote);

    // Update the note in the main array
    const index = notes.findIndex((note) => note.id === updatedNote.id);
    if (index !== -1) notes[index] = updatedNote;

    // Re-render the whole bookshelf to reflect the changes
    await view.renderBookshelf(notes);
  }
  view.toggleEditMode(false);
}

async function handleDeleteClick() {
  const confirmed = await view.showConfirmation(
    "Delete Entry",
    "Are you sure you want to permanently delete this journal entry? This action cannot be undone."
  );

  if (confirmed && currentOpenNote) {
    await store.deleteNote(currentOpenNote.id);
    notes = notes.filter((note) => note.id !== currentOpenNote.id);
    view.closeBook();
    await view.renderBookshelf(notes);
  }
}

/**
 * Enhanced "On This Day" - finds thematically related entries, not just same dates
 */
async function checkForOnThisDayMemories() {
  try {
    view.renderOnThisDay(null, "loading");
    const today = new Date();

    // First try traditional same-date entries
    const pastNotes = await store.getNotesByDate(
      today.getMonth(),
      today.getDate()
    );
    let memoriesToShow = pastNotes;
    let memoryType = "same_date";

    // If no same-date entries, find thematically related entries from recent entries
    if (pastNotes.length === 0 && notes.length > 0) {
      // Get recent entries to find thematic connections
      const recentEntries = notes.slice(0, Math.min(5, notes.length));
      if (recentEntries.length > 0) {
        const thematicConnections = await findThematicConnections(
          notes,
          recentEntries[0]
        );
        if (thematicConnections.length > 0) {
          memoriesToShow = thematicConnections.slice(0, 2); // Show top 2 thematic matches
          memoryType = "thematic";
        }
      }
    }

    if (memoriesToShow.length > 0) {
      const combinedContent = memoriesToShow
        .map((note) => {
          // Strip HTML for better summarization
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = note.content;
          return tempDiv.textContent || tempDiv.innerText || "";
        })
        .join("\n\n");

      let summaryText = "";
      if (chrome?.ai?.summarize) {
        const summaryResult = await chrome.ai.summarize({
          text: combinedContent,
        });
        summaryText = summaryResult.text;
      } else {
        console.warn("Chrome AI Summarize API not available, using fallback");
        // Create a simple summary from the first note's content
        const firstNoteContent =
          memoriesToShow[0].content.replace(/<[^>]*>/g, "").substring(0, 100) +
          "...";
        summaryText = firstNoteContent;
      }

      // Add context based on memory type
      const contextPrefix =
        memoryType === "same_date"
          ? `From ${memoriesToShow.length} year(s) ago: `
          : `Related to your recent thoughts: `;

      view.renderOnThisDay(contextPrefix + summaryText, "success");
    } else {
      view.renderOnThisDay(null, "empty");
    }
  } catch (error) {
    console.error("Error checking for 'On This Day' memories:", error);
    view.renderOnThisDay(null, "empty"); // Hide on error
  }
}

// --- Application Context Manager ---
function setAppContext(newContext) {
  appContext = { ...appContext, ...newContext };
  console.log("App context updated:", appContext);
}

function closeBookAndResetContext() {
  view.closeBook();
  setAppContext({ view: "bookshelf", openNoteId: null });
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
      view.searchInputEl.textContent = command.params.query;
      filterNotes(command.params.query);
      break;
    case "go_back":
      if (appContext.view === "reader") closeBookAndResetContext();
      break;
    case "delete_current":
      if (appContext.view === "reader") handleDeleteClick();
      break;
    case "edit_current":
      if (appContext.view === "reader") handleEditClick();
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
    onTranscriptUpdate: (t) => (view.searchInputEl.textContent = t),
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
          prompt: `Describe this image for a personal journal entry.`,
          image: { data: imageDataUrl },
        });
        view.insertImage(imageDataUrl, captionResult.text.trim());
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
document.addEventListener("DOMContentLoaded", init);

// --- Prompts System Handlers ---

/**
 * Handles the prompts button click to show/hide prompts widget
 */
async function handlePromptsClick() {
  const isCurrentlyVisible = !document
    .getElementById("daily-prompts-widget")
    .classList.contains("hidden");

  if (isCurrentlyVisible) {
    view.showPromptsWidget(false);
  } else {
    // Get recent topics from the latest entries for context
    const recentTopics = await getRecentTopics();

    // Determine current sentiment based on recent entries
    const recentSentiment = await getRecentSentiment();

    await view.loadDailyPrompts(recentTopics, recentSentiment);
  }
}

/**
 * Handles refresh prompts button click
 */
async function handleRefreshPrompts() {
  const refreshBtn = document.getElementById("refresh-prompts-btn");
  if (refreshBtn) {
    refreshBtn.style.animation = "spin 0.5s ease-in-out";
    setTimeout(() => {
      refreshBtn.style.animation = "";
    }, 500);
  }

  // Get fresh context and regenerate prompts
  const recentTopics = await getRecentTopics();
  const recentSentiment = await getRecentSentiment();

  await view.loadDailyPrompts(recentTopics, recentSentiment);
}

/**
 * Gets recent topics from the last few entries
 */
async function getRecentTopics() {
  try {
    if (notes.length === 0) return [];

    // Get topics from the last 3 entries
    const recentEntries = notes.slice(0, 3);
    const topicsPromises = recentEntries.map((entry) =>
      extractTopics(entry.content)
    );
    const allTopics = await Promise.all(topicsPromises);

    // Flatten and deduplicate topics
    const uniqueTopics = [...new Set(allTopics.flat())];
    return uniqueTopics.slice(0, 5); // Return top 5 topics
  } catch (error) {
    console.error("Error getting recent topics:", error);
    return [];
  }
}

/**
 * Gets recent sentiment from the last entry
 */
async function getRecentSentiment() {
  try {
    if (notes.length === 0) return "neutral";

    // Get sentiment from the most recent entry
    const latestEntry = notes[0];
    if (latestEntry.sentiment) {
      return latestEntry.sentiment.sentiment;
    }

    // If no cached sentiment, analyze the latest entry
    const sentiment = await analyzeSentiment(latestEntry.content);
    return sentiment.sentiment;
  } catch (error) {
    console.error("Error getting recent sentiment:", error);
    return "neutral";
  }
}

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
      throw new Error("No journal entries to export");
    }

    // Perform export with error handling
    const result = await safeExportImport.exportJournal(notes, format);

    if (result.success) {
      // Show success feedback
      const originalText = exportBtn.textContent;
      exportBtn.textContent = `✅ Exported!`;

      setTimeout(() => {
        exportBtn.textContent = originalText;
      }, 2000);

      console.log(
        `Successfully exported ${
          notes.length
        } entries as ${format.toUpperCase()}`
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
                ⚠️ This will add ${validation.entriesCount} entries to your existing ${notes.length} entries. 
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
      } entries!
                </div>
                ${
                  result.errors
                    ? `
                    <div class="import-info" style="color: #ff9500;">
                        ⚠️ ${result.errors.length} entries had issues but import continued.
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
  } else if (newState === "AMBIENT_LISTENING" || newState === "IDLE") {
    view.setMicButtonState(newState === "IDLE" ? "idle" : "listening");
  }
}
