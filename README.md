<p align="center">
  <img src="frontend/assets/logo-header.png" alt="PayPeek: See your real take-home pay" width="360">
</p>

# PayPeek

**See your real take-home pay.**

- **Live demo:** https://thepaypeek.netlify.app/
- **Backend API:** https://paypeek-api.onrender.com (interactive docs at `/docs`)

> The backend runs on a free Render plan. The first load may take up to a minute while it wakes up.

## The problem

A salary isn't what lands in your account. A $70,000 offer doesn't pay $2,692 every two weeks. After federal and New Jersey taxes, it's about $2,116. Offer letters show the big number, so it's hard to know what you'll actually have to live on, or which of two offers really pays more.

**Who it's for:** anyone with a salaried job offer in New Jersey. We built it with new grads in mind.

## Features

- **Single offer breakdown:** enter a salary and 401(k) percentage to see take-home pay per paycheck and per year, with every tax and deduction listed.
- **Compare offers:** compare two offers side by side, or add up to 10 to see them ranked by take-home pay, each with a full breakdown.
- **Try a change:** drag a slider or type a number to see how a different salary or 401(k) contribution would change your paycheck, without retyping your offer.
- **Explain my paycheck:** a plain-English summary of where your paycheck goes.

## How it works

- **Backend (Python, FastAPI):** a deterministic tax engine with tests (`backend/tests/`). Every rate, bracket and wage base lives in [`backend/config/tax_years/2026.json`](backend/config/tax_years/2026.json) with its source:

  | Item | Source |
  | --- | --- |
  | Federal income tax withholding | IRS Publication 15-T (2026) |
  | Social Security and Medicare | SSA 2026 wage base and rates |
  | 401(k) limit | IRS Notice 2025-67 |
  | NJ income tax withholding | NJ-WT, Rate A |
  | NJ UI/WF/SWF, TDI and FLI | NJ Department of Labor 2026 rates |

- **Frontend (plain HTML, CSS and JavaScript):** only displays what the API returns. It never calculates taxes.
- **Explanations:** written only from the engine's results, using a fixed template. They never recalculate taxes.

More detail: [backend/README.md](backend/README.md) and [frontend/README.md](frontend/README.md).

## Scope and limits

- 2026 rules, federal plus New Jersey
- Single filers, paid every two weeks
- Assumes 1 New Jersey allowance on your NJ-W4
- 401(k) contributions are capped at the 2026 limit of $24,500; the app tells you when that happens
- Health insurance and other payroll deductions aren't included, so a real paystub may show less
- Estimates only, not tax advice

## Privacy

Nothing is stored on a server. The backend has no database: it calculates an estimate and sends it back. The values you enter are kept only in your browser tab (`sessionStorage`) and are cleared when you close the tab.

## Run it locally

You need Python 3. The commands below use a virtual environment at `.venv` in the project root (create it once with `python3 -m venv .venv`).

**Backend** (terminal 1), runs at http://localhost:8000:

```
cd backend
source ../.venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

**Frontend** (terminal 2), then open http://localhost:5500:

```
cd frontend
python3 -m http.server 5500
```

When the page is opened from `localhost` or `127.0.0.1`, it calls the local backend. Anywhere else, it calls the deployed API.

**Tests** (from `backend/`, with the virtual environment active):

```
python -m pytest -q
```

**On Windows (PowerShell):** Windows blocks `Activate.ps1` by default, so skip activation and call the virtual environment's Python directly. Create it once from the project root with `python -m venv .venv`, then from `backend/`:

```powershell
..\.venv\Scripts\python -m pip install -r requirements.txt
..\.venv\Scripts\python -m uvicorn app.main:app --reload
..\.venv\Scripts\python -m pytest -q
```

For the frontend, use `python -m http.server 5500` instead of `python3`.

## Team

- **Hamdaan Malik** ([@hmalik0](https://github.com/hmalik0)): frontend and design
- **Risay Shebeer Salam** ([@risaysalm](https://github.com/risaysalm)): backend and tax engine

We used Claude Code to help build PayPeek.

## What's next

### Make offers more complete

- **Employer 401(k) match:** show the "free money" an offer includes, since two offers with the same salary can differ by thousands per year.
- **Health insurance and other pre-tax benefits:** subtract real premiums so take-home matches an actual pay stub.

### Cover more people

- **Weekly, semimonthly, and monthly pay** (today: every two weeks only).
- **Married and head-of-household filers** (today: single only).
- **More states**, starting with New York and Pennsylvania, so offers across state lines can be compared.
- **Yearly tax updates** (2027 and beyond): every rate already lives in `backend/config/tax_years/`, so a new year is mostly a new config file plus tests.

### Help people decide

- **Pay stub check:** compare your first real pay stub with the estimate.
- **AI-written explanations:** "Explain my paycheck" uses a fixed template today; an AI version would be checked so every dollar figure matches the engine.

## Usability testing

We tested PayPeek with a new user during MT-haCks and made changes based on what we saw. See [docs/usability-test.md](docs/usability-test.md).
