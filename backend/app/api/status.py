from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_at_least_one_role
from app.db.session import check_database
from app.storage.s3 import check_storage

router = APIRouter()


@router.get("/status")
def get_status(_current: CurrentUser = Depends(require_at_least_one_role)) -> dict[str, str]:
    return {
        "service": "ok",
        "database": check_database(),
        "storage": check_storage(),
    }
