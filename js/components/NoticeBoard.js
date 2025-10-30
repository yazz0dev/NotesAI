import { alertService } from "../services/alert-service.js";

export default {
    name: 'NoticeBoard',
    props: {
        isVisible: {
            type: Boolean,
            default: true
        },
        content: {
            type: String,
            default: null
        },
        isLoading: {
            type: Boolean,
            default: false
        },
        isEditorOpen: {
            type: Boolean,
            default: false
        }
    },
    emits: ['toggle-visibility', 'refresh', 'navigate-to-note'],
    data() {
        return {
            isExpanded: true,
            lastToggleTime: 0
        };
    },
    watch: {
        isEditorOpen(newVal) {
            // Auto-collapse when editor opens
            if (newVal && this.isExpanded) {
                this.isExpanded = false;
            }
            // Auto-expand when editor closes
            if (!newVal && !this.isExpanded) {
                this.isExpanded = true;
            }
        }
    },
    computed: {
        processedContent() {
            if (!this.content) return '';
            let html = alertService.markdownToHtml(this.content);
            // Remove "Actionable Items & Reminders" heading if present
            html = html.replace(/<h[1-6]>Actionable Items & Reminders<\/h[1-6]>\s*/gi, '');
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
        toggleExpanded(event) {
            // Prevent multiple rapid toggles
            const now = Date.now();
            if (now - this.lastToggleTime < 300) {
                return;
            }
            this.lastToggleTime = now;
            
            this.isExpanded = !this.isExpanded;
            event.preventDefault();
            event.stopPropagation();
        },
        handleRefresh(event) {
            event.preventDefault();
            event.stopPropagation();
            this.$emit('refresh');
        },
        handleTitleClick(event) {
            event.preventDefault();
            event.stopPropagation();
            this.toggleExpanded(event);
        }
    },
    template: `
        <div class="notice-board-wrapper" :class="{ 'editor-open': isEditorOpen }">
            <div class="notice-board-container">
                <div class="notice-board-header">
                    <div class="d-flex align-items-center gap-2" @click="handleTitleClick" style="flex: 1; cursor: pointer;">
                        <i class="bi bi-pin-angle-fill text-primary"></i>
                        <h6 class="mb-0 fw-semibold">Notice Board</h6>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <button class="btn btn-sm btn-icon" @click="handleRefresh" :disabled="isLoading" title="Refresh Notice Board" type="button">
                            <i class="bi" :class="isLoading ? 'bi-arrow-clockwise anim-spin' : 'bi-arrow-clockwise'"></i>
                        </button>
                        <button class="btn btn-sm btn-icon" @click="toggleExpanded" title="Toggle Notice Board" type="button">
                            <i class="bi" :class="isExpanded ? 'bi-chevron-up' : 'bi-chevron-down'"></i>
                        </button>
                    </div>
                </div>
                <div class="notice-board-panel" :class="{ 'visible': isExpanded }">
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
        </div>
    `
};