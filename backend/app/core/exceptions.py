"""Custom exceptions for API error handling."""


class CIPError(Exception):
    """Base exception for CIP API."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(CIPError):
    def __init__(self, message: str = "Resource not found", details: dict | None = None) -> None:
        super().__init__("NOT_FOUND", message, 404, details)


class AuthenticationError(CIPError):
    def __init__(self, message: str = "Invalid credentials", details: dict | None = None) -> None:
        super().__init__("AUTHENTICATION_ERROR", message, 401, details)


class AuthorizationError(CIPError):
    def __init__(self, message: str = "Insufficient permissions", details: dict | None = None) -> None:
        super().__init__("AUTHORIZATION_ERROR", message, 403, details)


class ValidationError(CIPError):
    def __init__(self, message: str = "Validation error", details: dict | None = None) -> None:
        super().__init__("VALIDATION_ERROR", message, 422, details)


class FeatureDisabledError(CIPError):
    def __init__(self, message: str = "Feature not enabled", details: dict | None = None) -> None:
        super().__init__("FEATURE_DISABLED", message, 403, details)
