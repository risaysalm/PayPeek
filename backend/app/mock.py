"""Hardcoded /estimate response so the frontend can build against the real shape today.
Values are test case 1 ($70k, single, biweekly, no 401k, 1 NJ allowance). Serve it with ?mock=true or PAYPEEK_MOCK=1.
"""
MOCK_ESTIMATE = {
    "tax_year": 2026,
    "per_paycheck": {
        "gross": 2692.31, "federal_income_tax": 252.69, "social_security": 166.92,
        "medicare": 39.04, "nj_income_tax": 98.62, "nj_ui_wf": 7.32, "nj_tdi": 5.12,
        "nj_fli": 6.19, "pre_tax_401k": 0.0, "net": 2116.41,
    },
    "annual": {
        "gross": 70000.0, "federal_income_tax": 6570.0, "social_security": 4340.0,
        "medicare": 1015.0, "nj_income_tax": 2564.0, "nj_ui_wf": 190.4, "nj_tdi": 133.0,
        "nj_fli": 161.0, "pre_tax_401k": 0.0, "net": 55026.6,
    },
    "notes": [
        "MOCK DATA - not calculated from your input.",
        "One NJ deduction (unemployment and workforce) stops after you've earned $44,800 this year, "
        "around paycheck 17. We show the yearly average per paycheck.",
    ],
}
