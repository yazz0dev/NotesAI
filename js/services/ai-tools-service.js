// js/services/ai-tools-service.js
import { useNotesStore, useTagsStore } from '../stores/index.js';
import { alertService } from './alert-service.js';
import promptAPIService from './promptapi-service.js';
import summaryService from './summary-service.js';
import { noteActionsService } from './note-actions-service.js';

// --- Comprehensive Tool Definitions for the AI ---
const TOOL_DEFINITIONS = [
    // --- Note Creation & Reading ---
    {
        name: 'createNote',
        description: 'Creates a new note. Use when the user wants to "create", "make", "write down", or "start" a new note.',
        parameters: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'The title of the new note.' },
                content: { type: 'string', description: 'Optional initial content for the note.' },
                tags: { type: 'array', items: { type: 'string' }, description: 'Optional list of tags to add to the note.' },
            },
            required: ['title'],
        },
    },
    {
        name: 'searchNotes',
        description: 'Searches for notes matching a query string and displays the results. Use for general discovery like "find my notes on project X".',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'The search term.' } },
            required: ['query'],
        },
    },
    {
        name: 'findAndOpenNote',
        description: 'Finds the single most relevant note for a query and opens it for editing. Use for specific commands like "open my recipe for pasta".',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Keywords to find the specific note.' } },
            required: ['query'],
        },
    },
    // --- Note Modification ---
    {
        name: 'appendToNote',
        description: 'Adds new content to the end of a specific note identified by a query.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keywords to identify the target note.' },
                content: { type: 'string', description: 'The content to append to the note.' },
            },
            required: ['query', 'content'],
        },
    },
    {
        name: 'addTagsToNote',
        description: 'Assigns one or more tags to a specific note.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keywords to identify the target note.' },
                tags: { type: 'array', items: { type: 'string' }, description: 'A list of tag names to add.' },
            },
            required: ['query', 'tags'],
        },
    },
    {
        name: 'setReminderForNote',
        description: 'Opens the user interface to set or update a reminder for a specific note.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keywords to identify the target note.' }
            },
            required: ['query'],
        },
    },
    // --- Note State Management ---
    {
        name: 'toggleFavoriteStatus',
        description: 'Marks a note as a favorite, or removes it if it is already a favorite.',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Keywords to identify the target note.' } },
            required: ['query'],
        },
    },
    {
        name: 'archiveNote',
        description: 'Moves a note to the archive. The note is not deleted.',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Keywords to identify the target note.' } },
            required: ['query'],
        },
    },
    {
        name: 'deleteNote',
        description: 'Deletes a note permanently. This is irreversible.',
        parameters: {
            type: 'object',
            properties: { 
                query: { type: 'string', description: 'Keywords to identify the target note to be deleted.' },
                confirm: { type: 'boolean', description: 'If true, bypasses user confirmation. Set to true only if the user uses strong, explicit language like "permanently delete now" or "delete without asking". Defaults to false.'}
            },
            required: ['query'],
        },
    },
    // --- AI Content Operations ---
    {
        name: 'findAndSummarizeNote',
        description: 'Finds the most relevant note for a query and provides a summary. Use for questions like "summarize my note about the weekly meeting".',
        parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Keywords to find the relevant note.' } },
            required: ['query'],
        },
    },
    {
        name: 'summarizeCurrentNote',
        description: 'Summarizes the content of the currently open note in the editor. Use only when the user says "summarize this" or "summarize this note".',
        parameters: { type: 'object', properties: {} },
    },
    {
        name: 'changeNoteTone',
        description: 'Rewrites the content of a specific note to match a desired tone (e.g., professional, casual, concise).',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Keywords to identify the target note.' },
                tone: { type: 'string', description: 'The desired tone (e.g., "more professional", "shorter", "like a pirate").' },
            },
            required: ['query', 'tone'],
        },
    },
    // --- UI and View Control ---
    {
        name: 'switchView',
        description: 'Changes the main view of the notes list. Can switch to all notes, favorites, archived, or notes with a specific tag.',
        parameters: {
            type: 'object',
            properties: {
                view: { type: 'string', enum: ['all', 'favorites', 'archived', 'tag'], description: 'The view to switch to.' },
                tagName: { type: 'string', description: 'The name of the tag to filter by, only if view is "tag".' },
            },
            required: ['view'],
        },
    },
    // --- General & Fallback ---
     {
        name: 'answerGeneralQuestion',
        description: 'Answers a general question based on the context of all available notes. Use this for broad questions like "what are my main priorities?" or "what is the status of the marketing campaign?".',
        parameters: {
            type: 'object',
            properties: { question: { type: 'string', description: 'The user\'s question.' } },
            required: ['question'],
        },
    },
    {
        name: 'no_op',
        description: 'Use this when the user\'s query is conversational (e.g., "hello", "thank you") or does not require any specific action on the notes.',
        parameters: {
            type: 'object',
            properties: {
                response: { type: 'string', description: 'A brief, friendly response to the user.' }
            },
            required: ['response']
        },
    },
];

