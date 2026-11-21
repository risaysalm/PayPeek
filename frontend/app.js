const USE_MOCK = true;                     // flip to false when the backend is running
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
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Something went wrong");
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
        salary: Number(el("salary").value),
        pay_frequency: el("frequency").value,
        filing_status: "single",
        traditional_401k_percent: Number(el("k401").value),
    });
});

el("sample").addEventListener("click", () => {
    el("salary").value = 70000;
    el("k401").value = 0;
    el("offer-form").requestSubmit();
});