// js/components/index.js
// Main components export file

// Re-export all component functions for easy importing
export * from './calendar-header.js';
export * from './bookshelf.js';
export * from './book-viewer.js';
export * from './modals.js';
export * from './prompts.js';

// Initialize all components
export function initComponents() {
    // Import and initialize each component
    import('./book-viewer.js').then(({ initBookViewer }) => initBookViewer());
    import('./modals.js').then(({ initModals }) => initModals());
    import('./prompts.js').then(({ initPrompts }) => initPrompts());
}
