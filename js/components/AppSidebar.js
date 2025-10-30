export default {
  props: ["currentView", "allTags", "newTagName", "sidebarCollapsed"],
  emits: ['update:new-tag-name', 'create-tag', 'tag-click', 'create-note', 'switch-view', 'delete-tag'],
  data() {
    return {
      localTagName: (this.newTagName || "").trim(),
      isCreatingTag: false,
      clickOutsideHandler: null,
    };
  },
  methods: {
    isTagActive(tag) {
      return this.currentView === `tag:${tag.id}`;
    },
    showTagInput() {
      console.log('[AppSidebar] Show tag input clicked');
      this.isCreatingTag = true;
      // Create a bound handler for this session
      this.clickOutsideHandler = this.handleClickOutside.bind(this);
      // Attach the click outside listener with a small delay to avoid catching the same click event
      setTimeout(() => {
        document.addEventListener('click', this.clickOutsideHandler);
        console.log('[AppSidebar] Click outside listener attached');
      }, 0);
      this.$nextTick(() => {
        if (this.$refs.newTagInput) {
          this.$refs.newTagInput.focus();
          console.log('[AppSidebar] Input focused');
        }
      });
    },
    confirmTagCreation() {
      console.log('[AppSidebar] Confirm tag creation:', this.localTagName);
      if (this.clickOutsideHandler) {
        document.removeEventListener('click', this.clickOutsideHandler);
        this.clickOutsideHandler = null;
        console.log('[AppSidebar] Click outside listener removed');
      }
      if (this.localTagName.trim()) {
        this.$emit('create-tag', this.localTagName);
        console.log('[AppSidebar] Emitted create-tag:', this.localTagName);
        // Clear immediately to reset state
        this.localTagName = '';
      }
      this.isCreatingTag = false;
    },
    cancelCreation() {
      console.log('[AppSidebar] Cancel tag creation');
      if (this.clickOutsideHandler) {
        document.removeEventListener('click', this.clickOutsideHandler);
        this.clickOutsideHandler = null;
        console.log('[AppSidebar] Click outside listener removed');
      }
      this.localTagName = '';
      this.isCreatingTag = false;
    },
    handleClickOutside(event) {
      // Only handle if tag input is currently visible
      if (!this.isCreatingTag) return;
      
      // Check if click is outside the tags section
      const tagsSection = event.target.closest('.sidebar-tags-section');
      if (!tagsSection) {
        console.log('[AppSidebar] Click outside detected, canceling');
        this.cancelCreation();
      }
    },
    deleteTag(tagId, event) {
      event.preventDefault();
      event.stopPropagation();
      this.$emit('delete-tag', tagId);
    }
  },
  watch: {
    newTagName: {
      handler(newVal) {
        // Only sync if we're not currently creating a tag (to avoid circular updates)
        if (!this.isCreatingTag) {
          this.localTagName = (newVal || "").trim();
        }
      },
      immediate: true
    },
    localTagName: {
      handler(newVal) {
        // Only emit if we're actively creating a tag
        if (this.isCreatingTag) {
          this.$emit('update:new-tag-name', newVal);
        }
      }
    }
  },
  mounted() {
    console.log('[AppSidebar] Mounted');
  },
  beforeUnmount() {
    // Clean up the listener if it's still attached
    if (this.clickOutsideHandler) {
      document.removeEventListener('click', this.clickOutsideHandler);
      this.clickOutsideHandler = null;
      console.log('[AppSidebar] Unmounted - click handler cleaned up');
    }
  },
  template: `
    <nav class="sidebar border-end shadow-sm d-flex flex-column" role="navigation" aria-label="Sidebar navigation">
      <div class="sidebar-nav flex-fill overflow-hidden d-flex flex-column">
        <!-- Quick Actions -->
        <div class="sidebar-quick-actions p-3">
          <button class="btn btn-primary w-100 d-flex align-items-center gap-2 btn-create-note"
                  :class="{ 'justify-content-center': sidebarCollapsed }"
                  @click="$emit('create-note')"
                  title="Create a new note (Ctrl+N)"
                  aria-label="Create a new note">
            <i class="bi bi-plus-lg"></i>
            <span class="nav-text" :class="{ 'd-none': sidebarCollapsed }">New Note</span>
          </button>
        </div>

        <!-- Navigation Menu -->
        <div class="sidebar-menu px-3 pb-2">
            <ul class="nav nav-pills flex-column">
              <li class="nav-item mb-1">
                <a href="#" class="nav-link nav-link-item d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'all-notes' }]"
                   @click.prevent="$emit('switch-view', 'all-notes')"
                   title="View all notes"
                   aria-current="page">
                  <i class="bi bi-journal-text me-2"></i>
                  <span class="nav-text">All Notes</span>
                </a>
              </li>
              <li class="nav-item mb-1">
                <a href="#" class="nav-link nav-link-item d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'favorites' }]"
                   @click.prevent="$emit('switch-view', 'favorites')"
                   title="View favorite notes"
                   aria-current="page">
                  <i class="bi bi-star me-2"></i>
                  <span class="nav-text">Favorites</span>
                </a>
              </li>
              <li class="nav-item mb-1">
                <a href="#" class="nav-link nav-link-item d-flex align-items-center rounded-3 transition-all"
                   :class="[{ active: currentView === 'archived' }]"
                   @click.prevent="$emit('switch-view', 'archived')"
                   title="View archived notes"
                   aria-current="page">
                  <i class="bi bi-archive me-2"></i>
                  <span class="nav-text">Archived</span>
                </a>
              </li>
            </ul>
        </div>

        <!-- Tags Section -->
        <div class="flex-fill px-3 pb-3 d-flex flex-column overflow-hidden sidebar-tags-section">
            <div class="sidebar-tags-header d-flex align-items-center justify-content-between mb-2" :class="{ 'd-none': sidebarCollapsed }">
                <h6 class="mb-0 fw-semibold small text-uppercase">Tags</h6>
                <div class="d-flex align-items-center gap-1">
                  <span class="badge badge-tags bg-secondary-subtle text-secondary-emphasis rounded-pill" :title="'You have ' + allTags.length + ' tags'">{{ allTags.length }}</span>
                  <button v-if="!isCreatingTag" 
                          @click="showTagInput" 
                          class="btn btn-sm btn-outline-primary rounded-pill px-2 py-1 btn-add-tag" 
                          title="Add new tag"
                          aria-label="Add new tag">
                      <i class="bi bi-plus-circle"></i>
                      <span class="ms-1">Add</span>
                  </button>
                </div>
            </div>
            
            <div v-if="isCreatingTag && !sidebarCollapsed" ref="tagInputWrapper" class="input-group input-group-sm mb-2 tag-input-wrapper">
              <input
                  ref="newTagInput"
                  type="text"
                  class="form-control tag-input"
                  placeholder="Tag name..."
                  v-model="localTagName"
                  @keydown.enter.prevent="confirmTagCreation"
                  @keydown.esc.prevent="cancelCreation"
                  maxlength="30"
                  aria-label="Enter tag name">
              <button class="btn btn-outline-success btn-tag-confirm" 
                      @click="confirmTagCreation" 
                      :disabled="!localTagName.trim()"
                      title="Create tag (Enter)">
                  <i class="bi bi-check-lg"></i>
              </button>
              <button class="btn btn-outline-danger btn-tag-cancel" 
                      @click="cancelCreation"
                      title="Cancel (Esc)">
                  <i class="bi bi-x-lg"></i>
              </button>
            </div>

            <div class="tag-list-sidebar flex-fill overflow-auto">
                <div v-for="tag in allTags"
                     :key="tag.id"
                     class="tag-item-wrapper">
                  <a href="#"
                     @click.prevent="$emit('tag-click', tag.id)"
                     class="tag-item d-flex align-items-center justify-content-between rounded-3 transition-all"
                     :class="[{ active: isTagActive(tag) }]"
                     :title="'View notes with tag: ' + tag.name"
                     :aria-current="isTagActive(tag) ? 'page' : false">
                      <div class="d-flex align-items-center flex-fill min-width-0">
                        <span class="tag-color-dot rounded-circle flex-shrink-0 me-2"
                              :style="{ backgroundColor: tag.color }"
                              :aria-label="'Tag color: ' + tag.color"></span>
                        <span class="nav-text flex-fill text-truncate">{{ tag.name }}</span>
                      </div>
                      <button class="btn btn-sm btn-link text-danger btn-delete-tag ms-2 flex-shrink-0"
                              @click="deleteTag(tag.id, $event)"
                              title="Delete tag"
                              aria-label="Delete tag">
                          <i class="bi bi-trash"></i>
                      </button>
                  </a>
                </div>
                <div v-if="allTags.length === 0 && !sidebarCollapsed" class="text-center py-4 text-muted small empty-state">
                    <i class="bi bi-tags d-block mb-2" style="font-size: 1.5rem; opacity: 0.5;"></i>
                    <p class="mb-0">No tags yet.</p>
                </div>
            </div>
        </div>
      </div>

      <div class="sidebar-footer border-top p-3">
          <small class="nav-text d-block text-center text-muted" :class="{ 'd-none': sidebarCollapsed }">© 2025 Notes & Tasks</small>
      </div>
    </nav>
    `,
};