// js/components/AlertModal.js
import { alertService } from "../services/alert-service.js";

export default {
  setup() {
    // Expose the service's state and methods to the template
    return {
      alertState: alertService.state,
      handleConfirm: alertService.handleConfirm,
      handleCancel: alertService.handleCancel,
    };
  },
  mounted() {
    // Focus the input field when it's an input dialog
    this.$nextTick(() => {
      if (this.alertState.showInput && this.$refs.inputField) {
        this.$refs.inputField.focus();
      }
    });

    // Add escape key listener
    document.addEventListener('keydown', this.handleKeydown);
  },

  beforeUnmount() {
    // Clean up event listener
    document.removeEventListener('keydown', this.handleKeydown);
  },

  watch: {
    'alertState.isVisible'(newVal) {
      if (newVal && this.alertState.showInput) {
        this.$nextTick(() => {
          if (this.$refs.inputField) {
            this.$refs.inputField.focus();
          }
        });
      }
    }
  },

  methods: {
    handleKeydown(event) {
      if (event.key === 'Escape' && this.alertState.isVisible) {
        // For error-only mode, don't allow escape to dismiss
        if (this.alertState.errorOnly) {
          return;
        }
        this.handleCancel();
      }
    },

    getModalIcon() {
      const type = this.alertState.type || 'info';

      switch (type) {
        case 'success':
          return 'bi bi-check-circle-fill text-success';
        case 'error':
        case 'danger':
          return 'bi bi-exclamation-triangle-fill text-danger';
        case 'warning':
          return 'bi bi-exclamation-circle-fill text-warning';
        case 'info':
        default:
          return 'bi bi-info-circle-fill text-primary';
      }
    },

    getModalIconBackground() {
      const type = this.alertState.type || 'info';
      switch (type) {
        case 'success':
          return 'rgba(16, 185, 129, 0.1)';
        case 'error':
        case 'danger':
          return 'rgba(239, 68, 68, 0.1)';
        case 'warning':
          return 'rgba(245, 158, 11, 0.1)';
        case 'info':
        default:
          return 'rgba(59, 130, 246, 0.1)';
      }
    },

    getConfirmButtonClass() {
      if (this.alertState.showInput) {
        return 'btn-primary';
      }

      const type = this.alertState.type || 'info';
      switch (type) {
        case 'danger':
          return 'btn-danger';
        case 'warning':
          return 'btn-warning';
        case 'success':
          return 'btn-success';
        default:
          return 'btn-primary';
      }
    },

    shouldShowButtons() {
      // Hide buttons for error-only mode
      if (this.alertState.errorOnly) {
        return false;
      }
      // Hide footer if neither confirm nor cancel text is set
      return this.alertState.confirmText || this.alertState.cancelText;
    }
  },
  template: `
    <!-- Enhanced Alert Modal with improved animations and styling -->
    <div v-if="alertState.isVisible"
         class="modal-backdrop-enhanced"
         :class="{ 'modal-backdrop-lock': alertState.errorOnly }"
         @click.self="!alertState.errorOnly && handleCancel()"
         role="dialog"
         aria-modal="true"
         :aria-labelledby="'modal-title-' + alertState.type">

      <div class="modal-enhanced"
           :class="{ 'modal-shake': alertState.shake, 'modal-error-only': alertState.errorOnly }">

        <!-- Modal Header -->
        <div class="modal-header-enhanced">
          <div class="modal-icon-container" 
               :style="{ backgroundColor: getModalIconBackground() }">
            <i :class="getModalIcon()" class="modal-icon"></i>
          </div>
          <div class="modal-title-container">
            <h5 class="modal-title-enhanced" :id="'modal-title-' + alertState.type">{{ alertState.title }}</h5>
            <button v-if="!alertState.errorOnly"
                    type="button"
                    class="btn-close-enhanced"
                    @click="handleCancel"
                    aria-label="Close modal">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="modal-body-enhanced">
          <div class="modal-message-container">
            <!-- Using v-html to allow formatted help text -->
            <div class="modal-message" v-html="alertState.message"></div>
          </div>

          <!-- Enhanced Input Field -->
          <div v-if="alertState.showInput" class="input-container-enhanced">
            <div class="input-wrapper">
              <input
                v-model="alertState.inputValue"
                :type="alertState.inputType"
                :placeholder="alertState.inputPlaceholder"
                class="form-control-enhanced"
                @keyup.enter="handleConfirm"
                @keyup.esc="!alertState.errorOnly && handleCancel()"
                ref="inputField"
                :class="{ 'input-error': alertState.inputError }"
                aria-describedby="input-error-message"
              >
              <div v-if="alertState.inputError" class="input-error-message" id="input-error-message">
                <i class="bi bi-exclamation-triangle me-1"></i>
                {{ alertState.inputError }}
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div v-if="shouldShowButtons()" class="modal-footer-enhanced">
          <button v-if="alertState.cancelText"
                  type="button"
                  class="btn-enhanced btn-cancel-enhanced"
                  @click="handleCancel"
                  :disabled="alertState.loading"
                  aria-label="Cancel">
            <span v-if="alertState.loading && !alertState.showInput" class="spinner me-2"></span>
            {{ alertState.cancelText }}
          </button>

          <button type="button"
                  class="btn-enhanced btn-confirm-enhanced"
                  :class="getConfirmButtonClass()"
                  @click="handleConfirm"
                  :disabled="alertState.loading || (alertState.showInput && !alertState.inputValue.trim())"
                  :aria-label="'Confirm: ' + alertState.confirmText">
            <span v-if="alertState.loading && !alertState.showInput" class="spinner me-2"></span>
            {{ alertState.confirmText }}
          </button>
        </div>
      </div>
    </div>
  `,
};