// js/components/modals.js
// Modal dialogs and UI overlays
// Note: Settings modal functionality has been moved to settings-view.js

// --- DOM Element Selectors ---
const modalEl = document.getElementById("confirmation-modal");
const modalTitleEl = document.getElementById("modal-title");
const modalMessageEl = document.getElementById("modal-message");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel-btn");

// --- Modal Functions ---

/**
 * Shows a confirmation dialog with custom title and message.
 * @param {string} title - The dialog title
 * @param {string} message - The dialog message
 * @returns {Promise<boolean>} Promise that resolves to true if confirmed, false if cancelled
 */
export function showConfirmation(title, message) {
  return new Promise((resolve) => {
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = message;
    modalEl.classList.remove("hidden");

    const handleConfirm = () => {
      modalEl.classList.add("hidden");
      modalConfirmBtn.removeEventListener("click", handleConfirm);
      modalCancelBtn.removeEventListener("click", handleCancel);
      resolve(true);
    };

    const handleCancel = () => {
      modalEl.classList.add("hidden");
      modalConfirmBtn.removeEventListener("click", handleConfirm);
      modalCancelBtn.removeEventListener("click", handleCancel);
      resolve(false);
    };

    modalConfirmBtn.addEventListener("click", handleConfirm);
    modalCancelBtn.addEventListener("click", handleCancel);

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleEscape);
        handleCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
  });
}

/**
 * Shows a simple alert dialog.
 * @param {string} title - The dialog title
 * @param {string} message - The dialog message
 * @returns {Promise<void>} Promise that resolves when dialog is closed
 */
export function showAlert(title, message) {
  return new Promise((resolve) => {
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = message;
    modalConfirmBtn.textContent = "OK";
    modalCancelBtn.classList.add("hidden");
    modalEl.classList.remove("hidden");

    const handleOk = () => {
      modalEl.classList.add("hidden");
      modalConfirmBtn.textContent = "Delete"; // Reset default text
      modalCancelBtn.classList.remove("hidden");
      modalConfirmBtn.removeEventListener("click", handleOk);
      resolve();
    };

    modalConfirmBtn.addEventListener("click", handleOk);

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleEscape);
        handleOk();
      }
    };
    document.addEventListener("keydown", handleEscape);
  });
}

/**
 * Shows a loading overlay with optional message.
 * @param {string} message - Optional loading message
 * @returns {Object} Object with hide() method to dismiss the overlay
 */
export function showLoadingOverlay(message = "Loading...") {
  const overlay = document.createElement("div");
  overlay.className = "loading-overlay";
  overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-message">${message}</p>
        </div>
    `;

  document.body.appendChild(overlay);

  // Fade in
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
  });

  return {
    hide: () => {
      overlay.style.opacity = "0";
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    },
    updateMessage: (newMessage) => {
      const messageEl = overlay.querySelector(".loading-message");
      if (messageEl) {
        messageEl.textContent = newMessage;
      }
    },
  };
}

/**
 * Shows a toast notification.
 * @param {string} message - The notification message
 * @param {string} type - The notification type ('success', 'error', 'info', 'warning')
 * @param {number} duration - How long to show the toast (in milliseconds)
 */
export function showToast(message, type = "info", duration = 3000) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warning: "⚠️",
  };

  toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-message">${message}</div>
        <button class="toast-close" aria-label="Close">×</button>
    `;

  // Add to toast container or create one
  let toastContainer = document.querySelector(".toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "toast-container";
    document.body.appendChild(toastContainer);
  }

  toastContainer.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    toast.classList.add("toast-show");
  });

  // Auto-hide after duration
  const hideToast = () => {
    toast.classList.remove("toast-show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  };

  const timeoutId = setTimeout(hideToast, duration);

  // Handle manual close
  const closeBtn = toast.querySelector(".toast-close");
  closeBtn.addEventListener("click", () => {
    clearTimeout(timeoutId);
    hideToast();
  });

  // Handle click to dismiss
  toast.addEventListener("click", () => {
    clearTimeout(timeoutId);
    hideToast();
  });
}

/**
 * Initializes modal event listeners.
 * Note: Settings modal initialization is handled by settings-view.js
 */
export function initModals() {
  // Close confirmation modal when clicking outside
  if (modalEl) {
    modalEl.addEventListener("click", (e) => {
      if (e.target === modalEl) {
        modalEl.classList.add("hidden");
      }
    });
  }
}
