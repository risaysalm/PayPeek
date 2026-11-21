"""Deterministic paycheck engine. No AI here; every number comes from config + arithmetic.

Conventions
- Work in annual Decimal amounts, round each annual line item to cents.
- per_paycheck = annual / pay periods, rounded to cents (an average; see notes
  for wage-base caps that stop mid-year).
"""
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .config import load_config

CENT = Decimal("0.01")
LINE_ITEMS = [
    "gross", "federal_income_tax", "social_security", "medicare",
    "nj_income_tax", "nj_ui_wf", "nj_tdi", "nj_fli", "pre_tax_401k", "net",
]


def money(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


def bracket_tax(amount: Decimal, schedule: list[dict]) -> Decimal:
    """Generic 'base + rate * (amount - over)' table lookup."""
    if amount <= 0:
        return Decimal(0)
    row = max((r for r in schedule if amount > r["over"]), key=lambda r: r["over"],
              default=schedule[0])
    return row["base"] + row["rate"] * (amount - row["over"])


@dataclass(frozen=True)
class Offer:
    annual_salary: Decimal
    k401_percent: Decimal = Decimal(0)   # e.g. 6 for 6%
    nj_allowances: int = 0
    pay_frequency: str = "biweekly"
    filing_status: str = "single"
    tax_year: int = 2026


def federal_income_tax(wages_after_401k: Decimal, cfg: dict, status: str = "single") -> Decimal:
    fed = cfg["federal"]
    adjusted = max(Decimal(0), wages_after_401k - fed["line_1g_adjustment"][status])
    return bracket_tax(adjusted, fed["annual_standard_schedule"][status])


def social_security(gross: Decimal, cfg: dict) -> Decimal:
    ss = cfg["fica"]["social_security"]
    return min(gross, ss["wage_base"]) * ss["rate"]


def medicare(gross: Decimal, cfg: dict) -> Decimal:
    m = cfg["fica"]["medicare"]
    extra = max(Decimal(0), gross - m["additional_threshold"]) * m["additional_rate"]
    return gross * m["rate"] + extra


def nj_income_tax(nj_wages: Decimal, allowances: int, cfg: dict, table: str = "A") -> Decimal:
    it = cfg["nj"]["income_tax"]
    taxable = max(Decimal(0), nj_wages - it["allowance_value"] * allowances)
    return bracket_tax(taxable, it["rate_tables"][table])


def capped(gross: Decimal, item: dict) -> Decimal:
    return min(gross, item["wage_base"]) * item["rate"]


def estimate(offer: Offer) -> dict:
    cfg = load_config(offer.tax_year)
    periods = cfg["pay_periods"][offer.pay_frequency]
    gross = Decimal(offer.annual_salary)
    k401 = money(gross * offer.k401_percent / 100)

    nj_cfg = cfg["nj"]
    nj_wages = gross - k401 if nj_cfg["income_tax"]["excludes_401k"] else gross
    wc = nj_cfg["worker_contributions"]

    annual = {
        "gross": money(gross),
        "federal_income_tax": money(federal_income_tax(gross - k401, cfg, offer.filing_status)),
        "social_security": money(social_security(gross, cfg)),   # 401(k) does NOT reduce FICA
        "medicare": money(medicare(gross, cfg)),
        "nj_income_tax": money(nj_income_tax(nj_wages, offer.nj_allowances, cfg)),
        "nj_ui_wf": money(capped(gross, wc["ui_wf_swf"])),       # 401(k) does NOT reduce these
        "nj_tdi": money(capped(gross, wc["tdi"])),
        "nj_fli": money(capped(gross, wc["fli"])),
        "pre_tax_401k": k401,
    }
    annual["net"] = annual["gross"] - sum(v for k, v in annual.items() if k != "gross")
    per_paycheck = {k: money(v / periods) for k, v in annual.items()}

    notes = []
    for key, item, label in [("nj_ui_wf", wc["ui_wf_swf"], "NJ UI/WF/SWF"),
                             ("social_security", cfg["fica"]["social_security"], "Social Security")]:
        if gross > item["wage_base"]:
            n = int((item["wage_base"] / (gross / periods)).to_integral_value(rounding="ROUND_CEILING"))
            notes.append(f"{label} stops once year-to-date wages reach ${item['wage_base']:,}"
                         f" (around paycheck {n} of {periods}); per-paycheck figure is the yearly average.")
    if offer.nj_allowances == 0:
        notes.append("NJ withholding assumes Rate A with 0 allowances (no NJ-W4 on file).")

    return {
        "tax_year": offer.tax_year,
        "per_paycheck": {k: float(per_paycheck[k]) for k in LINE_ITEMS},
        "annual": {k: float(annual[k]) for k in LINE_ITEMS},
        "notes": notes,
    }
