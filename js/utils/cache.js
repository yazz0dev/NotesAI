/**
 * Simple cache utility for AI API results
 * Helps avoid repeated expensive API calls for the same content
 */

// In-memory cache with TTL (Time To Live)
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Generates a cache key for content-based operations
 * @param {string} operation - The operation type (e.g., 'topics', 'summarize', 'prompt')
 * @param {string} content - The content being processed
 * @param {Object} options - Additional options that affect the result
 * @returns {string} Cache key
 */
function generateCacheKey(operation, content, options = {}) {
  const contentHash = btoa(content.slice(0, 100)).slice(0, 10); // Simple hash of first 100 chars
  const optionsStr = JSON.stringify(options);
  return `${operation}:${contentHash}:${optionsStr}`;
}

/**
 * Gets cached result if available and not expired
 * @param {string} operation - The operation type
 * @param {string} content - The content
 * @param {Object} options - Additional options
 * @returns {any|null} Cached result or null if not found/expired
 */
export function getCachedResult(operation, content, options = {}) {
  const key = generateCacheKey(operation, content, options);
  const cached = cache.get(key);

  if (!cached) return null;

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return cached.result;
}

/**
 * Caches a result with timestamp
 * @param {string} operation - The operation type
 * @param {string} content - The content
 * @param {Object} options - Additional options
 * @param {any} result - The result to cache
 */
export function setCachedResult(operation, content, options, result) {
  const key = generateCacheKey(operation, content, options);
  cache.set(key, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Clears all cached results
 */
export function clearCache() {
  cache.clear();
}

/**
 * Gets cache statistics
 * @returns {Object} Cache info
 */
export function getCacheStats() {
  return {
    size: cache.size,
    maxSize: CACHE_TTL,
  };
}
