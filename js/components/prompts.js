// js/components/prompts.js
// Daily prompts widget and functionality

import { generateDailyPrompts, getCurrentTimeOfDay } from '../services/prompts-service.js';
import { searchInputEl } from './calendar-header.js';

// --- DOM Element Selectors ---
const dailyPromptsWidget = document.getElementById('daily-prompts-widget');
const promptsContainer = document.getElementById('prompts-container');
const refreshPromptsBtn = document.getElementById('refresh-prompts-btn');
const promptsBtn = document.getElementById('prompts-btn');

// --- Prompts Functions ---

/**
 * Shows or hides the daily prompts widget.
 * @param {boolean} show - Whether to show the widget
 */
export function showPromptsWidget(show) {
    if (!dailyPromptsWidget) return;
    dailyPromptsWidget.classList.toggle('hidden', !show);
    if (promptsBtn) promptsBtn.classList.toggle('active', show);
}

/**
 * Uses a selected prompt by inserting it into the search input.
 * @param {string} prompt - The prompt text to use
 */
function usePrompt(prompt) {
    if (searchInputEl) {
        // Clear existing content and insert prompt
        searchInputEl.innerHTML = `<p>${prompt}</p>`;
        searchInputEl.focus();
        
        // Place cursor at the end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(searchInputEl);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Hide the prompts widget
        showPromptsWidget(false);
        
        // Trigger input event to update any listeners
        searchInputEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * Renders daily prompts in the widget.
 * @param {Array} prompts - Array of prompt strings
 * @param {string} sentiment - Current user sentiment
 * @param {string} timeOfDay - Current time of day
 */
export async function renderDailyPrompts(prompts, sentiment = 'neutral', timeOfDay = getCurrentTimeOfDay()) {
    if (!promptsContainer) return;
    
    if (!prompts || prompts.length === 0) {
        promptsContainer.innerHTML = `
            <div class="prompts-empty">
                <p>No prompts available right now. Try refreshing!</p>
            </div>
        `;
        return;
    }
    
    // Add contextual header based on time and sentiment
    const contextualHeaders = {
        morning: {
            positive: "✨ Good morning! Ready to capture some thoughts?",
            neutral: "🌅 Morning reflections to start your day:",
            negative: "🌱 A fresh start - what's on your mind this morning?"
        },
        afternoon: {
            positive: "☀️ Afternoon inspiration for your journal:",
            neutral: "📝 Midday moments worth capturing:",
            negative: "🌤️ Take a moment to reflect on your day so far:"
        },
        evening: {
            positive: "🌙 Evening reflections to end your day:",
            neutral: "✨ As the day winds down, consider:",
            negative: "🌆 A peaceful moment to process today:"
        }
    };
    
    const header = contextualHeaders[timeOfDay]?.[sentiment] || "💭 Writing prompts for you:";
    
    promptsContainer.innerHTML = `
        <div class="prompts-header-text">${header}</div>
        <div class="prompts-list">
            ${prompts.map((prompt, index) => `
                <div class="prompt-item" data-prompt="${prompt}" tabindex="0" role="button">
                    <div class="prompt-text">${prompt}</div>
                    <div class="prompt-action">Click to use →</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // Add click handlers for prompts
    const promptItems = promptsContainer.querySelectorAll('.prompt-item');
    promptItems.forEach(item => {
        const prompt = item.dataset.prompt;
        
        item.addEventListener('click', () => usePrompt(prompt));
        
        // Keyboard support
        item.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                usePrompt(prompt);
            }
        });
        
        // Hover effects
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateX(4px)';
        });
        
        item.addEventListener('mouseleave', () => {
            item.style.transform = '';
        });
    });
}

/**
 * Loads and displays prompts based on current context.
 * @param {Array} recentTopics - Recent topics from user entries
 * @param {string} sentiment - Current user sentiment
 */
export async function loadDailyPrompts(recentTopics = [], sentiment = 'neutral') {
    if (!promptsContainer) return;
    
    // Show loading state
    promptsContainer.innerHTML = `
        <div class="prompts-loading">
            <div class="loading-spinner"></div>
            <p>Generating personalized prompts...</p>
        </div>
    `;
    
    try {
        const timeOfDay = getCurrentTimeOfDay();
        const prompts = await generateDailyPrompts(sentiment, recentTopics, timeOfDay);
        
        await renderDailyPrompts(prompts, sentiment, timeOfDay);
        
    } catch (error) {
        console.error('Error loading daily prompts:', error);
        
        // Show fallback prompts
        const fallbackPrompts = getFallbackPrompts(sentiment, getCurrentTimeOfDay());
        await renderDailyPrompts(fallbackPrompts, sentiment, getCurrentTimeOfDay());
    }
}

