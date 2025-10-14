// js/ai-coordinator.js

// Note: Imports will be handled via global window object for Vue.js compatibility

// --- State ---
let voiceState = "IDLE";
let currentRecordingData = null;

// --- Callbacks for AI Service ---

function onAIStateChange(newState) {
  voiceState = newState;
  ui.updateUIVoiceState(newState);

  if (newState === "DICTATION_MODE") {
    ui.startRecordingUI();
  } else {
    // This logic handles stopping the recording when leaving dictation mode
    ui.stopRecordingUI().then((audioData) => {
      if (audioData) {
        currentRecordingData = audioData;
        console.log(
          "Audio recording completed:",
          formatDuration(audioData.duration / 1000)
        );
      }
    });
  }
}

async function handleAIFinalResult(formattedText) {
  ui.clearSearchInput();
  ui.setHeaderListeningState(true);

  if (!formattedText) {
    ui.setHeaderListeningState(false);
    return;
  }

  try {
    const session = await getAISession();
    const titlePrompt = `Create a short, creative title (1-5 words) for the following note. Note: "${formattedText}"`;
    const titleResult = await session.prompt(titlePrompt);
    const title = cleanAIResponse(titleResult).replace(/"/g, "");

    const oneLinerPrompt = `Generate a single, descriptive sentence summarizing the following note. Be concise. Note: "${formattedText}"`;
    const oneLinerResult = await session.prompt(oneLinerPrompt);
    const oneLiner = cleanAIResponse(oneLinerResult);

    const newNote = await store.addNote(
      `<p>${formattedText.replace(/\n/g, "</p><p>")}</p>`,
      title,
      oneLiner
    );

    if (currentRecordingData) {
      await storeAudioData(newNote.id, currentRecordingData);
      currentRecordingData = null;
    }

    // Notify the event handler to add the note to the state and UI
    const event = new CustomEvent("noteAdded", { detail: { note: newNote } });
    document.dispatchEvent(event);
  } catch (error) {
    console.error("Error creating note with AI summary:", error);
    // Fallback
    const newNote = await store.addNote(
      `<p>${formattedText.replace(/\n/g, "</p><p>")}</p>`
    );
    if (currentRecordingData) {
      await storeAudioData(newNote.id, currentRecordingData);
      currentRecordingData = null;
    }
    const event = new CustomEvent("noteAdded", { detail: { note: newNote } });
    document.dispatchEvent(event);
  } finally {
    ui.setHeaderListeningState(false);
  }
}

function onAICommand(command) {
  if (command.action === "unknown") {
    ui.showCommandNotUnderstood();
    return;
  }

  let feedbackMessage = `Processing: ${command.action.replace("_", " ")}`;
  ui.showCommandUnderstood(feedbackMessage);

  setTimeout(() => executeCommand(command), 300);
}

function executeCommand(command) {
  // Dispatch custom events that the event-handler can listen for
  const event = new CustomEvent("aiCommand", { detail: command });
  document.dispatchEvent(event);
}

// --- Public API ---

function initAI() {
  const callbacks = {
    onStateChange: onAIStateChange,
    onCommandReceived: onAICommand,
    onTranscriptUpdate: ui.updateSearchInput,
    onFinalResult: handleAIFinalResult,
  };
  initAIService(callbacks);
  setHandsFreeMode(getHandsFreeMode()); // Sync toggle on startup
}

function handleMicButtonClick() {
  if (getHandsFreeMode()) {
    if (voiceState === "AMBIENT_LISTENING" || voiceState === "COMMAND_MODE") {
      stopAmbientListening();
    } else {
      startAmbientListening();
    }
  } else {
    if (voiceState === "IDLE") {
      startAmbientListening();
    }
  }
}

// Make functions available globally for Vue.js compatibility
window.initAI = initAI;
window.handleMicButtonClick = handleMicButtonClick;
