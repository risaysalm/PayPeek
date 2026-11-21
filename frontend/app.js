// Single-offer page (index.html). Shared helpers live in common.js.
// Every number shown comes from the backend. The what-if sentence only subtracts
// one API result from another; it never does tax math.
const USE_MOCK = false;                    // set to true to use mock-estimate.json instead of the backend
const WHATIF_DELAY_MS = 300;               // wait this long after the last slider move before calling the API

let start = null;      // { salary, k401, data } from the last form submit
let latest = null;     // the /estimate response currently on screen
let explainId = 0;     // only the newest explain request may update the page
let requestId = 0;     // only the newest request may update the page
let whatIfTimer = null;

async function getEstimate(offer) {
    if (USE_MOCK) {
        const r = await fetch("mock-estimate.json");
        return r.json();
    }
    return postJSON("/estimate", offer);
}

// "Where your paycheck goes" bar. Every amount is from the API response: taxes are the API's
// tax and NJ deduction line items added together, and each share is that amount over the API's gross.
const TAX_KEYS = Object.keys(LABELS).filter((k) => k !== "pre_tax_401k");

function renderPaybar(data) {
    const p = data.per_paycheck;
    const parts = [
        { key: "net", label: "take-home", amount: p.net },
        { key: "tax", label: "taxes", amount: Math.round(TAX_KEYS.reduce((sum, k) => sum + p[k], 0) * 100) / 100 },
        { key: "401k", label: "401(k)", amount: p.pre_tax_401k },
    ];
    const pct = (amount) => (p.gross > 0 ? (amount / p.gross) * 100 : 0);

    for (const part of parts) {
        const seg = el(`seg-${part.key}`);
        seg.style.width = `${pct(part.amount)}%`;
        seg.hidden = part.amount <= 0;
        el(`leg-${part.key}`).textContent = `${money(part.amount)} (${Math.round(pct(part.amount))}%)`;
    }
    el("leg-401k-item").hidden = p.pre_tax_401k <= 0;
    el("paybar-gross").textContent = `Out of ${money(p.gross)} per paycheck before taxes.`;

    const shown = parts.filter((part) => part.amount > 0)
        .map((part) => `${money(part.amount)} ${part.label} (${Math.round(pct(part.amount))}%)`);
    el("paybar-track").setAttribute("aria-label",
        `Bar chart of your ${money(p.gross)} paycheck: ${shown.join(", ")}.`);
}

function show(data) {
    latest = data;
    clearExplanation();    // an old explanation would describe different numbers
    el("net").textContent = money(data.per_paycheck.net);
    renderPaybar(data);
    renderRows(el("rows"), data);
    renderNotes(el("notes"), data.notes);
    el("results").hidden = false;
}

// Cancel any pending or in-flight what-if request.
function cancelWhatIf() {
    clearTimeout(whatIfTimer);
    return ++requestId;
}

// ---- Starting result (form submit) ----

async function run(offer) {
    const id = cancelWhatIf();
    el("error").textContent = "";
    try {
        const data = await getEstimate(offer);
        if (id !== requestId) return;
        start = { salary: offer.annual_salary, k401: offer.k401_percent, data };
        show(data);
        setUpSliders();
        el("status").textContent = `Your take-home per paycheck is ${money(data.per_paycheck.net)}.`;
    } catch (e) {
        el("error").textContent = e.message;
    }
}

// ---- What-if sliders ----

// IRS 2026 limit on employee 401(k) contributions (elective deferrals): $24,500 (IRS Notice 2025-67).
// Used only to set how far the 401(k) slider goes. It is not used in any tax math, which the backend does.
const IRS_401K_EMPLOYEE_LIMIT_2026 = 24500;

// Each what-if value has a slider and a number box kept in sync. The box holds the exact
// value sent to the API: a typed $72,500 is sent as-is even though the slider moves in $1,000 steps,
// and a value beyond the slider's range is sent as typed while the slider rests at its nearest end.
// The boxes' own min/max in index.html match what the backend accepts.
const WHATIF = {
    k401: { slider: "whatif-k401", box: "whatif-k401-num", text: (v) => `${v}%` },
    salary: { slider: "whatif-salary", box: "whatif-salary-num", text: (v) => dollars(v) },
};
const lastGood = {};   // last valid value per key, restored if a typed value is left invalid

