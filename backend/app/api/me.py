from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, get_current_user
from app.core.me import build_me_response

router = APIRouter()


@router.get("/me")
def get_me(current: CurrentUser = Depends(get_current_user)) -> dict:
    return build_me_response(current.user, current.roles, current.permissions)
