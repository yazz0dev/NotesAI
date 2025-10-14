// js/ui-manager.js

// Note: Imports will be handled via global window object for Vue.js compatibility

let recordingTimer = null;

// --- Loading Overlay ---
function showAppLoading() {
  document.body.classList.add("loading-active");
  document.getElementById("app-loading-overlay").classList.remove("hidden");
}

function updateLoadingProgress(step, status, progress) {
  const statusText = document.getElementById("loading-status");
  const progressBar = document.getElementById("loading-progress-bar");
  const stepElements = document.querySelectorAll(".loading-step");

  if (statusText) statusText.textContent = status;
  if (progressBar && progress !== null) {
    progressBar.style.width = `${progress}%`;
  }

  let stepReached = false;
  stepElements.forEach((el) => {
    if (stepReached) {
      el.classList.remove("active", "completed");
    }
    if (el.dataset.step === step) {
      el.classList.add("active");
      el.classList.remove("completed");
      stepReached = true;
    } else {
      el.classList.add("completed");
      el.classList.remove("active");
    }
  });
}

function hideAppLoading() {
  const overlay = document.getElementById("app-loading-overlay");
  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.classList.add("hidden");
    document.body.classList.remove("loading-active");
  }, 500);
}

// --- Header & Global UI ---
function setHeaderListeningState(isListening) {
  document
    .getElementById("app-header")
    .classList.toggle("listening", isListening);
}

function updateUIVoiceState(newState) {
  const micButton = document.getElementById("mic-button");
  if (!micButton) return;
  micButton.className = "mic-button"; // Reset
  switch (newState) {
    case "AMBIENT_LISTENING":
      micButton.classList.add("listening");
      break;
    case "COMMAND_MODE":
      micButton.classList.add("hearing");
      break;
    case "DICTATION_MODE":
      micButton.classList.add("capturing");
      break;
    case "IDLE":
      micButton.classList.add("idle");
      break;
  }
}

function initHeaderElements() {
  // Target the toolbar on the right side of the main content area
  const header = document.querySelector(".content-toolbar .toolbar-right");
  if (!header || header.querySelector(".header-controls")) return;

  const headerControls = document.createElement("div");
  headerControls.className = "header-controls";
  headerControls.innerHTML = `
        <button id="mic-button" class="mic-button idle btn btn-outline-secondary btn-sm" title="Voice control">
            <i class="bi bi-mic"></i>
        </button>
        <button id="settings-btn" class="settings-btn btn btn-outline-secondary btn-sm" title="Settings">
            <i class="bi bi-gear"></i>
        </button>
    `;
  header.insertBefore(headerControls, header.firstChild);
}

// --- Search & Input ---
function updateSearchInput(text) {
  document.getElementById("search-input").textContent = text;
}
function clearSearchInput() {
  document.getElementById("search-input").textContent = "";
}

// --- Note List Rendering ---
function renderNotesList(notesToRender) {
  const listEl = document.getElementById("notes-list");
  const emptyEl = document.getElementById("empty-state-container");
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = "";

  if (notesToRender.length === 0) {
    emptyEl.classList.remove("hidden");
    listEl.classList.add("hidden");
  } else {
    emptyEl.classList.add("hidden");
    listEl.classList.remove("hidden");
    const fragment = document.createDocumentFragment();
    notesToRender.forEach((note) => {
      const card = createNoteCard(note);
      fragment.appendChild(card);
    });
    listEl.appendChild(fragment);
  }
}

