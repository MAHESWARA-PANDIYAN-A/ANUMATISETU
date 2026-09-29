import abc
from typing import Any, Dict, List, Optional, Union
from io import BytesIO


class StorageProvider(abc.ABC):
    """
    Abstract Base Interface for Cloud Document Storage Providers (Cloudinary, future S3/Azure, etc.).
    Keeps TASKER decoupled from any specific cloud storage vendor.
    """

    @abc.abstractmethod
    def upload_document(
        self,
        file_content: Union[bytes, BytesIO],
        filename: str,
        document_type: str,
        business_id: Union[str, int],
        document_id: Optional[Union[str, int]] = None,
        version: int = 1,
        mime_type: Optional[str] = None,
        access_type: Optional[str] = None,
        extra_tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Uploads document file data to cloud storage under secure/authenticated delivery.
        Returns standardized asset metadata dictionary.
        """
        pass

    @abc.abstractmethod
    def delete_document(
        self,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
    ) -> Dict[str, Any]:
        """
        Permanently deletes an asset from cloud storage.
        """
        pass

    @abc.abstractmethod
    def archive_document(
        self,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
    ) -> Dict[str, Any]:
        """
        Marks an asset as archived in storage without immediate physical destruction.
        """
        pass

    @abc.abstractmethod
    def generate_secure_access_url(
        self,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
        expires_in_seconds: int = 900,
        format_override: Optional[str] = None,
    ) -> str:
        """
        Generates a signed, time-limited URL for secure previewing/viewing.
        """
        pass

    @abc.abstractmethod
    def generate_private_download_url(
        self,
        public_id: str,
        filename: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
        expires_in_seconds: int = 900,
    ) -> str:
        """
        Generates a signed, time-limited URL with attachment Content-Disposition for download.
        """
        pass

    @abc.abstractmethod
    def get_asset_metadata(
        self,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
    ) -> Dict[str, Any]:
        """
        Retrieves remote asset properties and verification status.
        """
        pass

    @abc.abstractmethod
    def check_asset_exists(
        self,
        public_id: str,
        resource_type: str = "image",
        access_type: str = "authenticated",
    ) -> bool:
        """
        Checks whether the asset exists in cloud storage.
        """
        pass

    @abc.abstractmethod
    def replace_document_version(
        self,
        old_public_id: str,
        file_content: Union[bytes, BytesIO],
        filename: str,
        document_type: str,
        business_id: Union[str, int],
        new_version: int,
        mime_type: Optional[str] = None,
        access_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Uploads a new version for an existing document without destroying historical versions.
        """
        pass

    @abc.abstractmethod
    def check_connectivity(self) -> Dict[str, Any]:
        """
        Checks connectivity/configuration to storage service.
        """
        pass
