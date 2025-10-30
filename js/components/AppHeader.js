/**
 * AppHeader Component
 *
 * Main application header providing navigation, search, and control buttons.
 * Features include sidebar toggle, voice control, settings access, and help.
 */
export default {
    name: 'AppHeader',

    // ============================================
    // PROPS
    // ============================================
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

    // ============================================
    // EVENTS
    // ============================================
    emits: [
        'toggle-sidebar',
        'voice-toggle',
        'open-settings',
        'open-help',
        'search',
        'toggle-layout',
        'change-sort'
    ],

    // ============================================
    // COMPUTED PROPERTIES
    // ============================================
    computed: {
        voiceControlButtonClass() {
            return this.isVoiceActive ? 'btn-header-voice btn-danger' : 'btn-header-voice btn-primary';
        },

        voiceControlButtonAriaLabel() {
            return this.isVoiceActive ? 'Stop voice control' : 'Start voice control';
        },

        voiceControlButtonText() {
            return this.isVoiceActive ? 'Stop' : 'Voice Control';
        },

        voiceControlButtonIconClass() {
            return [
                'bi',
                this.isVoiceActive ? 'bi-stop-circle-fill' : 'bi-mic-fill'
            ];
        }
    },

    // ============================================
    // TEMPLATE
    // ============================================
    template: `
      <header class="app-header px-3 py-2" role="banner">
        <!-- Left Section: Logo and Navigation -->
        <nav class="header-left d-flex align-items-center gap-2" aria-label="Main navigation">
            <button
                class="btn-header-toggle"
                aria-label="Toggle sidebar"
                title="Toggle Sidebar (Ctrl+\\)"
                @click="$emit('toggle-sidebar')"
                @keydown.enter="$emit('toggle-sidebar')"
                @keydown.space.prevent="$emit('toggle-sidebar')"
            >
                <i class="bi bi-list fs-5" aria-hidden="true"></i>
            </button>

            <div class="app-title-section">
                <h1 class="app-title">Notes & Tasks</h1>
            </div>
        </nav>

        <!-- Center Section: Toolbar and AI Status -->
        <div class="header-center flex-grow-1 d-flex flex-column align-items-center justify-content-center">
            <slot name="toolbar"></slot>
            <slot name="ai-status"></slot>
        </div>

        <!-- Right Section: Application Controls -->
        <nav class="header-right d-flex align-items-center gap-2 flex-shrink-0" aria-label="Application controls">
            <button
                :class="voiceControlButtonClass"
                :aria-label="voiceControlButtonAriaLabel"
                @click="$emit('voice-toggle')"
                @keydown.enter="$emit('voice-toggle')"
                @keydown.space.prevent="$emit('voice-toggle')"
                title="Voice Control (V)"
            >
                <i :class="voiceControlButtonIconClass" aria-hidden="true"></i>
                <span class="d-none d-sm-inline">{{ voiceControlButtonText }}</span>
            </button>

            <button
                class="btn-header-icon"
                aria-label="Open settings"
                title="Settings (Ctrl+,)"
                @click="$emit('open-settings')"
                @keydown.enter="$emit('open-settings')"
                @keydown.space.prevent="$emit('open-settings')">
                <i class="bi bi-gear fs-5" aria-hidden="true"></i>
            </button>

            <button
                class="btn-header-icon"
                aria-label="Open help"
                title="Help (F1)"
                @click="$emit('open-help')"
                @keydown.enter="$emit('open-help')"
                @keydown.space.prevent="$emit('open-help')">
                <i class="bi bi-question-circle fs-5" aria-hidden="true"></i>
            </button>
        </nav>
      </header>
    `
};