function createNoteCard(note) {
  const card = document.createElement("div");
  card.className = `note-card ${note.isFavorite ? "favorite" : ""}`;
  card.dataset.noteId = note.id;

  const snippet =
    note.content.replace(/<[^>]*>/g, "").substring(0, 150) + "...";

  card.innerHTML = `
        <div class="note-card-header">
            <h3 class="note-card-title">${note.summary || "Untitled"}</h3>
            <div class="note-card-actions d-flex gap-1">
                <button class="note-card-action favorite-btn btn btn-sm ${
                  note.isFavorite ? "btn-warning" : "btn-outline-secondary"
                }" title="Toggle Favorite">
                  <i class="bi bi-star${note.isFavorite ? "-fill" : ""}"></i>
                </button>
                <button class="note-card-action delete-btn btn btn-sm btn-outline-danger" title="Delete Note">
                  <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
        <div class="note-card-content"><p class="note-card-snippet">${snippet}</p></div>
        <div class="note-card-footer"><span class="note-card-date">${new Date(
          note.updatedAt
        ).toLocaleDateString()}</span></div>
    `;

  card.addEventListener("click", () =>
    openNoteInEditor(note.id, handler.getNotes())
  );
  card.querySelector(".favorite-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    handler.toggleFavorite(note.id);
  });
  card.querySelector(".delete-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    handler.deleteNote(note.id);
  });

  return card;
}

function filterAndRenderNotes({ notes, currentView, currentSort }) {
  let filtered = [...notes]; // Create a mutable copy

  // Filter logic
  if (currentView === "favorites") {
    filtered = filtered.filter((n) => n.isFavorite);
  } // Add other views like notebook, tags etc.

  // Sort logic
  filtered.sort((a, b) => {
    if (currentSort === "dateCreated")
      return new Date(b.createdAt) - new Date(a.createdAt);
    if (currentSort === "title") return a.summary.localeCompare(b.summary);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  const searchInput = document.getElementById("search-input");
  const query = searchInput ? searchInput.textContent.trim().toLowerCase() : "";
  if (query) {
    const currentFilter = handler.getCurrentFilter();
    filtered = filtered.filter((n) => {
      switch (currentFilter) {
        case "title":
          return n.summary && n.summary.toLowerCase().includes(query);
        case "content":
          return n.content && n.content.toLowerCase().includes(query);
        case "tags":
          // For now, search in both title and content for tags
          // TODO: Implement proper tag filtering when tag system is complete
          return (
            (n.summary && n.summary.toLowerCase().includes(query)) ||
            (n.content && n.content.toLowerCase().includes(query))
          );
        default: // "all"
          return (
            (n.summary && n.summary.toLowerCase().includes(query)) ||
            (n.content && n.content.toLowerCase().includes(query))
          );
      }
    });
  }

  renderNotesList(filtered);
}

// --- Editor ---
async function openNoteInEditor(noteId, notes) {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return;
  handler.setCurrentOpenNote(note);

  document.getElementById("editor-note-title").value = note.summary;
  document.getElementById("note-editor-content").innerHTML = note.content;
  document.getElementById("note-date").textContent = new Date(
    note.updatedAt
  ).toLocaleDateString();

  const audioContainer = document.getElementById("editor-audio-context");
  audioContainer.innerHTML = "";
  audioContainer.classList.add("hidden"); // Hide by default
  const audioData = await getAudioData(note.id);
  if (audioData) {
    const player = createAudioPlayer(
      audioData.audioDataUrl,
      audioData.duration / 1000
    );
    audioContainer.appendChild(player);
    audioContainer.classList.remove("hidden");
  }

  // Show the note editor by adding the editor-visible class to the app layout
  document.getElementById("app-layout").classList.add("editor-visible");
}

function closeEditor() {
  document.getElementById("app-layout").classList.remove("editor-visible");
  handler.setCurrentOpenNote(null);
}

function getEditorContent() {
  return {
    title: document.getElementById("editor-note-title").value,
    content: document.getElementById("note-editor-content").innerHTML,
  };
}

function setEditorStatus(status) {
  document.getElementById("editor-status").textContent = status;
}

// --- Sidebar & Navigation ---
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}
function setActiveNav(activeItem) {
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
  activeItem.classList.add("active");
}

// --- Toolbar ---
function toggleViewMode() {
  document.getElementById("notes-list").classList.toggle("list-view");
}

function updateSortButton(sort) {
  const sortTextMap = {
    dateModified: "Date Modified",
    dateCreated: "Date Created",
    title: "Title",
  };
  document.querySelector("#sort-btn .sort-text").textContent =
    sortTextMap[sort];
}

// --- Recording UI ---
function startRecordingUI() {
  startRecording().then((success) => {
    if (!success) return;
    const indicator = document.getElementById("recording-indicator");
    const timeEl = document.getElementById("recording-time");
    indicator.classList.remove("hidden");
    let startTime = Date.now();
    recordingTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      timeEl.textContent = `${mins}:${String(secs).padStart(2, "0")}`;
    }, 1000);
  });
}

