"""Hardcoded /estimate response so the frontend can build against the real shape today.
Values are test case 1 ($70k, single, biweekly, no 401k). Serve it with ?mock=true or PAYPEEK_MOCK=1.
"""
MOCK_ESTIMATE = {
    "tax_year": 2026,
    "per_paycheck": {
        "gross": 2692.31, "federal_income_tax": 252.69, "social_security": 166.92,
        "medicare": 39.04, "nj_income_tax": 100.96, "nj_ui_wf": 7.32, "nj_tdi": 5.12,
        "nj_fli": 6.19, "pre_tax_401k": 0.0, "net": 2114.06,
    },
    "annual": {
        "gross": 70000.0, "federal_income_tax": 6570.0, "social_security": 4340.0,
        "medicare": 1015.0, "nj_income_tax": 2625.0, "nj_ui_wf": 190.4, "nj_tdi": 133.0,
        "nj_fli": 161.0, "pre_tax_401k": 0.0, "net": 54965.6,
    },
    "notes": [
        "MOCK DATA - not calculated from your input.",
        "NJ UI/WF/SWF stops once year-to-date wages reach $44,800 (around paycheck 17 of 26); "
        "per-paycheck figure is the yearly average.",
    ],
}
