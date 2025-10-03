// js/view.js
// Refactored view module using component architecture

// Import all component functions
import {
  // Calendar & Header
  initCalendar,
  triggerPeelAnimation,
  setHeaderListeningState,
  setAmbientIndicatorState,
  renderOnThisDay,
  setMicButtonState,
  showCommandUnderstood,
  showCommandNotUnderstood,
  insertImage,
  headerEl,
  searchInputEl,
  micButtonEl,

  // Bookshelf
  renderBookshelf,
  prependCard,
  showEmptySearchState,
  bookshelfContainerEl,

  // Book Viewer
  openBook,
  closeBook,
  toggleEditMode,
  getEditedContent,
  insertImageIntoViewer,
  rebalancePages,

  // General Modals (not settings)
  showConfirmation,
  showAlert,
  showLoadingOverlay,
  showToast,

  // Prompts
  showPromptsWidget,
  renderDailyPrompts,
  loadDailyPrompts,
  refreshPrompts,

  // Component initialization
  initComponents,
} from "./components/index.js";

// Import settings functions from settings-view
import {
  showSettingsModal,
  getHandsFreeMode,
  setHandsFreeMode,
} from "./components/settings-view.js";

// Import required services
import { getAudioData, formatDuration } from "./services/audio-service.js";
import { analyzeSentiment, extractTopics } from "./services/ai-insights.js";
import { generateDailyPrompts } from "./services/prompts-service.js";

// --- DOM Element Selectors ---
// bookshelfContainerEl, headerEl, searchInputEl, micButtonEl are imported from components

// Re-export all imported functions and elements so main.js can access them
export {
  // Calendar & Header
  initCalendar,
  triggerPeelAnimation,
  setHeaderListeningState,
  setAmbientIndicatorState,
  renderOnThisDay,
  setMicButtonState,
  showCommandUnderstood,
  showCommandNotUnderstood,
  insertImage,
  headerEl,
  searchInputEl,
  micButtonEl,

  // Bookshelf
  renderBookshelf,
  prependCard,
  showEmptySearchState,
  bookshelfContainerEl,

  // Book Viewer
  openBook,
  closeBook,
  toggleEditMode,
  getEditedContent,
  insertImageIntoViewer,
  rebalancePages,

  // Settings (from settings-view)
  showSettingsModal,
  getHandsFreeMode,
  setHandsFreeMode,

  // General Modals
  showConfirmation,
  showAlert,
  showLoadingOverlay,
  showToast,

  // Prompts
  showPromptsWidget,
  renderDailyPrompts,
  loadDailyPrompts,
  refreshPrompts,

  // Component initialization
  initComponents,
};

const emptyStateContainerEl = document.getElementById("empty-state-container");
const calendarTodayEl = document.getElementById("calendar-today");
const calendarWidget = document.getElementById("calendar-widget");
const bookViewerEl = document.getElementById("book-viewer");
const onThisDayWidget = document.getElementById("on-this-day-widget");
const dailyPromptsWidget = document.getElementById("daily-prompts-widget");
const promptsContainer = document.getElementById("prompts-container");
const refreshPromptsBtn = document.getElementById("refresh-prompts-btn");
const promptsBtn = document.getElementById("prompts-btn");
const viewerTitleEl = document.getElementById("viewer-title");
const viewerDateEl = document.getElementById("viewer-date");
const viewerTextLeftEl = document.getElementById("viewer-text-left");
const viewerTextRightEl = document.getElementById("viewer-text-right");
const editBtn = document.getElementById("edit-btn");
const saveBtn = document.getElementById("save-btn");
const deleteBtn = document.getElementById("delete-btn");
const addImageBtn = document.getElementById("add-image-btn");
const imageInput = document.getElementById("image-input");

const settingsBtn = document.getElementById("settings-btn");
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const handsFreeToggle = document.getElementById("hands-free-toggle");

const modalEl = document.getElementById("confirmation-modal");
const modalTitleEl = document.getElementById("modal-title");
const modalMessageEl = document.getElementById("modal-message");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- Bookshelf Rendering ---

/** Hides all shelves and the empty state message. */
function clearBookshelfView() {
  emptyStateContainerEl.classList.add("hidden");
  const shelves = bookshelfContainerEl.querySelectorAll(".shelf");
  shelves.forEach((shelf) => shelf.remove());
}

