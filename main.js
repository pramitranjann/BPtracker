const API_BASE = "/api";
const SAMPLE_COUNT = 18;
const PATIENT_LOG_ORDER = ["sys", "dia", "pulse", "context"];
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const state = isBrowser
  ? {
      readings: [],
      patientRange: "7",
      caregiverRange: "30",
      patientScreen: "home",
      view: getCurrentView(),
      deferredPrompt: null,
      lastSavedReadingId: null,
      draft: createEmptyDraft()
    }
  : {};

const els = isBrowser
  ? {
      patientScreens: [...document.querySelectorAll(".patient-screen")],
      patientRangeButtons: [...document.querySelectorAll(".range-button")],
      caregiverRangeButtons: [...document.querySelectorAll(".dashboard-range-button")],
      switchViewLink: document.querySelector("#switchViewLink"),
      installButton: document.querySelector("#installButton"),
      patientView: document.querySelector("#patientView"),
      caregiverView: document.querySelector("#caregiverView"),
      topbarEyebrow: document.querySelector("#topbarEyebrow"),
      topbarTitle: document.querySelector("#topbarTitle"),
      topbarCopy: document.querySelector("#topbarCopy"),
      patientGreeting: document.querySelector("#patientGreeting"),
      sysInput: document.querySelector("#sysInput"),
      diaInput: document.querySelector("#diaInput"),
      pulseInput: document.querySelector("#pulseInput"),
      sysNextButton: document.querySelector("#sysNextButton"),
      diaNextButton: document.querySelector("#diaNextButton"),
      pulseNextButton: document.querySelector("#pulseNextButton"),
      ateRecently: document.querySelector("#ateRecently"),
      hadCaffeine: document.querySelector("#hadCaffeine"),
      afterWaking: document.querySelector("#afterWaking"),
      afterNap: document.querySelector("#afterNap"),
      afterMedication: document.querySelector("#afterMedication"),
      trendHeroChip: document.querySelector("#trendHeroChip"),
      trendHeroTitle: document.querySelector("#trendHeroTitle"),
      trendHeroCopy: document.querySelector("#trendHeroCopy"),
      patientTrendMetrics: document.querySelector("#patientTrendMetrics"),
      patientTrendChart: document.querySelector("#patientTrendChart"),
      patientTrendNarrative: document.querySelector("#patientTrendNarrative"),
      caregiverHeroChip: document.querySelector("#caregiverHeroChip"),
      caregiverHeroTitle: document.querySelector("#caregiverHeroTitle"),
      caregiverHeroCopy: document.querySelector("#caregiverHeroCopy"),
      caregiverOverviewMetrics: document.querySelector("#caregiverOverviewMetrics"),
      caregiverTrendChart: document.querySelector("#caregiverTrendChart"),
      caregiverTrendNarrative: document.querySelector("#caregiverTrendNarrative"),
      caregiverInsights: document.querySelector("#caregiverInsights"),
      caregiverFlagged: document.querySelector("#caregiverFlagged"),
      caregiverHistory: document.querySelector("#caregiverHistory"),
      historySearch: document.querySelector("#historySearch"),
      exportJsonButton: document.querySelector("#exportJsonButton"),
      exportCsvButton: document.querySelector("#exportCsvButton"),
      metricTemplate: document.querySelector("#metricTemplate")
    }
  : {};

if (isBrowser) {
  init().catch((error) => {
    console.error(error);
    window.alert("The app could not start correctly. Check the console for details.");
  });
}

async function init() {
  wireViewMode();
  wirePatientNavigation();
  wirePatientInputs();
  wireRangeButtons();
  wireInstallPrompt();
  wireActions();
  wireHistorySearch();

  state.readings = (await loadReadings())
    .map(normalizeReading)
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));

  render();
}

function wireViewMode() {
  updateViewModeUi();
}

function wirePatientNavigation() {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;
      handlePatientAction(action);
    });
  });
}

