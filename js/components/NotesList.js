import { MarkdownHandler, StringUtils, DateUtils } from '../utils/index.js';

export default {
    props: ["notes", "layout", "allTags"],
    emits: ['edit-note', 'delete-note', 'toggle-favorite', 'archive-note', 'open-tag-modal', 'set-reminder', 'remove-reminder', 'create-note'],
    template: `
            <div class="notes-list-container p-3">
                <div v-if="notes.length === 0" class="text-center text-muted mt-5 py-5">
                    <div class="empty-state-icon mb-4">
                        <i class="bi bi-journal-x display-1 text-muted"></i>
                    </div>
                    <h4 class="text-muted mb-2">No notes found</h4>
                    <p class="text-muted">Create a new note or try a different search.</p>
                    <button class="btn btn-primary mt-3" @click="$emit('create-note')">
                        <i class="bi bi-plus-lg me-2"></i>Create First Note
                    </button>
                </div>
                <!-- KEY CHANGE: Replaced Bootstrap's row/col system for grid view with a new .notes-grid class -->
                <div v-else :class="['g-3', { 'list-view': layout === 'list', 'notes-grid': layout === 'grid' }]">
                    <!-- The wrapping div is now removed for grid view, the parent handles the layout -->
                    <div v-for="note in notes" :key="note.id" :class="layout === 'list' ? 'col-12' : ''">
                        <div class="card h-100 note-card position-relative"
                             @click="$emit('edit-note', note)"
                             :class="{ 'border-warning': note.reminderAt, 'border-primary': note.isFavorite }">
                            <!-- Card Header with Status Indicators -->
                            <div class="card-header bg-transparent border-bottom-0 pb-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="d-flex align-items-center gap-2">
                                        <i v-if="note.audioUrl" class="bi bi-mic-fill text-primary" title="Contains original recording"></i>
                                        <i v-if="note.aiSummary" class="bi bi-robot text-info" title="Has AI summary"></i>
                                        <i v-if="note.reminderAt" class="bi bi-bell-fill text-warning" title="Has reminder set"></i>
                                        <small class="text-muted fw-semibold">{{ formatDate(note.updatedAt) }}</small>
                                    </div>
                                    <div class="dropdown position-absolute top-0 end-0">
                                        <button class="btn btn-sm btn-link text-muted p-1"
                                                type="button"
                                                data-bs-toggle="dropdown"
                                                aria-expanded="false"
                                                @click.stop>
                                            <i class="bi bi-three-dots-vertical"></i>
                                        </button>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <template v-if="note.reminderAt">
                                                <li><a class="dropdown-item" href="#" @click.stop="$emit('set-reminder', note)">
                                                    <i class="bi bi-pencil me-2"></i>Edit Reminder
                                                </a></li>
                                                <li><a class="dropdown-item text-danger" href="#" @click.stop="$emit('remove-reminder', note)">
                                                    <i class="bi bi-bell-slash me-2"></i>Remove Reminder
                                                </a></li>
                                            </template>
                                            <li v-else>
                                                <a class="dropdown-item" href="#" @click.stop="$emit('set-reminder', note)">
                                                    <i class="bi bi-bell me-2"></i>Set Reminder
                                                </a>
                                            </li>
                                            <li><a class="dropdown-item" href="#" @click.stop="$emit('archive-note', note)">
                                                <i class="bi bi-archive me-2"></i>Archive
                                            </a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item text-danger" href="#" @click.stop="$emit('delete-note', note.id)">
                                                <i class="bi bi-trash me-2"></i>Delete
                                            </a></li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                            <!-- Card Body -->
                            <div class="card-body pt-0">
                                <h6 class="card-title fw-semibold text-dark mb-2 line-clamp-2">
                                    {{ note.title || 'Untitled Note' }}
                                </h6>
                                
                                <!-- Smart Content Preview - shows based on actual content -->
                                <div class="card-content-preview mb-3">
                                    <!-- Show tasks if content has task items -->
                                    <div v-if="hasTaskItems(note.content)" class="task-list-preview">
                                        <div v-for="(item, index) in getTaskItems(note.content).slice(0, 3)" 
                                             :key="index" 
                                             class="task-item-preview"
                                             :class="{ 'task-completed': item.checked }">
                                            <span class="task-checkbox-preview"></span>
                                            <span class="task-text-preview">{{ item.text }}</span>
                                        </div>
                                        <small v-if="getTaskItems(note.content).length > 3" class="text-muted d-block mt-1">
                                            +{{ getTaskItems(note.content).length - 3 }} more tasks
                                        </small>
                                    </div>
                                    <!-- Show lists if content has list items -->
                                    <div v-else-if="hasListMarkup(note.content)" class="list-preview">
                                        <div v-for="(item, index) in getListMarkupItems(note.content).slice(0, 3)" 
                                             :key="index"
                                             class="list-item-preview">
                                            {{ item }}
                                        </div>
                                        <small v-if="getListMarkupItems(note.content).length > 3" class="text-muted d-block mt-1">
                                            +{{ getListMarkupItems(note.content).length - 3 }} more items
                                        </small>
                                    </div>
                                    <!-- Otherwise show text preview -->
                                    <div v-else class="text-preview">
                                        <p class="card-text text-muted small line-clamp-3 mb-0">{{ getSnippet(note.content) }}</p>
                                    </div>
                                </div>

                                <div v-if="note.tags && note.tags.length" class="mb-0">
                                    <div class="d-flex flex-wrap gap-1">
                                        <span v-for="tagId in note.tags.slice(0, 3)" :key="tagId"
                                              class="badge bg-light text-dark border">
                                            {{ getTagById(tagId)?.name || '...' }}
                                        </span>
                                        <span v-if="note.tags.length > 3" class="badge bg-secondary">
                                            +{{ note.tags.length - 3 }} more
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <!-- Card Footer with Quick Actions -->
                            <div class="card-footer bg-transparent border-top-0 pt-0">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-outline-light border-0 text-muted"
                                                @click.stop="$emit('toggle-favorite', note)"
                                                :title="note.isFavorite ? 'Unfavorite' : 'Favorite'">
                                            <i class="bi" :class="note.isFavorite ? 'bi-star-fill text-warning' : 'bi-star'"></i>
                                        </button>
                                        <button class="btn btn-outline-light border-0 text-muted"
                                                @click.stop="$emit('open-tag-modal', note, $event)"
                                                title="Edit Tags">
                                            <i class="bi bi-tags"></i>
                                        </button>
                                        <button class="btn btn-outline-light border-0 text-muted"
                                                @click.stop="$emit('set-reminder', note)"
                                                :title="note.reminderAt ? 'Edit Reminder' : 'Set Reminder'">
                                            <i class="bi bi-bell" :class="note.reminderAt ? 'text-warning' : ''"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `,
    methods: {
        getTagById(tagId) {
            return this.allTags.find(t => t.id === tagId);
        },
        /**
         * Gets a snippet of the note content with markdown support
         * @param {string} content - The note content
         * @returns {string} - Plain text snippet
         */
        getSnippet(content) {
            // Remove all HTML tags and clean up text
            let text = content
                .replace(/<[^>]*>/g, '')  // Remove all HTML tags
                .replace(/&nbsp;/g, ' ')   // Replace nbsp entities
                .replace(/\s+/g, ' ')      // Collapse multiple spaces
                .trim();
            
            return text.length > 120 ? text.substring(0, 120) + '...' : text;
        },
        /**
         * Formats date relative to now using DateUtils
         * @param {string} dateString - The date string
         * @returns {string} - Formatted relative date
         */
        formatDate(dateString) {
            if (!dateString) return '';
            return DateUtils.formatRelative(dateString);
        },
        /**
         * Gets word count from note content
         * @param {string} content - The note content
         * @returns {string} - Word count
         */
        getWordCount(content) {
            if (!content) return '0';
            return StringUtils.wordCount(MarkdownHandler.htmlToPlainText(content)).toString();
        },
        /**
         * Renders markdown content to HTML for preview
         * @param {string} content - The content to render
         * @returns {string} - Rendered HTML
         */
        renderMarkdown(content) {
            if (!content) return '';
            const html = MarkdownHandler.markdownToHtml(content);
            return MarkdownHandler.sanitizeHtml(html);
        },
        /**
         * Checks if content contains markdown
         * @param {string} content - Content to check
         * @returns {boolean} - True if markdown detected
         */
        hasMarkdown(content) {
            return MarkdownHandler.isMarkdown(content);
        },
        /**
         * Detects if content contains task items (div.task-item elements)
         * @param {string} content - Content to check
         * @returns {boolean} - True if task items detected
         */
        hasTaskItems(content) {
            if (!content) return false;
            return /class="task-item"/i.test(content);
        },
        /**
         * Extracts task items from HTML content
         * @param {string} content - HTML content to extract from
         * @returns {Array} - Array of {text, checked} objects
         */
        getTaskItems(content) {
            if (!content) return [];
            const items = [];
            
            // Match: <div class="task-item" ... data-checked="true/false" ...><span class="task-checkbox"></span><span class="task-text" ...>TEXT</span></div>
            const taskRegex = /<div\s+class="task-item"[^>]*data-checked="([^"]*)"[^>]*>.*?<span\s+class="task-text"[^>]*>([^<]*)<\/span>.*?<\/div>/gi;
            let match;
            
            while ((match = taskRegex.exec(content)) !== null) {
                const checked = match[1].toLowerCase() === 'true';
                let text = match[2]
                    .replace(/&nbsp;/g, ' ')  // Replace &nbsp; entities
                    .replace(/&amp;/g, '&')   // Replace &amp; entities
                    .replace(/&lt;/g, '<')    // Replace &lt; entities
                    .replace(/&gt;/g, '>')    // Replace &gt; entities
                    .replace(/&quot;/g, '"')  // Replace &quot; entities
                    .replace(/&#39;/g, "'")   // Replace &#39; entities
                    .trim();
                    
                if (text && text !== 'Task...') {
                    items.push({ checked, text });
                }
            }
            return items;
        },
        /**
         * Detects if content contains list markup (ul, ol, or li elements)
         * @param {string} content - Content to check
         * @returns {boolean} - True if list items detected
         */
        hasListMarkup(content) {
            if (!content) return false;
            return /<(?:ul|ol|li)[^>]*>/i.test(content);
        },
        /**
         * Extracts list items from HTML content
         * @param {string} content - HTML content to extract from
         * @returns {Array} - Array of list item text strings
         */
        getListMarkupItems(content) {
            if (!content) return [];
            const items = [];
            
            // Extract from li elements
            const liRegex = /<li[^>]*>([^<]*)<\/li>/gi;
            let match;
            while ((match = liRegex.exec(content)) !== null) {
                let text = match[1]
                    .replace(/&nbsp;/g, ' ')  // Replace &nbsp; entities
                    .replace(/&amp;/g, '&')   // Replace &amp; entities
                    .replace(/&lt;/g, '<')    // Replace &lt; entities
                    .replace(/&gt;/g, '>')    // Replace &gt; entities
                    .replace(/&quot;/g, '"')  // Replace &quot; entities
                    .replace(/&#39;/g, "'")   // Replace &#39; entities
                    .trim();
                    
                if (text) items.push(text);
            }
            
            return items;
        }
    }
};