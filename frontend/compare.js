// Compare page (compare.html). Shared helpers live in common.js.
// All numbers come from the backend: two offers use /compare (side by side), three to ten use
// one /estimate call per offer (ranked table). The page only compares the API's returned
// numbers; it never does tax math.

const LETTERS = "abcdefghij".split("");
const MIN_OFFERS = 2;
const MAX_OFFERS = LETTERS.length;   // 10
const SAMPLE = {
    a: { salary: 70000, k401: 0 },
    b: { salary: 78000, k401: 6 },
    c: { salary: 85000, k401: 4 },
    d: { salary: 65000, k401: 0 },
    e: { salary: 92000, k401: 5 },
    f: { salary: 72000, k401: 3 },
    g: { salary: 88000, k401: 0 },
    h: { salary: 60000, k401: 2 },
    i: { salary: 100000, k401: 6 },
    j: { salary: 75000, k401: 10 },
};

const offerName = (x) => `Offer ${x.toUpperCase()}`;
let count = MIN_OFFERS;    // offers currently shown (A and B always)
let compareId = 0;         // only the newest comparison may update the page

// Small DOM helper: element with optional class, text and attributes (text is never parsed as HTML).
function make(tag, { cls, text, attrs } = {}) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
    return node;
}

// ---- Offer inputs C to J (built once; hidden and disabled until added) ----

function buildOfferFieldset(x) {
    const name = offerName(x);
    const fs = make("fieldset", { attrs: { id: `${x}-fieldset` } });
    fs.hidden = true;
    fs.disabled = true;    // disabled controls skip form validation while hidden
    fs.append(
        make("legend", { text: name }),
        make("label", { text: `${name} annual salary ($)`, attrs: { for: `${x}-salary` } }),
        make("input", { attrs: { id: `${x}-salary`, type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "e.g. 72000", required: "" } }),
        make("label", { text: `${name} 401(k) contribution (%)`, attrs: { for: `${x}-k401` } }),
        make("input", { attrs: { id: `${x}-k401`, type: "number", min: "0", max: "100", step: "0.5", value: "0", placeholder: "e.g. 5", required: "" } }),
    );
    const remove = make("button", { cls: "remove-offer", text: "Remove", attrs: { type: "button" } });
    remove.append(make("span", { cls: "visually-hidden", text: ` ${name}` }));   // read as "Remove Offer C"
    remove.addEventListener("click", () => removeOffer(x));
    fs.append(remove);
    return fs;
}

for (const x of LETTERS.slice(MIN_OFFERS)) el("offer-inputs").append(buildOfferFieldset(x));

// ---- Two offers: side by side (unchanged) ----

function showOffer(prefix, name, data, k401Percent) {
    el(`${prefix}-heading`).textContent =
        `${name}: ${dollars(data.annual.gross)} salary, ${k401Percent}% to 401(k)`;
    el(`${prefix}-net`).textContent = money(data.per_paycheck.net);
    renderRows(el(`${prefix}-rows`), data);
    renderNotes(el(`${prefix}-notes`), data.notes);
}

// Take-home already has 401(k) savings taken out, so call that out in plain words.
function k401Notes(named) {
    let text = "";
    for (const [name, offer] of named) {
        if (offer.annual.pre_tax_401k > 0) {
            text += ` ${name} also puts ${money(offer.per_paycheck.pre_tax_401k)} per paycheck ` +
                `(${money(offer.annual.pre_tax_401k)} a year) into your 401(k), which is still your money.`;
        }
    }
    return text;
}

// Two offers: plain-language summary built from the backend's difference_b_minus_a.
function summaryText(res) {
    const perCheck = res.difference_b_minus_a.per_paycheck.net;
    const perYear = res.difference_b_minus_a.annual.net;
    let text;
    if (Math.abs(perCheck) < 0.005) {
        text = `Both offers leave you the same take-home pay: ${money(res.offer_a.per_paycheck.net)} per paycheck.`;
    } else {
        const winner = perCheck > 0 ? "Offer B" : "Offer A";
        text = `${winner} leaves you ${money(Math.abs(perCheck))} more per paycheck ` +
            `(${money(Math.abs(perYear))} more per year).`;
    }
    return text + k401Notes([["Offer A", res.offer_a], ["Offer B", res.offer_b]]);
}

// ---- Three to ten offers: ranked table + breakdowns ----

