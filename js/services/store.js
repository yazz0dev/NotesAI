// js/services/store.js
const DB_NAME = "AI_JournalDB";
const DB_VERSION = 5; // BUMP VERSION for new reminder index
const NOTES_STORE = "notes";
const TAGS_STORE = "tags"; // KEY CHANGE: New store name

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject("Database error: " + event.target.error);
    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      let notesStore;
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        notesStore = db.createObjectStore(NOTES_STORE, { keyPath: "id" });
      } else {
        notesStore = event.target.transaction.objectStore(NOTES_STORE);
      }
      if (!notesStore.indexNames.contains("updatedAt")) notesStore.createIndex("updatedAt", "updatedAt", { unique: false });
      if (!notesStore.indexNames.contains("isArchived")) notesStore.createIndex("isArchived", "isArchived", { unique: false });
      // NEW: Index for reminders
      if (!notesStore.indexNames.contains("reminderAt")) notesStore.createIndex("reminderAt", "reminderAt", { unique: false });
      
      // KEY CHANGE: Create the tags object store if it doesn't exist
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        console.log("Creating tags store");
        db.createObjectStore(TAGS_STORE, { keyPath: "id" });
        console.log("Tags store created successfully");
      } else {
        console.log("Tags store already exists");
      }
    };
  });
}

function getNotes() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([NOTES_STORE], "readonly");
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
    request.onerror = (event) => reject("Error fetching notes: " + event.target.error);
  });
}

function saveNote(note) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const plainNote = JSON.parse(JSON.stringify(note)); // Sanitize for IndexedDB
    const request = store.put(plainNote);
    request.onsuccess = () => resolve(plainNote);
    request.onerror = (event) => reject("Error saving note: " + event.target.error);
  });
}

function deleteNote(noteId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([NOTES_STORE], "readwrite");
    const store = transaction.objectStore(NOTES_STORE);
    const request = store.delete(noteId);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject("Error deleting note: " + event.target.error);
  });
}

// --- KEY CHANGE: NEW TAG MANAGEMENT FUNCTIONS ---
function getTags() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([TAGS_STORE], "readonly");
        const store = transaction.objectStore(TAGS_STORE);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result.sort((a,b) => a.name.localeCompare(b.name)));
        request.onerror = (event) => reject("Error fetching tags: " + event.target.error);
    });
}

function saveTag(tag) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([TAGS_STORE], "readwrite");
        const store = transaction.objectStore(TAGS_STORE);
        const plainTag = JSON.parse(JSON.stringify(tag));
        const request = store.put(plainTag);
        request.onsuccess = () => resolve(plainTag);
        request.onerror = (event) => reject("Error saving tag: " + event.target.error);
    });
}

export default {
  initDB,
  getNotes,
  saveNote,
  deleteNote,
  getTags,
  saveTag,
};