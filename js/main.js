import * as store from './store.js';
import * as view from './view.js';
import { initAIService, startAmbientListening, stopAmbientListening } from './ai-service.js';

let notes = [];
let currentOpenNote = null; // Track the currently open note object
// NEW: Application Context
let appContext = { view: 'bookshelf', openNoteId: null };
let searchTimeout = null;
// NEW: Voice state tracking for mic button logic
let voiceState = 'IDLE';

/**
 * Initializes the application.
 */
async function init() {
    console.log("App initializing...");
    view.initCalendar();

    await store.initDB();
    notes = await store.getNotes();

    // Clear the container before the initial render
    document.getElementById('bookshelf-container').innerHTML = '';
    view.renderBookshelf(notes);

    setupEventListeners();
    initAI();
    schedulePeelAnimation(); // Start the random animation loop
    checkForOnThisDayMemories(); // Check for memories on startup

    // Auto-start ambient listening if user enabled it previously
    if (view.getHandsFreeMode()) {
        startAmbientListening();
    }

    console.log("App ready.");
}

/**
 * Sets up all the primary event listeners for the application.
 */
function setupEventListeners() {
    const actionBar = document.querySelector('.action-bar');
    const micButton = document.getElementById('mic-button');

    view.searchInputEl.addEventListener('focus', () => actionBar.classList.add('is-focused'));
    view.searchInputEl.addEventListener('blur', () => {
        if (view.searchInputEl.textContent.trim() === '') {
            actionBar.classList.remove('is-focused');
        }
    });

    micButton.addEventListener('click', handleMicButtonClick);
    view.searchInputEl.addEventListener('input', handleSearchInput);

    view.bookshelfContainerEl.addEventListener('click', handleCardClick);
    document.getElementById('close-viewer-btn').addEventListener('click', () => view.closeBook());

    // Add new listeners for edit/delete
    document.getElementById('edit-btn').addEventListener('click', handleEditClick);
    document.getElementById('save-btn').addEventListener('click', handleSaveClick);
    document.getElementById('delete-btn').addEventListener('click', handleDeleteClick);

    // NEW: Settings listeners
    document.getElementById('settings-btn').addEventListener('click', () => view.showSettingsModal(true));
    document.getElementById('settings-close-btn').addEventListener('click', () => view.showSettingsModal(false));
    document.getElementById('hands-free-toggle').addEventListener('change', (e) => {
        view.setHandsFreeMode(e.target.checked);
        if (e.target.checked) {
            startAmbientListening();
        } else {
            stopAmbientListening();
        }
    });

    // NEW: Image listeners
    document.getElementById('add-image-btn').addEventListener('click', () => document.getElementById('image-input').click());
    document.getElementById('image-input').addEventListener('change', handleImageUpload);
}

/**
 * Schedules the next calendar peel animation at a random interval for a subtle effect.
 */
function schedulePeelAnimation() {
    const minDelay = 8000;  // 8 seconds
    const maxDelay = 20000; // 20 seconds
    const randomDelay = Math.random() * (maxDelay - minDelay) + minDelay;

    setTimeout(() => {
        view.triggerPeelAnimation();
        schedulePeelAnimation(); // Re-schedule the next one
    }, randomDelay);
}

/**
 * Handles clicks on journal cards to open the detailed reading view.
 * @param {Event} event - The click event.
 */
function handleCardClick(event) {
    const cardEl = event.target.closest('.journal-card');
    if (cardEl) {
        const noteId = cardEl.dataset.noteId;
        currentOpenNote = notes.find(note => note.id === noteId);
        if (currentOpenNote) {
            view.openBook(currentOpenNote);
            setAppContext({ view: 'reader', openNoteId: currentOpenNote.id });
        }
    }
}


/**
 * Handles state changes from the AI service to update the UI.
 * @param {string} state - The new AI state (e.g., 'listening', 'processing').
 */
function handleAIStateChange(state) {
    view.setMicButtonState(state);
    const isBusy = ['listening', 'hearing', 'capturing', 'processing'].includes(state);
    view.setHeaderListeningState(isBusy);
}