/**
 * Gets fallback prompts when AI generation fails.
 * @param {string} sentiment - Current user sentiment
 * @param {string} timeOfDay - Current time of day
 * @returns {Array<string>} Array of fallback prompt strings
 */
function getFallbackPrompts(sentiment, timeOfDay) {
    const fallbackPrompts = {
        morning: {
            positive: [
                "What are you most excited about today?",
                "Describe a moment of gratitude from yesterday.",
                "What positive energy are you bringing to today?"
            ],
            neutral: [
                "What are your intentions for today?",
                "How are you feeling as you start this day?",
                "What's one thing you want to accomplish today?"
            ],
            negative: [
                "What's one small thing that could make today better?",
                "How can you be kind to yourself today?",
                "What support do you need right now?"
            ]
        },
        afternoon: {
            positive: [
                "What's been the highlight of your day so far?",
                "Describe a moment of joy from today.",
                "What accomplishment are you proud of today?"
            ],
            neutral: [
                "How has your day unfolded so far?",
                "What thoughts are occupying your mind right now?",
                "What would you like to remember about today?"
            ],
            negative: [
                "What challenges have you faced today, and how did you handle them?",
                "What would help you feel more balanced right now?",
                "How can you show yourself compassion today?"
            ]
        },
        evening: {
            positive: [
                "What made you smile today?",
                "What are you grateful for from today?",
                "How did you grow or learn something new today?"
            ],
            neutral: [
                "Reflect on the events of your day. What stands out?",
                "What emotions did you experience today?",
                "What would you like to carry forward from today?"
            ],
            negative: [
                "What was difficult about today, and what did you learn?",
                "How can you practice self-care this evening?",
                "What are you hoping for tomorrow?"
            ]
        }
    };
    
    return fallbackPrompts[timeOfDay]?.[sentiment] || fallbackPrompts.evening.neutral;
}

/**
 * Refreshes the prompts with new AI-generated content.
 * @param {Array} recentTopics - Recent topics from user entries
 * @param {string} sentiment - Current user sentiment
 */
export async function refreshPrompts(recentTopics = [], sentiment = 'neutral') {
    if (refreshPromptsBtn) {
        // Add loading state to refresh button
        const originalText = refreshPromptsBtn.innerHTML;
        refreshPromptsBtn.innerHTML = '⏳';
        refreshPromptsBtn.disabled = true;
        
        try {
            await loadDailyPrompts(recentTopics, sentiment);
        } finally {
            // Restore button state
            setTimeout(() => {
                refreshPromptsBtn.innerHTML = originalText;
                refreshPromptsBtn.disabled = false;
            }, 1000);
        }
    }
}

/**
 * Initializes the prompts widget with event listeners.
 */
export function initPrompts() {
    // Refresh button handler
    if (refreshPromptsBtn) {
        refreshPromptsBtn.addEventListener('click', () => {
            // Dispatch event that main.js can listen to for refresh
            window.dispatchEvent(new CustomEvent('refreshPrompts'));
        });
    }
    
    // Prompts toggle button handler
    if (promptsBtn) {
        promptsBtn.addEventListener('click', () => {
            const isVisible = !dailyPromptsWidget?.classList.contains('hidden');
            
            if (isVisible) {
                showPromptsWidget(false);
            } else {
                // Dispatch event that main.js can listen to for showing prompts
                window.dispatchEvent(new CustomEvent('showPrompts'));
            }
        });
    }
    
    // Close prompts when clicking outside
    document.addEventListener('click', (e) => {
        if (dailyPromptsWidget && !dailyPromptsWidget.classList.contains('hidden')) {
            const isClickInside = dailyPromptsWidget.contains(e.target) || 
                                 promptsBtn?.contains(e.target);
            
            if (!isClickInside) {
                showPromptsWidget(false);
            }
        }
    });
    
    // Close prompts with escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dailyPromptsWidget && !dailyPromptsWidget.classList.contains('hidden')) {
            showPromptsWidget(false);
        }
    });
}
