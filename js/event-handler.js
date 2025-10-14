// js/event-handler.js

// Note: Imports will be handled via global window object for Vue.js compatibility

// --- Modal Functions ---

// showNotebookModal and hideNotebookModal functions removed - now handled by ui-manager.js

// Handle tag selection confirmation
async function confirmTagSelection() {
  const modal = document.getElementById("tag-selection-modal");
  const noteId = modal.dataset.noteId;

  if (!noteId) return;

  try {
    const allTags = await tagService.getAllTags();
    const selectedTagElements = modal.querySelectorAll(
      ".tag-select-item.selected"
    );
    const selectedTagNames = Array.from(selectedTagElements).map(
      (el) => el.querySelector(".tag-name").textContent
    );
    const selectedTags = allTags.filter((tag) =>
      selectedTagNames.includes(tag.name)
    );

    // Update the note with selected tags
    const note = await store.getNote(noteId);
    note.tags = selectedTags.map((tag) => tag.id);
    await store.updateNote(note);

    hideTagSelectionModal();
    showToast(`Updated tags for note`, "success");

    // Refresh the notes list
    const notes = await store.getNotes();
    handler.setNotes(notes);
    ui.filterAndRenderNotes({
      notes: handler.getNotes(),
      currentView: handler.getCurrentView(),
      currentSort: handler.getCurrentSort(),
    });
  } catch (error) {
    console.error("Failed to update note tags:", error);
    showToast("Failed to update tags", "error");
  }
}

document
  .getElementById("confirm-tag-selection-btn")
  .addEventListener("click", confirmTagSelection);

document
  .getElementById("cancel-tag-selection-btn")
  .addEventListener("click", hideTagSelectionModal);

function hideTagSelectionModal() {
  const modal = document.getElementById("tag-selection-modal");
  modal.classList.add("hidden");
  delete modal.dataset.noteId;
}

// NEW: Tag Form Handlers
async function handleAddTagFormSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById("new-tag-name-input");
  const colorInput = document.getElementById("new-tag-color-input");
  const name = nameInput.value.trim();
  if (!name) return;

  try {
    await store.createTag(name, colorInput.value);
    nameInput.value = ""; // Clear input
    await refreshTags();
  } catch (error) {
    showToast("Failed to create tag.", "error");
  }
}

async function handleTagUpdate(tagId, newName) {
  try {
    await store.updateTag(tagId, { name: newName });
    await refreshTags();
  } catch (error) {
    showToast("Failed to update tag.", "error");
  }
}

async function handleTagDelete(tagId, tagName) {
  const confirmed = await showConfirmation(
    "Delete Tag",
    `Are you sure you want to delete the tag "${tagName}"? It will be removed from all notes.`
  );
  if (confirmed) {
    try {
      await store.deleteTag(tagId);
      await refreshTags();
      showToast("Tag deleted.", "success");
    } catch (error) {
      showToast("Failed to delete tag.", "error");
    }
  }
}

async function handleTagSelectionConfirm() {
  if (!currentOpenNote) return;

  const selectedIds = ui.getSelectedTagsFromModal();
  try {
    // Simple update: just replace the tags array
    const updatedNote = { ...currentOpenNote, tags: selectedIds };
    await store.updateNote(updatedNote);
    currentOpenNote.tags = selectedIds; // update local state

    // Update main notes array
    const index = notes.findIndex((n) => n.id === currentOpenNote.id);
    if (index !== -1) notes[index] = currentOpenNote;

    ui.hideTagSelectionModal();
    ui.renderNoteTagsInEditor(currentOpenNote.tags, tags); // NEW UI function needed
    showToast("Tags updated.", "success");
  } catch (error) {
    showToast("Failed to update tags.", "error");
  }
}

// NEW: Notebook Form Handler
async function handleNotebookFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("notebook-id-input").value;
  const name = document.getElementById("notebook-name-input").value.trim();
  const color = document.getElementById("notebook-color-input").value;

  if (!name) return showToast("Notebook name is required.", "error");

  try {
    if (id) {
      await store.updateNotebook(id, { name, color });
      showToast("Notebook updated.", "success");
    } else {
      await store.createNotebook(name, "", color);
      showToast("Notebook created.", "success");
    }
    ui.hideNotebookModal();
    await refreshNotebooks();
  } catch (error) {
    showToast("Failed to save notebook.", "error");
  }
}


