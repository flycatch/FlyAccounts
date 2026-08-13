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
