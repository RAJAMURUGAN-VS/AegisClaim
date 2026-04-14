import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError
import logging

from ..core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def get_textract_client() -> BaseClient:
    """Initializes and returns a boto3 client for AWS Textract."""
    try:
        return boto3.client(
            "textract",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    except ClientError as e:
        logger.error(f"Error creating Textract client: {e}")
        raise

def get_s3_client() -> BaseClient:
    """Initializes and returns a boto3 client for AWS S3."""
    try:
        return boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
    except ClientError as e:
        logger.error(f"Error creating S3 client: {e}")
        raise

def upload_to_s3(file_path: str, object_name: str = None) -> str:
    """
    Upload a file to an S3 bucket.

    :param file_path: File to upload
    :param object_name: S3 object name. If not specified, file_path is used
    :return: The S3 key of the uploaded object.
    """
    if object_name is None:
        object_name = file_path.split("/")[-1]

    s3_client = get_s3_client()
    try:
        s3_client.upload_file(file_path, settings.AWS_S3_BUCKET_NAME, object_name)
        logger.info(f"File '{file_path}' uploaded to S3 bucket '{settings.AWS_S3_BUCKET_NAME}' as '{object_name}'.")
        return object_name
    except ClientError as e:
        logger.error(f"Error uploading file to S3: {e}")
        raise
