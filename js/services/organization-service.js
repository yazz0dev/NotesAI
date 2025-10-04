// js/services/organization-service.js
// Notebook and tag management system for organizing notes
/**
 * Notebook Management Service
 */
export class NotebookService {
  constructor() {
    this.db = null;
  }

  async init(db) {
    this.db = db;
  }

  async createNotebook(name, description = "", color = "#007aff") {
    const notebook = {
      id: `notebook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      color,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.db.put("notebooks", notebook);
    return notebook;
  }

  async getAllNotebooks() {
    // Check if getAll is available (modern browsers)
    if (this.db.getAll) {
      return await this.db.getAll("notebooks");
    } else {
      // Fallback for older browsers that don't support getAll
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["notebooks"], "readonly");
        const store = transaction.objectStore("notebooks");
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => {
          reject("Error fetching notebooks: " + event.target.error);
        };
      });
    }
  }

  async getNotebook(id) {
    return await this.db.get("notebooks", id);
  }

  async updateNotebook(id, updates) {
    const notebook = await this.db.get("notebooks", id);
    if (!notebook) throw new Error("Notebook not found");

    const updatedNotebook = {
      ...notebook,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.db.put("notebooks", updatedNotebook);
    return updatedNotebook;
  }

  async deleteNotebook(id) {
    // Move all notes in this notebook to default
    let notes;
    if (this.db.getAll) {
      notes = await this.db.getAll("notes");
    } else {
      // Fallback for older browsers
      notes = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["notes"], "readonly");
        const store = transaction.objectStore("notes");
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => {
          reject("Error fetching notes: " + event.target.error);
        };
      });
    }

    const notebookNotes = notes.filter((note) => note.notebookId === id);

    for (const note of notebookNotes) {
      note.notebookId = null;
      await this.db.put("notes", note);
    }

    await this.db.delete("notebooks", id);
  }
}

/**
 * Tag Management Service
 */
export class TagService {
  constructor() {
    this.db = null;
  }

  async init(db) {
    this.db = db;
  }

  async createTag(name, color = "#666") {
    const tag = {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      color,
      createdAt: new Date().toISOString(),
    };

    await this.db.put("tags", tag);
    return tag;
  }

  async getAllTags() {
    // Check if getAll is available (modern browsers)
    if (this.db.getAll) {
      return await this.db.getAll("tags");
    } else {
      // Fallback for older browsers that don't support getAll
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["tags"], "readonly");
        const store = transaction.objectStore("tags");
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => {
          reject("Error fetching tags: " + event.target.error);
        };
      });
    }
  }

  async getTag(id) {
    return await this.db.get("tags", id);
  }

  async updateTag(id, updates) {
    const tag = await this.db.get("tags", id);
    if (!tag) throw new Error("Tag not found");

    const updatedTag = {
      ...tag,
      ...updates,
    };

    await this.db.put("tags", updatedTag);
    return updatedTag;
  }

  async deleteTag(id) {
    // Remove tag from all notes
    let notes;
    if (this.db.getAll) {
      notes = await this.db.getAll("notes");
    } else {
      // Fallback for older browsers
      notes = await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["notes"], "readonly");
        const store = transaction.objectStore("notes");
        const request = store.openCursor();
        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = (event) => {
          reject("Error fetching notes: " + event.target.error);
        };
      });
    }

    for (const note of notes) {
      if (note.tags) {
        note.tags = note.tags.filter((tagId) => tagId !== id);
        await this.db.put("notes", note);
      }
    }

    await this.db.delete("tags", id);
  }

  async getTagsForNote(noteId) {
    const note = await this.db.get("notes", noteId);
    if (!note || !note.tags) return [];

    const tags = [];
    for (const tagId of note.tags) {
      const tag = await this.db.get("tags", tagId);
      if (tag) tags.push(tag);
    }

    return tags;
  }
}

// Initialize services
export const notebookService = new NotebookService();
export const tagService = new TagService();
