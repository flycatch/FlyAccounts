from __future__ import annotations

import uuid

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings


def _client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def ensure_bucket() -> None:
    settings = get_settings()
    client = _client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket)


def check_storage() -> str:
    settings = get_settings()
    try:
        _client().head_bucket(Bucket=settings.s3_bucket)
        return "ok"
    except Exception:
        return "unavailable"


def upload_bytes(*, data: bytes, content_type: str, filename: str, prefix: str = "contracts") -> str:
    settings = get_settings()
    ensure_bucket()
    safe_name = filename.replace("/", "_").replace("\\", "_")
    key = f"{prefix}/{uuid.uuid4()}/{safe_name}"
    _client().put_object(
        Bucket=settings.s3_bucket,
        Key=key,
        Body=data,
        ContentType=content_type or "application/octet-stream",
    )
    return key
