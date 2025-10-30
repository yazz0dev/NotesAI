// js/services/alert-service.js

// Use the global Vue object provided by the script tag in index.html
const { reactive } = Vue;

// The reactive state that the Vue component will watch.
const state = reactive({
  isVisible: false,
  title: "",
  message: "",
  confirmText: "Confirm",
  cancelText: "Cancel",
  resolve: null, // This will hold the promise's resolve function
  inputValue: "", // For input dialogs
  inputType: "text", // For input dialogs
  inputPlaceholder: "", // For input dialogs
  showInput: false, // Whether this is an input dialog
  type: "info", // Modal type: 'info', 'success', 'warning', 'danger', 'error'
  shake: false, // For shake animation on errors
  loading: false, // Loading state for buttons
  inputError: "", // Input validation error message
  errorOnly: false, // Error-only mode (no buttons, no dismiss)
});

/**
 * A reusable, promise-based confirmation dialog service.
 * @param {string} title - The title of the alert.
 * @param {string} message - The body text of the alert.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.confirmText='Confirm'] - Text for the confirm button.
 * @param {string|boolean} [options.cancelText='Cancel'] - Text for the cancel button. Set to false to hide.
 * @param {string} [options.type='info'] - Modal type: 'info', 'success', 'warning', 'danger'.
 * @returns {Promise<boolean>} - Resolves true if confirmed, false if canceled.
 */
function confirm(title, message, options = {}) {
  state.title = title;
  state.message = message;
  state.confirmText = options.confirmText || "Confirm";
  state.cancelText = options.cancelText === false ? false : (options.cancelText || "Cancel");
  state.type = options.type || "info";
  state.showInput = false;
  state.inputValue = "";
  state.inputType = "text";
  state.inputPlaceholder = "";
  state.inputError = "";
  state.shake = false;
  state.loading = false;
  state.isVisible = true;

  return new Promise((resolve) => {
    state.resolve = resolve;
  });
}

/**
 * A reusable, promise-based input dialog service.
 * @param {string} title - The title of the dialog.
 * @param {string} message - The body text of the dialog.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.confirmText='Set'] - Text for the confirm button.
 * @param {string|boolean} [options.cancelText='Cancel'] - Text for the cancel button. Set to false to hide.
 * @param {string} [options.inputType='text'] - Type of input field.
 * @param {string} [options.inputPlaceholder=''] - Placeholder for input field.
 * @param {string} [options.defaultValue=''] - Default value for input field.
 * @param {string} [options.type='info'] - Modal type: 'info', 'success', 'warning', 'danger'.
 * @returns {Promise<string|null>} - Resolves with input value if confirmed, null if canceled.
 */
function input(title, message, options = {}) {
  state.title = title;
  state.message = message;
  state.confirmText = options.confirmText || "Set";
  state.cancelText = options.cancelText === false ? false : (options.cancelText || "Cancel");
  state.type = options.type || "info";
  state.showInput = true;
  state.inputType = options.inputType || "text";
  state.inputPlaceholder = options.inputPlaceholder || "";
  state.inputValue = options.defaultValue || "";
  state.inputError = "";
  state.shake = false;
  state.loading = false;
  state.isVisible = true;

  return new Promise((resolve) => {
    state.resolve = resolve;
  });
}

function handleConfirm() {
  if (state.resolve) {
    // For input dialogs, return the input value; for confirmation dialogs, return true
    const result = state.showInput ? state.inputValue : true;
    state.resolve(result);
  }
  resetState();
}

function handleCancel() {
  if (state.resolve) {
    // For input dialogs, return null; for confirmation dialogs, return false
    const result = state.showInput ? null : false;
    state.resolve(result);
  }
  resetState();
}

