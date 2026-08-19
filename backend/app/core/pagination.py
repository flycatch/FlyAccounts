from __future__ import annotations

from typing import TypeVar

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

ALLOWED_PAGE_SIZES = {10, 25, 50}
DEFAULT_PAGE_SIZE = 10


def parse_list_params(
    search: str | None = None,
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> tuple[str | None, int, int]:
    term = search.strip() if search and search.strip() else None
    if page < 1:
        page = 1
    if page_size not in ALLOWED_PAGE_SIZES:
        page_size = DEFAULT_PAGE_SIZE
    return term, page, page_size


def paginate(
    db: Session,
    query: Select[tuple[T]],
    *,
    page: int,
    page_size: int,
) -> tuple[list[T], int]:
    count_query = select(func.count()).select_from(query.order_by(None).subquery())
    total = int(db.scalar(count_query) or 0)
    offset = (page - 1) * page_size
    rows = list(db.scalars(query.offset(offset).limit(page_size)).all())
    return rows, total


def list_query_deps(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, alias="pageSize"),
) -> tuple[str | None, int, int]:
    return parse_list_params(search, page, page_size)