// Move the slider to v (the browser keeps it at its nearest end if v is out of range),
// tell screen readers the exact value, and optionally update the box too.
// A new salary also changes how far the 401(k) slider goes.
function setWhatIf(key, v, updateBox) {
    const c = WHATIF[key];
    const s = el(c.slider);
    s.value = v;
    s.setAttribute("aria-valuetext", c.text(v));
    if (updateBox) el(c.box).value = v;
    lastGood[key] = v;
    if (key === "salary") setK401SliderMax(v);
}

// 401(k) slider max: the whole percent of salary where the contribution reaches the IRS limit
// (rounded down, at least 1%, at most the backend's 100%).
function setK401SliderMax(salary) {
    const pct = Math.floor((IRS_401K_EMPLOYEE_LIMIT_2026 * 100) / salary);
    const k = el(WHATIF.k401.slider);
    k.max = Math.min(100, Math.max(1, pct));
    el("whatif-k401-max").textContent = `${k.max}%`;
    // Re-place the thumb from the box's exact value, since the old max may have clamped it.
    const box = el(WHATIF.k401.box);
    if (box.value !== "") k.value = box.value;
}

function setSlidersToStart() {
    setWhatIf("k401", start.k401, true);
    setWhatIf("salary", start.salary, true);
}

const whatIfValues = () => ({
    salary: Number(el(WHATIF.salary.box).value),
    k401: Number(el(WHATIF.k401.box).value),
});

function setUpSliders() {
    // Salary: $1,000 steps on either side of the entered salary, staying within 50%-150% of it.
    // Anchoring the steps on the entered salary means the slider can land exactly on it.
    const steps = Math.floor((start.salary * 0.5) / 1000);
    const s = el("whatif-salary");
    s.min = start.salary - steps * 1000;
    s.max = start.salary + steps * 1000;
    el("whatif-salary-min").textContent = dollars(Number(s.min));
    el("whatif-salary-max").textContent = dollars(Number(s.max));

    // 401(k) slider max is set from the salary inside setSlidersToStart (see setK401SliderMax).
    setSlidersToStart();
    el("whatif-summary").textContent = "";
    el("whatif").hidden = false;
}

// Difference of two API numbers, rounded to cents to hide floating-point noise.
const diff = (a, b) => Math.round((a - b) * 100) / 100;

function whatIfSentence(now, data) {
    const base = start.data.per_paycheck;
    const cur = data.per_paycheck;
    const takeHome = diff(cur.net, base.net);
    const savings = diff(cur.pre_tax_401k, base.pre_tax_401k);
    const beforeTax = diff(cur.gross, base.gross);
    const salaryChanged = now.salary !== start.salary;
    const k401Changed = now.k401 !== start.k401;

    const takeHomeChange = takeHome > 0 ? `raises your take-home by ${money(takeHome)}`
        : takeHome < 0 ? `lowers your take-home by ${money(-takeHome)}`
        : "doesn't change your take-home";

    if (!salaryChanged && !k401Changed) {
        return `These are your starting values: ${money(base.net)} take-home per paycheck.`;
    }
    if (k401Changed && !salaryChanged) {
        if (now.k401 > start.k401) {
            const more = start.k401 > 0 ? " more" : "";
            const joiner = -takeHome < savings ? "but only" : "and";
            return `Raising your 401(k) to ${now.k401}% puts ${money(savings)}${more} per paycheck into savings ` +
                `${joiner} lowers your take-home by ${money(-takeHome)}.`;
        }
        return `Lowering your 401(k) to ${now.k401}% puts ${money(-savings)} less per paycheck into savings ` +
            `and ${takeHomeChange}.`;
    }
    if (salaryChanged && !k401Changed) {
        const direction = beforeTax > 0 ? "up" : "down";
        return `At a ${dollars(now.salary)} salary, each paycheck goes ${direction} by ${money(Math.abs(beforeTax))} ` +
            `before taxes and ${money(Math.abs(takeHome))} after taxes.`;
    }
    const savingsChange = savings > 0 ? `puts ${money(savings)} more into savings`
        : savings < 0 ? `puts ${money(-savings)} less into savings`
        : "doesn't change your savings";
    return `At a ${dollars(now.salary)} salary with ${now.k401}% to your 401(k), each paycheck ` +
        `${savingsChange} and ${takeHomeChange}, compared with your starting result.`;
}

