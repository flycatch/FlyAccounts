from __future__ import annotations

from typing import TypeVar

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

T = TypeVar("T")

ALLOWED_PAGE_SIZES = {10, 25, 50}
DEFAULT_PAGE_SIZE = 10

RESOURCE_SORT_COLUMNS = {
    "resourceType",
    "name",
    "monthlyAllocationPercent",
    "contract",
    "month",
}
DEFAULT_SORT_BY = "name"
DEFAULT_SORT_ORDER = "asc"


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


def parse_sort_params(
    sort_by: str | None = None,
    sort_order: str | None = None,
    *,
    allowed: set[str],
    default_by: str = DEFAULT_SORT_BY,
) -> tuple[str, str]:
    column = sort_by if sort_by in allowed else default_by
    order = sort_order if sort_order in {"asc", "desc"} else DEFAULT_SORT_ORDER
    return column, order


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


def sortable_list_query_deps(
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, alias="pageSize"),
    sort_by: str | None = Query(default=DEFAULT_SORT_BY, alias="sortBy"),
    sort_order: str | None = Query(default=DEFAULT_SORT_ORDER, alias="sortOrder"),
) -> tuple[str | None, int, int, str, str]:
    term, page, page_size = parse_list_params(search, page, page_size)
    column, order = parse_sort_params(
        sort_by,
        sort_order,
        allowed=RESOURCE_SORT_COLUMNS,
        default_by=DEFAULT_SORT_BY,
    )
    return term, page, page_size, column, order