function stopRecordingUI() {
  if (recordingTimer) {
    clearInterval(recordingTimer);
    recordingTimer = null;
  }
  document.getElementById("recording-indicator").classList.add("hidden");
  return stopRecording();
}

// NEW: Dynamic list rendering for sidebar
function updateNotebooksList(notebooks) {
  const listEl = document.getElementById("notebook-list");
  listEl.innerHTML = ""; // Clear old list
  notebooks.forEach((notebook) => {
    const item = document.createElement("div");
    item.className = "nav-item";
    item.dataset.notebookId = notebook.id;
    item.innerHTML = `
            <i class="bi bi-folder me-2" style="color: ${notebook.color}"></i>
            <span class="nav-text">${notebook.name}</span>
        `;
    item.addEventListener("click", () => {
      handler.setCurrentView(`notebook:${notebook.id}`);
      setActiveNav(item);
      filterAndRenderNotes({
        notes: handler.getNotes(),
        currentView: handler.getCurrentView(),
        currentSort: handler.getCurrentSort(),
      });
    });
    item.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showNotebookContextMenu(e, notebook);
    });
    listEl.appendChild(item);
  });
}

function updateTagsList(tags) {
  const listEl = document.getElementById("tag-list");
  listEl.innerHTML = "";
  tags.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "tag-sidebar-item";
    item.dataset.tagId = tag.id;
    item.innerHTML = `
            <div class="tag-color-dot" style="background-color: ${tag.color}"></div>
            <span>${tag.name}</span>
        `;
    item.addEventListener("click", () => {
      handler.setCurrentView(`tag:${tag.id}`);
      // This doesn't have a dedicated nav item, so we don't call setActiveNav
      filterAndRenderNotes({
        notes: handler.getNotes(),
        currentView: handler.getCurrentView(),
        currentSort: handler.getCurrentSort(),
      });
    });
    listEl.appendChild(item);
  });
}

function showNotebookModal() {
  const modal = document.getElementById("notebook-modal");
  const form = document.getElementById("notebook-form");
  const titleEl = document.getElementById("notebook-modal-title");
  const nameInput = document.getElementById("notebook-name-input");
  const colorInput = document.getElementById("notebook-color-input");
  const idInput = document.getElementById("notebook-id-input");

  // Reset form
  titleEl.textContent = "Create Notebook";
  nameInput.value = "";
  colorInput.value = "#007aff";
  idInput.value = "";

  modal.classList.remove("hidden");
}

function hideNotebookModal() {
  document.getElementById("notebook-modal").classList.add("hidden");
}

function showTagManagementModal(tags) {
  const modal = document.getElementById("tag-modal");
  modal.classList.remove("hidden");
  populateTagManagementModal(tags);
}

function hideTagManagementModal() {
  document.getElementById("tag-modal").classList.add("hidden");
}

function populateTagManagementModal(tags) {
  const tagList = document.getElementById("tag-management-list");
  if (!tagList) return;

  tagList.innerHTML = "";

  if (tags.length === 0) {
    tagList.innerHTML = '<div class="no-tags">No tags created yet</div>';
    return;
  }

  tags.forEach((tag) => {
    const tagItem = document.createElement("div");
    tagItem.className = "tag-manage-item";
    tagItem.dataset.tagId = tag.id;
    tagItem.dataset.tagName = tag.name;
    tagItem.innerHTML = `
      <input type="color" value="${tag.color}" class="tag-color-input">
      <input type="text" value="${tag.name}" class="tag-name-input form-control">
      <button class="delete-tag-btn btn btn-sm btn-outline-danger" title="Delete tag">
        <i class="bi bi-trash"></i>
      </button>
    `;

    tagList.appendChild(tagItem);
  });
}

