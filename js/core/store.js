// js/store.js

import { DB_NAME, DB_VERSION, NOTES_STORE } from "../utils/config.js";
import { generateId } from "../utils/utils.js";
import {
  notebookService,
  tagService,
} from "../services/organization-service.js";

let db;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => {
      reject("Database error: " + event.target.error);
    };
    request.onsuccess = async (event) => {
      db = event.target.result;

      // Initialize organization services
      await notebookService.init(db);
      await tagService.init(db);

      addMockDataIfNeeded();
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create notes store if it doesn't exist
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: "id" });
        // Add indexes for better querying
        notesStore.createIndex("notebookId", "notebookId", { unique: false });
        notesStore.createIndex("isFavorite", "isFavorite", { unique: false });
        notesStore.createIndex("tags", "tags", {
          unique: false,
          multiEntry: true,
        });
        notesStore.createIndex("createdAt", "createdAt", { unique: false });
        notesStore.createIndex("updatedAt", "updatedAt", { unique: false });
      }

      // Create notebooks store
      if (!db.objectStoreNames.contains("notebooks")) {
        db.createObjectStore("notebooks", { keyPath: "id" });
      }

      // Create tags store
      if (!db.objectStoreNames.contains("tags")) {
        db.createObjectStore("tags", { keyPath: "id" });
      }
    };
  });
}

export function getNotes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([NOTES_STORE], "readonly");
    const store = transaction.objectStore(NOTES_STORE);

    // Check if getAll is available (modern browsers)
    if (store.getAll) {
      const request = store.getAll();
      request.onsuccess = () => {
        resolve(
          request.result.sort(
            (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
          )
        );
      };
      request.onerror = (event) => {
        reject("Error fetching notes: " + event.target.error);
      };
    } else {
      // Fallback for older browsers that don't support getAll
      const request = store.openCursor();
      const results = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(
            results.sort(
              (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
            )
          );
        }
      };

      request.onerror = (event) => {
        reject("Error fetching notes: " + event.target.error);
      };
    }
  });
}

async function addMockDataIfNeeded() {
  const notes = await getNotes();
  if (notes.length === 0) {
    console.log("No notes found. Adding mock data...");
    const mockNotes = [
      {
        id: generateId(),
        content:
          "<p>This is my first journal entry about the Chrome AI Hackathon. I am building a privacy-first, on-device AI journal.</p><p>It feels like a really promising start.</p>",
        summary: "Hackathon Kick-off",
        oneLiner:
          "Initial thoughts on building a privacy-first AI journal for the hackathon.",
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: generateId(),
        content:
          "<p>Today, I worked on the UI and data storage using IndexedDB. The UI is calm and focused, with a dark theme.</p>",
        summary: "UI & Data Storage",
        oneLiner:
          "Implemented the bookshelf UI and chose IndexedDB for private, offline data storage.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: generateId(),
        content:
          "<p>A year ago today, I was thinking about the first AI hackathon. It's amazing to see how far things have come.</p>",
        summary: "Old Memory",
        oneLiner: "Thinking about past projects.",
        createdAt: new Date(
          new Date().setFullYear(new Date().getFullYear() - 1)
        ).toISOString(),
        updatedAt: new Date(
          new Date().setFullYear(new Date().getFullYear() - 1)
        ).toISOString(),
      },
    ];
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    mockNotes.forEach((note) => store.add(note));
  }
}

export function addNote(content, summary = "", oneLiner = "", options = {}) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const now = new Date().toISOString();
    const newNote = {
      id: generateId(),
      content,
      summary,
      oneLiner,
      createdAt: now,
      updatedAt: now,
      notebookId: options.notebookId || null,
      tags: options.tags || [],
      isFavorite: options.isFavorite || false,
      isArchived: false,
    };
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.add(newNote);
    request.onsuccess = () => resolve(newNote);
    request.onerror = (event) =>
      reject("Error adding note: " + event.target.error);
  });
}

/**
 * Updates an existing note in the database.
 * @param {Object} updatedNote - The complete note object with updated fields.
 * @returns {Promise<Object>} A promise that resolves with the updated note object.
 */
