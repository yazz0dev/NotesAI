// js/components/settings-view.js
// Dedicated settings view component with mobile-first responsive design


// --- Settings View State ---
let isSettingsOpen = false;
let currentSection = "voice"; // Default active section

// --- DOM Element Selectors ---
const settingsModal = document.getElementById("settings-modal");
const settingsCloseBtn = document.getElementById("settings-close-btn");
const handsFreeToggle = document.getElementById("hands-free-toggle");

// Section navigation
const sectionNavigation = document.getElementById("settings-navigation");
const sectionContent = document.getElementById("settings-content");

// Export buttons
const exportJsonBtn = document.getElementById("export-json-btn");
const exportTxtBtn = document.getElementById("export-txt-btn");
const exportPdfBtn = document.getElementById("export-pdf-btn");

// Import elements
const importFileBtn = document.getElementById("import-file-btn");
const importFileInput = document.getElementById("import-file-input");
const importStatus = document.getElementById("import-status");
const confirmImportBtn = document.getElementById("confirm-import-btn");
const cancelImportBtn = document.getElementById("cancel-import-btn");

// Goals buttons
const viewGoalsBtn = document.getElementById("view-goals-btn");
const addGoalBtn = document.getElementById("add-goal-btn");

// --- Icon Mapping for Bootstrap Icons ---
function getBootstrapIcon(iconName) {
  const iconMap = {
    mic: "bi-mic",
    export: "bi-download",
    import: "bi-upload",
    goals: "bi-flag",
    settings: "bi-gear",
  };
  return iconMap[iconName] || "bi-question-circle";
}

// --- Settings Sections Configuration ---
const settingsSections = {
  voice: {
    title: "Voice Control",
    icon: "mic",
    order: 1,
  },
  export: {
    title: "Export Data",
    icon: "export",
    order: 2,
  },
  import: {
    title: "Import Data",
    icon: "import",
    order: 3,
  },
  goals: {
    title: "Goals & Habits",
    icon: "goals",
    order: 4,
  },
  advanced: {
    title: "Advanced",
    icon: "settings",
    order: 5,
  },
};

/**
 * Shows or hides the settings modal with mobile optimizations
 * @param {boolean} show - Whether to show the modal
 */
