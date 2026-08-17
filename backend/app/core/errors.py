from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

ERROR_INVALID_TOKEN = "invalid_token"
ERROR_PERSONAL_ACCOUNT = "personal_account"
ERROR_UNKNOWN_TENANT = "unknown_tenant"
ERROR_UNAUTHORIZED = "unauthorized"
ERROR_FORBIDDEN = "forbidden"
ERROR_PENDING_ACCESS = "pending_access"
ERROR_NOT_FOUND = "not_found"
ERROR_DUPLICATE_ASSIGNMENT = "duplicate_assignment"
ERROR_LAST_ADMIN_REQUIRED = "last_admin_required"
ERROR_DUPLICATE_INVITE = "duplicate_invite"
ERROR_ALREADY_PRESENT = "already_present"
ERROR_DUPLICATE_ROLE_NAME = "duplicate_role_name"
ERROR_DUPLICATE_PERMISSION = "duplicate_permission"
ERROR_ROLE_STILL_ASSIGNED = "role_still_assigned"


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def invalid_token(message: str = "Microsoft sign-in could not be verified.") -> ApiError:
    return ApiError(401, ERROR_INVALID_TOKEN, message)


def personal_account(message: str = "Personal Microsoft accounts are not accepted.") -> ApiError:
    return ApiError(401, ERROR_PERSONAL_ACCOUNT, message)


def unknown_tenant(message: str = "This Microsoft directory is not accepted.") -> ApiError:
    return ApiError(401, ERROR_UNKNOWN_TENANT, message)


def unauthorized(message: str = "Sign in is required.") -> ApiError:
    return ApiError(401, ERROR_UNAUTHORIZED, message)


def forbidden(message: str = "You are not allowed to do that.") -> ApiError:
    return ApiError(403, ERROR_FORBIDDEN, message)


def pending_access(message: str = "A recognized role is required.") -> ApiError:
    return ApiError(403, ERROR_PENDING_ACCESS, message)


def not_found(message: str = "The requested resource was not found.") -> ApiError:
    return ApiError(404, ERROR_NOT_FOUND, message)


def duplicate_assignment(message: str = "That role is already assigned.") -> ApiError:
    return ApiError(409, ERROR_DUPLICATE_ASSIGNMENT, message)


def last_admin_required(
    message: str = "At least one person with manage users must remain.",
) -> ApiError:
    return ApiError(409, ERROR_LAST_ADMIN_REQUIRED, message)


def duplicate_invite(message: str = "That email already has an active invite.") -> ApiError:
    return ApiError(409, ERROR_DUPLICATE_INVITE, message)


def already_present(message: str = "That email already belongs to a listed person.") -> ApiError:
    return ApiError(409, ERROR_ALREADY_PRESENT, message)


def duplicate_role_name(message: str = "A role with that name already exists.") -> ApiError:
    return ApiError(409, ERROR_DUPLICATE_ROLE_NAME, message)


def duplicate_permission(message: str = "That permission is already attached to the role.") -> ApiError:
    return ApiError(409, ERROR_DUPLICATE_PERMISSION, message)


def role_still_assigned(message: str = "That role is still assigned to a person.") -> ApiError:
    return ApiError(409, ERROR_ROLE_STILL_ASSIGNED, message)


async def api_error_handler(_request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message})
