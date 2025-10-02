// js/virtual-scrolling.js
// Virtual scrolling implementation for large journal collections

import { withErrorHandling, ERROR_TYPES, ERROR_SEVERITY } from './error-handler.js';

/**
 * Virtual scrolling manager for efficient rendering of large lists
 */
export class VirtualScrollManager {
    constructor(options = {}) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 200; // Default card height
        this.bufferSize = options.bufferSize || 5; // Items to render outside viewport
        this.threshold = options.threshold || 50; // Minimum items to enable virtual scrolling
        
        this.items = [];
        this.visibleItems = [];
        this.startIndex = 0;
        this.endIndex = 0;
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.totalHeight = 0;
        
        this.renderItem = options.renderItem || this.defaultRenderItem;
        this.onScroll = this.onScroll.bind(this);
        this.onResize = this.onResize.bind(this);
        
        this.isEnabled = false;
        this.isInitialized = false;
        
        // Performance tracking
        this.renderCount = 0;
        this.lastRenderTime = 0;
    }

    /**
     * Initializes virtual scrolling
     * @param {Array} items - Items to virtualize
     */
    async initialize(items = []) {
        return withErrorHandling(
            async () => {
                if (!this.container) {
                    throw new Error('Container element is required for virtual scrolling');
                }

                this.items = items;
                this.containerHeight = this.container.clientHeight;
                this.totalHeight = this.items.length * this.itemHeight;
                
                // Only enable virtual scrolling for large collections
                this.isEnabled = this.items.length >= this.threshold;
                
                if (this.isEnabled) {
                    this.setupVirtualScrolling();
                } else {
                    this.setupRegularScrolling();
                }
                
                this.isInitialized = true;
                console.log(`Virtual scrolling ${this.isEnabled ? 'enabled' : 'disabled'} for ${this.items.length} items`);
            },
            {
                type: ERROR_TYPES.UNKNOWN,
                severity: ERROR_SEVERITY.MEDIUM,
                context: { operation: 'initializeVirtualScrolling', itemCount: items.length }
            }
        );
    }

    /**
     * Sets up virtual scrolling for large collections
     */
    setupVirtualScrolling() {
        // Create virtual container
        this.virtualContainer = document.createElement('div');
        this.virtualContainer.className = 'virtual-scroll-container';
        this.virtualContainer.style.height = `${this.totalHeight}px`;
        this.virtualContainer.style.position = 'relative';
        
        // Create viewport for visible items
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-scroll-viewport';
        this.viewport.style.position = 'absolute';
        this.viewport.style.top = '0';
        this.viewport.style.width = '100%';
        
        this.virtualContainer.appendChild(this.viewport);
        
        // Clear container and add virtual container
        this.container.innerHTML = '';
        this.container.appendChild(this.virtualContainer);
        
        // Add scroll listener
        this.container.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', this.onResize, { passive: true });
        
        // Initial render
        this.updateVisibleItems();
        this.renderVisibleItems();
    }

    /**
     * Sets up regular scrolling for small collections
     */
    setupRegularScrolling() {
        this.container.innerHTML = '';
        
        // Render all items normally
        const fragment = document.createDocumentFragment();
        this.items.forEach((item, index) => {
            const element = this.renderItem(item, index);
            fragment.appendChild(element);
        });
        
        this.container.appendChild(fragment);
    }

    /**
     * Updates the list of visible items based on scroll position
     */
    updateVisibleItems() {
        if (!this.isEnabled) return;
        
        const scrollTop = this.container.scrollTop;
        const containerHeight = this.container.clientHeight;
        
        // Calculate visible range with buffer
        const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.bufferSize);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.bufferSize
        );
        
        // Only update if range changed
        if (startIndex !== this.startIndex || endIndex !== this.endIndex) {
            this.startIndex = startIndex;
            this.endIndex = endIndex;
            this.visibleItems = this.items.slice(startIndex, endIndex + 1);
            return true;
        }
        
        return false;
    }

    /**
     * Renders visible items in the viewport
     */
    async renderVisibleItems() {
        if (!this.isEnabled || !this.viewport) return;
        
        return withErrorHandling(
            async () => {
                const startTime = performance.now();
                
                // Clear viewport
                this.viewport.innerHTML = '';
                
                // Create fragment for batch DOM updates
                const fragment = document.createDocumentFragment();
                
                // Render visible items
                this.visibleItems.forEach((item, index) => {
                    const globalIndex = this.startIndex + index;
                    const element = this.renderItem(item, globalIndex);
                    
                    // Position element
                    element.style.position = 'absolute';
                    element.style.top = `${globalIndex * this.itemHeight}px`;
                    element.style.width = '100%';
                    
                    fragment.appendChild(element);
                });
                
                this.viewport.appendChild(fragment);
                
                // Performance tracking
                this.renderCount++;
                this.lastRenderTime = performance.now() - startTime;
                
                // Log performance for debugging
                if (this.renderCount % 10 === 0) {
                    console.log(`Virtual scroll render #${this.renderCount}: ${this.lastRenderTime.toFixed(2)}ms`);
                }
            },
            {
                type: ERROR_TYPES.UNKNOWN,
                severity: ERROR_SEVERITY.LOW,
                context: { 
                    operation: 'renderVisibleItems', 
                    startIndex: this.startIndex, 
                    endIndex: this.endIndex 
                }
            }
        );
    }

    /**
     * Handles scroll events
     */
    onScroll() {
        if (!this.isEnabled) return;
        
        // Throttle scroll events for performance
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        this.scrollTimeout = setTimeout(() => {
            if (this.updateVisibleItems()) {
                this.renderVisibleItems();
            }
        }, 16); // ~60fps
    }

    /**
     * Handles resize events
     */
    onResize() {
        if (!this.isEnabled) return;
        
        // Debounce resize events
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            this.containerHeight = this.container.clientHeight;
            this.updateVisibleItems();
            this.renderVisibleItems();
        }, 250);
    }

    /**
     * Updates the items list and re-renders
     * @param {Array} newItems - New items array
     */
    async updateItems(newItems) {
        return withErrorHandling(
            async () => {
                this.items = newItems;
                this.totalHeight = this.items.length * this.itemHeight;
                
                // Check if we need to enable/disable virtual scrolling
                const shouldEnable = this.items.length >= this.threshold;
                
                if (shouldEnable !== this.isEnabled) {
                    // Re-initialize with new mode
                    this.isEnabled = shouldEnable;
                    if (this.isEnabled) {
                        this.setupVirtualScrolling();
                    } else {
                        this.setupRegularScrolling();
                    }
                } else if (this.isEnabled) {
                    // Update virtual container height
                    if (this.virtualContainer) {
                        this.virtualContainer.style.height = `${this.totalHeight}px`;
                    }
                    
                    // Update visible items
                    this.updateVisibleItems();
                    await this.renderVisibleItems();
                } else {
                    // Re-render all items for regular scrolling
                    this.setupRegularScrolling();
                }
            },
            {
                type: ERROR_TYPES.UNKNOWN,
                severity: ERROR_SEVERITY.MEDIUM,
                context: { operation: 'updateItems', itemCount: newItems.length }
            }
        );
    }

    /**
     * Scrolls to a specific item
     * @param {number} index - Item index to scroll to
     */
    scrollToItem(index) {
        if (!this.isInitialized || index < 0 || index >= this.items.length) return;
        
        const targetScrollTop = index * this.itemHeight;
        
        if (this.isEnabled) {
            this.container.scrollTop = targetScrollTop;
        } else {
            // For regular scrolling, find the element and scroll to it
            const elements = this.container.children;
            if (elements[index]) {
                elements[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }

    /**
     * Gets the currently visible item indices
     * @returns {Object} Object with start and end indices
     */
    getVisibleRange() {
        if (!this.isEnabled) {
            return { start: 0, end: this.items.length - 1 };
        }
        
        return { start: this.startIndex, end: this.endIndex };
    }

    /**
     * Default item renderer (should be overridden)
     * @param {*} item - Item to render
     * @param {number} index - Item index
     * @returns {HTMLElement} Rendered element
     */
    defaultRenderItem(item, index) {
        const div = document.createElement('div');
        div.className = 'virtual-scroll-item';
        div.style.height = `${this.itemHeight}px`;
        div.textContent = `Item ${index}: ${JSON.stringify(item)}`;
        return div;
    }

    /**
     * Gets performance statistics
     * @returns {Object} Performance stats
     */
    getPerformanceStats() {
        return {
            isEnabled: this.isEnabled,
            itemCount: this.items.length,
            visibleCount: this.visibleItems.length,
            renderCount: this.renderCount,
            lastRenderTime: this.lastRenderTime,
            averageRenderTime: this.renderCount > 0 ? this.lastRenderTime : 0,
            memoryUsage: this.isEnabled ? 
                `${this.visibleItems.length}/${this.items.length} items in DOM` :
                `${this.items.length}/${this.items.length} items in DOM`
        };
    }

    /**
     * Destroys the virtual scroll manager
     */
    destroy() {
        if (this.container) {
            this.container.removeEventListener('scroll', this.onScroll);
        }
        
        window.removeEventListener('resize', this.onResize);
        
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.items = [];
        this.visibleItems = [];
        this.isInitialized = false;
    }
}

/**
 * Creates a virtual scroll manager for journal entries
 * @param {HTMLElement} container - Container element
 * @param {Function} renderCard - Function to render journal cards
 * @returns {VirtualScrollManager} Virtual scroll manager instance
 */
export function createJournalVirtualScroll(container, renderCard) {
    return new VirtualScrollManager({
        container,
        itemHeight: 280, // Approximate journal card height
        bufferSize: 3,   // Render 3 extra cards above/below viewport
        threshold: 20,   // Enable virtual scrolling for 20+ entries
        renderItem: renderCard
    });
}

/**
 * Creates a virtual scroll manager for goals list
 * @param {HTMLElement} container - Container element
 * @param {Function} renderGoal - Function to render goal items
 * @returns {VirtualScrollManager} Virtual scroll manager instance
 */
export function createGoalsVirtualScroll(container, renderGoal) {
    return new VirtualScrollManager({
        container,
        itemHeight: 120, // Approximate goal item height
        bufferSize: 5,   // Render 5 extra items above/below viewport
        threshold: 30,   // Enable virtual scrolling for 30+ goals
        renderItem: renderGoal
    });
}

export default VirtualScrollManager;
