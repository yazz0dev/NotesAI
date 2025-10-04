// js/voice-service.js
// Audio recording storage and playback for dictated notes

/** 
 * Audio service for recording, storing, and playing back journal entry audio
 */

let audioRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let isRecording = false;

/**
 * Initializes the audio recording service
 * @returns {Promise<boolean>} Success status
 */
export async function initAudioService() {
  try {
    // Check for MediaRecorder support
    if (!window.MediaRecorder) {
      console.warn("MediaRecorder not supported");
      return false;
    }

    // Request microphone permission
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    // Create MediaRecorder instance
    audioRecorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType(),
    });

    setupRecorderEvents();

    // Stop the stream for now (will restart when needed)
    stream.getTracks().forEach((track) => track.stop());

    return true;
  } catch (error) {
    console.error("Failed to initialize audio service:", error);
    return false;
  }
}

/**
 * Gets the best supported MIME type for recording
 * @returns {string} MIME type
 */
function getSupportedMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return "audio/webm"; // fallback
}

/**
 * Sets up MediaRecorder event listeners
 */
function setupRecorderEvents() {
  if (!audioRecorder) return;

  audioRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  audioRecorder.onstart = () => {
    console.log("Audio recording started");
    isRecording = true;
    recordingStartTime = Date.now();
    audioChunks = [];
  };

  audioRecorder.onstop = () => {
    console.log("Audio recording stopped");
    isRecording = false;
  };

  audioRecorder.onerror = (event) => {
    console.error("Recording error:", event.error);
    isRecording = false;
  };
}

/**
 * Starts audio recording
 * @returns {Promise<boolean>} Success status
 */
export async function startRecording() {
  try {
    if (isRecording) {
      console.warn("Recording already in progress");
      return false;
    }

    // Request fresh microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
      },
    });

    // Update recorder with fresh stream
    audioRecorder = new MediaRecorder(stream, {
      mimeType: getSupportedMimeType(),
    });

    setupRecorderEvents();

    // Start recording
    audioRecorder.start(1000); // Collect data every second

    return true;
  } catch (error) {
    console.error("Failed to start recording:", error);
    return false;
  }
}

/**
 * Stops audio recording and returns the recorded audio
 * @returns {Promise<Object|null>} Audio data object or null
 */
export async function stopRecording() {
  return new Promise((resolve) => {
    if (!audioRecorder || !isRecording) {
      resolve(null);
      return;
    }

    audioRecorder.onstop = () => {
      const recordingDuration = Date.now() - recordingStartTime;

      if (audioChunks.length === 0) {
        resolve(null);
        return;
      }

      // Create blob from chunks
      const audioBlob = new Blob(audioChunks, {
        type: audioRecorder.mimeType || "audio/webm",
      });

      // Stop all tracks
      audioRecorder.stream?.getTracks().forEach((track) => track.stop());

      // Convert to data URL for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          dataUrl: reader.result,
          blob: audioBlob,
          duration: recordingDuration,
          mimeType: audioRecorder.mimeType || "audio/webm",
          size: audioBlob.size,
          timestamp: Date.now(),
        });
      };
      reader.readAsDataURL(audioBlob);
    };

    audioRecorder.stop();
  });
}

/**
 * Plays back an audio recording
 * @param {string} audioDataUrl - Audio data URL
 * @returns {Promise<HTMLAudioElement>} Audio element
 */
export async function playAudio(audioDataUrl) {
  try {
    const audio = new Audio(audioDataUrl);
    audio.preload = "metadata";

    return new Promise((resolve, reject) => {
      audio.onloadeddata = () => resolve(audio);
      audio.onerror = () => reject(new Error("Failed to load audio"));

      // Auto-play if possible
      audio.play().catch((error) => {
        console.warn("Auto-play prevented:", error);
        // Return audio element anyway so user can manually play
        resolve(audio);
      });
    });
  } catch (error) {
    console.error("Failed to play audio:", error);
    throw error;
  }
}

/**
 * Gets audio duration from data URL
 * @param {string} audioDataUrl - Audio data URL
 * @returns {Promise<number>} Duration in seconds
 */
export async function getAudioDuration(audioDataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio(audioDataUrl);
    audio.onloadedmetadata = () => {
      resolve(audio.duration || 0);
    };
    audio.onerror = () => resolve(0);
  });
}

/**
 * Formats duration in seconds to human-readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "1:23")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Compresses audio data for storage efficiency
 * @param {string} audioDataUrl - Original audio data URL
 * @param {number} quality - Compression quality (0.1 to 1.0)
 * @returns {Promise<string>} Compressed audio data URL
 */
export async function compressAudio(audioDataUrl, quality = 0.7) {
  try {
    // For now, return original data URL
    // In a production app, you might use Web Audio API for compression
    return audioDataUrl;
  } catch (error) {
    console.error("Audio compression failed:", error);
    return audioDataUrl; // Return original on failure
  }
}

/**
 * Estimates storage size for audio data
 * @param {string} audioDataUrl - Audio data URL
 * @returns {number} Estimated size in bytes
 */
