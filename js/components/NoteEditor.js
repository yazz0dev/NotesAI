import EditorToolbar from "./EditorToolbar.js";

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
      // KEY FIX: Flag to prevent auto-save on initial load of a note
      isContentLoaded: false,
    };
  },
  template: `
      <aside class="note-editor d-flex flex-column border-start">
        <div class="editor-header p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <!-- KEY FIX: Added @input listener to trigger save on title change -->
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
    note(newNote) {
      if (newNote && newNote.id !== this.editableNote.id) {
          // KEY FIX: Reset the content loaded flag before loading new content
          this.isContentLoaded = false;
          this.editableNote = JSON.parse(JSON.stringify(newNote));
          this.undoStack = [];
          this.redoStack = [];

          this.$nextTick(() => {
            if (this.$refs.editor) {
                this.$refs.editor.innerHTML = this.editableNote.content || '';
                // KEY FIX: Set the flag to true only AFTER the new content is loaded
                this.isContentLoaded = true;
            }
          });
      }
    },
  },
  created() {
    this.debouncedSave = this.debounce(() => {
      console.log('Auto-saving note...', this.editableNote);
      this.$emit('save', this.editableNote);
    }, 1500);
  },
  mounted() {
    if (this.$refs.editor) {
        this.$refs.editor.innerHTML = this.editableNote.content || '';
        // KEY FIX: Set flag to true after initial mount
        this.isContentLoaded = true;
    }
  },
  methods: {
    // KEY FIX: This new method centralizes the call to the debounced function.
    triggerSave() {
        // Only trigger save if the initial content has been loaded into the editor.
        // This prevents a save operation right when a note is opened.
        if (this.isContentLoaded) {
            this.debouncedSave();
        }
    },
    updateContentFromDOM() {
      if (this.$refs.editor) {
        const currentContent = this.$refs.editor.innerHTML;

        // Update the data model without triggering a re-render
        this.editableNote.content = currentContent;

        if (!this.isUndoRedo) {
          // Manage undo stack
          if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] !== currentContent) {
             this.undoStack.push(currentContent);
          } else if (this.undoStack.length === 0) {
             this.undoStack.push(currentContent);
          }
          if (this.undoStack.length > 50) this.undoStack.shift();
          this.redoStack = [];
        }
        
        this.isUndoRedo = false;
        
        // KEY FIX: Call the triggerSave method on every input to handle auto-saving.
        this.triggerSave();
      }
    },
    undo() {
      if (this.undoStack.length > 1) { // Need more than one state to undo
        this.redoStack.push(this.undoStack.pop());
        const previousContent = this.undoStack[this.undoStack.length - 1];
        
        this.isUndoRedo = true;
        this.editableNote.content = previousContent;

        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = previousContent;
            this.setCursorToEnd();
            this.triggerSave(); // Save after undo
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
            this.triggerSave(); // Save after redo
          }
        });
      }
    },
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
    debounce(func, delay) {
      let timeout;
      return function(...args) {
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
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    },
  },
};