class AIService {
    constructor() {
      this.ambientRecognition = null;
      this.dictationRecognition = null;
      this.mediaRecorder = null;
      this.audioChunks = [];
      this.isAmbientListening = false;
      this.isDictating = false;
    }
  
    init() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        console.warn("Speech Recognition not supported.");
        this.dispatchAIEvent("ai-status-update", { status: "disabled", message: "Speech not supported" });
        return;
      }
      this.setupAmbientRecognition(SpeechRecognition);
    }
  
    // --- AMBIENT LISTENING FOR "HEY NOTES" ---
    setupAmbientRecognition(SpeechRecognition) {
      this.ambientRecognition = new SpeechRecognition();
      this.ambientRecognition.continuous = true;
      this.ambientRecognition.interimResults = false; // We only care about the final result for commands
  
      this.ambientRecognition.onstart = () => {
          this.isAmbientListening = true;
          this.dispatchAIEvent("ai-status-update", { status: "listening", message: "Listening for 'Hey Notes'..." });
      };
      this.ambientRecognition.onend = () => {
        this.isAmbientListening = false;
        // If handsFreeMode is on and we are not in a dictation session, restart.
        if (localStorage.getItem("handsFreeMode") === "true" && !this.isDictating) {
          setTimeout(() => this.startAmbientListening(), 500);
        }
      };
      this.ambientRecognition.onerror = (e) => console.error("Ambient recognition error:", e.error);
      this.ambientRecognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        if (transcript.includes("hey notes")) {
          this.processCommand(transcript);
        }
      };
    }
  
    processCommand(transcript) {
      this.dispatchAIEvent("ai-status-update", { status: "active", message: `Command received...` });
      if (transcript.includes("new note") || transcript.includes("create note")) {
        const content = transcript.replace(/.*(new note|create note)/, "").trim();
        this.dispatchAIEvent("ai-create-note", { content });
      } else if (transcript.includes("search for")) {
        const query = transcript.replace(/.*search for/, "").trim();
        this.dispatchAIEvent("ai-search", { query });
      }
    }
  
    startAmbientListening() {
      if (this.ambientRecognition && !this.isAmbientListening) {
        try {
          this.ambientRecognition.start();
        } catch (e) { /* Ignore errors if already started */ }
      }
    }
  
    stopAmbientListening() {
      if (this.ambientRecognition && this.isAmbientListening) {
        this.ambientRecognition.stop();
      }
    }
  
    // --- ACTIVE DICTATION & RECORDING ---
    async startDictation() {
      if (this.isDictating) return;
      
      // CRITICAL FIX: Ensure ambient listening is stopped before starting dictation.
      this.stopAmbientListening(); 
  
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;
  
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.dictationRecognition = new SpeechRecognition();
        this.audioChunks = [];
  
        this.mediaRecorder.ondataavailable = (e) => this.audioChunks.push(e.data);
        this.mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
          const audioDataUrl = await this.blobToDataURL(audioBlob);
          this.dispatchAIEvent("ai-dictation-finished", { audioUrl: audioDataUrl });
          stream.getTracks().forEach((track) => track.stop());
        };
  
        this.dictationRecognition.continuous = true;
        this.dictationRecognition.interimResults = true;
        this.dictationRecognition.onresult = (e) => {
          let transcript = "";
          for (let i = e.resultIndex; i < e.results.length; ++i) {
            transcript += e.results[i][0].transcript;
          }
          this.dispatchAIEvent("ai-dictation-update", { transcript });
          // Update status to show current transcript
          const displayText = transcript.length > 50 ? transcript.substring(0, 50) + "..." : transcript;
          this.dispatchAIEvent("ai-status-update", { status: "recording", message: `Dictating: "${displayText}"` });
        };
        this.dictationRecognition.onend = () => this.stopDictation(); // Auto-stop everything together
  
        this.mediaRecorder.start();
        this.dictationRecognition.start();
        this.isDictating = true;
        this.dispatchAIEvent("ai-dictation-started");
        this.dispatchAIEvent("ai-status-update", { status: "recording", message: "Dictating..." });
      } catch (error) {
        console.error("Dictation failed to start:", error);
        this.dispatchAIEvent("ai-status-update", { status: "error", message: "Mic access denied" });
        this.startAmbientListening(); // Restart ambient if dictation fails
      }
    }
  
    stopDictation() {
      if (!this.isDictating) return;
      if (this.dictationRecognition) this.dictationRecognition.stop();
      if (this.mediaRecorder && this.mediaRecorder.state === "recording") this.mediaRecorder.stop();
      this.isDictating = false;
  
      // CRITICAL FIX: Restart ambient listening after dictation is finished.
      this.startAmbientListening();
    }
  
    // --- ON-DEVICE AI ANALYSIS ---
    async analyzeNote(content) {
      if (!content || !chrome.ai) {
        return { topics: [], sentiment: "neutral" };
      }
      this.dispatchAIEvent("ai-status-update", { status: "processing", message: "Analyzing note..." });
      try {
        const session = await chrome.ai.createTextSession();
        const prompt = `Analyze this text. Extract up to 3 topics as a JSON array of strings, and determine the sentiment (positive, negative, or neutral). Respond ONLY with a valid JSON object like {"topics": [...], "sentiment": "..."}. Text: "${content.substring(0, 1500)}"`;
        let response = await session.prompt(prompt);
        response = response.replace(/```json/g, "").replace(/```/g, "").trim();
        const result = JSON.parse(response);
        return { topics: result.topics || [], sentiment: result.sentiment || "neutral" };
      } catch (error) {
        console.error("AI analysis failed:", error);
        this.dispatchAIEvent("ai-status-update", { status: "error", message: "AI analysis failed." });
        return { topics: [], sentiment: "neutral" };
      }
    }
  
    // --- HELPERS ---
    dispatchAIEvent(name, detail) {
      window.dispatchEvent(new CustomEvent(name, { detail }));
    }
    blobToDataURL(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  }
  
  const aiService = new AIService();
  export default aiService;