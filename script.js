// =========================================================
// CONFIG
// =========================================================
const API_URL = "http://127.0.0.1:8000/predict";

// Easy-to-edit score interpretation ranges.
// Adjust these if your model's actual output range differs.
const SCORE_RANGES = [
  { max: 3, label: "Low", color: "var(--color-danger)",
    text: "Your responses suggest lifestyle and stress factors that may be weighing on your wellbeing. Small, consistent changes to sleep and screen time can help." },
  { max: 5, label: "Moderate", color: "var(--color-warn)",
    text: "There's a mix of supportive and strained habits here. A closer look at sleep, study balance and social media use could help push this higher." },
  { max: 7, label: "Good", color: "var(--color-accent-2)",
    text: "Your habits are broadly supportive of your wellbeing, with some room to fine-tune sleep, activity, or screen time." },
  { max: 10, label: "Very Good", color: "var(--color-accent)",
    text: "Your lifestyle signals point to strong overall wellbeing. Keep the habits that are working for you." },
];

// =========================================================
// DOM REFERENCES
// =========================================================
const form = document.getElementById("predictionForm");
const submitBtn = document.getElementById("submitBtn");
const formError = document.getElementById("formError");
const resultCard = document.getElementById("resultCard");
const scoreValueEl = document.getElementById("scoreValue");
const scoreCategoryEl = document.getElementById("scoreCategory");
const scoreExplainerEl = document.getElementById("scoreExplainer");
const gaugeEl = document.getElementById("gauge");

const navToggle = document.getElementById("navToggle");
const navbar = document.querySelector(".navbar");

// =========================================================
// MOBILE NAV
// =========================================================
if (navToggle && navbar) {
  navToggle.addEventListener("click", () => {
    const isOpen = navbar.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.querySelectorAll(".mobile-nav a").forEach((link) => {
    link.addEventListener("click", () => {
      navbar.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

// =========================================================
// FORM SUBMISSION
// =========================================================
form.addEventListener("submit", handleSubmit);

async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const { data, invalidFields } = collectAndValidate();

  if (invalidFields.length > 0) {
    invalidFields.forEach((field) => field.classList.add("is-invalid"));
    showError("Please fill in all fields with valid values before submitting.");
    invalidFields[0].focus();
    return;
  }

  setLoading(true);

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const result = await response.json();

    if (
      result === null ||
      typeof result !== "object" ||
      typeof result.predicted_mental_health_score !== "number" ||
      Number.isNaN(result.predicted_mental_health_score)
    ) {
      throw new Error("INVALID_RESPONSE");
    }

    displayResult(result.predicted_mental_health_score);
  } catch (err) {
    handleError(err);
  } finally {
    setLoading(false);
  }
}

// =========================================================
// VALIDATION
// =========================================================
function collectAndValidate() {
  const fields = {
    age: form.age,
    gender: form.gender,
    country: form.country,
    academicLevel: form.academicLevel,
    platform: form.platform,
    purpose: form.purpose,
    usageHours: form.usageHours,
    dailyUnlocks: form.dailyUnlocks,
    studyHours: form.studyHours,
    activityHours: form.activityHours,
    sleepHours: form.sleepHours,
    stressLevel: form.stressLevel,
  };

  const invalidFields = [];

  Object.values(fields).forEach((el) => el.classList.remove("is-invalid"));

  const numericChecks = [
    [fields.age, 0, 100],
    [fields.usageHours, 0, 24],
    [fields.dailyUnlocks, 0, Infinity],
    [fields.studyHours, 0, 24],
    [fields.activityHours, 0, 24],
    [fields.sleepHours, 0, 24],
  ];

  numericChecks.forEach(([el, min, max]) => {
    const value = el.value.trim();
    const num = Number(value);
    if (value === "" || Number.isNaN(num) || num < min || num > max) {
      invalidFields.push(el);
    }
  });

  const selectChecks = [
    fields.gender,
    fields.country,
    fields.academicLevel,
    fields.platform,
    fields.purpose,
    fields.stressLevel,
  ];

  selectChecks.forEach((el) => {
    if (!el.value) {
      invalidFields.push(el);
    }
  });

  const data = {
    age: Number(fields.age.value),
    gender: fields.gender.value,
    country: fields.country.value,
    academic_level: fields.academicLevel.value,
    most_used_platform: fields.platform.value,
    purpose_of_use: fields.purpose.value,
    avg_daily_usage_hours: Number(fields.usageHours.value),
    daily_unlocks: Number(fields.dailyUnlocks.value),
    study_hours: Number(fields.studyHours.value),
    physical_activity_hours: Number(fields.activityHours.value),
    sleep_hours_per_night: Number(fields.sleepHours.value),
    stress_level: fields.stressLevel.value,
  };

  return { data, invalidFields };
}

// =========================================================
// RESULT DISPLAY
// =========================================================
function displayResult(score) {
  const clamped = Math.max(0, Math.min(10, score));
  const range = SCORE_RANGES.find((r) => clamped <= r.max) || SCORE_RANGES[SCORE_RANGES.length - 1];

  scoreValueEl.textContent = clamped.toFixed(2);
  scoreCategoryEl.textContent = range.label;
  scoreExplainerEl.textContent = range.text;

  gaugeEl.style.setProperty("--gauge-color", range.color);
  gaugeEl.style.setProperty("--gauge-pct", "0");
  // animate the gauge fill on the next frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gaugeEl.style.setProperty("--gauge-pct", String((clamped / 10) * 100));
    });
  });

  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "center" });
}

// =========================================================
// LOADING STATE
// =========================================================
function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle("is-loading", isLoading);
  submitBtn.querySelector(".btn__label").textContent = isLoading
    ? "Predicting..."
    : "Predict Mental Health Score";
}

// =========================================================
// ERROR HANDLING
// =========================================================
function handleError(err) {
  let message = "Something went wrong while getting your prediction. Please try again.";

  if (err instanceof TypeError) {
    // fetch throws TypeError on network failure / server unreachable
    message = "Unable to connect to the prediction server. Please make sure the FastAPI backend is running.";
  } else if (err instanceof Error && err.message.startsWith("HTTP_")) {
    const status = err.message.replace("HTTP_", "");
    message = `The server responded with an error (status ${status}). Please check your inputs and try again.`;
  } else if (err instanceof Error && err.message === "INVALID_RESPONSE") {
    message = "The server returned an unexpected response. Please try again shortly.";
  }

  showError(message);
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideError() {
  formError.hidden = true;
  formError.textContent = "";
}
