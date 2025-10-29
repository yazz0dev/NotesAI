# NotesAi - An Intelligent, Privacy-First Notes App

**NotesAi** is a modern, powerful, and privacy-focused application for capturing thoughts and managing notes. Built with Vue 3, Pinia, and Bootstrap 5, it offers a clean, responsive interface for personal productivity.

The application's standout feature is its deep integration with **Chrome's experimental, built-in AI APIs**, which run **100% on-device**. This provides intelligent features without ever sending your personal data to the cloud, ensuring complete privacy.

-   **On-Device Voice Control**: Use natural language to dictate, format, and manage your notes.
-   **AI-Powered Content Assistance**: Get real-time proofreading and generate summaries of your notes with a single click.
-   **Rich Text Editing**: A full-featured editor for formatting text, creating task lists, and embedding images.

**[Link to Live Demo]** - _(Coming Soon)_
**[Link to Video Demo]** - _(Coming Soon)_

![NotesAi Application Screenshot](https://via.placeholder.com/800x450.png?text=NotesAi+Application+Interface)
_(Replace the placeholder above with a real screenshot of your app)_

---

## Features

### 📝 **Advanced Note Management**
- **Rich Text Editor**: A full-featured `contenteditable` editor for bold, italics, underline, lists, and more.
- **Task Lists**: Create and manage to-do items directly within your notes.
- **Image Support**: Upload and embed images directly from your device.
- **Powerful Search**: Instantly find notes by title or content.
- **Tagging System**: Organize and filter your notes with custom color-coded tags.

### 🤖 **On-Device AI Suite (Chrome Only)**
- **AI Summarization**: Generate concise summaries of long notes with the built-in Summarizer API.
- **AI Proofreading**: Get real-time grammar and spelling suggestions as you type using the Proofreader API.
- **Voice Dictation & Control**: Use your voice to write notes, add new lines, delete words, apply formatting, and execute commands like "summarize this note".

### 🎙️ **Voice & Audio Features**
- **Hands-Free Mode**: Enable "Hey Notes" detection to start commands without clicking (via settings).
- **Voice Command Parsing**: Understands natural language commands for in-editor actions.
- **Audio Recording**: Optionally save the original audio recording alongside a dictated note.

### 🗂️ **Organization & Productivity**
- **Favorites**: Mark important notes for quick and easy access.
- **Archiving**: Keep your main workspace clean by archiving notes you don't need right now.
- **Reminders**: Set date and time-based reminders for any note.
- **Grid & List Views**: Switch between two different layouts to view your notes.

### ⚙️ **Core Features**
- **Dark Mode**: Beautiful light and dark themes that can also sync with your system preference.
- **Offline-First**: The application is fully functional without an internet connection.
- **Privacy First**: All your notes and data are stored locally in your browser's IndexedDB. Nothing is ever sent to a server.
- **Responsive Design**: A seamless experience on desktop, tablet, and mobile devices, powered by Bootstrap 5.

## Tech Stack

This project is built with a "no-build-step" architecture, relying on modern browser features and CDN-hosted libraries.
- **Frontend Framework**: [Vue 3](https://vuejs.org/) (via global CDN script)
- **State Management**: [Pinia](https://pinia.vuejs.org/) (via IIFE CDN script)
- **UI & Styling**: [Bootstrap 5.3.2](https://getbootstrap.com/) for components and layout, with custom CSS for theming.
- **Local Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for robust, offline storage of all notes and tags.
- **On-Device AI**: **Chrome's Built-in AI APIs**
    - `LanguageModel` API (Prompt API)
    - `Proofreader` API
    - `Summarizer` API
    - `Web Speech` API for voice recognition.
- **Development Server**: [Bun](https://bun.sh/) provides a simple, fast static file server.

## How to Run the Project

**Prerequisites:**
- **A modern web browser.** For the full AI experience, **Google Chrome (version 138 or newer)** is required.
- **Bun** installed locally. You can install it with `curl -fsSL https://bun.sh/install | bash`.

**Important AI Feature Requirements:**
The on-device AI features have specific hardware and browser requirements. Please ensure your system meets them and that the correct flags are enabled in Chrome as per the [official documentation](https://developer.chrome.com/docs/ai/built-in). You may need to enable flags like `chrome://flags/#prompt-api-for-gemini-nano`.

**Instructions:**

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/NotesAi.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd NotesAi
    ```
3.  Start the development server using Bun:
    ```bash
    bun run server.js
    ```
4.  The server will start, and you can access the application at `http://localhost:3000`.

## Project Architecture

The codebase is organized with a clear separation of concerns, making it modular and maintainable.
- **`js/components/`**: Contains all the reusable Vue components that make up the UI.
- **`js/stores/`**: Manages all application state using Pinia, with dedicated modules for notes, tags, and settings.
- **`js/services/`**: Handles all business logic, side effects, and communication with browser APIs (IndexedDB, AI services, etc.).
- **`styles/`**: Contains all CSS, organized into global styles, a theme file (for light/dark mode), and component-specific stylesheets.