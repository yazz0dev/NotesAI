/**
 * TagSelectionOverlay Component
 * 
 * A simple, non-blocking overlay for quick tag selection on notes.
 * No tag management - just select/deselect existing tags.
 */
export default {
  props: ['noteToTag', 'allTags', 'triggerPosition'],
  emits: ['close', 'update-tags'],
  data() {
    return {
      selectedTagIds: [...(this.noteToTag?.tags || [])],
      searchQuery: '',
      overlayStyle: {},
    }
  },
  mounted() {
    if (this.triggerPosition) {
      this.overlayStyle = {
        top: (this.triggerPosition.bottom + 8) + 'px',
        right: (window.innerWidth - this.triggerPosition.right) + 'px',
      };
    }
  },
  computed: {
    filteredTags() {
      if (!this.searchQuery.trim()) {
        return this.allTags;
      }
      const query = this.searchQuery.toLowerCase();
      return this.allTags.filter(tag =>
        tag.name.toLowerCase().includes(query)
      );
    },
  },
  template: `
    <div class="tag-selection-overlay" :style="overlayStyle">
      <div class="tag-overlay-panel">
        <!-- Header -->
        <div class="tag-overlay-header">
          <h6 class="mb-0">Tags</h6>
          <button class="btn btn-sm btn-close" @click="handleClose"></button>
        </div>

        <!-- Search -->
        <div class="tag-overlay-search">
          <input
            type="text"
            class="form-control form-control-sm"
            v-model="searchQuery"
            placeholder="Search tags..."
            @keydown.escape="handleClose"
          >
        </div>

        <!-- Tags List -->
        <div class="tag-overlay-list">
          <div v-if="allTags.length === 0" class="text-center py-3">
            <small class="text-muted">No tags available</small>
          </div>
          
          <div v-else-if="filteredTags.length === 0" class="text-center py-3">
            <small class="text-muted">No tags match your search</small>
          </div>

          <label v-for="tag in filteredTags" :key="tag.id" class="tag-overlay-item">
            <input
              type="checkbox"
              :checked="isSelected(tag.id)"
              @change="toggleTag(tag.id)"
              class="form-check-input"
            >
            <span class="tag-color-dot" :style="{ backgroundColor: tag.color }"></span>
            <span class="tag-name">{{ tag.name }}</span>
          </label>
        </div>

        <!-- Footer -->
        <div class="tag-overlay-footer">
          <button class="btn btn-sm btn-secondary" @click="handleClose">Cancel</button>
          <button class="btn btn-sm btn-primary" @click="confirmSelection">Done</button>
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
    confirmSelection() {
      this.$emit('update-tags', { 
        noteId: this.noteToTag.id, 
        tagIds: this.selectedTagIds 
      });
      this.$emit('close');
    },
    handleClose() {
      this.$emit('close');
    }
  }
};
