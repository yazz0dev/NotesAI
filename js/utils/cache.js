/**
 * Enhanced cache utility for AI API results
 * Provides aggressive caching and performance optimizations for AI operations
 */

// In-memory cache with TTL (Time To Live) - increased for better performance
const cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // Increased to 60 minutes for better performance
const MAX_CACHE_SIZE = 500; // Prevent memory bloat

// Cache performance metrics
let cacheHits = 0;
let cacheMisses = 0;

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
function getCachedResult(operation, content, options = {}) {
  const key = generateCacheKey(operation, content, options);
  const cached = cache.get(key);

  if (!cached) {
    cacheMisses++;
    return null;
  }

  // Check if expired
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    cache.delete(key);
    cacheMisses++;
    return null;
  }

  cacheHits++;
  // Update access time for LRU-style eviction
  cached.lastAccessed = Date.now();
  return cached.result;
}

/**
 * Caches a result with timestamp and manages cache size
 * @param {string} operation - The operation type
 * @param {string} content - The content
 * @param {Object} options - Additional options
 * @param {any} result - The result to cache
 */
function setCachedResult(operation, content, options, result) {
  const key = generateCacheKey(operation, content, options);
  
  // Manage cache size to prevent memory bloat
  if (cache.size >= MAX_CACHE_SIZE) {
    evictOldestEntries(Math.floor(MAX_CACHE_SIZE * 0.2)); // Remove 20% of entries
  }
  
  cache.set(key, {
    result,
    timestamp: Date.now(),
    lastAccessed: Date.now(),
  });
}

/**
 * Evicts oldest cache entries based on last access time
 * @param {number} count - Number of entries to evict
 */
function evictOldestEntries(count) {
  const entries = Array.from(cache.entries())
    .map(([key, value]) => ({ key, lastAccessed: value.lastAccessed || value.timestamp }))
    .sort((a, b) => a.lastAccessed - b.lastAccessed);
  
  for (let i = 0; i < Math.min(count, entries.length); i++) {
    cache.delete(entries[i].key);
  }
}

/**
 * Clears all cached results
 */
function clearCache() {
  cache.clear();
}

/**
 * Gets enhanced cache statistics including performance metrics
 * @returns {Object} Cache info with performance data
 */
function getCacheStats() {
  const totalRequests = cacheHits + cacheMisses;
  return {
    size: cache.size,
    maxSize: MAX_CACHE_SIZE,
    ttl: CACHE_TTL,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: totalRequests > 0 ? (cacheHits / totalRequests * 100).toFixed(2) + '%' : '0%',
    totalRequests,
  };
}

/**
 * Clears cache performance metrics
 */
function resetCacheMetrics() {
  cacheHits = 0;
  cacheMisses = 0;
}

// Make functions available globally for Vue.js compatibility
window.generateCacheKey = generateCacheKey;
window.getCachedResult = getCachedResult;
window.setCachedResult = setCachedResult;
window.clearCache = clearCache;
window.getCacheStats = getCacheStats;
window.resetCacheMetrics = resetCacheMetrics;