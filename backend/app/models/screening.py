"""Screening models: watchlist, results, dispositions, ingestion health."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class WatchlistSource(str, enum.Enum):
    un = "un"
    ofac = "ofac"
    eu = "eu"
    nacta = "nacta"
    pep = "pep"
    opensanctions = "opensanctions"


class EntityType(str, enum.Enum):
    individual = "individual"
    entity = "entity"
    vessel = "vessel"
    aircraft = "aircraft"


class ScreeningType(str, enum.Enum):
    realtime = "realtime"
    batch = "batch"
    ongoing_monitoring = "ongoing_monitoring"


class OverallStatus(str, enum.Enum):
    clear = "clear"
    potential_match = "potential_match"
    confirmed_match = "confirmed_match"


class DispositionStatus(str, enum.Enum):
    pending = "pending"
    true_positive = "true_positive"
    false_positive = "false_positive"
    escalated = "escalated"


class WatchlistEntry(Base):
    __tablename__ = "watchlist_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source: Mapped[WatchlistSource] = mapped_column(Enum(WatchlistSource), nullable=False, index=True)
    entity_type: Mapped[EntityType] = mapped_column(Enum(EntityType), nullable=False, default=EntityType.individual)
    primary_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    aliases: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    dob: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    id_numbers: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    list_specific_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    crypto_addresses: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    source_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScreeningResult(Base):
    __tablename__ = "screening_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    screened_entity_name: Mapped[str] = mapped_column(String(500), nullable=False)
    screened_entity_dob: Mapped[str | None] = mapped_column(String(50), nullable=True)
    screened_entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    screening_type: Mapped[ScreeningType] = mapped_column(Enum(ScreeningType), nullable=False)
    matches: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    overall_status: Mapped[OverallStatus] = mapped_column(Enum(OverallStatus), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    disposition: Mapped["MatchDisposition | None"] = relationship(
        "MatchDisposition",
        back_populates="screening_result",
        uselist=False,
        lazy="selectin",
    )


class MatchDisposition(Base):
    __tablename__ = "match_dispositions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    screening_result_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("screening_results.id"), nullable=False, unique=True, index=True
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    disposition: Mapped[DispositionStatus] = mapped_column(Enum(DispositionStatus), nullable=False)
    decided_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    screening_result: Mapped["ScreeningResult"] = relationship(
        "ScreeningResult",
        back_populates="disposition",
        lazy="selectin",
    )


class IngestionSource(str, enum.Enum):
    un = "un"
    ofac = "ofac"
    eu = "eu"
    nacta = "nacta"
    pep = "pep"


class IngestionHealth(Base):
    __tablename__ = "ingestion_health"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    source: Mapped[IngestionSource] = mapped_column(Enum(IngestionSource), nullable=False, unique=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    records_count: Mapped[int] = mapped_column(default=0, nullable=False)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class BatchJobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    complete = "complete"
    failed = "failed"


class BatchJob(Base):
    __tablename__ = "batch_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    status: Mapped[BatchJobStatus] = mapped_column(
        Enum(BatchJobStatus), nullable=False, default=BatchJobStatus.queued, index=True
    )
    records_count: Mapped[int] = mapped_column(default=0, nullable=False)
    processed_count: Mapped[int] = mapped_column(default=0, nullable=False)
    result_file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
