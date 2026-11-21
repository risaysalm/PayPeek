# PayPeek frontend

Plain HTML, CSS and JavaScript. No frameworks and no build step.

## What's here

| File | What it does |
| --- | --- |
| `index.html` + `app.js` | Single offer: take-home pay and every deduction, the **Try a change** sliders, and **Explain my paycheck** |
| `compare.html` + `compare.js` | Compare 2 to 10 offers. Two offers show side by side; 3 to 10 show a ranked table with a full breakdown for each |
| `common.js` | Shared helpers: `API_BASE`, API requests, deduction rows, and remembering values between pages |
| `style.css` | All styles for both pages |
| `assets/` | `logo.png` (original), `logo-header.png` (header), `icon.png` (favicon) |
| `mock-estimate.json` | Sample API response, used only if you set `USE_MOCK = true` in `app.js` |

## Run it locally

Start the backend first (see [backend/README.md](../backend/README.md)), then:

```
cd frontend
python3 -m http.server 5500
```

Open http://localhost:5500.

`API_BASE` in `common.js` picks the backend from the page's address:

- opened from `localhost` or `127.0.0.1`: `http://localhost:8000`
- anywhere else (like the Netlify site): `https://paypeek-api.onrender.com`

## The frontend never calculates taxes

Every number comes from the backend (`/estimate`, `/compare`, `/explain`). The page only displays those results. When it compares offers, it subtracts the API's take-home numbers; it never recalculates them.

## Design and accessibility

- **Palette from the logo:** navy `#01142C` for text and headings, with teal as the accent.
- **Contrast:** the logo's teal `#01957C` is only 3.8:1 on white, which fails WCAG AA for text. Text and buttons use a darker teal, `#00715E` (6.0:1). The logo teal is used only for borders. Each color's contrast ratio is noted in `style.css`.
- **Labeled inputs:** every input has a visible label, including each offer on the compare page ("Offer C annual salary ($)").
- **Keyboard:** everything works without a mouse, with a visible focus ring. Sliders move with the arrow keys, and each slider has a number box for typing an exact value. Adding or removing an offer moves focus to a sensible place.
- **Screen readers:**
  - Results, the Try a change sentence, and the compare summary are announced through status regions, and errors are announced as alerts.
  - Tables have column headers.
  - The Remove buttons read as "Remove Offer C".
- **390px phones:** the pages fit a 390px screen with no sideways scrolling. On narrow screens the ranked compare table turns into one card per offer.
- **Plain language:** every result shows "Estimate only, not tax advice."

## Privacy

Values you enter are kept only in your browser tab (`sessionStorage`) so they carry over between the two pages. They're cleared when you close the tab. Nothing is saved on a server.

## Usability testing

What we learned from testing with a new user, and what we changed: [docs/usability-test.md](../docs/usability-test.md).
