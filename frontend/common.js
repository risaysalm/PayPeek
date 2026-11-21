// Shared by index.html (app.js) and compare.html (compare.js).
// The backend does all tax math; these helpers only send requests and display results.

const API_BASE = "http://localhost:8000";

const LABELS = {
    federal_income_tax: "Federal income tax",
    social_security: "Social Security",
    medicare: "Medicare",
    nj_income_tax: "New Jersey income tax",
    nj_ui_wf: "NJ unemployment & workforce",
    nj_tdi: "NJ disability insurance",
    nj_fli: "NJ family leave insurance",
    pre_tax_401k: "401(k) contribution",
};

const money = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const el = (id) => document.getElementById(id);

// One offer in the shape the backend's /estimate and /compare expect.
function offerBody(salary, k401Percent) {
    return {
        tax_year: 2026,
        annual_salary: Number(salary),
        pay_frequency: "biweekly",
        filing_status: "single",
        k401_percent: Number(k401Percent),
        nj_allowances: 1,
    };
}

// FastAPI errors put the message in "detail": either a string or a list of {msg} objects.
function errorMessage(data) {
    const d = data && data.detail;
    if (typeof d === "string" && d) return d;
    if (Array.isArray(d)) {
        const msgs = d.map((x) => x && x.msg).filter(Boolean);
        if (msgs.length) return msgs.join(" ");
    }
    return "Something went wrong.";
}

async function postJSON(path, body) {
    const r = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    let data = null;
    try {
        data = await r.json();
    } catch {
        // Response wasn't JSON (e.g. an HTML 500 page); errorMessage falls back below.
    }
    if (!r.ok || !data) throw new Error(errorMessage(data));
    return data;
}

// Fill a <tbody> with one row per deduction: label, per paycheck, per year.
function renderRows(tbody, data) {
    tbody.innerHTML = "";
    for (const [key, label] of Object.entries(LABELS)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${label}</td><td>${money(data.per_paycheck[key])}</td><td>${money(data.annual[key])}</td>`;
        tbody.appendChild(tr);
    }
}

// Fill a <ul> with the backend's notes (textContent, so note text is never parsed as HTML).
function renderNotes(ul, notes) {
    ul.innerHTML = "";
    for (const note of notes || []) {
        const li = document.createElement("li");
        li.textContent = note;
        ul.appendChild(li);
    }
    ul.hidden = ul.children.length === 0;
}
