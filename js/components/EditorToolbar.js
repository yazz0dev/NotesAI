export default {
    props: ["canUndo", "canRedo"],
    emits: ["undo", "redo", "content-change"],
    data() {
      return {
        activeFormats: {
          bold: false,
          italic: false,
          underline: false,
          insertUnorderedList: false,
          insertOrderedList: false
        }
      };
    },
    mounted() {
      // Listen for selection changes to update active formatting states
      document.addEventListener('selectionchange', this.updateFormattingState);
    },
    beforeUnmount() {
      document.removeEventListener('selectionchange', this.updateFormattingState);
    },
    template: `
      <div class="editor-toolbar d-flex flex-wrap align-items-center gap-2 p-2 border-bottom">
        <!-- NEW: Undo/Redo buttons -->
        <button @click="$emit('undo')" class="btn btn-sm btn-outline-secondary" :disabled="!canUndo" title="Undo (Ctrl+Z)"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button @click="$emit('redo')" class="btn btn-sm btn-outline-secondary" :disabled="!canRedo" title="Redo (Ctrl+Y)"><i class="bi bi-arrow-clockwise"></i></button>
        <div class="vr"></div>

        <button @click="executeCommand('bold')" class="btn btn-sm btn-outline-secondary" :class="{ 'active': activeFormats.bold }" title="Bold (Ctrl+B)"><i class="bi bi-type-bold"></i></button>
        <button @click="executeCommand('italic')" class="btn btn-sm btn-outline-secondary" :class="{ 'active': activeFormats.italic }" title="Italic (Ctrl+I)"><i class="bi bi-type-italic"></i></button>
        <button @click="executeCommand('underline')" class="btn btn-sm btn-outline-secondary" :class="{ 'active': activeFormats.underline }" title="Underline (Ctrl+U)"><i class="bi bi-type-underline"></i></button>
        <div class="vr"></div>
        <button @click="executeCommand('insertUnorderedList')" class="btn btn-sm btn-outline-secondary" :class="{ 'active': activeFormats.insertUnorderedList }" title="Bulleted List"><i class="bi bi-list-ul"></i></button>
        <button @click="executeCommand('insertOrderedList')" class="btn btn-sm btn-outline-secondary" :class="{ 'active': activeFormats.insertOrderedList }" title="Numbered List"><i class="bi bi-list-ol"></i></button>

        <!-- NEW: Add Task Button -->
        <button @click="insertTask" class="btn btn-sm btn-outline-secondary" title="Add Task"><i class="bi bi-check2-square"></i></button>

        <div class="vr"></div>
        <button @click="triggerImageUpload" class="btn btn-sm btn-outline-secondary" title="Insert Image"><i class="bi bi-image"></i></button>
        <input type="file" ref="imageInput" @change="handleImageUpload" accept="image/*" class="d-none">
      </div>
      `,
    methods: {
      updateFormattingState() {
        // Check if we're in the editor context
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        // Get the current node to check its formatting
        const node = selection.anchorNode;
        if (!node) return;
        
        // Check if we're inside the note editor
        const editor = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (!editor || !editor.closest('.note-content-editable')) return;
        
        // Update formatting states
        this.activeFormats.bold = document.queryCommandState('bold');
        this.activeFormats.italic = document.queryCommandState('italic');
        this.activeFormats.underline = document.queryCommandState('underline');
        this.activeFormats.insertUnorderedList = document.queryCommandState('insertUnorderedList');
        this.activeFormats.insertOrderedList = document.queryCommandState('insertOrderedList');
      },
      executeCommand(command, value = null) {
        // Get editor reference before executing command
        const editor = document.querySelector('.note-content-editable');
        if (!editor) return;
        
        // Save selection before command
        const selection = window.getSelection();
        let savedRange = null;
        if (selection.rangeCount > 0) {
          savedRange = selection.getRangeAt(0).cloneRange();
        }
        
        // Execute the command
        editor.focus();
        document.execCommand(command, false, value);
        
        // Restore selection if needed
        if (savedRange) {
          try {
            selection.removeAllRanges();
            selection.addRange(savedRange);
          } catch (e) {
            // Range may no longer be valid, that's okay
          }
        }
        
        // Update formatting state immediately
        this.$nextTick(() => {
          this.updateFormattingState();
          this.$emit("content-change"); // Notify parent to update model
        });
      },
      triggerImageUpload() {
        this.$refs.imageInput.click();
      },
      handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Get editor before async operation
        const editor = document.querySelector('.note-content-editable');
        if (!editor) return;
  
        const reader = new FileReader();
        reader.onload = (e) => {
          editor.focus();
          const imgHTML = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 8px; margin: 1rem 0;" />`;
          document.execCommand("insertHTML", false, imgHTML);
          this.$emit("content-change");
        };
        reader.readAsDataURL(file);
        this.$refs.imageInput.value = ""; // Reset input
      },
      insertTask() {
        const editor = document.querySelector('.note-content-editable');
        if (!editor) return;
        
        editor.focus();
        const selection = window.getSelection();
        let taskContent = 'Task...';
        
        // Check if selection is inside a task item
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const commonAncestor = range.commonAncestorContainer;
          const taskItem = commonAncestor.nodeType === Node.TEXT_NODE 
            ? commonAncestor.parentElement?.closest('.task-item')
            : commonAncestor.closest?.('.task-item');
          
          // If already inside a task, convert it to normal text
          if (taskItem) {
            const taskText = taskItem.querySelector('.task-text');
            if (taskText) {
              const textContent = taskText.innerHTML;
              const newContent = document.createElement('div');
              newContent.innerHTML = textContent;
              newContent.innerHTML += '<br>';
              taskItem.replaceWith(newContent);
            }
            this.$emit("content-change");
            return;
          }
          
          // If text is selected, preserve formatting by extracting the inner HTML
          if (!selection.isCollapsed) {
            const fragment = range.cloneContents();
            const tempDiv = document.createElement('div');
            tempDiv.appendChild(fragment);
            taskContent = tempDiv.innerHTML || 'Task...';
            range.deleteContents();
          }
        }
        
        const taskHTML = `<div class="task-item" contenteditable="false" data-checked="false"><span class="task-checkbox"></span><span class="task-text" contenteditable="true">${taskContent}</span></div><div><br></div>`;
        
        document.execCommand('insertHTML', false, taskHTML);
        this.$emit("content-change");
        
        // Update formatting state
        this.$nextTick(() => {
          this.updateFormattingState();
        });
      },
    },
  };