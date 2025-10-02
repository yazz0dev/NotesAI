// js/components/book-viewer.js
// Book viewer and reading interface

import { getAudioData, createAudioPlayer, formatDuration } from '../services/audio-service.js';

// --- DOM Element Selectors ---
const bookViewerEl = document.getElementById('book-viewer');
const viewerTitleEl = document.getElementById('viewer-title');
const viewerDateEl = document.getElementById('viewer-date');
const viewerTextLeftEl = document.getElementById('viewer-text-left');
const viewerTextRightEl = document.getElementById('viewer-text-right');
const editBtn = document.getElementById('edit-btn');
const saveBtn = document.getElementById('save-btn');
const deleteBtn = document.getElementById('delete-btn');
const addImageBtn = document.getElementById('add-image-btn');

// --- Book Viewer Functions ---

/**
 * Splits content between left and right pages for optimal reading experience.
 * @param {string} noteContent - The HTML content to split
 */
function splitContentForPages(noteContent) {
    // Clear both pages
    viewerTextLeftEl.innerHTML = '';
    viewerTextRightEl.innerHTML = '';
    
    // Create a temporary container to parse the content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteContent;
    
    // Move all content to left page first
    while (tempDiv.firstChild) {
        viewerTextLeftEl.appendChild(tempDiv.firstChild);
    }
    
    // Move content to right page if left page overflows
    while (viewerTextLeftEl.scrollHeight > viewerTextLeftEl.clientHeight && viewerTextLeftEl.children.length > 1) {
        const lastElement = viewerTextLeftEl.lastElementChild;
        viewerTextRightEl.prepend(lastElement);
    }
}

/**
 * Adds audio player to the book viewer.
 * @param {Object} audioData - Audio data from IndexedDB
 */
async function addAudioToViewer(audioData) {
    // Remove existing audio player if present
    const existingPlayer = bookViewerEl.querySelector('.audio-player-container');
    if (existingPlayer) {
        existingPlayer.remove();
    }
    
    try {
        const audioPlayer = await createAudioPlayer(audioData);
        
        // Create container for the audio player
        const audioContainer = document.createElement('div');
        audioContainer.className = 'audio-player-container';
        audioContainer.innerHTML = `
            <div class="audio-header">
                <span class="audio-icon">🎵</span>
                <span class="audio-label">Audio Recording</span>
                <span class="audio-duration">${formatDuration(audioData.duration / 1000)}</span>
            </div>
        `;
        
        audioContainer.appendChild(audioPlayer);
        
        // Insert audio player at the top of the viewer
        const viewerContent = bookViewerEl.querySelector('.book-content');
        viewerContent.insertBefore(audioContainer, viewerContent.firstChild);
        
    } catch (error) {
        console.error('Error creating audio player:', error);
    }
}

/**
 * Opens the two-page reader view with a 3D animation and loads audio if available.
 * @param {Object} note - The note object to display.
 */
