// js/store.js

import { DB_NAME, DB_VERSION, NOTES_STORE } from '../utils/config.js';
import { generateId } from '../utils/utils.js';

let db;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => { reject("Database error: " + event.target.error); };
        request.onsuccess = (event) => {
            db = event.target.result;
            addMockDataIfNeeded();
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(NOTES_STORE)) {
                db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
            }
        };
    });
}

export function getNotes() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([NOTES_STORE], 'readonly');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
            resolve(request.result.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
        };
        request.onerror = (event) => { reject("Error fetching notes: " + event.target.error); };
    });
}

async function addMockDataIfNeeded() {
    const notes = await getNotes();
    if (notes.length === 0) {
        console.log("No notes found. Adding mock data...");
        const mockNotes = [
            { id: generateId(), content: '<p>This is my first journal entry about the Chrome AI Hackathon. I am building a privacy-first, on-device AI journal.</p><p>It feels like a really promising start.</p>', summary: 'Hackathon Kick-off', oneLiner: 'Initial thoughts on building a privacy-first AI journal for the hackathon.', createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString() },
            { id: generateId(), content: '<p>Today, I worked on the UI and data storage using IndexedDB. The UI is calm and focused, with a dark theme.</p>', summary: 'UI & Data Storage', oneLiner: 'Implemented the bookshelf UI and chose IndexedDB for private, offline data storage.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            { id: generateId(), content: '<p>A year ago today, I was thinking about the first AI hackathon. It\'s amazing to see how far things have come.</p>', summary: 'Old Memory', oneLiner: 'Thinking about past projects.', createdAt: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString(), updatedAt: new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString() }
        ];
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        mockNotes.forEach(note => store.add(note));
    }
}

export function addNote(content, summary = '', oneLiner = '') {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const now = new Date().toISOString();
        const newNote = { id: generateId(), content, summary, oneLiner, createdAt: now, updatedAt: now };
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.add(newNote);
        request.onsuccess = () => resolve(newNote);
        request.onerror = (event) => reject("Error adding note: " + event.target.error);
    });
}

/**
 * Updates an existing note in the database.
 * @param {Object} updatedNote - The complete note object with updated fields.
 * @returns {Promise<Object>} A promise that resolves with the updated note object.
 */
export function updateNote(updatedNote) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        
        // Add the current timestamp for updatedAt
        updatedNote.updatedAt = new Date().toISOString();

        const request = store.put(updatedNote);
        request.onsuccess = () => resolve(updatedNote);
        request.onerror = (event) => reject("Error updating note: " + event.target.error);
    });
}


export function deleteNote(noteId) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('Database not initialized');
        const transaction = db.transaction([NOTES_STORE], 'readwrite');
        const store = transaction.objectStore(NOTES_STORE);
        const request = store.delete(noteId);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject("Error deleting note: " + event.target.error);
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

    return allNotes.filter(note => {
        const noteDate = new Date(note.createdAt);
        return noteDate.getMonth() === month &&
               noteDate.getDate() === day &&
               noteDate.getFullYear() < currentYear;
    });
}