import EditorToolbar from "./EditorToolbar.js";

export default {
  components: {
    EditorToolbar,
  },
  props: ["note", "saveStatus"],
  emits: ["save", "close"],
  data() {
    return {
      // Initialize from prop, creating a deep copy to edit locally
      editableNote: JSON.parse(JSON.stringify(this.note)),
      debouncedSave: null,
      // Undo/Redo system
      undoStack: [],
      redoStack: [],
      isUndoRedo: false,
    };
  },
  template: `
      <aside class="note-editor d-flex flex-column border-start">
        <div class="editor-header p-3 border-bottom d-flex align-items-center justify-content-between gap-2">
          <input type="text" class="form-control border-0 px-0 fs-4 flex-grow-1" v-model="editableNote.summary" placeholder="Note Title">
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
              @keydown="handleKeyDown"
              v-html="editableNote.content"
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
    // FIX: This watcher is improved to prevent cursor jumping during auto-save.
    // It only updates the editor's content if the note ID changes (i.e., a different note is selected).
    note(newNote) {
      if (newNote.id !== this.editableNote.id) {
          this.editableNote = { ...newNote };
          // Reset undo/redo stacks when loading a new note
          this.undoStack = [];
          this.redoStack = [];
          this.$nextTick(() => {
            if (this.$refs.editor) {
                this.$refs.editor.innerHTML = newNote.content || '';
                this.ensureEditorDirection();
            }
          });
      }
    },
    editableNote: {
      handler(newValue, oldValue) {
        if (oldValue && (newValue.summary !== oldValue.summary || newValue.content !== oldValue.content || newValue.reminderAt !== oldValue.reminderAt)) {
            console.log('NoteEditor: Content changed, triggering save');
            this.debouncedSave();
        }
      },
      deep: true,
    },
  },
  created() {
    this.debouncedSave = this.debounce(() => {
      this.$emit('save', this.editableNote);
    }, 1500);
  },
  mounted() {
    // Ensure direction is correct when component mounts
    this.$nextTick(() => {
      this.ensureEditorDirection();
    });
  },
  methods: {
    updateContentFromDOM() {
      if (this.$refs.editor) {
        // Ensure LTR direction is maintained
        this.ensureEditorDirection();

        // Force direction on all child elements
        const elements = this.$refs.editor.querySelectorAll('*');
        elements.forEach(el => {
          el.style.direction = 'ltr';
          el.style.textAlign = 'left';
        });

        const currentContent = this.$refs.editor.innerHTML;

        // Don't push to undo stack if this is an undo/redo operation
        if (!this.isUndoRedo) {
          // Push current state to undo stack before making changes
          if (this.undoStack.length >= 50) { // Limit stack size
            this.undoStack.shift();
          }
          this.undoStack.push(this.editableNote.content);
          this.redoStack = []; // Clear redo stack when new changes are made
        }

        this.editableNote.content = currentContent;
        this.isUndoRedo = false;
      }
    },
    undo() {
      if (this.undoStack.length > 0) {
        // Push current state to redo stack
        this.redoStack.push(this.editableNote.content);

        // Get the previous state from undo stack
        const previousContent = this.undoStack.pop();

        this.isUndoRedo = true;
        this.editableNote.content = previousContent;

        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = previousContent;
            this.ensureEditorDirection();
            // Set cursor to end of content
            this.setCursorToEnd();
          }
        });
      }
    },
    redo() {
      if (this.redoStack.length > 0) {
        // Push current state to undo stack
        this.undoStack.push(this.editableNote.content);

        // Get the next state from redo stack
        const nextContent = this.redoStack.pop();

        this.isUndoRedo = true;
        this.editableNote.content = nextContent;

        this.$nextTick(() => {
          if (this.$refs.editor) {
            this.$refs.editor.innerHTML = nextContent;
            this.ensureEditorDirection();
            // Set cursor to end of content
            this.setCursorToEnd();
          }
        });
      }
    },
    setCursorToEnd() {
      const editor = this.$refs.editor;
      if (editor) {
        // Ensure LTR direction before setting cursor
        editor.style.direction = 'ltr';
        editor.style.textAlign = 'left';
        editor.focus();
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(editor);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
      }
    },
    ensureEditorDirection() {
      const editor = this.$refs.editor;
      if (editor) {
        editor.style.direction = 'ltr';
        editor.style.textAlign = 'left';
        editor.dir = 'ltr';
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
        const taskItem = event.target.closest('.task-item');
        if (taskItem) {
            const isChecked = taskItem.dataset.checked === 'true';
            taskItem.dataset.checked = !isChecked;
            // Manually update the undo stack for task changes
            if (this.undoStack.length >= 50) {
                this.undoStack.shift();
            }
            this.undoStack.push(this.editableNote.content);
            this.redoStack = [];
            this.editableNote.content = this.$refs.editor.innerHTML;
        }
    },
    handlePaste(event) {
        // Ensure pasted content maintains LTR direction
        event.preventDefault();
        const text = event.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);

        // Force LTR direction on the editor
        this.$refs.editor.style.direction = 'ltr';
        this.$refs.editor.style.textAlign = 'left';

        this.$nextTick(() => {
            this.updateContentFromDOM();
        });
    },
    handleKeyDown(event) {
        // Ensure LTR direction is maintained during typing
        this.$nextTick(() => {
            this.ensureEditorDirection();

            // Force direction on all child elements after key press
            if (this.$refs.editor) {
                const elements = this.$refs.editor.querySelectorAll('*');
                elements.forEach(el => {
                    el.style.direction = 'ltr';
                    el.style.textAlign = 'left';
                });
            }
        });
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