import { alertService } from "../services/alert-service.js";

export default {
    name: 'NoticeBoard',
    props: {
        isVisible: Boolean,
        content: String,
        isLoading: Boolean,
    },
    emits: ['toggle-visibility', 'refresh', 'navigate-to-note'],
    computed: {
        processedContent() {
            if (!this.content) return '';
            let html = alertService.markdownToHtml(this.content);
            // Replace [Note ID: xxx] with clickable links
            html = html.replace(/\[Note ID: (.*?)\]/g,
                `<a href="#" class="notice-board-link" data-note-id="$1" title="Go to note">
                    <i class="bi bi-box-arrow-up-right small"></i>
                 </a>`);
            return html;
        }
    },
    methods: {
        handleContentClick(event) {
            const link = event.target.closest('.notice-board-link');
            if (link && link.dataset.noteId) {
                event.preventDefault();
                this.$emit('navigate-to-note', link.dataset.noteId);
            }
        },
    },
    template: `
        <div class="notice-board-container" :class="{ 'visible': isVisible }">
            <div class="notice-board-header">
                <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-pin-angle-fill text-primary"></i>
                    <h6 class="mb-0 fw-semibold">Notice Board</h6>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <button class="btn btn-sm btn-icon" @click="$emit('refresh')" :disabled="isLoading" title="Refresh Notice Board">
                        <i class="bi" :class="isLoading ? 'bi-arrow-clockwise anim-spin' : 'bi-arrow-clockwise'"></i>
                    </button>
                    <button class="btn btn-sm btn-icon" @click="$emit('toggle-visibility')" title="Toggle Notice Board">
                        <i class="bi" :class="isVisible ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                    </button>
                </div>
            </div>
            <div class="notice-board-panel">
                <div class="notice-board-content">
                    <div v-if="isLoading" class="notice-board-state">
                        <div class="spinner-border spinner-border-sm" role="status"></div>
                        <p>AI is thinking...</p>
                    </div>
                    <div v-else-if="!content" class="notice-board-state">
                         <i class="bi bi-check2-circle"></i>
                        <p>No urgent items found. All clear!</p>
                    </div>
                    <div v-else @click="handleContentClick" class="markdown-content" v-html="processedContent"></div>
                </div>
            </div>
        </div>
    `
};