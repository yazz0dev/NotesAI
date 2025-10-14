// js/components/header.js
// Header controls and UI state management

// --- DOM Element Selectors (lazy loading) ---
const headerEl = () => document.getElementById("app-header");
const searchInputEl = () => document.getElementById("search-input");
const micButtonEl = () => document.getElementById("mic-button");

/**
 * Sets the header listening state with visual feedback.
 * @param {boolean} isListening - Whether the app is actively listening
 */
function setHeaderListeningState(isListening) {
  const header = headerEl();
  if (header) {
    header.classList.toggle("listening", isListening);
  }
}

/**
 * Sets the ambient indicator state for voice control feedback.
 * @param {string} state - The current voice state (IDLE, AMBIENT_LISTENING, etc.)
 */
function setAmbientIndicatorState(state) {
  const indicator = document.getElementById("ambient-indicator");
  if (!indicator) return;

  indicator.className = "ambient-indicator";
  if (state === "AMBIENT_LISTENING") {
    indicator.classList.add("listening");
  } else if (state === "DICTATION_MODE") {
    indicator.classList.add("dictating");
  }
}

/**
 * Sets the microphone button state with visual feedback.
 * @param {string} state - Button state ('idle', 'listening', 'capturing', 'processing')
 */
function setMicButtonState(state) {
  const micButton = micButtonEl();
  if (!micButton) return;

  micButton.className = "mic-button";
  micButton.classList.add(state);

  const stateMessages = {
    idle: "Click to start recording",
    listening: 'Listening for "Hey Notes"...',
    capturing: "Recording your thoughts...",
    processing: "Processing your note...",
  };

  micButton.title = stateMessages[state] || "Voice control";
}

/**
 * Shows command understood feedback with a message.
 * @param {string} message - The confirmation message to display
 */
function showCommandUnderstood(message) {
  const header = headerEl();
  if (!header) return;

  const feedback = document.createElement("div");
  feedback.className =
    "voice-feedback understood d-flex align-items-center gap-2";
  feedback.innerHTML = `
        <div class="feedback-icon"><i class="bi bi-check-circle-fill text-success"></i></div>
        <div class="feedback-message">${message}</div>
    `;

  header.appendChild(feedback);

  setTimeout(() => {
    feedback.classList.add("fade-out");
    setTimeout(() => feedback.remove(), 300);
  }, 2000);
}

/**
 * Shows command not understood feedback.
 */
function showCommandNotUnderstood() {
  const header = headerEl();
  if (!header) return;

  const feedback = document.createElement("div");
  feedback.className =
    "voice-feedback not-understood d-flex align-items-center gap-2";
  feedback.innerHTML = `
        <div class="feedback-icon"><i class="bi bi-question-circle-fill text-warning"></i></div>
        <div class="feedback-message">I didn't catch that. Try saying "Hey Notes" to start.</div>
    `;

  header.appendChild(feedback);

  setTimeout(() => {
    feedback.classList.add("fade-out");
    setTimeout(() => feedback.remove(), 300);
  }, 3000);
}

/**
 * Inserts an image into the current text input with optional caption.
 * @param {string} imageDataUrl - The base64 data URL of the image
 * @param {string} caption - Optional caption for the image
 */
function insertImage(imageDataUrl, caption) {
  const searchInput = searchInputEl();
  if (!searchInput) return;

  const imageHtml = `
        <div class="note-image-container">
            <img src="${imageDataUrl}" alt="${
    caption || "Note image"
  }" class="note-image">
            ${caption ? `<p class="image-caption">${caption}</p>` : ""}
        </div>
    `;

  // Insert at cursor position in search input (which doubles as text input)
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    const div = document.createElement("div");
    div.innerHTML = imageHtml;
    range.insertNode(div.firstChild);
    range.collapse(false);
  } else {
    // Fallback: append to search input
    searchInput.innerHTML += imageHtml;
  }
}

// Make functions available globally for Vue.js compatibility
window.headerEl = headerEl;
window.searchInputEl = searchInputEl;
window.micButtonEl = micButtonEl;
window.setHeaderListeningState = setHeaderListeningState;
window.setAmbientIndicatorState = setAmbientIndicatorState;
window.setMicButtonState = setMicButtonState;
window.showCommandUnderstood = showCommandUnderstood;
window.showCommandNotUnderstood = showCommandNotUnderstood;
window.insertImage = insertImage;
