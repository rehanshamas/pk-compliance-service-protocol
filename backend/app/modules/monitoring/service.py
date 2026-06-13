"""Monitoring rules service: CRUD. Phase 6.6."""

from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.monitoring_rule import (
    MonitoringRule,
    MonitoringRuleSeverity,
    MonitoringRuleType,
)


class MonitoringRulesService:
    async def list_rules(
        self,
        db: AsyncSession,
        tenant_id: UUID | None,
        limit: int = 50,
        offset: int = 0,
        include_platform_defaults: bool = True,
    ) -> tuple[list[MonitoringRule], int]:
        """List rules. tenant_id=None => platform admin lists only platform rules."""
        if tenant_id is None:
            filt = MonitoringRule.tenant_id.is_(None)
        else:
            if include_platform_defaults:
                filt = or_(
                    MonitoringRule.tenant_id == tenant_id,
                    MonitoringRule.tenant_id.is_(None),
                )
            else:
                filt = MonitoringRule.tenant_id == tenant_id

        count_stmt = select(func.count()).select_from(MonitoringRule).where(filt)
        total = (await db.scalar(count_stmt)) or 0
        base = select(MonitoringRule).where(filt)
        q = (
            base.order_by(MonitoringRule.updated_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await db.execute(q)
        return list(result.scalars().unique().scalars().all()), total

    async def get_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        tenant_id: UUID | None,
        allow_platform_admin: bool = False,
    ) -> MonitoringRule:
        if tenant_id is None and allow_platform_admin:
            r = await db.execute(select(MonitoringRule).where(MonitoringRule.id == rule_id))
        else:
            r = await db.execute(
                select(MonitoringRule).where(
                    MonitoringRule.id == rule_id,
                    or_(
                        MonitoringRule.tenant_id == tenant_id,
                        MonitoringRule.tenant_id.is_(None),
                    ),
                )
            )
        rule = r.scalar_one_or_none()
        if not rule:
            raise NotFoundError("Monitoring rule not found")
        return rule

    async def create_rule(
        self,
        db: AsyncSession,
        tenant_id: UUID | None,
        name: str,
        description: str | None,
        rule_type: str,
        conditions: dict,
        severity: str,
        enabled: bool,
    ) -> MonitoringRule:
        rule = MonitoringRule(
            tenant_id=tenant_id,
            name=name,
            description=description,
            rule_type=MonitoringRuleType(rule_type),
            conditions=conditions or {},
            severity=MonitoringRuleSeverity(severity),
            enabled=enabled,
        )
        db.add(rule)
        await db.flush()
        return rule

    async def patch_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        tenant_id: UUID | None,
        allow_platform_admin: bool = False,
        name: str | None = None,
        description: str | None = None,
        rule_type: str | None = None,
        conditions: dict | None = None,
        severity: str | None = None,
        enabled: bool | None = None,
    ) -> MonitoringRule:
        rule = await self.get_rule(db, rule_id, tenant_id, allow_platform_admin)
        if rule.tenant_id is None:
            raise NotFoundError("Platform default rules cannot be edited")
        if name is not None:
            rule.name = name
        if description is not None:
            rule.description = description
        if rule_type is not None:
            rule.rule_type = MonitoringRuleType(rule_type)
        if conditions is not None:
            rule.conditions = conditions
        if severity is not None:
            rule.severity = MonitoringRuleSeverity(severity)
        if enabled is not None:
            rule.enabled = enabled
        await db.flush()
        return rule

    async def delete_rule(
        self,
        db: AsyncSession,
        rule_id: UUID,
        tenant_id: UUID | None,
        allow_platform_admin: bool = False,
    ) -> None:
        rule = await self.get_rule(db, rule_id, tenant_id, allow_platform_admin)
        if rule.tenant_id is None:
            raise NotFoundError("Platform default rules cannot be deleted")
        await db.delete(rule)


monitoring_service = MonitoringRulesService()