/**
 * Updates the search input with the live transcript from the AI service.
 * @param {string} transcript - The interim transcript.
 */
function handleAITranscriptUpdate(transcript) {
    view.searchInputEl.textContent = transcript;
    document.querySelector('.action-bar').classList.add('is-focused');
}

/**
 * Processes the final formatted text from the AI service.
 * @param {string} formattedText - The final, cleaned-up journal entry.
 */
async function handleAIFinalResult(formattedText) {
    view.searchInputEl.textContent = '';
    document.querySelector('.action-bar').classList.remove('is-focused');
    if (!formattedText) return;

    try {
        view.setHeaderListeningState(true); // Show processing state

        // Check if chrome.ai is available
        if (!chrome?.ai?.prompt) {
            console.warn("Chrome AI API not available for entry processing, using fallback");
            const title = 'New Entry';
            const oneLiner = 'A new journal entry was created.';
        } else {
            // AI Task 1: Generate a short, creative title for the card.
            const titlePrompt = `Create a short, creative title (1-5 words) for the following journal entry. Entry: "${formattedText}"`;
            const titleResult = await chrome.ai.prompt({ prompt: titlePrompt });
            const title = titleResult.text.trim().replace(/"/g, '');

            // AI Task 2: Generate a single, descriptive sentence for the card snippet.
            const oneLinerPrompt = `Generate a single, descriptive sentence summarizing the following journal entry. Be concise. Entry: "${formattedText}"`;
            const oneLinerResult = await chrome.ai.prompt({ prompt: oneLinerPrompt });
            const oneLiner = oneLinerResult.text.trim();
        }

        // Save the new note to the database.
        const newNote = await store.addNote(
            `<p>${formattedText.replace(/\n/g, '</p><p>')}</p>`,
            title,
            oneLiner
        );

        // Update the local state and use efficient UI update:
        notes.unshift(newNote);
        view.prependCard(newNote);

    } catch (error) {
        console.error("Error creating note with AI summary:", error);
        // Fallback if AI fails, to ensure the user's entry is not lost.
        const newNote = await store.addNote(`<p>${formattedText.replace(/\n/g, '</p><p>')}</p>`, 'Untitled Entry', 'A new journal entry was saved.');
        notes.unshift(newNote);
        view.prependCard(newNote);
    } finally {
        view.setHeaderListeningState(false);
    }
}

/**
 * Handles user input in the search bar to filter notes.
 */
function handleSearchInput() {
    const query = view.searchInputEl.textContent.trim();
    // If the query is empty, render all notes.
    if (query === '') {
        document.getElementById('bookshelf-container').innerHTML = '';
        view.renderBookshelf(notes);
        return;
    }
    // Debounce the search to avoid excessive AI calls.
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterNotes(query), 300);
}

/**
 * Uses the AI to filter notes based on a natural language query.
 * @param {string} query - The user's search query.
 */
async function filterNotes(query) {
    view.setHeaderListeningState(true);

    // Check if chrome.ai is available
    if (!chrome?.ai?.prompt) {
        console.warn("Chrome AI API not available, falling back to simple text search");
        // Fallback to simple text-based filtering
        const filteredNotes = notes.filter(note =>
            note.summary?.toLowerCase().includes(query.toLowerCase()) ||
            note.oneLiner?.toLowerCase().includes(query.toLowerCase()) ||
            note.content?.toLowerCase().includes(query.toLowerCase())
        );

        if (filteredNotes.length > 0) {
            view.renderBookshelf(filteredNotes);
        } else {
            view.showEmptySearchState(query);
        }
        view.setHeaderListeningState(false);
        return;
    }

    const promises = notes.map(note => {
        const prompt = `Does the user's search query "${query}" relate to a journal entry with the title: "${note.summary}"? Respond with only "YES" or "NO".`;
        return chrome.ai.prompt({ prompt }).then(result => {
            return result.text.trim().toUpperCase() === 'YES' ? note : null;
        }).catch(() => null); // Ignore errors for individual prompts
    });

    const filteredResults = await Promise.all(promises);
    const matchingNotes = filteredResults.filter(note => note !== null);

    // Update to handle empty state
    if (matchingNotes.length > 0) {
        view.renderBookshelf(matchingNotes);
    } else {
        view.showEmptySearchState(query);
    }
    view.setHeaderListeningState(false);
}

