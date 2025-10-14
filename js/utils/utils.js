// js/utils.js

/**
const NOTES_STORE = "notes";
 * e.g., "Today, 10:30 AM" or "Yesterday" or "11/15/2025"
 * @param {string} isoString - The ISO date string to format.
 * @returns {string} The formatted date string.
 */
function formatDate(isoString) {
  const date = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  });

  if (date.toDateString() === today.toDateString()) {
    return `Today, ${formatter.format(date)}`;
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return date.toLocaleDateString();
}

/**
 * Generates a simple unique ID.
 * @returns {string} A unique ID string.
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Make functions available globally for Vue.js compatibility
window.formatDate = formatDate;
window.generateId = generateId;
