// Pinia persistence plugin for IndexedDB
export function createIndexedDBPlugin(dbName = 'PiniaDB', storeName = 'store') {
  return ({ store }) => {
    const dbPromise = openDB(dbName, storeName);

    // Load initial state from IndexedDB
    dbPromise.then(async (db) => {
      const savedState = await getFromDB(db, storeName, store.$id);
      if (savedState) {
        store.$patch(savedState);
      }
    });

    // Subscribe to store changes and persist to IndexedDB
    store.$subscribe((mutation, state) => {
      dbPromise.then((db) => {
        saveToDB(db, storeName, store.$id, state);
      });
    });
  };
}

// Helper functions for IndexedDB operations
function openDB(dbName, storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName);
      }
    };
  });
}

function getFromDB(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function saveToDB(db, storeName, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// LocalStorage persistence plugin (for settings)
export function createLocalStoragePlugin(key = 'pinia-state') {
  return ({ store }) => {
    // Load initial state from localStorage
    const savedState = localStorage.getItem(`${key}-${store.$id}`);
    if (savedState) {
      try {
        store.$patch(JSON.parse(savedState));
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }

    // Subscribe to store changes and persist to localStorage
    store.$subscribe((mutation, state) => {
      try {
        localStorage.setItem(`${key}-${store.$id}`, JSON.stringify(state));
      } catch (e) {
        console.error('Failed to save state:', e);
      }
    });
  };
}
