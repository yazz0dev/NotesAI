export default {
  props: ["currentView", "allTags", "newTagName", "isSidebarCollapsed"],
  emits: ['update:new-tag-name', 'create-tag', 'tag-click', 'create-note', 'switch-view'],
  data() {
    return {
      localTagName: (this.newTagName || "").trim(),
      isCreatingTag: false,
    };
  },
  methods: {
    isTagActive(tag) {
      return this.currentView === `tag:${tag.id}`;
    },
    showTagInput() {
      this.isCreatingTag = true;
      this.$nextTick(() => {
        if (this.$refs.newTagInput) {
          this.$refs.newTagInput.focus();
        }
      });
    },
    confirmTagCreation() {
      if (this.localTagName.trim()) {
        this.$emit('create-tag', this.localTagName);
      }
      this.localTagName = '';
      this.isCreatingTag = false;
    },
    cancelCreation() {
      this.localTagName = '';
      this.isCreatingTag = false;
    }
  },
  watch: {
    newTagName: {
      handler(newVal) {
        this.localTagName = (newVal || "").trim();
      },
      immediate: true
    },
    localTagName: {
      handler(newVal) {
        this.$emit('update:new-tag-name', newVal);
      },
      immediate: true
    }
  },
  template: `
    <nav class="sidebar border-end shadow-sm d-flex flex-column">
      <div class="sidebar-nav flex-fill overflow-hidden d-flex flex-column">
        <!-- Quick Actions -->
        <div class="p-3">
          <button class="btn btn-primary w-100 d-flex align-items-center gap-2"
                  :class="{ 'justify-content-center': isSidebarCollapsed }"
                  @click="$emit('create-note')"
                  :style="isSidebarCollapsed ? 'padding: 12px;' : 'border-radius: 8px; padding: 12px;'">
            <i class="bi bi-plus-lg"></i>
            <span class="nav-text" :class="{ 'd-none': isSidebarCollapsed }">New Note</span>
          </button>
        </div>

        <!-- Navigation Menu -->
        <div class="px-3 pb-2">
            <ul class="nav nav-pills flex-column">
              <li class="nav-item mb-1">
                <a href="#" class="nav-link d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'all-notes' }]"
                   @click.prevent="$emit('switch-view', 'all-notes')">
                  <i class="bi bi-journal-text me-2"></i>
                  <span class="nav-text">All Notes</span>
                </a>
              </li>
              <li class="nav-item mb-1">
                <a href="#" class="nav-link d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'favorites' }]"
                   @click.prevent="$emit('switch-view', 'favorites')">
                  <i class="bi bi-star me-2"></i>
                  <span class="nav-text">Favorites</span>
                </a>
              </li>
              <li class="nav-item mb-1">
                <a href="#" class="nav-link d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'archived' }]"
                   @click.prevent="$emit('switch-view', 'archived')">
                  <i class="bi bi-archive me-2"></i>
                  <span class="nav-text">Archived</span>
                </a>
              </li>
            </ul>
        </div>

        <!-- Tags Section -->
        <div class="flex-fill px-3 pb-3 d-flex flex-column overflow-hidden">
            <div class="d-flex align-items-center justify-content-between mb-2" :class="{ 'd-none': isSidebarCollapsed }">
                <h6 class="mb-0 fw-semibold small">TAGS</h6>
                <div class="d-flex align-items-center">
                  <span class="badge bg-secondary-subtle text-secondary-emphasis rounded-pill me-2">{{ allTags.length }}</span>
                  <button v-if="!isCreatingTag" @click="showTagInput" class="btn btn-sm btn-link p-0 text-muted" title="Add new tag">
                      <i class="bi bi-plus-circle"></i>
                  </button>
                </div>
            </div>
            
            <div v-if="isCreatingTag && !isSidebarCollapsed" class="input-group input-group-sm mb-2">
              <input
                  ref="newTagInput"
                  type="text"
                  class="form-control"
                  placeholder="New tag name..."
                  v-model="localTagName"
                  @keydown.enter.prevent="confirmTagCreation"
                  @keydown.esc.prevent="cancelCreation"
              >
              <button class="btn btn-outline-secondary" @click="confirmTagCreation" :disabled="!localTagName.trim()">
                  <i class="bi bi-check-lg"></i>
              </button>
            </div>

            <div class="tag-list-sidebar flex-fill overflow-auto">
                <a v-for="tag in allTags"
                   :key="tag.id"
                   href="#"
                   @click.prevent="$emit('tag-click', tag.id)"
                   class="tag-item d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: isTagActive(tag) }]">
                    <span class="tag-color-dot rounded-circle flex-shrink-0 me-2"
                          :style="{ backgroundColor: tag.color }"></span>
                    <span class="nav-text flex-fill text-truncate">{{ tag.name }}</span>
                </a>
                <div v-if="allTags.length === 0 && !isSidebarCollapsed" class="text-center py-4 text-muted small">
                    <p class="mb-0">No tags yet.</p>
                </div>
            </div>
        </div>
      </div>

      <div class="sidebar-footer border-top p-3">
          <small class="nav-text d-block text-center" :class="{ 'd-none': isSidebarCollapsed }">© 2025 Notes & Tasks</small>
      </div>
    </nav>
    `,
};