function wirePatientInputs() {
  const numberInputs = [
    { input: els.sysInput, field: "systolic", next: els.sysNextButton },
    { input: els.diaInput, field: "diastolic", next: els.diaNextButton },
    { input: els.pulseInput, field: "pulse", next: els.pulseNextButton }
  ];

  numberInputs.forEach(({ input, field, next }) => {
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "").slice(0, 3);
      input.value = digits;
      state.draft[field] = digits;
      next.disabled = !digits;
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && input.value) {
        event.preventDefault();
        next.click();
      }
    });
  });

  [
    { input: els.ateRecently, key: "ateRecently" },
    { input: els.hadCaffeine, key: "hadCaffeine" },
    { input: els.afterWaking, key: "afterWaking" },
    { input: els.afterNap, key: "afterNap" },
    { input: els.afterMedication, key: "afterMedication" }
  ].forEach(({ input, key }) => {
    input.addEventListener("change", () => {
      state.draft.contextFlags[key] = input.checked;
    });
  });

}

function wireRangeButtons() {
  els.patientRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.patientRange = button.dataset.range || "7";
      renderPatientTrends();
    });
  });

  els.caregiverRangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.caregiverRange = button.dataset.dashboardRange || "30";
      renderCaregiver();
    });
  });
}

function wireInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    els.installButton.classList.remove("hidden");
  });

  els.installButton.addEventListener("click", async () => {
    if (!state.deferredPrompt) return;
    await state.deferredPrompt.prompt();
    state.deferredPrompt = null;
    els.installButton.classList.add("hidden");
  });
}

function wireActions() {
  if (els.exportJsonButton) {
    els.exportJsonButton.addEventListener("click", () =>
      downloadFile(
        "bp-pattern-export.json",
        JSON.stringify(state.readings, null, 2),
        "application/json"
      )
    );
  }

  if (els.exportCsvButton) {
    els.exportCsvButton.addEventListener("click", () =>
      downloadFile("bp-pattern-export.csv", toCsv(state.readings), "text/csv;charset=utf-8")
    );
  }
}

function wireHistorySearch() {
  if (els.historySearch) {
    els.historySearch.addEventListener("input", renderCaregiverHistory);
  }
}

function handlePatientAction(action) {
  switch (action) {
    case "start-log":
      resetDraft();
      goToPatientScreen("sys");
      break;
    case "open-trends":
      goToPatientScreen("trends");
      break;
    case "go-home":
      goToPatientScreen("home");
      break;
    case "to-sys":
      goToPatientScreen("sys");
      break;
    case "to-dia":
      if (state.draft.systolic) {
        goToPatientScreen("dia");
      }
      break;
    case "to-pulse":
      if (state.draft.diastolic) {
        goToPatientScreen("pulse");
      }
      break;
    case "to-context":
      if (state.draft.pulse) {
        goToPatientScreen("context");
      }
      break;
    case "save-reading":
      void saveDraftReading();
      break;
    default:
      break;
  }
}

async function saveDraftReading() {
  const reading = {
    id: crypto.randomUUID(),
    systolic: Number(state.draft.systolic),
    diastolic: Number(state.draft.diastolic),
    pulse: Number(state.draft.pulse),
    capturedAt: new Date().toISOString(),
    context: buildContextSummary(state.draft.contextFlags),
    contextFlags: { ...state.draft.contextFlags },
    position: "Sitting",
    notes: state.draft.notes,
    medicationTaken: state.draft.contextFlags.afterMedication,
    fasting: !state.draft.contextFlags.ateRecently,
    entryMethod: "manual"
  };

  await saveReading(reading);
  state.readings.unshift(normalizeReading(reading));
  state.readings.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
  state.lastSavedReadingId = reading.id;
  resetDraft();
  goToPatientScreen("trends");
  render();
}

function goToPatientScreen(screen) {
  state.patientScreen = screen;
  renderPatientScreens();
}

function render() {
  renderTopbar();
  renderPatientScreens();
  renderPatientTrends();
  renderCaregiver();
}

