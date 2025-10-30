/**
 * Markdown Handler Utility
 * Provides utilities for rendering and processing markdown content in notes
 */

class MarkdownHandler {
  /**
   * Converts plain text to HTML with markdown-like formatting
   * @param {string} content - The plain text content
   * @returns {string} - HTML formatted content
   */
  static markdownToHtml(content) {
    if (!content) return '';

    let html = content;

    // Escape HTML special characters first (but preserve existing HTML)
    html = html
      .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers (# ## ### etc)
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*?)$/gm, '<h1>$1</h1>');

    // Bold text (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

    // Italic text (*text* or _text_)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');

    // Strike-through (~~text~~)
    html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

    // Inline code (`code`)
    html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    // Code blocks (```code```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // Links [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Unordered lists (- or * at start of line)
    html = html.replace(/^[\*\-] (.*?)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Ordered lists (1. 2. etc)
    html = html.replace(/^\d+\. (.*?)$/gm, '<li>$1</li>');

    // Line breaks
    html = html.replace(/\n/g, '<br>');

    // Blockquotes (> text)
    html = html.replace(/^&gt; (.*?)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rule (---, ***, ___)
    html = html.replace(/^(\-{3,}|\*{3,}|_{3,})$/gm, '<hr>');

    return html;
  }

  /**
   * Renders HTML safely for display in the DOM
   * @param {string} htmlContent - HTML content to render
   * @returns {string} - Safe HTML with sanitization
   */
  static sanitizeHtml(htmlContent) {
    if (!htmlContent) return '';

    const allowedTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'del', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'blockquote', 'hr'];
    const allowedAttributes = {
      'a': ['href', 'target', 'rel', 'class'],
      'code': ['class'],
    };

    // Create a temporary container to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;

    this._sanitizeElement(temp, allowedTags, allowedAttributes);

    return temp.innerHTML;
  }

  /**
   * Recursively sanitize HTML elements
   * @private
   */
  static _sanitizeElement(element, allowedTags, allowedAttributes) {
    const nodesToRemove = [];

    for (let child of element.childNodes) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();

        if (!allowedTags.includes(tagName)) {
          nodesToRemove.push(child);
          continue;
        }

        // Remove disallowed attributes
        const attributes = Array.from(child.attributes);
        for (let attr of attributes) {
          const allowedAttrs = allowedAttributes[tagName] || [];
          if (!allowedAttrs.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
        }

        // Recursively sanitize children
        this._sanitizeElement(child, allowedTags, allowedAttributes);
      }
    }

    // Remove disallowed elements
    nodesToRemove.forEach(node => node.remove());
  }

  /**
   * Extracts plain text from HTML content
   * @param {string} htmlContent - HTML content
   * @returns {string} - Plain text
   */
  static htmlToPlainText(htmlContent) {
    if (!htmlContent) return '';
    const temp = document.createElement('div');
    temp.innerHTML = htmlContent;
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Converts HTML back to markdown-like format
   * @param {string} htmlContent - HTML content
   * @returns {string} - Markdown-like text
   */
  static htmlToMarkdown(htmlContent) {
    if (!htmlContent) return '';

    let markdown = htmlContent;

    // Headers
    markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1\n');
    markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1\n');
    markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1\n');

    // Bold/Strong
    markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    markdown = markdown.replace(/<b>(.*?)<\/b>/g, '**$1**');

    // Italic/Emphasis
    markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
    markdown = markdown.replace(/<i>(.*?)<\/i>/g, '*$1*');

    // Strike-through
    markdown = markdown.replace(/<del>(.*?)<\/del>/g, '~~$1~~');
    markdown = markdown.replace(/<s>(.*?)<\/s>/g, '~~$1~~');

    // Code
    markdown = markdown.replace(/<code class="inline-code">(.*?)<\/code>/g, '`$1`');
    markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
    markdown = markdown.replace(/<pre>(.*?)<\/pre>/g, '```$1```');

    // Links
    markdown = markdown.replace(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');

    // Line breaks
    markdown = markdown.replace(/<br>/g, '\n');
    markdown = markdown.replace(/<br\/>/g, '\n');
    markdown = markdown.replace(/<br \/>/g, '\n');

    // Lists
    markdown = markdown.replace(/<li>(.*?)<\/li>/g, '- $1\n');
    markdown = markdown.replace(/<ul>(.*?)<\/ul>/g, '$1');
    markdown = markdown.replace(/<ol>(.*?)<\/ol>/g, '$1');

    // Blockquotes
    markdown = markdown.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n');

    // Horizontal rules
    markdown = markdown.replace(/<hr>/g, '---\n');
    markdown = markdown.replace(/<hr\/>/g, '---\n');

    return markdown.trim();
  }

  /**
   * Detects if content contains markdown syntax
   * @param {string} content - Content to check
   * @returns {boolean} - True if markdown syntax is detected
   */
  static isMarkdown(content) {
    if (!content) return false;

    const markdownPatterns = [
      /^#{1,6}\s+/m,           // Headers
      /\*\*[^\*]+\*\*/m,        // Bold
      /\*[^\*]+\*/m,            // Italic
      /~~[^~]+~~/m,             // Strike-through
      /`[^`]+`/m,               // Inline code
      /```[\s\S]*?```/m,        // Code blocks
      /\[([^\]]+)\]\(([^)]+)\)/m, // Links
      /^[\*\-\+]\s+/m,         // Lists
      /^\d+\.\s+/m,            // Numbered lists
      /^>\s+/m,                // Blockquotes
    ];

    return markdownPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Gets a preview of markdown content (plain text snippet)
   * @param {string} content - Content to preview
   * @param {number} maxLength - Maximum length of preview
   * @returns {string} - Preview text
   */
  static getPreview(content, maxLength = 120) {
    if (!content) return 'No content';

    // Remove markdown syntax and HTML tags
    let plainText = content
      .replace(/<[^>]*>/g, '')
      .replace(/[#*_`\-]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    return plainText.length > maxLength ? plainText.substring(0, maxLength) + '...' : plainText;
  }
}

export default MarkdownHandler;
