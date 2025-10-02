// js/components/calendar-header.js
// Calendar widget and header state management

import { formatDate } from '../utils/utils.js';

// --- DOM Element Selectors ---
export const headerEl = document.getElementById('app-header');
export const searchInputEl = document.getElementById('search-input');
export const micButtonEl = document.getElementById('mic-button');

const calendarTodayEl = document.getElementById('calendar-today');
const calendarWidget = document.getElementById('calendar-widget');
const onThisDayWidget = document.getElementById('on-this-day-widget');

// --- Calendar and Header Functions ---

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
 * Triggers the calendar peel animation for a subtle visual effect.
 */
export function triggerPeelAnimation() {
    calendarTodayEl.classList.add('peel-corner');
    setTimeout(() => {
        calendarTodayEl.classList.remove('peel-corner');
    }, 2000);
}

/**
 * Sets the header listening state with visual feedback.
 * @param {boolean} isListening - Whether the app is actively listening
 */
export function setHeaderListeningState(isListening) {
    headerEl.classList.toggle('listening', isListening);
}

/**
 * Sets the ambient indicator state for voice control feedback.
 * @param {string} state - The current voice state (IDLE, AMBIENT_LISTENING, etc.)
 */
export function setAmbientIndicatorState(state) {
    const indicator = document.getElementById('ambient-indicator');
    if (!indicator) return;
    
    indicator.className = 'ambient-indicator';
    if (state === 'AMBIENT_LISTENING') {
        indicator.classList.add('listening');
    } else if (state === 'DICTATION_MODE') {
        indicator.classList.add('dictating');
    }
}

/**
 * Renders the "On This Day" widget with memories from past entries.
 * @param {string} summary - AI-generated summary of past memories
 * @param {string} state - Widget state ('loading', 'content', 'empty')
 */
export function renderOnThisDay(summary, state) {
    if (state === 'loading') {
        onThisDayWidget.innerHTML = `
            <div class="on-this-day-header">
                <h3 class="on-this-day-title">📅 On This Day</h3>
            </div>
            <div class="on-this-day-content">
                <div class="loading-spinner"></div>
                <p>Looking through your memories...</p>
            </div>
        `;
    } else if (state === 'content') {
        onThisDayWidget.innerHTML = `
            <div class="on-this-day-header">
                <h3 class="on-this-day-title">📅 On This Day</h3>
            </div>
            <div class="on-this-day-content">
                <p class="memory-summary">${summary}</p>
            </div>
        `;
    } else {
        onThisDayWidget.classList.add('hidden');
        return;
    }

    onThisDayWidget.classList.remove('hidden');
}

/**
 * Sets the microphone button state with visual feedback.
 * @param {string} state - Button state ('idle', 'listening', 'capturing', 'processing')
 */
export function setMicButtonState(state) {
    if (!micButtonEl) return;
    
    micButtonEl.className = 'mic-button';
    micButtonEl.classList.add(state);
    
    const stateMessages = {
        idle: 'Click to start recording',
        listening: 'Listening for "Okay Journal"...',
        capturing: 'Recording your thoughts...',
        processing: 'Processing your entry...'
    };
    
    micButtonEl.title = stateMessages[state] || 'Voice control';
}

/**
 * Shows command understood feedback with a message.
 * @param {string} message - The confirmation message to display
 */
export function showCommandUnderstood(message) {
    const feedback = document.createElement('div');
    feedback.className = 'voice-feedback understood';
    feedback.innerHTML = `
        <div class="feedback-icon">✓</div>
        <div class="feedback-message">${message}</div>
    `;
    
    headerEl.appendChild(feedback);
    
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => feedback.remove(), 300);
    }, 2000);
}

/**
 * Shows command not understood feedback.
 */
export function showCommandNotUnderstood() {
    const feedback = document.createElement('div');
    feedback.className = 'voice-feedback not-understood';
    feedback.innerHTML = `
        <div class="feedback-icon">?</div>
        <div class="feedback-message">I didn't catch that. Try saying "Okay Journal" to start.</div>
    `;
    
    headerEl.appendChild(feedback);
    
    setTimeout(() => {
        feedback.classList.add('fade-out');
        setTimeout(() => feedback.remove(), 300);
    }, 3000);
}

/**
 * Inserts an image into the current text input with optional caption.
 * @param {string} imageDataUrl - The base64 data URL of the image
 * @param {string} caption - Optional caption for the image
 */
export function insertImage(imageDataUrl, caption) {
    const imageHtml = `
        <div class="journal-image-container">
            <img src="${imageDataUrl}" alt="${caption || 'Journal image'}" class="journal-image">
            ${caption ? `<p class="image-caption">${caption}</p>` : ''}
        </div>
    `;
    
    // Insert at cursor position in search input (which doubles as text input)
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const div = document.createElement('div');
        div.innerHTML = imageHtml;
        range.insertNode(div.firstChild);
        range.collapse(false);
    } else {
        // Fallback: append to search input
        searchInputEl.innerHTML += imageHtml;
    }
}
