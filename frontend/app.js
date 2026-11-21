// Single-offer page (index.html). Shared helpers live in common.js.
// Every number shown comes from the backend. The what-if sentence only subtracts
// one API result from another; it never does tax math.
const USE_MOCK = false;                    // set to true to use mock-estimate.json instead of the backend
const WHATIF_DELAY_MS = 300;               // wait this long after the last slider move before calling the API

let start = null;      // { salary, k401, data } from the last form submit
let requestId = 0;     // only the newest request may update the page
let whatIfTimer = null;

async function getEstimate(offer) {
    if (USE_MOCK) {
        const r = await fetch("mock-estimate.json");
        return r.json();
    }
    return postJSON("/estimate", offer);
}

function show(data) {
    el("net").textContent = money(data.per_paycheck.net);
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

function updateSliderLabels() {
    const k = el("whatif-k401");
    const s = el("whatif-salary");
    el("whatif-k401-out").textContent = `${k.value}%`;
    k.setAttribute("aria-valuetext", `${k.value}%`);
    el("whatif-salary-out").textContent = dollars(Number(s.value));
    s.setAttribute("aria-valuetext", dollars(Number(s.value)));
}

function setSlidersToStart() {
    el("whatif-k401").value = start.k401;
    el("whatif-salary").value = start.salary;
    updateSliderLabels();
}

function setUpSliders() {
    // Salary: $1,000 steps on either side of the entered salary, staying within 50%-150% of it.
    // Anchoring the steps on the entered salary means the slider can land exactly on it.
    const steps = Math.floor((start.salary * 0.5) / 1000);
    const s = el("whatif-salary");
    s.min = start.salary - steps * 1000;
    s.max = start.salary + steps * 1000;
    el("whatif-salary-min").textContent = dollars(Number(s.min));
    el("whatif-salary-max").textContent = dollars(Number(s.max));

    // 401(k): 0-15%, stretched only if the starting value was higher so Reset still works.
    const k = el("whatif-k401");
    k.max = Math.max(15, start.k401);
    el("whatif-k401-max").textContent = `${k.max}%`;

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
    const now = { salary: Number(el("whatif-salary").value), k401: Number(el("whatif-k401").value) };
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

function onSliderInput() {
    updateSliderLabels();
    cancelWhatIf();
    whatIfTimer = setTimeout(runWhatIf, WHATIF_DELAY_MS);
}

el("whatif-k401").addEventListener("input", onSliderInput);
el("whatif-salary").addEventListener("input", onSliderInput);

el("whatif-reset").addEventListener("click", () => {
    cancelWhatIf();
    setSlidersToStart();
    show(start.data);               // the saved starting result; no new request needed
    el("error").textContent = "";
    el("whatif-summary").textContent =
        `Back to your starting values: ${money(start.data.per_paycheck.net)} take-home per paycheck.`;
});

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
