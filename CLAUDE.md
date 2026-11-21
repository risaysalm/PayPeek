# PayPeek

Hackathon project (MT-haCks, Fintech track). Web app showing new grads their
real take-home pay for a job offer: 2026 federal + New Jersey rules, Single
filer, biweekly pay.

## Team and folders
- backend/ and tests/: [partner's name] (Python, FastAPI)
- frontend/: Hamdaan (plain HTML, CSS, JavaScript; no frameworks, no build step)
- Only edit your own folders unless the person asks you to change the other.

## Rules
- The backend tax engine does all the math. The frontend never calculates
  taxes, it only displays what the API returns.
- Test case: $70,000, Single, biweekly, no 401(k), 1 NJ allowance should show about $2,116.41 take-home per paycheck.
- Accessibility matters (we're entering the Design prize): labeled inputs,
  readable contrast, keyboard-only use, plain language.
- Every result shows "Estimate only, not tax advice."
- Never put API keys in code or commit .env files.
- Keep changes small. Explain what you changed.

## Workflow
- Run `git pull --rebase` before starting work and before every push.

## Running locally
Backend (terminal 1), runs at http://localhost:8000:
```
cd backend
source ../.venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Frontend (terminal 2), open http://localhost:5500:
```
cd frontend
python3 -m http.server 5500
```

The frontend calls the backend at http://localhost:8000, so the backend must
allow CORS from http://localhost:5500.

