// js/view.js
// Refactored view module using component architecture

// Note: Imports will be handled via global window object for Vue.js compatibility

// --- DOM Element Selectors ---
// headerEl, searchInputEl, micButtonEl are imported from components

// Re-export all imported functions and elements so main.js can access them
const viewExports = {
  // Header
  setHeaderListeningState,
  setAmbientIndicatorState,
  setMicButtonState,
  showCommandUnderstood,
  showCommandNotUnderstood,
  insertImage,
  headerEl,
  searchInputEl,
  micButtonEl,

  // Settings (from settings-view)
  showSettingsModal,
  getHandsFreeMode,
  setHandsFreeMode,

  // General Modals
  showConfirmation,
  showAlert,
  showLoadingOverlay,
  showToast,

  // Component initialization
  initComponents,
};

// DOM element selectors - only access elements that exist
const emptyStateContainerEl = document.getElementById("empty-state-container");
const settingsModal = document.getElementById("settings-modal");
const modalEl = document.getElementById("confirmation-modal");

// Optional elements that may not exist
const calendarTodayEl = document.getElementById("calendar-today");
const calendarWidget = document.getElementById("calendar-widget");
const settingsBtn = document.getElementById("settings-btn");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const handsFreeToggle = document.getElementById("hands-free-toggle");
const modalTitleEl = document.getElementById("modal-title");
const modalMessageEl = document.getElementById("modal-message");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- Bookshelf Rendering ---

/** Renders the welcome message for new users. */
function renderWelcomeCard() {
  if (emptyStateContainerEl) {
    emptyStateContainerEl.innerHTML = `
        <h2 class="empty-state-title">Welcome to Your Notes & Tasks</h2>
        <p class="empty-state-text">
            This is your private space for notes and tasks. Click the + button to start your first note.
        </p>
    `;
    emptyStateContainerEl.classList.remove("hidden");
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

// Make all view functions available globally for Vue.js compatibility
Object.keys(viewExports).forEach((key) => {
  window[key] = viewExports[key];
});

// Enable hot module replacement for development
if (import.meta.hot) {
  import.meta.hot.accept();
}
