import dbService from '../services/store.js';

const { defineStore } = window.Pinia;

// Keywords to identify potentially important notes for the notice board
const NOTICE_BOARD_KEYWORDS = ['urgent', 'important', 'todo', 'meeting', 'deadline', 'task', 'reminder', 'action item'];

export const useNotesStore = defineStore('notes', {
  state: () => ({
    notes: [],
    editingNote: null,
    selectedNoteIds: new Set(),
    isLoading: true,
    lastSync: null,
    saveStatus: 'idle', // 'idle', 'saving', 'saved', 'error'
  }),

  getters: {
    // Get all notes sorted by updated date
    allNotes: (state) => {
      return [...state.notes].sort((a, b) => 
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
    },

    // Get active (non-archived) notes
    activeNotes: (state) => {
      return state.notes.filter(note => !note.isArchived);
    },

    // Get archived notes
    archivedNotes: (state) => {
      return state.notes.filter(note => note.isArchived);
    },

    // Get favorite notes
    favoriteNotes: (state) => {
      return state.notes.filter(note => note.isFavorite);
    },

    // Get notes with reminders
    notesWithReminders: (state) => {
      return state.notes.filter(note => note.reminderAt);
    },

    // Get notes by tag
    notesByTag: (state) => {
      return (tagName) => {
        if (!tagName) return state.notes;
        return state.notes.filter(note => 
          note.tags && note.tags.includes(tagName)
        );
      };
    },

    // Search notes by query
    searchNotes: (state) => {
      return (query) => {
        if (!query) return state.notes;
        const lowerQuery = query.toLowerCase();
        return state.notes.filter(note => {
          const titleMatch = note.title?.toLowerCase().includes(lowerQuery);
          const contentMatch = note.content?.toLowerCase().includes(lowerQuery);
          const tagsMatch = note.tags?.some(tag => 
            tag.toLowerCase().includes(lowerQuery)
          );
          return titleMatch || contentMatch || tagsMatch;
        });
      };
    },

    // Get note by ID
    getNoteById: (state) => {
      return (id) => state.notes.find(note => note.id === id);
    },

    // Get total notes count
    totalNotes: (state) => state.notes.length,

    // Get active notes count
    activeNotesCount: (state) => state.activeNotes.length,

    // Get archived notes count
    archivedNotesCount: (state) => state.archivedNotes.length
  },

  actions: {
    // Initialize store and load notes from IndexedDB
    async initialize() {
      this.isLoading = true;
      try {
        await dbService.initDB();
        await this.loadNotes();
        this.lastSync = new Date().toISOString();
      } catch (error) {
        console.error('Failed to initialize notes store:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Load all notes from IndexedDB
    async loadNotes() {
      try {
        const notes = await dbService.getNotes();
        this.notes = notes.map(note => ({
          ...note,
          title: note.title || '',
          tags: note.tags || []
        }));
        return this.notes;
      } catch (error) {
        console.error('Failed to load notes:', error);
        throw error;
      }
    },

    // Create a new note
    async createNote(noteData = {}) {
      const title = noteData.title || '';
      const newNote = {
        id: Date.now().toString(),
        title: title,
        content: noteData.content || '',
        tags: noteData.tags || [],
        isFavorite: noteData.isFavorite || false,
        isArchived: noteData.isArchived || false,
        reminderAt: noteData.reminderAt || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...noteData
      };

      try {
        this.saveStatus = 'saving';
        const savedNote = await dbService.saveNote(newNote);
        this.notes.push(savedNote);
        this.saveStatus = 'saved';
        
        // **KEY CHANGE**: Automatically check if the notice board needs updating
        this.triggerNoticeBoardUpdateIfNeeded(savedNote);

        setTimeout(() => {
          if (this.saveStatus === 'saved') {
            this.saveStatus = 'idle';
          }
        }, 2000);
        
        return savedNote;
      } catch (error) {
        this.saveStatus = 'error';
        console.error('Failed to create note:', error);
        throw error;
      }
    },

    // Update an existing note
    async updateNote(noteId, updates) {
      const noteIndex = this.notes.findIndex(n => n.id === noteId);
      if (noteIndex === -1) {
        throw new Error('Note not found');
      }

      const updatedNote = {
        ...this.notes[noteIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      try {
        this.saveStatus = 'saving';
        const savedNote = await dbService.saveNote(updatedNote);
        this.notes[noteIndex] = savedNote;
        
        // **KEY CHANGE**: Automatically check if the notice board needs updating
        this.triggerNoticeBoardUpdateIfNeeded(savedNote);

        if (this.editingNote?.id === noteId) {
          this.editingNote = { ...savedNote };
        }
        
        this.saveStatus = 'saved';
        
        setTimeout(() => {
          if (this.saveStatus === 'saved') {
            this.saveStatus = 'idle';
          }
        }, 2000);
        
        return savedNote;
      } catch (error) {
        this.saveStatus = 'error';
        console.error('Failed to update note:', error);
        throw error;
      }
    },
    
    // **KEY CHANGE**: New helper method to decide when to regenerate
    triggerNoticeBoardUpdateIfNeeded(note) {
        const noteText = `${note.title} ${note.content}`.toLowerCase();
        const hasKeywords = NOTICE_BOARD_KEYWORDS.some(kw => noteText.includes(kw));
        
        // Regenerate if the note has keywords and more than a few words
        if (hasKeywords && note.content.length > 20) {
            console.log("Relevant note changed, triggering Notice Board refresh...");
            // Debounce the call to prevent multiple rapid updates
            if (this.noticeBoardDebounce) clearTimeout(this.noticeBoardDebounce);
            this.noticeBoardDebounce = setTimeout(() => {
                this.generateNoticeBoard();
            }, 3000); // Wait 3 seconds after the last change
        }
    },

    // Delete a note
    async deleteNote(noteId) {
      try {
        await dbService.deleteNote(noteId);
        this.notes = this.notes.filter(n => n.id !== noteId);
        
        if (this.editingNote?.id === noteId) {
          this.editingNote = null;
        }
        
        this.selectedNoteIds.delete(noteId);
      } catch (error) {
        console.error('Failed to delete note:', error);
        throw error;
      }
    },

    // Toggle favorite status
    async toggleFavorite(noteId) {
      const note = this.getNoteById(noteId);
      if (!note) return;
      return this.updateNote(noteId, { isFavorite: !note.isFavorite });
    },

    // Toggle archive status
    async toggleArchive(noteId) {
      const note = this.getNoteById(noteId);
      if (!note) return;
      return this.updateNote(noteId, { isArchived: !note.isArchived });
    },

    // Set note reminder
    async setReminder(noteId, reminderAt) {
      return this.updateNote(noteId, { reminderAt, reminderSeen: false });
    },

    // Remove note reminder
    async removeReminder(noteId) {
      return this.updateNote(noteId, { reminderAt: null, reminderSeen: null });
    },

    // Update note tags
    async updateNoteTags(noteId, tags) {
      return this.updateNote(noteId, { tags });
    },

    // Set editing note
    setEditingNote(note) {
      this.editingNote = note;
    },

    // Clear editing note
    clearEditingNote() {
      this.editingNote = null;
    },

    // Select/deselect notes
    toggleNoteSelection(noteId) {
      if (this.selectedNoteIds.has(noteId)) {
        this.selectedNoteIds.delete(noteId);
      } else {
        this.selectedNoteIds.add(noteId);
      }
    },

    // Select all notes
    selectAllNotes() {
      this.notes.forEach(note => this.selectedNoteIds.add(note.id));
    },

    // Clear selection
    clearSelection() {
      this.selectedNoteIds.clear();
    },

    // Bulk delete selected notes
    async deleteSelectedNotes() {
      const idsToDelete = Array.from(this.selectedNoteIds);
      try {
        await Promise.all(idsToDelete.map(id => this.deleteNote(id)));
        this.clearSelection();
      } catch (error) {
        console.error('Failed to delete selected notes:', error);
        throw error;
      }
    },

    // Bulk archive selected notes
    async archiveSelectedNotes() {
      const idsToArchive = Array.from(this.selectedNoteIds);
      try {
        await Promise.all(idsToArchive.map(id => this.toggleArchive(id)));
        this.clearSelection();
      } catch (error) {
        console.error('Failed to archive selected notes:', error);
        throw error;
      }
    },

    // Generate Notice Board
    async generateNoticeBoard() {
      const { useSettingsStore } = await import('./settingsStore.js');
      const settingsStore = useSettingsStore();
      const { alertService } = await import('../services/alert-service.js');

      try {
          const candidateNotes = this.activeNotes
              .filter(note => {
                  const noteText = `${note.title} ${note.content}`.toLowerCase();
                  return NOTICE_BOARD_KEYWORDS.some(kw => noteText.includes(kw));
              })
              // Sort by most recently updated to prioritize fresh content
              .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
              .slice(0, 5); // Take top 5 candidates

          if (candidateNotes.length === 0) {
              settingsStore.setNoticeBoardContent(null);
              return;
          }
          
          const summaryService = (await import('../services/summary-service.js')).default;
          const summary = await summaryService.generateNoticeBoardSummary(candidateNotes);
          
          settingsStore.setNoticeBoardContent(summary);

      } catch (error) {
          console.error('Failed to generate notice board:', error);
          settingsStore.setNoticeBoardContent("### Oops!\nCould not generate the notice board due to an AI error.");

          alertService.error(
            'Notice Board Failed',
            'The AI could not generate the notice board. This can happen with the experimental on-device model. <strong>Restarting your browser often helps.</strong>'
          );
      }
    },

    // Export notes as JSON
    exportNotes() {
      return JSON.stringify(this.notes, null, 2);
    },

    // Import notes from JSON
    async importNotes(jsonData) {
      try {
        const importedNotes = JSON.parse(jsonData);
        if (!Array.isArray(importedNotes)) {
          throw new Error('Invalid notes data');
        }

        for (const note of importedNotes) {
          await this.createNote(note);
        }

        await this.loadNotes();
      } catch (error) {
        console.error('Failed to import notes:', error);
        throw error;
      }
    }
  }
});