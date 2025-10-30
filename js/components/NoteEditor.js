import EditorToolbar from "./EditorToolbar.js";
import { alertService } from "../services/alert-service.js";
import { toastService } from "../services/toast-service.js";
import aiHandler from "../services/ai-handler.js";
import { ValidationUtils, StringUtils, DateUtils, MarkdownHandler } from "../utils/index.js";

export default {
  components: {
    EditorToolbar,
  },
  props: ["note", "saveStatus"],
  emits: ["save", "close"],
  data() {
    return {
      editableNote: null,
      debouncedSave: null,
      undoStack: [],
      redoStack: [],
      isUndoRedo: false,
      isContentLoaded: false,
      wordCount: 0,
      isProofreading: false,
      debouncedProofread: null,
  isSummarizing: false,
  debouncedAutoSummary: null,
      isExecutingCommand: false, 
    };
  },
  watch: {
    'note.id'(newId, oldId) {
      if (newId !== oldId) {
        this.resetEditorState();
      }
    },
    /**
     * **THE KEY FIX IS HERE.**
     * This watcher now specifically listens for changes to the note's content from the parent.
     * This is what happens when the dictation service updates the main state.
     */
    'note.content'(newContent) {
        if (!this.$refs.editor || !this.isContentLoaded) return;

        // CRITICAL CHECK: Only update the editor if the incoming content
        // is different from what's already displayed. This prevents infinite loops.
        if (newContent !== this.$refs.editor.innerHTML) {
            console.log("External content change detected. Updating editor view.");

            // Store cursor position before changing the DOM
            const selection = window.getSelection();
            const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
            const oldLength = this.$refs.editor.textContent.length;
            const cursorPosition = range ? range.startOffset : oldLength;

            // Update the local data and the editor's display
            this.editableNote.content = newContent;
            this.$refs.editor.innerHTML = newContent;

            // Restore the cursor position to the end of the new text,
            // which is the expected behavior for dictation.
            this.setCursorToEnd();
            
            // Update other reactive properties
            this.updateWordCount();
        }
    }
  },
  created() {
    this.debouncedSave = this.debounce(() => this.$emit('save', this.editableNote), 1500);
    this.debouncedProofread = this.debounce(this.runProofreader, 2500);
    this.debouncedAutoSummary = this.debounce(this.runAutoSummary, 10000);
    window.addEventListener('editor-command', this.handleVoiceCommand);
    this.resetEditorState();
  },
  mounted() {
    if (this.$refs.editor && this.editableNote) {
        this.$refs.editor.innerHTML = this.editableNote.content || '';
        this.isContentLoaded = true;
        this.updateWordCount();
    }
  },
  beforeUnmount() {
    window.removeEventListener('editor-command', this.handleVoiceCommand);
  },
  template: `
      <aside v-if="editableNote" class="note-editor d-flex flex-column border-start">
        <div class="editor-header p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <div class="flex-grow-1">
            <input type="text" class="form-control border-0 px-0 fs-4 mb-2" v-model="editableNote.title" @input="triggerSave" placeholder="Note Title">
            <div class="d-flex gap-2 mb-2">
              <button class="btn btn-sm btn-outline-primary" @click="manualProofread" :disabled="isProofreading" title="Proofread this note with AI">
                <i class="bi bi-magic"></i> {{ isProofreading ? 'Checking...' : 'Proofread' }}
              </button>
              <button class="btn btn-sm btn-outline-success" @click="manualSummarize" :disabled="isSummarizing" title="Generate AI summary">
                <i class="bi bi-file-text"></i> {{ isSummarizing ? 'Summarizing...' : 'Summarize' }}
              </button>
            </div>
            <div class="d-flex align-items-center gap-3 text-muted small mb-2">
              <span><i class="bi bi-fonts"></i> {{ wordCount }} words</span>
              <!-- Compact header badge for proofreader suggestions. Actual hints appear inline on hover. -->
              <div v-if="editableNote.aiProofread && editableNote.aiProofread.corrections && editableNote.aiProofread.corrections.length > 0" class="d-flex align-items-center gap-2">
                <span class="text-warning fw-bold" :title="editableNote.aiProofread.corrections.length + ' suggestions'">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                  {{ editableNote.aiProofread.corrections.length }} suggestion{{ editableNote.aiProofread.corrections.length !== 1 ? 's' : '' }}
                </span>
                <button class="btn btn-sm btn-success" @click="applyAllCorrections" title="Apply all proofreading suggestions"><i class="bi bi-check-all me-1"></i>Apply All</button>
              </div>
            </div>
            <div v-if="editableNote.aiSummary" class="ai-summary-indicator d-flex align-items-center gap-2 text-muted small">
              <i class="bi bi-robot"></i><span>AI Summary attached</span>
              <button class="btn btn-sm btn-outline-primary btn-sm-custom" @click="viewSummary"><i class="bi bi-eye"></i> View</button>
              <button class="btn btn-sm btn-outline-danger btn-sm-custom" @click="removeSummary"><i class="bi bi-trash"></i> Remove</button>
            </div>
          </div>
          <button class="btn btn-sm btn-outline-secondary" @click="$emit('close')"><i class="bi bi-x-lg"></i></button>
        </div>

    <!-- Proofreader suggestions are displayed inline as highlights with hover tooltips.
       The large suggestions panel was removed to avoid taking header space. -->

        <div class="editor-content-wrapper d-flex flex-column flex-fill overflow-hidden">
          <editor-toolbar @content-change="handleInput" @undo="undo" @redo="redo" :can-undo="undoStack.length > 0" :can-redo="redoStack.length > 0"></editor-toolbar>
          <div ref="editor" class="note-content-editable flex-fill p-3 overflow-auto" contenteditable="true" @input="handleInput" @paste="handlePaste" placeholder="Start writing..."></div>
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
  methods: {
  resetEditorState() {
    this.isContentLoaded = false;
    this.editableNote = JSON.parse(JSON.stringify(this.note));
    this.undoStack = [];
    this.redoStack = [];
    this.wordCount = 0;
    this.isExecutingCommand = false;

    // Load any stored AI proofread info into the editor state
    if (this.note && this.note.aiProofread) {
      // keep as part of editableNote so it will save with the note
      this.editableNote.aiProofread = JSON.parse(JSON.stringify(this.note.aiProofread));
    } else {
      this.editableNote.aiProofread = null;
    }

    this.$nextTick(() => {
      if (this.$refs.editor) {
        this.$refs.editor.innerHTML = this.editableNote.content || '';
        this.isContentLoaded = true;
        this.updateWordCount();
        // Apply inline highlights for any stored proofread corrections
        this.$nextTick(() => this.markProofreadCorrections());
        this.pushToUndoStack();
      }
    });
  },

    handleInput() {
      if (!this.isContentLoaded || !this.$refs.editor) return;
      const currentContent = this.$refs.editor.innerHTML;
      if (this.editableNote.content !== currentContent) {
        this.editableNote.content = currentContent;
        if (!this.isUndoRedo) {
          this.pushToUndoStack();
        }
        this.isUndoRedo = false;
        this.triggerSave();
        this.updateWordCount();
        this.debouncedProofread();
        this.debouncedAutoSummary();
      }
    },
    
    updateWordCount() {
        if (this.$refs.editor) {
            const text = this.$refs.editor.innerText || '';
            this.wordCount = text.trim().split(/\s+/).filter(Boolean).length;
        }
    },

    pushToUndoStack() {
        this.undoStack.push(this.editableNote.content);
        if (this.undoStack.length > 50) this.undoStack.shift();
        this.redoStack = [];
    },

    async handleVoiceCommand(event) {
        if (this.isExecutingCommand) return;
        this.isExecutingCommand = true;
        
        const { command } = event.detail;
        const editor = this.$refs.editor;
        if (!command || !editor) {
            this.isExecutingCommand = false;
            return;
        }

        editor.focus();
        
        try {
            if (command.type === 'dom') {
                this.executeDOMCommand(command);
            } else if (command.type === 'editorMethod' && this[command.method]) {
                await this[command.method](command.value);
            }
        } catch(e) {
            console.error("Failed to execute voice command:", e);
        } finally {
            this.$nextTick(() => this.handleInput());
            this.isExecutingCommand = false;
        }
    },
    
    executeDOMCommand(command) {
        const editor = this.$refs.editor;
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (command.keywords.includes('next line')) {
            const br = document.createElement('br');
            const placeholderDiv = document.createElement('div');
            placeholderDiv.appendChild(br);
            range.deleteContents();
            range.insertNode(placeholderDiv);
            range.setStartAfter(placeholderDiv);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        } else {
            document.execCommand(command.action, false, null);
        }
    },
    
    manualProofread() { this.runProofreader(true); },
    async runProofreader(isManual = false) {
        if (this.isProofreading || !this.$refs.editor) return;
        const content = this.$refs.editor.innerText;
        const charCount = content.replace(/\s/g, '').length;

        if (!isManual && charCount < 50) return;
        if (isManual && charCount < 3) {
            alertService.info("Not enough text", "Please write a little more before proofreading.");
            return;
        }

    this.isProofreading = true;
    // Clear current inline highlights while processing
    this.clearProofreadHighlights();
        try {
            const result = await aiHandler.proofreadTextWithDetails(this.$refs.editor.innerHTML);
      // Store results on the note so each note has its own proofread info
      this.editableNote.aiProofread = {
        corrected: result.corrected || null,
        corrections: Array.isArray(result.corrections) ? result.corrections.slice() : [],
        hasCorrections: !!result.hasCorrections,
        updatedAt: new Date().toISOString()
      };

      // Add inline highlights for quick hover-access to suggestions
      if (this.editableNote.aiProofread.corrections && this.editableNote.aiProofread.corrections.length > 0) {
        this.markProofreadCorrections();
      } else if (isManual) {
        toastService.success("Looks Good!", "No proofreading suggestions found.");
      }

      // Persist the proofread metadata with the note (do not auto-apply corrections)
      this.triggerSave();
        } catch (e) {
            console.error("Proofreading failed:", e);
            if (isManual) alertService.error("AI Error", "Could not proofread the note.");
        } finally {
            this.isProofreading = false;
        }
    },

    applyCorrection(index) {
        const pr = this.editableNote.aiProofread;
        if (!pr || !pr.corrections || !pr.corrections[index]) return;
        const suggestion = pr.corrections[index];
        const editor = this.$refs.editor;

        // Use DOM TreeWalker to find and replace text safely
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        let applied = false;
        while ((node = walker.nextNode()) && !applied) {
            const text = node.textContent;
            const origIndex = text.indexOf(suggestion.original);
            if (origIndex !== -1) {
                // Found it; replace using DOM Range
                const range = document.createRange();
                range.setStart(node, origIndex);
                range.setEnd(node, origIndex + suggestion.original.length);
                range.deleteContents();
                const newText = document.createTextNode(suggestion.replacement);
                range.insertNode(newText);
                applied = true;
            }
        }

        // Remove the applied suggestion and update stored proofread info
        pr.corrections.splice(index, 1);
        if (pr.corrections.length === 0) {
            this.editableNote.aiProofread = null;
        }

        // Refresh highlights and save
        this.clearProofreadHighlights();
        if (this.editableNote.aiProofread && this.editableNote.aiProofread.corrections.length > 0) {
            this.markProofreadCorrections();
        }
        this.handleInput();
        this.triggerSave();
    },

    applyAllCorrections() {
        const pr = this.editableNote.aiProofread;
        const editor = this.$refs.editor;
        if (!pr || !pr.corrections || pr.corrections.length === 0) return;

        // Apply all corrections using DOM TreeWalker for safety
        pr.corrections.forEach((suggestion) => {
            const walker = document.createTreeWalker(
                editor,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );

            let node;
            while ((node = walker.nextNode())) {
                const text = node.textContent;
                const origIndex = text.indexOf(suggestion.original);
                if (origIndex !== -1) {
                    const range = document.createRange();
                    range.setStart(node, origIndex);
                    range.setEnd(node, origIndex + suggestion.original.length);
                    range.deleteContents();
                    const newText = document.createTextNode(suggestion.replacement);
                    range.insertNode(newText);
                    break; // Apply only once per suggestion
                }
            }
        });

        // Clear stored proofread metadata after applying all
        this.editableNote.aiProofread = null;
        this.clearProofreadHighlights();
        this.handleInput();
        this.triggerSave();
    },

    // HTML-aware replacement: Uses DOM TreeWalker to find text nodes and Range API for safe substitution.
    // This avoids breaking HTML structure by working with actual text nodes, not regex on innerHTML.
    markProofreadCorrections() {
        if (!this.$refs.editor) return;
        const pr = this.editableNote.aiProofread;
        if (!pr || !pr.corrections || pr.corrections.length === 0) return;

        // Clear any existing highlights first
        this.clearProofreadHighlights();

        const editor = this.$refs.editor;
        const walker = document.createTreeWalker(
            editor,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const nodesToReplace = [];
        let node;
        while ((node = walker.nextNode())) {
            nodesToReplace.push(node);
        }

        // Process each correction against all text nodes
        pr.corrections.forEach((sugg, idx) => {
            const original = String(sugg.original || '').trim();
            if (!original) return;

            // Search all text nodes for the original text
            nodesToReplace.forEach((textNode) => {
                const text = textNode.textContent;
                const index = text.indexOf(original);
                if (index !== -1) {
                    // Found the text in this node; replace with a span
                    const range = document.createRange();
                    range.setStart(textNode, index);
                    range.setEnd(textNode, index + original.length);

                    const replacement = String(sugg.replacement || '').trim();
                    const span = document.createElement('span');
                    span.className = 'proofreader-error';
                    span.setAttribute('data-pr-idx', idx);
                    span.setAttribute('title', `Replace with: ${replacement || 'No suggestion'}`);
                    span.textContent = original;

                    // Add inline action button that will be shown on hover
                    span.setAttribute('data-pr-original', original);
                    span.setAttribute('data-pr-replacement', replacement);

                    range.insertNode(span);
                    
                    // Update the text node to remove the replaced text since insertNode doesn't replace
                    const after = text.substring(index + original.length);
                    const before = text.substring(0, index);
                    if (before) {
                        textNode.textContent = before;
                        span.parentNode.insertBefore(textNode, span);
                    }
                    if (after) {
                        const afterNode = document.createTextNode(after);
                        span.parentNode.insertBefore(afterNode, span.nextSibling);
                    }
                }
            });
        });

        // Attach event listeners for hover actions
        this.$nextTick(() => {
            this.attachProofreadHoverListeners();
        });
    },

    attachProofreadHoverListeners() {
        const editor = this.$refs.editor;
        const errorSpans = editor.querySelectorAll('.proofreader-error');
        errorSpans.forEach((span) => {
            span.addEventListener('mouseenter', (e) => this.showProofreadPopover(e));
            span.addEventListener('mouseleave', (e) => this.hideProofreadPopover(e));
        });
    },

    showProofreadPopover(event) {
        const span = event.target;
        const idx = parseInt(span.getAttribute('data-pr-idx'), 10);
        const original = span.getAttribute('data-pr-original');
        const replacement = span.getAttribute('data-pr-replacement');

        // Create a small popover with Apply/Ignore buttons
        let popover = span._prPopover;
        if (!popover) {
            popover = document.createElement('div');
            popover.className = 'proofreader-popover';
            popover.innerHTML = `
                <div class="proofreader-popover-content">
                    <small class="proofreader-popover-label">Replace with:</small>
                    <strong>${replacement || 'No suggestion'}</strong>
                    <div class="proofreader-popover-actions">
                        <button class="btn btn-xs btn-success" title="Apply this suggestion">
                            <i class="bi bi-check"></i>
                        </button>
                        <button class="btn btn-xs btn-secondary" title="Ignore this suggestion">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                </div>
            `;
            span._prPopover = popover;
            span.parentNode.insertBefore(popover, span.nextSibling);

            // Attach action listeners
            const applyBtn = popover.querySelector('.btn-success');
            const ignoreBtn = popover.querySelector('.btn-secondary');

            applyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.applyCorrection(idx);
            });

            ignoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.ignoreCorrection(idx);
            });
        }

        popover.style.display = 'block';
    },

    hideProofreadPopover(event) {
        const span = event.target;
        const popover = span._prPopover;
        if (popover) {
            popover.style.display = 'none';
        }
    },

    ignoreCorrection(index) {
        const pr = this.editableNote.aiProofread;
        if (!pr || !pr.corrections || !pr.corrections[index]) return;

        // Remove this correction from the list
        pr.corrections.splice(index, 1);

        // Rebuild highlights without this one
        if (pr.corrections.length === 0) {
            this.editableNote.aiProofread = null;
        }

        this.clearProofreadHighlights();
        if (this.editableNote.aiProofread) {
            this.markProofreadCorrections();
        }

        this.triggerSave();
    },

    clearProofreadHighlights() {
        if (!this.$refs.editor) return;
        const editor = this.$refs.editor;
        const errorSpans = editor.querySelectorAll('.proofreader-error');
        errorSpans.forEach((span) => {
            // Remove popover if it exists
            if (span._prPopover) {
                span._prPopover.remove();
                delete span._prPopover;
            }
            // Unwrap the span but keep the text
            const parent = span.parentNode;
            while (span.firstChild) {
                parent.insertBefore(span.firstChild, span);
            }
            parent.removeChild(span);
        });
    },

    manualSummarize() { this.runAutoSummary(true); },
    async runAutoSummary(isManual = false) {
        if (this.isSummarizing || this.editableNote.aiSummary || !this.$refs.editor) return;
        
        const content = this.$refs.editor.innerText;
        const charCount = content.replace(/\s/g, '').length;

        if (!isManual && charCount < 250) return;
        if (isManual && charCount < 50) {
            alertService.info("Not enough text", "Please write more to generate a meaningful summary.");
            return;
        }

        this.isSummarizing = true;
        try {
            const summary = await aiHandler.summarizeText(this.$refs.editor.innerHTML);
            if (isManual) {
                const shouldSave = await alertService.confirm('AI Summary', `Would you like to attach this summary to the note?<br><br><em>${StringUtils.truncate(summary, 150)}</em>`, { confirmText: 'Attach Summary' });
                if (shouldSave) {
                    this.editableNote.aiSummary = summary;
                    this.triggerSave();
                }
            } else {
                this.editableNote.aiSummary = summary;
                this.triggerSave();
            }
        } catch (e) {
            console.error("Summarization failed:", e);
            if (isManual) alertService.error("AI Error", "Could not summarize the note.");
        } finally {
            this.isSummarizing = false;
        }
    },

    viewSummary() { if (this.editableNote.aiSummary) alertService.infoMarkdown('AI Summary', this.editableNote.aiSummary); },
    removeSummary() { this.editableNote.aiSummary = null; this.triggerSave(); },

    triggerSave() { if (this.isContentLoaded) this.debouncedSave(); },
    undo() {
      if (this.undoStack.length > 1) {
        this.redoStack.push(this.undoStack.pop());
        const previousContent = this.undoStack[this.undoStack.length - 1];
        this.isUndoRedo = true;
        this.editableNote.content = previousContent;
        this.$refs.editor.innerHTML = previousContent;
        this.updateWordCount();
      }
    },
    redo() {
      if (this.redoStack.length > 0) {
        const nextContent = this.redoStack.pop();
        this.undoStack.push(nextContent);
        this.isUndoRedo = true;
        this.editableNote.content = nextContent;
        this.$refs.editor.innerHTML = nextContent;
        this.updateWordCount();
      }
    },
    handlePaste(event) {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    },
    debounce(func, delay) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    },
    formatLastUpdated(dateString) { return DateUtils.formatWithTime(dateString); },
    setCursorToEnd() {
      const editor = this.$refs.editor;
      if (editor) {
        editor.focus();
        try {
            const range = document.createRange();
            const selection = window.getSelection();
            range.selectNodeContents(editor);
            range.collapse(false); // false to collapse to the end
            selection.removeAllRanges();
            selection.addRange(range);
        } catch(e) {
            console.error("Failed to set cursor to end:", e);
        }
      }
    },
  }
};