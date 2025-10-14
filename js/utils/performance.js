/**
 * Performance monitoring utilities for the AI Journal app
 */

// Performance tracking data
const performanceMarks = new Map();

/**
 * Starts a performance measurement
 * @param {string} name - Name of the operation to measure
 */
function startMeasurement(name) {
  performanceMarks.set(name, {
    start: performance.now(),
    name,
  });
}

/**
 * Ends a performance measurement and logs the result
 * @param {string} name - Name of the operation that was measured
 * @param {boolean} log - Whether to log the result to console
 * @returns {number} Duration in milliseconds
 */
function endMeasurement(name, log = true) {
  const mark = performanceMarks.get(name);
  if (!mark) {
    console.warn(`Performance mark "${name}" not found`);
    return 0;
  }

  const duration = performance.now() - mark.start;
  performanceMarks.delete(name);

  if (log) {
    console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
  }

  return duration;
}

/**
 * Measures the execution time of an async function
 * @param {string} name - Name of the operation
 * @param {Function} fn - Async function to measure
 * @returns {Promise<any>} Result of the function
 */
async function measureAsync(name, fn) {
  startMeasurement(name);
  try {
    const result = await fn();
    endMeasurement(name);
    return result;
  } catch (error) {
    endMeasurement(name);
    throw error;
  }
}

/**
 * Gets performance statistics
 * @returns {Object} Performance data
 */
function getPerformanceStats() {
  return {
    activeMarks: Array.from(performanceMarks.keys()),
    markCount: performanceMarks.size,
  };
}

/**
 * Performance monitoring decorator for functions
 * @param {string} operationName - Name to use for performance tracking
 * @returns {Function} Decorator function
 */
function withPerformanceMonitoring(operationName) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args) {
      const markName = `${operationName}_${propertyKey}`;
      startMeasurement(markName);

      try {
        const result = await originalMethod.apply(this, args);
        endMeasurement(markName);
        return result;
      } catch (error) {
        endMeasurement(markName);
        throw error;
      }
    };

    return descriptor;
  };
}

// Make functions available globally for Vue.js compatibility
window.startMeasurement = startMeasurement;
window.endMeasurement = endMeasurement;
window.measureAsync = measureAsync;
window.getPerformanceStats = getPerformanceStats;
window.withPerformanceMonitoring = withPerformanceMonitoring;
