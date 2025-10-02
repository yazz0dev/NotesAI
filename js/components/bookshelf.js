// js/components/bookshelf.js
// Bookshelf rendering and card management

import { formatDate } from "../utils/utils.js";
import {
  analyzeSentiment,
  extractTopics,
  extractFirstImage,
} from "../services/ai-insights.js";
import { getAudioData } from "../services/audio-service.js";

// --- DOM Element Selectors ---
export const bookshelfContainerEl = document.getElementById(
  "bookshelf-container"
);
const emptyStateContainerEl = document.getElementById("empty-state-container");

// --- Bookshelf Functions ---

/**
 * Clears all shelves from the bookshelf view.
 */
function clearBookshelfView() {
  const shelves = bookshelfContainerEl.querySelectorAll(".shelf");
  shelves.forEach((shelf) => shelf.remove());
}

/**
 * Renders the welcome message for new users.
 */
function renderWelcomeCard() {
  clearBookshelfView();
  emptyStateContainerEl.innerHTML = `
        <h2 class="empty-state-title">Welcome to Your AI Journal</h2>
        <p class="empty-state-text">
            This is your private space. Click the microphone below or simply say <strong>"Okay Journal"</strong> to start your first entry.
        </p>
    `;
  emptyStateContainerEl.classList.remove("hidden");
}

/**
 * Shows a message when a search yields no results.
 * @param {string} query - The search query that returned no results
 */
export function showEmptySearchState(query) {
  clearBookshelfView();
  emptyStateContainerEl.innerHTML = `
        <h2 class="empty-state-title">No entries found</h2>
        <p class="empty-state-text">No journal entries match "${query}". Try a different search term or create a new entry.</p>
    `;
  emptyStateContainerEl.classList.remove("hidden");
}

/**
 * Creates the HTML for a journal card with AI insights and visual enhancements.
 * @param {Object} note - The note object with AI insights
 * @param {number} index - The card index for color assignment
 * @returns {string} HTML string for the card
 */
