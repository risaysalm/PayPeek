import os

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .engine import Offer, estimate
from .explain import explain
from .mock import MOCK_ESTIMATE
from .schemas import CompareIn, CompareOut, EstimateOut, ExplainIn, ExplainOut, OfferIn

app = FastAPI(title="PayPeek API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ENV_MOCK = os.getenv("PAYPEEK_MOCK") == "1"


def _run(o: OfferIn) -> dict:
    return estimate(Offer(annual_salary=o.annual_salary, k401_percent=o.k401_percent,
                          nj_allowances=o.nj_allowances, tax_year=o.tax_year))


@app.get("/health")
def health():
    return {"ok": True, "mock": ENV_MOCK}


@app.post("/estimate", response_model=EstimateOut)
def post_estimate(offer: OfferIn, mock: bool = Query(False)):
    if mock or ENV_MOCK:
        return MOCK_ESTIMATE
    return _run(offer)


@app.post("/compare", response_model=CompareOut)
def post_compare(body: CompareIn):
    a, b = _run(body.offer_a), _run(body.offer_b)
    diff = {section: {k: round(b[section][k] - a[section][k], 2) for k in a[section]}
            for section in ("per_paycheck", "annual")}
    return {"offer_a": a, "offer_b": b, "difference_b_minus_a": diff}


@app.post("/explain", response_model=ExplainOut)
def post_explain(body: ExplainIn):
    return {"explanation": explain(body.estimate.model_dump()), "source": "template"}

from fastapi.responses import RedirectResponse

@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse("/docs")