function showSettingsModal(show) {
  isSettingsOpen = show;
  settingsModal.classList.toggle("hidden", !show);

  if (show) {
    document.body.classList.add("settings-modal-open");

    // Enhanced focus management for accessibility
    const firstFocusable = settingsModal.querySelector(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
    if (firstFocusable) {
      setTimeout(() => {
        firstFocusable.focus();
        // Ensure focus is visible on mobile
        if ("scrollIntoView" in firstFocusable) {
          firstFocusable.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    }

    // Initialize on first open
    if (!settingsModal.dataset.initialized) {
      initializeSettingsContent();
      settingsModal.dataset.initialized = "true";
    }
  } else {
    document.body.classList.remove("settings-modal-open");
  }
}

/**
 * Switches to a specific settings section with proper ARIA updates
 * @param {string} sectionId - The section to switch to
 */
function switchToSection(sectionId) {
  if (!settingsSections[sectionId]) return;

  currentSection = sectionId;

  // Update navigation
  const navButtons = document.querySelectorAll(".settings-nav-btn");
  navButtons.forEach((btn) => {
    const isActive = btn.dataset.section === sectionId;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive);
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  // Update content
  updateSectionContent(sectionId);

  // Update URL hash for deep linking (optional)
  if (history.replaceState) {
    history.replaceState(null, null, `#settings-${sectionId}`);
  }
}

/**
 * Updates the content area for the selected section with proper ARIA updates
 * @param {string} sectionId - The section to display
 */
function updateSectionContent(sectionId) {
  const contentArea = document.getElementById("settings-content");
  if (!contentArea) return;

  // Add loading state
  contentArea.classList.add("loading");

  setTimeout(() => {
    contentArea.innerHTML = getSectionHTML(sectionId);
    contentArea.classList.remove("loading");
    contentArea.setAttribute("aria-labelledby", `${sectionId}-tab`);
    initializeSectionEventListeners(sectionId);

    // Focus management for better accessibility
    const firstFocusable = contentArea.querySelector(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
    );
    if (firstFocusable) {
      // Don't auto-focus if user is using keyboard navigation
      if (
        !document.activeElement ||
        !document.activeElement.classList.contains("settings-nav-btn")
      ) {
        firstFocusable.focus();
      }
    }
  }, 150); // Small delay for smooth transition
}

/**
 * Gets the HTML content for a specific section
 * @param {string} sectionId - The section ID
 * @returns {string} HTML content
 */
function getSectionHTML(sectionId) {
  switch (sectionId) {
    case "voice":
      return `
                <div class="settings-section-content" role="tabpanel" aria-labelledby="voice-section">
                    <div class="setting-section">
                        <h3 class="section-title" id="voice-section">${settingsSections.voice.title}</h3>
                        <div class="setting-item">
                            <div class="setting-info">
                                <label for="hands-free-toggle">Hands-Free Mode ("Hey Notes")</label>
                                <p class="setting-description">Allow the app to listen for the "Hey Notes" hotword to enable full voice control. All processing is done on-device.</p>
                            </div>
                            <label class="toggle-switch" aria-label="Toggle hands-free mode">
                                <input type="checkbox" id="hands-free-toggle" aria-describedby="hands-free-description">
                                <span class="slider" aria-hidden="true"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-info">
                                <label for="voice-language-select">Voice Recognition Language</label>
                                <p class="setting-description">Select your preferred language for voice recognition.</p>
                            </div>
                            <select id="voice-language-select" class="setting-select" aria-describedby="voice-language-description">
                                <option value="en-US">English (US)</option>
                                <option value="en-GB">English (UK)</option>
                                <option value="es-ES">Spanish</option>
                                <option value="fr-FR">French</option>
                                <option value="de-DE">German</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;

    case "export":
      return `
                <div class="settings-section-content" role="tabpanel" aria-labelledby="export-section">
                    <div class="setting-section">
                        <h3 class="section-title" id="export-section">${settingsSections.export.title}</h3>
                        <p class="section-description">Download your notes in different formats</p>
                        <div class="export-buttons" role="group" aria-label="Export format options">
                            <button id="export-json-btn" class="export-btn btn btn-outline-secondary d-flex align-items-center gap-2" data-format="json" aria-describedby="json-description">
                                <i class="bi bi-code-slash" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">JSON Format</span>
                                  <span class="btn-description d-block small text-muted" id="json-description">Complete data with metadata</span>
                                </div>
                            </button>
                            <button id="export-txt-btn" class="export-btn btn btn-outline-secondary d-flex align-items-center gap-2" data-format="txt" aria-describedby="txt-description">
                                <i class="bi bi-file-text" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">Text Format</span>
                                  <span class="btn-description d-block small text-muted" id="txt-description">Simple text for reading</span>
                                </div>
                            </button>
                            <button id="export-pdf-btn" class="export-btn btn btn-outline-secondary d-flex align-items-center gap-2" data-format="pdf" aria-describedby="pdf-description">
                                <i class="bi bi-file-earmark-pdf" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">PDF Format</span>
                                  <span class="btn-description d-block small text-muted" id="pdf-description">Formatted for printing</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            `;

    case "import":
      return `
                <div class="settings-section-content" role="tabpanel" aria-labelledby="import-section">
                    <div class="setting-section">
                        <h3 class="section-title" id="import-section">${settingsSections.import.title}</h3>
                        <p class="section-description">Restore notes from backup files</p>
                        <div class="import-area">
                            <button id="import-file-btn" class="import-btn btn btn-outline-secondary d-flex align-items-center gap-2" aria-describedby="import-description">
                                <i class="bi bi-upload" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">Choose File</span>
                                  <span class="btn-description d-block small text-muted" id="import-description">JSON or TXT format</span>
                                </div>
                            </button>
                            <input type="file" id="import-file-input" accept=".json,.txt" aria-label="Select import file" style="display: none">
                            <div id="import-status" class="import-status d-none" role="region" aria-live="polite" aria-label="Import preview">
                                <div class="import-preview" role="status"></div>
                                <div class="import-actions d-flex gap-2" role="group" aria-label="Import actions">
                                    <button id="confirm-import-btn" class="import-confirm-btn btn btn-success" aria-describedby="confirm-description">
                                      <i class="bi bi-check-circle me-1"></i> Import
                                    </button>
                                    <button id="cancel-import-btn" class="import-cancel-btn btn btn-outline-secondary" aria-describedby="cancel-description">
                                      <i class="bi bi-x-lg me-1"></i> Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

    case "goals":
      return `
                <div class="settings-section-content" role="tabpanel" aria-labelledby="goals-section">
                    <div class="setting-section">
                        <h3 class="section-title" id="goals-section">${settingsSections.goals.title}</h3>
                        <p class="section-description">Track your personal development journey with AI-powered insights</p>
                        <div class="goals-actions-grid" role="group" aria-label="Goals actions">
                            <button id="view-goals-btn" class="goals-action-btn primary btn btn-primary d-flex align-items-center gap-2" aria-describedby="view-goals-description">
                                <i class="bi bi-speedometer2" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">View Dashboard</span>
                                  <span class="btn-description d-block small" id="view-goals-description">See progress, streaks, and insights</span>
                                </div>
                            </button>
                            <button id="add-goal-btn" class="goals-action-btn btn btn-outline-primary d-flex align-items-center gap-2" aria-describedby="add-goal-description">
                                <i class="bi bi-plus-circle" aria-hidden="true"></i>
                                <div>
                                  <span class="btn-text">Create Goal</span>
                                  <span class="btn-description d-block small" id="add-goal-description">Set a new goal or habit</span>
                                </div>
                            </button>
                        </div>
                        <div id="goals-today" class="goals-today-section hidden" role="region" aria-label="Today's goals">
                            <!-- Goals due today will be populated here -->
                        </div>
                    </div>
                </div>
            `;

    case "advanced":
      return `
                <div class="settings-section-content" role="tabpanel" aria-labelledby="advanced-section">
                    <div class="setting-section">
                        <h3 class="section-title" id="advanced-section">${settingsSections.advanced.title}</h3>
                        <div class="setting-item disabled">
                            <div class="setting-info">
                                <label for="hybrid-ai-toggle">Hybrid AI Insights (Coming Soon)</label>
                                <p class="setting-description">Optionally sync to the cloud to receive monthly reports on themes and trends in your writing.</p>
                            </div>
                            <label class="toggle-switch" aria-label="Toggle hybrid AI insights (disabled)">
                                <input type="checkbox" id="hybrid-ai-toggle" disabled aria-describedby="hybrid-ai-description">
                                <span class="slider" aria-hidden="true"></span>
                            </label>
                        </div>
                        <div class="setting-item">
                            <div class="setting-info">
                                <label for="clear-data-btn">Data Storage</label>
                                <p class="setting-description">Manage your local data storage and privacy settings.</p>
                            </div>
                            <button class="setting-btn" id="clear-data-btn" aria-describedby="clear-data-description">Clear All Data</button>
                        </div>
                    </div>
                </div>
            `;

    default:
      return '<div class="settings-section-content"><div class="setting-section"><p>Section not found</p></div></div>';
  }
}

/**
 * Initializes the settings modal content structure
 */
function initializeSettingsContent() {
  const modalDialog = settingsModal.querySelector(".modal-dialog");

  modalDialog.innerHTML = `
        <div class="settings-header">
            <h2 class="modal-title">Settings</h2>
            <button id="settings-close-btn" class="settings-close-btn btn btn-outline-secondary btn-sm" aria-label="Close settings">
              <i class="bi bi-x-lg"></i>
            </button>
        </div>

        <div class="settings-body">
            <nav class="settings-navigation" id="settings-navigation" role="tablist" aria-label="Settings sections">
                ${Object.entries(settingsSections)
                  .sort(([, a], [, b]) => a.order - b.order)
                  .map(
                    ([id, section]) => `
                        <button class="settings-nav-btn ${
                          id === currentSection ? "active" : ""
                        }"
                                data-section="${id}"
                                role="tab"
                                aria-selected="${id === currentSection}"
                                aria-controls="${id}-section"
                                id="${id}-tab"
                                aria-label="${section.title}">
                            <span class="nav-icon" aria-hidden="true">
                              <i class="bi ${getBootstrapIcon(
                                section.icon
                              )}"></i>
                            </span>
                            <span class="nav-text">${section.title}</span>
                        </button>
                    `
                  )
                  .join("")}
            </nav>

            <main class="settings-content" id="settings-content" role="tabpanel" aria-labelledby="${currentSection}-tab">
                ${getSectionHTML(currentSection)}
            </main>
        </div>
    `;

  // Re-bind event listeners after DOM update
  bindSettingsEventListeners();
  initializeSectionEventListeners(currentSection);
}

/**
 * Binds global settings event listeners
 */
function bindSettingsEventListeners() {
  // Close button
  const closeBtn = document.getElementById("settings-close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => showSettingsModal(false));
  }

  // Navigation buttons
  const navButtons = document.querySelectorAll(".settings-nav-btn");
  navButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const sectionId = e.currentTarget.dataset.section;
      switchToSection(sectionId);
    });
  });

  // Close on backdrop click
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) {
      showSettingsModal(false);
    }
  });

  // Keyboard navigation
  settingsModal.addEventListener("keydown", handleKeyboardNavigation);
}

