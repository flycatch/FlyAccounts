from fastapi import APIRouter

from app.db.session import check_database
from app.storage.s3 import check_storage

router = APIRouter()


@router.get("/status")
def get_status() -> dict[str, str]:
    return {
        "service": "ok",
        "database": check_database(),
        "storage": check_storage(),
    }
