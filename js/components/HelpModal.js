// js/components/HelpModal.js

export default {
  props: {
    isVisible: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close'],
  data() {
    return {
      selectedNoteIndex: 0,
      helpNotes: [
        {
          id: 'help-1',
          title: '📝 Welcome to NotesAI',
          content: `<h3>Your Intelligent Note-Taking Companion</h3>

<p>NotesAI combines powerful note-taking with AI-powered features to help you capture, organize, and act on your thoughts faster than ever.</p>

<h4>What You Can Do:</h4>
<ul>
<li><strong>Create & Organize:</strong> Quick note creation with automatic organization</li>
<li><strong>AI-Powered Search:</strong> Find information using natural language queries</li>
<li><strong>Voice Control:</strong> Dictate notes hands-free with intelligent command recognition</li>
<li><strong>Smart Summarization:</strong> Generate concise summaries of your notes instantly</li>
<li><strong>AI Proofreading:</strong> Real-time grammar and writing suggestions</li>
<li><strong>Tagging & Filtering:</strong> Organize and retrieve notes by topic</li>
</ul>

<blockquote>💡 Tip: Click the ✨ icon in the search bar to activate AI mode for natural language commands.</blockquote>`,
          category: 'Getting Started'
        },
        {
          id: 'help-2',
          title: '✨ AI Search & Commands',
          content: `<h3>Search Like You Talk</h3>

<p>The AI search feature understands natural language and can execute complex commands. Activate it by clicking the ✨ icon in the search bar.</p>

<h4>Command Examples:</h4>
<ul>
<li><code>Create a note about the Q3 marketing plan</code> - Creates a new note with your title</li>
<li><code>Summarize my note on the client meeting</code> - Finds and summarizes a specific note</li>
<li><code>Show me my favorite notes</code> - Filters to show only favorited notes</li>
<li><code>Find notes tagged with "Urgent"</code> - Smart filtering by tags</li>
<li><code>Add "Follow up with John" to my project X note</code> - Append content to existing notes</li>
<li><code>Delete the note about the old server specs</code> - Safe deletion with confirmation</li>
</ul>

<h4>Tips:</h4>
<ul>
<li>Be specific about the note you're referring to</li>
<li>Use natural language - no special syntax required</li>
<li>Commands work best when your notes have meaningful titles and content</li>
</ul>`,
          category: 'AI Features'
        },
        {
          id: 'help-3',
          title: '🎙️ Voice Control & Dictation',
          content: `<h3>Speak Your Mind</h3>

<p>Control NotesAI entirely with your voice. Use the voice control button to issue commands or dictate notes.</p>

<h4>Voice Commands:</h4>
<ul>
<li><code>Hey Notes, create a new note called "Shopping List"</code> - Create notes by voice</li>
<li><code>Hey Notes, what are my main priorities?</code> - Ask the AI to analyze your notes</li>
<li><code>Start dictation</code> - Begin dictating into the current note</li>
<li><code>Stop dictation</code> - Stop listening for voice input</li>
</ul>

<h4>Dictation Formatting Commands:</h4>
<p>While dictating into a note, use these special commands:</p>
<ul>
<li><code>Make it bold</code> - Toggle bold formatting</li>
<li><code>Add a task</code> - Insert a checklist item</li>
<li><code>Next line</code> - Line break</li>
<li><code>Delete last word</code> - Remove the previous word</li>
<li><code>Undo that</code> - Undo the last action</li>
<li><code>Proofread this note</code> - Run AI proofreader</li>
</ul>

<h4>Tips:</h4>
<ul>
<li>Speak clearly and naturally</li>
<li>Pause briefly between sentences for better recognition</li>
<li>Use punctuation commands like "period" or "comma" to add punctuation</li>
</ul>`,
          category: 'Voice Features'
        },
        {
          id: 'help-4',
          title: '🤖 AI Summarization & Proofreading',
          content: `<h3>Intelligent Content Enhancement</h3>

<h4>AI Summarization</h4>
<p>Generate concise summaries of your notes with a single click. Perfect for reviewing long notes or creating quick overviews.</p>
<ul>
<li>Minimum 50 characters required for summarization</li>
<li>Summaries are generated in well-formatted markdown</li>
<li>You can view, edit, or remove summaries anytime</li>
<li>Attach summaries directly to your notes</li>
</ul>

<h4>AI Proofreading</h4>
<p>Get real-time grammar, spelling, and writing suggestions as you type.</p>
<ul>
<li>Inline error highlighting with hover tooltips</li>
<li>Suggested corrections at a glance</li>
<li>Apply all corrections at once or selectively</li>
<li>Triggered automatically or via voice command</li>
</ul>

<h4>Notice Board</h4>
<p>The Notice Board automatically highlights important information across your notes.</p>
<ul>
<li>Detects deadlines, action items, and key information</li>
<li>Updates automatically as you create and edit notes</li>
<li>Helps you stay organized and never miss important tasks</li>
</ul>

<blockquote>✅ Pro Tip: Use "Summarize this" voice command while dictating to quickly create summaries.</blockquote>`,
          category: 'AI Features'
        },
        {
          id: 'help-5',
          title: '🎯 Organization & Features',
          content: `<h3>Master Your Notes</h3>

<h4>Organization Features</h4>
<ul>
<li><strong>Tags:</strong> Add custom tags to categorize and filter notes</li>
<li><strong>Favorites:</strong> Star important notes for quick access</li>
<li><strong>Archive:</strong> Hide completed or old notes</li>
<li><strong>Reminders:</strong> Set reminders for notes that need follow-up</li>
</ul>

<h4>View Modes</h4>
<ul>
<li><strong>Grid View:</strong> Visual card-based layout for browsing</li>
<li><strong>List View:</strong> Compact list for quick scanning</li>
<li><strong>Sort Options:</strong> Sort by date, title, or custom order</li>
</ul>

<h4>Storage & Privacy</h4>
<ul>
<li>✅ All notes stored locally in your browser (IndexedDB)</li>
<li>✅ Your data never leaves your device</li>
<li>✅ No account required</li>
<li>✅ Full privacy and control</li>
</ul>

<blockquote>🔐 Privacy First: NotesAI is designed with privacy as the top priority. Your notes are always yours.</blockquote>`,
          category: 'Organization'
        }
      ]
    };
  },
  methods: {
    handleKeydown(event) {
      if (event.key === 'Escape' && this.isVisible) {
        this.$emit('close');
      }
    },
    selectNote(index) {
      this.selectedNoteIndex = index;
    },
    nextNote() {
      if (this.selectedNoteIndex < this.helpNotes.length - 1) {
        this.selectedNoteIndex++;
      }
    },
    previousNote() {
      if (this.selectedNoteIndex > 0) {
        this.selectedNoteIndex--;
      }
    }
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  },
  template: `
    <div v-if="isVisible" class="help-overlay-fullscreen" @click.self="$emit('close')">
      <div class="help-fullscreen-container">
        <!-- Close Button -->
        <button class="btn help-close-btn-fullscreen" @click="$emit('close')" aria-label="Close help" title="Close (Esc)">
          <i class="bi bi-x-lg"></i>
        </button>

        <!-- Header -->
        <div class="help-fullscreen-header">
          <h1 class="display-6 fw-bold mb-2">Welcome to NotesAI</h1>
          <p class="lead text-muted">Learn how to use all the powerful features to boost your productivity</p>
        </div>

        <div class="help-fullscreen-content">
          <!-- Sidebar Navigation -->
          <aside class="help-notes-sidebar">
            <div class="help-sidebar-title mb-3">
              <i class="bi bi-bookmark-fill me-2"></i>
              <span>Features Guide</span>
            </div>
            <nav class="help-notes-nav">
              <button 
                v-for="(note, index) in helpNotes" 
                :key="note.id"
                @click="selectNote(index)"
                :class="['help-nav-btn', { 'active': selectedNoteIndex === index }]"
                :aria-label="'View ' + note.title"
              >
                <span class="help-nav-title">{{ note.title }}</span>
                <span class="help-nav-category">{{ note.category }}</span>
              </button>
            </nav>
          </aside>

          <!-- Main Content -->
          <main class="help-notes-main">
            <div class="help-note-viewer">
              <div class="help-note-content" v-html="helpNotes[selectedNoteIndex].content"></div>
            </div>

            <!-- Navigation Controls -->
            <div class="help-fullscreen-footer">
              <button 
                @click="previousNote" 
                :disabled="selectedNoteIndex === 0"
                class="btn btn-outline-secondary"
                aria-label="Previous guide"
              >
                <i class="bi bi-chevron-left me-2"></i>Previous
              </button>
              <div class="help-progress">
                <span class="help-progress-text">{{ selectedNoteIndex + 1 }} of {{ helpNotes.length }}</span>
                <div class="help-progress-bar">
                  <div class="help-progress-fill" :style="{ width: ((selectedNoteIndex + 1) / helpNotes.length * 100) + '%' }"></div>
                </div>
              </div>
              <button 
                @click="nextNote" 
                :disabled="selectedNoteIndex === helpNotes.length - 1"
                class="btn btn-outline-secondary"
                aria-label="Next guide"
              >
                Next<i class="bi bi-chevron-right ms-2"></i>
              </button>
            </div>
          </main>
        </div>
      </div>
    </div>
  `,
};