import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.mock import MOCK_ESTIMATE  # noqa: E402

client = TestClient(app)
KEYS = {"gross", "federal_income_tax", "social_security", "medicare", "nj_income_tax",
        "nj_ui_wf", "nj_tdi", "nj_fli", "pre_tax_401k", "net"}


def test_mock_estimate_shape():
    r = client.post("/estimate?mock=true", json={"annual_salary": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["tax_year"] == 2026
    assert set(body["per_paycheck"]) == set(body["annual"]) == KEYS


def test_mock_matches_engine_for_test_case_1():
    real = client.post("/estimate", json={"annual_salary": 70000}).json()
    assert real["per_paycheck"] == MOCK_ESTIMATE["per_paycheck"]
    assert real["annual"] == MOCK_ESTIMATE["annual"]


def test_estimate_rejects_bad_input():
    assert client.post("/estimate", json={"annual_salary": -5}).status_code == 422
    assert client.post("/estimate", json={"annual_salary": 70000, "tax_year": 2025}).status_code == 422


def test_compare_difference():
    r = client.post("/compare", json={"offer_a": {"annual_salary": 70000},
                                      "offer_b": {"annual_salary": 70000, "k401_percent": 6}}).json()
    assert r["difference_b_minus_a"]["annual"]["federal_income_tax"] == -854.0   # 5,716 - 6,570


def test_explain_uses_engine_numbers():
    est = client.post("/estimate", json={"annual_salary": 70000}).json()
    text = client.post("/explain", json={"estimate": est}).json()["explanation"]
    assert "$2,116.41" in text
