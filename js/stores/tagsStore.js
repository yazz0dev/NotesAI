import dbService from '../services/store.js';
import ValidationUtils from '../utils/validation-utils.js';
import StringUtils from '../utils/string-utils.js';
import ColorUtils from '../utils/color-utils.js';

const { defineStore } = window.Pinia;

export const useTagsStore = defineStore('tags', {
  state: () => ({
    tags: [],
    isLoading: false,
    lastSync: null
  }),

  getters: {
    // Get all tags sorted alphabetically
    allTags: (state) => {
      return [...state.tags].sort((a, b) => a.name.localeCompare(b.name));
    },

    // Get tag by ID
    getTagById: (state) => {
      return (id) => state.tags.find(tag => tag.id === id);
    },

    // Get tag by name
    getTagByName: (state) => {
      return (name) => state.tags.find(tag => 
        tag.name.toLowerCase() === name.toLowerCase()
      );
    },

    // Get tags with usage count
    tagsWithCount: (state) => {
      const notesStore = window.useNotesStore?.();
      if (!notesStore) return state.tags;

      return state.tags.map(tag => ({
        ...tag,
        count: notesStore.notes.filter(note => 
          note.tags && note.tags.includes(tag.name)
        ).length
      }));
    },

    // Get total tags count
    totalTags: (state) => state.tags.length,

    // Search tags
    searchTags: (state) => {
      return (query) => {
        if (!query) return state.tags;
        const lowerQuery = query.toLowerCase();
        return state.tags.filter(tag => 
          tag.name.toLowerCase().includes(lowerQuery) ||
          tag.description?.toLowerCase().includes(lowerQuery)
        );
      };
    }
  },

  actions: {
    // Initialize store and load tags from IndexedDB
    async initialize() {
      this.isLoading = true;
      try {
        await dbService.initDB();
        await this.loadTags();
        this.lastSync = new Date().toISOString();
      } catch (error) {
        console.error('Failed to initialize tags store:', error);
        throw error;
      } finally {
        this.isLoading = false;
      }
    },

    // Load all tags from IndexedDB
    async loadTags() {
      try {
        const tags = await dbService.getTags();
        this.tags = tags;
        return tags;
      } catch (error) {
        console.error('Failed to load tags:', error);
        throw error;
      }
    },

    // Create a new tag
    async createTag(tagData) {
      // Validate tag name
      if (!ValidationUtils.isValidTitle(tagData.name)) {
        throw new Error('Invalid tag name. Name must be between 1-200 characters');
      }

      // Check if tag already exists (case-insensitive)
      const normalized = StringUtils.slugify(tagData.name);
      const existingTag = this.tags.find(tag => StringUtils.slugify(tag.name) === normalized);
      if (existingTag) {
        console.warn('Tag already exists:', tagData.name);
        return existingTag;
      }

      const newTag = {
        id: Date.now().toString(),
        name: StringUtils.capitalize(tagData.name),
        color: tagData.color || ColorUtils.generateRandom(),
        description: tagData.description || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      try {
        const savedTag = await dbService.saveTag(newTag);
        this.tags.push(savedTag);
        return savedTag;
      } catch (error) {
        console.error('Failed to create tag:', error);
        throw error;
      }
    },

    // Update an existing tag
    async updateTag(tagId, updates) {
      const tagIndex = this.tags.findIndex(t => t.id === tagId);
      if (tagIndex === -1) {
        throw new Error('Tag not found');
      }

      // If name is being updated, validate and check for duplicates
      if (updates.name) {
        if (!ValidationUtils.isValidTitle(updates.name)) {
          throw new Error('Invalid tag name. Name must be between 1-200 characters');
        }

        // Check for case-insensitive duplicates
        const normalized = StringUtils.slugify(updates.name);
        const existingTag = this.tags.find(tag => 
          StringUtils.slugify(tag.name) === normalized && tag.id !== tagId
        );
        if (existingTag) {
          throw new Error('A tag with this name already exists');
        }

        // Normalize the name
        updates.name = StringUtils.capitalize(updates.name);
      }

      const updatedTag = {
        ...this.tags[tagIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      try {
        const savedTag = await dbService.saveTag(updatedTag);
        this.tags[tagIndex] = savedTag;
        
        // If name changed, update all notes using this tag
        if (updates.name && updates.name !== this.tags[tagIndex].name) {
          await this.updateTagInNotes(this.tags[tagIndex].name, updates.name);
        }
        
        return savedTag;
      } catch (error) {
        console.error('Failed to update tag:', error);
        throw error;
      }
    },

    // Delete a tag
    async deleteTag(tagId) {
      const tag = this.tags.find(t => t.id === tagId);
      if (!tag) {
        throw new Error('Tag not found');
      }

      try {
        // Remove tag from all notes
        const notesStore = window.useNotesStore?.();
        if (notesStore) {
          const notesWithTag = notesStore.notesByTag(tag.name);
          for (const note of notesWithTag) {
            const updatedTags = note.tags.filter(t => t !== tag.name);
            await notesStore.updateNoteTags(note.id, updatedTags);
          }
        }

        // Delete from database using dbService
        await dbService.deleteTag(tagId);
        
        this.tags = this.tags.filter(t => t.id !== tagId);
      } catch (error) {
        console.error('Failed to delete tag:', error);
        throw error;
      }
    },

    // Update tag name in all notes
    async updateTagInNotes(oldName, newName) {
      const notesStore = window.useNotesStore?.();
      if (!notesStore) return;

      const notesWithTag = notesStore.notesByTag(oldName);
      for (const note of notesWithTag) {
        const updatedTags = note.tags.map(t => t === oldName ? newName : t);
        await notesStore.updateNoteTags(note.id, updatedTags);
      }
    },

    // Merge two tags
    async mergeTags(sourceTagId, targetTagId) {
      const sourceTag = this.getTagById(sourceTagId);
      const targetTag = this.getTagById(targetTagId);

      if (!sourceTag || !targetTag) {
        throw new Error('Source or target tag not found');
      }

      try {
        // Replace source tag with target tag in all notes
        await this.updateTagInNotes(sourceTag.name, targetTag.name);
        
        // Delete source tag
        await this.deleteTag(sourceTagId);
      } catch (error) {
        console.error('Failed to merge tags:', error);
        throw error;
      }
    },

    // Generate a random color for new tags
    generateRandomColor() {
      return ColorUtils.generateRandom();
    },

    // Sync tags with notes (ensure all tags used in notes exist)
    async syncTagsFromNotes() {
      const notesStore = window.useNotesStore?.();
      if (!notesStore) return;

      const allTagNames = new Set();
      notesStore.notes.forEach(note => {
        if (note.tags) {
          note.tags.forEach(tag => allTagNames.add(tag));
        }
      });

      // Create missing tags
      for (const tagName of allTagNames) {
        const existingTag = this.getTagByName(tagName);
        if (!existingTag) {
          await this.createTag({ name: tagName });
        }
      }
    },

    // Export tags as JSON
    exportTags() {
      return JSON.stringify(this.tags, null, 2);
    },

    // Import tags from JSON
    async importTags(jsonData) {
      try {
        const importedTags = JSON.parse(jsonData);
        if (!Array.isArray(importedTags)) {
          throw new Error('Invalid tags data');
        }

        for (const tag of importedTags) {
          const existingTag = this.getTagByName(tag.name);
          if (!existingTag) {
            await this.createTag(tag);
          }
        }

        await this.loadTags();
      } catch (error) {
        console.error('Failed to import tags:', error);
        throw error;
      }
    }
  }
});