function renderTopbar() {
  document.body.dataset.view = state.view;
  document.body.dataset.patientScreen = state.patientScreen;

  if (state.view === "caregiver") {
    els.topbarEyebrow.textContent = "Caregiver dashboard";
    els.topbarTitle.textContent = "BP Pattern";
    els.topbarCopy.textContent = "Trends, timing, and context in one place.";
    els.topbarCopy.classList.remove("hidden");
  } else {
    els.topbarEyebrow.textContent = "BP Pattern";
    els.topbarTitle.textContent = "BP Pattern";
    els.topbarCopy.textContent = "";
    els.topbarCopy.classList.add("hidden");
  }
}

function renderPatientScreens() {
  els.patientScreens.forEach((screen) => {
    screen.classList.toggle("active", screen.dataset.screen === state.patientScreen);
  });

  els.sysInput.value = state.draft.systolic;
  els.diaInput.value = state.draft.diastolic;
  els.pulseInput.value = state.draft.pulse;
  els.sysNextButton.disabled = !state.draft.systolic;
  els.diaNextButton.disabled = !state.draft.diastolic;
  els.pulseNextButton.disabled = !state.draft.pulse;

  els.ateRecently.checked = state.draft.contextFlags.ateRecently;
  els.hadCaffeine.checked = state.draft.contextFlags.hadCaffeine;
  els.afterWaking.checked = state.draft.contextFlags.afterWaking;
  els.afterNap.checked = state.draft.contextFlags.afterNap;
  els.afterMedication.checked = state.draft.contextFlags.afterMedication;

  if (state.view === "patient") {
    focusForActiveScreen();
  }
}

function focusForActiveScreen() {
  window.setTimeout(() => {
    if (state.patientScreen === "sys") els.sysInput.focus();
    if (state.patientScreen === "dia") els.diaInput.focus();
    if (state.patientScreen === "pulse") els.pulseInput.focus();
    if (state.patientScreen === "context") els.ateRecently.focus();
  }, 40);
}

function renderPatientTrends() {
  els.patientRangeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.range === state.patientRange);
  });

  const readings = getReadingsForRange(state.patientRange);
  const latest = readings[0];
  const average = getAverage(readings);
  const high = readings.filter((reading) => classifyReading(reading) === "high").length;

  renderMetricGrid(els.patientTrendMetrics, [
    {
      label: "Latest",
      value: latest ? `${latest.systolic}/${latest.diastolic}` : "No data",
      detail: latest ? `Pulse ${latest.pulse}` : "Add a reading"
    },
    {
      label: "Average",
      value: readings.length ? `${average.systolic}/${average.diastolic}` : "No data",
      detail: readings.length ? `Pulse ${average.pulse}` : "Waiting"
    },
    {
      label: "High",
      value: String(high),
      detail: readings.length ? `${high} in this range` : "No high readings"
    }
  ]);

  els.trendHeroChip.textContent = state.patientRange === "all" ? "All time" : `${state.patientRange} days`;
  els.trendHeroTitle.textContent = latest
    ? `${latest.systolic}/${latest.diastolic} latest`
    : "Recent readings";
  els.trendHeroCopy.textContent = readings.length ? "Latest pattern." : "No readings yet.";

  if (!readings.length) {
    els.patientTrendNarrative.innerHTML = "<p>No readings yet.</p>";
    drawTrendChart(els.patientTrendChart, []);
    return;
  }

  const latestContext = buildContextSummary(latest.contextFlags);
  els.patientTrendNarrative.innerHTML = `
    <p><strong>Average:</strong> ${average.systolic}/${average.diastolic}.</p>
    <p><strong>Latest context:</strong> ${latestContext || "No context added"}.</p>
  `;

  drawTrendChart(els.patientTrendChart, readings, { compact: true });
}

