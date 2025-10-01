import { formatDate } from './utils.js';

// --- DOM Element Selectors ---
export const bookshelfContainerEl = document.getElementById('bookshelf-container');
export const headerEl = document.getElementById('app-header');
export const searchInputEl = document.getElementById('search-input');
export const micButtonEl = document.getElementById('mic-button');

const emptyStateContainerEl = document.getElementById('empty-state-container');
const calendarTodayEl = document.getElementById('calendar-today');
const calendarWidget = document.getElementById('calendar-widget');
const bookViewerEl = document.getElementById('book-viewer');
const onThisDayWidget = document.getElementById('on-this-day-widget');
const viewerTitleEl = document.getElementById('viewer-title');
const viewerDateEl = document.getElementById('viewer-date');
const viewerTextLeftEl = document.getElementById('viewer-text-left');
const viewerTextRightEl = document.getElementById('viewer-text-right');
const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const addImageBtn = document.getElementById('add-image-btn');
const imageInput = document.getElementById('image-input');

const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const settingsCloseBtn = document.getElementById('settings-close-btn');
const handsFreeToggle = document.getElementById('hands-free-toggle');

const modalEl = document.getElementById('confirmation-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalMessageEl = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


// --- Calendar and Header ---

/**
 * Populates the calendar widget with today's and tomorrow's dates.
 */
export function initCalendar() {
    const today = new Date();
    document.getElementById('calendar-day-name').textContent = today.toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('calendar-day-number').textContent = today.getDate();
    document.getElementById('calendar-month').textContent = today.toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('calendar-year').textContent = today.getFullYear();

    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    document.getElementById('calendar-day-name-tomorrow').textContent = tomorrow.toLocaleDateString('en-US', { weekday: 'long' });
    document.getElementById('calendar-day-number-tomorrow').textContent = tomorrow.getDate();
    document.getElementById('calendar-month-tomorrow').textContent = tomorrow.toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('calendar-year-tomorrow').textContent = tomorrow.getFullYear();
}

/**
 * Adds the .is-peeling class to trigger the calendar animation, then removes it.
 */
export function triggerPeelAnimation() {
    if (!calendarTodayEl) return;
    calendarTodayEl.classList.add('is-peeling');
    setTimeout(() => {
        calendarTodayEl.classList.remove('is-peeling');
    }, 1500); // Must match the animation duration in animations.css
}

/**
 * Toggles the listening state class on the header for visual feedback.
 * @param {boolean} isListening 
 */
export function setHeaderListeningState(isListening) {
    if (headerEl) headerEl.classList.toggle('is-listening', isListening);
}

// --- UI State & Feedback ---

/** Sets the visual state of the ambient listening indicator. */
export function setAmbientIndicatorState(state) {
    calendarWidget.classList.remove('is-ambient-listening', 'is-command-mode');
    if (state === 'AMBIENT_LISTENING') {
        calendarWidget.classList.add('is-ambient-listening');
    } else if (state === 'COMMAND_MODE') {
        calendarWidget.classList.add('is-command-mode');
    }
}

// --- Settings Modal ---

export function showSettingsModal(show) {
    settingsModal.classList.toggle('hidden', !show);
}

export function getHandsFreeMode() {
    return localStorage.getItem('handsFreeMode') === 'true';
}

export function setHandsFreeMode(enabled) {
    localStorage.setItem('handsFreeMode', enabled);
    handsFreeToggle.checked = enabled;
}

// --- Image Handling ---

/** Inserts an image with an AI-generated caption into the editor. */
export function insertImage(imageDataUrl, caption) {
    const figure = `
        <figure contenteditable="false">
            <img src="${imageDataUrl}" alt="Journal image">
            <figcaption contenteditable="true">${caption}</figcaption>
        </figure>
    `;
    // Insert at cursor position
    document.execCommand('insertHTML', false, figure);
}

// --- Command Feedback ---

/** Shows feedback when a command is understood and being processed. */
export function showCommandUnderstood(message) {
    const actionBar = document.querySelector('.action-bar');
    const searchInput = document.getElementById('search-input');

    // Add processing class for visual feedback
    actionBar.classList.add('processing');

    // Show processing message in search input
    const originalPlaceholder = searchInput.textContent;
    searchInput.textContent = message;

    // Remove processing state after a short delay
    setTimeout(() => {
        actionBar.classList.remove('processing');
        searchInput.textContent = originalPlaceholder;
    }, 2000);
}

/** Shows feedback when a command is not understood. */
export function showCommandNotUnderstood() {
    const actionBar = document.querySelector('.action-bar');

    // Add error class for visual feedback (shake + red flash)
    actionBar.classList.add('error');

    // Create and show tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'command-feedback-tooltip';
    tooltip.textContent = "Sorry, I didn't understand that.";
    tooltip.style.cssText = `
        position: absolute;
        top: -40px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 82, 82, 0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 0.8rem;
        white-space: nowrap;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;

    actionBar.style.position = 'relative';
    actionBar.appendChild(tooltip);

    // Fade in tooltip
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 100);

    // Remove error state and tooltip after animation
    setTimeout(() => {
        actionBar.classList.remove('error');
        if (tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
    }, 2500);
}


// --- Bookshelf Rendering ---

/** Hides all shelves and the empty state message. */
function clearBookshelfView() {
    emptyStateContainerEl.classList.add('hidden');
    const shelves = bookshelfContainerEl.querySelectorAll('.shelf');
    shelves.forEach(shelf => shelf.remove());
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
    emptyStateContainerEl.classList.remove('hidden');
}

/** Shows a message when a search yields no results. */
export function showEmptySearchState(query) {
    clearBookshelfView();
    emptyStateContainerEl.innerHTML = `
        <h2 class="empty-state-title">No Entries Found</h2>
        <p class="empty-state-text">Your search for "<strong>${query}</strong>" did not match any entries.</p>
    `;
    emptyStateContainerEl.classList.remove('hidden');
}

// --- On This Day Feature ---

/**
 * Renders the "On This Day" widget with a summary or message.
 * @param {string|null} summary - The summary text, or null.
 * @param {'loading'|'success'|'empty'} state - The current state.
 */
export function renderOnThisDay(summary, state) {
    if (!onThisDayWidget) return;

    let content = '';
    switch (state) {
        case 'loading':
            content = `<div class="on-this-day-title">On This Day</div><p class="on-this-day-summary">Checking your memories...</p>`;
            break;
        case 'success':
            content = `<div class="on-this-day-title">On This Day</div><p class="on-this-day-summary">"${summary}"</p>`;
            break;
        case 'empty':
            // We can just keep it hidden if there are no memories.
            onThisDayWidget.classList.add('hidden');
            return; // Exit early
    }

    onThisDayWidget.innerHTML = content;
    onThisDayWidget.classList.remove('hidden');
}

/**
 * Renders all journal entries as cards on shelves.
 * @param {Array<Object>} notes - The array of note objects to render.
 */
export function renderBookshelf(notes) {
    clearBookshelfView();

    if (notes.length === 0) {
        renderWelcomeCard();
        return;
    }

    let currentShelf;
    const cardsPerShelf = Math.floor(bookshelfContainerEl.clientWidth / 280) || 4;
    const cardColors = ['--book-color-1', '--book-color-2', '--book-color-3', '--book-color-4', '--book-color-5'];

    notes.forEach((note, index) => {
        if (index % cardsPerShelf === 0) {
            currentShelf = document.createElement('div');
            currentShelf.className = 'shelf';
            bookshelfContainerEl.appendChild(currentShelf);
        }

        const cardTemplate = document.getElementById('card-template');
        const clone = cardTemplate.content.cloneNode(true);
        const cardEl = clone.querySelector('.journal-card');
        cardEl.dataset.noteId = note.id;
        cardEl.querySelector('.card-title').textContent = note.summary || 'An Entry';
        cardEl.querySelector('.card-snippet').textContent = note.oneLiner || '';
        cardEl.querySelector('.card-date').textContent = formatDate(note.createdAt);
        cardEl.style.borderTopColor = `var(${cardColors[index % cardColors.length]})`;
        // Staggered loading animation
        cardEl.style.animationDelay = `${index * 50}ms`;
        currentShelf.appendChild(clone);
    });
}

/** Prepends a single new card to the top shelf for an animated entry. */
export function prependCard(note) {
    emptyStateContainerEl.classList.add('hidden'); // Hide welcome message if it was there
    let firstShelf = bookshelfContainerEl.querySelector('.shelf');
    if (!firstShelf) {
        firstShelf = document.createElement('div');
        firstShelf.className = 'shelf';
        bookshelfContainerEl.prepend(firstShelf);
    }

    const cardTemplate = document.getElementById('card-template');
    const clone = cardTemplate.content.cloneNode(true);
    const cardEl = clone.querySelector('.journal-card');
    cardEl.dataset.noteId = note.id;
    cardEl.querySelector('.card-title').textContent = note.summary;
    cardEl.querySelector('.card-snippet').textContent = note.oneLiner;
    cardEl.querySelector('.card-date').textContent = formatDate(note.createdAt);
    cardEl.style.borderTopColor = `var(--book-color-1)`; // Always use a prominent color for new notes

    firstShelf.prepend(clone);
}


// --- Book Viewer Logic ---

/**
 * Splits HTML content logically across two page elements.
 * @param {string} noteContent - The HTML string content of the note.
 */
function splitContentForPages(noteContent) {
    viewerTextLeftEl.innerHTML = '';
    viewerTextRightEl.innerHTML = '';

    const parser = new DOMParser();
    const doc = parser.parseFromString(noteContent, 'text/html');
    const contentNodes = Array.from(doc.body.children);
    
    contentNodes.forEach(node => viewerTextLeftEl.appendChild(node));

    while (viewerTextLeftEl.scrollHeight > viewerTextLeftEl.clientHeight && viewerTextLeftEl.children.length > 1) {
        const lastElement = viewerTextLeftEl.lastElementChild;
        viewerTextRightEl.prepend(lastElement);
    }
}

/**
 * Opens the two-page reader view with a 3D animation.
 * @param {Object} note - The note object to display.
 */
export function openBook(note) {
    viewerTitleEl.textContent = note.summary || 'A Journal Entry';
    viewerDateEl.textContent = new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    splitContentForPages(note.content);
    bookViewerEl.dataset.noteId = note.id; // Store ID for edit/delete

    bookViewerEl.classList.remove('hidden');
    setTimeout(() => bookViewerEl.classList.add('is-open'), 10);
}

/**
 * Closes the two-page reader view with a 3D animation.
 */
export function closeBook() {
    bookViewerEl.classList.remove('is-open');
    // Ensure edit mode is off when closing
    if (saveBtn.classList.contains('hidden') === false) {
        toggleEditMode(false);
    }
    setTimeout(() => bookViewerEl.classList.add('hidden'), 600);
}

/** Toggles the content-editable state of the reader view. */
export function toggleEditMode(isEditing) {
    viewerTextLeftEl.setAttribute('contenteditable', isEditing);
    viewerTextRightEl.setAttribute('contenteditable', isEditing);

    editBtn.classList.toggle('hidden', isEditing);
    deleteBtn.classList.toggle('hidden', isEditing);
    saveBtn.classList.toggle('hidden', !isEditing);
    addImageBtn.classList.toggle('hidden', !isEditing); // Show/hide Add Image button

    if (isEditing) {
        viewerTextLeftEl.focus();
    }
}

/** Retrieves the combined, edited content from the reader pages. */
export function getEditedContent() {
    return viewerTextLeftEl.innerHTML + viewerTextRightEl.innerHTML;
}


// --- UI State Management ---

/**
 * Updates the microphone button's appearance based on the AI state.
 * @param {string} state - The current AI state.
 */
export function setMicButtonState(state) {
    if (!micButtonEl) return;
    micButtonEl.classList.remove('is-listening', 'is-hearing', 'is-capturing', 'is-processing');
    
    const micIcon = micButtonEl.querySelector('.mic-icon');
    const stopIcon = micButtonEl.querySelector('.stop-icon');
    const loaderIcon = micButtonEl.querySelector('.loader-icon');

    if (micIcon) micIcon.style.display = 'none';
    if (stopIcon) stopIcon.style.display = 'none';
    if (loaderIcon) loaderIcon.style.display = 'none';

    switch (state) {
        case 'listening': micButtonEl.classList.add('is-listening'); if (micIcon) micIcon.style.display = 'block'; micButtonEl.title = 'Listening for hotword...'; break;
        case 'hearing': micButtonEl.classList.add('is-listening', 'is-hearing'); if (micIcon) micIcon.style.display = 'block'; micButtonEl.title = 'Hearing audio...'; break;
        case 'capturing': micButtonEl.classList.add('is-capturing'); if (stopIcon) stopIcon.style.display = 'block'; micButtonEl.title = 'Capturing audio...'; break;
        case 'processing': micButtonEl.classList.add('is-processing'); if (loaderIcon) loaderIcon.style.display = 'block'; micButtonEl.title = 'Processing...'; break;
        default: if (micIcon) micIcon.style.display = 'block'; micButtonEl.title = 'Start Journaling'; break;
    }
}

/**
 * Displays a confirmation modal for future use.
 * @returns {Promise<boolean>}
 */
export function showConfirmation(title, message) {
    modalTitleEl.textContent = title;
    modalMessageEl.textContent = message;
    modalEl.classList.remove('hidden');

    return new Promise(resolve => {
        const confirmHandler = () => { modalEl.classList.add('hidden'); resolve(true); cleanup(); };
        const cancelHandler = () => { modalEl.classList.add('hidden'); resolve(false); cleanup(); };
        const overlayHandler = (event) => { if (event.target === modalEl) cancelHandler(); };
        
        const cleanup = () => {
            modalConfirmBtn.removeEventListener('click', confirmHandler);
            modalCancelBtn.removeEventListener('click', cancelHandler);
            modalEl.removeEventListener('click', overlayHandler);
        };
        
        modalConfirmBtn.addEventListener('click', confirmHandler, { once: true });
        modalCancelBtn.addEventListener('click', cancelHandler, { once: true });
        modalEl.addEventListener('click', overlayHandler);
    });
}