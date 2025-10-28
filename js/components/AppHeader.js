/**
 * AppHeader Component
 *
 * Main application header providing navigation, search, and control buttons.
 * Features include sidebar toggle, voice control, settings access, and help.
 */
export default {
    // Props with validation and defaults
    props: {
        isVoiceActive: {
            type: Boolean,
            default: false
        },
        isSidebarCollapsed: {
            type: Boolean,
            default: false
        },
        currentLayout: {
            type: String,
            default: 'grid',
            validator: value => ['grid', 'list'].includes(value)
        },
        sortLabel: {
            type: String,
            default: 'Updated'
        }
    },

    // Events emitted by this component
    emits: ['toggle-sidebar', 'voice-toggle', 'open-settings', 'open-help', 'search', 'toggle-layout', 'change-sort'],

    // Computed properties for dynamic template values
    computed: {
        voiceControlButtonClass() {
            return ['btn d-flex align-items-center gap-2', this.isVoiceActive ? 'btn-danger' : 'btn-primary'];
        },
        voiceControlButtonAriaLabel() {
            return this.isVoiceActive ? 'Stop voice control' : 'Start voice control';
        },
        voiceControlButtonText() {
            return this.isVoiceActive ? 'Stop' : 'Voice Control';
        },
        voiceControlButtonIconClass() {
            return ['bi', this.isVoiceActive ? 'bi-stop-circle-fill' : 'bi-mic-fill'];
        }
    },

    // Component template with semantic HTML and accessibility features
    template: `
      <header class="app-header align-items-center px-3 py-2" role="banner">
        <!-- Left Section - Logo and sidebar toggle -->
        <nav class="d-flex align-items-center gap-3" aria-label="Main navigation">
            <button
                class="btn border-0 btn-outline-secondary"
                aria-label="Toggle sidebar"
                title="Toggle Sidebar"
                @click="$emit('toggle-sidebar')"
                @keydown.enter="$emit('toggle-sidebar')"
                @keydown.space.prevent="$emit('toggle-sidebar')"
                style="width: 44px; height: 44px; border-radius: 8px;"
            >
                <i class="bi bi-list fs-5" aria-hidden="true"></i>
            </button>

            <div class="d-flex align-items-center gap-2">
                <div class="app-logo rounded-3 d-flex align-items-center justify-content-center fw-bold text-white"
                     style="width: 40px; height: 40px; font-size: 1.2rem;">
                    N
                </div>
                <h1 class="h5 mb-0 d-none d-md-block fw-semibold text-nowrap">Notes & Tasks</h1>
            </div>
        </nav>

        <!-- Center Section - Toolbar and AI status (expands to fill space) -->
        <div class="flex-grow-1 px-4 d-flex flex-column align-items-center">
            <slot name="toolbar"></slot>
            <!-- 
              KEY FIX: This slot was accidentally removed in the previous version. 
              This is where the content from index.html (the ai-status-container div) is rendered.
              Restoring it fixes the missing text issue.
            -->
            <slot name="ai-status"></slot>
        </div>

        <!-- Right Section - Application controls -->
        <nav class="d-flex align-items-center gap-2 justify-content-end" aria-label="Application controls">
            <button
                :class="voiceControlButtonClass"
                :aria-label="voiceControlButtonAriaLabel"
                @click="$emit('voice-toggle')"
                @keydown.enter="$emit('voice-toggle')"
                @keydown.space.prevent="$emit('voice-toggle')"
                style="border-radius: 25px; padding: 8px 16px;"
            >
                <i :class="voiceControlButtonIconClass" aria-hidden="true"></i>
                <span class="d-none d-sm-inline">{{ voiceControlButtonText }}</span>
            </button>

            <button
                class="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                aria-label="Open settings"
                @click="$emit('open-settings')"
                @keydown.enter="$emit('open-settings')"
                @keydown.space.prevent="$emit('open-settings')"
                title="Settings"
                style="width: 44px; height: 44px; border-radius: 8px;">
                <i class="bi bi-gear fs-5" aria-hidden="true"></i>
            </button>

            <button
                class="btn btn-outline-secondary d-flex align-items-center justify-content-center"
                aria-label="Open help"
                @click="$emit('open-help')"
                @keydown.enter="$emit('open-help')"
                @keydown.space.prevent="$emit('open-help')"
                title="Help"
                style="width: 44px; height: 44px; border-radius: 8px;">
                <i class="bi bi-question-circle fs-5" aria-hidden="true"></i>
            </button>
        </nav>
      </header>
      `,
};