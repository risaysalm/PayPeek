from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

LineItems = dict[str, float]


class OfferIn(BaseModel):
    annual_salary: Decimal = Field(gt=0, le=10_000_000, examples=[70000])
    k401_percent: Decimal = Field(default=Decimal(0), ge=0, le=100, examples=[6])
    nj_allowances: int = Field(default=1, ge=0, le=99)  # matches the frontend
    label: str | None = Field(default=None, examples=["Acme Corp"])
    # Fixed scope for the hackathon; present so the contract can grow later.
    tax_year: Literal[2026] = 2026
    filing_status: Literal["single"] = "single"
    pay_frequency: Literal["biweekly"] = "biweekly"


class EstimateOut(BaseModel):
    tax_year: int
    per_paycheck: LineItems
    annual: LineItems
    notes: list[str]


class CompareIn(BaseModel):
    offer_a: OfferIn
    offer_b: OfferIn


class CompareOut(BaseModel):
    offer_a: EstimateOut
    offer_b: EstimateOut
    difference_b_minus_a: dict[str, LineItems]   # {"per_paycheck": {...}, "annual": {...}}


class ExplainIn(BaseModel):
    estimate: EstimateOut     # engine output only; the AI never recomputes numbers


class ExplainOut(BaseModel):
    explanation: str
    source: Literal["template", "ai"]
