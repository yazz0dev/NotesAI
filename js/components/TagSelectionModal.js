import { alertService } from "../services/alert-service.js";

export default {
  props: ['noteToTag', 'allTags'],
  emits: ['close', 'update-tags', 'create-tag'],
  data() {
    return {
      // Store initial state to detect changes
      initialTagIds: [...(this.noteToTag?.tags || [])],
      // Create a local copy to avoid directly mutating the prop
      selectedTagIds: [...(this.noteToTag?.tags || [])],
      searchQuery: '',
    }
  },
  computed: {
    /**
     * Checks if the selected tags have changed from their initial state.
     */
    hasChanges() {
      const initial = [...this.initialTagIds].sort();
      const current = [...this.selectedTagIds].sort();
      return JSON.stringify(initial) !== JSON.stringify(current);
    },
    /**
     * Filters the available tags based on the search query.
     */
    filteredTags() {
      if (!this.searchQuery.trim()) {
        return this.allTags;
      }
      const query = this.searchQuery.toLowerCase();
      return this.allTags.filter(tag =>
        tag.name.toLowerCase().includes(query)
      );
    },
    /**
     * Determines if the current search query can be used to create a new tag.
     */
    canCreateTag() {
        if (!this.searchQuery.trim()) return false;
        const query = this.searchQuery.trim().toLowerCase();
        // Returns true only if no tag with the exact same name exists
        return !this.allTags.some(tag => tag.name.toLowerCase() === query);
    }
  },
  template: `
    <div class="modal-backdrop-enhanced" @click.self="$emit('close')">
      <div class="modal-enhanced" @click.stop>
        <div class="modal-header-enhanced">
          <div class="modal-icon-container">
            <i class="modal-icon bi bi-tags text-primary"></i>
          </div>
          <div class="modal-title-container">
            <h5 class="modal-title-enhanced">Manage Tags</h5>
            <p class="text-muted mb-0 small text-truncate" :title="noteToTag.title">for "{{ noteToTag.title }}"</p>
          </div>
          <button type="button" class="btn-close-enhanced" @click="$emit('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="modal-body-enhanced">
          <!-- Selected tags display -->
          <div v-if="selectedTagIds.length > 0" class="selected-tags-container mb-3">
            <div class="d-flex flex-wrap gap-2">
              <span
                v-for="tagId in selectedTagIds"
                :key="tagId"
                class="badge selected-tag-pill d-flex align-items-center gap-1"
                @click="toggleTag(tagId)"
              >
                <span class="tag-color-indicator-sm" :style="{ backgroundColor: getTagById(tagId)?.color }"></span>
                {{ getTagById(tagId)?.name }}
                <i class="bi bi-x-circle"></i>
              </span>
            </div>
            <hr class="my-3">
          </div>
        
          <!-- Search input for filtering tags -->
          <div class="search-container mb-3">
            <div class="input-group input-group-sm">
              <span class="input-group-text">
                <i class="bi bi-search"></i>
              </span>
              <input
                type="text"
                class="form-control"
                v-model="searchQuery"
                placeholder="Search or create a new tag..."
              >
            </div>
          </div>

          <!-- Tags List / Empty States -->
          <div class="tag-list-wrapper">
            <div v-if="allTags.length === 0" class="text-center py-4">
              <i class="bi bi-tag empty-state-icon mb-2" style="font-size: 2rem;"></i>
              <p class="text-muted mb-0">No tags yet. Type to create one!</p>
            </div>

            <div v-else-if="filteredTags.length === 0 && !canCreateTag" class="text-center py-4">
              <i class="bi bi-search empty-state-icon mb-2" style="font-size: 2rem;"></i>
              <p class="text-muted mb-0">No tags found matching "{{ searchQuery }}"</p>
            </div>

            <div v-else class="tag-grid">
              <div
                v-for="tag in filteredTags"
                :key="tag.id"
                @click="toggleTag(tag.id)"
                class="tag-item-enhanced"
                :class="{ 'selected': isSelected(tag.id) }"
              >
                <div class="tag-color-indicator" :style="{ backgroundColor: tag.color }"></div>
                <span class="tag-name">{{ tag.name }}</span>
                <div class="tag-check">
                  <i v-if="isSelected(tag.id)" class="bi bi-check-circle-fill text-primary"></i>
                </div>
              </div>
            </div>

            <!-- Create New Tag Suggestion -->
            <div v-if="canCreateTag" class="create-tag-suggestion" @click="handleCreateTagAndSelect">
                <i class="bi bi-plus-circle-dotted me-2"></i>
                <span>Create new tag: <strong>"{{ searchQuery }}"</strong></span>
            </div>
          </div>
        </div>

        <div class="modal-footer-enhanced">
          <button type="button" class="btn-enhanced btn-cancel-enhanced" @click="$emit('close')">
            Cancel
          </button>
          <button type="button" class="btn-enhanced btn-confirm-enhanced btn-primary" @click="confirmSelection" :disabled="!hasChanges">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  `,
  methods: {
    isSelected(tagId) {
      return this.selectedTagIds.includes(tagId);
    },
    toggleTag(tagId) {
      const index = this.selectedTagIds.indexOf(tagId);
      if (index > -1) {
        this.selectedTagIds.splice(index, 1);
      } else {
        this.selectedTagIds.push(tagId);
      }
    },
    getTagById(tagId) {
      return this.allTags.find(tag => tag.id === tagId);
    },
    handleCreateTagAndSelect() {
        if (!this.canCreateTag) return;
        // Emit event for main app to handle tag creation
        this.$emit('create-tag', this.searchQuery.trim());
    },
    confirmSelection() {
      // Only emit if there are actual changes
      if (this.hasChanges) {
          this.$emit('update-tags', { noteId: this.noteToTag.id, tagIds: this.selectedTagIds });
      }
      this.$emit('close');
    }
  },
  watch: {
    // This watcher is key: when a new tag is created in the parent,
    // the `allTags` prop updates, and we can automatically select the new tag.
    allTags(newTags, oldTags) {
        if (newTags.length > oldTags.length && this.searchQuery) {
            // Find the newly added tag
            const newTag = newTags.find(nt => !oldTags.some(ot => ot.id === nt.id));
            // If the new tag's name matches our search, it means we just created it
            if (newTag && this.searchQuery.trim().toLowerCase() === newTag.name.toLowerCase()) {
                if (!this.selectedTagIds.includes(newTag.id)) {
                    this.selectedTagIds.push(newTag.id);
                }
                this.searchQuery = ''; // Clear search after creation
            }
        }
    }
  }
};