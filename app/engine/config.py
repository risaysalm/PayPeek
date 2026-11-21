"""Loads per-year tax configuration. All numbers become Decimal."""
import json
from decimal import Decimal
from functools import lru_cache
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config" / "tax_years"


class UnsupportedTaxYear(ValueError):
    pass


def supported_years() -> list[int]:
    return sorted(int(p.stem) for p in CONFIG_DIR.glob("*.json"))


@lru_cache
def load_config(year: int) -> dict:
    path = CONFIG_DIR / f"{year}.json"
    if not path.exists():
        raise UnsupportedTaxYear(f"No tax config for {year}. Supported: {supported_years()}")
    # parse_float=Decimal keeps 0.0145 exact instead of a binary float
    return json.loads(path.read_text(), parse_float=Decimal, parse_int=Decimal)
