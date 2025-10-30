/**
 * String Utilities
 * Provides common string manipulation and formatting functions
 */

class StringUtils {
  /**
   * Truncates a string to a maximum length with ellipsis
   * @param {string} str - String to truncate
   * @param {number} maxLength - Maximum length
   * @param {string} suffix - Suffix to add (default: '...')
   * @returns {string} - Truncated string
   */
  static truncate(str, maxLength = 100, suffix = '...') {
    if (!str) return '';
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Capitalizes the first letter of a string
   * @param {string} str - String to capitalize
   * @returns {string} - Capitalized string
   */
  static capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Converts string to title case
   * @param {string} str - String to convert
   * @returns {string} - Title cased string
   */
  static toTitleCase(str) {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Converts string to kebab-case
   * @param {string} str - String to convert
   * @returns {string} - Kebab-cased string
   */
  static toKebabCase(str) {
    if (!str) return '';
    return str
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^\w-]/g, '');
  }

  /**
   * Converts string to camelCase
   * @param {string} str - String to convert
   * @returns {string} - Camel cased string
   */
  static toCamelCase(str) {
    if (!str) return '';
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (match, index) => index === 0 ? match.toLowerCase() : match.toUpperCase())
      .replace(/[^\w]/g, '');
  }

  /**
   * Removes all whitespace from a string
   * @param {string} str - String to process
   * @returns {string} - String without whitespace
   */
  static removeWhitespace(str) {
    if (!str) return '';
    return str.replace(/\s/g, '');
  }

  /**
   * Slugifies a string for URLs
   * @param {string} str - String to slugify
   * @returns {string} - Slugified string
   */
  static slugify(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  /**
   * Counts words in a string
   * @param {string} str - String to count
   * @returns {number} - Word count
   */
  static wordCount(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Counts characters (excluding whitespace)
   * @param {string} str - String to count
   * @returns {number} - Character count
   */
  static charCount(str) {
    if (!str) return 0;
    return str.replace(/\s/g, '').length;
  }

  /**
   * Counts paragraphs in a string
   * @param {string} str - String to count
   * @returns {number} - Paragraph count
   */
  static paragraphCount(str) {
    if (!str) return 0;
    return str.split(/\n\n+/).filter(p => p.trim().length > 0).length;
  }

  /**
   * Extracts unique words from a string
   * @param {string} str - String to process
   * @returns {string[]} - Array of unique words
   */
  static extractUniqueWords(str) {
    if (!str) return [];
    return [...new Set(str.toLowerCase().match(/\b\w+\b/g) || [])].sort();
  }

  /**
   * Reverses a string
   * @param {string} str - String to reverse
   * @returns {string} - Reversed string
   */
  static reverse(str) {
    if (!str) return '';
    return str.split('').reverse().join('');
  }

  /**
   * Checks if string is empty or whitespace
   * @param {string} str - String to check
   * @returns {boolean} - True if empty
   */
  static isEmpty(str) {
    return !str || !str.trim();
  }

  /**
   * Repeats a string n times
   * @param {string} str - String to repeat
   * @param {number} times - Number of times
   * @returns {string} - Repeated string
   */
  static repeat(str, times) {
    if (!str || times < 1) return '';
    return str.repeat(Math.floor(times));
  }

  /**
   * Escapes special characters for regex
   * @param {string} str - String to escape
   * @returns {string} - Escaped string
   */
  static escapeRegex(str) {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export default StringUtils;
