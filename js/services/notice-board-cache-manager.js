/**
 * Notice Board Cache Management Utilities
 * Helper functions for managing and monitoring notice board cache
 */

import { noticeBoardCacheService } from "./notice-board-cache-service.js";

class NoticeBoardCacheManager {
  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  static async getStats() {
    try {
      const allCached = await noticeBoardCacheService.getAll();
      const now = Date.now();

      const stats = {
        totalCached: allCached.length,
        validCaches: 0,
        expiredCaches: 0,
        totalSize: 0,
        views: {}
      };

      for (const cache of allCached) {
        const isExpired = cache.expiresAt && cache.expiresAt < now;
        
        if (isExpired) {
          stats.expiredCaches++;
        } else {
          stats.validCaches++;
        }

        // Calculate size
        const cacheSize = JSON.stringify(cache).length;
        stats.totalSize += cacheSize;

        stats.views[cache.viewId] = {
          size: cacheSize,
          cached: new Date(cache.timestamp),
          expires: new Date(cache.expiresAt),
          isExpired: isExpired,
          signatureLength: cache.notesSignature.length
        };
      }

      stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Clear expired caches
   * @returns {Promise<number>} Number of cleared caches
   */
  static async clearExpired() {
    try {
      const allCached = await noticeBoardCacheService.getAll();
      const now = Date.now();
      let clearedCount = 0;

      for (const cache of allCached) {
        if (cache.expiresAt && cache.expiresAt < now) {
          await noticeBoardCacheService.deleteCached(cache.viewId);
          clearedCount++;
        }
      }

      console.log(`Cleared ${clearedCount} expired notice board caches`);
      return clearedCount;
    } catch (error) {
      console.error('Error clearing expired caches:', error);
      return 0;
    }
  }

  /**
   * Export cache data for debugging
   * @returns {Promise<string>} JSON string of all caches
   */
  static async exportCacheData() {
    try {
      const allCached = await noticeBoardCacheService.getAll();
      return JSON.stringify(allCached, null, 2);
    } catch (error) {
      console.error('Error exporting cache data:', error);
      return null;
    }
  }

  /**
   * Print cache statistics to console
   * @returns {Promise<void>}
   */
  static async printStats() {
    try {
      const stats = await this.getStats();
      if (!stats) {
        console.log('Failed to get cache statistics');
        return;
      }

      console.log('=== Notice Board Cache Statistics ===');
      console.log(`Total Cached Views: ${stats.totalCached}`);
      console.log(`Valid Caches: ${stats.validCaches}`);
      console.log(`Expired Caches: ${stats.expiredCaches}`);
      console.log(`Total Storage: ${stats.totalSizeKB} KB`);
      console.log('\n--- Cache Details ---');

      for (const [viewId, details] of Object.entries(stats.views)) {
        console.log(`\nView: ${viewId}`);
        console.log(`  Size: ${(details.size / 1024).toFixed(2)} KB`);
        console.log(`  Cached: ${details.cached.toLocaleString()}`);
        console.log(`  Expires: ${details.expires.toLocaleString()}`);
        console.log(`  Status: ${details.isExpired ? '❌ Expired' : '✅ Valid'}`);
        console.log(`  Signature Length: ${details.signatureLength}`);
      }

      console.log('\n======================================');
    } catch (error) {
      console.error('Error printing stats:', error);
    }
  }

  /**
   * Monitor cache performance (call periodically)
   * @returns {Promise<Object>}
   */
  static async getPerformanceMetrics() {
    try {
      const stats = await this.getStats();
      if (!stats) return null;

      const hitRate = stats.totalCached > 0 
        ? ((stats.validCaches / stats.totalCached) * 100).toFixed(2)
        : 0;

      const metrics = {
        cacheHitRate: `${hitRate}%`,
        cachedViews: stats.validCaches,
        totalStorage: `${stats.totalSizeKB} KB`,
        timestamp: new Date().toISOString(),
        estTimeSaved: stats.validCaches * 2.5 // Estimated 2.5 seconds per cache hit
      };

      return metrics;
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      return null;
    }
  }

  /**
   * Initialize global console helper
   * Exposes cache management functions to window.noticeBoardCacheDebug
   */
  static initializeDebugTools() {
    window.noticeBoardCacheDebug = {
      stats: () => this.getStats(),
      printStats: () => this.printStats(),
      clearExpired: () => this.clearExpired(),
      clearAll: () => noticeBoardCacheService.clearAll(),
      export: () => this.exportCacheData(),
      metrics: () => this.getPerformanceMetrics(),
      service: noticeBoardCacheService
    };

    console.log('Notice Board Cache Debug Tools loaded.');
    console.log('Usage: window.noticeBoardCacheDebug.printStats()');
  }
}

// Auto-initialize debug tools in development
if (process.env.NODE_ENV !== 'production' || localStorage.getItem('DEBUG_NOTICE_BOARD')) {
  NoticeBoardCacheManager.initializeDebugTools();
}

export default NoticeBoardCacheManager;
export { NoticeBoardCacheManager };