// --- Schema for the AI's response ---
const TOOL_CALL_SCHEMA = {
    type: 'object',
    properties: {
        tool_name: {
            type: 'string',
            description: 'The name of the tool to be called.',
            enum: TOOL_DEFINITIONS.map(t => t.name),
        },
        arguments: {
            type: 'object',
            description: 'The arguments for the tool, matching the tool\'s parameter schema.',
        },
    },
    required: ['tool_name', 'arguments'],
};


// --- Service Implementation ---
class AIToolsService {
    constructor() {
        this.isProcessing = false;
        this.vueInstance = null;
    }
    
    setVueInstance(instance) {
        this.vueInstance = instance;
    }

    async processQueryWithTools(query) {
        if (this.isProcessing || !this.vueInstance) return;
        this.isProcessing = true;
        this.vueInstance.aiStatus = { status: 'processing', message: 'AI is thinking...' };

        try {
            const systemPrompt = this.buildSystemPrompt();
            
            const toolCallResponse = await promptAPIService.structuredPrompt(
                query,
                TOOL_CALL_SCHEMA,
                { systemPrompt, omitSchemaFromPrompt: true }
            );

            if (toolCallResponse && toolCallResponse.tool_name) {
                await this.executeTool(toolCallResponse.tool_name, toolCallResponse.arguments);
            } else {
                throw new Error("AI did not return a valid tool call.");
            }
        } catch (error) {
            console.error("AI Tool processing error:", error);
            alertService.error('AI Error', 'The AI could not process your request. It might be offline or busy. Please try again.');
        } finally {
            this.isProcessing = false;
            this.vueInstance.aiStatus = { status: 'ready', message: 'AI services ready.' };
        }
    }

    // **NEW**: Creates a compact representation of tools for the prompt.
    buildCompactToolDescriptions() {
        return TOOL_DEFINITIONS.map(tool => {
            const params = Object.entries(tool.parameters.properties)
                .map(([name, spec]) => `${name}: ${spec.type}`)
                .join(', ');
            return `${tool.name}(${params}): ${tool.description}`;
        }).join('\n');
    }

    buildSystemPrompt() {
        const notesStore = useNotesStore();
        const compactTools = this.buildCompactToolDescriptions();
        const noteContext = notesStore.activeNotes
            .slice(0, 10) // Reduced context size for speed
            .map(note => `- "${note.title}"`)
            .join('\n');

        const editingNote = notesStore.editingNote;
        let editingNoteContext = 'No note is currently being edited.';
        if (editingNote) {
            editingNoteContext = `The user is currently editing a note titled "${editingNote.title}". Commands like "summarize this" should apply to this note by calling 'summarizeCurrentNote'.`
        }

        return `You are a powerful assistant for a notes app. Your ONLY job is to analyze the user's request and choose the single most appropriate tool to call. Respond exclusively with a JSON object that matches the tool call schema. Do not add any extra text or explanations.

Available Tools:
${compactTools}

Current Context:
${editingNoteContext}
Recent Notes (for context):
${noteContext}

Analyze the user's request and call the correct tool. If no action is needed, use 'no_op'.`;
    }
    
    _findMostRelevantNote(query) {
        const notesStore = useNotesStore();
        const lowerQuery = query.toLowerCase();
        if (!notesStore.activeNotes || notesStore.activeNotes.length === 0) return null;

        const scoredNotes = notesStore.activeNotes.map(note => {
            let score = 0;
            const lowerTitle = note.title.toLowerCase();
            if (lowerTitle.includes(lowerQuery)) score += 10;
            if (lowerTitle === lowerQuery) score += 20; // Exact match bonus
            const lowerContent = (note.content || '').toLowerCase().replace(/<[^>]*>/g, "");
            if (lowerContent.includes(lowerQuery)) score += 1;
            return { ...note, score };
        }).filter(note => note.score > 0);

        if (scoredNotes.length === 0) return null;
        return scoredNotes.sort((a, b) => b.score - a.score)[0];
    }

