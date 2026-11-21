const USE_MOCK = false;                    // set to true to use mock-estimate.json instead of the backend
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

async function getEstimate(offer) {
    if (USE_MOCK) {
        const r = await fetch("mock-estimate.json");
        return r.json();
    }
    const r = await fetch(`${API_BASE}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offer),
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

function show(data) {
    el("net").textContent = money(data.per_paycheck.net);
    const rows = el("rows");
    rows.innerHTML = "";
    for (const [key, label] of Object.entries(LABELS)) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${label}</td><td>${money(data.per_paycheck[key])}</td><td>${money(data.annual[key])}</td>`;
        rows.appendChild(tr);
    }
    el("results").hidden = false;
}

async function run(offer) {
    el("error").textContent = "";
    try {
        show(await getEstimate(offer));
    } catch (e) {
        el("error").textContent = e.message;
    }
}

el("offer-form").addEventListener("submit", (e) => {
    e.preventDefault();
    run({
        tax_year: 2026,
        annual_salary: Number(el("salary").value),
        pay_frequency: el("frequency").value,
        filing_status: "single",
        k401_percent: Number(el("k401").value),
        nj_allowances: 1,
    });
});

el("sample").addEventListener("click", () => {
    el("salary").value = 70000;
    el("k401").value = 0;
    el("offer-form").requestSubmit();
});