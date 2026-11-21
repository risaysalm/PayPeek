// Compare page (compare.html). Shared helpers live in common.js.
// All numbers come from the backend's /compare response; nothing is calculated here.

const SAMPLE = { a: { salary: 70000, k401: 0 }, b: { salary: 78000, k401: 6 } };

function showOffer(prefix, name, data, k401Percent) {
    el(`${prefix}-heading`).textContent =
        `${name}: ${dollars(data.annual.gross)} salary, ${k401Percent}% to 401(k)`;
    el(`${prefix}-net`).textContent = money(data.per_paycheck.net);
    renderRows(el(`${prefix}-rows`), data);
    renderNotes(el(`${prefix}-notes`), data.notes);
}

// Plain-language summary of the take-home difference, built from difference_b_minus_a.
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
    // Take-home already has 401(k) savings taken out, so call that out in plain words.
    for (const [name, offer] of [["Offer A", res.offer_a], ["Offer B", res.offer_b]]) {
        if (offer.annual.pre_tax_401k > 0) {
            text += ` ${name} also puts ${money(offer.per_paycheck.pre_tax_401k)} per paycheck ` +
                `(${money(offer.annual.pre_tax_401k)} a year) into your 401(k), which is still your money.`;
        }
    }
    return text;
}

async function compare() {
    const inputs = {
        a: { salary: el("a-salary").value, k401: el("a-k401").value },
        b: { salary: el("b-salary").value, k401: el("b-k401").value },
    };
    const button = el("compare-submit");
    el("error").textContent = "";
    el("summary").textContent = "Comparing offers...";
    button.disabled = true;
    try {
        const res = await postJSON("/compare", {
            offer_a: offerBody(inputs.a.salary, inputs.a.k401),
            offer_b: offerBody(inputs.b.salary, inputs.b.k401),
        });
        showOffer("a", "Offer A", res.offer_a, Number(inputs.a.k401));
        showOffer("b", "Offer B", res.offer_b, Number(inputs.b.k401));
        el("results").hidden = false;
        el("summary").textContent = summaryText(res);
    } catch (e) {
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

el("sample").addEventListener("click", () => {
    el("a-salary").value = SAMPLE.a.salary;
    el("a-k401").value = SAMPLE.a.k401;
    el("b-salary").value = SAMPLE.b.salary;
    el("b-k401").value = SAMPLE.b.k401;
    el("compare-form").requestSubmit();
});

// ---- Remember values between pages (see common.js) ----
const remembered = rememberFields(["a-salary", "a-k401", "b-salary", "b-k401"]);
// Offer A still empty: start it from the values entered on the One offer page.
if (el("a-salary").value === "" && remembered.saved.salary) {
    el("a-salary").value = remembered.saved.salary;
    if (typeof remembered.saved.k401 === "string" && remembered.saved.k401 !== "") {
        el("a-k401").value = remembered.saved.k401;
    }
    remembered.save();
}
el("compare-form").addEventListener("submit", remembered.save);
