// js/ai-insights.js
// AI-powered insights for journal entries including sentiment analysis and topic modeling

// Track if we've already logged Chrome AI availability warnings
let chromeAIWarningLogged = false;

/**
 * Analyzes the sentiment of a journal entry using Chrome AI
 * @param {string} content - The journal entry content (HTML)
 * @returns {Promise<Object>} Sentiment analysis result
 */
export async function analyzeSentiment(content) {
    try {
        // Strip HTML tags for better analysis
        const textContent = content.replace(/<[^>]*>/g, '').trim();
        
        if (!textContent) {
            return { sentiment: 'neutral', confidence: 0, emoji: '😐' };
        }

        // Check if Chrome AI is available
        if (!chrome?.ai?.prompt) {
            if (!chromeAIWarningLogged) {
                console.info("Chrome AI API not available - using fallback sentiment analysis");
                chromeAIWarningLogged = true;
            }
            return { sentiment: 'neutral', confidence: 0, emoji: '😐' };
        }

        const sentimentPrompt = `
            Analyze the emotional sentiment of this journal entry and respond with ONLY a JSON object:
            
            "${textContent}"
            
            Response format: {"sentiment": "positive|negative|neutral", "confidence": 0.0-1.0, "emoji": "😊|😞|😐", "keywords": ["word1", "word2"]}
            
            Guidelines:
            - positive: optimistic, happy, grateful, excited, accomplished
            - negative: sad, frustrated, worried, angry, disappointed  
            - neutral: factual, routine, balanced, reflective
            - confidence: how certain you are (0.0-1.0)
            - emoji: single emoji that best represents the sentiment
            - keywords: 2-4 key emotional words from the text
        `;

        const result = await chrome.ai.prompt({ prompt: sentimentPrompt });
        const analysis = JSON.parse(result.text.trim());
        
        // Validate and set defaults
        return {
            sentiment: ['positive', 'negative', 'neutral'].includes(analysis.sentiment) ? analysis.sentiment : 'neutral',
            confidence: Math.max(0, Math.min(1, analysis.confidence || 0.5)),
            emoji: analysis.emoji || '😐',
            keywords: Array.isArray(analysis.keywords) ? analysis.keywords.slice(0, 4) : []
        };

    } catch (error) {
        console.error("Error analyzing sentiment:", error);
        return { sentiment: 'neutral', confidence: 0, emoji: '😐', keywords: [] };
    }
}

/**
 * Extracts topics and themes from a journal entry
 * @param {string} content - The journal entry content (HTML)
 * @returns {Promise<Array>} Array of detected topics/tags
 */
export async function extractTopics(content) {
    try {
        // Strip HTML tags for better analysis
        const textContent = content.replace(/<[^>]*>/g, '').trim();
        
        if (!textContent) {
            return [];
        }

        // Check if Chrome AI is available
        if (!chrome?.ai?.prompt) {
            if (!chromeAIWarningLogged) {
                console.info("Chrome AI API not available - using fallback topic extraction");
                chromeAIWarningLogged = true;
            }
            return [];
        }

        const topicPrompt = `
            Analyze this journal entry and extract the main topics/themes. Return ONLY a JSON array of strings:
            
            "${textContent}"
            
            Response format: ["topic1", "topic2", "topic3"]
            
            Guidelines:
            - Extract 2-5 main topics/themes
            - Use simple, lowercase terms
            - Focus on: activities, emotions, people, places, events, goals
            - Examples: "work", "family", "health", "travel", "learning", "relationships"
            - Avoid generic terms like "life" or "thoughts"
        `;

        const result = await chrome.ai.prompt({ prompt: topicPrompt });
        const topics = JSON.parse(result.text.trim());
        
        // Validate and filter
        return Array.isArray(topics) 
            ? topics.filter(topic => typeof topic === 'string' && topic.length > 0).slice(0, 5)
            : [];

    } catch (error) {
        console.error("Error extracting topics:", error);
        return [];
    }
}

/**
 * Analyzes multiple entries to find thematic connections
 * @param {Array} entries - Array of journal entries
 * @param {Object} targetEntry - The entry to find connections for
 * @returns {Promise<Array>} Array of related entries
 */