    async executeTool(toolName, args) {
        const notesStore = useNotesStore();
        let note; // Reusable variable for found note
        
        switch (toolName) {
            case 'createNote':
                const newNote = await this.vueInstance.createNewNote({ title: args.title, content: args.content || '' });
                alertService.success('Note Created', `Successfully created note: "${newNote.title}"`);
                break;
            
            case 'searchNotes':
                this.vueInstance.handleSearch(args.query);
                break;
                
            case 'findAndOpenNote':
                note = this._findMostRelevantNote(args.query);
                if (note) this.vueInstance.editNote(note);
                else alertService.warning('Not Found', `Could not find a note matching "${args.query}".`);
                break;

            case 'appendToNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    const newContent = note.content + `\n\n${args.content}`;
                    await notesStore.updateNote(note.id, { content: newContent });
                    alertService.success('Note Updated', `Appended content to "${note.title}".`);
                } else alertService.warning('Not Found', `Could not find a note matching "${args.query}" to append to.`);
                break;

            case 'addTagsToNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    const tagsStore = useTagsStore();
                    const existingTags = new Set(note.tags || []);
                    for (const tagName of args.tags) {
                        let tag = tagsStore.getTagByName(tagName);
                        if (!tag) {
                            tag = await tagsStore.createTag({ name: tagName });
                        }
                        existingTags.add(tag.id);
                    }
                    await notesStore.updateNote(note.id, { tags: Array.from(existingTags) });
                    alertService.success('Tags Updated', `Updated tags for "${note.title}".`);
                } else {
                    alertService.warning('Not Found', `Could not find a note matching "${args.query}" to tag.`);
                }
                break;

            case 'setReminderForNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    await noteActionsService.setReminder(note);
                } else {
                    alertService.warning('Not Found', `Could not find a note matching "${args.query}" to set a reminder for.`);
                }
                break;

            case 'toggleFavoriteStatus':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    await noteActionsService.toggleFavorite(note);
                    alertService.success('Favorite Toggled', `Toggled favorite status for "${note.title}".`);
                } else alertService.warning('Not Found', `Could not find a note matching "${args.query}".`);
                break;

            case 'archiveNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    await noteActionsService.archiveNote(note);
                    alertService.success('Note Archived', `Archived note: "${note.title}".`);
                } else alertService.warning('Not Found', `Could not find a note matching "${args.query}".`);
                break;

            case 'deleteNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    await noteActionsService.deleteNote(note.id, notesStore.editingNote, { force: args.confirm === true });
                } else {
                    alertService.warning('Not Found', `Could not find a note to delete matching "${args.query}".`);
                }
                break;

            case 'findAndSummarizeNote':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    const summary = await summaryService.summarizeText(note.content);
                    alertService.infoMarkdown(`Summary of "${note.title}"`, summary);
                } else alertService.warning('Not Found', `Could not find a note to summarize matching "${args.query}".`);
                break;
            
            case 'summarizeCurrentNote':
                 if (notesStore.editingNote) {
                    const summary = await summaryService.summarizeText(notesStore.editingNote.content);
                    alertService.infoMarkdown(`Summary of "${notesStore.editingNote.title}"`, summary);
                } else alertService.warning('No Note Open', 'Please open a note first to summarize it.');
                break;

            case 'changeNoteTone':
                note = this._findMostRelevantNote(args.query);
                if (note) {
                    const prompt = `Rewrite the following text to have a ${args.tone} tone. Return only the rewritten text:\n\n${note.content.replace(/<[^>]*>/g, " ")}`;
                    const rewrittenContent = await promptAPIService.runPrompt(prompt);
                    await notesStore.updateNote(note.id, { content: rewrittenContent });
                    alertService.success('Note Rewritten', `The tone of "${note.title}" has been changed to ${args.tone}.`);
                } else {
                    alertService.warning('Not Found', `Could not find a note matching "${args.query}".`);
                }
                break;

            case 'switchView':
                if (args.view === 'tag') {
                    const tagsStore = useTagsStore();
                    const tag = tagsStore.getTagByName(args.tagName);
                    if (tag) this.vueInstance.handleTagClick(tag.id);
                    else alertService.warning('Tag Not Found', `Could not find a tag named "${args.tagName}".`);
                } else {
                    this.vueInstance.switchView(args.view);
                }
                break;

            case 'answerGeneralQuestion':
                const context = notesStore.activeNotes.map(n => `Title: ${n.title}\nContent: ${n.content.replace(/<[^>]*>/g, " ").substring(0, 200)}`).join('\n---\n');
                const answer = await promptAPIService.customPrompt(args.question, context);
                alertService.infoMarkdown('AI Answer', answer);
                break;

            case 'no_op':
                if(args.response) alertService.info('AI Assistant', args.response);
                // Otherwise, do nothing for silent conversational turns
                break;
                
            default:
                console.error(`Unknown tool called: ${toolName}`);
                alertService.error('Unknown Tool', `The AI tried to use a tool that doesn't exist: ${toolName}`);
        }
    }
}

export const aiToolsService = new AIToolsService();