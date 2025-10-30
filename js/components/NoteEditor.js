// js/components/NoteEditor.js

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
      // Popover state management
      activePopover: null,
      hidePopoverTimeout: null,
    };
  },
  computed: {
    isNoteLongEnoughToSummarize() {
      if (!this.editableNote || !this.$refs.editor) return false;
      const content = this.$refs.editor.innerText || '';
      const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
      return wordCount >= 50; // Enable button after 50 words
    }
  },
  watch: {
    'note.id'(newId, oldId) {
      if (newId !== oldId) {
        this.resetEditorState();
      }
    },
    'note.content'(newContent) {
        if (!this.$refs.editor || !this.isContentLoaded) return;
        if (newContent !== this.$refs.editor.innerHTML) {
            this.editableNote.content = newContent;
            this.$refs.editor.innerHTML = newContent;
            this.setCursorToEnd();
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
    this.initializeEditorContent();
  },
  beforeUnmount() {
    window.removeEventListener('editor-command', this.handleVoiceCommand);
    this.clearProofreadPopover(); // Clean up popover on component destruction
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
              <button class="btn btn-sm btn-outline-success" @click="manualSummarize" :disabled="isSummarizing || !isNoteLongEnoughToSummarize" title="Generate AI summary (minimum 50 words, auto-generates at 100 words)">
                <i class="bi bi-file-text"></i> {{ isSummarizing ? 'Summarizing...' : 'Summarize' }}
              </button>
            </div>
            <div class="d-flex align-items-center gap-3 text-muted small mb-2">
              <span><i class="bi bi-fonts"></i> {{ wordCount }} words</span>
              <div v-if="editableNote.aiProofread && editableNote.aiProofread.corrections.length > 0" class="d-flex align-items-center gap-2">
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

        <div class="editor-content-wrapper d-flex flex-column flex-fill overflow-hidden">
          <editor-toolbar @content-change="handleInput" @undo="undo" @redo="redo" :can-undo="undoStack.length > 0" :can-redo="redoStack.length > 0"></editor-toolbar>
          <div ref="editor" class="note-content-editable flex-fill p-3 overflow-auto" contenteditable="true" @input="handleInput" @paste="handlePaste" @click="handleEditorClick" placeholder="Start writing..."></div>
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
    initializeEditorContent() {
      if (this.$refs.editor && this.editableNote) {
          this.$refs.editor.innerHTML = this.editableNote.content || '';
          this.isContentLoaded = true;
          this.updateWordCount();
          this.$nextTick(() => this.markProofreadCorrections());
      }
    },
    resetEditorState() {
      this.isContentLoaded = false;
      this.editableNote = JSON.parse(JSON.stringify(this.note));
      this.undoStack = [];
      this.redoStack = [];
      this.wordCount = 0;
      this.isExecutingCommand = false;
      this.editableNote.aiProofread = this.note.aiProofread ? JSON.parse(JSON.stringify(this.note.aiProofread)) : null;

      this.$nextTick(() => {
        this.initializeEditorContent();
        this.pushToUndoStack();
      });
    },
    handleInput() {
      if (!this.isContentLoaded || !this.$refs.editor) return;
      const currentContent = this.$refs.editor.innerHTML;
      if (this.editableNote.content !== currentContent) {
        this.editableNote.content = currentContent;
        if (!this.isUndoRedo) this.pushToUndoStack();
        this.isUndoRedo = false;
        this.triggerSave();
        this.updateWordCount();
        // Proofreading disabled - only trigger on manual click
        // this.debouncedProofread();
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
    manualProofread() { this.runProofreader(true); },
    async runProofreader(isManual = false) {
      if (this.isProofreading || !this.$refs.editor) return;
      
      // *** FIX 1: Send innerText, not innerHTML, to the proofreader API ***
      const content = this.$refs.editor.innerText;
      
      if (!isManual && content.trim().length < 50) return;
      if (isManual && content.trim().length < 3) {
          toastService.info("Not enough text", "Please write a little more before proofreading.");
          return;
      }

      this.isProofreading = true;
      this.clearProofreadHighlights();
      try {
          const result = await aiHandler.proofreadTextWithDetails(content);
          
          // Debug: Log the result to understand what's being returned
          console.log('[NoteEditor] Proofreading result:', result);
          
          // Transform API response format to internal format
          // API returns: { startIndex, endIndex, correction }
          // We need: { original, replacement }
          const normalizedCorrections = (result.corrections || [])
            .map(correction => {
              if (correction.startIndex !== undefined && correction.endIndex !== undefined) {
                // Extract original text from content using indices
                const original = content.substring(correction.startIndex, correction.endIndex);
                return {
                  original: original,
                  replacement: correction.correction || '',
                  startIndex: correction.startIndex,
                  endIndex: correction.endIndex
                };
              }
              // Already in correct format
              return correction;
            })
            .filter(correction => {
              // Skip empty ranges (insertions, not replacements)
              if (correction.startIndex === correction.endIndex) {
                return false;
              }
              
              // Filter out whitespace-only and empty corrections
              const hasValidReplacement = correction.replacement && correction.replacement.trim().length > 0;
              const isNotWhitespaceChange = !(correction.original && correction.original.trim() === '' && 
                                              (!correction.replacement || correction.replacement.trim() === ''));
              return hasValidReplacement && isNotWhitespaceChange;
            });
          
          this.editableNote.aiProofread = {
            corrections: normalizedCorrections,
            hasCorrections: normalizedCorrections.length > 0,
          };

          if (this.editableNote.aiProofread.hasCorrections) {
            console.log('[NoteEditor] Marking corrections, count:', this.editableNote.aiProofread.corrections.length);
            this.markProofreadCorrections();
          } else if (isManual) {
            toastService.success("Looks Good!", "No proofreading suggestions found.");
          }
          this.triggerSave(); // Save the proofread metadata
      } catch (e) {
          console.error("Proofreading failed:", e);
          if (isManual) alertService.error("AI Error", "Could not proofread the note.");
      } finally {
          this.isProofreading = false;
      }
    },

    // *** FIX 2: Rewritten logic for highlighting and popovers for reliability ***
    markProofreadCorrections() {
      if (!this.$refs.editor || !this.editableNote.aiProofread?.hasCorrections) return;

      const editor = this.$refs.editor;
      const corrections = this.editableNote.aiProofread.corrections;
      
      // Ensure corrections array has valid data
      if (!Array.isArray(corrections) || corrections.length === 0) return;

      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while(walker.nextNode()) textNodes.push(walker.currentNode);

      // Iterate backwards to avoid issues with range modification
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const node = textNodes[i];
        let text = node.textContent;
        
        corrections.forEach((correction, index) => {
          // Ensure correction has required properties
          if (!correction.original || typeof correction.original !== 'string') return;
          
          const original = correction.original;
          let matchIndex = text.lastIndexOf(original);
          while (matchIndex !== -1) {
            const range = document.createRange();
            range.setStart(node, matchIndex);
            range.setEnd(node, matchIndex + original.length);

            const span = document.createElement('span');
            span.className = 'proofreader-error';
            span.dataset.prIdx = index;
            // Use arrow functions to preserve 'this' context
            span.addEventListener('mouseenter', (e) => this.showProofreadPopover(e));
            span.addEventListener('mouseleave', (e) => this.hideProofreadPopover(e));
            
            range.surroundContents(span);

            // Rescan the remaining part of the text node
            text = text.substring(0, matchIndex);
            matchIndex = text.lastIndexOf(original);
          }
        });
      }
    },
    clearProofreadHighlights() {
      if (!this.$refs.editor) return;
      const highlights = this.$refs.editor.querySelectorAll('.proofreader-error');
      highlights.forEach(span => {
        const parent = span.parentNode;
        parent.replaceChild(document.createTextNode(span.textContent), span);
        parent.normalize(); // Merges adjacent text nodes
      });
      this.clearProofreadPopover();
    },
    showProofreadPopover(event) {
        clearTimeout(this.hidePopoverTimeout);
        const span = event.target;
        const index = parseInt(span.dataset.prIdx, 10);
        
        // Validate correction data
        if (!this.editableNote.aiProofread?.corrections) {
            console.warn('[NoteEditor] No corrections found');
            return;
        }
        const correction = this.editableNote.aiProofread.corrections[index];
        if (!correction || !correction.original || !correction.replacement) {
            console.warn(`[NoteEditor] Invalid correction data at index ${index}:`, correction);
            return;
        }
        
        // Additional validation: skip if replacement is just whitespace
        if (correction.replacement.trim().length === 0) {
            console.warn(`[NoteEditor] Correction has empty/whitespace replacement at index ${index}`);
            return;
        }
        
        this.clearProofreadPopover(); // Clear any existing popover
        
        const popover = document.createElement('div');
        popover.className = 'proofreader-popover';
        popover.innerHTML = `
            <div class="proofreader-popover-content">
                <small class="proofreader-popover-label">Replace with:</small>
                <strong>${correction.replacement}</strong>
                <div class="proofreader-popover-actions">
                    <button class="btn btn-xs btn-success" title="Apply"><i class="bi bi-check"></i></button>
                    <button class="btn btn-xs btn-secondary" title="Ignore"><i class="bi bi-x"></i></button>
                </div>
            </div>
        `;

        document.body.appendChild(popover);
        this.activePopover = popover;

        const rect = span.getBoundingClientRect();
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + 4}px`;
        popover.style.display = 'block';

        const successBtn = popover.querySelector('.btn-success');
        const rejectBtn = popover.querySelector('.btn-secondary');
        
        if (successBtn) {
            successBtn.addEventListener('click', () => this.applyCorrection(span, index));
        }
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => this.ignoreCorrection(span, index));
        }
        
        // Keep popover open if mouse moves onto it
        popover.addEventListener('mouseenter', () => clearTimeout(this.hidePopoverTimeout));
        popover.addEventListener('mouseleave', () => this.hideProofreadPopover());
    },
    hideProofreadPopover() {
        this.hidePopoverTimeout = setTimeout(() => {
            this.clearProofreadPopover();
        }, 200);
    },
    clearProofreadPopover() {
        if (this.activePopover) {
            this.activePopover.remove();
            this.activePopover = null;
        }
    },
    applyCorrection(span, index) {
        const correction = this.editableNote.aiProofread.corrections[index];
        span.replaceWith(document.createTextNode(correction.replacement));
        this.editableNote.aiProofread.corrections.splice(index, 1);
        if (this.editableNote.aiProofread.corrections.length === 0) {
            this.editableNote.aiProofread = null;
        }
        this.clearProofreadPopover();
        this.handleInput(); // Trigger save and update UI
    },
    ignoreCorrection(span, index) {
        span.replaceWith(document.createTextNode(span.textContent)); // Remove highlight
        this.editableNote.aiProofread.corrections.splice(index, 1);
        if (this.editableNote.aiProofread.corrections.length === 0) {
            this.editableNote.aiProofread = null;
        }
        this.clearProofreadPopover();
        this.handleInput();
    },
    applyAllCorrections() {
      const corrections = [...this.editableNote.aiProofread.corrections];
      corrections.reverse().forEach(correction => {
        const spans = this.$refs.editor.querySelectorAll(`.proofreader-error`);
        spans.forEach(span => {
          if (span.textContent === correction.original) {
            span.replaceWith(document.createTextNode(correction.replacement));
          }
        });
      });
      this.editableNote.aiProofread = null;
      this.handleInput();
    },

    // --- Other methods (unchanged or minor tweaks) ---
    manualSummarize() { this.runAutoSummary(true); },
    async runAutoSummary(isManual = false) {
        if (this.isSummarizing || this.editableNote.aiSummary || !this.$refs.editor) return;
        const content = this.$refs.editor.innerText;
        const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
        
        // Auto-summarize after 100 words
        if (!isManual && wordCount < 100) return;
        // Manual summarize requires at least 50 words
        if (isManual && wordCount < 50) {
            toastService.info("Not enough text", "Please write at least 50 words to generate a summary.");
            return;
        }
        this.isSummarizing = true;
        try {
            const summary = await aiHandler.summarizeText(content);
            this.editableNote.aiSummary = summary;
            this.triggerSave();
            if (isManual) this.viewSummary();
        } catch (e) {
            console.error("Summarization failed:", e);
            if (isManual) alertService.error("AI Error", "Could not summarize the note.");
        } finally {
            this.isSummarizing = false;
        }
    },
    viewSummary() { if (this.editableNote.aiSummary) alertService.infoMarkdown('AI Summary', this.editableNote.aiSummary, { confirmText: false, cancelText: false }); },
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
    handleEditorClick(event) {
      // Check if clicked on a task checkbox
      if (event.target.classList.contains('task-checkbox')) {
        const taskItem = event.target.closest('.task-item');
        if (taskItem) {
          const isChecked = taskItem.dataset.checked === 'true';
          // Simply toggle the checked state
          taskItem.dataset.checked = isChecked ? 'false' : 'true';
          this.handleInput(); // Trigger save
        }
      }
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
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
    
    // Voice command handlers with improved async execution
    async handleVoiceCommand(event) {
        if (this.isExecutingCommand) {
            console.warn('[NoteEditor] Command already executing, skipping');
            return;
        }
        
        const { command } = event.detail;
        console.log('[NoteEditor] Voice command received:', command);
        
        if (!command || !this.$refs.editor) {
            console.warn('[NoteEditor] Editor ref not available or no command');
            return;
        }
        
        this.isExecutingCommand = true;
        
        try {
            // Save current selection/cursor position
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }
            
            // Execute the command method if it exists
            if (command.method && typeof this[command.method] === 'function') {
                console.log('[NoteEditor] Executing command method:', command.method);
                
                // Execute command with proper context
                const result = await Promise.resolve(this[command.method](command.value));
                
                // Allow DOM to update
                await this.$nextTick();
                
                // Restore or set cursor position intelligently
                if (!savedRange) {
                    // No previous selection, set cursor to end
                    this.setCursorToEnd();
                } else {
                    // Restore previous selection if still valid
                    try {
                        selection.removeAllRanges();
                        selection.addRange(savedRange);
                    } catch (e) {
                        // If range is no longer valid, set to end
                        this.setCursorToEnd();
                    }
                }
                
                // Trigger input event to save changes
                this.handleInput();
                
                console.log('[NoteEditor] Voice command executed successfully:', command.method);
            } else {
                console.warn('[NoteEditor] Command method not found:', command.method);
            }
        } catch(e) {
            console.error("[NoteEditor] Voice command failed:", e);
            toastService.error('Command Failed', 'Could not execute voice command');
        } finally {
            // Always reset flag
            this.isExecutingCommand = false;
        }
    },
    insertParagraph() { 
      console.log('[NoteEditor] insertParagraph');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Create new paragraph element
      const newParagraph = document.createElement('div');
      newParagraph.innerHTML = '<br>';
      
      // Insert at cursor position
      range.deleteContents();
      range.insertNode(newParagraph);
      
      // Move cursor into new paragraph
      range.setStart(newParagraph, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    },
    insertLineBreak() { 
      console.log('[NoteEditor] insertLineBreak');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Insert line break at cursor
      const br = document.createElement('br');
      range.deleteContents();
      range.insertNode(br);
      
      // Move cursor after the break
      range.setStartAfter(br);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    },
    insertTask() { 
      console.log('[NoteEditor] insertTask');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      this.insertTaskHTML(); 
    },
    insertUnorderedList() { 
      console.log('[NoteEditor] insertUnorderedList');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      // Get current selection
      const selection = window.getSelection();
      const hasSelection = selection.rangeCount > 0 && !selection.isCollapsed;
      
      if (hasSelection) {
        // Apply list to selected text
        document.execCommand('insertUnorderedList');
      } else {
        // Create new list at cursor
        const range = selection.getRangeAt(0);
        const ul = document.createElement('ul');
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        ul.appendChild(li);
        
        range.deleteContents();
        range.insertNode(ul);
        
        // Set cursor inside list item
        range.setStart(li, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
    insertOrderedList() { 
      console.log('[NoteEditor] insertOrderedList');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      const hasSelection = selection.rangeCount > 0 && !selection.isCollapsed;
      
      if (hasSelection) {
        document.execCommand('insertOrderedList');
      } else {
        const range = selection.getRangeAt(0);
        const ol = document.createElement('ol');
        const li = document.createElement('li');
        li.innerHTML = '<br>';
        ol.appendChild(li);
        
        range.deleteContents();
        range.insertNode(ol);
        
        range.setStart(li, 0);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
    insertHorizontalRule() { 
      console.log('[NoteEditor] insertHorizontalRule');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      const range = selection.getRangeAt(0);
      
      // Create horizontal rule
      const hr = document.createElement('hr');
      const newLine = document.createElement('div');
      newLine.innerHTML = '<br>';
      
      range.deleteContents();
      range.insertNode(hr);
      
      // Insert new line after HR
      hr.parentNode.insertBefore(newLine, hr.nextSibling);
      
      // Move cursor to new line
      range.setStart(newLine, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    },
    toggleBold() { 
      console.log('[NoteEditor] toggleBold');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      document.execCommand('bold', false, null);
    },
    toggleUnderline() { 
      console.log('[NoteEditor] toggleUnderline');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      document.execCommand('underline', false, null);
    },
    toggleItalic() { 
      console.log('[NoteEditor] toggleItalic');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      document.execCommand('italic', false, null);
    },
    clearFormatting() { 
      console.log('[NoteEditor] clearFormatting');
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        // Clear formatting on selected text
        document.execCommand('removeFormat', false, null);
        document.execCommand('unlink', false, null);
      }
    },
    deleteLastUnit(unit) { 
      console.log('[NoteEditor] deleteLastUnit:', unit);
      const editor = this.$refs.editor;
      if (!editor) return;
      
      editor.focus();
      const selection = window.getSelection();
      
      if (!selection.rangeCount) {
        console.warn('[NoteEditor] No selection range for deletion');
        return;
      }
      
      const range = selection.getRangeAt(0);
      
      // If there's selected text, just delete it
      if (!selection.isCollapsed) {
        range.deleteContents();
        return;
      }
      
      // Collapse to start and extend backward
      range.collapse(true);
      
      try {
        if (unit === 'word') {
          // Delete last word
          selection.modify('extend', 'backward', 'word');
        } else if (unit === 'sentence') {
          // Delete to line start
          selection.modify('extend', 'backward', 'lineboundary');
        } else if (unit === 'paragraph') {
          // Delete to paragraph start
          selection.modify('extend', 'backward', 'paragraphboundary');
        }
        
        // Delete the selected content
        if (!selection.isCollapsed) {
          selection.getRangeAt(0).deleteContents();
        }
      } catch (e) {
        console.error('[NoteEditor] Delete unit failed:', e);
      }
      
      editor.focus();
    },
    async summarizeNote() { 
      console.log('[NoteEditor] summarizeNote - voice command');
      await this.manualSummarize();
      return Promise.resolve();
    },
    async proofreadNote() { 
      console.log('[NoteEditor] proofreadNote - voice command');
      await this.manualProofread();
      return Promise.resolve();
    },
    insertTaskHTML() {
      const editor = this.$refs.editor;
      if (!editor) return;
      
      const selection = window.getSelection();
      if (!selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      let taskContent = 'Task...';
      
      // Check if selection is inside a task item
      const commonAncestor = range.commonAncestorContainer;
      const existingTask = commonAncestor.nodeType === Node.TEXT_NODE 
        ? commonAncestor.parentElement?.closest('.task-item')
        : commonAncestor.closest?.('.task-item');
      
      // If already inside a task, convert it to normal text
      if (existingTask) {
        const taskText = existingTask.querySelector('.task-text');
        if (taskText) {
          const textContent = taskText.innerHTML;
          const newContent = document.createElement('div');
          newContent.innerHTML = textContent + '<br>';
          existingTask.replaceWith(newContent);
          
          // Set cursor in the new content
          const newRange = document.createRange();
          newRange.setStart(newContent, 0);
          newRange.collapse(true);
          selection.removeAllRanges();
          selection.addRange(newRange);
        }
        return;
      }
      
      // If text is selected, use it as task content
      if (!selection.isCollapsed) {
        const fragment = range.cloneContents();
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        taskContent = tempDiv.innerHTML || 'Task...';
        range.deleteContents();
      }
      
      // Create task element
      const taskItem = document.createElement('div');
      taskItem.className = 'task-item';
      taskItem.contentEditable = 'false';
      taskItem.dataset.checked = 'false';
      
      const checkbox = document.createElement('span');
      checkbox.className = 'task-checkbox';
      
      const taskText = document.createElement('span');
      taskText.className = 'task-text';
      taskText.contentEditable = 'true';
      taskText.innerHTML = taskContent;
      
      taskItem.appendChild(checkbox);
      taskItem.appendChild(taskText);
      
      // Insert task into editor
      range.insertNode(taskItem);
      
      // Create new line after task
      const newLine = document.createElement('div');
      newLine.innerHTML = '<br>';
      taskItem.parentNode.insertBefore(newLine, taskItem.nextSibling);
      
      // Set cursor inside task text
      const newRange = document.createRange();
      newRange.selectNodeContents(taskText);
      newRange.collapse(false);
      selection.removeAllRanges();
      selection.addRange(newRange);
      
      // Focus the task text
      taskText.focus();
    },
  }
};