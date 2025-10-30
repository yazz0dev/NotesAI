// js/services/voice-commands.js
import aiHandler from './ai-handler.js';
import { alertService } from './alert-service.js';

/**
 * A utility to manage voice command definitions for the note editor.
 * Each command has keywords, a type, and an action/method to call.
 */

// Helper to execute standard document commands
const exec = (editor, command, value = null) => {
    editor.focus();
    document.execCommand(command, false, value);
};

// Helper to insert custom HTML
const insertHTML = (editor, html) => {
    editor.focus();
    // A more robust way to insert a new block element
    exec(editor, 'insertHTML', html);
};

const commands = [
    // --- AI-Powered App-level Commands ---
    {
        keywords: ['hey notes', 'search for', 'find', 'search', 'create', 'summarize', 'open', 'what are', 'do I have', 'can you', 'show me', 'add', 'remind me', 'delete'],
        action: (query, originalTranscript) => window.dispatchEvent(new CustomEvent('voice-ai-query', { detail: { query, originalTranscript } })),
        requiresArgument: true,
        scope: 'app'
    },
    
    // --- Specific App-level Commands ---
    {
        keywords: ['start writing', 'start dictating', 'begin writing', 'begin dictating', 'start dictation'],
        action: () => window.dispatchEvent(new CustomEvent('voice-start-dictation')),
        scope: 'app'
    },
    {
        keywords: ['stop writing', 'stop dictating', 'end writing', 'end dictating', 'stop dictation', 'done writing'],
        action: () => window.dispatchEvent(new CustomEvent('voice-stop-dictation')),
        scope: 'app'
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
        keywords: ['next line', 'new line', 'enter', 'break line'],
        action: (editor) => insertHTML(editor, '<div><br></div>'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['add a task', 'new task', 'insert task', 'checkbox', 'task item'],
        action: (editor) => insertHTML(editor, '<div class="task-item" contenteditable="false" data-checked="false"><span class="task-checkbox"></span><span class="task-text" contenteditable="true">New Task...</span></div>&nbsp;'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['add bullet list', 'start bullets', 'bullet points', 'unordered list'],
        action: (editor) => exec(editor, 'insertUnorderedList'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['add number list', 'start numbering', 'numbered list', 'ordered list'],
        action: (editor) => exec(editor, 'insertOrderedList'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['add a line', 'insert divider', 'horizontal rule', 'line separator'],
        action: (editor) => exec(editor, 'insertHorizontalRule'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['make it bold', 'start bold', 'bold this', 'stop bold', 'end bold', 'bold'],
        action: (editor) => exec(editor, 'bold'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['underline this', 'start underline', 'add underline', 'stop underline', 'end underline', 'underline'],
        action: (editor) => exec(editor, 'underline'),
        scope: 'editor',
        type: 'dom'
    },
    {
        keywords: ['italicize', 'make it italic', 'start italic', 'italic'],
        action: (editor) => exec(editor, 'italic'),
        scope: 'editor',
        type: 'dom'
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