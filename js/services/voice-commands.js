// File to edit: NotesAi/js/services/voice-commands.js

// js/services/voice-commands.js

/**
 * A utility to manage voice command definitions for the note editor.
 * Each command has keywords, a type, and an action/method to call.
 */
const commands = [
    // --- Specific App-level Commands ---
    {
        keywords: ['create a new note', 'make a new note', 'new note'],
        action: () => window.dispatchEvent(new CustomEvent('voice-create-note')),
        scope: 'app'
    },
    {
        keywords: ['stop dictating', 'end dictation', 'stop writing', 'done writing'],
        action: () => window.dispatchEvent(new CustomEvent('voice-stop-dictation')),
        scope: 'app' // This can be called from anywhere
    },
    {
        keywords: ['close editor', 'done editing', 'finish note', 'close note'],
        action: () => window.dispatchEvent(new CustomEvent('voice-close-editor')),
        scope: 'app'
    },
    {
        keywords: ['save this note', 'save changes', 'save note'],
        action: () => window.dispatchEvent(new CustomEvent('voice-save-note')),
        scope: 'app'
    },

    // --- Editor-level Commands ---
    {
        keywords: ['next paragraph', 'new paragraph'],
        method: 'insertParagraph',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['next line', 'new line', 'enter', 'break line'],
        method: 'insertLineBreak',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['add a task', 'new task', 'insert task', 'checkbox', 'task item'],
        method: 'insertTask',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['add bullet list', 'start bullets', 'bullet points', 'unordered list'],
        method: 'insertUnorderedList',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['add number list', 'start numbering', 'numbered list', 'ordered list'],
        method: 'insertOrderedList',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['add a line', 'insert divider', 'horizontal rule', 'line separator'],
        method: 'insertHorizontalRule',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['make it bold', 'start bold', 'bold this', 'stop bold', 'end bold', 'bold'],
        method: 'toggleBold',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['underline this', 'start underline', 'add underline', 'stop underline', 'end underline', 'underline'],
        method: 'toggleUnderline',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['italicize', 'make it italic', 'start italic', 'italic'],
        method: 'toggleItalic',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['clear formatting', 'remove style', 'normal text', 'clear style'],
        method: 'clearFormatting',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['delete word', 'delete last word', 'remove word', 'scratch word'],
        method: 'deleteLastUnit',
        value: 'word',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['delete sentence', 'delete last sentence', 'remove sentence', 'scratch sentence'],
        method: 'deleteLastUnit',
        value: 'sentence',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['delete paragraph', 'delete last paragraph', 'remove paragraph', 'scratch paragraph'],
        method: 'deleteLastUnit',
        value: 'paragraph',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['undo that', 'undo', 'undo last'],
        method: 'undo',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['redo that', 'redo', 'redo last'],
        method: 'redo',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['summarize this note', 'summary of this', 'create summary', 'summarize'],
        method: 'summarizeNote',
        scope: 'editor',
        type: 'editorMethod'
    },
    {
        keywords: ['proofread this note', 'proofread this', 'check my writing', 'proof read this', 'proofread'],
        method: 'proofreadNote',
        scope: 'editor',
        type: 'editorMethod'
    }
];

export default commands;