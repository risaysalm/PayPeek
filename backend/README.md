# PayPeek backend

FastAPI service that estimates take-home pay for a New Jersey job offer (2026, Single, biweekly).
The tax engine (`app/engine/`) is plain deterministic Python. AI is only allowed in `app/explain.py`,
and it only gets engine output to describe.

```
app/
  main.py          routes: /estimate, /compare, /explain, /health
  schemas.py       request/response models (the frontend contract)
  mock.py          hardcoded /estimate response
  explain.py       plain-English text from engine results (template now, LLM later)
  engine/
    config.py      loads config/tax_years/<year>.json as Decimal
    calculator.py  federal (Pub 15-T), FICA, NJ income tax (NJ-WT Rate A), NJ UI/WF/TDI/FLI
config/tax_years/2026.json   every rate, bracket and wage base, with source links
tests/
  test_engine_2026.py   hand-checked cases (runs with just pytest)
  test_api.py           endpoint tests (skipped unless fastapi + httpx are installed)
```

## Run
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload          # http://localhost:8000/docs
PAYPEEK_MOCK=1 uvicorn app.main:app    # every /estimate returns the mock
pytest -q
```

Windows PowerShell, from `backend/` (no activation needed):
```powershell
..\.venv\Scripts\python -m pip install -r requirements.txt
..\.venv\Scripts\python -m uvicorn app.main:app --reload
$env:PAYPEEK_MOCK = "1"; ..\.venv\Scripts\python -m uvicorn app.main:app   # mock mode
..\.venv\Scripts\python -m pytest -q
```
Mock mode stays on in that window until you run `Remove-Item Env:PAYPEEK_MOCK`.

## Mock for the frontend
`POST /estimate?mock=true` with any body like `{"annual_salary": 70000}` returns `app/mock.py`.
Its numbers are test case 1, and `test_api.py` checks that they still match the real engine.

## Request
```json
{ "annual_salary": 70000, "k401_percent": 6, "nj_allowances": 1, "label": "Acme" }
```
`/compare` takes `{"offer_a": {...}, "offer_b": {...}}`. `/explain` takes `{"estimate": <an /estimate response>}`.

## Modeling decisions
- Calculations run on annual amounts. `per_paycheck` is annual / 26, rounded to cents.
- Capped items (NJ UI/WF/SWF at $44,800, SS at $184,500) are shown as a yearly average per paycheck.
  A note tells the user when the deduction actually stops.
- A pre-tax 401(k) lowers federal and NJ income tax but not FICA or NJ UI/TDI/FLI.
- NJ defaults to Rate A with 1 allowance (the API default, matching the frontend). Pass `nj_allowances: 0` for the no-NJ-W4 case.
- Out of scope: Step 2/3/4 W-4 entries, other states and cities, bonuses, benefits premiums.