function showTagSelectionModal(selectedTagIds = [], allTags = []) {
  const listEl = document.getElementById("tag-selection-list");
  listEl.innerHTML = "";
  allTags.forEach((tag) => {
    const item = document.createElement("div");
    item.className = "tag-select-item";
    item.dataset.tagId = tag.id;
    item.textContent = tag.name;
    if (selectedTagIds.includes(tag.id)) {
      item.classList.add("selected");
    }
    item.addEventListener("click", () => item.classList.toggle("selected"));
    listEl.appendChild(item);
  });
  document.getElementById("tag-selection-modal").classList.remove("hidden");
}

function hideTagSelectionModal() {
  document.getElementById("tag-selection-modal").classList.add("hidden");
}

function getSelectedTagsFromModal() {
  return Array.from(
    document.querySelectorAll("#tag-selection-list .selected")
  ).map((el) => el.dataset.tagId);
}

function renderNoteTagsInEditor(tagIds, allTags) {
  // This would render tags in the note editor if needed
  // For now, this is a placeholder for future functionality
  console.log("Rendering note tags in editor:", tagIds, allTags);
}

// NEW: Context Menu
function showNotebookContextMenu(event, notebook) {
  document.querySelector(".context-menu")?.remove(); // Remove any existing menu

  const menu = document.createElement("div");
  menu.className = "context-menu";
  menu.style.top = `${event.clientY}px`;
  menu.style.left = `${event.clientX}px`;

  menu.innerHTML = `
        <button class="context-menu-item" data-action="edit">Edit</button>
        <button class="context-menu-item" data-action="delete">Delete</button>
    `;

  document.body.appendChild(menu);

  const closeMenu = () => {
    menu.remove();
    document.removeEventListener("click", closeMenu);
  };

  menu.addEventListener("click", (e) => {
    const action = e.target.dataset.action;
    if (action === "edit") {
      showNotebookModal(notebook);
    } else if (action === "delete") {
      // This needs to be handled in event-handler.js
      console.warn("Delete action should be dispatched to event-handler");
    }
  });

  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

// Make functions available globally for Vue.js compatibility
window.showAppLoading = showAppLoading;
window.updateLoadingProgress = updateLoadingProgress;
window.hideAppLoading = hideAppLoading;
window.setHeaderListeningState = setHeaderListeningState;
window.updateUIVoiceState = updateUIVoiceState;
window.initHeaderElements = initHeaderElements;
window.updateSearchInput = updateSearchInput;
window.clearSearchInput = clearSearchInput;
window.renderNotesList = renderNotesList;
window.filterAndRenderNotes = filterAndRenderNotes;
window.openNoteInEditor = openNoteInEditor;
window.closeEditor = closeEditor;
window.getEditorContent = getEditorContent;
window.setEditorStatus = setEditorStatus;
window.toggleSidebar = toggleSidebar;
window.setActiveNav = setActiveNav;
window.toggleViewMode = toggleViewMode;
window.updateSortButton = updateSortButton;
window.startRecordingUI = startRecordingUI;
window.stopRecordingUI = stopRecordingUI;
window.updateNotebooksList = updateNotebooksList;
window.updateTagsList = updateTagsList;
window.showNotebookModal = showNotebookModal;
window.hideNotebookModal = hideNotebookModal;
window.showTagManagementModal = showTagManagementModal;
window.hideTagManagementModal = hideTagManagementModal;
window.populateTagManagementModal = populateTagManagementModal;
window.showTagSelectionModal = showTagSelectionModal;
window.hideTagSelectionModal = hideTagSelectionModal;
window.getSelectedTagsFromModal = getSelectedTagsFromModal;
window.renderNoteTagsInEditor = renderNoteTagsInEditor;

// Create UI object that groups all UI functions for ai-coordinator compatibility
window.ui = {
  updateUIVoiceState: window.updateUIVoiceState,
  startRecordingUI,
  stopRecordingUI,
  updateSearchInput: window.updateSearchInput,
  clearSearchInput: window.clearSearchInput,
  setHeaderListeningState: window.setHeaderListeningState,
  showCommandNotUnderstood: window.showCommandNotUnderstood,
  showCommandUnderstood: window.showCommandUnderstood,
};