function renderCaregiver() {
  els.caregiverRangeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.dashboardRange === state.caregiverRange);
  });

  const readings = getReadingsForRange(state.caregiverRange);
  const latest = state.readings[0];
  const average7 = getAverage(getReadingsForRange("7"));
  const average30 = getAverage(getReadingsForRange("30"));
  const averageSelected = getAverage(readings);
  const stage2Count = readings.filter((reading) => classifyReading(reading) === "high").length;
  const lowCount = readings.filter((reading) => classifyReading(reading) === "low").length;
  const morning = readings.filter((reading) => getHour(reading.capturedAt) < 12);
  const evening = readings.filter((reading) => getHour(reading.capturedAt) >= 18);
  const flagged = readings.filter((reading) => classifyReading(reading) !== "normal").slice(0, 6);

  els.caregiverHeroChip.textContent = latest ? formatSeverity(classifyReading(latest)) : "Live";
  els.caregiverHeroTitle.textContent = latest
    ? `${latest.systolic}/${latest.diastolic} • Pulse ${latest.pulse}`
    : "Waiting for the first reading";
  els.caregiverHeroCopy.textContent = latest
    ? `${formatDate(latest.capturedAt)} • ${buildContextSummary(latest.contextFlags) || "No context added"}`
    : "See patterns, timing, and context without the patient entry flow.";

  renderMetricGrid(els.caregiverOverviewMetrics, [
    {
      label: "Latest",
      value: latest ? `${latest.systolic}/${latest.diastolic}` : "No data",
      detail: latest ? `Pulse ${latest.pulse}` : "Waiting"
    },
    {
      label: "7-day avg",
      value: average7.systolic ? `${average7.systolic}/${average7.diastolic}` : "No data",
      detail: average7.systolic ? `Pulse ${average7.pulse}` : "Not enough"
    },
    {
      label: "30-day avg",
      value: average30.systolic ? `${average30.systolic}/${average30.diastolic}` : "No data",
      detail: average30.systolic ? `Pulse ${average30.pulse}` : "Not enough"
    },
    {
      label: "Selected avg",
      value: averageSelected.systolic ? `${averageSelected.systolic}/${averageSelected.diastolic}` : "No data",
      detail: averageSelected.systolic ? `Pulse ${averageSelected.pulse}` : "Not enough"
    },
    {
      label: "Stage 2",
      value: String(stage2Count),
      detail: "At or above 140/90"
    },
    {
      label: "Low",
      value: String(lowCount),
      detail: "Below 90/60"
    },
    {
      label: "Morning",
      value: morning.length ? `${getAverage(morning).systolic}/${getAverage(morning).diastolic}` : "No data",
      detail: morning.length ? `${morning.length} readings` : "No pattern"
    },
    {
      label: "Evening",
      value: evening.length ? `${getAverage(evening).systolic}/${getAverage(evening).diastolic}` : "No data",
      detail: evening.length ? `${evening.length} readings` : "No pattern"
    }
  ]);

  const previous = getPreviousPeriodReadings(state.caregiverRange);
  const previousAverage = getAverage(previous);
  const deltaS = previous.length ? averageSelected.systolic - previousAverage.systolic : 0;
  const deltaD = previous.length ? averageSelected.diastolic - previousAverage.diastolic : 0;

  els.caregiverTrendNarrative.innerHTML = readings.length
    ? `
        <p><strong>Selected range average:</strong> ${averageSelected.systolic}/${averageSelected.diastolic} with pulse ${averageSelected.pulse}.</p>
        <p><strong>Compared with previous:</strong> systolic is ${describeDelta(deltaS)} and diastolic is ${describeDelta(deltaD)}.</p>
      `
    : "<p>No data in this range yet.</p>";

  drawTrendChart(els.caregiverTrendChart, readings);
  renderCaregiverInsights(readings);
  renderCaregiverFlags(flagged);
  renderCaregiverHistory();
}