export async function findThematicConnections(entries, targetEntry) {
    try {
        if (!chrome?.ai?.prompt || !entries.length) {
            return [];
        }

        // Get target entry topics
        const targetTopics = await extractTopics(targetEntry.content);
        if (targetTopics.length === 0) {
            return [];
        }

        // Score entries based on topic overlap and semantic similarity
        const connections = [];
        
        for (const entry of entries) {
            if (entry.id === targetEntry.id) continue;
            
            const entryTopics = await extractTopics(entry.content);
            const commonTopics = targetTopics.filter(topic => 
                entryTopics.some(entryTopic => 
                    entryTopic.includes(topic) || topic.includes(entryTopic)
                )
            );
            
            if (commonTopics.length > 0) {
                connections.push({
                    entry,
                    score: commonTopics.length / Math.min(targetTopics.length, entryTopics.length),
                    commonTopics
                });
            }
        }

        // Sort by relevance score and return top matches
        return connections
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(conn => conn.entry);

    } catch (error) {
        console.error("Error finding thematic connections:", error);
        return [];
    }
}

/**
 * Generates mood insights from recent entries
 * @param {Array} recentEntries - Recent journal entries (last 30 days)
 * @returns {Promise<Object>} Mood pattern insights
 */
export async function generateMoodInsights(recentEntries) {
    try {
        if (!chrome?.ai?.prompt || recentEntries.length === 0) {
            return { pattern: 'insufficient_data', summary: 'Not enough data for mood analysis' };
        }

        // Analyze sentiment for all recent entries
        const sentimentPromises = recentEntries.map(entry => 
            analyzeSentiment(entry.content).then(sentiment => ({
                ...sentiment,
                date: entry.createdAt
            }))
        );
        
        const sentiments = await Promise.all(sentimentPromises);
        
        // Calculate mood distribution
        const moodCounts = sentiments.reduce((acc, s) => {
            acc[s.sentiment] = (acc[s.sentiment] || 0) + 1;
            return acc;
        }, {});
        
        const totalEntries = sentiments.length;
        const positiveRatio = (moodCounts.positive || 0) / totalEntries;
        const negativeRatio = (moodCounts.negative || 0) / totalEntries;
        
        // Generate insights
        let pattern = 'balanced';
        if (positiveRatio > 0.6) pattern = 'mostly_positive';
        else if (negativeRatio > 0.6) pattern = 'mostly_negative';
        else if (positiveRatio > negativeRatio * 1.5) pattern = 'leaning_positive';
        else if (negativeRatio > positiveRatio * 1.5) pattern = 'leaning_negative';

        const summaryPrompt = `
            Based on ${totalEntries} journal entries with ${Math.round(positiveRatio * 100)}% positive, ${Math.round(negativeRatio * 100)}% negative, and ${Math.round((1 - positiveRatio - negativeRatio) * 100)}% neutral sentiments, write a brief, encouraging insight about the person's recent mood patterns. Keep it under 50 words and be supportive.
        `;

        const summaryResult = await chrome.ai.prompt({ prompt: summaryPrompt });
        
        return {
            pattern,
            summary: summaryResult.text.trim(),
            distribution: moodCounts,
            totalEntries,
            dominantEmoji: sentiments.length > 0 ? 
                Object.entries(moodCounts).reduce((a, b) => moodCounts[a[0]] > moodCounts[b[0]] ? a : b)[0] === 'positive' ? '😊' :
                Object.entries(moodCounts).reduce((a, b) => moodCounts[a[0]] > moodCounts[b[0]] ? a : b)[0] === 'negative' ? '😞' : '😐' : '😐'
        };

    } catch (error) {
        console.error("Error generating mood insights:", error);
        return { pattern: 'error', summary: 'Unable to analyze mood patterns' };
    }
}

/**
 * Extracts the first image from a journal entry's HTML content
 * @param {string} htmlContent - The HTML content of the journal entry
 * @returns {string|null} The src of the first image, or null if no images found
 */
export function extractFirstImage(htmlContent) {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const firstImage = doc.querySelector('img');
        return firstImage ? firstImage.src : null;
    } catch (error) {
        console.error("Error extracting image:", error);
        return null;
    }
}
