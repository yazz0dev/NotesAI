/**
 * Validation Utilities
 * Provides common validation functions for notes and content
 */

class ValidationUtils {
  /**
   * Validates if content is empty or too short
   * @param {string} content - Content to validate
   * @param {number} minLength - Minimum required length (default: 1)
   * @returns {boolean} - True if valid
   */
  static isValidContent(content, minLength = 1) {
    if (!content) return false;
    return content.trim().length >= minLength;
  }

  /**
   * Validates note title
   * @param {string} title - Title to validate
   * @returns {boolean} - True if valid
   */
  static isValidTitle(title) {
    if (!title) return false;
    return title.trim().length > 0 && title.trim().length <= 200;
  }

  /**
   * Validates email address
   * @param {string} email - Email to validate
   * @returns {boolean} - True if valid
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates URL
   * @param {string} url - URL to validate
   * @returns {boolean} - True if valid
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validates if date string is valid
   * @param {string|Date} dateString - Date to validate
   * @returns {boolean} - True if valid
   */
  static isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  /**
   * Validates if color is valid hex format
   * @param {string} color - Color to validate
   * @returns {boolean} - True if valid hex color
   */
  static isValidHexColor(color) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }

  /**
   * Validates if string contains only numbers
   * @param {string} str - String to validate
   * @returns {boolean} - True if numeric
   */
  static isNumeric(str) {
    return /^\d+$/.test(str);
  }

  /**
   * Validates if string contains only letters
   * @param {string} str - String to validate
   * @returns {boolean} - True if alphabetic
   */
  static isAlphabetic(str) {
    return /^[a-zA-Z\s]*$/.test(str);
  }

  /**
   * Validates if string contains only alphanumeric characters
   * @param {string} str - String to validate
   * @returns {boolean} - True if alphanumeric
   */
  static isAlphanumeric(str) {
    return /^[a-zA-Z0-9\s]*$/.test(str);
  }

  /**
   * Validates password strength
   * @param {string} password - Password to validate
   * @returns {object} - Validation result with score and feedback
   */
  static validatePasswordStrength(password) {
    let strength = 0;
    const feedback = [];

    if (!password) {
      return { valid: false, strength: 0, feedback: ['Password is required'] };
    }

    if (password.length >= 8) strength++;
    else feedback.push('At least 8 characters required');

    if (password.length >= 12) strength++;

    if (/[a-z]/.test(password)) strength++;
    else feedback.push('Include lowercase letters');

    if (/[A-Z]/.test(password)) strength++;
    else feedback.push('Include uppercase letters');

    if (/\d/.test(password)) strength++;
    else feedback.push('Include numbers');

    if (/[!@#$%^&*]/.test(password)) strength++;
    else feedback.push('Include special characters (!@#$%^&*)');

    return {
      valid: strength >= 3,
      strength,
      feedback,
      level: strength < 2 ? 'weak' : strength < 4 ? 'medium' : 'strong'
    };
  }

  /**
   * Validates array of tags
   * @param {array} tags - Tags to validate
   * @param {number} maxTags - Maximum number of tags
   * @returns {boolean} - True if valid
   */
  static isValidTags(tags, maxTags = 10) {
    if (!Array.isArray(tags)) return false;
    if (tags.length > maxTags) return false;
    return tags.every(tag => typeof tag === 'string' && tag.trim().length > 0);
  }

  /**
   * Validates reminder date
   * @param {string|Date} reminderDate - Date to validate
   * @returns {object} - Validation result
   */
  static validateReminderDate(reminderDate) {
    if (!this.isValidDate(reminderDate)) {
      return { valid: false, message: 'Invalid date format' };
    }

    const date = new Date(reminderDate);
    const now = new Date();

    if (date < now) {
      return { valid: false, message: 'Reminder date must be in the future' };
    }

    return { valid: true, message: 'Valid reminder date' };
  }

  /**
   * Sanitizes filename
   * @param {string} filename - Filename to sanitize
   * @returns {string} - Sanitized filename
   */
  static sanitizeFilename(filename) {
    if (!filename) return 'file';
    return filename
      .replace(/[/\\?%*:|"<>]/g, '')
      .replace(/\.+$/, '')
      .trim()
      .substring(0, 255);
  }

  /**
   * Validates note object
   * @param {object} note - Note object to validate
   * @returns {object} - Validation result with errors array
   */
  static validateNote(note) {
    const errors = [];

    if (!note || typeof note !== 'object') {
      return { valid: false, errors: ['Note must be an object'] };
    }

    if (!this.isValidTitle(note.title)) {
      errors.push('Title is required and must be less than 200 characters');
    }

    if (note.content !== undefined && !this.isValidContent(note.content, 0)) {
      errors.push('Content must be a valid string');
    }

    if (note.tags && !this.isValidTags(note.tags)) {
      errors.push('Tags must be an array of strings');
    }

    if (note.updatedAt && !this.isValidDate(note.updatedAt)) {
      errors.push('Updated date is invalid');
    }

    if (note.reminderAt && !this.isValidDate(note.reminderAt)) {
      errors.push('Reminder date is invalid');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default ValidationUtils;
