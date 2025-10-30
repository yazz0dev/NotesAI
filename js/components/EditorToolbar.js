export default {
    props: ["canUndo", "canRedo"],
    emits: ["undo", "redo", "content-change"],
    template: `
      <div class="editor-toolbar d-flex flex-wrap align-items-center gap-2 p-2 border-bottom">
        <!-- NEW: Undo/Redo buttons -->
        <button @click="$emit('undo')" class="btn btn-sm btn-outline-secondary" :disabled="!canUndo" title="Undo"><i class="bi bi-arrow-counterclockwise"></i></button>
        <button @click="$emit('redo')" class="btn btn-sm btn-outline-secondary" :disabled="!canRedo" title="Redo"><i class="bi bi-arrow-clockwise"></i></button>
        <div class="vr"></div>

        <button @click="executeCommand('bold')" class="btn btn-sm btn-outline-secondary" title="Bold"><i class="bi bi-type-bold"></i></button>
        <button @click="executeCommand('italic')" class="btn btn-sm btn-outline-secondary" title="Italic"><i class="bi bi-type-italic"></i></button>
        <button @click="executeCommand('underline')" class="btn btn-sm btn-outline-secondary" title="Underline"><i class="bi bi-type-underline"></i></button>
        <div class="vr"></div>
        <button @click="executeCommand('insertUnorderedList')" class="btn btn-sm btn-outline-secondary" title="Bulleted List"><i class="bi bi-list-ul"></i></button>
        <button @click="executeCommand('insertOrderedList')" class="btn btn-sm btn-outline-secondary" title="Numbered List"><i class="bi bi-list-ol"></i></button>

        <!-- NEW: Add Task Button -->
        <button @click="insertTask" class="btn btn-sm btn-outline-secondary" title="Add Task"><i class="bi bi-check2-square"></i></button>

        <div class="vr"></div>
        <button @click="triggerImageUpload" class="btn btn-sm btn-outline-secondary" title="Insert Image"><i class="bi bi-image"></i></button>
        <input type="file" ref="imageInput" @change="handleImageUpload" accept="image/*" class="d-none">
      </div>
      `,
    methods: {
      executeCommand(command, value = null) {
        document.execCommand(command, false, value);
        this.$nextTick(() => {
          this.$emit("content-change"); // Notify parent to update model
        });
      },
      triggerImageUpload() {
        this.$refs.imageInput.click();
      },
      handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
  
        const reader = new FileReader();
        reader.onload = (e) => {
          const imgHTML = `<img src="${e.target.result}" style="max-width: 100%; border-radius: 8px; margin: 1rem 0;" />`;
          document.execCommand("insertHTML", false, imgHTML);
          this.$emit("content-change");
        };
        reader.readAsDataURL(file);
        this.$refs.imageInput.value = ""; // Reset input
      },
      insertTask() {
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
          const fragment = range.extractContents();
          const tempDiv = document.createElement('div');
          tempDiv.appendChild(fragment);
          taskContent = tempDiv.innerHTML;
        }
        
        const taskHTML = `<div class="task-item" contenteditable="false" data-checked="false"><span class="task-checkbox"></span><span class="task-text" contenteditable="true">${taskContent}</span></div><div><br></div>`;
        
        document.execCommand('insertHTML', false, taskHTML);
        this.$emit("content-change");
      },
    },
  };