// "A, B, and C" / "A and B".
function listWords(words) {
    if (words.length <= 2) return words.join(" and ");
    return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

// Difference of two API numbers, rounded to cents to hide floating-point noise.
const centsDiff = (a, b) => Math.round((a - b) * 100) / 100;

// Sentence naming the highest take-home per paycheck (from the API's per-paycheck net).
function rankedSummaryText(ok) {
    if (ok.length === 0) return "";
    const best = ok[0].data.per_paycheck.net;          // ok is already sorted, best first
    const top = ok.filter((o) => centsDiff(best, o.data.per_paycheck.net) === 0);
    let text;
    if (ok.length === 1) {
        text = `${ok[0].name} is the only offer we could calculate: ${money(best)} take-home per paycheck.`;
    } else if (top.length === ok.length) {
        text = `All ${ok.length} offers leave you the same take-home pay: ${money(best)} per paycheck.`;
    } else if (top.length > 1) {
        text = `${listWords(top.map((o) => o.name))} tie for the most take-home pay: ${money(best)} per paycheck.`;
    } else {
        text = `${top[0].name} leaves you the most take-home pay: ${money(best)} per paycheck.`;
    }
    // 401(k) notes in offer order (A, B, C...), like the two-offer summary.
    const byLetter = [...ok].sort((p, q) => LETTERS.indexOf(p.x) - LETTERS.indexOf(q.x));
    return text + k401Notes(byLetter.map((o) => [o.name, o.data]));
}

// A table cell that also carries its column name, shown as a label on narrow screens.
function cell(label, text, cls) {
    return make("td", { cls, text, attrs: { role: "cell", "data-label": label } });
}

function renderRanked(ok, failed) {
    const tbody = el("ranked-rows");
    tbody.replaceChildren();
    const best = ok.length ? ok[0].data.per_paycheck.net : 0;

    for (const o of ok) {
        const gap = centsDiff(best, o.data.per_paycheck.net);
        const tr = make("tr", { cls: gap === 0 ? "is-best" : "", attrs: { role: "row" } });
        tr.append(
            make("th", { text: o.name, attrs: { scope: "row", role: "rowheader" } }),
            cell("Salary", dollars(o.data.annual.gross)),
            cell("401(k)", `${o.k401}%`),
            cell("Take-home per paycheck", money(o.data.per_paycheck.net), "num-strong"),
            cell("Take-home per year", money(o.data.annual.net)),
            cell("Per paycheck vs. best", gap === 0 ? "Best" : `${money(gap)} less`, gap === 0 ? "best-label" : ""),
        );
        tbody.append(tr);
    }
    // Failed offers go last and say what went wrong; the rest of the table still shows.
    for (const o of failed) {
        const tr = make("tr", { cls: "is-failed", attrs: { role: "row" } });
        const why = make("td", { cls: "failed", text: `Couldn't calculate: ${o.error}`, attrs: { role: "cell", colspan: "4", "data-label": "Result" } });
        tr.append(
            make("th", { text: o.name, attrs: { scope: "row", role: "rowheader" } }),
            cell("Salary", o.salary === "" ? "-" : dollars(Number(o.salary))),
            cell("401(k)", `${o.k401}%`),
            why,
        );
        tbody.append(tr);
    }

    // Full breakdowns in offer order (A, B, C...), closed by default.
    const box = el("breakdowns");
    box.replaceChildren();
    for (const o of [...ok].sort((p, q) => LETTERS.indexOf(p.x) - LETTERS.indexOf(q.x))) {
        const details = make("details", { cls: "breakdown" });
        details.append(make("summary", {
            text: `${o.name}: ${dollars(o.data.annual.gross)} salary, ${o.k401}% to 401(k), ` +
                `${money(o.data.per_paycheck.net)} take-home per paycheck`,
        }));
        const body = make("div", { cls: "breakdown-body" });
        const table = make("table");
        table.append(make("caption", { cls: "visually-hidden", text: `${o.name} deductions` }));
        const head = make("thead");
        const hr = make("tr");
        for (const h of ["Item", "Per paycheck", "Per year"]) hr.append(make("th", { text: h, attrs: { scope: "col" } }));
        head.append(hr);
        const rows = make("tbody");
        renderRows(rows, o.data);
        table.append(head, rows);
        const notes = make("ul", { cls: "notes", attrs: { "aria-label": `${o.name} notes` } });
        renderNotes(notes, o.data.notes);
        body.append(table, notes);
        details.append(body);
        box.append(details);
    }
}

// ---- Adding and removing offers ----

function staleResults() {
    compareId++;                       // ignore any comparison still in flight
    el("results").hidden = true;
    el("ranked").hidden = true;
    el("summary").textContent = "";
    el("error").textContent = "";
}

// Show offers A..(n); hide and disable the rest so hidden inputs skip validation.
function setCount(n) {
    count = Math.min(MAX_OFFERS, Math.max(MIN_OFFERS, n));
    LETTERS.slice(MIN_OFFERS).forEach((x, i) => {
        const fs = el(`${x}-fieldset`);
        fs.hidden = fs.disabled = i + MIN_OFFERS >= count;
    });
    el("offer-count").value = String(count);
    const full = count >= MAX_OFFERS;
    el("add-offer").disabled = full;
    el("offer-limit").textContent = full
        ? "You've added 10 offers, the most you can compare at once. Remove one to add another."
        : "You can compare up to 10 offers.";
}

el("add-offer").addEventListener("click", () => {
    if (count >= MAX_OFFERS) return;
    staleResults();
    setCount(count + 1);
    const x = LETTERS[count - 1];
    el(`${x}-salary`).value = "";
    el(`${x}-k401`).value = "0";
    remembered.save();
    el("offer-status").textContent = `${offerName(x)} added. ${count} offers.`;
    el(`${x}-salary`).focus();
});

// Removing an offer moves the later offers' values up one letter, so letters never skip.
function removeOffer(removed) {
    staleResults();
    for (let i = LETTERS.indexOf(removed); i < count - 1; i++) {
        el(`${LETTERS[i]}-salary`).value = el(`${LETTERS[i + 1]}-salary`).value;
        el(`${LETTERS[i]}-k401`).value = el(`${LETTERS[i + 1]}-k401`).value;
    }
    const last = LETTERS[count - 1];
    el(`${last}-salary`).value = "";
    el(`${last}-k401`).value = "0";
    setCount(count - 1);
    remembered.save();
    el("offer-status").textContent = `${offerName(removed)} removed. ${count} offers left.`;
    el("add-offer").focus();
}

// ---- Comparing ----

async function compareTwo(id, offers) {
    const res = await postJSON("/compare", {
        offer_a: offerBody(offers[0].salary, offers[0].k401),
        offer_b: offerBody(offers[1].salary, offers[1].k401),
    });
    if (id !== compareId) return;      // offers were added or removed meanwhile
    showOffer("a", "Offer A", res.offer_a, Number(offers[0].k401));
    showOffer("b", "Offer B", res.offer_b, Number(offers[1].k401));
    el("results").hidden = false;
    el("summary").textContent = summaryText(res);
}

async function compareMany(id, offers) {
    // One /estimate call per offer, all at once; a failure only affects its own offer.
    const settled = await Promise.allSettled(offers.map((o) => postJSON("/estimate", offerBody(o.salary, o.k401))));
    if (id !== compareId) return;
    const ok = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === "fulfilled") ok.push({ ...offers[i], data: r.value });
        else failed.push({ ...offers[i], error: r.reason.message || "Something went wrong." });
    });
    ok.sort((p, q) => q.data.per_paycheck.net - p.data.per_paycheck.net);   // stable: ties keep A, B, C order

    renderRanked(ok, failed);
    el("ranked").hidden = false;
    el("summary").textContent = rankedSummaryText(ok);
    if (failed.length) {
        el("error").textContent = `We couldn't calculate ${listWords(failed.map((o) => o.name))}. ` +
            (ok.length ? "The other offers are shown below." : "Please check the values and try again.");
    }
}

