// Main store initialization and configuration
import { useNotesStore } from './notesStore.js';
import { useTagsStore } from './tagsStore.js';
import { useSettingsStore } from './settingsStore.js';

const { createPinia } = window.Pinia;

// Create Pinia instance
export const pinia = createPinia();

// Export stores for easy access
export { useNotesStore, useTagsStore, useSettingsStore };

// Initialize all stores
export async function initializeStores() {
  try {
    console.log('Initializing Pinia stores...');
    
    // Initialize settings first (no async operations)
    const settingsStore = useSettingsStore(pinia);
    settingsStore.initialize();
    
    // Initialize notes and tags stores (with IndexedDB)
    const notesStore = useNotesStore(pinia);
    const tagsStore = useTagsStore(pinia);
    
    await Promise.all([
      notesStore.initialize(),
      tagsStore.initialize()
    ]);
    
    // Sync tags from notes (ensure all tags in notes exist in tags store)
    await tagsStore.syncTagsFromNotes();
    
    console.log('All stores initialized successfully');
    
    return {
      notesStore,
      tagsStore,
      settingsStore,
      pinia
    };
  } catch (error) {
    console.error('Failed to initialize stores:', error);
    throw error;
  }
}

// Helper function to get all stores
export function getStores() {
  return {
    notes: useNotesStore(),
    tags: useTagsStore(),
    settings: useSettingsStore()
  };
}

// Export for global access (useful for debugging and Vue devtools)
if (typeof window !== 'undefined') {
  window.useNotesStore = useNotesStore;
  window.useTagsStore = useTagsStore;
  window.useSettingsStore = useSettingsStore;
  window.getStores = getStores;
}