// --- State ---
let notes = [];
let notebooks = []; // NEW
let tags = []; // NEW
let currentOpenNote = null;
let currentView = "all-notes";
let currentSort = "dateModified";
let searchTimeout = null;

// --- State Management Functions ---
function getNotes() {
  return notes;
}
function setNotes(newNotes) {
  notes = newNotes;
}
function getCurrentOpenNote() {
  return currentOpenNote;
}
function setCurrentOpenNote(note) {
  currentOpenNote = note;
}
function getCurrentView() {
  return currentView;
}
function setCurrentView(view) {
  currentView = view;
}
function getCurrentSort() {
  return currentSort;
}
function setCurrentSort(sort) {
  currentSort = sort;
}
function getTags() {
  return tags;
} // NEW
function getNotebooks() {
  return notebooks;
} // NEW

// --- Event Handlers ---

async function createNewNote() {
  try {
    const newNote = await safeStore.addNote(
      "<p>Start writing...</p>",
      "New Note",
      "A new note."
    );
    notes.unshift(newNote);
    ui.renderNotesList(notes);
    ui.openNoteInEditor(newNote.id, notes);
  } catch (error) {
    console.error("Failed to create new note", error);
    showToast("Could not create note.", "error");
  }
}

async function deleteNote(noteId) {
  const confirmed = await showConfirmation(
    "Delete Note",
    "Are you sure you want to permanently delete this note?"
  );
  if (confirmed) {
    await safeStore.deleteNote(noteId);
    notes = notes.filter((n) => n.id !== noteId);
    if (currentOpenNote?.id === noteId) ui.closeEditor();
    ui.renderNotesList(notes);
    showToast("Note deleted.", "success");
  }
}

async function toggleFavorite(noteId) {
  const note = notes.find((n) => n.id === noteId);
  if (note) {
    await safeStore.toggleFavoriteNote(noteId);
    note.isFavorite = !note.isFavorite; // Optimistic update
    ui.renderNotesList(notes);
    showToast(
      note.isFavorite ? "Added to favorites" : "Removed from favorites",
      "info"
    );
  }
}

function handleSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    ui.filterAndRenderNotes({ notes, currentView, currentSort });
  }, 300);
}

function getCurrentFilter() {
  const activeFilterBtn = document.querySelector(".filter-btn.active");
  return activeFilterBtn ? activeFilterBtn.dataset.filter : "all";
}

// NEW: Organization Data Handlers
async function loadOrganizationData() {
  notebooks = await safeStore.getNotebooks();
  tags = await safeStore.getTags();
  ui.updateNotebooksList(notebooks);
  ui.updateTagsList(tags);
}

async function refreshNotebooks() {
  notebooks = await safeStore.getNotebooks();
  ui.updateNotebooksList(notebooks);
}

async function refreshTags() {
  tags = await safeStore.getTags();
  ui.updateTagsList(tags);
  // Also refresh tag management modal if it's open
  if (!document.getElementById("tag-modal").classList.contains("hidden")) {
    ui.populateTagManagementModal(tags);
  }
}

function renderNotebooks(notebooks) {
  const notebookList = document.getElementById("notebook-list");
  if (!notebookList) return;

  // Clear existing dynamic notebooks (keep hardcoded ones if any)
  const existingNotebooks = notebookList.querySelectorAll("[data-notebook-id]");
  existingNotebooks.forEach((nb) => nb.remove());

  // Add notebooks
  notebooks.forEach((notebook) => {
    const notebookEl = document.createElement("div");
    notebookEl.className = "nav-item";
    notebookEl.dataset.notebook = notebook.id;
    notebookEl.innerHTML = `
      <i class="bi bi-folder me-2" style="color: ${notebook.color}"></i>
      <span class="nav-text">${notebook.name}</span>
    `;

    notebookEl.addEventListener("click", () => {
      currentView = `notebook:${notebook.id}`;
      ui.setActiveNav(notebookEl);
      ui.filterAndRenderNotes({ notes, currentView, currentSort });
    });

    notebookList.appendChild(notebookEl);
  });
}

