import EditorToolbar from "./EditorToolbar.js";
import { alertService } from "../services/alert-service.js";
import aiService from "../services/ai-service.js";

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
    };
  },
  template: `
      <aside class="note-editor d-flex flex-column border-start">
        <div class="editor-header p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <input type="text" class="form-control border-0 px-0 fs-4 flex-grow-1" v-model="editableNote.summary" @input="triggerSave" placeholder="Note Title">
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
    window.addEventListener('ai-execute-command', this.executeVoiceCommand);
  },
  mounted() {
    if (this.$refs.editor) {
      this.$refs.editor.innerHTML = this.editableNote.content || '';
      this.isContentLoaded = true;
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
        alertService.info('AI Summary', summary, { confirmText: 'Awesome!', cancelText: false });
      } catch (e) {
        alertService.error('AI Error', e.message);
      }
    },
    async proofreadNote() {
      try {
        const originalContent = this.editableNote.content;
        const correctedContent = await aiService.proofreadText(originalContent);
        if (correctedContent.trim() !== originalContent.replace(/<[^>]*>/g, " ").trim()) {
          this.undoStack.push(originalContent); // Save state before changing
          this.editableNote.content = `<div>${correctedContent.replace(/\n/g, '</div><div>')}</div>`;
          this.$refs.editor.innerHTML = this.editableNote.content;
          alertService.success('Proofread Complete', 'The note has been updated with corrections.');
        } else {
          alertService.info('No Changes', 'The AI found no corrections to make.');
        }
      } catch (e) {
        alertService.error('AI Error', e.message);
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
            this.undoStack.push(currentContent);
            if (this.undoStack.length > 50) this.undoStack.shift();
            this.redoStack = [];
          }
          this.isUndoRedo = false;
          this.triggerSave();
        }
      }
    },
    undo() {
      if (this.undoStack.length > 1) {
        this.redoStack.push(this.undoStack.pop());
        const previousContent = this.undoStack[this.undoStack.length - 1];
        this.isUndoRedo = true;
        this.editableNote.content = previousContent;
        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = previousContent;
            this.setCursorToEnd();
            this.triggerSave();
          }
        });
      }
    },
    redo() {
      if (this.redoStack.length > 0) {
        const nextContent = this.redoStack.pop();
        this.undoStack.push(nextContent);
        this.isUndoRedo = true;
        this.editableNote.content = nextContent;
        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = nextContent;
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