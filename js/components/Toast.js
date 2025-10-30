// js/components/Toast.js
import { toastService } from "../services/toast-service.js";

export default {
  setup() {
    return {
      toasts: toastService.state.toasts,
      removeToast: toastService.removeToast,
    };
  },

  methods: {
    getToastIcon(type) {
      switch (type) {
        case 'success':
          return 'bi bi-check-circle-fill';
        case 'error':
        case 'danger':
          return 'bi bi-exclamation-circle-fill';
        case 'warning':
          return 'bi bi-exclamation-triangle-fill';
        case 'info':
        default:
          return 'bi bi-info-circle';
      }
    },

    getToastClass(type) {
      return `toast-${type}`;
    },

    handleDismiss(toastId) {
      this.removeToast(toastId);
    },
  },

  template: `
    <div class="toast-container">
      <transition-group name="toast-slide" tag="div">
        <div 
          v-for="toast in toasts" 
          :key="toast.id"
          :class="['toast-item', getToastClass(toast.type)]"
          role="alert"
          aria-live="polite"
          :aria-label="toast.title"
        >
          <!-- Toast Icon -->
          <div class="toast-icon-wrapper">
            <i :class="getToastIcon(toast.type)" class="toast-icon"></i>
          </div>

          <!-- Toast Content -->
          <div class="toast-content">
            <div class="toast-title">{{ toast.title }}</div>
            <div v-if="toast.message" class="toast-message">{{ toast.message }}</div>
          </div>

          <!-- Close Button -->
          <button 
            type="button" 
            class="toast-close" 
            @click="handleDismiss(toast.id)"
            aria-label="Close notification"
          >
            <i class="bi bi-x-lg"></i>
          </button>

          <!-- Progress Bar (for auto-dismiss) -->
          <div v-if="toast.autoClose" class="toast-progress" :style="{ animationDuration: toast.duration + 'ms' }"></div>
        </div>
      </transition-group>
    </div>
  `,
};
