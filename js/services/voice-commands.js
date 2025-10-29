// js/services/voice-commands.js
import aiService from './ai-service.js';
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
    // --- Structure & Insertion ---
    {
        keywords: ['next line', 'new line', 'enter', 'break line'],
        action: (editor) => insertHTML(editor, '<div><br></div>'), // Creates a new block, more reliable than <br>
        type: 'dom'
    },
    {
        keywords: ['add a task', 'new task', 'insert task', 'checkbox', 'task item'],
        action: (editor) => insertHTML(editor, '<div class="task-item" contenteditable="false" data-checked="false"><span class="task-checkbox"></span><span class="task-text" contenteditable="true">New Task...</span></div>&nbsp;'),
        type: 'dom'
    },
    {
        keywords: ['add bullet list', 'start bullets', 'bullet points', 'unordered list'],
        action: (editor) => exec(editor, 'insertUnorderedList'),
        type: 'dom'
    },
    {
        keywords: ['add number list', 'start numbering', 'numbered list', 'ordered list'],
        action: (editor) => exec(editor, 'insertOrderedList'),
        type: 'dom'
    },
    {
        keywords: ['add a line', 'insert divider', 'horizontal rule', 'line separator'],
        action: (editor) => exec(editor, 'insertHorizontalRule'),
        type: 'dom'
    },

    // --- Formatting ---
    {
        keywords: ['make it bold', 'start bold', 'bold this', 'stop bold', 'end bold', 'bold'],
        action: (editor) => exec(editor, 'bold'),
        type: 'dom'
    },
    {
        keywords: ['underline this', 'start underline', 'add underline', 'stop underline', 'end underline', 'underline'],
        action: (editor) => exec(editor, 'underline'),
        type: 'dom'
    },
    {
        keywords: ['italicize', 'make it italic', 'start italic', 'italic'],
        action: (editor) => exec(editor, 'italic'),
        type: 'dom'
    },
    {
        keywords: ['clear formatting', 'remove style', 'normal text', 'clear style'],
        method: 'clearFormatting',
        type: 'editorMethod'
    },

    // --- Deletion ---
    {
        keywords: ['delete word', 'delete last word', 'remove word', 'scratch word'],
        method: 'deleteLastUnit',
        value: 'word',
        type: 'editorMethod'
    },
    {
        keywords: ['delete sentence', 'delete last sentence', 'remove sentence', 'scratch sentence'],
        method: 'deleteLastUnit',
        value: 'sentence',
        type: 'editorMethod'
    },
    {
        keywords: ['delete paragraph', 'delete last paragraph', 'remove paragraph', 'scratch paragraph'],
        method: 'deleteLastUnit',
        value: 'paragraph',
        type: 'editorMethod'
    },

    // --- Editor & AI Actions ---
    {
        keywords: ['undo that', 'undo', 'undo last'],
        method: 'undo',
        type: 'editorMethod'
    },
    {
        keywords: ['redo that', 'redo', 'redo last'],
        method: 'redo',
        type: 'editorMethod'
    },
    {
        keywords: ['save this note', 'save changes', 'save note'],
        method: 'forceSave',
        type: 'editorMethod'
    },
    {
        keywords: ['close editor', 'done editing', 'finish note', 'close note'],
        method: 'close',
        type: 'editorMethod'
    },
    {
        keywords: ['summarize this note', 'summary of this', 'create summary', 'summarize'],
        action: async (editor) => {
            const summary = await aiService.summarizeText(editor.innerHTML);
            alertService.infoMarkdown('Note Summary', summary);
        },
        type: 'async'
    },
    {
        keywords: ['proofread this note', 'proofread this', 'check my writing', 'proof read this', 'proofread'],
        action: async (editor) => {
            const correctedText = await aiService.proofreadText(editor.innerHTML);
            // Replace the editor content with corrected text
            editor.innerHTML = correctedText;
            alertService.success('Proofreading Complete', 'Text has been corrected.');
        },
        type: 'async'
    },
    {
        keywords: ['search for', 'find', 'search'],
        action: async (editor, query) => {
            // Note: This search functionality needs to be implemented
            // For now, show a placeholder message
            alertService.info('Search', `Search for "${query}" is not yet implemented.`);
        },
        type: 'async'
    }
];

export default commands;
