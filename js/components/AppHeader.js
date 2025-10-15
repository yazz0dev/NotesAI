export default {
    props: ["isDictating", "isSidebarCollapsed"],
    template: `
      <header class="app-header border-bottom shadow-sm d-flex justify-content-between align-items-center px-3 py-2">
          <div class="d-flex align-items-center gap-3">
              <!-- Hamburger Menu Button - Always visible -->
              <button
                  class="btn border-0"
                  :class="isSidebarCollapsed ? 'btn-primary' : 'btn-outline-secondary'"
                  title="Toggle Sidebar"
                  @click="$emit('toggle-sidebar')"
                  style="width: 44px; height: 44px; border-radius: 8px; transition: all 0.3s ease;"
              >
                  <i :class="['bi fs-5', isSidebarCollapsed ? 'bi-chevron-right' : 'bi-list']"></i>
              </button>

              <div class="d-flex align-items-center gap-2">
                  <div class="app-logo rounded-3 d-flex align-items-center justify-content-center fw-bold text-white"
                       style="width: 40px; height: 40px; font-size: 1.2rem;">
                      N
                  </div>
                  <h1 class="h5 mb-0 d-none d-md-block fw-semibold">Notes & Tasks</h1>
              </div>
          </div>

          <div class="ai-status-container d-flex align-items-center">
            <slot name="ai-status"></slot>
          </div>

          <div class="d-flex align-items-center gap-2">
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
      </header>
      `,
  };