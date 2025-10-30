/**
 * Storage Utilities
 * Wrapper for localStorage with JSON serialization and encryption helpers
 */

class StorageUtils {
  static PREFIX = 'NotesAI_';

  /**
   * Set item in localStorage
   * @param {string} key - Storage key
   * @param {any} value - Value to store (will be JSON stringified)
   * @returns {boolean} - Success status
   */
  static setItem(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(this.PREFIX + key, serialized);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Get item from localStorage
   * @param {string} key - Storage key
   * @param {any} defaultValue - Default if not found or parse fails
   * @returns {any} - Stored value or default
   */
  static getItem(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.PREFIX + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage error:', error);
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   * @param {string} key - Storage key
   * @returns {boolean} - Success status
   */
  static removeItem(key) {
    try {
      localStorage.removeItem(this.PREFIX + key);
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Clear all app-specific storage
   * @returns {boolean} - Success status
   */
  static clearAll() {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          localStorage.removeItem(key);
        }
      });
      return true;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Get all stored keys (without prefix)
   * @returns {array} - List of all keys
   */
  static getAllKeys() {
    try {
      return Object.keys(localStorage)
        .filter(key => key.startsWith(this.PREFIX))
        .map(key => key.replace(this.PREFIX, ''));
    } catch (error) {
      console.error('Storage error:', error);
      return [];
    }
  }

  /**
   * Check if key exists in storage
   * @param {string} key - Storage key
   * @returns {boolean} - Exists status
   */
  static hasKey(key) {
    try {
      return localStorage.getItem(this.PREFIX + key) !== null;
    } catch (error) {
      console.error('Storage error:', error);
      return false;
    }
  }

  /**
   * Increment numeric value in storage
   * @param {string} key - Storage key
   * @param {number} increment - Amount to increment
   * @returns {number} - New value or -1 on error
   */
  static increment(key, increment = 1) {
    try {
      const current = this.getItem(key, 0);
      const newValue = current + increment;
      this.setItem(key, newValue);
      return newValue;
    } catch (error) {
      console.error('Storage error:', error);
      return -1;
    }
  }

  /**
   * Get storage size in KB
   * @returns {number} - Size in KB
   */
  static getSize() {
    try {
      let size = 0;
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.PREFIX)) {
          size += localStorage.getItem(key).length + key.length;
        }
      });
      return (size / 1024).toFixed(2);
    } catch (error) {
      console.error('Storage error:', error);
      return 0;
    }
  }
}

export default StorageUtils;