function resetState() {
  state.isVisible = false;
  state.title = "";
  state.message = "";
  state.confirmText = "Confirm";
  state.cancelText = "Cancel";
  state.type = "info";
  state.resolve = null;
  state.inputValue = "";
  state.inputType = "text";
  state.inputPlaceholder = "";
  state.inputError = "";
  state.shake = false;
  state.loading = false;
  state.showInput = false;
  state.errorOnly = false;
}

// Utility functions for enhanced UX
function setLoading(loading) {
  state.loading = loading;
}

function setInputError(error) {
  state.inputError = error;
  if (error) {
    state.shake = true;
    // Reset shake after animation
    setTimeout(() => {
      state.shake = false;
    }, 500);
  }
}

function clearInputError() {
  state.inputError = "";
}

// **KEY CHANGE**: Centralized and improved markdown to HTML converter
function markdownToHtml(markdown) {
  if (!markdown) return '';

  let html = markdown
    // Headers (h4, h5, h6)
    .replace(/^### (.*$)/gm, '<h6 class="markdown-header">$1</h6>')
    .replace(/^## (.*$)/gm, '<h5 class="markdown-header">$1</h5>')
    .replace(/^# (.*$)/gm, '<h4 class="markdown-header">$1</h4>')
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^\s*[\-\*] (.*$)/gm, '<li class="markdown-list-item">$1</li>')
    // Convert newlines to paragraphs
    .replace(/\n\n/g, '</p><p class="markdown-paragraph">')
    .replace(/\n/g, '<br>');

  // Wrap the entire content in a paragraph to start
  html = `<p class="markdown-paragraph">${html}</p>`;

  // Group list items into a single <ul>
  html = html.replace(/(<li class="markdown-list-item">.*?<\/li>)+/g, '<ul class="markdown-list">$1</ul>');

  // Clean up empty paragraphs and paragraphs wrapping lists/headers
  html = html.replace(/<p class="markdown-paragraph"><(ul|h[4-6])>/g, '<$1>');
  html = html.replace(/<\/(ul|h[4-6])><\/p>/g, '</$1>');
  html = html.replace(/<p class="markdown-paragraph">\s*<\/p>/g, '');

  return html;
}

// Convenience functions for different modal types
function success(title, message, options = {}) {
  return confirm(title, message, { ...options, type: "success" });
}

function error(title, message, options = {}) {
  return confirm(title, message, { ...options, type: "danger" });
}

function warning(title, message, options = {}) {
  return confirm(title, message, { ...options, type: "warning" });
}

function info(title, message, options = {}) {
  return confirm(title, message, { ...options, type: "info" });
}

function infoMarkdown(title, markdownMessage, options = {}) {
  const htmlMessage = markdownToHtml(markdownMessage);
  return confirm(title, htmlMessage, { ...options, type: "info" });
}

/**
 * Show an error-only dialog (no buttons, no dismiss, can only close with timeout or programmatically)
 * @param {string} title - The title of the alert
 * @param {string} message - The body text of the alert
 * @param {object} [options] - Optional settings
 * @returns {Promise<void>}
 */
function errorOnly(title, message, options = {}) {
  state.title = title;
  state.message = message;
  state.confirmText = "";
  state.cancelText = "";
  state.type = options.type || "danger";
  state.showInput = false;
  state.inputValue = "";
  state.inputType = "text";
  state.inputPlaceholder = "";
  state.inputError = "";
  state.shake = false;
  state.loading = false;
  state.errorOnly = true;
  state.isVisible = true;

  return new Promise((resolve) => {
    state.resolve = resolve;
    // Auto-close after 5 seconds if not manually closed
    setTimeout(() => {
      if (state.isVisible) {
        state.resolve?.();
        resetState();
      }
    }, 5000);
  });
}

export const alertService = {
  state,
  confirm,
  input,
  handleConfirm,
  handleCancel,
  resetState,
  setLoading,
  setInputError,
  clearInputError,
  success,
  error,
  warning,
  info,
  infoMarkdown,
  errorOnly,
  markdownToHtml, // Export the improved function
};