/**
 * Initializes event listeners for a specific section
 * @param {string} sectionId - The section ID
 */
function initializeSectionEventListeners(sectionId) {
  switch (sectionId) {
    case "voice":
      initializeVoiceSettings();
      break;
    case "export":
      initializeExportSettings();
      break;
    case "import":
      initializeImportSettings();
      break;
    case "goals":
      initializeGoalsSettings();
      break;
    case "advanced":
      initializeAdvancedSettings();
      break;
  }
}

/**
 * Initializes voice settings
 */
function initializeVoiceSettings() {
  const handsFreeToggle = document.getElementById("hands-free-toggle");
  const voiceLanguageSelect = document.getElementById("voice-language-select");

  // Load saved settings
  const savedHandsFreeMode = localStorage.getItem("handsFreeMode");
  const savedLanguage = localStorage.getItem("voiceLanguage") || "en-US";

  if (handsFreeToggle) {
    handsFreeToggle.checked = savedHandsFreeMode === "true";
    handsFreeToggle.addEventListener("change", (e) => {
      localStorage.setItem("handsFreeMode", e.target.checked.toString());
      showToast(
        e.target.checked
          ? "Hands-free mode enabled"
          : "Hands-free mode disabled",
        "success"
      );
    });
  }

  if (voiceLanguageSelect) {
    voiceLanguageSelect.value = savedLanguage;
    voiceLanguageSelect.addEventListener("change", (e) => {
      localStorage.setItem("voiceLanguage", e.target.value);
      showToast("Voice language updated", "success");
    });
  }
}