function renderTags(tags) {
  const tagList = document.getElementById("tag-list");
  if (!tagList) return;

  tagList.innerHTML = "";

  if (tags.length === 0) {
    tagList.innerHTML = '<div class="no-tags">No tags yet</div>';
    return;
  }

  tags.forEach((tag) => {
    const tagEl = document.createElement("div");
    tagEl.className = "tag-sidebar-item";
    tagEl.innerHTML = `
      <span class="tag-color-dot" style="background-color: ${tag.color}"></span>
      <span class="tag-name">${tag.name}</span>
    `;

    tagEl.addEventListener("click", () => {
      currentView = `tag:${tag.id}`;
      ui.filterAndRenderNotes({ notes, currentView, currentSort });
    });

    tagList.appendChild(tagEl);
  });
}

async function saveNoteFromEditor() {
  if (!currentOpenNote) return;

  const { title, content } = ui.getEditorContent();
  if (currentOpenNote.summary === title && currentOpenNote.content === content)
    return;

  ui.setEditorStatus("Saving...");
  try {
    const updatedNote = {
      ...currentOpenNote,
      summary: title,
      content,
      updatedAt: new Date().toISOString(),
    };
    await safeStore.updateNote(updatedNote);
    const index = notes.findIndex((n) => n.id === updatedNote.id);
    if (index !== -1) notes[index] = updatedNote;
    ui.filterAndRenderNotes({ notes, currentView, currentSort });
    ui.setEditorStatus("Saved!");
    setTimeout(() => ui.setEditorStatus("Ready"), 2000);
  } catch (error) {
    ui.setEditorStatus("Save failed");
  }
}

// --- Global Event Listener Setup ---

