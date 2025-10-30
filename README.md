# NotesAI - An Intelligent, Privacy-First Notes & Tasks App

**NotesAI** is a modern, powerful, and privacy-focused web application for capturing thoughts and managing tasks. Its standout feature is its deep integration with **Chrome's built-in AI APIs**, which run **100% on-device** using models like **Gemini Nano**. This provides intelligent features without ever sending your personal data to the cloud, ensuring complete privacy.

This project was built for the **Google Chrome Built-in AI Challenge 2025**.

---

### **[🚀 Live Demo Link]** - [Live link](https://notesaiweb.netlify.app/)
### **[🎬 Video Demo Link]** - [[YouTube link](https://youtu.be/4q-rovqSNd8?si=JO0vcMnnc2VvlzSe)]

---

## Features

### 🤖 AI-Powered Intelligent Features (Chrome Only)
- **AI Search & Commands**: Use natural language in the search bar to create, find, summarize, or edit notes.
- **Advanced Voice Control**: Dictate notes, execute formatting commands (`"make it bold"`), and control the app hands-free (`"create a new note"`).
- **On-Device AI Features**:
  - **Proofreading** (`Proofreader API`): Get real-time grammar and spelling suggestions as you type.
  - **Summarization** (`Summarizer API`): Generate concise summaries of long notes with a single click.
  - **Smart Notice Board** (`Prompt API`): An intelligent dashboard that automatically surfaces important notes based on keywords like "urgent" or "deadline".

### 📝 Advanced Note Management
- **Rich Text Editor**: A full-featured editor for formatting text, creating task lists, and adding images.
- **Organization**: Organize notes with custom color-coded tags, favorites, and an archive system.
- **Powerful Search**: Instantly find notes by title or content.

### ⚙️ Core Features
- **Privacy First**: All your data is stored locally in your browser's IndexedDB. Nothing is ever sent to a server.
- **Offline-First**: The application is fully functional without an internet connection.
- **Modern UI/UX**: A clean, responsive design powered by Bootstrap 5 with beautiful light and dark themes.

## Tech Stack

This project is built with a "no-build-step" architecture, relying on modern browser features and CDN-hosted libraries.

- **Frontend**: Vanilla JavaScript (ES6 Modules) with [Vue 3](https://vuejs.org/) for reactive UI components (via CDN).
- **State Management**: [Pinia](https://pinia.vuejs.org/) for centralized state management.
- **UI & Styling**: [Bootstrap 5](https://getbootstrap.com/) for components and layout, with custom modular CSS.
- **Local Database**: [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) for robust, offline storage.
- **On-Device AI APIs**:
  - **Chrome's Built-in AI**: `LanguageModel` (Prompt API), `Proofreader API`, `Summarizer API`.
  - **Web Speech API**: For voice dictation and command recognition.

## How to Run the Project Locally

This is a pure front-end application built with static HTML, CSS, and JavaScript. It can be served by any simple static web server.

### **❗️ Crucial: Enabling AI Features in Chrome**
The on-device AI features are experimental and **must be enabled** for the demo to work fully.

1.  **Enable Chrome Flags**:
    -   Open `chrome://flags` in your Chrome browser.
    -   Search for and **Enable** the following three flags:
        -   `#prompt-api-for-gemini-nano`
        -   `#summarizer-api`
        -   `#proofreader-api`
    -   **Restart Chrome** after enabling the flags.

2.  **Model Download**: The first time you use an AI feature, Chrome will download the Gemini Nano model in the background. This may take a few minutes and requires sufficient disk space. The AI status indicator in the app header will show the progress.

3.  **Official Docs**: See [Chrome's official AI documentation](https://developer.chrome.com/docs/ai/built-in) for the latest requirements.

### **Instructions to Run**

Choose **any one** of the following options to run the application.

#### **Option 1: Using VS Code Live Server (Easiest)**
1.  If you use Visual Studio Code, install the [Live Server extension](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer).
2.  Open the `NotesAI` folder in VS Code.
3.  Right-click on the `index.html` file and select **"Open with Live Server"**.

#### **Option 2: Using Node.js**
1.  Open a terminal in the `NotesAI` project directory.
2.  Run the command: `npx serve .`
3.  Open your browser to the local URL provided (usually `http://localhost:3000`).

#### **Option 3: Using Python**
1.  Open a terminal in the `NotesAI` project directory.
2.  Run the command: `python -m http.server 3000`
3.  Open your browser to `http://localhost:3000`.

## Example Workflows

### AI-Powered Meeting Notes
1.  Use AI search: `"Create a note about the Q3 marketing meeting"`
2.  Dictate your meeting notes using the voice button.
3.  Say `"Proofread this note"` to fix any grammar issues.
4.  Later, use AI search: `"Summarize my note on the Q3 meeting"` for a quick overview.

### Voice-Only Workflow
1.  Start with: `"Hey Notes, create note called Shopping List"`
2.  Dictate items and use commands like `"Add a task"` or `"Next line"`.
3.  Finish with: `"Stop dictation"`.

## Project Architecture
The codebase is organized with a clear separation of concerns:
-   `js/components/`: Reusable Vue UI components.
-   `js/services/`: Business logic for AI, IndexedDB, and application actions.
-   `js/stores/`: Pinia stores for centralized state management (`notes`, `tags`, `settings`).
-   `js/utils/`: Helper functions for dates, strings, and more.
-   `styles/`: Modular CSS for components and themes.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
**Made with ❤️ by [Yaseen K](https://github.com/yazz0dev)**