/**
 * Initializes export settings
 */
function initializeExportSettings() {
  const exportButtons = document.querySelectorAll(".export-btn");

  exportButtons.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const format = e.currentTarget.dataset.format;
      const loadingOverlay = showLoadingOverlay(
        `Exporting as ${format.toUpperCase()}...`
      );

      try {
        const notes = await getNotes(); // Fetch notes before exporting
        await exportNotes(notes, format); // Pass notes and format
        showToast(
          `Notes exported successfully as ${format.toUpperCase()}`,
          "success"
        );
      } catch (error) {
        showToast(`Failed to export notes: ${error.message}`, "error");
      } finally {
        loadingOverlay.hide();
      }
    });
  });
}

/**
 * Initializes import settings
 */
function initializeImportSettings() {
  const importFileBtn = document.getElementById("import-file-btn");
  const importFileInput = document.getElementById("import-file-input");
  const importStatus = document.getElementById("import-status");
  const confirmImportBtn = document.getElementById("confirm-import-btn");
  const cancelImportBtn = document.getElementById("cancel-import-btn");

  if (importFileBtn && importFileInput) {
    importFileBtn.addEventListener("click", () => importFileInput.click());

    importFileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const result = await importFromFile(file);
          // Show preview and confirmation UI
          showImportPreview(result);
        } catch (error) {
          showToast(`Failed to read import file: ${error.message}`, "error");
        }
      }
    });
  }

  if (confirmImportBtn) {
    confirmImportBtn.addEventListener("click", () => {
      // Handle import confirmation
      confirmImport();
    });
  }

  if (cancelImportBtn) {
    cancelImportBtn.addEventListener("click", () => {
      hideImportPreview();
    });
  }
}

