export default {
    props: ["isDictating", "isSidebarCollapsed", "currentLayout", "sortLabel"],
    emits: ['toggle-sidebar', 'dictate-toggle', 'open-settings', 'open-help', 'search', 'toggle-layout', 'change-sort'],
    methods: {
        // Method to emit the search text on input
        handleSearchInput(event) {
            this.$emit('search', event.target.textContent);
        }
    },
    template: `
      <header class="app-header d-flex flex-column justify-content-center gap-2 py-2">
        <!-- Top Row: Main Header Controls -->
        <div class="d-flex align-items-center px-3">
            <!-- Left Section -->
            <div class="d-flex align-items-center gap-3" style="min-width: 240px;">
                <button
                    class="btn border-0 btn-outline-secondary"
                    title="Toggle Sidebar"
                    @click="$emit('toggle-sidebar')"
                    style="width: 44px; height: 44px; border-radius: 8px;"
                >
                    <i class="bi bi-list fs-5"></i>
                </button>

                <div class="d-flex align-items-center gap-2">
                    <div class="app-logo rounded-3 d-flex align-items-center justify-content-center fw-bold text-white"
                         style="width: 40px; height: 40px; font-size: 1.2rem;">
                        N
                    </div>
                    <h1 class="h5 mb-0 d-none d-md-block fw-semibold">Notes & Tasks</h1>
                </div>
            </div>

            <!-- Center Section (AI Status) -->
            <div class="flex-grow-1 d-flex justify-content-center">
                <slot name="ai-status"></slot>
            </div>

            <!-- Right Section -->
            <div class="d-flex align-items-center gap-2" style="min-width: 240px; justify-content: flex-end;">
                <button
                    :class="['btn d-flex align-items-center gap-2', isDictating ? 'btn-danger' : 'btn-primary']"
                    @click="$emit('dictate-toggle')"
                    style="border-radius: 25px; padding: 8px 16px;"
                >
                    <i :class="['bi', isDictating ? 'bi-stop-circle-fill' : 'bi-mic-fill']"></i>
                    <span class="d-none d-sm-inline">{{ isDictating ? 'Stop' : 'Dictate' }}</span>
                </button>

                <button
                    class="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                    @click="$emit('open-settings')"
                    title="Settings"
                    style="width: 44px; height: 44px; border-radius: 8px;">
                    <i class="bi bi-gear fs-5"></i>
                </button>

                <button
                    class="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                    @click="$emit('open-help')"
                    title="Help"
                    style="width: 44px; height: 44px; border-radius: 8px;">
                    <i class="bi bi-question-circle fs-5"></i>
                </button>
            </div>
        </div>
        
        <!-- Bottom Row: Toolbar Slot -->
        <div class="d-flex justify-content-center w-100">
            <slot name="toolbar"></slot>
        </div>
      </header>
      `,
};