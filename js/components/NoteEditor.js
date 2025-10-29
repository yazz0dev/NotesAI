import EditorToolbar from "./EditorToolbar.js";
import { alertService } from "../services/alert-service.js";
import aiService from "../services/ai-service.js";
import { proofread, summarize } from '../services/promptapi-service.js';

export default {
  components: {
    EditorToolbar,
  },
  props: ["note", "saveStatus"],
  emits: ["save", "close"],
  data() {
    return {
      editableNote: JSON.parse(JSON.stringify(this.note)),
      debouncedSave: null,
      undoStack: [],
      redoStack: [],
      isUndoRedo: false,
      isContentLoaded: false,
      proofreadStats: { words: 0, errors: 0 },
      isProofreading: false,
      debouncedProofread: null,
      isSummarizing: false,
      debouncedAutoSummary: null,
    };
  },
  template: `
      <aside class="note-editor d-flex flex-column border-start">
        <div class="editor-header p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <div class="flex-grow-1">
            <input type="text" class="form-control border-0 px-0 fs-4 mb-2" v-model="editableNote.summary" @input="triggerSave" placeholder="Note Title">
            <!-- Proofreading and Word Count Stats -->
            <div class="d-flex align-items-center gap-3 text-muted small mb-2">
              <span>Words: {{ proofreadStats.words }}</span>
              <span>Errors: {{ proofreadStats.errors }}</span>
              <span v-if="isProofreading" class="fst-italic">Proofreading...</span>
              <span v-if="isSummarizing" class="fst-italic">Summarizing...</span>
            </div>
            <!-- AI Summary Status -->
            <div v-if="editableNote.aiSummary" class="ai-summary-indicator d-flex align-items-center gap-2 text-muted small">
              <i class="bi bi-robot"></i>
              <span>AI Summary attached</span>
              <button class="btn btn-sm btn-outline-primary btn-sm-custom" @click="viewSummary">
                <i class="bi bi-eye"></i> View
              </button>
              <button class="btn btn-sm btn-outline-danger btn-sm-custom" @click="removeSummary">
                <i class="bi bi-trash"></i> Remove
              </button>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-secondary" @click="$emit('close')"><i class="bi bi-x-lg"></i></button>
        </div>

        <div v-if="editableNote.audioUrl" class="editor-audio-player p-3 border-bottom">
          <h6>Original Recording</h6>
          <audio :src="editableNote.audioUrl" controls class="w-100"></audio>
        </div>

        <div class="editor-content-wrapper d-flex flex-column flex-fill overflow-hidden">
          <editor-toolbar @content-change="updateContentFromDOM" @undo="undo" @redo="redo" :can-undo="undoStack.length > 0" :can-redo="redoStack.length > 0"></editor-toolbar>

          <div
              ref="editor"
              class="note-content-editable flex-fill p-3 overflow-auto"
              contenteditable="true"
              dir="ltr" 
              @input="updateContentFromDOM"
              @click="handleEditorClick"
              @paste="handlePaste"
              placeholder="Start writing or dictate a new voice note..."
          ></div>
        </div>

        <div class="editor-footer py-2 px-3 border-top text-muted d-flex align-items-center gap-2">
          <small class="ms-auto" style="font-size: 0.75rem;">Last updated: {{ formatLastUpdated(editableNote.updatedAt) }}</small>
          <small v-if="saveStatus !== 'idle'" class="fst-italic" style="font-size: 0.75rem;">
            <span v-if="saveStatus === 'saving'">Saving...</span>
            <span v-if="saveStatus === 'saved'">Saved</span>
            <span v-if="saveStatus === 'error'" class="text-danger">Save failed</span>
          </small>
        </div>
      </aside>
      `,
  watch: {
    'note.id'(newId, oldId) {
      if (newId !== oldId) {
        this.isContentLoaded = false;
        this.editableNote = JSON.parse(JSON.stringify(this.note));
        this.undoStack = [];
        this.redoStack = [];
        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = this.editableNote.content || '';
            this.isContentLoaded = true;
            this.runProofreader(); // Run when note changes
          }
        });
      }
    },
    'note.content'(newContent) {
      // Only update if the content has actually changed and we're not in the middle of an edit
      if (newContent !== this.editableNote.content && !this.isContentLoaded) {
        this.editableNote.content = newContent;
      } else if (this.isContentLoaded && newContent !== this.editableNote.content && newContent !== this.$refs.editor?.innerHTML) {
        // Update from parent only if it's different from both our state and the DOM
        this.editableNote.content = newContent;
        this.$nextTick(() => {
          if (this.$refs.editor && this.$refs.editor.innerHTML !== newContent) {
            const wasFocused = document.activeElement === this.$refs.editor;
            this.$refs.editor.innerHTML = newContent || '';
            if (wasFocused) {
              this.setCursorToEnd();
            }
          }
        });
      }
    }
  },
  created() {
    this.debouncedSave = this.debounce(() => {
      this.$emit('save', this.editableNote);
    }, 1500);
    this.debouncedProofread = this.debounce(this.runProofreader, 2000); // Create debounced proofreader
    this.debouncedAutoSummary = this.debounce(this.runAutoSummary, 10000); // Longer debounce for summarization
    window.addEventListener('ai-execute-command', this.executeVoiceCommand);
  },
  mounted() {
    if (this.$refs.editor) {
      this.$refs.editor.innerHTML = this.editableNote.content || '';
      this.isContentLoaded = true;
      this.runProofreader(); // Run on initial load
    }
  },
  beforeUnmount() {
    window.removeEventListener('ai-execute-command', this.executeVoiceCommand);
  },
  methods: {
    async executeVoiceCommand(event) {
      const { command } = event.detail;
      if (!command || !this.$refs.editor) return;

      console.log('Executing voice command:', command.keywords[0]);

      // Save current content before executing command
      const contentBefore = this.$refs.editor.innerHTML;

      try {
        if (command.type === 'dom' && command.action) {
          command.action(this.$refs.editor);
        } else if (command.type === 'editorMethod' && command.method && typeof this[command.method] === 'function') {
          await this[command.method](command.value);
        }

        // Update content from DOM after command execution
        this.$nextTick(() => {
          this.updateContentFromDOM();
          // Notify that command was executed successfully
          if (this.$refs.editor) {
            const contentAfter = this.$refs.editor.innerHTML;
            if (contentAfter !== contentBefore) {
              console.log('Content updated by command');
              // Dispatch event to notify parent that content was updated by command
              window.dispatchEvent(new CustomEvent('ai-command-executed', {
                detail: { content: contentAfter }
              }));
            }
          }
        });
      } catch (error) {
        console.error('Error executing voice command:', error);
      }
    },

    clearFormatting() {
      document.execCommand('removeFormat', false, null);
      document.execCommand('formatBlock', false, 'div');
    },
    deleteLastUnit(unit = 'word') {
      const editor = this.$refs.editor;
      editor.focus();
      const selection = window.getSelection();
      if (selection.rangeCount === 0) return;

      selection.modify('move', 'backward', 'character');
      selection.modify('extend', 'forward', unit);

      document.execCommand('delete', false, null);
    },
    forceSave() {
      this.$emit('save', this.editableNote);
    },
    close() {
      this.$emit('close');
    },
    async summarizeNote() {
      try {
        const summary = await aiService.summarizeText(this.editableNote.content);

        // Show the summary in a modal with save option
        const shouldSave = await alertService.confirm(
          'AI Summary Generated',
          'Would you like to save this summary with your note?',
          { confirmText: 'Save Summary', cancelText: 'Just View' }
        );

        if (shouldSave) {
          // Save the summary to the note
          this.editableNote.aiSummary = summary;
          this.undoStack.push({ ...this.editableNote }); // Save state for undo
          this.triggerSave();

          alertService.success('Summary Saved', 'The AI summary has been saved and attached to your note.');
        } else {
          // Just show the summary without saving
          alertService.infoMarkdown('AI Summary', summary, { confirmText: 'OK', cancelText: false });
        }
      } catch (e) {
        alertService.error('AI Error', e.message);
      }
    },
    async proofreadNote() {
      try {
        const originalContent = this.editableNote.content;
        const cleanContent = originalContent.replace(/<[^>]*>/g, " ").trim();

        // Check if there's enough content to proofread
        if (cleanContent.split(' ').length < 3) {
          alertService.info('Content Too Short', 'Please add more content before proofreading.');
          return;
        }

        // Check proofreader availability first
        const proofreaderAvailability = await aiService.checkProofreaderAvailability();
        if (!proofreaderAvailability.available && proofreaderAvailability.reason.includes('downloadable')) {
          alertService.info('Downloading AI Model', 'The proofreading AI model is downloading. This may take a few minutes on first use. Please try again shortly.', {
            confirmText: 'OK',
            cancelText: false
          });
          return;
        }

        const result = await aiService.proofreadTextWithDetails(cleanContent);

        if (result.hasCorrections) {
          this.undoStack.push(originalContent); // Save state before changing

          if (result.corrections && result.corrections.length > 0) {
            // Use new API with structured corrections - show highlights
            this.showCorrectionsWithHighlights(originalContent, result.corrections);
            alertService.success('Proofread Complete', `Found ${result.corrections.length} correction(s). Hover over highlighted text for details.`);
          } else {
            // Fallback to simple replacement
            this.editableNote.content = `<div>${result.corrected.replace(/\n/g, '</div><div>')}</div>`;
            this.$refs.editor.innerHTML = this.editableNote.content;
            alertService.success('Proofread Complete', 'The note has been updated with corrections.');
          }
        } else {
          alertService.info('No Changes', 'The AI found no corrections to make.');
        }
      } catch (e) {
        alertService.error('AI Error', e.message);
      }
    },

    viewSummary() {
      if (this.editableNote.aiSummary) {
        alertService.infoMarkdown('Saved AI Summary', this.editableNote.aiSummary, {
          confirmText: 'Close',
          cancelText: false
        });
      }
    },

    async removeSummary() {
      const confirmed = await alertService.confirm(
        'Remove AI Summary',
        'Are you sure you want to remove the saved AI summary from this note?',
        { confirmText: 'Remove', cancelText: 'Cancel' }
      );

      if (confirmed) {
        this.undoStack.push({ ...this.editableNote }); // Save state for undo
        this.editableNote.aiSummary = null;
        this.triggerSave();
        alertService.success('Summary Removed', 'The AI summary has been removed from your note.');
      }
    },

    triggerSave() {
      if (this.isContentLoaded) {
        this.debouncedSave();
      }
    },
    updateContentFromDOM() {
      if (this.$refs.editor) {
        const currentContent = this.$refs.editor.innerHTML;
        if (this.editableNote.content !== currentContent) {
          this.editableNote.content = currentContent;
          if (!this.isUndoRedo) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.editableNote)));
            if (this.undoStack.length > 50) this.undoStack.shift();
            this.redoStack = [];
          }
          this.isUndoRedo = false;
          this.triggerSave();
          this.debouncedProofread(); // Trigger the debounced proofreader
          this.debouncedAutoSummary(); // Trigger auto-summary check
        }
      }
    },
    async runAutoSummary() {
        if (!this.$refs.editor || this.isSummarizing || this.editableNote.aiSummary) {
            return; // Don't run if summarizing, or summary already exists
        }

        const content = this.$refs.editor.innerText;
        const wordCount = content.split(' ').filter(Boolean).length;

        if (wordCount < 150) { // Word count threshold
            return;
        }

        this.isSummarizing = true;
        try {
            const summary = await summarize(this.$refs.editor.innerHTML);
            this.editableNote.aiSummary = summary;
            this.triggerSave();
            // The UI will automatically update to show the summary status
        } catch (error) {
            console.error("Automatic summarization failed:", error);
        } finally {
            this.isSummarizing = false;
        }
    },
    async runProofreader() {
        if (!this.$refs.editor) return;
        const content = this.$refs.editor.innerText; // Use innerText to get clean text
        const wordCount = content.split(' ').filter(Boolean).length;

        if (wordCount < 3) {
            this.proofreadStats = { words: wordCount, errors: 0 };
            return;
        }

        this.isProofreading = true;
        try {
            const result = await proofread(content); // Use the new service
            this.proofreadStats = result.stats;
        } catch (error) {
            console.error("Continuous proofreading failed:", error);
            // Optionally show a small error indicator in the UI
        } finally {
            this.isProofreading = false;
        }
    },
    undo() {
      if (this.undoStack.length > 1) {
        this.redoStack.push(JSON.parse(JSON.stringify(this.undoStack.pop())));
        const previousNoteState = this.undoStack[this.undoStack.length - 1];
        this.isUndoRedo = true;
        this.editableNote = JSON.parse(JSON.stringify(previousNoteState));
        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = previousNoteState.content;
            this.setCursorToEnd();
            this.triggerSave();
          }
        });
      }
    },
    redo() {
      if (this.redoStack.length > 0) {
        const nextNoteState = this.redoStack.pop();
        this.undoStack.push(JSON.parse(JSON.stringify(nextNoteState)));
        this.isUndoRedo = true;
        this.editableNote = JSON.parse(JSON.stringify(nextNoteState));
        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = nextNoteState.content;
            this.setCursorToEnd();
            this.triggerSave();
          }
        });
      }
    },
    setCursorToEnd() {
      const editor = this.$refs.editor;
      if (editor) {
        editor.focus();
        try {
          const range = document.createRange();
          const selection = window.getSelection();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) { }
      }
    },
    debounce(func, delay) {
      let timeout;
      return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    },
    handleEditorClick(event) {
      if (event.target.classList.contains('task-checkbox')) {
        const taskItem = event.target.closest('.task-item');
        if (taskItem) {
          const isChecked = taskItem.dataset.checked === 'true';
          taskItem.dataset.checked = !isChecked;
          this.$nextTick(() => this.updateContentFromDOM());
        }
      }
    },
    handlePaste(event) {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    },
    showCorrectionsWithHighlights(originalContent, corrections) {
      const editor = this.$refs.editor;
      if (!editor) return;

      // Clear any existing highlights
      this.clearCorrectionHighlights();

      // Sort corrections by startIndex in descending order to avoid index shifting
      corrections.sort((a, b) => b.startIndex - a.startIndex);

      let html = originalContent;
      const highlights = [];

      corrections.forEach((correction, index) => {
        const beforeError = html.substring(0, correction.startIndex);
        const errorText = html.substring(correction.startIndex, correction.endIndex);
        const afterError = html.substring(correction.endIndex);

        // Create highlighted span with tooltip
        const highlightId = `correction-${index}`;
        const highlightedError = `<span id="${highlightId}" class="correction-highlight" data-correction-index="${index}" title="${this.getCorrectionTooltip(correction)}">${errorText}</span>`;

        html = beforeError + highlightedError + afterError;

        highlights.push({
          id: highlightId,
          correction: correction
        });
      });

      // Update the editor content
      editor.innerHTML = html;
      this.editableNote.content = html;

      // Add event listeners for highlights
      this.$nextTick(() => {
        highlights.forEach(({ id, correction }) => {
          const element = document.getElementById(id);
          if (element) {
            element.addEventListener('click', () => this.showCorrectionDetails(correction));
          }
        });
      });
    },

    clearCorrectionHighlights() {
      const editor = this.$refs.editor;
      if (!editor) return;

      // Remove all correction highlights
      const highlights = editor.querySelectorAll('.correction-highlight');
      highlights.forEach(highlight => {
        const text = highlight.textContent;
        highlight.parentNode.replaceChild(document.createTextNode(text), highlight);
      });
    },

    getCorrectionTooltip(correction) {
      let tooltip = `Error: ${correction.errorType || 'Unknown'}`;
      if (correction.replacement) {
        tooltip += `\nSuggestion: ${correction.replacement}`;
      }
      if (correction.explanation) {
        tooltip += `\nExplanation: ${correction.explanation}`;
      }
      return tooltip;
    },

    showCorrectionDetails(correction) {
      let message = `**Error Type:** ${correction.errorType || 'Unknown'}\n\n`;

      if (correction.replacement) {
        message += `**Suggested:** ${correction.replacement}\n\n`;
      }

      if (correction.explanation) {
        message += `**Explanation:** ${correction.explanation}`;
      }

      alertService.info('Correction Details', message, {
        confirmText: 'Got it',
        cancelText: false
      });
    },

    formatLastUpdated(dateString) {
      if (!dateString) return 'Never';
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
      });
    },
  },
};