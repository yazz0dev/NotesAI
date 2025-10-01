# AI Journal - An Advanced AI Assistant for Personal Journaling

**AI Journal** is a sophisticated, privacy-first journaling application that transforms how people capture and interact with their personal thoughts. Built for the Google Chrome Built-in AI Challenge 2025, it showcases the incredible potential of on-device AI to create intelligent, conversational interfaces that feel like having a thoughtful companion.

This application leverages Chrome's built-in AI APIs to provide three distinct interaction modes:

- **Traditional Dictation**: Speak naturally and let AI format your thoughts into beautiful entries
- **Hands-Free Mode**: Say "Hey Journal" to activate full voice control with ambient listening
- **Context-Aware Commands**: Natural language commands like "search for my hackathon notes" or "edit this entry"

Every interaction happens **100% on-device**, ensuring complete privacy while delivering a seamless, intelligent experience that adapts to your needs and context.

**[Link to Live Demo]** - _(You will add this later)_
**[Link to Video Demo]** - _(You will add this later)_

![AI Journal Screenshot](https://via.placeholder.com/800x450.png?text=AI+Assistant+Journal)
_(Replace the placeholder above with a real screenshot of your app)_

---

## The Problem We're Solving

Traditional journaling can feel like a chore, discouraging consistency. Modern AI tools can help, but they often require sending your most private thoughts to a server. AI Journal addresses this by:

1.  **Lowering the Barrier to Entry:** We eliminate the friction of typing and formatting. Users can simply speak their thoughts, and the on-device AI handles the rest, turning messy speech into a beautifully structured journal entry. This meaningfully improves a common user journey.
2.  **Guaranteeing Inherent Privacy:** We provide a hyper-personalized AI experience without compromise. By using Chrome's client-side APIs, we ensure that the sanctity of a personal journal is respected, unlocking a new capability previously impractical on the web.

## Showcasing the Chrome AI APIs

This project demonstrates the full spectrum of Chrome's built-in AI capabilities, creating a sophisticated AI assistant that feels natural and responsive.

- **Prompt API (Gemini Nano):** The intelligent core of our application, powering multiple sophisticated features:

  1.  **Intelligent Text Formatting:** Transforms raw speech into polished journal entries with proper punctuation, capitalization, and paragraph structure
  2.  **Creative Title Generation:** Creates engaging 1-5 word titles that capture the essence of each entry
  3.  **Natural Language Command Parsing:** Understands conversational commands like "search for my hackathon notes" and converts them into structured actions
  4.  **Multimodal Image Captioning:** Analyzes uploaded images and generates contextual descriptions for journal entries
  5.  **Intent Detection:** Determines user intent from natural speech patterns to enable seamless interaction

- **Summarizer API:** Powers our "On This Day" time capsule feature:

  1.  **Historical Memory Synthesis:** Combines past journal entries from the same date across years into meaningful summaries
  2.  **Contextual Memory Retrieval:** Extracts and summarizes relevant historical content for nostalgic reflection

- **Proofreader API:** Provides the foundation for text processing:

  1.  **Grammar and Spelling Correction:** Cleans up raw speech transcripts before advanced formatting
  2.  **Quality Assurance:** Ensures all text meets basic linguistic standards before AI enhancement

- **Web Speech API:** Enables the voice-first experience:
  1.  **Ambient Listening:** Background listening for hotword activation ("Hey Journal")
  2.  **Real-time Speech Recognition:** Continuous speech capture with intelligent state management
  3.  **Smart Stop Detection:** Automatically finalizes entries when users pause speaking

## Core Features

### 🤖 **Intelligent AI Assistant**

- **Conversational Voice Control:** Say "Hey Journal" to activate ambient listening, then use natural commands like "search for my hackathon notes" or "edit this entry"
- **Context-Aware Commands:** The AI understands your current context (bookshelf vs. reader view) and executes commands appropriately
- **Smart Command Feedback:** Visual feedback shows when commands are understood vs. not understood, with helpful animations

### 📝 **Advanced Journaling Experience**

- **Three Interaction Modes:**
  - **Traditional Dictation:** Click mic and speak naturally for formatted entries
  - **Hands-Free Mode:** Enable ambient listening for "Hey Journal" activation
  - **Context-Aware Commands:** Voice commands that adapt to your current activity
- **Multimodal Entries:** Upload images with AI-generated captions for richer journal entries
- **Smart Entry Management:** Edit, save, and delete entries with full CRUD functionality

### 🎨 **Polished User Experience**

- **Visual Command Feedback:** Action bar animations show command processing status
- **"On This Day" Time Capsule:** AI summarizes past entries from the same date for nostalgic reflection
- **Responsive Design:** Beautiful, animated UI that works across all screen sizes
- **Privacy-First Architecture:** 100% on-device processing ensures complete data privacy

### ⚡ **Technical Excellence**

- **Network Independence:** Works perfectly offline with local AI models
- **Graceful Degradation:** Fallback functionality when AI APIs aren't available
- **Performance Optimized:** Efficient state management and DOM updates
- **Future-Ready:** Architecture prepared for upcoming Chrome AI features

## How to Run the Project

This project is built with vanilla HTML, CSS, and JavaScript and requires no complex build steps.

**Prerequisites:**

- A browser that supports the Chrome Built-in AI APIs (e.g., Chrome with the appropriate feature flags enabled).
- [Node.js](https://nodejs.org/) and npm installed (for the development server).

**Instructions:**

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/ai-journal.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd ai-journal
    ```
3.  Install the development server (if you don't have one globally):
    ```bash
    npm install -g live-server
    ```
4.  Start the live server:
    ```bash
    live-server
    ```
5.  Your browser will automatically open the application.

---

## Technical Architecture & Innovation

### **State Machine Design**

The application uses a sophisticated state machine architecture for voice interaction:

- **IDLE**: Default state when not actively listening
- **AMBIENT_LISTENING**: Background listening for "Hey Journal" hotword
- **COMMAND_MODE**: After hotword detection, ready for natural language commands
- **DICTATION_MODE**: After "create entry" command, capturing journal content

### **Command Processing Pipeline**

1. **Hotword Detection**: "Hey Journal" activates command mode
2. **Intent Analysis**: AI determines if speech indicates a journaling action
3. **Command Parsing**: Natural language converted to structured JSON actions
4. **Context-Aware Execution**: Commands adapt based on current view state
5. **Visual Feedback**: Real-time status updates and error handling

### **Privacy & Performance Optimizations**

- **Zero-Trust Architecture**: No data ever leaves the device
- **Graceful API Degradation**: Fallback functionality when AI services unavailable
- **Efficient State Management**: Minimal re-renders and optimized DOM updates
- **Progressive Enhancement**: Core features work without AI APIs

### **Beyond Original Scope**

✅ **Full Voice Command System** - Natural language commands with context awareness
✅ **Ambient Listening Mode** - "Hey Journal" hotword activation
✅ **Multimodal Image Support** - Upload images with AI-generated captions
✅ **Advanced Visual Feedback** - Command processing animations and error states
✅ **"On This Day" Memories** - AI-powered historical content summarization
