// js/services/note-actions-service.js
import { alertService } from './alert-service.js';
import { useNotesStore } from '../stores/notesStore.js';

// Helper to get the store instance
const getStore = () => useNotesStore();

async function saveNote(noteToSave) {
    const notesStore = getStore();
    try {
        let savedNote;
        if (noteToSave.id) {
            savedNote = await notesStore.updateNote(noteToSave.id, noteToSave);
        } else {
            savedNote = await notesStore.createNote(noteToSave);
        }
        // Return the saved note so the main component can update its state
        return savedNote;
    } catch (error) {
        console.error("Failed to save note:", error);
        alertService.error('Save Failed', `There was an issue saving your note: ${error.message}`);
        return null;
    }
}

async function deleteNote(noteId, currentEditingNote) {
    const notesStore = getStore();
    try {
        const confirmed = await alertService.confirm('Delete Note', 'Are you sure you want to permanently delete this note?', { confirmText: 'Delete' });
        if (confirmed) {
            // Check if the note being deleted is the one being edited
            const isDeletingCurrent = currentEditingNote && currentEditingNote.id === noteId;
            await notesStore.deleteNote(noteId);
            // Return true if the editor should be closed
            return isDeletingCurrent;
        }
        return false;
    } catch (error) {
        console.error("Failed to delete note:", error);
        alertService.error('Delete Failed', 'Could not delete the note. Please try again.');
        return false;
    }
}

async function toggleFavorite(note) {
    const notesStore = getStore();
    await notesStore.toggleFavorite(note.id);
}

async function archiveNote(note) {
    const notesStore = getStore();
    await notesStore.toggleArchive(note.id);
    // Return true if the note being archived is the one being edited
    return note.id;
}

async function setReminder(note) {
    const notesStore = getStore();
    const currentReminder = note.reminderAt ? new Date(note.reminderAt).toISOString().slice(0, 16) : '';
    const message = note.reminderAt ? 'Edit the date and time. To remove this reminder, clear the field and click Update.' : 'Enter a date and time for the reminder:';
    const result = await alertService.input(note.reminderAt ? 'Edit Reminder' : 'Set Reminder', message, { inputType: 'datetime-local', defaultValue: currentReminder, confirmText: note.reminderAt ? 'Update' : 'Set Reminder' });
    if (result !== null) {
        if (result) {
            await notesStore.setReminder(note.id, new Date(result).toISOString());
        } else {
            // This means the user cleared the input to remove the reminder
            await notesStore.removeReminder(note.id);
        }
    }
}

async function removeReminder(note) {
    const notesStore = getStore();
    const confirmed = await alertService.confirm('Remove Reminder', `Are you sure you want to remove the reminder for "${note.title}"?`, { confirmText: 'Remove', type: 'warning' });
    if (confirmed) {
        await notesStore.removeReminder(note.id);
    }
}

async function updateNoteTags({ noteId, tagIds }) {
    const notesStore = getStore();
    await notesStore.updateNoteTags(noteId, tagIds);
}

export const noteActionsService = {
    saveNote,
    deleteNote,
    toggleFavorite,
    archiveNote,
    setReminder,
    removeReminder,
    updateNoteTags
};