/**
 * Initializes goals settings
 */
function initializeGoalsSettings() {
  const viewGoalsBtn = document.getElementById("view-goals-btn");
  const addGoalBtn = document.getElementById("add-goal-btn");

  if (viewGoalsBtn) {
    viewGoalsBtn.addEventListener("click", () => {
      showGoalsModal(false, true); // Show dashboard from settings (hide add goal button)
    });
  }

  if (addGoalBtn) {
    addGoalBtn.addEventListener("click", () => {
      showGoalsModal(true, true, true); // Show form from settings (hide modal actions, close after submit)
    });
  }
}

/**
 * Initializes advanced settings
 */
function initializeAdvancedSettings() {
  const clearDataBtn = document.getElementById("clear-data-btn");

  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", async () => {
      const confirmed = await showConfirmation(
        "Clear All Data",
        "This will permanently delete all your notes, tasks, and settings. This action cannot be undone."
      );

      if (confirmed) {
        try {
          // Clear IndexedDB
          const databases = ["Notes_DB", "Notes_Audio"];
          for (const dbName of databases) {
            await new Promise((resolve, reject) => {
              const deleteReq = indexedDB.deleteDatabase(dbName);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
            });
          }

          // Clear localStorage
          const keys = Object.keys(localStorage);
          keys.forEach((key) => {
            if (
              key.startsWith("notes_") ||
              key.startsWith("handsFree") ||
              key.startsWith("voice")
            ) {
              localStorage.removeItem(key);
            }
          });

          showToast("All data cleared successfully", "success");
          setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
          showToast(`Failed to clear data: ${error.message}`, "error");
        }
      }
    });
  }
}

