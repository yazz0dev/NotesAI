// js/services/ai-event-service.js
import { aiToolsService } from './ai-tools-service.js';
import aiHandler from './ai-handler.js';

let vueInstance = null;
let isActionInFlight = false;

// --- Event Handlers ---

function handleAIStatusUpdate(event) {
    if (vueInstance) vueInstance.aiStatus = event.detail;
}

function handleAIListeningStarted() {
    if (vueInstance) {
        vueInstance.isVoiceActive = true;
        if (vueInstance.editingNote) {
            vueInstance.contentBeforeDictation = vueInstance.editingNote.content || '';
        }
    }
}

function handleAIDictationUpdate(event) {
    if (vueInstance && vueInstance.editingNote && event?.detail?.transcript) {
        const interimText = event.detail.transcript;
        const separator = (vueInstance.contentBeforeDictation || '').trim() === '' ? '' : ' ';
        vueInstance.editingNote.content = vueInstance.contentBeforeDictation + separator + interimText;
    }
}

function handleAIDictationFinalized(event) {
    if (vueInstance && vueInstance.editingNote && event?.detail?.transcript) {
        const finalText = event.detail.transcript.trim();
        if (!finalText) return;

        const separator = (vueInstance.contentBeforeDictation || '').trim() === '' ? '' : ' ';
        const newContent = vueInstance.contentBeforeDictation + separator + finalText;

        vueInstance.editingNote.content = newContent;
        vueInstance.contentBeforeDictation = newContent;

        vueInstance.$nextTick(() => {
            vueInstance.saveNote(vueInstance.editingNote);
        });
    }
}

function handleAIListeningFinished(event) {
    if (vueInstance) {
        if (vueInstance.editingNote && event.detail.mode === 'dictation') {
            if (vueInstance.saveVoiceRecordings && event.detail.audioUrl) {
                vueInstance.editingNote.audioUrl = event.detail.audioUrl;
            }
            vueInstance.saveNote(vueInstance.editingNote);
        }
        vueInstance.isVoiceActive = false;
    }
}

// --- App-level Voice Command Handlers ---

async function handleVoiceCreateNote() {
    if (!vueInstance || isActionInFlight) return;
    try {
        isActionInFlight = true;
        const newNote = await vueInstance.createNewNote();
        if (newNote) {
            await vueInstance.$nextTick(); 
            if (vueInstance.editingNote && vueInstance.editingNote.id === newNote.id) {
                vueInstance.contentBeforeDictation = '';
                aiHandler.startListening({ mode: 'dictation' });
            }
        }
    } finally {
        setTimeout(() => { isActionInFlight = false; }, 500);
    }
}

async function handleVoiceStartDictation() {
    if (!vueInstance || isActionInFlight) return;
    if (vueInstance.isVoiceActive && aiHandler.commandService.currentMode === 'dictation') return;
    if (!vueInstance.editingNote) {
        await handleVoiceCreateNote();
    } else {
        vueInstance.contentBeforeDictation = vueInstance.editingNote.content || '';
        aiHandler.startListening({ mode: 'dictation' });
    }
}

function handleVoiceStopDictation() {
    if (vueInstance && vueInstance.isVoiceActive) aiHandler.stopListening();
}

function handleVoiceCloseEditor() {
    if (vueInstance && vueInstance.editingNote) vueInstance.closeEditor();
}

function handleVoiceSaveNote() {
    if (vueInstance && vueInstance.editingNote) vueInstance.saveNote(vueInstance.editingNote);
}

async function handleVoiceAIQuery(event) {
    if (vueInstance && event.detail.query) {
        const fullQuery = event.detail.originalTranscript;
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
            searchInput.textContent = fullQuery;
        }

        await aiToolsService.processQueryWithTools(fullQuery);

        if (searchInput) {
            searchInput.textContent = '';
        }
    }
}

const listeners = {
    "command-status-update": handleAIStatusUpdate,
    "listening-started": handleAIListeningStarted,
    "dictation-update": handleAIDictationUpdate,
    "dictation-finalized": handleAIDictationFinalized,
    "listening-finished": handleAIListeningFinished,
    "voice-create-note": handleVoiceCreateNote,
    "voice-start-dictation": handleVoiceStartDictation,
    "voice-stop-dictation": handleVoiceStopDictation,
    "voice-close-editor": handleVoiceCloseEditor,
    "voice-save-note": handleVoiceSaveNote,
    "voice-ai-query": handleVoiceAIQuery,
};

export const aiEventService = {
    setup(instance) {
        vueInstance = instance;
        for (const [event, handler] of Object.entries(listeners)) {
            window.addEventListener(event, handler);
        }
    },
    teardown() {
        for (const [event, handler] of Object.entries(listeners)) {
            window.removeEventListener(event, handler);
        }
        vueInstance = null;
        isActionInFlight = false;
    }
};