// --- New Edit/Delete Handlers ---

function handleEditClick() {
    view.toggleEditMode(true);
}

async function handleSaveClick() {
    const newContent = view.getEditedContent();
    if (currentOpenNote && currentOpenNote.content !== newContent) {
        currentOpenNote.content = newContent;

        // Also update summary and one-liner with AI
        view.setHeaderListeningState(true);

        if (chrome?.ai?.prompt) {
            const titlePrompt = `Create a short, creative title (1-5 words) for the entry: "${newContent}"`;
            const titleResult = await chrome.ai.prompt({ prompt: titlePrompt });
            currentOpenNote.summary = titleResult.text.trim().replace(/"/g, '');

            const oneLinerPrompt = `Generate a single, descriptive sentence for the entry: "${newContent}"`;
            const oneLinerResult = await chrome.ai.prompt({ prompt: oneLinerPrompt });
            currentOpenNote.oneLiner = oneLinerResult.text.trim();
        } else {
            console.warn("Chrome AI API not available for save operation, using fallback");
            // Generate simple fallback titles
            currentOpenNote.summary = 'Updated Entry';
            currentOpenNote.oneLiner = 'This journal entry has been modified.';
        }

        view.setHeaderListeningState(false);

        const updatedNote = await store.updateNote(currentOpenNote);

        // Update the note in the main array
        const index = notes.findIndex(note => note.id === updatedNote.id);
        if (index !== -1) notes[index] = updatedNote;

        // Re-render the whole bookshelf to reflect the changes
        view.renderBookshelf(notes);
    }
    view.toggleEditMode(false);
}

async function handleDeleteClick() {
    const confirmed = await view.showConfirmation(
        'Delete Entry',
        'Are you sure you want to permanently delete this journal entry? This action cannot be undone.'
    );

    if (confirmed && currentOpenNote) {
        await store.deleteNote(currentOpenNote.id);
        notes = notes.filter(note => note.id !== currentOpenNote.id);
        view.closeBook();
        view.renderBookshelf(notes);
    }
}

/**
 * Checks for past entries from the same day and displays a summary if found.
 */
async function checkForOnThisDayMemories() {
    try {
        view.renderOnThisDay(null, 'loading');
        const today = new Date();
        const pastNotes = await store.getNotesByDate(today.getMonth(), today.getDate());

        if (pastNotes.length > 0) {
            const combinedContent = pastNotes.map(note => {
                // Strip HTML for better summarization
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = note.content;
                return tempDiv.textContent || tempDiv.innerText || "";
            }).join('\n\n');

            if (chrome?.ai?.summarize) {
                const summaryResult = await chrome.ai.summarize({ text: combinedContent });
                view.renderOnThisDay(summaryResult.text, 'success');
            } else {
                console.warn("Chrome AI Summarize API not available, using fallback");
                // Create a simple summary from the first note's content
                const firstNoteContent = pastNotes[0].content.replace(/<[^>]*>/g, '').substring(0, 100) + '...';
                view.renderOnThisDay(`From ${pastNotes.length} year(s) ago: ${firstNoteContent}`, 'success');
            }
        } else {
            view.renderOnThisDay(null, 'empty');
        }
    } catch (error) {
        console.error("Error checking for 'On This Day' memories:", error);
        view.renderOnThisDay(null, 'empty'); // Hide on error
    }
}

// --- Application Context Manager ---
function setAppContext(newContext) {
    appContext = { ...appContext, ...newContext };
    console.log("App context updated:", appContext);
}

function closeBookAndResetContext() {
    view.closeBook();
    setAppContext({ view: 'bookshelf', openNoteId: null });
}

// --- Command Dispatcher ---
function onAICommand(command) {
    // Handle unknown commands
    if (command.action === 'unknown') {
        view.showCommandNotUnderstood();
        return;
    }

    // Show command understood feedback before executing
    let feedbackMessage = '';
    switch (command.action) {
        case 'search_notes':
            feedbackMessage = `Searching for "${command.params.query}"...`;
            break;
        case 'go_back':
            feedbackMessage = 'Going back...';
            break;
        case 'delete_current':
            feedbackMessage = 'Deleting entry...';
            break;
        case 'edit_current':
            feedbackMessage = 'Opening edit mode...';
            break;
        case 'add_image':
            feedbackMessage = 'Adding image...';
            break;
        case 'stop_listening':
            feedbackMessage = 'Stopping voice control...';
            break;
        default:
            feedbackMessage = 'Processing command...';
    }

    if (feedbackMessage) {
        view.showCommandUnderstood(feedbackMessage);
    }

    // Execute the command after a brief delay to show feedback
    setTimeout(() => {
        executeCommand(command);
    }, 300);
}

function executeCommand(command) {
    switch (command.action) {
        case 'search_notes':
            view.searchInputEl.textContent = command.params.query;
            filterNotes(command.params.query);
            break;
        case 'go_back':
            if (appContext.view === 'reader') closeBookAndResetContext();
            break;
        case 'delete_current':
            if (appContext.view === 'reader') handleDeleteClick();
            break;
        case 'edit_current':
            if (appContext.view === 'reader') handleEditClick();
            break;
        case 'add_image':
             if (appContext.view === 'reader') document.getElementById('image-input').click();
            break;
        case 'stop_listening':
            stopAmbientListening();
            view.setHandsFreeMode(false);
            break;
    }
}

function handleMicButtonClick() {
    if (view.getHandsFreeMode()) {
        // In hands-free mode, toggle ambient listening
        if (voiceState === 'AMBIENT_LISTENING' || voiceState === 'COMMAND_MODE') {
            stopAmbientListening();
        } else {
            startAmbientListening();
        }
    } else {
        // In traditional mode, start dictation (old behavior)
        if (voiceState === 'IDLE') {
            startAmbientListening(); // This will trigger intent detection for dictation
        }
    }
}

function onAIStateChange(newState) {
    // Update global voice state for mic button logic
    voiceState = newState;

    // Pass state to UI for indicator
    view.setAmbientIndicatorState(newState);

    // Update main mic button to reflect dictation state
    if (newState === 'DICTATION_MODE') {
        view.setMicButtonState('capturing');
    } else if (newState === 'AMBIENT_LISTENING' || newState === 'IDLE') {
        view.setMicButtonState(newState === 'IDLE' ? 'idle' : 'listening');
    }
}

function initAI() {
    const callbacks = {
        onStateChange: onAIStateChange,
        onCommandReceived: onAICommand,
        onTranscriptUpdate: (t) => view.searchInputEl.textContent = t,
        onFinalResult: handleAIFinalResult
    };
    initAIService(callbacks);
    view.setHandsFreeMode(view.getHandsFreeMode()); // Sync toggle on startup
}

// --- Image Handling ---
async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageDataUrl = e.target.result;
        view.setHeaderListeningState(true); // Show processing state

        try {
            // Check if multimodal AI is available
            if (chrome?.ai?.prompt) {
                // Use Multimodal AI to generate a caption
                const captionResult = await chrome.ai.prompt({
                    prompt: `Describe this image for a personal journal entry.`,
                    image: { data: imageDataUrl }
                });
                view.insertImage(imageDataUrl, captionResult.text.trim());
            } else {
                console.warn("Chrome AI API not available for image captioning, using fallback");
                // Fallback to a generic caption
                view.insertImage(imageDataUrl, "A captured moment.");
            }
        } catch (error) {
            console.error("AI captioning failed:", error);
            // Fallback to a generic caption
            view.insertImage(imageDataUrl, "A captured moment.");
        } finally {
            view.setHeaderListeningState(false);
            event.target.value = ''; // Reset input for next upload
        }
    };
    reader.readAsDataURL(file);
}

// Start the application once the DOM is loaded.
document.addEventListener('DOMContentLoaded', init);