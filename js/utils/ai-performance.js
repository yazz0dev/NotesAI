/**
 * AI Performance optimization utilities
 * Provides batching, caching, and session management for better AI performance
 */

// Performance tracking
const aiOperationMetrics = {
  totalOperations: 0,
  averageLatency: 0,
  cacheHitRate: 0,
  batchOperations: 0,
};

/**
 * Batches AI operations for better performance
 * @param {Array} operations - Array of operation objects {prompt, id}
 * @param {Object} session - AI session object
 * @param {number} batchSize - Size of each batch (default: 5)
 * @returns {Promise<Map>} Map of id -> result
 */
export async function batchAIOperations(operations, session, batchSize = 5) {
  const results = new Map();
  const startTime = performance.now();
  
  for (let i = 0; i < operations.length; i += batchSize) {
    const batch = operations.slice(i, i + batchSize);
    
    try {
      const batchPromises = batch.map(async (op) => {
        const result = await session.prompt(op.prompt);
        return { id: op.id, result: result.trim() };
      });
      
      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ id, result }) => {
        results.set(id, result);
      });
      
      aiOperationMetrics.batchOperations++;
      
      // Small delay between batches to prevent overwhelming the AI
      if (i + batchSize < operations.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.warn(`Batch ${Math.floor(i / batchSize)} failed:`, error);
      // Continue with next batch
    }
  }
  
  const endTime = performance.now();
  updatePerformanceMetrics(endTime - startTime, operations.length);
  
  return results;
}

/**
 * Creates optimized prompts for better AI performance
 * @param {string} operation - Type of operation (sentiment, topics, etc.)
 * @param {string} content - Content to process
 * @returns {string} Optimized prompt
 */
export function createOptimizedPrompt(operation, content) {
  // Truncate content for better performance while maintaining context
  const maxLength = operation === "sentiment" ? 300 : 200;
  const truncatedContent = content.length > maxLength 
    ? content.substring(0, maxLength) + "..." 
    : content;
  
  switch (operation) {
    case "sentiment":
      return `Sentiment: "${truncatedContent}". JSON: {"sentiment":"positive|negative|neutral","confidence":0.0-1.0,"emoji":"😊|😞|😐"}`;
    
    case "topics":
      return `Topics from: "${truncatedContent}". JSON array: ["topic1","topic2"]`;
    
    case "search":
      return `Relates to query? "${truncatedContent}". YES/NO only.`;
    
    case "summary":
      return `Brief summary: "${truncatedContent}". One sentence.`;
    
    default:
      return content;
  }
}

/**
 * Pre-warms AI session for better first-call performance
 * @param {Object} session - AI session object
 */
export async function prewarmAISession(session) {
  try {
    // Send a small prompt to warm up the session
    await session.prompt("Test prompt for session warmup. Reply 'OK'.");
    console.log("AI session prewarmed successfully");
  } catch (error) {
    console.warn("Session prewarm failed:", error);
  }
}

/**
 * Updates performance metrics
 * @param {number} duration - Operation duration in ms
 * @param {number} operationCount - Number of operations
 */
function updatePerformanceMetrics(duration, operationCount) {
  aiOperationMetrics.totalOperations += operationCount;
  
  // Update average latency using exponential moving average
  const currentAvg = aiOperationMetrics.averageLatency;
  const newLatency = duration / operationCount;
  aiOperationMetrics.averageLatency = currentAvg === 0 
    ? newLatency 
    : currentAvg * 0.7 + newLatency * 0.3;
}

/**
 * Gets current AI performance metrics
 * @returns {Object} Performance metrics
 */
export function getAIPerformanceMetrics() {
  return { ...aiOperationMetrics };
}

/**
 * Resets performance metrics
 */
export function resetAIPerformanceMetrics() {
  aiOperationMetrics.totalOperations = 0;
  aiOperationMetrics.averageLatency = 0;
  aiOperationMetrics.cacheHitRate = 0;
  aiOperationMetrics.batchOperations = 0;
}

/**
 * Optimizes prompt for specific AI model characteristics
 * @param {string} prompt - Original prompt
 * @returns {string} Optimized prompt
 */
export function optimizePromptForModel(prompt) {
  // Remove excessive whitespace and newlines that can slow down processing
  return prompt
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\n\s*\n/g, '\n'); // Compress multiple newlines
}