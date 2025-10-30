// NEW FILE: NotesAi/js/components/AIResponseModal.js

import { aiResponseService } from '../services/ai-response-service.js';
import { alertService } from '../services/alert-service.js';
import { toastService } from '../services/toast-service.js';
import { MarkdownHandler } from '../utils/index.js';

export default {
  name: 'AIResponseModal',
  setup() {
    return {
      aiState: aiResponseService.state,
      hide: aiResponseService.hide,
    };
  },
  computed: {
    processedContent() {
      return aiResponseService.getProcessedContent();
    },
    panelIcon() {
        switch(this.aiState.type) {
            case 'summary': return 'bi-file-text-fill';
            case 'answer':
            default: return 'bi-robot';
        }
    }
  },
  methods: {
    async copyContent() {
        if (!this.aiState.content) return;
        try {
            const plainText = MarkdownHandler.htmlToPlainText(this.processedContent);
            await navigator.clipboard.writeText(plainText);
            toastService.success('Copied!', 'AI response copied to clipboard.');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            toastService.error('Copy Failed', 'Could not copy text to clipboard.');
        }
    },
    handleKeydown(event) {
      if (event.key === 'Escape' && this.aiState.isVisible) {
        this.hide();
      }
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  },
  template: `
    <transition name="slide-fade">
      <div v-if="aiState.isVisible" class="ai-response-panel">
        <div class="ai-response-header">
          <h5 class="ai-response-title">
            <i :class="['bi', panelIcon, 'me-2']"></i>
            {{ aiState.title }}
          </h5>
          <button class="btn btn-close-enhanced" @click="hide" aria-label="Close AI Response">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="ai-response-body">
          <div v-if="aiState.isLoading" class="loading-state">
            <div class="spinner-border text-primary" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 text-muted">AI is thinking...</p>
          </div>
          <div v-else class="markdown-content-container" v-html="processedContent"></div>
        </div>
        <div class="ai-response-footer">
            <button class="btn btn-sm btn-outline-secondary w-100" @click="copyContent" :disabled="aiState.isLoading || !aiState.content">
                <i class="bi bi-clipboard me-2"></i>Copy to Clipboard
            </button>
        </div>
      </div>
    </transition>
  `
};