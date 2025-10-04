// js/components/index.js
// Main components export file

// Re-export all component functions for easy importing
export * from "./header.js";
export * from "./modals.js";

// Initialize all components
export function initComponents() {
  import("./modals.js").then(({ initModals }) => initModals());
}
