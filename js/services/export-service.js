// js/export-service.js
// Export functionality for notes in multiple formats

/**
 * Exports notes to different formats
 */

/**
 * Exports all notes as JSON
 * @param {Array} notes - Array of notes
 * @returns {string} JSON string
 */
function exportToJSON(notes) {
  const exportData = {
    version: "1.0",
    exportDate: new Date().toISOString(),
    totalEntries: notes.length,
    entries: notes.map((note) => ({
      id: note.id,
      title: note.summary,
      content: note.content,
      oneLiner: note.oneLiner,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      // Include AI insights if available
      sentiment: note.sentiment || null,
      topics: note.topics || [],
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Exports notes as plain text
 * @param {Array} notes - Array of notes
 * @returns {string} Formatted text
 */
function exportToText(notes) {
  const exportDate = new Date().toLocaleDateString();
  let textContent = `Notes & Tasks Export - ${exportDate}\n`;
  textContent += `Total Entries: ${notes.length}\n`;
  textContent += "=".repeat(50) + "\n\n";

  notes.forEach((note, index) => {
    const entryDate = new Date(note.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    textContent += `Entry ${index + 1}: ${note.summary || "Untitled"}\n`;
    textContent += `Date: ${entryDate}\n`;

    // Add sentiment and topics if available
    if (note.sentiment) {
      textContent += `Mood: ${note.sentiment.emoji} ${note.sentiment.sentiment}\n`;
    }
    if (note.topics && note.topics.length > 0) {
      textContent += `Topics: ${note.topics.join(", ")}\n`;
    }

    textContent += "-".repeat(30) + "\n";

    // Convert HTML content to plain text
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = note.content;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    textContent += plainText + "\n\n";
    textContent += "=".repeat(50) + "\n\n";
  });

  return textContent;
}

/**
 * Exports notes as PDF using HTML and print
 * @param {Array} notes - Array of notes
 * @returns {Promise<void>}
 */
async function exportToPDF(notes) {
  try {
    // Create a new window for PDF generation
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      throw new Error("Unable to open print window. Please allow popups.");
    }

    const exportDate = new Date().toLocaleDateString();

    // Generate HTML content for PDF
    let htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Notes & Tasks Export - ${exportDate}</title>
                <style>
                    body {
                        font-family: 'Georgia', serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 800px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 3px solid #007AFF;
                        padding-bottom: 20px;
                        margin-bottom: 30px;
                    }
                    .header h1 {
                        color: #007AFF;
                        margin: 0;
                        font-size: 2.5em;
                        font-weight: 300;
                    }
                    .header .subtitle {
                        color: #666;
                        font-size: 1.1em;
                        margin-top: 10px;
                    }
                    .entry {
                        margin-bottom: 40px;
                        padding: 25px;
                        border: 1px solid #e0e0e0;
                        border-radius: 8px;
                        background: #fafafa;
                        page-break-inside: avoid;
                    }
                    .entry-header {
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 15px;
                        margin-bottom: 20px;
                    }
                    .entry-title {
                        font-size: 1.4em;
                        font-weight: bold;
                        color: #333;
                        margin: 0 0 8px 0;
                    }
                    .entry-date {
                        color: #777;
                        font-size: 0.9em;
                        font-style: italic;
                    }
                    .entry-meta {
                        display: flex;
                        gap: 20px;
                        margin: 10px 0;
                        font-size: 0.85em;
                    }
                    .sentiment {
                        background: #e8f4fd;
                        padding: 4px 8px;
                        border-radius: 4px;
                        color: #0066cc;
                    }
                    .topics {
                        color: #666;
                    }
                    .topic-tag {
                        background: #007AFF;
                        color: white;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-size: 0.8em;
                        margin-right: 4px;
                    }
                    .entry-content {
                        line-height: 1.8;
                        font-size: 1.05em;
                    }
                    .entry-content p {
                        margin-bottom: 15px;
                    }
                    .entry-content img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 4px;
                        margin: 15px 0;
                    }
                    .page-break { page-break-before: always; }
                    @media print {
                        body { margin: 0; padding: 15px; }
                        .entry { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✨ Notes & Tasks</h1>
                    <div class="subtitle">
                        Personal Notes Export<br>
                        ${exportDate} • ${notes.length} ${
      notes.length === 1 ? "Entry" : "Entries"
    }
                    </div>
                </div>
        `;

    // Add each note
    notes.forEach((note, index) => {
      const entryDate = new Date(note.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      htmlContent += `<div class="entry">`;
      htmlContent += `<div class="entry-header">`;
      htmlContent += `<h2 class="entry-title">${
        note.summary || "Untitled Entry"
      }</h2>`;
      htmlContent += `<div class="entry-date">${entryDate}</div>`;

      // Add sentiment and topics
      if (note.sentiment || (note.topics && note.topics.length > 0)) {
        htmlContent += `<div class="entry-meta">`;

        if (note.sentiment) {
          htmlContent += `<div class="sentiment">${note.sentiment.emoji} ${
            note.sentiment.sentiment.charAt(0).toUpperCase() +
            note.sentiment.sentiment.slice(1)
          }</div>`;
        }

        if (note.topics && note.topics.length > 0) {
          htmlContent += `<div class="topics">Topics: `;
          note.topics.forEach((topic) => {
            htmlContent += `<span class="topic-tag">${topic}</span>`;
          });
          htmlContent += `</div>`;
        }

        htmlContent += `</div>`;
      }

      htmlContent += `</div>`;
      htmlContent += `<div class="entry-content">${note.content}</div>`;
      htmlContent += `</div>`;

      // Add page break for every 2 entries (to avoid cramming)
      if ((index + 1) % 2 === 0 && index < notes.length - 1) {
        htmlContent += `<div class="page-break"></div>`;
      }
    });

    htmlContent += `
            </body>
            </html>
        `;

    // Write to the new window and trigger print
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for content to load, then print
    printWindow.onload = function () {
      setTimeout(() => {
        printWindow.print();
        // Close window after printing (optional)
        printWindow.onafterprint = function () {
          printWindow.close();
        };
      }, 500);
    };
  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

/**
 * Downloads a file with the given content
 * @param {string} content - File content
 * @param {string} filename - Name of the file
 * @param {string} mimeType - MIME type of the file
 */
function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generates appropriate filename based on format and date
 * @param {string} format - Export format (json, txt, pdf)
 * @returns {string} Generated filename
 */
function generateExportFilename(format) {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  return `notes-export-${dateStr}.${format}`;
}

/**
 * Main function that handles all formats
 * @param {Array} notes - Array of notes
 * @param {string} format - Export format ('json', 'txt', 'pdf')
 */
async function exportNotes(notes, format) {
  try {
    const filename = generateExportFilename(format);

    switch (format.toLowerCase()) {
      case "json":
        const jsonContent = exportToJSON(notes);
        downloadFile(jsonContent, filename, "application/json");
        break;

      case "txt":
        const textContent = exportToText(notes);
        downloadFile(textContent, filename, "text/plain");
        break;

      case "pdf":
        await exportToPDF(notes);
        break;

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    return { success: true, filename, format };
  } catch (error) {
    console.error(`Error exporting to ${format}:`, error);
    return { success: false, error: error.message };
  }
}

// Make functions available globally for Vue.js compatibility
window.exportToJSON = exportToJSON;
window.exportToText = exportToText;
window.exportToPDF = exportToPDF;
window.downloadFile = downloadFile;
window.generateExportFilename = generateExportFilename;
window.exportNotes = exportNotes;
