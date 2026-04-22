import logging
from typing import Any
from uuid import UUID

from app.models.user import User
from app.services.exceptions import ForbiddenError

logger = logging.getLogger(__name__)


def log_rbac_mutation_violation(
    current_user: User,
    resource: str,
    *,
    action: str | None = None,
    tenant_type: str | None = None,
) -> None:
    logger.warning(
        "[RBAC] denied user=%s role=%s resource=%s action=%s tenant_type=%s",
        current_user.id,
        current_user.role,
        resource,
        action if action is not None else "-",
        tenant_type if tenant_type is not None else "-",
    )


def enforce_tenant_match(
    resource_tenant_id: UUID | None,
    tenant_id: UUID | None,
    current_user: User,
    resource: str,
) -> None:
    if tenant_id is None:
        return
    if resource_tenant_id != tenant_id:
        log_rbac_mutation_violation(current_user, resource)
        raise ForbiddenError("Resource is not in your tenant")


def assert_authorized(
    action: str,
    resource: str,
    current_user: User,
    tenant_id: UUID | None,
    *,
    resource_tenant_id: UUID | None,
) -> None:
    """Tenant isolation guard for mutations when the request carries a tenant scope."""
    enforce_tenant_match(resource_tenant_id, tenant_id, current_user, resource)


def log_audit_mutation(
    action: str,
    current_user: User,
    resource: str,
    resource_id: Any,
    tenant_id: UUID | None,
) -> None:
    logger.info(
        "[AUDIT] action=%s user=%s role=%s resource=%s id=%s tenant=%s",
        action,
        current_user.id,
        current_user.role,
        resource,
        resource_id,
        tenant_id,
    )