/** Renders the welcome message for new users. */
function renderWelcomeCard() {
  clearBookshelfView();
  emptyStateContainerEl.innerHTML = `
        <h2 class="empty-state-title">Welcome to Your AI Journal</h2>
        <p class="empty-state-text">
            This is your private space. Click the microphone below or simply say <strong>"Okay Journal"</strong> to start your first entry.
        </p>
    `;
  emptyStateContainerEl.classList.remove("hidden");
}

// renderBookshelf and prependCard are imported from components

// --- Book Viewer Logic ---

/**
 * Splits HTML content logically across two page elements.
 * @param {string} noteContent - The HTML string content of the note.
 */
function splitContentForPages(noteContent) {
  viewerTextLeftEl.innerHTML = "";
  viewerTextRightEl.innerHTML = "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(noteContent, "text/html");
  const contentNodes = Array.from(doc.body.children);

  contentNodes.forEach((node) => viewerTextLeftEl.appendChild(node));

  while (
    viewerTextLeftEl.scrollHeight > viewerTextLeftEl.clientHeight &&
    viewerTextLeftEl.children.length > 1
  ) {
    const lastElement = viewerTextLeftEl.lastElementChild;
    viewerTextRightEl.prepend(lastElement);
  }
}

// openBook is imported from components

/**
 * Adds audio player to the book viewer
 * @param {Object} audioData - Audio data from IndexedDB
 */
async function addAudioToViewer(audioData) {
  // Remove existing audio section if present
  const existingAudio = viewerTextLeftEl.querySelector(".viewer-audio-section");
  if (existingAudio) {
    existingAudio.remove();
  }

  // Create audio section
  const audioSection = document.createElement("div");
  audioSection.className = "viewer-audio-section";

  const audioTitle = document.createElement("div");
  audioTitle.className = "audio-section-title";
  audioTitle.innerHTML =
    '<span class="iconify" data-icon="material-symbols:mic"></span> Original Recording';

  const audioPlayer = createAudioPlayer(
    audioData.audioDataUrl,
    audioData.duration / 1000
  );

  audioSection.appendChild(audioTitle);
  audioSection.appendChild(audioPlayer);

  // Insert at the beginning of the left page
  viewerTextLeftEl.insertBefore(audioSection, viewerTextLeftEl.firstChild);
}

// closeBook, toggleEditMode, getEditedContent are imported from components

// --- UI State Management ---

// setMicButtonState is imported from components

// showConfirmation is imported from components

// --- Daily Prompts Widget ---
// showPromptsWidget, renderDailyPrompts, loadDailyPrompts are imported from components

/**
 * Uses a prompt by setting it in the search input
 * @param {string} prompt - The prompt text to use
 */
function usePrompt(prompt) {
  if (searchInputEl) {
    searchInputEl.textContent = prompt;
    searchInputEl.focus();

    // Add focused state to action bar
    const actionBar = document.querySelector(".action-bar");
    if (actionBar) {
      actionBar.classList.add("is-focused");
    }

    // Hide prompts widget after selection
    showPromptsWidget(false);

    // Add a subtle animation to indicate prompt was selected
    const actionBarEl = document.querySelector(".action-bar");
    if (actionBarEl) {
      actionBarEl.style.animation = "gentle-pulse 0.5s ease-out";
      setTimeout(() => {
        actionBarEl.style.animation = "";
      }, 500);
    }
  }
}

// --- Utility Functions ---

/**
 * Extracts the first image from HTML content
 * @param {string} content - HTML content to search
 * @returns {string|null} - Image src or null if no image found
 */
function extractFirstImage(content) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content;
  const img = tempDiv.querySelector("img");
  return img ? img.src : null;
}

/**
 * Formats a date for display
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Gets the current time of day
 * @returns {string} - 'morning', 'afternoon', or 'evening'
 */
function getCurrentTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * Creates an audio player element
 * @param {string} audioDataUrl - Audio data URL
 * @param {number} duration - Duration in seconds
 * @returns {HTMLElement} - Audio player element
 */
function createAudioPlayer(audioDataUrl, duration) {
  const playerContainer = document.createElement("div");
  playerContainer.className = "audio-player";

  const audio = document.createElement("audio");
  audio.src = audioDataUrl;
  audio.controls = true;
  audio.preload = "metadata";

  const durationText = document.createElement("span");
  durationText.className = "audio-duration";
  durationText.textContent = formatDuration(duration);

  playerContainer.appendChild(audio);
  playerContainer.appendChild(durationText);

  return playerContainer;
}