function setupGlobalEventListeners() {
  // Sidebar and main actions
  document
    .getElementById("sidebar-toggle")
    .addEventListener("click", ui.toggleSidebar);
  document
    .getElementById("new-note-btn")
    .addEventListener("click", createNewNote);
  document
    .getElementById("empty-state-new-note")
    .addEventListener("click", createNewNote);
  document
    .getElementById("settings-btn")
    .addEventListener("click", () => showSettingsModal(true));

  // Tag management (now handled by UI manager)
  // showTagModal function removed - now handled by ui-manager.js

  // NEW: Organization Listeners
  document
    .getElementById("notebook-form")
    .addEventListener("submit", handleNotebookFormSubmit);
  document
    .getElementById("cancel-notebook-btn")
    .addEventListener("click", ui.hideNotebookModal);

  document
    .getElementById("manage-tags-btn")
    .addEventListener("click", () => ui.showTagManagementModal(tags));
  document
    .getElementById("add-notebook-btn")
    .addEventListener("click", () => ui.showNotebookModal());
  document
    .getElementById("add-tag-form")
    .addEventListener("submit", handleAddTagFormSubmit);
  document
    .getElementById("cancel-tag-btn")
    .addEventListener("click", ui.hideTagManagementModal);

  // Editor-specific organization
  document
    .getElementById("editor-tag-btn")
    .addEventListener("click", () =>
      ui.showTagSelectionModal(currentOpenNote.tags || [], tags)
    );
  document
    .getElementById("confirm-tag-selection-btn")
    .addEventListener("click", handleTagSelectionConfirm);
  document
    .getElementById("cancel-tag-selection-btn")
    .addEventListener("click", ui.hideTagSelectionModal);

  // Event delegation for dynamically created elements
  document
    .getElementById("tag-management-list")
    .addEventListener("click", (e) => {
      if (e.target.closest(".delete-tag-btn")) {
        const item = e.target.closest(".tag-manage-item");
        handleTagDelete(item.dataset.tagId, item.dataset.tagName);
      }
    });
  document
    .getElementById("tag-management-list")
    .addEventListener("change", (e) => {
      if (e.target.classList.contains("tag-name-input")) {
        const item = e.target.closest(".tag-manage-item");
        handleTagUpdate(item.dataset.tagId, e.target.value);
      }
    });

  // Navigation
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      currentView = item.dataset.view || `notebook:${item.dataset.notebook}`;
      ui.setActiveNav(item);
      ui.filterAndRenderNotes({ notes, currentView, currentSort });
    });
  });

  // Toolbar
  document
    .getElementById("search-input")
    .addEventListener("input", handleSearch);

  // Search filters
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      handleSearch();
    });
  });
  document
    .getElementById("view-toggle")
    .addEventListener("click", ui.toggleViewMode);
  document.getElementById("sort-btn").addEventListener("click", () => {
    const sortOptions = ["dateModified", "dateCreated", "title"];
    const currentIndex = sortOptions.indexOf(currentSort);
    currentSort = sortOptions[(currentIndex + 1) % sortOptions.length];
    ui.updateSortButton(currentSort);
    ui.filterAndRenderNotes({ notes, currentView, currentSort });
  });

  // Editor
  document
    .getElementById("editor-close-btn")
    .addEventListener("click", ui.closeEditor);
  document
    .getElementById("editor-save-btn")
    .addEventListener("click", async () => {
      await saveNoteFromEditor();
      ui.closeEditor();
    });
  document
    .getElementById("editor-cancel-btn")
    .addEventListener("click", ui.closeEditor);

  // Editor action buttons
  document.getElementById("editor-tag-btn").addEventListener("click", () => {
    if (currentOpenNote) {
      ui.showTagSelectionModal(currentOpenNote.tags || [], tags);
    }
  });
  document
    .getElementById("editor-note-title")
    .addEventListener("input", debounce(saveNoteFromEditor, 2000));
  document
    .getElementById("note-editor-content")
    .addEventListener("input", debounce(saveNoteFromEditor, 2000));

  // AI Mic Button
  document
    .getElementById("mic-button")
    .addEventListener("click", handleMicButtonClick);

  // Custom event listeners for cross-module communication
  document.addEventListener("noteAdded", (e) => {
    notes.unshift(e.detail.note);
    ui.renderNotesList(notes);
  });

  document.addEventListener("aiCommand", (e) => {
    const command = e.detail;
    switch (command.action) {
      case "search_notes":
        ui.updateSearchInput(command.params.query);
        handleSearch();
        break;
      case "go_back":
        if (currentOpenNote) ui.closeEditor();
        break;
      case "delete_current":
        if (currentOpenNote) deleteNote(currentOpenNote.id);
        break;
    }
  });

  // NEW: View change events
  document.addEventListener("viewChanged", (e) => {
    const { view } = e.detail;
    currentView = view;
    ui.setActiveNav(
      document.querySelector(
        `[data-view="${view}"], [data-notebook="${view.split(":")[1]}"]`
      )
    );
    ui.filterAndRenderNotes({ notes, currentView, currentSort });
  });

  // Goals Modal Events
  document
    .getElementById("goals-close-btn")
    .addEventListener("click", hideGoalsModal);
  document
    .getElementById("add-new-goal-btn")
    .addEventListener("click", () => showGoalForm());
  document
    .getElementById("cancel-goal-btn")
    .addEventListener("click", () => hideGoalForm());
  document
    .getElementById("goal-form-element")
    .addEventListener("submit", (e) => handleGoalFormSubmit(e, notes));
  document
    .getElementById("goal-type-select")
    .addEventListener("change", handleGoalTypeChange);
}

function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Make functions available globally for Vue.js compatibility
window.getNotes = getNotes;
window.setNotes = setNotes;
window.getCurrentOpenNote = getCurrentOpenNote;
window.setCurrentOpenNote = setCurrentOpenNote;
window.getCurrentView = getCurrentView;
window.setCurrentView = setCurrentView;
window.getCurrentSort = getCurrentSort;
window.setCurrentSort = setCurrentSort;
window.getTags = getTags;
window.getNotebooks = getNotebooks;
window.createNewNote = createNewNote;
window.deleteNote = deleteNote;
window.toggleFavorite = toggleFavorite;
window.handleSearch = handleSearch;
window.getCurrentFilter = getCurrentFilter;
window.loadOrganizationData = loadOrganizationData;
window.saveNoteFromEditor = saveNoteFromEditor;
window.setupGlobalEventListeners = setupGlobalEventListeners;
