// js/services/ai-event-service.js
import { alertService } from './alert-service.js';
import { useNotesStore } from '../stores/notesStore.js';
import { useSettingsStore } from '../stores/settingsStore.js';
import aiHandler from './ai-handler.js';

let vueInstance = null;

// --- Event Handlers ---

function handleAIStatusUpdate(event) {
    if (vueInstance) vueInstance.aiStatus = event.detail;
}

function handleAICreateNote(event) {
    if (vueInstance) {
        vueInstance.createNewNote({ title: event.detail.summary, content: event.detail.content });
        vueInstance.$nextTick(() => {
            if (vueInstance.editingNote && !vueInstance.isVoiceActive) {
                vueInstance.handleVoiceToggle();
            }
        });
    }
}

function handleAISearch(event) {
    const settingsStore = useSettingsStore();
    settingsStore.searchQuery = event.detail.query;
    const searchInput = document.getElementById("search-input");
    if (searchInput) searchInput.textContent = settingsStore.searchQuery;
}

async function handleAIDeleteNote(event) {
    const notesStore = useNotesStore();
    const query = event.detail.query.toLowerCase();
    if (!query) return;
    const noteToDelete = notesStore.activeNotes.find(n =>
        (n.title || '').toLowerCase().includes(query)
    );
    if (noteToDelete) {
        if (vueInstance) vueInstance.deleteNote(noteToDelete.id);
    } else {
        alertService.info('Note Not Found', `Could not find an active note matching "${query}".`);
    }
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
        vueInstance.contentBeforeDictation = newContent; // Update base content for next dictation

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

function handleAICommandExecuted(event) {
    if (vueInstance && vueInstance.editingNote) {
        vueInstance.contentBeforeDictation = event.detail.content;
    }
}

function handleVoiceCreateNote() {
    if (vueInstance) {
        vueInstance.createNewNote();
        vueInstance.$nextTick(() => {
            if (vueInstance.editingNote) {
                vueInstance.contentBeforeDictation = '';
                setTimeout(() => aiHandler.startListening({ mode: 'dictation' }), 300);
            }
        });
    }
}

function handleVoiceStartDictation() {
    if (vueInstance) {
        if (!vueInstance.editingNote) {
            vueInstance.createNewNote();
            vueInstance.$nextTick(() => {
                if (vueInstance.editingNote) {
                    vueInstance.contentBeforeDictation = vueInstance.editingNote.content || '';
                    setTimeout(() => aiHandler.startListening({ mode: 'dictation' }), 300);
                }
            });
        } else {
            vueInstance.contentBeforeDictation = vueInstance.editingNote.content || '';
            aiHandler.startListening({ mode: 'dictation' });
        }
    }
}

function handleVoiceStopDictation() {
    if (vueInstance && vueInstance.isVoiceActive) {
        aiHandler.stopListening();
    }
}

const listeners = {
    "command-status-update": handleAIStatusUpdate,
    "command-create-note": handleAICreateNote,
    "command-search": handleAISearch,
    "listening-started": handleAIListeningStarted,
    "dictation-update": handleAIDictationUpdate,
    "dictation-finalized": handleAIDictationFinalized,
    "listening-finished": handleAIListeningFinished,
    "command-delete-note": handleAIDeleteNote,
    "command-execute": handleAICommandExecuted,
    "voice-create-note": handleVoiceCreateNote,
    "voice-start-dictation": handleVoiceStartDictation,
    "voice-stop-dictation": handleVoiceStopDictation,
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
    }
};