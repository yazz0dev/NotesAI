/**
 * Notice Board Cache Service
 * Manages IndexedDB storage for notice board content per view
 * Only regenerates notice board if notes in the view have changed
 */

class NoticeBoardCacheService {
  constructor() {
    this.dbName = 'NotesAI_NoticeBoard';
    this.storeName = 'notice_boards';
    this.version = 1;
    this.db = null;
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'viewId' });
        }
      };
    });
  }

  /**
   * Generate a unique view identifier
   * @param {string} currentFilter - Current filter (e.g., 'all', 'favorites', 'archived')
   * @param {string|null} currentTag - Current tag if filtering by tag
   * @returns {string}
   */
  getViewId(currentFilter, currentTag = null) {
    if (currentTag) {
      return `tag:${currentTag}`;
    }
    return currentFilter || 'all';
  }

  /**
   * Generate a signature for the current notes to detect changes
   * @param {Array} notes - Array of notes in the current view
   * @returns {string}
   */
  generateNotesSignature(notes) {
    if (!notes || notes.length === 0) {
      return 'empty';
    }
    return notes
      .map(note => `${note.id}-${note.updatedAt}`)
      .sort()
      .join('|');
  }

  /**
   * Get cached notice board for a view
   * @param {string} viewId - View identifier
   * @returns {Promise<Object|null>}
   */
  async getCached(viewId) {
    try {
      await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(viewId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch (error) {
      console.error('Error retrieving cached notice board:', error);
      return null;
    }
  }

  /**
   * Save notice board to cache
   * @param {string} viewId - View identifier
   * @param {string} content - HTML content of notice board
   * @param {string} notesSignature - Signature of the current notes
   * @param {number} timestamp - Timestamp of when it was generated
   * @returns {Promise<boolean>}
   */
  async setCached(viewId, content, notesSignature, timestamp = Date.now()) {
    try {
      await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const data = {
          viewId,
          content,
          notesSignature,
          timestamp,
          expiresAt: timestamp + 24 * 60 * 60 * 1000 // 24 hours expiry
        };

        const request = store.put(data);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error('Error saving notice board to cache:', error);
      return false;
    }
  }

  /**
   * Check if cached content is still valid based on notes signature
   * @param {string} viewId - View identifier
   * @param {string} currentNotesSignature - Current signature of the notes
   * @returns {Promise<{valid: boolean, cached: Object|null}>}
   */
  async isValidCache(viewId, currentNotesSignature) {
    try {
      const cached = await this.getCached(viewId);

      if (!cached) {
        return { valid: false, cached: null };
      }

      // Check if expired (24 hours)
      const now = Date.now();
      if (cached.expiresAt && cached.expiresAt < now) {
        await this.deleteCached(viewId);
        return { valid: false, cached: null };
      }

      // Check if notes signature matches
      const isValid = cached.notesSignature === currentNotesSignature;
      return { valid: isValid, cached };
    } catch (error) {
      console.error('Error validating cache:', error);
      return { valid: false, cached: null };
    }
  }

  /**
   * Delete cached notice board for a view
   * @param {string} viewId - View identifier
   * @returns {Promise<boolean>}
   */
  async deleteCached(viewId) {
    try {
      await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(viewId);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error('Error deleting cached notice board:', error);
      return false;
    }
  }

  /**
   * Clear all cached notice boards
   * @returns {Promise<boolean>}
   */
  async clearAll() {
    try {
      await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error('Error clearing notice board cache:', error);
      return false;
    }
  }

  /**
   * Get all cached notice boards
   * @returns {Promise<Array>}
   */
  async getAll() {
    try {
      await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });
    } catch (error) {
      console.error('Error retrieving all cached notice boards:', error);
      return [];
    }
  }
}

export const noticeBoardCacheService = new NoticeBoardCacheService();