function renderCaregiverInsights(readings) {
  els.caregiverInsights.innerHTML = "";

  if (!readings.length) {
    els.caregiverInsights.innerHTML = `
      <article class="insight-card">
        <strong>No readings yet</strong>
        <p>The dashboard becomes useful after a few entries across different days.</p>
      </article>
    `;
    return;
  }

  const latest = readings[0];
  const caffeineCount = readings.filter((reading) => reading.contextFlags.hadCaffeine).length;
  const ateCount = readings.filter((reading) => reading.contextFlags.ateRecently).length;
  const wokeCount = readings.filter((reading) => reading.contextFlags.afterWaking).length;

  const items = [
    {
      title: "Latest status",
      text: `Most recent reading is ${latest.systolic}/${latest.diastolic} with pulse ${latest.pulse}.`
    },
    {
      title: "Context frequency",
      text: `${caffeineCount} readings after tea or coffee, ${ateCount} after food, ${wokeCount} after waking.`
    },
    {
      title: "Latest context",
      text: buildContextSummary(latest.contextFlags) || "No context was added to the latest reading."
    }
  ];

  for (const item of items) {
    const card = document.createElement("article");
    card.className = "insight-card";
    card.innerHTML = `<strong>${item.title}</strong><p>${item.text}</p>`;
    els.caregiverInsights.append(card);
  }
}

function renderCaregiverFlags(flagged) {
  els.caregiverFlagged.innerHTML = "";

  if (!flagged.length) {
    els.caregiverFlagged.innerHTML = `
      <article class="flag-card">
        <strong>No flagged readings in this range</strong>
        <p class="flag-meta">Recent readings in this range are in the normal band.</p>
      </article>
    `;
    return;
  }

  for (const reading of flagged) {
    const severity = classifyReading(reading);
    const item = document.createElement("article");
    item.className = "flag-card";
    item.innerHTML = `
      <div class="section-head">
        <div>
          <strong>${reading.systolic}/${reading.diastolic} • Pulse ${reading.pulse}</strong>
          <p class="flag-meta">${formatDate(reading.capturedAt)} • ${buildContextSummary(
            reading.contextFlags
          ) || "No context added"}</p>
        </div>
        <span class="severity-badge ${severityClass(severity)}">${formatSeverity(severity)}</span>
      </div>
    `;
    els.caregiverFlagged.append(item);
  }
}