export function getAudioSize(audioDataUrl) {
  try {
    // Base64 encoded data is ~33% larger than binary
    const base64Data = audioDataUrl.split(",")[1];
    return Math.floor((base64Data.length * 3) / 4);
  } catch {
    return 0;
  }
}

/**
 * Checks if audio recording is currently in progress
 * @returns {boolean} Recording status
 */
export function isCurrentlyRecording() {
  return isRecording;
}

/**
 * Gets current recording duration if recording is in progress
 * @returns {number} Duration in milliseconds
 */
export function getCurrentRecordingDuration() {
  if (!isRecording || !recordingStartTime) return 0;
  return Date.now() - recordingStartTime;
}

/**
 * Creates an audio player UI component
 * @param {string} audioDataUrl - Audio data URL
 * @param {number} duration - Audio duration in seconds
 * @returns {HTMLElement} Audio player element
 */
export function createAudioPlayer(audioDataUrl, duration = 0) {
  const playerContainer = document.createElement("div");
  playerContainer.className = "audio-player";

  const durationText = formatDuration(duration);

  playerContainer.innerHTML = `
        <button class="audio-play-btn" title="Play recording">
            <span class="play-icon"><span class="iconify" data-icon="material-symbols:play-arrow"></span></span>
            <span class="pause-icon" style="display: none;"><span class="iconify" data-icon="material-symbols:pause"></span></span>
        </button>
        <div class="audio-info">
            <div class="audio-waveform"><span class="iconify" data-icon="material-symbols:music-note"></span> Voice Recording</div>
            <div class="audio-duration">${durationText}</div>
        </div>
        <button class="audio-download-btn" title="Download recording">
            <span class="iconify" data-icon="material-symbols:download"></span>
        </button>
    `;

  // Add event listeners
  const playBtn = playerContainer.querySelector(".audio-play-btn");
  const playIcon = playerContainer.querySelector(".play-icon");
  const pauseIcon = playerContainer.querySelector(".pause-icon");
  const downloadBtn = playerContainer.querySelector(".audio-download-btn");

  let audioElement = null;
  let isPlaying = false;

  playBtn.addEventListener("click", async () => {
    try {
      if (!audioElement) {
        audioElement = new Audio(audioDataUrl);
        audioElement.onended = () => {
          isPlaying = false;
          playIcon.style.display = "inline";
          pauseIcon.style.display = "none";
        };
      }

      if (isPlaying) {
        audioElement.pause();
        isPlaying = false;
        playIcon.style.display = "inline";
        pauseIcon.style.display = "none";
      } else {
        await audioElement.play();
        isPlaying = true;
        playIcon.style.display = "none";
        pauseIcon.style.display = "inline";
      }
    } catch (error) {
      console.error("Failed to play audio:", error);
    }
  });

  downloadBtn.addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = audioDataUrl;
    link.download = `journal-recording-${Date.now()}.webm`;
    link.click();
  });

  return playerContainer;
}

/**
 * Stores audio data in IndexedDB
 * @param {string} entryId - Journal entry ID
 * @param {Object} audioData - Audio data object
 * @returns {Promise<boolean>} Success status
 */
export async function storeAudioData(entryId, audioData) {
  try {
    // Open IndexedDB for audio storage
    const request = indexedDB.open("AI_JournalAudio", 1);

    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("audioRecordings")) {
          db.createObjectStore("audioRecordings", { keyPath: "entryId" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction(["audioRecordings"], "readwrite");
        const store = transaction.objectStore("audioRecordings");

        const audioRecord = {
          entryId,
          audioDataUrl: audioData.dataUrl,
          duration: audioData.duration,
          mimeType: audioData.mimeType,
          size: audioData.size,
          timestamp: audioData.timestamp,
        };

        const addRequest = store.put(audioRecord);
        addRequest.onsuccess = () => resolve(true);
        addRequest.onerror = () => reject(addRequest.error);
      };
    });
  } catch (error) {
    console.error("Failed to store audio data:", error);
    return false;
  }
}

/**
 * Retrieves audio data from IndexedDB
 * @param {string} entryId - Journal entry ID
 * @returns {Promise<Object|null>} Audio data or null
 */
export async function getAudioData(entryId) {
  try {
    const request = indexedDB.open("AI_JournalAudio", 1);

    return new Promise((resolve, reject) => {
      request.onerror = () => resolve(null);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("audioRecordings")) {
          db.createObjectStore("audioRecordings", { keyPath: "entryId" });
        }
      };

      request.onsuccess = (event) => {
        const db = event.target.result;

        // Check if the object store exists before creating transaction
        if (!db.objectStoreNames.contains("audioRecordings")) {
          resolve(null);
          return;
        }

        const transaction = db.transaction(["audioRecordings"], "readonly");
        const store = transaction.objectStore("audioRecordings");

        const getRequest = store.get(entryId);
        getRequest.onsuccess = () => resolve(getRequest.result || null);
        getRequest.onerror = () => resolve(null);
      };
    });
  } catch (error) {
    console.error("Failed to retrieve audio data:", error);
    return null;
  }
}
