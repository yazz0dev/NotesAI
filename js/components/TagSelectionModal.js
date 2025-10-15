import { alertService } from "../services/alert-service.js";

export default {
  props: ['noteToTag', 'allTags'],
  emits: ['close', 'update-tags'],
  data() {
    return {
      // Create a local copy to avoid directly mutating the prop
      selectedTagIds: [...(this.noteToTag?.tags || [])],
      searchQuery: '',
      filteredTags: []
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
            <h5 class="modal-title-enhanced">Edit Tags</h5>
            <p class="text-muted mb-0 small">for "{{ noteToTag.summary }}"</p>
          </div>
          <button type="button" class="btn-close-enhanced" @click="$emit('close')">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <div class="modal-body-enhanced">
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
                placeholder="Search tags..."
                @input="filterTags"
              >
            </div>
          </div>

          <!-- Selected tags display -->
          <div v-if="selectedTagIds.length > 0" class="selected-tags mb-3">
            <label class="form-label small text-muted mb-2">Selected Tags:</label>
            <div class="d-flex flex-wrap gap-2">
              <span
                v-for="tagId in selectedTagIds"
                :key="tagId"
                class="badge bg-primary d-flex align-items-center gap-1"
                style="cursor: pointer;"
                @click="toggleTag(tagId)"
              >
                {{ getTagById(tagId)?.name }}
                <i class="bi bi-x-circle-fill" style="font-size: 0.75em;"></i>
              </span>
            </div>
          </div>

          <!-- Available tags -->
          <div v-if="filteredTags.length === 0 && !searchQuery" class="text-center py-4">
            <i class="bi bi-tag empty-state-icon mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
            <p class="text-muted mb-2">No tags created yet</p>
            <small class="text-muted">You can create tags in Settings</small>
          </div>

          <div v-else-if="filteredTags.length === 0" class="text-center py-4">
            <i class="bi bi-search empty-state-icon mb-2" style="font-size: 2rem; opacity: 0.5;"></i>
            <p class="text-muted mb-0">No tags found matching "{{ searchQuery }}"</p>
          </div>

          <div v-else class="tag-selection-list">
            <div class="tag-grid">
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
          </div>
        </div>

        <div class="modal-footer-enhanced">
          <button type="button" class="btn-cancel-enhanced" @click="$emit('close')">
            Cancel
          </button>
          <button type="button" class="btn-confirm-enhanced" @click="confirmSelection">
            <span v-if="selectedTagIds.length === 0">Remove All Tags</span>
            <span v-else>Save {{ selectedTagIds.length }} Tag{{ selectedTagIds.length !== 1 ? 's' : '' }}</span>
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
    filterTags() {
      if (!this.searchQuery.trim()) {
        this.filteredTags = this.allTags;
      } else {
        const query = this.searchQuery.toLowerCase();
        this.filteredTags = this.allTags.filter(tag =>
          tag.name.toLowerCase().includes(query)
        );
      }
    },
    confirmSelection() {
      this.$emit('update-tags', { noteId: this.noteToTag.id, tagIds: this.selectedTagIds });
      this.$emit('close');
    }
  },
  watch: {
    allTags: {
      handler() {
        this.filterTags();
      },
      immediate: true
    }
  }
};