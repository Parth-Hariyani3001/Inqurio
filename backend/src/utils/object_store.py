import boto3

from src.config.main import Config
from fastapi import UploadFile, File

r2 = boto3.client(
    "s3",
    endpoint_url=f"https://{Config.r2_account_id}.r2.cloudflarestorage.com",
    aws_access_key_id=Config.r2_access_key,
    aws_secret_access_key=Config.r2_secret_access_key,
    region_name='auto'
)

bucket_name = Config.r2_bucket


def upload_file(file: UploadFile = File(...)):
    if file.content_type != 'application/pdf':
        raise ValueError("Only PDF files are allowed.")

    object_key = f'pdfs/{file.filename}'

    r2.upload_fileobj(
        file.file,
        bucket_name,
        object_key,
        ExtraArgs={
            'ContentType': 'application/pdf'
        }
    )

    return {
        "message": "PDF Uploaded successfully",
        "key": object_key
    }


def upload_pdf_bytes(contents: bytes, object_key: str) -> str:
    r2.put_object(
        Bucket=bucket_name,
        Key=object_key,
        Body=contents,
        ContentType="application/pdf",
    )
    return object_key


PRESIGNED_URL_EXPIRES_IN = 3600


def get_pdf_url(object_key: str) -> dict[str, str | int]:
    url = r2.generate_presigned_url(
        "get_object",
        Params={
            "Bucket": bucket_name,
            "Key": object_key,
            "ResponseContentDisposition": "inline",
        },
        ExpiresIn=PRESIGNED_URL_EXPIRES_IN,
    )

    return {
        "url": url,
        "expires_in": PRESIGNED_URL_EXPIRES_IN,
    }
