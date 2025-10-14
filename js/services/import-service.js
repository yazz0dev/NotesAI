// js/import-service.js
// Import functionality for notes from various formats

// Note: Using global window object for Vue.js compatibility instead of ES6 imports

/**
 * Validates and imports note data from JSON
 * @param {string} jsonString - JSON data to import
 * @returns {Promise<Object>} Import result with success status and details
 */
async function importFromJSON(jsonString) {
  try {
    const data = JSON.parse(jsonString);

    // Validate JSON structure
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error("Invalid JSON format: missing entries array");
    }

    // Validate and process entries
    const validEntries = [];
    const errors = [];

    for (let i = 0; i < data.entries.length; i++) {
      const entry = data.entries[i];

      try {
        const validatedEntry = validateAndNormalizeEntry(entry, i);
        validEntries.push(validatedEntry);
      } catch (error) {
        errors.push(`Entry ${i + 1}: ${error.message}`);
      }
    }

    if (validEntries.length === 0) {
      throw new Error("No valid entries found in import data");
    }

    // Import valid entries
    const importedEntries = [];
    for (const entry of validEntries) {
      try {
        const savedEntry = await window.store.addNote(
          entry.content,
          entry.title,
          entry.oneLiner
        );

        // Update timestamps if provided
        if (entry.createdAt || entry.updatedAt) {
          savedEntry.createdAt = entry.createdAt || savedEntry.createdAt;
          savedEntry.updatedAt = entry.updatedAt || savedEntry.updatedAt;
          await window.store.updateNote(savedEntry);
        }

        importedEntries.push(savedEntry);
      } catch (error) {
        errors.push(`Failed to save entry "${entry.title}": ${error.message}`);
      }
    }

    return {
      success: true,
      imported: importedEntries.length,
      total: data.entries.length,
      errors: errors.length > 0 ? errors : null,
      entries: importedEntries,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      imported: 0,
      total: 0,
    };
  }
}

/**
 * Imports note data from plain text format
 * @param {string} textContent - Text data to import
 * @returns {Promise<Object>} Import result
 */
async function importFromText(textContent) {
  try {
    // Parse text format entries
    const entries = parseTextFormat(textContent);

    if (entries.length === 0) {
      throw new Error("No entries found in text file");
    }

    const importedEntries = [];
    const errors = [];

    for (const entry of entries) {
      try {
        const savedEntry = await window.store.addNote(
          `<p>${entry.content.replace(/\n/g, "</p><p>")}</p>`,
          entry.title || "Text Import",
          entry.summary || "Imported from text file"
        );

        if (entry.date) {
          savedEntry.createdAt = entry.date;
          savedEntry.updatedAt = entry.date;
          await window.store.updateNote(savedEntry);
        }

        importedEntries.push(savedEntry);
      } catch (error) {
        errors.push(
          `Failed to import entry "${entry.title}": ${error.message}`
        );
      }
    }

    return {
      success: true,
      imported: importedEntries.length,
      total: entries.length,
      errors: errors.length > 0 ? errors : null,
      entries: importedEntries,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      imported: 0,
      total: 0,
    };
  }
}

/**
 * Validates and normalizes an entry object
 * @param {Object} entry - Entry to validate
 * @param {number} index - Entry index for error reporting
 * @returns {Object} Normalized entry
 */
function validateAndNormalizeEntry(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error("Entry must be an object");
  }

  // Required fields
  if (!entry.content || typeof entry.content !== "string") {
    throw new Error("Missing or invalid content");
  }

  // Normalize entry
  const normalized = {
    id: entry.id || window.generateId(),
    title: entry.title || entry.summary || `Imported Entry ${index + 1}`,
    content: entry.content.trim(),
    oneLiner: entry.oneLiner || entry.summary || "Imported note",
    createdAt: validateDate(entry.createdAt) || new Date().toISOString(),
    updatedAt:
      validateDate(entry.updatedAt) ||
      validateDate(entry.createdAt) ||
      new Date().toISOString(),
  };

  // Preserve AI insights if available
  if (entry.sentiment && typeof entry.sentiment === "object") {
    normalized.sentiment = entry.sentiment;
  }

  if (entry.topics && Array.isArray(entry.topics)) {
    normalized.topics = entry.topics.filter(
      (topic) => typeof topic === "string"
    );
  }

  return normalized;
}

/**
 * Validates and normalizes a date string
 * @param {string} dateString - Date string to validate
 * @returns {string|null} ISO date string or null if invalid
 */
