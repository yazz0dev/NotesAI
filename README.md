# NotesAI - An Intelligent, Privacy-First Notes & Tasks App

**NotesAI** is a modern, powerful, and privacy-focused application for capturing thoughts, managing tasks, and organizing your ideas. Built with Vue 3, Pinia, and Bootstrap 5, it offers a clean, responsive interface for personal productivity.

The application's standout feature is its deep integration with **Chrome's experimental, built-in AI APIs**, which run **100% on-device**. This provides intelligent features without ever sending your personal data to the cloud, ensuring complete privacy.

-   **AI-Powered Search & Commands**: Use natural language in the search bar to create notes, summarize content, and manage tasks intelligently.
-   **Advanced Voice Control**: Dictate notes, execute commands, and format text using voice with full support for in-editor voice commands.
-   **On-Device AI Features**: AI proofreading, summarization, and the Notice Board for highlighting important notes—all processing locally.
-   **Rich Text Editing**: A full-featured editor for formatting text, creating task lists, applying rich formatting, and more.

**[Link to Live Demo]** - _(Coming Soon)_
**[Link to Video Demo]** - _(Coming Soon)_

---

## Features

### 📝 **Advanced Note Management**
- **Rich Text Editor**: A full-featured `contenteditable` editor for bold, italics, underline, lists, and more.
- **Task Lists**: Create and manage to-do items directly within your notes with checkbox support.
- **Tagging System**: Organize and filter your notes with custom color-coded tags.
- **Favorites & Archiving**: Mark important notes as favorites or archive them to keep your workspace clean.
- **Reminders**: Set date and time-based reminders for any note.
- **Powerful Search**: Instantly find notes by title, content, or using AI-powered natural language queries.

### 🤖 **AI-Powered Intelligent Features (Chrome Only)**

#### **AI Search & Commands**
- Use natural language commands in the search bar to perform complex actions:
  - `"Create a note about the Q3 marketing plan"` - Creates a new note
  - `"Summarize my note on the client meeting"` - Finds and summarizes a specific note
  - `"Show me my favorite notes"` - Filters to favorites
  - `"Find notes tagged with 'Urgent'"` - Filters by tags
  - `"Delete the note about the old server specs"` - Finds and deletes a note
  - `"Add 'Follow up with John' to my project X note"` - Appends to existing notes

#### **Smart Notice Board**
- An intelligent dashboard that automatically highlights important notes based on keywords like "urgent", "important", "deadline", etc.
- Cached summaries for quick access without reprocessing
- Caches recent AI responses for faster retrieval

#### **AI Proofreading**
- Real-time grammar and spelling suggestions as you type
- Built-in proofreading command in voice dictation: `"Proofread this note"`

#### **AI Summarization**
- Generate concise summaries of long notes with a single click
- Works across multiple notes for comprehensive overviews

### 🎙️ **Advanced Voice & Audio Features**
- **Voice Dictation with AI Commands**: Full voice control that understands natural language commands
- **Hands-Free Mode**: Enable to start commands with "Hey Notes" detection (optional via settings)
- **In-Editor Voice Commands**: While dictating in an open note:
  - `"Make it bold"` - Toggle bold formatting
  - `"Add a task"` - Insert a checklist item
  - `"Next line"` - Insert line break
  - `"Delete last word"` - Remove the previous word
  - `"Undo that"` - Undo last action
  - `"Proofread this note"` - Trigger AI proofreader
  - `"Stop dictation"` - Exit dictation mode

### 🗂️ **Organization & Productivity**
- **Multiple View Modes**: Switch between grid and list layouts to view your notes
- **Sorting Options**: Sort by date updated, date created, or alphabetically by title
- **View Filters**:
  - All Notes - See your entire note library
  - Favorites - Quick access to marked important notes
  - Archived - View archived notes separately
  - By Tags - Filter notes by custom tags
- **Responsive Sidebar**: Collapsible sidebar for more editing space
- **Auto-Save**: Automatic saving with configurable delay

### ⚙️ **Core Features**
- **Dark Mode & Theme Settings**: Beautiful light and dark themes that can sync with your system preference
- **Offline-First**: The application is fully functional without an internet connection
- **Privacy First**: All your notes and data are stored locally in your browser's IndexedDB. Nothing is ever sent to a server
- **Responsive Design**: A seamless experience on desktop, tablet, and mobile devices, powered by Bootstrap 5
- **Local Data Export**: Export your notes in JSON, Markdown, or plain text formats

## Tech Stack

This project is built with a "no-build-step" architecture, relying on modern browser features and CDN-hosted libraries.

