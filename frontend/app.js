// Single-offer page (index.html). Shared helpers live in common.js.
const USE_MOCK = false;                    // set to true to use mock-estimate.json instead of the backend

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
    run(offerBody(el("salary").value, el("k401").value));
});

el("sample").addEventListener("click", () => {
    el("salary").value = 70000;
    el("k401").value = 0;
    el("offer-form").requestSubmit();
});
