// Compare page (compare.html). Shared helpers live in common.js.
// All numbers come from the backend: two offers use /compare, three or four use one
// /estimate call per offer. The summary only compares the API's returned numbers; no tax math here.

const LETTERS = ["a", "b", "c", "d"];
const MIN_OFFERS = 2;
const MAX_OFFERS = 4;
const SAMPLE = {
    a: { salary: 70000, k401: 0 },
    b: { salary: 78000, k401: 6 },
    c: { salary: 85000, k401: 4 },
    d: { salary: 65000, k401: 0 },
};

const offerName = (x) => `Offer ${x.toUpperCase()}`;
let count = MIN_OFFERS;    // offers currently shown (A and B always)
let compareId = 0;         // only the newest comparison may update the page

// ---- Showing results ----

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

// "A, B, and C" / "A and B".
function listWords(words) {
    if (words.length <= 2) return words.join(" and ");
    return `${words.slice(0, -1).join(", ")}, and ${words[words.length - 1]}`;
}

// Difference of two API numbers, rounded to cents to hide floating-point noise.
const centsDiff = (a, b) => Math.round((a - b) * 100) / 100;

// Three or four offers: name the highest take-home per paycheck and how much more it
// leaves than each other offer, using only the per-paycheck net the API returned.
function multiSummaryText(named) {
    const nets = named.map(([name, data]) => ({ name, net: data.per_paycheck.net }));
    const best = Math.max(...nets.map((o) => o.net));
    const top = nets.filter((o) => centsDiff(best, o.net) === 0);
    const rest = nets.filter((o) => centsDiff(best, o.net) !== 0);

    let text;
    if (rest.length === 0) {
        text = `All ${nets.length} offers leave you the same take-home pay: ${money(best)} per paycheck.`;
    } else {
        const lead = top.length === 1
            ? `${top[0].name} leaves you the most take-home pay`
            : `${listWords(top.map((o) => o.name))} tie for the most take-home pay`;
        const gaps = rest.map((o) => `${money(centsDiff(best, o.net))} more than ${o.name}`);
        text = `${lead}: ${money(best)} per paycheck. That's ${listWords(gaps)}.`;
    }
    return text + k401Notes(named);
}

// ---- Adding and removing offers ----

function staleResults() {
    compareId++;                       // ignore any comparison still in flight
    el("results").hidden = true;
    el("summary").textContent = "";
    el("error").textContent = "";
}

// Show offers A..(n), hide and disable the rest so hidden inputs skip validation.
function setCount(n) {
    count = Math.min(MAX_OFFERS, Math.max(MIN_OFFERS, n));
    LETTERS.forEach((x, i) => {
        const shown = i < count;
        const fs = el(`${x}-fieldset`);
        if (fs) {
            fs.hidden = !shown;
            fs.disabled = !shown;
        }
        el(`${x}-result`).hidden = !shown;
    });
    el("offer-inputs").dataset.count = count;
    el("offer-results").dataset.count = count;
    document.body.classList.toggle("many-offers", count > 2);
    el("offer-count").value = String(count);
    el("add-offer").hidden = count >= MAX_OFFERS;
    el("offer-limit").hidden = count < MAX_OFFERS;
}

el("add-offer").addEventListener("click", () => {
    staleResults();
    setCount(count + 1);
    const x = LETTERS[count - 1];
    el(`${x}-salary`).value = "";
    el(`${x}-k401`).value = "0";
    remembered.save();
    el("offer-status").textContent = `${offerName(x)} added.`;
    el(`${x}-salary`).focus();
});

// Removing C while D is shown moves D's values up into C, so letters stay A, B, C.
for (const btn of document.querySelectorAll(".remove-offer")) {
    btn.addEventListener("click", () => {
        const removed = btn.dataset.offer;
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
    });
}

// ---- Comparing ----

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
    el("summary").textContent = "Comparing offers...";
    button.disabled = true;
    try {
        let named;
        let summary;
        if (offers.length === 2) {
            const res = await postJSON("/compare", {
                offer_a: offerBody(offers[0].salary, offers[0].k401),
                offer_b: offerBody(offers[1].salary, offers[1].k401),
            });
            named = [["Offer A", res.offer_a], ["Offer B", res.offer_b]];
            summary = summaryText(res);
        } else {
            // One /estimate call per offer, all at once.
            const results = await Promise.all(offers.map((o) =>
                postJSON("/estimate", offerBody(o.salary, o.k401)).catch((e) => {
                    throw new Error(`${o.name}: ${e.message}`);
                })));
            named = offers.map((o, i) => [o.name, results[i]]);
            summary = multiSummaryText(named);
        }
        if (id !== compareId) return;      // offers were added or removed meanwhile
        offers.forEach((o, i) => showOffer(o.x, o.name, named[i][1], Number(o.k401)));
        el("results").hidden = false;
        el("summary").textContent = summary;
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