export async function openBook(note) {
    viewerTitleEl.textContent = note.summary || 'A Journal Entry';
    viewerDateEl.textContent = new Date(note.createdAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    splitContentForPages(note.content);
    bookViewerEl.dataset.noteId = note.id; // Store ID for edit/delete

    // Check for and display audio recording
    try {
        const audioData = await getAudioData(note.id);
        if (audioData) {
            await addAudioToViewer(audioData);
        }
    } catch (error) {
        console.error('Error loading audio for entry:', error);
    }

    bookViewerEl.classList.remove('hidden');
    setTimeout(() => bookViewerEl.classList.add('is-open'), 10);
}

/**
 * Closes the book viewer with animation.
 */
export function closeBook() {
    bookViewerEl.classList.remove('is-open');
    setTimeout(() => {
        bookViewerEl.classList.add('hidden');
        
        // Clean up audio player
        const audioContainer = bookViewerEl.querySelector('.audio-player-container');
        if (audioContainer) {
            audioContainer.remove();
        }
        
        // Reset edit mode
        toggleEditMode(false);
    }, 300);
}

/**
 * Toggles edit mode for the current book.
 * @param {boolean} isEditing - Whether to enable edit mode
 */
export function toggleEditMode(isEditing) {
    const leftPage = viewerTextLeftEl;
    const rightPage = viewerTextRightEl;
    
    if (isEditing) {
        // Make pages editable
        leftPage.contentEditable = true;
        rightPage.contentEditable = true;
        leftPage.classList.add('editing');
        rightPage.classList.add('editing');
        
        // Show/hide appropriate buttons
        editBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
        addImageBtn.classList.remove('hidden');
        
        // Focus on left page
        leftPage.focus();
    } else {
        // Make pages non-editable
        leftPage.contentEditable = false;
        rightPage.contentEditable = false;
        leftPage.classList.remove('editing');
        rightPage.classList.remove('editing');
        
        // Show/hide appropriate buttons
        editBtn.classList.remove('hidden');
        saveBtn.classList.add('hidden');
        addImageBtn.classList.add('hidden');
    }
}

/**
 * Gets the edited content from both pages.
 * @returns {string} Combined HTML content from both pages
 */
export function getEditedContent() {
    const leftContent = viewerTextLeftEl.innerHTML;
    const rightContent = viewerTextRightEl.innerHTML;
    
    // Combine content from both pages
    return leftContent + rightContent;
}

/**
 * Inserts an image into the currently focused page.
 * @param {string} imageDataUrl - The base64 data URL of the image
 * @param {string} caption - Optional caption for the image
 */
export function insertImageIntoViewer(imageDataUrl, caption) {
    const imageHtml = `
        <div class="journal-image-container">
            <img src="${imageDataUrl}" alt="${caption || 'Journal image'}" class="journal-image">
            ${caption ? `<p class="image-caption">${caption}</p>` : ''}
        </div>
    `;
    
    // Determine which page is focused or has cursor
    const selection = window.getSelection();
    let targetPage = viewerTextLeftEl;
    
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Check if selection is in right page
        if (viewerTextRightEl.contains(container) || viewerTextRightEl === container) {
            targetPage = viewerTextRightEl;
        }
        
        // Insert at cursor position
        const div = document.createElement('div');
        div.innerHTML = imageHtml;
        range.insertNode(div.firstChild);
        range.collapse(false);
    } else {
        // Fallback: append to left page
        targetPage.innerHTML += imageHtml;
    }
    
    // Re-balance content between pages after image insertion
    setTimeout(() => {
        splitContentForPages(getEditedContent());
    }, 100);
}

/**
 * Handles page content rebalancing when content changes.
 */
export function rebalancePages() {
    const currentContent = getEditedContent();
    splitContentForPages(currentContent);
}

/**
 * Sets up event listeners for the book viewer.
 */
export function initBookViewer() {
    // Close book when clicking outside
    bookViewerEl.addEventListener('click', (e) => {
        if (e.target === bookViewerEl) {
            closeBook();
        }
    });
    
    // Handle escape key to close book
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !bookViewerEl.classList.contains('hidden')) {
            closeBook();
        }
    });
    
    // Auto-rebalance pages when content changes in edit mode
    [viewerTextLeftEl, viewerTextRightEl].forEach(page => {
        page.addEventListener('input', () => {
            if (page.contentEditable === 'true') {
                // Debounce the rebalancing
                clearTimeout(page.rebalanceTimer);
                page.rebalanceTimer = setTimeout(rebalancePages, 500);
            }
        });
    });
    
    // Handle image drag and drop
    [viewerTextLeftEl, viewerTextRightEl].forEach(page => {
        page.addEventListener('dragover', (e) => {
            if (page.contentEditable === 'true') {
                e.preventDefault();
                page.classList.add('drag-over');
            }
        });
        
        page.addEventListener('dragleave', () => {
            page.classList.remove('drag-over');
        });
        
        page.addEventListener('drop', (e) => {
            if (page.contentEditable === 'true') {
                e.preventDefault();
                page.classList.remove('drag-over');
                
                const files = Array.from(e.dataTransfer.files);
                const imageFile = files.find(file => file.type.startsWith('image/'));
                
                if (imageFile) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        insertImageIntoViewer(event.target.result, imageFile.name);
                    };
                    reader.readAsDataURL(imageFile);
                }
            }
        });
    });
}