async function compare() {
    const id = ++compareId;
    const offers = LETTERS.slice(0, count).map((x) => ({
        x,
        name: offerName(x),
        salary: el(`${x}-salary`).value,
        k401: el(`${x}-k401`).value,
    }));
    const button = el("compare-submit");
    el("error").textContent = "";
    el("results").hidden = true;
    el("ranked").hidden = true;
    el("summary").textContent = "Comparing offers...";
    button.disabled = true;
    try {
        if (offers.length === 2) await compareTwo(id, offers);
        else await compareMany(id, offers);
    } catch (e) {
        if (id !== compareId) return;
        el("summary").textContent = "";
        el("error").textContent = e.message;
    } finally {
        button.disabled = false;
    }
}

el("compare-form").addEventListener("submit", (e) => {
    e.preventDefault();
    compare();
});

// Fills every offer that's showing, then compares.
el("sample").addEventListener("click", () => {
    for (const x of LETTERS.slice(0, count)) {
        el(`${x}-salary`).value = SAMPLE[x].salary;
        el(`${x}-k401`).value = SAMPLE[x].k401;
    }
    el("compare-form").requestSubmit();
});

// ---- Remember values between pages (see common.js) ----
const FIELD_IDS = LETTERS.flatMap((x) => [`${x}-salary`, `${x}-k401`]).concat("offer-count");
const remembered = rememberFields(FIELD_IDS);
setCount(Number(el("offer-count").value) || MIN_OFFERS);
// Offer A still empty: start it from the values entered on the One offer page.
if (el("a-salary").value === "" && remembered.saved.salary) {
    el("a-salary").value = remembered.saved.salary;
    if (typeof remembered.saved.k401 === "string" && remembered.saved.k401 !== "") {
        el("a-k401").value = remembered.saved.k401;
    }
    remembered.save();
}
el("compare-form").addEventListener("submit", remembered.save);
