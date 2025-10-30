// NEW FILE: NotesAi/js/services/ai-response-service.js

const { reactive } = Vue;
import { alertService } from './alert-service.js'; // For markdown processing

const state = reactive({
  isVisible: false,
  isLoading: false,
  title: '',
  content: '', // Raw markdown content
  type: 'answer', // 'answer', 'summary'
});

function show({ title = 'AI Response', content = '', type = 'answer' }) {
  state.title = title;
  state.content = content;
  state.type = type;
  state.isLoading = !content; // If content is empty, assume we are loading
  state.isVisible = true;
}

function hide() {
  state.isVisible = false;
  // Reset after transition
  setTimeout(() => {
    state.isLoading = false;
    state.title = '';
    state.content = '';
  }, 300);
}

function setLoading(isLoading) {
  state.isLoading = isLoading;
}

function updateContent(content) {
  state.content = content;
  state.isLoading = false;
}

// Re-process content for HTML display
function getProcessedContent() {
    if (!state.content) return '';
    // Use the robust markdown parser from alertService
    let html = alertService.markdownToHtml(state.content);
    // Add specific classes for better styling in the panel
    html = html.replace(/<h[4-6]/g, '<h6').replace(/<\/h[4-6]>/g, '</h6>');
    return html;
}

export const aiResponseService = {
  state,
  show,
  hide,
  setLoading,
  updateContent,
  getProcessedContent
};