function renderCaregiverHistory() {
  const query = els.historySearch ? els.historySearch.value.trim().toLowerCase() : "";
  const readings = state.readings.filter((reading) => {
    if (!query) return true;
    return [
      reading.context,
      reading.notes,
      reading.position,
      buildContextSummary(reading.contextFlags)
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  els.caregiverHistory.innerHTML = "";
  if (!readings.length) {
    els.caregiverHistory.innerHTML = `
      <article class="history-item">
        <strong>No matching readings</strong>
        <p class="history-meta">Try a different search term.</p>
      </article>
    `;
    return;
  }

  for (const reading of readings.slice(0, 18)) {
    const severity = classifyReading(reading);
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div class="section-head">
        <div>
          <p class="history-reading">${reading.systolic}/${reading.diastolic} • Pulse ${reading.pulse}</p>
          <p class="history-meta">${formatDate(reading.capturedAt)} • ${buildContextSummary(
            reading.contextFlags
          ) || "No context added"}</p>
        </div>
        <span class="severity-badge ${severityClass(severity)}">${formatSeverity(severity)}</span>
      </div>
      ${reading.notes ? `<p class="history-meta">${escapeHtml(reading.notes)}</p>` : ""}
    `;
    els.caregiverHistory.append(item);
  }
}

function updateViewModeUi() {
  const caregiver = state.view === "caregiver";
  els.patientView.classList.toggle("active", !caregiver);
  els.caregiverView.classList.toggle("active", caregiver);
  els.switchViewLink.textContent = caregiver ? "Patient app" : "Caregiver view";
  els.switchViewLink.href = caregiver ? "/" : "/?view=caregiver";
}

function getReadingsForRange(range) {
  const readings = [...state.readings];
  if (range === "all") return readings;
  const days = Number(range);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return readings.filter((reading) => new Date(reading.capturedAt) >= cutoff);
}

function getPreviousPeriodReadings(range) {
  if (range === "all") return [];
  const days = Number(range);
  const end = new Date();
  end.setDate(end.getDate() - days);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  return state.readings.filter((reading) => {
    const capturedAt = new Date(reading.capturedAt);
    return capturedAt >= start && capturedAt < end;
  });
}

function renderMetricGrid(target, cards) {
  target.innerHTML = "";
  for (const card of cards) {
    const fragment = els.metricTemplate.content.cloneNode(true);
    fragment.querySelector(".metric-label").textContent = card.label;
    fragment.querySelector(".metric-value").textContent = card.value;
    fragment.querySelector(".metric-detail").textContent = card.detail;
    target.append(fragment);
  }
}

function drawTrendChart(canvas, readings, options = {}) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!readings.length) {
    ctx.fillStyle = "#70685d";
    ctx.font = "16px Avenir Next, sans-serif";
    ctx.fillText("No readings yet", 24, 40);
    return;
  }

  const daily = collapseByDay(readings).reverse();
  const padding = options.compact
    ? { top: 24, right: 18, bottom: 24, left: 40 }
    : { top: 30, right: 24, bottom: 30, left: 44 };
  const values = daily.flatMap((reading) => [reading.systolic, reading.diastolic]);
  const minValue = Math.max(40, Math.min(...values) - 10);
  const maxValue = Math.min(220, Math.max(...values) + 10);
  const chartWidth = canvas.width - padding.left - padding.right;
  const chartHeight = canvas.height - padding.top - padding.bottom;

  ctx.strokeStyle = "rgba(38, 30, 19, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#7a7368";
  ctx.font = "12px Avenir Next, sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const value = Math.round(maxValue - ((maxValue - minValue) / 4) * i);
    const y = padding.top + (chartHeight / 4) * i + 4;
    ctx.fillText(String(value), 8, y);
  }

  drawSeries(ctx, daily, {
    key: "systolic",
    color: "#262032",
    minValue,
    maxValue,
    padding,
    chartWidth,
    chartHeight
  });
  drawSeries(ctx, daily, {
    key: "diastolic",
    color: "#e8c21c",
    minValue,
    maxValue,
    padding,
    chartWidth,
    chartHeight
  });
}

function drawSeries(ctx, readings, options) {
  const { key, color, minValue, maxValue, padding, chartWidth, chartHeight } = options;
  const range = maxValue - minValue || 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();

  readings.forEach((reading, index) => {
    const x = padding.left + (chartWidth / Math.max(readings.length - 1, 1)) * index;
    const y = padding.top + chartHeight - ((reading[key] - minValue) / range) * chartHeight;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  readings.forEach((reading, index) => {
    const x = padding.left + (chartWidth / Math.max(readings.length - 1, 1)) * index;
    const y = padding.top + chartHeight - ((reading[key] - minValue) / range) * chartHeight;
    ctx.fillStyle = "#fffdf8";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
  });
}

function collapseByDay(readings) {
  const byDay = new Map();

  for (const reading of [...readings].sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt))) {
    const key = toLocalDayKey(reading.capturedAt);
    const bucket = byDay.get(key) || [];
    bucket.push(reading);
    byDay.set(key, bucket);
  }

  return [...byDay.values()].map((bucket) => {
    const average = getAverage(bucket);
    return {
      capturedAt: bucket[0].capturedAt,
      systolic: average.systolic,
      diastolic: average.diastolic,
      pulse: average.pulse
    };
  });
}

function getAverage(readings) {
  if (!readings.length) {
    return { systolic: 0, diastolic: 0, pulse: 0 };
  }

  const totals = readings.reduce(
    (acc, reading) => {
      acc.systolic += Number(reading.systolic) || 0;
      acc.diastolic += Number(reading.diastolic) || 0;
      acc.pulse += Number(reading.pulse) || 0;
      return acc;
    },
    { systolic: 0, diastolic: 0, pulse: 0 }
  );

  return {
    systolic: Math.round(totals.systolic / readings.length),
    diastolic: Math.round(totals.diastolic / readings.length),
    pulse: Math.round(totals.pulse / readings.length)
  };
}

function classifyReading(reading) {
  if (reading.systolic < 90 || reading.diastolic < 60) return "low";
  if (reading.systolic >= 140 || reading.diastolic >= 90) return "high";
  if (reading.systolic >= 130 || reading.diastolic >= 80) return "stage1";
  if (reading.systolic >= 120 && reading.diastolic < 80) return "elevated";
  return "normal";
}

function formatSeverity(severity) {
  return {
    low: "Low",
    high: "Stage 2",
    stage1: "Stage 1",
    elevated: "Elevated",
    normal: "Normal"
  }[severity];
}

function severityClass(severity) {
  if (severity === "high" || severity === "low") return "severity-high";
  if (severity === "stage1" || severity === "elevated") return "severity-watch";
  return "severity-good";
}

function describeDelta(value) {
  if (!value) return "steady";
  const direction = value > 0 ? "up" : "down";
  return `${direction} ${Math.abs(value)} point${Math.abs(value) === 1 ? "" : "s"}`;
}

function formatDate(isoString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(isoString));
}

function getHour(isoString) {
  return new Date(isoString).getHours();
}

function toLocalDayKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildContextSummary(contextFlags = {}) {
  const labels = [];
  if (contextFlags.ateRecently) labels.push("after food");
  if (contextFlags.hadCaffeine) labels.push("after tea or coffee");
  if (contextFlags.afterWaking) labels.push("after waking up");
  if (contextFlags.afterNap) labels.push("after a nap");
  if (contextFlags.afterMedication) labels.push("after medicine");
  return labels.join(", ");
}

function normalizeReading(reading) {
  const contextFlags = {
    ateRecently: Boolean(reading.contextFlags?.ateRecently),
    hadCaffeine: Boolean(reading.contextFlags?.hadCaffeine),
    afterWaking: Boolean(reading.contextFlags?.afterWaking),
    afterNap: Boolean(reading.contextFlags?.afterNap),
    afterMedication: Boolean(reading.contextFlags?.afterMedication)
  };

  return {
    id: String(reading.id || crypto.randomUUID()),
    systolic: Number(reading.systolic) || 0,
    diastolic: Number(reading.diastolic) || 0,
    pulse: Number(reading.pulse) || 0,
    capturedAt: String(reading.capturedAt || new Date().toISOString()),
    context: String(reading.context || buildContextSummary(contextFlags)),
    contextFlags,
    position: String(reading.position || "Sitting"),
    notes: String(reading.notes || ""),
    medicationTaken: Boolean(reading.medicationTaken || contextFlags.afterMedication),
    fasting: Boolean(reading.fasting),
    entryMethod: String(reading.entryMethod || "manual")
  };
}

function toCsv(readings) {
  const rows = [
    [
      "id",
      "capturedAt",
      "systolic",
      "diastolic",
      "pulse",
      "classification",
      "ateRecently",
      "hadCaffeine",
      "afterWaking",
      "afterNap",
      "afterMedication",
      "notes"
    ],
    ...readings.map((reading) => [
      reading.id,
      reading.capturedAt,
      reading.systolic,
      reading.diastolic,
      reading.pulse,
      classifyReading(reading),
      reading.contextFlags.ateRecently,
      reading.contextFlags.hadCaffeine,
      reading.contextFlags.afterWaking,
      reading.contextFlags.afterNap,
      reading.contextFlags.afterMedication,
      reading.notes.replaceAll('"', '""')
    ])
  ];

  return rows.map((row) => row.map((cell) => `"${String(cell ?? "")}"`).join(",")).join("\n");
}

function downloadFile(filename, contents, contentType) {
  const blob = new Blob([contents], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createEmptyDraft() {
  return {
    systolic: "",
    diastolic: "",
    pulse: "",
    contextFlags: {
      ateRecently: false,
      hadCaffeine: false,
      afterWaking: false,
      afterNap: false,
      afterMedication: false
    },
    notes: ""
  };
}

function resetDraft() {
  state.draft = createEmptyDraft();
}

async function loadReadings() {
  const response = await fetch(`${API_BASE}/readings`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error("Could not load readings from the server.");
  }

  const payload = await response.json();
  return Array.isArray(payload.readings) ? payload.readings : [];
}

async function saveReading(reading) {
  const response = await fetch(`${API_BASE}/readings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(reading)
  });

  if (!response.ok) {
    throw new Error("Could not save reading to the server.");
  }

  return response.json();
}

function getCurrentView() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "caregiver" ? "caregiver" : "patient";
}