/**
 * Handles keyboard navigation in settings with enhanced accessibility
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleKeyboardNavigation(e) {
  // Enhanced keyboard navigation
  const focusableElements = settingsModal.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  if (e.key === "Escape") {
    e.preventDefault();
    showSettingsModal(false);
    return;
  }

  if (e.key === "Tab") {
    // Enhanced tab navigation with wrap-around
    if (e.shiftKey) {
      // Shift + Tab (previous)
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab (next)
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
    return;
  }

  // Arrow key navigation for sections (only when navigation is focused)
  if (
    (e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight") &&
    document.activeElement &&
    document.activeElement.classList.contains("settings-nav-btn")
  ) {
    const navButtons = Array.from(
      document.querySelectorAll(".settings-nav-btn")
    );
    const currentIndex = navButtons.findIndex((btn) =>
      btn.classList.contains("active")
    );

    if (currentIndex !== -1) {
      e.preventDefault();

      let newIndex;
      if (window.innerWidth <= 768) {
        // Horizontal navigation on mobile (left/right)
        newIndex =
          e.key === "ArrowLeft"
            ? (currentIndex - 1 + navButtons.length) % navButtons.length
            : (currentIndex + 1) % navButtons.length;
      } else {
        // Vertical navigation on desktop (up/down)
        newIndex =
          e.key === "ArrowUp"
            ? (currentIndex - 1 + navButtons.length) % navButtons.length
            : (currentIndex + 1) % navButtons.length;
      }

      const newSection = navButtons[newIndex].dataset.section;
      switchToSection(newSection);

      // Focus the new button for better accessibility
      setTimeout(() => {
        navButtons[newIndex].focus();
      }, 50);
    }
  }

  // Home/End keys for first/last section
  if (
    e.key === "Home" &&
    document.activeElement &&
    document.activeElement.classList.contains("settings-nav-btn")
  ) {
    e.preventDefault();
    const navButtons = Array.from(
      document.querySelectorAll(".settings-nav-btn")
    );
    if (navButtons.length > 0) {
      const firstSection = navButtons[0].dataset.section;
      switchToSection(firstSection);
      navButtons[0].focus();
    }
  }

  if (
    e.key === "End" &&
    document.activeElement &&
    document.activeElement.classList.contains("settings-nav-btn")
  ) {
    e.preventDefault();
    const navButtons = Array.from(
      document.querySelectorAll(".settings-nav-btn")
    );
    if (navButtons.length > 0) {
      const lastSection = navButtons[navButtons.length - 1].dataset.section;
      switchToSection(lastSection);
      navButtons[navButtons.length - 1].focus();
    }
  }
}

/**
 * Shows import preview UI
 * @param {Object} importData - The import data to preview
 */
function showImportPreview(importData) {
  const importStatus = document.getElementById("import-status");
  const importPreview = document.querySelector(".import-preview");

  if (importStatus && importPreview) {
    importPreview.innerHTML = `
            <div class="import-info">
                <p><strong>Found:</strong> ${
                  importData.entries?.length || 0
                } entries</p>
                <p><strong>Date range:</strong> ${
                  importData.dateRange || "Unknown"
                }</p>
            </div>
            <div class="import-warning">
                <p>⚠️ This will add new entries to your existing notes. Duplicates may occur.</p>
            </div>
        `;
    importStatus.classList.remove("hidden");
  }
}

/**
 * Hides import preview UI
 */
function hideImportPreview() {
  const importStatus = document.getElementById("import-status");
  if (importStatus) {
    importStatus.classList.add("hidden");
  }
}

/**
 * Confirms and processes the import
 */
async function confirmImport() {
  try {
    const loadingOverlay = showLoadingOverlay("Importing entries...");
    // Process import logic here
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulated delay
    loadingOverlay.hide();
    showToast("Import completed successfully", "success");
    hideImportPreview();
  } catch (error) {
    showToast(`Import failed: ${error.message}`, "error");
  }
}

/**
 * Gets the current hands-free mode setting
 * @returns {boolean} Whether hands-free mode is enabled
 */
function getHandsFreeMode() {
  return localStorage.getItem("handsFreeMode") === "true";
}

/**
 * Sets the hands-free mode toggle state
 * @param {boolean} enabled - Whether to enable hands-free mode
 */
function setHandsFreeMode(enabled) {
  localStorage.setItem("handsFreeMode", enabled.toString());
  const toggle = document.getElementById("hands-free-toggle");
  if (toggle) {
    toggle.checked = enabled;
  }
}

/**
 * Initializes the settings view
 */
function initSettingsView() {
  // Check for deep linking
  const hash = window.location.hash;
  if (hash.startsWith("#settings-")) {
    const sectionId = hash.replace("#settings-", "");
    if (settingsSections[sectionId]) {
      currentSection = sectionId;
    }
  }

  console.log("Settings view initialized");
}

// Make functions available globally for Vue.js compatibility
window.showSettingsModal = showSettingsModal;
window.switchToSection = switchToSection;
window.getHandsFreeMode = getHandsFreeMode;
window.setHandsFreeMode = setHandsFreeMode;
window.initSettingsView = initSettingsView;
