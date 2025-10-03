// js/goals-ui.js
// Goals and habits UI management functions

import {
  getAllGoals,
  createGoal,
  recordProgress,
  getGoalsDueToday,
  generateGoalInsights,
  GOAL_TYPES,
  GOAL_STATUS,
} from "../services/goals-service.js";

let currentEditingGoal = null;

// Track if modal should close after form submission
let shouldCloseAfterSubmission = false;

/**
 * Shows the goals modal with dashboard or form
 * @param {boolean} showForm - Whether to show the form (true) or dashboard (false)
 * @param {boolean} fromSettings - Whether called from settings (removes add goal button from dashboard)
 * @param {boolean} closeAfterSubmit - Whether to close modal after form submission
 */
export async function showGoalsModal(
  showForm = false,
  fromSettings = false,
  closeAfterSubmit = false
) {
  const modal = document.getElementById("goals-modal");
  const modalTitle = modal.querySelector(".modal-title");
  const modalActions = document.getElementById("goals-modal-actions");
  const addNewGoalBtn = document.getElementById("add-new-goal-btn");

  shouldCloseAfterSubmission = closeAfterSubmit;

  // Update modal title based on what we're showing
  if (showForm) {
    modalTitle.textContent = "Add New Goal";
    showGoalForm();

    // When showing form from settings, hide modal actions completely
    if (fromSettings && modalActions) {
      modalActions.classList.add("hidden");
    }
  } else {
    modalTitle.textContent = "Goals & Habits";
    hideGoalForm();
    await loadGoalsDashboard();

    // When showing dashboard from settings, hide the "Add Goal" button
    if (fromSettings && addNewGoalBtn) {
      addNewGoalBtn.style.display = "none";
    }
  }

  // Show modal after content is ready
  modal.classList.remove("hidden");
}

/**
 * Hides the goals modal
 */
export function hideGoalsModal() {
  const modal = document.getElementById("goals-modal");
  const modalTitle = modal.querySelector(".modal-title");
  const modalActions = document.getElementById("goals-modal-actions");
  const addNewGoalBtn = document.getElementById("add-new-goal-btn");

  modal.classList.add("hidden");
  hideGoalForm();

  // Reset modal actions visibility
  if (modalActions) {
    modalActions.classList.remove("hidden");
  }

  // Reset "Add Goal" button visibility
  if (addNewGoalBtn) {
    addNewGoalBtn.style.display = "block";
  }

  modalTitle.textContent = "Goals & Habits"; // Reset to default title
  shouldCloseAfterSubmission = false; // Reset flag
  currentEditingGoal = null;
}

/**
 * Shows the goal form for adding/editing
 */
export function showGoalForm(goal = null) {
  const form = document.getElementById("goal-form");
  const dashboard = document.getElementById("goals-dashboard");
  const actions = document.getElementById("goals-modal-actions");
  const formTitle = document.getElementById("goal-form-title");

  form.classList.remove("hidden");
  dashboard.classList.add("hidden");
  actions.classList.add("hidden");

  currentEditingGoal = goal;

  if (goal) {
    formTitle.textContent = "Edit Goal";
    populateGoalForm(goal);
  } else {
    formTitle.textContent = "Add New Goal";
    resetGoalForm();
  }
}

/**
 * Hides the goal form
 */
export function hideGoalForm() {
  const form = document.getElementById("goal-form");
  const dashboard = document.getElementById("goals-dashboard");
  const actions = document.getElementById("goals-modal-actions");

  form.classList.add("hidden");
  dashboard.classList.remove("hidden");
  actions.classList.remove("hidden");

  resetGoalForm();
}

/**
 * Populates the goal form with existing goal data
 */
function populateGoalForm(goal) {
  document.getElementById("goal-title-input").value = goal.title;
  document.getElementById("goal-description-input").value =
    goal.description || "";
  document.getElementById("goal-type-select").value = goal.type;
  document.getElementById("goal-category-input").value = goal.category || "";
  document.getElementById("goal-frequency-select").value =
    goal.frequency || "daily";
  document.getElementById("goal-target-input").value = goal.targetValue || 1;

  if (goal.targetDate) {
    document.getElementById("goal-target-date-input").value =
      goal.targetDate.split("T")[0];
  }

  handleGoalTypeChange();
}

