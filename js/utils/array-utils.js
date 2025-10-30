/**
 * Array Utilities
 * Common array manipulation functions
 */

class ArrayUtils {
  /**
   * Remove duplicates from array
   * @param {array} arr - Array to deduplicate
   * @param {string} key - Optional: property to check for duplicates
   * @returns {array} - Deduplicated array
   */
  static deduplicate(arr, key = null) {
    if (!Array.isArray(arr)) return [];
    if (!key) return [...new Set(arr)];
    
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  /**
   * Split array into chunks
   * @param {array} arr - Array to chunk
   * @param {number} size - Chunk size
   * @returns {array} - Array of chunks
   */
  static chunk(arr, size) {
    if (!Array.isArray(arr) || size < 1) return [];
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Group array by property
   * @param {array} arr - Array to group
   * @param {string} key - Property to group by
   * @returns {object} - Grouped object
   */
  static groupBy(arr, key) {
    if (!Array.isArray(arr)) return {};
    return arr.reduce((groups, item) => {
      const groupKey = item[key];
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
      return groups;
    }, {});
  }

  /**
   * Sort array by property
   * @param {array} arr - Array to sort
   * @param {string} key - Property to sort by
   * @param {string} order - 'asc' or 'desc'
   * @returns {array} - Sorted array
   */
  static sortBy(arr, key, order = 'asc') {
    if (!Array.isArray(arr)) return [];
    return [...arr].sort((a, b) => {
      const comparison = String(a[key]).localeCompare(String(b[key]));
      return order === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Find unique values in array
   * @param {array} arr - Array to check
   * @param {string} key - Optional: property to check
   * @returns {array} - Unique values
   */
  static unique(arr, key = null) {
    if (!Array.isArray(arr)) return [];
    if (!key) return [...new Set(arr)];
    return [...new Set(arr.map(item => item[key]))];
  }

  /**
   * Flatten nested array
   * @param {array} arr - Array to flatten
   * @param {number} depth - Depth to flatten (default: 1)
   * @returns {array} - Flattened array
   */
  static flatten(arr, depth = 1) {
    if (!Array.isArray(arr)) return [];
    return depth > 0
      ? arr.reduce((acc, val) => 
          acc.concat(Array.isArray(val) ? this.flatten(val, depth - 1) : val), 
          [])
      : arr;
  }

  /**
   * Find index of item in array
   * @param {array} arr - Array to search
   * @param {function} predicate - Test function
   * @returns {number} - Index or -1
   */
  static findIndex(arr, predicate) {
    if (!Array.isArray(arr)) return -1;
    return arr.findIndex(predicate);
  }

  /**
   * Remove item from array by index or predicate
   * @param {array} arr - Array to modify
   * @param {number|function} indexOrPredicate - Index or predicate function
   * @returns {array} - New array without item
   */
  static remove(arr, indexOrPredicate) {
    if (!Array.isArray(arr)) return [];
    if (typeof indexOrPredicate === 'number') {
      return arr.filter((_, i) => i !== indexOrPredicate);
    }
    return arr.filter((item, i) => !indexOrPredicate(item, i));
  }
}

export default ArrayUtils;
