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
      helpSections: [
        {
          title: 'AI Search & Commands',
          icon: 'bi-stars',
          description: 'Activate AI mode in the search bar by clicking the ✨ icon. You can then type commands in natural language and press Enter.',
          commands: [
            { example: 'Create a note about the Q3 marketing plan', description: 'Creates a new note with the specified title.' },
            { example: 'Summarize my note on the client meeting', description: 'Finds the relevant note and shows you a summary.' },
            { example: 'Show me my favorite notes', description: 'Switches the view to show only your favorited notes.' },
            { example: 'Find notes tagged with "Urgent"', description: 'Filters the list to show notes with the "Urgent" tag.' },
            { example: 'Add "Follow up with John" to my project X note', description: 'Appends a new line to an existing note.' },
            { example: 'Delete the note about the old server specs', description: 'Finds and deletes a specific note (will ask for confirmation).' },
          ],
        },
        {
          title: 'Upgraded Voice Control',
          icon: 'bi-mic-fill',
          description: 'Voice commands are now powered by the same AI as the search bar. Click the "Voice Control" button and speak your command.',
          commands: [
            { example: 'Hey Notes, create a new note called "Shopping List"', description: 'The same commands from AI Search work with your voice.' },
            { example: 'Hey Notes, what are my main priorities?', description: 'The AI will analyze your recent notes to answer your question.' },
            { example: 'Start dictation', description: 'Switches to dictation mode if a note is open.' },
            { example: 'Stop dictation', description: 'Stops listening for dictation.' },
          ],
        },
        {
          title: 'In-Editor Dictation Commands',
          icon: 'bi-journal-text',
          description: 'While dictating in a note (after saying "start dictation"), use these commands to format and edit your text.',
          commands: [
            { example: 'Make it bold', description: 'Toggles bold formatting.' },
            { example: 'Add a task', description: 'Inserts a new checklist item.' },
            { example: 'Next line', description: 'Inserts a line break.' },
            { example: 'Delete last word', description: 'Removes the previously dictated word.' },
            { example: 'Undo that', description: 'Undoes the last action.' },
            { example: 'Proofread this note', description: 'Triggers the AI proofreader.' },
          ],
        },
      ],
    };
  },
  methods: {
    handleKeydown(event) {
      if (event.key === 'Escape' && this.isVisible) {
        this.$emit('close');
      }
    },
  },
  mounted() {
    document.addEventListener('keydown', this.handleKeydown);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.handleKeydown);
  },
  template: `
    <div v-if="isVisible" class="help-overlay" @click.self="$emit('close')">
      <div class="help-modal-content">
        <button class="btn help-close-btn" @click="$emit('close')" aria-label="Close help">
          <i class="bi bi-x-lg"></i>
        </button>
        
        <div class="help-header text-center mb-4">
          <h2 class="h3 mb-1">Help & Command Guide</h2>
          <p class="text-muted">Unlock the full power of NotesAI with these commands.</p>
        </div>

        <div class="help-body">
          <div v-for="(section, index) in helpSections" :key="index" class="help-section mb-4">
            <h5 class="fw-bold"><i :class="['bi', section.icon, 'me-2']"></i>{{ section.title }}</h5>
            <p class="text-muted">{{ section.description }}</p>
            <ul class="list-group list-group-flush">
              <li v-for="(command, cmdIndex) in section.commands" :key="cmdIndex" class="list-group-item d-flex">
                <div class="flex-grow-1">
                  <code class="d-block mb-1">"{{ command.example }}"</code>
                  <small class="text-muted">{{ command.description }}</small>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
};