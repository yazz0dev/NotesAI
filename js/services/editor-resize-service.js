// js/services/editor-resize-service.js

let isResizing = false;

function doResize(event) {
    if (!isResizing) return;
    
    const editorWrapper = document.querySelector('.main-content-wrapper > .d-flex');
    const editor = editorWrapper ? editorWrapper.querySelector('.note-editor') : null;

    if (!editor || !editorWrapper) return;

    const containerRect = editorWrapper.getBoundingClientRect();
    let newEditorWidth = containerRect.right - event.clientX;
    const minEditorWidth = 350;
    const maxEditorWidth = containerRect.width * 0.8;

    if (newEditorWidth < minEditorWidth) newEditorWidth = minEditorWidth;
    if (newEditorWidth > maxEditorWidth) newEditorWidth = maxEditorWidth;

    editor.style.width = `${newEditorWidth}px`;
    editor.style.flexBasis = `${newEditorWidth}px`;
}

function stopResize() {
    isResizing = false;
    document.body.classList.remove('is-resizing');
    window.removeEventListener('mousemove', doResize);
    window.removeEventListener('mouseup', stopResize);
}

function startResize(event) {
    event.preventDefault();
    isResizing = true;
    document.body.classList.add('is-resizing');
    window.addEventListener('mousemove', doResize);
    window.addEventListener('mouseup', stopResize);
}

export const editorResizeService = {
    start: startResize
};