export function updateNote(updatedNote) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);

    // Add the current timestamp for updatedAt
    updatedNote.updatedAt = new Date().toISOString();

    const request = store.put(updatedNote);
    request.onsuccess = () => resolve(updatedNote);
    request.onerror = (event) =>
      reject("Error updating note: " + event.target.error);
  });
}

export function deleteNote(noteId) {
  return new Promise((resolve, reject) => {
    if (!db) return reject("Database not initialized");
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.delete(noteId);
    request.onsuccess = () => resolve();
    request.onerror = (event) =>
      reject("Error deleting note: " + event.target.error);
  });
}

/**
 * Retrieves notes from previous years matching a specific month and day.
 * @param {number} month - The month to match (0-11).
 * @param {number} day - The day to match (1-31).
 * @returns {Promise<Array>} A promise that resolves with an array of matching notes.
 */
export async function getNotesByDate(month, day) {
  const allNotes = await getNotes();
  const currentYear = new Date().getFullYear();

  return allNotes.filter((note) => {
    const noteDate = new Date(note.createdAt);
    return (
      noteDate.getMonth() === month &&
      noteDate.getDate() === day &&
      noteDate.getFullYear() < currentYear
    );
  });
}

// Notebook functions
export async function getNotebooks() {
  return await notebookService.getAllNotebooks();
}

export async function createNotebook(
  name,
  description = "",
  color = "#007aff"
) {
  return await notebookService.createNotebook(name, description, color);
}

export async function updateNotebook(id, updates) {
  return await notebookService.updateNotebook(id, updates);
}

export async function deleteNotebook(id) {
  return await notebookService.deleteNotebook(id);
}

// Tag functions
export async function getTags() {
  return await tagService.getAllTags();
}

export async function createTag(name, color = "#666") {
  return await tagService.createTag(name, color);
}

export async function updateTag(id, updates) {
  return await tagService.updateTag(id, updates);
}

export async function deleteTag(id) {
  return await tagService.deleteTag(id);
}

// Note organization functions
export async function getNotesByNotebook(notebookId) {
  const transaction = db.transaction([NOTES_STORE], "readonly");
  const store = transaction.objectStore(NOTES_STORE);
  const index = store.index("notebookId");
  return await index.getAll(notebookId);
}

export async function getFavoriteNotes() {
  const transaction = db.transaction([NOTES_STORE], "readonly");
  const store = transaction.objectStore(NOTES_STORE);
  const index = store.index("isFavorite");
  return await index.getAll(true);
}

export async function getArchivedNotes() {
  const transaction = db.transaction([NOTES_STORE], "readonly");
  const store = transaction.objectStore(NOTES_STORE);
  const request = store.getAll();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const archivedNotes = request.result.filter((note) => note.isArchived);
      resolve(archivedNotes);
    };
    request.onerror = (event) =>
      reject("Error fetching archived notes: " + event.target.error);
  });
}

export async function toggleFavoriteNote(noteId) {
  const note = await getNote(noteId);
  if (!note) throw new Error("Note not found");

  note.isFavorite = !note.isFavorite;
  note.updatedAt = new Date().toISOString();

  return await updateNote(note);
}

export async function archiveNote(noteId) {
  const note = await getNote(noteId);
  if (!note) throw new Error("Note not found");

  note.isArchived = true;
  note.updatedAt = new Date().toISOString();

  return await updateNote(note);
}

export async function unarchiveNote(noteId) {
  const note = await getNote(noteId);
  if (!note) throw new Error("Note not found");

  note.isArchived = false;
  note.updatedAt = new Date().toISOString();

  return await updateNote(note);
}

export async function getNote(noteId) {
  const transaction = db.transaction([NOTES_STORE], "readonly");
  const store = transaction.objectStore(NOTES_STORE);
  return await store.get(noteId);
}

export async function addTagsToNote(noteId, tagIds) {
  const note = await getNote(noteId);
  if (!note) throw new Error("Note not found");

  note.tags = note.tags || [];
  note.tags.push(...tagIds);
  note.updatedAt = new Date().toISOString();

  return await updateNote(note);
}

export async function removeTagFromNote(noteId, tagId) {
  const note = await getNote(noteId);
  if (!note) throw new Error("Note not found");

  if (note.tags) {
    note.tags = note.tags.filter((id) => id !== tagId);
    note.updatedAt = new Date().toISOString();
    return await updateNote(note);
  }

  return note;
}