/**
 * Resets the goal form
 */
function resetGoalForm() {
  document.getElementById("goal-form-element").reset();
  document.getElementById("goal-target-input").value = 1;
  handleGoalTypeChange();
}

/**
 * Handles goal type selection changes
 */
export function handleGoalTypeChange() {
  const type = document.getElementById("goal-type-select").value;
  const habitOptions = document.getElementById("habit-options");
  const targetDateGroup = document.getElementById("target-date-group");

  if (type === "habit") {
    habitOptions.style.display = "flex";
    targetDateGroup.style.display = "none";
  } else {
    habitOptions.style.display = "none";
    targetDateGroup.style.display = "block";
  }
}

/**
 * Handles goal form submission
 */
export async function handleGoalFormSubmit(event, notes = []) {
  event.preventDefault();

  const saveBtn = document.getElementById("save-goal-btn");
  const originalText = saveBtn.textContent;

  try {
    saveBtn.disabled = true;
    saveBtn.textContent = "⏳ Saving...";

    const formData = {
      title: document.getElementById("goal-title-input").value.trim(),
      description: document
        .getElementById("goal-description-input")
        .value.trim(),
      type: document.getElementById("goal-type-select").value,
      category: document.getElementById("goal-category-input").value.trim(),
      frequency: document.getElementById("goal-frequency-select").value,
      targetValue:
        parseInt(document.getElementById("goal-target-input").value) || 1,
      targetDate:
        document.getElementById("goal-target-date-input").value || null,
    };

    await createGoal(formData);

    // If should close after submission, close modal
    // Otherwise, show dashboard as usual
    if (shouldCloseAfterSubmission) {
      hideGoalsModal();
    } else {
      hideGoalForm();
      await loadGoalsDashboard(notes);
    }
  } catch (error) {
    console.error("Error saving goal:", error);
    alert("Failed to save goal. Please try again.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

/**
 * Loads and displays the goals dashboard
 */
export async function loadGoalsDashboard(notes = []) {
  try {
    const goals = await getAllGoals();

    const activeGoals = goals.filter((g) => g.status === GOAL_STATUS.ACTIVE);
    const completedGoals = goals.filter(
      (g) => g.status === GOAL_STATUS.COMPLETED
    );
    const totalStreaks = goals
      .filter((g) => g.type === GOAL_TYPES.HABIT)
      .reduce((sum, goal) => sum + (goal.streakCount || 0), 0);

    document.getElementById("active-goals-count").textContent =
      activeGoals.length;
    document.getElementById("completed-goals-count").textContent =
      completedGoals.length;
    document.getElementById("total-streak-count").textContent = totalStreaks;

    const insights = await generateGoalInsights(goals, notes.slice(0, 3));
    renderGoalInsights(insights);
    renderGoalsList(goals, notes);
  } catch (error) {
    console.error("Error loading goals dashboard:", error);
  }
}

/**
 * Renders AI-generated goal insights
 */
function renderGoalInsights(insights) {
  const insightsContainer = document.getElementById("goals-insights");

  if (!insights || insights.totalGoals === 0) {
    insightsContainer.classList.add("hidden");
    return;
  }

  insightsContainer.classList.remove("hidden");
  insightsContainer.innerHTML = `
        <div class="insight-summary">${insights.summary}</div>
        <div class="insight-sections">
            <div class="insight-section">
                <h4>💪 Strengths</h4>
                <ul>
                    ${insights.strengths
                      .map((strength) => `<li>${strength}</li>`)
                      .join("")}
                </ul>
            </div>
            <div class="insight-section">
                <h4>🌱 Opportunities</h4>
                <ul>
                    ${insights.opportunities
                      .map((opp) => `<li>${opp}</li>`)
                      .join("")}
                </ul>
            </div>
        </div>
        ${
          insights.streakHighlight
            ? `
            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0, 122, 255, 0.1); border-radius: 6px; color: var(--accent-color); font-weight: 500; text-align: center;">
                🔥 ${insights.streakHighlight}
            </div>
        `
            : ""
        }
    `;
}

/**
 * Renders the goals list
 */
function renderGoalsList(goals, notes = []) {
  const goalsList = document.getElementById("goals-list");

  if (goals.length === 0) {
    goalsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                <p>No goals yet. Create your first goal to start tracking your progress!</p>
            </div>
        `;
    return;
  }

  goalsList.innerHTML = goals.map((goal) => createGoalItemHTML(goal)).join("");

  goals.forEach((goal) => {
    const element = goalsList.querySelector(`[data-goal-id="${goal.id}"]`);
    if (element) {
      const progressBtn = element.querySelector(".goal-progress-btn");
      if (progressBtn) {
        progressBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          handleGoalProgress(goal.id, notes);
        });
      }

      const editBtn = element.querySelector(".goal-edit-btn");
      if (editBtn) {
        editBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showGoalForm(goal);
        });
      }
    }
  });
}

/**
 * Creates HTML for a goal item
 */
function createGoalItemHTML(goal) {
  const progressPercent = goal.targetValue
    ? Math.min(100, (goal.currentValue / goal.targetValue) * 100)
    : 0;

  const isCompleted = goal.status === GOAL_STATUS.COMPLETED;
  const progressText = goal.targetValue
    ? `${goal.currentValue}/${goal.targetValue}`
    : goal.currentValue.toString();

  return `
        <div class="goal-item ${
          isCompleted ? "completed" : ""
        }" data-goal-id="${goal.id}">
            <div class="goal-header">
                <h4 class="goal-title">${goal.title}</h4>
                <span class="goal-type-badge ${goal.type}">${goal.type}</span>
            </div>
            ${
              goal.description
                ? `<div class="goal-description">${goal.description}</div>`
                : ""
            }
            <div class="goal-progress">
                <div class="goal-progress-bar">
                    <div class="goal-progress-fill" style="width: ${progressPercent}%"></div>
                </div>
                <span class="goal-progress-text">${progressText}</span>
            </div>
            ${
              goal.type === GOAL_TYPES.HABIT && goal.streakCount > 0
                ? `
                <div class="goal-streak">🔥 ${goal.streakCount} day streak</div>
            `
                : ""
            }
            <div class="goal-actions">
                ${
                  !isCompleted
                    ? `
                    <button class="goal-action-btn primary goal-progress-btn">
                        ${
                          goal.type === GOAL_TYPES.HABIT
                            ? "✅ Mark Done"
                            : "➕ Add Progress"
                        }
                    </button>
                `
                    : ""
                }
                <button class="goal-action-btn goal-edit-btn">✏️ Edit</button>
            </div>
        </div>
    `;
}

/**
 * Handles goal progress recording
 */
export async function handleGoalProgress(goalId, notes = []) {
  try {
    await recordProgress(goalId, 1, "");
    await loadGoalsDashboard(notes);

    const goalElement = document.querySelector(`[data-goal-id="${goalId}"]`);
    if (goalElement) {
      goalElement.style.animation = "gentle-pulse 0.5s ease-out";
      setTimeout(() => {
        goalElement.style.animation = "";
      }, 500);
    }
  } catch (error) {
    console.error("Error recording progress:", error);
    alert("Failed to record progress. Please try again.");
  }
}

/**
 * Checks for goals due today and shows reminders
 */
export async function checkGoalsDueToday() {
  try {
    const goalsDue = await getGoalsDueToday();
    const goalsToday = document.getElementById("goals-today");

    if (goalsDue.length > 0 && goalsToday) {
      goalsToday.innerHTML = `
                <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">📅 Due Today</h4>
                ${goalsDue
                  .map(
                    (goal) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.9rem; color: var(--text-primary);">${
                          goal.title
                        }</span>
                        <button data-goal-id="${
                          goal.id
                        }" class="quick-progress-btn"
                                style="padding: 0.25rem 0.5rem; background: var(--accent-color); color: white; border: none; border-radius: 4px; font-size: 0.8rem; cursor: pointer;">
                            ${
                              goal.type === GOAL_TYPES.HABIT
                                ? "Done"
                                : "Progress"
                            }
                        </button>
                    </div>
                `
                  )
                  .join("")}
            `;

      goalsToday.querySelectorAll(".quick-progress-btn").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const goalId = e.target.getAttribute("data-goal-id");
          handleGoalProgress(goalId);
        });
      });

      goalsToday.classList.remove("hidden");
    } else if (goalsToday) {
      goalsToday.classList.add("hidden");
    }
  } catch (error) {
    console.error("Error checking goals due today:", error);
  }
}