- **Frontend Framework**: [Vue 3](https://vuejs.org/) (via global CDN script)
- **State Management**: [Pinia](https://pinia.vuejs.org/) (via IIFE CDN script) with IndexedDB persistence
- **UI & Styling**: [Bootstrap 5.3.2](https://getbootstrap.com/) for components and layout, with custom CSS for theming
- **Local Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for robust, offline storage of all notes, tags, and settings
- **Development Server**: [Bun](https://bun.sh/) provides a simple, fast static file server

### On-Device AI (Chrome-Only Features)

The application leverages Chrome's experimental, built-in AI APIs for advanced features:

- **`LanguageModel` API (Prompt API)**: Powers AI search, natural language commands, and the Notice Board intelligent feature highlighting
- **`Proofreader` API**: Provides real-time grammar and spelling suggestions
- **`Summarizer` API**: Generates concise summaries of notes
- **`Web Speech` API**: Enables voice dictation and command recognition
- **IndexedDB Caching**: Stores AI responses and processed data locally for faster subsequent access

## How to Run the Project

**Prerequisites:**
- **A modern web browser.** For the full AI experience, **Google Chrome (version 138 or newer)** is required.
- **Bun** installed locally. You can install it with `curl -fsSL https://bun.sh/install | bash`.

**Important AI Feature Requirements:**

The on-device AI features require specific hardware and browser flags to be enabled. Please ensure your system meets the requirements and that the correct flags are enabled in Chrome:

1. **Enable Chrome Flags** (required for AI features):
   - Open `chrome://flags` in your Chrome browser
   - Search for and enable the following flags:
     - `#prompt-api-for-gemini-nano` - Enables the LanguageModel API
     - `#summarizer-api` - Enables the Summarizer API
     - `#proofreader-api` - Enables the Proofreader API
   - Restart Chrome after enabling these flags

2. **Hardware Requirements**:
   - The Gemini Nano model requires at least 10GB of free disk space for download
   - First time setup may take a few minutes as Chrome downloads the AI models
   - Subsequent uses will be instant as models are cached

3. **Full Documentation**: See [Chrome's official AI documentation](https://developer.chrome.com/docs/ai/built-in) for the latest requirements and setup instructions

**Instructions:**

1.  Clone the repository:
    ```bash
    git clone https://github.com/yazz0dev/NotesAI.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd NotesAI
    ```
3.  Start the development server using Bun:
    ```bash
    bun run server.js
    ```
4.  Open your browser and navigate to `http://localhost:3000`
5.  Start using the app! If you have Chrome AI enabled, you'll see the AI status indicator at the top of the screen

## Project Architecture

The codebase is organized with a clear separation of concerns, making it modular and maintainable.

```
NotesAI/
├── index.html              # Main HTML entry point
├── server.js               # Bun development server
├── js/
│   ├── main.js             # Vue 3 app initialization and main component logic
│   ├── components/         # Vue components (UI building blocks)
│   │   ├── AppHeader.js    # Main header with search and controls
│   │   ├── AppSidebar.js   # Sidebar with navigation filters and tags
│   │   ├── NoteEditor.js   # Rich text editor component
│   │   ├── NotesList.js    # Notes list/grid display
│   │   ├── NoticeBoard.js  # AI-powered intelligent dashboard
│   │   ├── AIResponseModal.js    # Modal for displaying AI responses
│   │   ├── SettingsModal.js      # User preferences and settings
│   │   ├── HelpModal.js          # Help and command guide
│   │   └── [Other modals and UI components]
│   │
│   ├── stores/             # Pinia state management
│   │   ├── notesStore.js   # Notes state and getters
│   │   ├── settingsStore.js # App settings and preferences
│   │   └── tagsStore.js    # Tags management
│   │
│   ├── services/           # Business logic and side effects
│   │   ├── ai-handler.js              # Main AI service orchestrator
│   │   ├── ai-tools-service.js        # AI utilities and helpers
│   │   ├── ai-event-service.js        # Voice and AI event handling
│   │   ├── promptapi-service.js       # LanguageModel API integration
│   │   ├── proofreader-service.js     # Proofreader API integration
│   │   ├── summary-service.js         # Summarizer API integration
│   │   ├── command-service.js         # Command parsing and execution
│   │   ├── voice-commands.js          # Voice command definitions
│   │   ├── note-actions-service.js    # Note CRUD operations
│   │   ├── notice-board-cache-service.js  # Cache management for Notice Board
│   │   ├── alert-service.js           # Modal alerts and notifications
│   │   ├── toast-service.js           # Toast notifications
│   │   ├── store.js                   # IndexedDB persistence layer
│   │   ├── editor-resize-service.js   # Editor resize functionality
│   │   └── [Other utility services]
│   │
│   ├── utils/              # Utility functions
│   │   ├── date-utils.js        # Date formatting and manipulation
│   │   ├── string-utils.js      # String processing utilities
│   │   ├── array-utils.js       # Array manipulation helpers
│   │   ├── color-utils.js       # Color and theme utilities
│   │   ├── validation-utils.js  # Input validation
│   │   ├── markdown-handler.js  # Markdown processing
│   │   └── storage-utils.js     # Browser storage helpers
│   │
│   └── pinia-plugins.js    # IndexedDB persistence plugin for Pinia
│
├── styles/                 # CSS stylesheets
│   ├── main.css           # Global styles
│   ├── theme.css          # Light/dark theme definitions
│   └── components/        # Component-specific styles
│       ├── note-editor.css
│       ├── notes-list.css
│       ├── app-header.css
│       ├── app-sidebar.css
│       ├── modals.css
│       ├── toast.css
│       └── [Other component styles]
│
└── README.md             # This file
```

### Key Design Patterns

- **Pinia State Management**: Centralized state for notes, tags, and settings with IndexedDB persistence
- **Service Layer**: Separation of business logic from Vue components
- **Event-Driven Architecture**: Custom events for AI status, voice commands, and app state changes
- **Caching Strategy**: Notice Board caches AI responses for better performance
- **Modular Components**: Each UI section is a reusable Vue component
- **Plugin Architecture**: Extensible design for future features

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+A` | Toggle AI-powered search mode |
| `Ctrl+Shift+L` | Switch between grid and list layouts |
| `Ctrl+Shift+S` | Change sort order |
| `Escape` | Close modals and overlays |

## Common Use Cases

### Create a Meeting Note with AI Summary
1. Open the app and click the "New Note" button
2. Use voice: `"Hey Notes, create note about Q3 meeting"`
3. Dictate your meeting notes using the voice button
4. Say `"Proofread this note"` to fix any grammar issues
5. The Notice Board will automatically highlight it if it contains important keywords
6. Later, use AI search: `"Summarize my note on the Q3 meeting"` for a quick overview

### Find and Tag Important Notes
1. Use AI search: `"Find notes about the project deadline"`
2. Open each result and add tags using the tag button
3. Use `"Find notes tagged with 'Urgent'"` to quickly access them later

### Voice-Only Workflow
1. Enable "Hands-Free Mode" in settings (says "Hey Notes" to activate)
2. Start dictating: `"Hey Notes, create note called Shopping List"`
3. Say `"Add a task"` to insert checklist items
4. Say `"Proofread this note"` to check grammar
5. Say `"Stop dictation"` when finished

## Troubleshooting

### AI Features Not Working
- **Check Chrome Version**: Make sure you're using Chrome 138 or newer
- **Enable Flags**: Visit `chrome://flags` and enable the AI-related flags as documented above
- **Restart Chrome**: Changes to flags require a Chrome restart
- **Disk Space**: Ensure you have at least 10GB free for the AI model download
- **Check Status**: Look at the AI status indicator at the top of the app - it shows the current AI state

### Voice Recognition Issues
- **Microphone Permissions**: Ensure Chrome has microphone access
- **Speak Clearly**: The voice recognition works best with clear speech
- **Language Setting**: Check the voice language in settings matches your spoken language
- **Disable Hands-Free**: Try turning off "Hands-Free Mode" if having issues with activation

### Performance Issues
- **Clear Browser Cache**: In rare cases, browser cache can cause issues. Clear IndexedDB and try again
- **Close Other Apps**: Voice recognition and AI processing can be CPU-intensive
- **Reduce Load**: Archive or delete very old notes if the app feels slow

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support & Feedback

- **Report Issues**: Open an issue on GitHub if you find bugs
- **Feature Requests**: Have an idea? Create an issue describing it
- **Questions**: Check the Help modal in the app (click the ❓ icon in the header)

## Acknowledgments

- Built with [Vue 3](https://vuejs.org/) and [Pinia](https://pinia.vuejs.org/)
- UI powered by [Bootstrap 5](https://getbootstrap.com/) and [Bootstrap Icons](https://icons.getbootstrap.com/)
- AI capabilities via [Chrome's Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in)
- Served with [Bun](https://bun.sh/) runtime
- Data stored with [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

---

**Made with ❤️ by [yazz0dev](https://github.com/yazz0dev)**