function validateDate(dateString) {
  if (!dateString) return null;

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

/**
 * Parses text format entries (simple heuristic approach)
 * @param {string} textContent - Text content to parse
 * @returns {Array} Parsed entries
 */
function parseTextFormat(textContent) {
  const entries = [];

  // Split by common separators
  const sections = textContent.split(/={50,}|Entry \d+:/i);

  for (let i = 1; i < sections.length; i++) {
    // Skip first empty section
    const section = sections[i].trim();
    if (!section) continue;

    const lines = section.split("\n").filter((line) => line.trim());
    if (lines.length === 0) continue;

    let title = "";
    let date = "";
    let content = [];
    let inContent = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith("Date:")) {
        date = trimmedLine.replace("Date:", "").trim();
      } else if (trimmedLine.match(/^-{20,}$/)) {
        inContent = true;
      } else if (!inContent && !title) {
        title = trimmedLine;
      } else if (inContent) {
        content.push(trimmedLine);
      }
    }

    if (content.length > 0) {
      entries.push({
        title: title || `Entry ${entries.length + 1}`,
        content: content.join("\n"),
        summary: content[0]?.substring(0, 100) + "...",
        date: validateDate(date),
      });
    }
  }

  return entries;
}

/**
 * Handles file import from file input
 * @param {File} file - File to import
 * @returns {Promise<Object>} Import result
 */
async function importFromFile(file) {
  try {
    if (!file) {
      throw new Error("No file provided");
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const fileContent = await readFileContent(file);

    let result;

    switch (fileExtension) {
      case "json":
        result = await importFromJSON(fileContent);
        break;

      case "txt":
        result = await importFromText(fileContent);
        break;

      default:
        // Try to detect format from content
        try {
          JSON.parse(fileContent);
          result = await importFromJSON(fileContent);
        } catch {
          result = await importFromText(fileContent);
        }
    }

    return {
      ...result,
      filename: file.name,
      fileSize: file.size,
      fileType: fileExtension || "unknown",
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      imported: 0,
      total: 0,
      filename: file?.name || "unknown",
    };
  }
}

/**
 * Reads file content as text
 * @param {File} file - File to read
 * @returns {Promise<string>} File content
 */
function readFileContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      resolve(e.target.result);
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Validates import data before processing
 * @param {Object} data - Data to validate
 * @returns {Object} Validation result
 */
function validateImportData(data) {
  const validation = {
    isValid: false,
    format: "unknown",
    entriesCount: 0,
    issues: [],
  };

  try {
    // Try JSON format first
    if (typeof data === "object" && data.entries) {
      validation.format = "json";
      validation.entriesCount = Array.isArray(data.entries)
        ? data.entries.length
        : 0;

      if (validation.entriesCount === 0) {
        validation.issues.push("No entries found in JSON data");
      } else {
        validation.isValid = true;
      }
    }
    // Check if it's a JSON string
    else if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return validateImportData(parsed);
      } catch {
        // Treat as text format
        validation.format = "text";
        const entries = parseTextFormat(data);
        validation.entriesCount = entries.length;
        validation.isValid = entries.length > 0;

        if (!validation.isValid) {
          validation.issues.push("No entries found in text data");
        }
      }
    }
  } catch (error) {
    validation.issues.push(error.message);
  }

  return validation;
}

/**
 * Creates a backup before importing (optional)
 * @param {Array} currentNotes - Current notes to backup
 * @returns {Promise<string>} Backup filename
 */
async function createPreImportBackup(currentNotes) {
  try {
    const { exportToJSON, downloadFile, generateExportFilename } = await import(
      "./export-service.js"
    );

    const backupData = exportToJSON(currentNotes);
    const filename = `backup-before-import-${generateExportFilename("json")}`;

    // Create backup file (but don't auto-download unless user wants it)
    return {
      filename,
      data: backupData,
      size: new Blob([backupData]).size,
    };
  } catch (error) {
    console.error("Failed to create backup:", error);
    throw new Error("Could not create backup before import");
  }
}

// Make functions available globally for Vue.js compatibility
window.importFromJSON = importFromJSON;
window.importFromText = importFromText;
window.validateImportData = validateImportData;
window.createPreImportBackup = createPreImportBackup;
window.importFromFile = importFromFile;
window.readFileContent = readFileContent;
window.validateImportData = validateImportData;
window.createPreImportBackup = createPreImportBackup;
window.importFromFile = importFromFile;
window.readFileContent = readFileContent;