async function runWhatIf() {
    const id = ++requestId;
    const now = whatIfValues();
    el("error").textContent = "";
    try {
        const data = await getEstimate(offerBody(now.salary, now.k401));
        if (id !== requestId) return;      // a newer slider move or submit replaced this one
        show(data);
        el("whatif-summary").textContent = whatIfSentence(now, data);
    } catch (e) {
        if (id === requestId) el("error").textContent = e.message;
    }
}

function scheduleWhatIf() {
    cancelWhatIf();
    whatIfTimer = setTimeout(runWhatIf, WHATIF_DELAY_MS);
}

for (const [key, c] of Object.entries(WHATIF)) {
    const box = el(c.box);

    // Slider moved: copy its value into the box.
    el(c.slider).addEventListener("input", (e) => {
        setWhatIf(key, Number(e.target.value), true);
        scheduleWhatIf();
    });

    // Typing: only valid, in-range numbers update the slider and the paycheck.
    box.addEventListener("input", () => {
        if (box.value === "" || !box.validity.valid) {
            cancelWhatIf();        // don't send a half-typed number
            return;
        }
        setWhatIf(key, Number(box.value), false);
        scheduleWhatIf();
    });

    // Leaving the box with an invalid value: clamp to what the backend accepts, or restore the last good value.
    box.addEventListener("change", () => {
        if (box.value !== "" && box.validity.valid) return;
        const typed = Number(box.value);
        const min = Number(box.min);
        const max = Number(box.max);
        const v = box.value === "" || Number.isNaN(typed) ? lastGood[key]
            : Math.min(max, Math.max(min, key === "salary" ? Math.round(typed) : Math.round(typed * 2) / 2));
        setWhatIf(key, v, true);
        scheduleWhatIf();
    });
}

el("whatif-reset").addEventListener("click", () => {
    cancelWhatIf();
    setSlidersToStart();
    show(start.data);               // the saved starting result; no new request needed
    el("error").textContent = "";
    el("whatif-summary").textContent =
        `Back to your starting values: ${money(start.data.per_paycheck.net)} take-home per paycheck.`;
});

// ---- Explain my paycheck ----

const EXPLAIN_LABEL = "Explain my paycheck";

function clearExplanation() {
    explainId++;
    el("explain-box").hidden = true;
    el("explain-text").textContent = "";
    el("explain-source").textContent = "";
    el("explain-status").textContent = "";
    el("explain-btn").disabled = false;
    el("explain-btn").textContent = EXPLAIN_LABEL;
}

async function explainPaycheck() {
    clearExplanation();
    const id = explainId;
    const btn = el("explain-btn");
    btn.disabled = true;
    btn.textContent = "Explaining...";
    el("explain-status").textContent = "Writing a plain-English explanation of your paycheck...";
    try {
        const res = await postJSON("/explain", { estimate: latest });
        if (id !== explainId) return;          // numbers changed while we waited
        if (typeof res.explanation !== "string" || !res.explanation.trim()) throw new Error("empty explanation");
        // textContent only: the explanation is always shown as plain text, never as HTML.
        el("explain-text").textContent = res.explanation;
        el("explain-source").textContent = res.source === "ai"
            ? "Written by AI. The numbers above come from the tax calculator."
            : "Written from a fixed template, not AI.";
        el("explain-box").hidden = false;
        el("explain-status").textContent = "Explanation ready below.";
    } catch {
        if (id !== explainId) return;
        el("explain-status").textContent =
            "Sorry, we couldn't explain this paycheck right now. Your results above are unchanged. Please try again.";
    } finally {
        if (id === explainId) {
            btn.disabled = false;
            btn.textContent = EXPLAIN_LABEL;
        }
    }
}

el("explain-btn").addEventListener("click", explainPaycheck);

// ---- Form ----

el("offer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    run(offerBody(el("salary").value, el("k401").value));
});

el("sample").addEventListener("click", () => {
    el("salary").value = 70000;
    el("k401").value = 0;
    el("offer-form").requestSubmit();
});

// ---- Remember values between pages (see common.js) ----
const remembered = rememberFields(["salary", "k401"]);
el("offer-form").addEventListener("submit", remembered.save);
