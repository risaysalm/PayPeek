"""Plain-English explanations. Input is engine output only; this module never does tax math.

The template version runs with no API key and is the fallback. An LLM call can replace
`explain()` later: give it the same dict, tell it to explain but not change any numbers,
and check that every dollar figure in its reply appears in the input.
"""


def _usd(x: float) -> str:
    return f"${x:,.2f}"


def explain(est: dict) -> str:
    p, a = est["per_paycheck"], est["annual"]
    taxes = sum(p[k] for k in ("federal_income_tax", "social_security", "medicare",
                               "nj_income_tax", "nj_ui_wf", "nj_tdi", "nj_fli"))
    lines = [
        f"Each biweekly paycheck starts at {_usd(p['gross'])} and you take home about {_usd(p['net'])}.",
        f"About {_usd(taxes)} per check goes to taxes: {_usd(p['federal_income_tax'])} federal income tax, "
        f"{_usd(p['social_security'] + p['medicare'])} Social Security and Medicare, "
        f"{_usd(p['nj_income_tax'])} NJ income tax, and "
        f"{_usd(p['nj_ui_wf'] + p['nj_tdi'] + p['nj_fli'])} for NJ unemployment, disability and family leave insurance.",
    ]
    if p["pre_tax_401k"]:
        lines.append(f"{_usd(p['pre_tax_401k'])} goes into your 401(k). That's still your money, and it lowers your income tax.")
    lines.append(f"Over the year that's {_usd(a['net'])} take-home on {_usd(a['gross'])} salary.")
    return " ".join(lines + est.get("notes", []))
