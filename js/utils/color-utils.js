/**
 * Color Utilities
 * Utilities for color manipulation and validation
 */

class ColorUtils {
  /**
   * Gets contrasting text color (black or white)
   * @param {string} backgroundColor - Hex color (e.g., '#FF6B6B')
   * @returns {string} - '#000000' or '#FFFFFF'
   */
  static getContrastColor(backgroundColor) {
    if (!backgroundColor) return '#000000';
    
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  }

  /**
   * Checks if color is dark
   * @param {string} color - Hex color
   * @returns {boolean} - True if dark
   */
  static isDark(color) {
    return this.getContrastColor(color) === '#FFFFFF';
  }

  /**
   * Generates random color from predefined palette
   * @returns {string} - Hex color
   */
  static generateRandom() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Lightens a color
   * @param {string} color - Hex color
   * @param {number} percent - Percentage to lighten (0-100)
   * @returns {string} - Lightened hex color
   */
  static lighten(color, percent) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
    const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round(255 * percent / 100));
    const b = Math.min(255, (num & 0x0000FF) + Math.round(255 * percent / 100));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  /**
   * Darkens a color
   * @param {string} color - Hex color
   * @param {number} percent - Percentage to darken (0-100)
   * @returns {string} - Darkened hex color
   */
  static darken(color, percent) {
    const hex = color.replace('#', '');
    const num = parseInt(hex, 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * percent / 100));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * percent / 100));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * percent / 100));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
}

export default ColorUtils;