function createCardHTML(note, index) {
  const cardColors = [
    "--book-color-1",
    "--book-color-2",
    "--book-color-3",
    "--book-color-4",
    "--book-color-5",
  ];
  const colorVar = cardColors[index % cardColors.length];

  // Extract first image if available
  const firstImage = extractFirstImage(note.content);

  // Format sentiment for display
  const sentimentEmoji = {
    positive: "😊",
    negative: "😔",
    neutral: "😐",
  };

  // Format topics as tags
  const topicTags =
    note.topics && note.topics.length > 0
      ? note.topics
          .slice(0, 3)
          .map((topic) => `<span class="topic-tag">${topic}</span>`)
          .join("")
      : "";

  // Check for audio indicator
  const audioIndicator = note.hasAudio
    ? '<div class="card-audio-indicator" title="Has audio recording">🎵</div>'
    : "";

  return `
        <div class="journal-card" data-note-id="${
          note.id
        }" style="--card-color: var(${colorVar})">
            <div class="card-header">
                <div class="card-date">${formatDate(note.createdAt)}</div>
                <div class="card-indicators">
                    ${
                      note.sentiment
                        ? `<div class="sentiment-indicator" title="${
                            note.sentiment.sentiment
                          }">${
                            sentimentEmoji[note.sentiment.sentiment] || "😐"
                          }</div>`
                        : ""
                    }
                    ${audioIndicator}
                </div>
            </div>
            
            ${
              firstImage
                ? `
                <div class="card-image-preview">
                    <img src="${firstImage}" alt="Entry preview" class="card-thumbnail">
                </div>
            `
                : ""
            }
            
            <div class="card-content">
                <h3 class="card-title">${note.summary || "A Journal Entry"}</h3>
                <p class="card-preview">${note.content
                  .replace(/<[^>]*>/g, "")
                  .substring(0, 120)}${
    note.content.length > 120 ? "..." : ""
  }</p>
            </div>
            
            ${
              topicTags
                ? `
                <div class="card-topics">
                    ${topicTags}
                </div>
            `
                : ""
            }
            
            <div class="card-footer">
                <div class="card-stats">
                    <span class="word-count">${
                      note.content.split(" ").length
                    } words</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Renders all journal entries as cards on shelves with AI insights.
 * @param {Array<Object>} notes - The array of note objects to render.
 */
export async function renderBookshelf(notes) {
  clearBookshelfView();
  emptyStateContainerEl.classList.add("hidden");

  if (notes.length === 0) {
    renderWelcomeCard();
    return;
  }

  let currentShelf;
  const cardsPerShelf = Math.floor(bookshelfContainerEl.clientWidth / 272) || 4;

  // Process notes with AI insights and audio check
  const processedNotes = await Promise.all(
    notes.map(async (note, index) => {
      const [sentiment, topics, audioData] = await Promise.all([
        analyzeSentiment(note.content),
        extractTopics(note.content),
        getAudioData(note.id).catch(() => null), // Don't fail if no audio
      ]);
      return {
        ...note,
        sentiment,
        topics,
        hasAudio: !!audioData,
        index,
      };
    })
  );

  processedNotes.forEach((note, cardIndex) => {
    if (cardIndex % cardsPerShelf === 0) {
      currentShelf = document.createElement("div");
      currentShelf.className = "shelf";

      // Create cards container for this shelf
      const cardsContainer = document.createElement("div");
      cardsContainer.className = "shelf-cards";

      currentShelf.appendChild(cardsContainer);
      bookshelfContainerEl.appendChild(currentShelf);
    }

    const cardElement = document.createElement("div");
    cardElement.innerHTML = createCardHTML(note, cardIndex);
    const card = cardElement.firstElementChild;

    // Add click handler for opening the book
    card.addEventListener("click", () => {
      // Dispatch custom event that main.js can listen to
      window.dispatchEvent(new CustomEvent("openBook", { detail: note }));
    });

    // Add enhanced hover effects with JavaScript
    card.addEventListener("mouseenter", () => {
      // Add a slight random variation for more organic feel
      const randomDelay = Math.random() * 200;
      setTimeout(() => {
        card.style.animationPlayState = "paused";
        card.classList.add("hover-active");
      }, randomDelay);
    });

    card.addEventListener("mouseleave", () => {
      card.style.animationPlayState = "running";
      card.classList.remove("hover-active");
      // Reset any inline transforms
      card.style.transform = "";
    });

    // Add card to the shelf's cards container
    const cardsContainer = currentShelf?.querySelector(".shelf-cards");
    if (cardsContainer) {
      cardsContainer.appendChild(card);
    }
  });
}

/**
 * Prepends a new card to the bookshelf (for newly created entries).
 * @param {Object} note - The note object to add
 */
export async function prependCard(note) {
  // Process the note with AI insights
  const [sentiment, topics, audioData] = await Promise.all([
    analyzeSentiment(note.content),
    extractTopics(note.content),
    getAudioData(note.id).catch(() => null),
  ]);

  const processedNote = {
    ...note,
    sentiment,
    topics,
    hasAudio: !!audioData,
    index: 0,
  };

  // Hide empty state if it's showing
  emptyStateContainerEl.classList.add("hidden");

  // Get or create the first shelf
  let firstShelf = bookshelfContainerEl.querySelector(".shelf");
  if (!firstShelf) {
    firstShelf = document.createElement("div");
    firstShelf.className = "shelf";

    // Create cards container for this shelf
    const cardsContainer = document.createElement("div");
    cardsContainer.className = "shelf-cards";

    firstShelf.appendChild(cardsContainer);
    bookshelfContainerEl.appendChild(firstShelf);
  }

  // Get the cards container
  const cardsContainer = firstShelf?.querySelector(".shelf-cards");
  if (!cardsContainer) {
    console.error("Failed to find or create cards container for shelf");
    return;
  }

  // Create and insert the new card
  const cardElement = document.createElement("div");
  cardElement.innerHTML = createCardHTML(processedNote, 0);
  const card = cardElement.firstElementChild;

  // Add click handler
  card.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("openBook", { detail: processedNote })
    );
  });

  // Add enhanced hover effects with JavaScript
  card.addEventListener("mouseenter", () => {
    // Add a slight random variation for more organic feel
    const randomDelay = Math.random() * 200;
    setTimeout(() => {
      card.style.animationPlayState = "paused";
      card.classList.add("hover-active");
    }, randomDelay);
  });

  card.addEventListener("mouseleave", () => {
    card.style.animationPlayState = "running";
    card.classList.remove("hover-active");
    // Reset any inline transforms
    card.style.transform = "";
  });

  // Insert at the beginning with animation
  card.style.opacity = "0";
  card.style.transform = "translateY(-20px)";
  cardsContainer.insertBefore(card, cardsContainer.firstChild);

  // Animate in
  requestAnimationFrame(() => {
    card.style.transition = "all 0.5s ease-out";
    card.style.opacity = "1";
    card.style.transform = "";
  });

  // Reorganize cards if shelf is too full
  const cardsPerShelf = Math.floor(bookshelfContainerEl.clientWidth / 272) || 4;
  const allCards = Array.from(
    bookshelfContainerEl.querySelectorAll(".journal-card")
  );

  if (allCards.length > cardsPerShelf) {
    // Redistribute cards across shelves properly
    const shelves = bookshelfContainerEl.querySelectorAll(".shelf");
    shelves.forEach((shelf) => shelf.remove());

    // Re-render with proper distribution
    let currentShelf;
    let currentCardsContainer;

    allCards.forEach((card, index) => {
      if (index % cardsPerShelf === 0) {
        currentShelf = document.createElement("div");
        currentShelf.className = "shelf";

        currentCardsContainer = document.createElement("div");
        currentCardsContainer.className = "shelf-cards";

        currentShelf.appendChild(currentCardsContainer);
        bookshelfContainerEl.appendChild(currentShelf);
      }

      // Ensure card is properly positioned in the new container
      if (currentCardsContainer && card) {
        currentCardsContainer.appendChild(card);
      }
    });
  }
}
