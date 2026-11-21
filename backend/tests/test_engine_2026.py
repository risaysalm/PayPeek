"""2026 engine tests. Expected values are worked by hand from the cited tables."""
from decimal import Decimal as D

import pytest

from app.engine import Offer, estimate
from app.engine.calculator import federal_income_tax, nj_income_tax
from app.engine.config import load_config

CFG = load_config(2026)


# ---- Test case 1: $70,000, single, biweekly, no 401(k) -------------------------
@pytest.fixture(scope="module")
def tc1():
    return estimate(Offer(annual_salary=D(70000)))


@pytest.mark.parametrize("item, annual, per_check", [
    # (70,000 - 8,600) = 61,400 -> 5,800 + 22% * (61,400 - 57,900) = 6,570
    ("federal_income_tax", 6570.00, 252.69),
    ("social_security",    4340.00, 166.92),   # 6.2%
    ("medicare",           1015.00,  39.04),   # 1.45%
    ("nj_ui_wf",            190.40,   7.32),   # 0.425% * 44,800 cap
    ("nj_tdi",              133.00,   5.12),   # 0.19%
    ("nj_fli",              161.00,   6.19),   # 0.23%
    # Rate A, 0 allowances: 795 + 6.1% * (70,000 - 40,000) = 2,625
    ("nj_income_tax",      2625.00, 100.96),
    ("pre_tax_401k",          0.00,   0.00),
])
def test_case_1_line_items(tc1, item, annual, per_check):
    assert tc1["annual"][item] == annual
    assert tc1["per_paycheck"][item] == per_check


def test_case_1_net(tc1):
    assert tc1["annual"]["net"] == 54965.60
    assert tc1["per_paycheck"]["net"] == 2114.06
    assert tc1["tax_year"] == 2026


# ---- Test case 2: same, 6% to a pre-tax 401(k) -------------------------------------
@pytest.fixture(scope="module")
def tc2():
    return estimate(Offer(annual_salary=D(70000), k401_percent=D(6)))


def test_case_2_401k_lowers_federal(tc2):
    # 70,000 - 4,200 - 8,600 = 57,200 -> 1,240 + 12% * (57,200 - 19,900) = 5,716
    assert tc2["annual"]["pre_tax_401k"] == 4200.00
    assert tc2["annual"]["federal_income_tax"] == 5716.00
    assert tc2["per_paycheck"]["federal_income_tax"] == 219.85


def test_case_2_401k_does_not_lower_fica_or_nj_payroll(tc2, tc1):
    for item in ("social_security", "medicare", "nj_ui_wf", "nj_tdi", "nj_fli"):
        assert tc2["annual"][item] == tc1["annual"][item]


def test_case_2_401k_lowers_nj_income_tax(tc2):
    # NJ excludes 401(k) deferrals: 795 + 6.1% * (65,800 - 40,000) = 2,368.80
    assert tc2["annual"]["nj_income_tax"] == 2368.80


# ---- Edges and invariants ------------------------------------------------------------
def test_federal_zero_below_threshold():
    # 16,100 wages - 8,600 = 7,500 = top of the 0% row
    assert federal_income_tax(D(16100), CFG) == 0


def test_social_security_capped_at_wage_base():
    r = estimate(Offer(annual_salary=D(200000)))
    assert r["annual"]["social_security"] == 11439.00          # 6.2% * 184,500
    assert any("Social Security tax stops" in n for n in r["notes"])


def test_nj_tdi_fli_capped():
    r = estimate(Offer(annual_salary=D(250000)))
    assert r["annual"]["nj_tdi"] == 325.09
    assert r["annual"]["nj_fli"] == 393.53


def test_nj_allowance_reduces_taxable_wages():
    # 1 allowance: 795 + 6.1% * (69,000 - 40,000) = 2,564
    assert nj_income_tax(D(70000), 1, CFG) == D("2564.000")


@pytest.mark.parametrize("salary", [30000, 55000, 70000, 120000, 400000])
def test_net_equals_gross_minus_deductions(salary):
    r = estimate(Offer(annual_salary=D(salary), k401_percent=D(5)))["annual"]
    deductions = sum(v for k, v in r.items() if k not in ("gross", "net"))
    assert r["net"] == pytest.approx(r["gross"] - deductions, abs=0.001)


def test_deterministic():
    o = Offer(annual_salary=D(83250), k401_percent=D(4))
    assert estimate(o) == estimate(o)
