// js/ai-service.js

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) console.error("Speech Recognition API not supported.");
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

// --- State Management ---
let voiceState = 'IDLE'; // IDLE, AMBIENT_LISTENING, COMMAND_MODE, DICTATION_MODE
let fullTranscript = '';
let endOfSpeechTimer = null; // For Smart Stop in dictation
let commandResetTimer = null; // Timer to return to ambient from command mode

// --- Callbacks ---
let onStateChange = () => {};
let onCommandReceived = () => {};
let onTranscriptUpdate = () => {};
let onFinalResult = () => {};

// --- Core Logic ---

function setVoiceState(newState) {
    if (voiceState === newState) return;
    console.log(`Voice state changing from ${voiceState} to ${newState}`);
    voiceState = newState;
    onStateChange(newState); // Notify main.js to update UI
}

function setupRecognition() {
    if (!recognition) return;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = handleRecognitionResult;
    recognition.onerror = (event) => { console.error("Speech error:", event.error); setVoiceState('IDLE'); };
    recognition.onend = () => { setVoiceState('IDLE'); };

    // Smart Stop for dictation mode
    recognition.onspeechend = () => {
        if (voiceState === 'DICTATION_MODE') {
            clearTimeout(endOfSpeechTimer);
            endOfSpeechTimer = setTimeout(finalizeEntry, 3500);
        }
    };
}

async function handleRecognitionResult(event) {
    if (voiceState === 'DICTATION_MODE') clearTimeout(endOfSpeechTimer);

    let finalTranscriptSegment = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscriptSegment += event.results[i][0].transcript;
        } else if (voiceState === 'DICTATION_MODE') {
            onTranscriptUpdate(fullTranscript + event.results[i][0].transcript);
        }
    }

    if (!finalTranscriptSegment) return;

    switch (voiceState) {
        case 'AMBIENT_LISTENING':
            if (finalTranscriptSegment.toLowerCase().trim().includes('hey journal')) {
                console.log("Hotword detected!");
                setVoiceState('COMMAND_MODE');
                // If user pauses after hotword, go back to ambient
                commandResetTimer = setTimeout(() => setVoiceState('AMBIENT_LISTENING'), 5000);
            }
            break;

        case 'COMMAND_MODE':
            clearTimeout(commandResetTimer);
            await parseAndExecuteCommand(finalTranscriptSegment);
            setVoiceState('AMBIENT_LISTENING');
            break;

        case 'DICTATION_MODE':
            fullTranscript += finalTranscriptSegment;
            onTranscriptUpdate(fullTranscript);
            break;
    }
}

async function parseAndExecuteCommand(transcript) {
    const commandPrompt = `
        Analyze the user's command: "${transcript}".
        Convert it into a JSON object with "action" and "params".
        Possible actions: 'create_entry', 'search_notes', 'delete_current', 'edit_current', 'add_image', 'go_back', 'stop_listening'.
        - For 'search_notes', extract the 'query'.
        - If the command is to start a new entry, use 'create_entry'.
        Respond with only the JSON object. Example: {"action": "search_notes", "params": {"query": "hackathon"}}`;

    try {
        // Check if chrome.ai is available
        if (!chrome?.ai?.prompt) {
            console.warn("Chrome AI API not available for command parsing");
            onCommandReceived({ action: 'unknown', error: 'AI API not available' });
            return;
        }

        const result = await chrome.ai.prompt({ prompt: commandPrompt });
        const command = JSON.parse(result.text.trim());
        console.log("Parsed command:", command);

        if (command.action === 'create_entry') {
            setVoiceState('DICTATION_MODE');
        } else {
            onCommandReceived(command);
        }
    } catch (error) {
        console.error("Could not parse command:", error);
        // Send unknown command for UI feedback
        onCommandReceived({ action: 'unknown', error: error.message });
    }
}

function finalizeEntry() {
    if (voiceState !== 'DICTATION_MODE') return;
    console.log("Finalizing entry via Smart Stop");
    onFinalResult(fullTranscript);
    fullTranscript = '';
    setVoiceState('AMBIENT_LISTENING');
}

// --- Public API ---
export function initAIService(callbacks) {
    if (!recognition) return;
    onStateChange = callbacks.onStateChange;
    onCommandReceived = callbacks.onCommandReceived;
    onTranscriptUpdate = callbacks.onTranscriptUpdate;
    onFinalResult = callbacks.onFinalResult;
    setupRecognition();
}

export function startAmbientListening() {
    if (!recognition || voiceState !== 'IDLE') return;
    recognition.start();
    setVoiceState('AMBIENT_LISTENING');
}

export function stopAmbientListening() {
    if (!recognition || voiceState === 'IDLE') return;
    recognition.stop();
    setVoiceState('IDLE');
}