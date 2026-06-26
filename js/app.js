(function () {
  "use strict";

  /* ================================
     CONSTANTS
     ================================ */

  const STORAGE_KEY = "calmarcocal-theme";

  /** @type {Record<string, number>} */
  const ACTIVITY_MULTIPLIERS = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    extra: 1.9,
  };

  /**
   * Caloric adjustment and macro split per training discipline.
   * calorieAdjust: fraction applied to TDEE (e.g. -0.20 = 20% deficit).
   * protein/carbs/fat: percentage of total calories from each macro.
   *
   * @type {Record<string, {calorieAdjust: number, protein: number, carbs: number, fat: number}>}
   */
  /**
   * Per-discipline caloric adjustment and macro splits for training vs. rest days.
   * Carbs shift higher on training days to fuel glycolytic demand; fat shifts
   * higher on rest days when glycogen replenishment is lower priority.
   *
   * @type {Record<string, {calorieAdjust: number, train: object, rest: object}>}
   */
  const DISCIPLINE_CONFIGS = {
    general: {
      calorieAdjust: 0,
      train: { protein: 0.3, carbs: 0.45, fat: 0.25 },
      rest: { protein: 0.3, carbs: 0.35, fat: 0.35 },
    },
    strength: {
      calorieAdjust: 0.05,
      train: { protein: 0.35, carbs: 0.4, fat: 0.25 },
      rest: { protein: 0.35, carbs: 0.3, fat: 0.35 },
    },
    endurance: {
      calorieAdjust: 0.05,
      train: { protein: 0.25, carbs: 0.55, fat: 0.2 },
      rest: { protein: 0.25, carbs: 0.45, fat: 0.3 },
    },
    cut: {
      calorieAdjust: -0.2,
      train: { protein: 0.4, carbs: 0.35, fat: 0.25 },
      rest: { protein: 0.4, carbs: 0.25, fat: 0.35 },
    },
    bulk: {
      calorieAdjust: 0.12,
      train: { protein: 0.35, carbs: 0.45, fat: 0.2 },
      rest: { protein: 0.35, carbs: 0.35, fat: 0.3 },
    },
  };

  /* ================================
     THEME
     ================================ */

  /**
   * Applies a theme to the document root and updates the toggle button.
   * @param {string} theme - Either "light" or "dark".
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    const isDark = theme === "dark";
    btn.setAttribute("aria-pressed", String(isDark));
    btn.setAttribute(
      "aria-label",
      isDark ? "Switch to light mode" : "Switch to dark mode",
    );
  }

  /**
   * Reads the stored theme from localStorage, falls back to OS preference.
   */
  function initializeTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
      return;
    }
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    applyTheme(prefersDark ? "dark" : "light");
  }

  /**
   * Toggles between light and dark theme, persisting the choice.
   */
  function toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  /* ================================
     UNIT TOGGLE
     ================================ */

  /**
   * Shows the inputs matching the selected unit system and hides the others.
   * Converts existing values so data is preserved across unit switches.
   * @param {string} unit - Either "imperial" or "metric".
   */
  function applyUnitSystem(unit) {
    const imperialWeight = document.getElementById("weight-imperial");
    const metricWeight = document.getElementById("weight-metric");
    const imperialHeight = document.getElementById("height-imperial");
    const metricHeight = document.getElementById("height-metric");
    const goalImp = document.getElementById("goal-weight-imperial");
    const goalMet = document.getElementById("goal-weight-metric");

    if (unit === "metric") {
      convertToMetric();
      if (imperialWeight) imperialWeight.hidden = true;
      if (imperialHeight) imperialHeight.hidden = true;
      if (goalImp) goalImp.hidden = true;
      if (metricWeight) metricWeight.hidden = false;
      if (metricHeight) metricHeight.hidden = false;
      if (goalMet) goalMet.hidden = false;
    } else {
      convertToImperial();
      if (metricWeight) metricWeight.hidden = true;
      if (metricHeight) metricHeight.hidden = true;
      if (imperialWeight) imperialWeight.hidden = false;
      if (imperialHeight) imperialHeight.hidden = false;
    }

    // Sync navy measurement field visibility with the active unit system
    const isFemale =
      document.querySelector('[name="sex"]:checked')?.value === "female";
    const navyNeckImp = document.getElementById("navy-neck-imperial");
    const navyNeckMet = document.getElementById("navy-neck-metric");
    const navyWaistImp = document.getElementById("navy-waist-imperial");
    const navyWaistMet = document.getElementById("navy-waist-metric");
    const navyHipImp = document.getElementById("navy-hip-imperial");
    const navyHipMet = document.getElementById("navy-hip-metric");

    if (unit === "metric") {
      if (navyNeckImp) navyNeckImp.hidden = true;
      if (navyWaistImp) navyWaistImp.hidden = true;
      if (navyHipImp) navyHipImp.hidden = true;
      if (navyNeckMet) navyNeckMet.hidden = false;
      if (navyWaistMet) navyWaistMet.hidden = false;
      if (navyHipMet) navyHipMet.hidden = !isFemale;
    } else {
      if (navyNeckMet) navyNeckMet.hidden = true;
      if (navyWaistMet) navyWaistMet.hidden = true;
      if (navyHipMet) navyHipMet.hidden = true;
      if (navyNeckImp) navyNeckImp.hidden = false;
      if (navyWaistImp) navyWaistImp.hidden = false;
      if (navyHipImp) navyHipImp.hidden = !isFemale;
    }
  }

  /**
   * Converts current imperial inputs to metric values, including goal weight.
   */
  function convertToMetric() {
    const lbsEl = document.getElementById("weight-lbs");
    const ftEl = document.getElementById("height-ft");
    const inEl = document.getElementById("height-in");
    const kgEl = document.getElementById("weight-kg");
    const cmEl = document.getElementById("height-cm");
    const goalLbsEl = document.getElementById("goal-weight-lbs");
    const goalKgEl = document.getElementById("goal-weight-kg");

    if (lbsEl && kgEl) {
      const lbs = parseFloat(lbsEl.value) || 0;
      kgEl.value = Math.round(lbs / 2.20462);
    }
    if (ftEl && inEl && cmEl) {
      const ft = parseFloat(ftEl.value) || 0;
      const inch = parseFloat(inEl.value) || 0;
      cmEl.value = Math.round((ft * 12 + inch) * 2.54);
    }
    if (goalLbsEl && goalKgEl && goalLbsEl.value) {
      const lbs = parseFloat(goalLbsEl.value) || 0;
      if (lbs > 0) goalKgEl.value = Math.round(lbs / 2.20462);
    }
  }

  /**
   * Converts current metric inputs to imperial values, including goal weight.
   */
  function convertToImperial() {
    const kgEl = document.getElementById("weight-kg");
    const cmEl = document.getElementById("height-cm");
    const lbsEl = document.getElementById("weight-lbs");
    const ftEl = document.getElementById("height-ft");
    const inEl = document.getElementById("height-in");
    const goalKgEl = document.getElementById("goal-weight-kg");
    const goalLbsEl = document.getElementById("goal-weight-lbs");

    if (kgEl && lbsEl) {
      const kg = parseFloat(kgEl.value) || 0;
      lbsEl.value = Math.round(kg * 2.20462);
    }
    if (cmEl && ftEl && inEl) {
      const cm = parseFloat(cmEl.value) || 0;
      const totalInches = cm / 2.54;
      ftEl.value = Math.floor(totalInches / 12);
      inEl.value = Math.round(totalInches % 12);
    }
    if (goalKgEl && goalLbsEl && goalKgEl.value) {
      const kg = parseFloat(goalKgEl.value) || 0;
      if (kg > 0) goalLbsEl.value = Math.round(kg * 2.20462);
    }
  }

  /* ================================
     BMR FORMULAS
     ================================ */

  /**
   * Calculates BMR using the Mifflin-St Jeor equation.
   * @param {string} sex - "male" or "female".
   * @param {number} weightKg
   * @param {number} heightCm
   * @param {number} age
   * @return {number}
   */
  function mifflinBmr(sex, weightKg, heightCm, age) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === "male" ? base + 5 : base - 161;
  }

  /**
   * Calculates BMR using the revised Harris-Benedict equation.
   * @param {string} sex - "male" or "female".
   * @param {number} weightKg
   * @param {number} heightCm
   * @param {number} age
   * @return {number}
   */
  function harrisBmr(sex, weightKg, heightCm, age) {
    return sex === "male"
      ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age
      : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  }

  /**
   * Calculates BMR using the Katch-McArdle equation (lean body mass based).
   * More accurate than weight-only formulas when body fat % is known.
   * @param {number} weightKg
   * @param {number} bodyFatPct - Body fat as a percentage (3-70).
   * @return {number}
   */
  function katchBmr(weightKg, bodyFatPct) {
    const leanMassKg = weightKg * (1 - bodyFatPct / 100);
    return 370 + 21.6 * leanMassKg;
  }

  /* ================================
     NAVY METHOD BODY FAT
     ================================ */

  /**
   * Estimates body fat % using the U.S. Navy circumference method
   * (Hodgdon & Beckett linear regression formula).
   * All inputs are in cm; internally converted to inches for the formula.
   * @param {string} sex - "male" or "female".
   * @param {number} heightCm
   * @param {number} neckCm - Circumference at narrowest point.
   * @param {number} waistCm - At navel (male) or narrowest point (female).
   * @param {number} hipCm - Required for female; ignored for male.
   * @return {number|null} Body fat percentage, or null if inputs are invalid.
   */
  function navyBodyFat(sex, heightCm, neckCm, waistCm, hipCm) {
    const heightIn = heightCm / 2.54;
    const neckIn = neckCm / 2.54;
    const waistIn = waistCm / 2.54;

    if (sex === "male") {
      const diff = waistIn - neckIn;
      if (diff <= 0 || heightIn <= 0) return null;
      const bf =
        86.01 * Math.log10(diff) - 70.041 * Math.log10(heightIn) + 36.76;
      return Math.max(3, Math.min(70, parseFloat(bf.toFixed(1))));
    }

    const hipIn = hipCm / 2.54;
    const sum = waistIn + hipIn - neckIn;
    if (sum <= 0 || heightIn <= 0) return null;
    const bf =
      163.205 * Math.log10(sum) - 97.684 * Math.log10(heightIn) - 78.387;
    return Math.max(3, Math.min(70, parseFloat(bf.toFixed(1))));
  }

  /* ================================
     HEART RATE ZONES
     ================================ */

  /** Zone definitions: percentage boundaries of max HR. */
  const HR_ZONES = [
    { id: 1, label: "Active Recovery", min: 0.5, max: 0.6 },
    { id: 2, label: "Endurance / Fat Burn", min: 0.6, max: 0.7 },
    { id: 3, label: "Aerobic", min: 0.7, max: 0.8 },
    { id: 4, label: "Lactate Threshold", min: 0.8, max: 0.9 },
    { id: 5, label: "VO2 Max", min: 0.9, max: 1.0 },
  ];

  /**
   * Computes heart rate zone ranges using both the simple and Karvonen methods.
   * @param {number} age
   * @param {number} restingHr - 0 if not provided (skips Karvonen).
   * @return {{ maxHr: number, zones: Array }}
   */
  function calcHrZones(age, restingHr) {
    const maxHr = 220 - age;
    const hasResting = restingHr > 0;
    const hrr = hasResting ? maxHr - restingHr : 0;

    const zones = HR_ZONES.map((z) => {
      const simple = {
        min: Math.round(maxHr * z.min),
        max: Math.round(maxHr * z.max),
      };
      const karvonen = hasResting
        ? {
            min: Math.round(hrr * z.min + restingHr),
            max: Math.round(hrr * z.max + restingHr),
          }
        : null;
      return { id: z.id, simple, karvonen };
    });

    return { maxHr, zones };
  }

  /**
   * Updates the HR zones panel in the DOM.
   * @param {number} age
   * @param {number} restingHr - 0 if not entered.
   */
  function updateHrZones(age, restingHr) {
    const { maxHr, zones } = calcHrZones(age, restingHr);
    const hasResting = restingHr > 0;

    setText("hr-max-display", String(maxHr));

    const container = document.getElementById("hr-zones-container");
    if (container) {
      if (hasResting) {
        container.classList.add("hr-zones--karvonen");
      } else {
        container.classList.remove("hr-zones--karvonen");
      }
    }

    const karvonenNote = document.getElementById("hr-karvonen-note");
    const karvonenCol = document.getElementById("hr-karvonen-col");
    if (karvonenNote) karvonenNote.hidden = !hasResting;
    if (karvonenCol) karvonenCol.hidden = !hasResting;

    zones.forEach((z) => {
      setText(`hz${z.id}-simple`, `${z.simple.min}-${z.simple.max} bpm`);
      const kEl = document.getElementById(`hz${z.id}-karvonen`);
      if (kEl) {
        kEl.hidden = !hasResting;
        if (hasResting && z.karvonen) {
          kEl.textContent = `${z.karvonen.min}-${z.karvonen.max} bpm`;
        }
      }
    });
  }

  /* ================================
     INPUT PARSING
     ================================ */

  /**
   * Reads and validates all calculator inputs from the DOM.
   * @return {{
   *   sex: string,
   *   age: number,
   *   weightKg: number,
   *   heightCm: number,
   *   bodyFatPct: number,
   *   activity: string,
   *   discipline: string,
   *   goalWeightKg: number|null,
   *   mealsPerDay: number
   * }}
   */
  function getInputs() {
    /**
     * Parses a DOM input by id, returning a float clamped to [min, max].
     * @param {string} id - The element id.
     * @param {number} min - Minimum allowed value.
     * @param {number} max - Maximum allowed value.
     * @param {number} fallback - Value used if input is empty or NaN.
     * @return {number}
     */
    const parse = (id, min, max, fallback) => {
      const el = document.getElementById(id);
      const val = el ? parseFloat(el.value) : NaN;
      if (isNaN(val)) return fallback;
      return Math.max(min, Math.min(max, val));
    };

    const sex = document.querySelector('[name="sex"]:checked')?.value || "male";
    const unit =
      document.querySelector('[name="unit"]:checked')?.value || "imperial";
    const age = parse("age", 15, 100, 30);
    const activity = document.getElementById("activity")?.value || "moderate";
    const discipline =
      document.getElementById("discipline")?.value || "general";

    // Optional body fat % — enables Katch-McArdle when entered
    const bfEl = document.getElementById("body-fat");
    const bfRaw = bfEl ? parseFloat(bfEl.value) : NaN;
    const bodyFatPct = !isNaN(bfRaw) && bfRaw >= 3 && bfRaw <= 70 ? bfRaw : 0;

    // Optional resting heart rate — enables Karvonen HR zones when entered
    const hrEl = document.getElementById("resting-hr");
    const hrRaw = hrEl ? parseFloat(hrEl.value) : NaN;
    const restingHr =
      !isNaN(hrRaw) && hrRaw >= 30 && hrRaw <= 120 ? Math.round(hrRaw) : 0;

    // Meals per day
    const mealsPerDay = parseInt(
      document.getElementById("meals-per-day")?.value || "3",
      10,
    );

    let weightKg;
    let heightCm;
    let goalWeightKg = null;

    if (unit === "imperial") {
      const weightLbs = parse("weight-lbs", 50, 1000, 170);
      const heightFt = parse("height-ft", 3, 8, 5);
      const heightIn = parse("height-in", 0, 11, 10);
      weightKg = weightLbs / 2.20462;
      heightCm = (heightFt * 12 + heightIn) * 2.54;
      const goalEl = document.getElementById("goal-weight-lbs");
      const goalRaw = goalEl ? parseFloat(goalEl.value) : NaN;
      if (!isNaN(goalRaw) && goalRaw >= 50 && goalRaw <= 1000) {
        goalWeightKg = goalRaw / 2.20462;
      }
    } else {
      weightKg = parse("weight-kg", 20, 450, 77);
      heightCm = parse("height-cm", 100, 250, 178);
      const goalEl = document.getElementById("goal-weight-kg");
      const goalRaw = goalEl ? parseFloat(goalEl.value) : NaN;
      if (!isNaN(goalRaw) && goalRaw >= 20 && goalRaw <= 450) {
        goalWeightKg = goalRaw;
      }
    }

    return {
      sex,
      age,
      weightKg,
      heightCm,
      bodyFatPct,
      restingHr,
      activity,
      discipline,
      goalWeightKg,
      mealsPerDay,
    };
  }

  /* ================================
     CALCULATOR LOGIC
     ================================ */

  /**
   * Runs the full caloric, macro, and supplemental calculations.
   * @param {{
   *   sex: string,
   *   age: number,
   *   weightKg: number,
   *   heightCm: number,
   *   bodyFatPct: number,
   *   activity: string,
   *   discipline: string,
   *   goalWeightKg: number|null,
   *   mealsPerDay: number
   * }} inputs
   * @return {object}
   */
  function calculate(inputs) {
    const {
      sex,
      age,
      weightKg,
      heightCm,
      bodyFatPct,
      activity,
      discipline,
      goalWeightKg,
      mealsPerDay,
    } = inputs;

    // BMR â€” use Katch-McArdle when body fat % is provided
    const bmrMifflin = mifflinBmr(sex, weightKg, heightCm, age);
    const bmrHarris = harrisBmr(sex, weightKg, heightCm, age);
    const bmrKatch = bodyFatPct > 0 ? katchBmr(weightKg, bodyFatPct) : null;
    const primaryBmr = bmrKatch !== null ? bmrKatch : bmrMifflin;
    const formulaUsed =
      bmrKatch !== null ? "Katch-McArdle (lean mass)" : "Mifflin-St Jeor";

    // TDEE and discipline-adjusted caloric target
    const multiplier = ACTIVITY_MULTIPLIERS[activity] ?? 1.55;
    const config = DISCIPLINE_CONFIGS[discipline] ?? DISCIPLINE_CONFIGS.general;
    const tdee = primaryBmr * multiplier;
    const targetCals = Math.round(tdee * (1 + config.calorieAdjust));

    // Training day macros (higher carbs to fuel glycolytic demand)
    const { protein: tProt, carbs: tCarbs, fat: tFat } = config.train;
    const proteinG = Math.round((targetCals * tProt) / 4);
    const carbsG = Math.round((targetCals * tCarbs) / 4);
    const fatG = Math.round((targetCals * tFat) / 9);

    // Rest day macros (shift carbs to fat; same total calories)
    const { protein: rProt, carbs: rCarbs, fat: rFat } = config.rest;
    const restProteinG = Math.round((targetCals * rProt) / 4);
    const restCarbsG = Math.round((targetCals * rCarbs) / 4);
    const restFatG = Math.round((targetCals * rFat) / 9);

    // Per-meal breakdown (training day macros split evenly)
    const proteinPerMeal = Math.round(proteinG / mealsPerDay);
    const carbsPerMeal = Math.round(carbsG / mealsPerDay);
    const fatPerMeal = Math.round(fatG / mealsPerDay);

    // Fiber (14g per 1,000 kcal â€” DRI standard) and water targets
    const fiberG = Math.round((targetCals / 1000) * 14);
    const weightLbs = weightKg * 2.20462;
    const waterOz = Math.round(weightLbs * 0.5);
    const waterL = (weightKg * 0.033).toFixed(1);

    // Goal weight timeline (7,700 kcal â‰ˆ 1 kg body fat)
    const dailyDiff = targetCals - Math.round(tdee);
    let timeline = null;

    if (goalWeightKg !== null) {
      const weightDiffKg = goalWeightKg - weightKg;
      const absDiff = Math.abs(weightDiffKg);

      if (absDiff < 0.5) {
        timeline = { type: "reached" };
      } else if (dailyDiff === 0) {
        timeline = { type: "maintenance" };
      } else if (
        (weightDiffKg > 0 && dailyDiff > 0) ||
        (weightDiffKg < 0 && dailyDiff < 0)
      ) {
        const totalKcal = absDiff * 7700;
        const days = totalKcal / Math.abs(dailyDiff);
        const weeks = Math.round(days / 7);
        timeline = {
          type: "estimate",
          weeks,
          weightDiffKg,
          weightLbsDiff: weightDiffKg * 2.20462,
          dailyDiff,
        };
      } else {
        timeline = { type: "mismatch", weightDiffKg, dailyDiff };
      }
    }

    return {
      bmrMifflin: Math.round(bmrMifflin),
      bmrHarris: Math.round(bmrHarris),
      bmrKatch: bmrKatch !== null ? Math.round(bmrKatch) : null,
      formulaUsed,
      tdee: Math.round(tdee),
      targetCals,
      proteinG,
      carbsG,
      fatG,
      proteinPct: Math.round(tProt * 100),
      carbsPct: Math.round(tCarbs * 100),
      fatPct: Math.round(tFat * 100),
      restProteinG,
      restCarbsG,
      restFatG,
      restProteinPct: Math.round(rProt * 100),
      restCarbsPct: Math.round(rCarbs * 100),
      restFatPct: Math.round(rFat * 100),
      proteinPerMeal,
      carbsPerMeal,
      fatPerMeal,
      mealsPerDay,
      fiberG,
      waterOz,
      waterL,
      timeline,
      multiplier,
      calorieAdjust: config.calorieAdjust,
    };
  }

  /* ================================
     DOM UPDATES
     ================================ */

  /**
   * Formats a calorie value with a locale thousands separator.
   * @param {number} value
   * @return {string}
   */
  function formatCals(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  /**
   * Formats a discipline caloric adjustment for the breakdown panel.
   * @param {number} adjust - Fractional value (e.g. -0.20).
   * @return {string}
   */
  function formatAdjust(adjust) {
    if (adjust === 0) return "None (maintenance)";
    const sign = adjust > 0 ? "+" : "";
    return `${sign}${Math.round(adjust * 100)}%`;
  }

  /**
   * Sets the textContent of an element by id.
   * @param {string} id
   * @param {string} text
   */
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  /**
   * Sets the innerHTML of an element by id.
   * @param {string} id
   * @param {string} html
   */
  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /**
   * Updates the goal timeline card based on the calculated timeline object.
   * @param {object|null} timeline
   */
  function updateTimeline(timeline) {
    const card = document.getElementById("goal-timeline-card");
    if (!card) return;

    if (!timeline) {
      card.hidden = true;
      return;
    }

    card.hidden = false;
    const valueEl = document.getElementById("goal-timeline-value");
    const descEl = document.getElementById("goal-timeline-desc");

    if (timeline.type === "estimate") {
      const direction = timeline.weightDiffKg > 0 ? "gain" : "lose";
      const lbs = Math.abs(timeline.weightLbsDiff).toFixed(1);
      const kg = Math.abs(timeline.weightDiffKg).toFixed(1);
      const diffLabel = timeline.dailyDiff > 0 ? "surplus" : "deficit";
      if (valueEl) {
        valueEl.textContent =
          timeline.weeks >= 52
            ? `~${Math.round(timeline.weeks / 4.33)} mo`
            : `~${timeline.weeks} wks`;
      }
      if (descEl) {
        descEl.textContent = `Estimated time to ${direction} ${lbs} lbs (${kg} kg) at a ${Math.abs(timeline.dailyDiff)} kcal/day ${diffLabel}.`;
      }
    } else if (timeline.type === "reached") {
      if (valueEl) valueEl.textContent = "At goal";
      if (descEl) {
        descEl.textContent = "Your current weight matches your goal weight.";
      }
    } else if (timeline.type === "maintenance") {
      if (valueEl) valueEl.textContent = "Maintain";
      if (descEl) {
        descEl.textContent =
          "Your caloric target is at maintenance. Change your discipline to create a surplus or deficit.";
      }
    } else if (timeline.type === "mismatch") {
      const goalDir = timeline.weightDiffKg > 0 ? "gain weight" : "lose weight";
      const calDir = timeline.dailyDiff > 0 ? "surplus" : "deficit";
      if (valueEl) valueEl.textContent = "Check goal";
      if (descEl) {
        descEl.textContent = `Your goal is to ${goalDir} but your discipline creates a caloric ${calDir}. Adjust your training goal or discipline to match.`;
      }
    }
  }

  /**
   * Draws a donut chart on the macro-chart canvas for training day macros.
   * Reads CSS custom properties for colors so it respects light/dark theme.
   * @param {number} proteinPct - Protein percentage of calories (0-100).
   * @param {number} carbsPct - Carbs percentage of calories (0-100).
   * @param {number} fatPct - Fat percentage of calories (0-100).
   */
  function drawMacroChart(proteinPct, carbsPct, fatPct) {
    const canvas = document.getElementById("macro-chart");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const cssSize = 140;

    canvas.width = cssSize * dpr;
    canvas.height = cssSize * dpr;
    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;
    ctx.scale(dpr, dpr);

    const style = getComputedStyle(document.documentElement);
    const colors = [
      style.getPropertyValue("--clr-protein").trim() || "#3b82f6",
      style.getPropertyValue("--clr-carbs").trim() || "#d97706",
      style.getPropertyValue("--clr-fat").trim() || "#059669",
    ];
    const surfaceColor =
      style.getPropertyValue("--clr-surface").trim() || "#f8fafc";

    const cx = cssSize / 2;
    const cy = cssSize / 2;
    const outerR = cx - 6;
    const innerR = outerR * 0.56;
    const pcts = [proteinPct / 100, carbsPct / 100, fatPct / 100];

    ctx.clearRect(0, 0, cssSize, cssSize);

    let startAngle = -Math.PI / 2;
    pcts.forEach((pct, i) => {
      if (pct <= 0) return;
      const endAngle = startAngle + pct * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
      startAngle = endAngle;
    });

    // Donut hole fill
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 1, 0, 2 * Math.PI);
    ctx.fillStyle = surfaceColor;
    ctx.fill();

    // Update legend text
    setText("chart-legend-protein", `Protein ${proteinPct}%`);
    setText("chart-legend-carbs", `Carbs ${carbsPct}%`);
    setText("chart-legend-fat", `Fat ${fatPct}%`);
  }

  /**
   * Reads all inputs, runs the calculation, and updates every output element.
   */
  function updateOutput() {
    const inputs = getInputs();
    const result = calculate(inputs);

    // Main caloric results
    setHtml(
      "result-calories",
      `${formatCals(result.targetCals)}<span class="results__card-unit">kcal</span>`,
    );
    setHtml(
      "result-tdee",
      `${formatCals(result.tdee)}<span class="results__card-unit">kcal</span>`,
    );

    // Training day macros
    setHtml(
      "result-protein",
      `${result.proteinG}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "result-carbs",
      `${result.carbsG}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "result-fat",
      `${result.fatG}<span class="macro-card__unit">g</span>`,
    );
    setText("result-protein-pct", `${result.proteinPct}% of calories`);
    setText("result-carbs-pct", `${result.carbsPct}% of calories`);
    setText("result-fat-pct", `${result.fatPct}% of calories`);

    // Rest day macros
    setHtml(
      "rest-protein",
      `${result.restProteinG}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "rest-carbs",
      `${result.restCarbsG}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "rest-fat",
      `${result.restFatG}<span class="macro-card__unit">g</span>`,
    );
    setText("rest-protein-pct", `${result.restProteinPct}% of calories`);
    setText("rest-carbs-pct", `${result.restCarbsPct}% of calories`);
    setText("rest-fat-pct", `${result.restFatPct}% of calories`);

    // Per meal
    const mealLabel = document.getElementById("meal-label");
    if (mealLabel) {
      mealLabel.textContent = `Per Meal (${result.mealsPerDay} meals)`;
    }
    setHtml(
      "meal-protein",
      `${result.proteinPerMeal}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "meal-carbs",
      `${result.carbsPerMeal}<span class="macro-card__unit">g</span>`,
    );
    setHtml(
      "meal-fat",
      `${result.fatPerMeal}<span class="macro-card__unit">g</span>`,
    );

    // Fiber and water extras
    setText("result-fiber", `${result.fiberG}g`);
    setText("result-water-oz", `${result.waterOz} oz`);
    setText("result-water-l", `${result.waterL} L`);

    // Goal timeline card
    updateTimeline(result.timeline);

    // Breakdown panel
    setText("bd-mifflin", `${formatCals(result.bmrMifflin)} kcal`);
    setText("bd-harris", `${formatCals(result.bmrHarris)} kcal`);
    setText(
      "bd-katch",
      result.bmrKatch !== null
        ? `${formatCals(result.bmrKatch)} kcal`
        : "N/A â€” enter body fat % to enable",
    );
    setText("bd-formula", result.formulaUsed);
    setText("bd-multiplier", `x${result.multiplier}`);
    setText("bd-tdee", `${formatCals(result.tdee)} kcal`);
    setText("bd-discipline", formatAdjust(result.calorieAdjust));
    setText("bd-target", `${formatCals(result.targetCals)} kcal`);

    // Donut chart (training day split)
    drawMacroChart(result.proteinPct, result.carbsPct, result.fatPct);

    // Heart rate training zones
    updateHrZones(inputs.age, inputs.restingHr);

    // Protein per lb bodyweight
    const weightLbs = inputs.weightKg * 2.20462;
    const perLbEl = document.getElementById("result-protein-per-lb");
    if (perLbEl) {
      perLbEl.textContent = `~${(result.proteinG / weightLbs).toFixed(1)}g per lb`;
    }

    // Comparison table
    setText("cmp-train-protein", `${result.proteinG}g`);
    setText("cmp-train-carbs", `${result.carbsG}g`);
    setText("cmp-train-fat", `${result.fatG}g`);
    setText("cmp-rest-protein", `${result.restProteinG}g`);
    setText("cmp-rest-carbs", `${result.restCarbsG}g`);
    setText("cmp-rest-fat", `${result.restFatG}g`);

    // Share button URL
    const shareBtn = document.getElementById("share-btn");
    if (shareBtn) {
      const tweetText = [
        `My daily macros: ${formatCals(result.targetCals)} kcal`,
        `Protein: ${result.proteinG}g | Carbs: ${result.carbsG}g | Fat: ${result.fatG}g`,
        `Calculated with CalMacroCal`,
        `calmacrocal.com`,
      ].join("\n");
      shareBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    }
  }

  /* ================================
     COPY TO CLIPBOARD
     ================================ */

  /**
   * Copies all current results to the clipboard as formatted plain text.
   */
  function copyResults() {
    const inputs = getInputs();
    const result = calculate(inputs);
    const { maxHr, zones } = calcHrZones(inputs.age, inputs.restingHr);
    const hasResting = inputs.restingHr > 0;

    const lines = [
      "CalMacroCal Results",
      `Daily Target: ${formatCals(result.targetCals)} kcal`,
      `TDEE:         ${formatCals(result.tdee)} kcal`,
      "",
      "Training Days:",
      `  Protein: ${result.proteinG}g (${result.proteinPct}%)`,
      `  Carbs:   ${result.carbsG}g (${result.carbsPct}%)`,
      `  Fat:     ${result.fatG}g (${result.fatPct}%)`,
      "",
      "Rest Days:",
      `  Protein: ${result.restProteinG}g (${result.restProteinPct}%)`,
      `  Carbs:   ${result.restCarbsG}g (${result.restCarbsPct}%)`,
      `  Fat:     ${result.restFatG}g (${result.restFatPct}%)`,
      "",
      `Per Meal (${result.mealsPerDay} meals):`,
      `  Protein: ${result.proteinPerMeal}g`,
      `  Carbs:   ${result.carbsPerMeal}g`,
      `  Fat:     ${result.fatPerMeal}g`,
      "",
      `Fiber Target: ${result.fiberG}g/day`,
      `Water Target: ${result.waterOz} oz / ${result.waterL} L`,
    ];

    if (inputs.bodyFatPct > 0) {
      lines.push("");
      lines.push(
        `Body Fat %:   ${inputs.bodyFatPct}% (BMR via ${result.formulaUsed})`,
      );
    }

    lines.push("");
    lines.push(
      `Heart Rate Zones (Max HR: ${maxHr} bpm${hasResting ? `, Resting HR: ${inputs.restingHr} bpm` : ""})`,
    );

    const zoneNames = [
      "Zone 1 Active Recovery",
      "Zone 2 Endurance      ",
      "Zone 3 Aerobic        ",
      "Zone 4 Threshold      ",
      "Zone 5 VO2 Max        ",
    ];

    zones.forEach((z, i) => {
      const simple = `${z.simple.min}-${z.simple.max} bpm`;
      if (hasResting && z.karvonen) {
        const karvonen = `${z.karvonen.min}-${z.karvonen.max} bpm`;
        lines.push(
          `  ${zoneNames[i]}  Simple: ${simple}  Karvonen: ${karvonen}`,
        );
      } else {
        lines.push(`  ${zoneNames[i]}  ${simple}`);
      }
    });

    const btn = document.getElementById("copy-btn");
    navigator.clipboard
      .writeText(lines.join("\n"))
      .then(() => {
        if (!btn) return;
        btn.textContent = "Copied!";
        btn.classList.add("copy-btn--success");
        setTimeout(() => {
          btn.textContent = "Copy Results";
          btn.classList.remove("copy-btn--success");
        }, 2000);
      })
      .catch(() => {
        if (btn) btn.textContent = "Copy unavailable";
      });
  }

  /**
   * Returns an average resting heart rate estimate based on age.
   * Based on published population averages for healthy sedentary adults.
   * @param {number} age
   * @return {number}
   */
  function suggestedRhr(age) {
    if (age <= 25) return 72;
    if (age <= 35) return 73;
    if (age <= 45) return 75;
    if (age <= 55) return 76;
    if (age <= 65) return 77;
    return 76;
  }

  /**
   * Updates the resting HR input placeholder to reflect the age-based average.
   */
  function updateRhrPlaceholder() {
    const ageEl = document.getElementById("age");
    const hrEl = document.getElementById("resting-hr");
    if (!ageEl || !hrEl) return;
    const age = parseFloat(ageEl.value) || 30;
    hrEl.placeholder = `e.g. ${suggestedRhr(age)} (avg for age ${Math.round(age)})`;
  }

  /* ================================
     INITIALIZATION
     ================================ */

  /**
   * Wires up all event listeners and runs the initial calculation.
   */
  function initializeApp() {
    initializeTheme();

    const themeBtn = document.getElementById("theme-toggle");
    if (themeBtn) {
      themeBtn.addEventListener("click", toggleTheme);
    }

    const form = document.getElementById("macro-form");
    if (form) {
      form.addEventListener("input", (e) => {
        if (e.target.id === "age") updateRhrPlaceholder();
        updateOutput();
      });
    }

    const unitInputs = document.querySelectorAll('[name="unit"]');
    unitInputs.forEach((input) => {
      input.addEventListener("change", () => {
        applyUnitSystem(input.value);
        updateOutput();
      });
    });

    const copyBtn = document.getElementById("copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", copyResults);
    }

    const footerYear = document.getElementById("footer-year");
    if (footerYear) {
      footerYear.textContent = String(new Date().getFullYear());
    }

    // Set initial resting HR placeholder based on default age
    updateRhrPlaceholder();

    // Navy Method body fat calculator
    const navyBtn = document.getElementById("navy-calc-btn");
    if (navyBtn) {
      navyBtn.addEventListener("click", () => {
        const sex =
          document.querySelector('[name="sex"]:checked')?.value || "male";
        const unit =
          document.querySelector('[name="unit"]:checked')?.value || "imperial";

        let heightCm;
        let neckCm;
        let waistCm;
        let hipCm = 0;

        if (unit === "imperial") {
          const ft =
            parseFloat(document.getElementById("height-ft")?.value) || 0;
          const inch =
            parseFloat(document.getElementById("height-in")?.value) || 0;
          heightCm = (ft * 12 + inch) * 2.54;
          neckCm =
            (parseFloat(document.getElementById("navy-neck-in")?.value) || 0) *
            2.54;
          waistCm =
            (parseFloat(document.getElementById("navy-waist-in")?.value) || 0) *
            2.54;
          hipCm =
            (parseFloat(document.getElementById("navy-hip-in")?.value) || 0) *
            2.54;
        } else {
          heightCm =
            parseFloat(document.getElementById("height-cm")?.value) || 0;
          neckCm =
            parseFloat(document.getElementById("navy-neck-cm")?.value) || 0;
          waistCm =
            parseFloat(document.getElementById("navy-waist-cm")?.value) || 0;
          hipCm =
            parseFloat(document.getElementById("navy-hip-cm")?.value) || 0;
        }

        const bf = navyBodyFat(sex, heightCm, neckCm, waistCm, hipCm);
        const resultEl = document.getElementById("navy-calc-result");
        const bfInput = document.getElementById("body-fat");

        if (bf === null) {
          if (resultEl) {
            resultEl.hidden = false;
            resultEl.textContent =
              sex === "male"
                ? "Check measurements. Waist must be greater than neck."
                : "Check measurements. All three fields are required for female.";
            resultEl.className = "navy-calc__result navy-calc__result--error";
          }
          return;
        }

        if (bfInput) {
          bfInput.value = String(bf);
        }
        if (resultEl) {
          resultEl.hidden = false;
          resultEl.textContent = `Estimated: ${bf}% \u2014 applied to Body Fat % above.`;
          resultEl.className = "navy-calc__result navy-calc__result--success";
        }
        updateOutput();
      });
    }

    // Show/hide hip measurement fields when sex changes
    const sexInputs = document.querySelectorAll('[name="sex"]');
    sexInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const unit =
          document.querySelector('[name="unit"]:checked')?.value || "imperial";
        const isFemale =
          document.querySelector('[name="sex"]:checked')?.value === "female";
        const navyHipImp = document.getElementById("navy-hip-imperial");
        const navyHipMet = document.getElementById("navy-hip-metric");
        if (unit === "imperial") {
          if (navyHipImp) navyHipImp.hidden = !isFemale;
          if (navyHipMet) navyHipMet.hidden = true;
        } else {
          if (navyHipImp) navyHipImp.hidden = true;
          if (navyHipMet) navyHipMet.hidden = !isFemale;
        }
      });
    });

    updateOutput();
  }

  if (document.readyState === "complete") {
    initializeApp();
  } else {
    window.addEventListener("load", initializeApp, { once: true });
  }
})();
