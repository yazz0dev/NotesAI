// js/services/toast-service.js

const { reactive } = Vue;

const state = reactive({
  toasts: [],
  nextId: 0,
});

/**
 * Show a toast notification
 * @param {string} title - The title of the toast
 * @param {string} [message] - Optional message body
 * @param {object} [options] - Optional settings
 * @param {string} [options.type='info'] - Toast type: 'success', 'info', 'warning', 'error', 'danger'
 * @param {number} [options.duration=4000] - Duration in milliseconds (0 = no auto-dismiss)
 * @param {boolean} [options.autoClose=true] - Whether to auto-dismiss the toast
 * @returns {number} - Toast ID for manual removal if needed
 */
function show(title, message = '', options = {}) {
  const {
    type = 'info',
    duration = 4000,
    autoClose = true,
  } = options;

  const toastId = state.nextId++;
  const toast = {
    id: toastId,
    title,
    message,
    type,
    duration,
    autoClose,
  };

  state.toasts.push(toast);

  // Auto-dismiss after duration if enabled
  if (autoClose && duration > 0) {
    setTimeout(() => {
      removeToast(toastId);
    }, duration);
  }

  return toastId;
}

/**
 * Show a success toast
 * @param {string} title - Toast title
 * @param {string} [message] - Optional message
 * @param {object} [options] - Optional settings
 * @returns {number} - Toast ID
 */
function success(title, message = '', options = {}) {
  return show(title, message, { ...options, type: 'success' });
}

/**
 * Show an error toast
 * @param {string} title - Toast title
 * @param {string} [message] - Optional message
 * @param {object} [options] - Optional settings
 * @returns {number} - Toast ID
 */
function error(title, message = '', options = {}) {
  return show(title, message, { ...options, type: 'error', duration: 5000 });
}

/**
 * Show a warning toast
 * @param {string} title - Toast title
 * @param {string} [message] - Optional message
 * @param {object} [options] - Optional settings
 * @returns {number} - Toast ID
 */
function warning(title, message = '', options = {}) {
  return show(title, message, { ...options, type: 'warning', duration: 4000 });
}

/**
 * Show an info toast
 * @param {string} title - Toast title
 * @param {string} [message] - Optional message
 * @param {object} [options] - Optional settings
 * @returns {number} - Toast ID
 */
function info(title, message = '', options = {}) {
  return show(title, message, { ...options, type: 'info', duration: 3500 });
}

/**
 * Remove a toast by ID
 * @param {number} toastId - The ID of the toast to remove
 */
function removeToast(toastId) {
  const index = state.toasts.findIndex(t => t.id === toastId);
  if (index !== -1) {
    state.toasts.splice(index, 1);
  }
}

/**
 * Clear all toasts
 */
function clearAll() {
  state.toasts = [];
}

export const toastService = {
  state,
  show,
  success,
  error,
  warning,
  info,
  removeToast,
  clearAll,
};
