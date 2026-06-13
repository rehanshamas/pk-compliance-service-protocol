"""Celery tasks: sanctions/PEP list ingestors."""

import csv
import io
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import httpx
from celery import shared_task
from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from app.models.screening import (
    EntityType,
    IngestionHealth,
    IngestionSource,
    WatchlistEntry,
    WatchlistSource,
)
from app.workers.db_sync import get_sync_session

UN_CONSOLIDATED_URL = "https://scsanctions.un.org/resources/xml/en/consolidated.xml"
OFAC_SDN_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"
OFAC_ALT_URL = "https://www.treasury.gov/ofac/downloads/alt.csv"
OFAC_ADD_URL = "https://www.treasury.gov/ofac/downloads/add.csv"
# OpenSanctions targets.simple.csv (latest redirects to dated path)
OPENSANCTIONS_EU_URL = "https://data.opensanctions.org/datasets/latest/eu_fsf/targets.simple.csv"
OPENSANCTIONS_NACTA_URL = "https://data.opensanctions.org/datasets/latest/pk_proscribed_persons/targets.simple.csv"
OPENSANCTIONS_PEP_URL = "https://data.opensanctions.org/datasets/latest/peps/targets.simple.csv"


def _update_ingestion_health(
    db: Session,
    source: IngestionSource,
    records_count: int,
    last_error: str | None,
    status: str,
) -> None:
    """Update ingestion_health for a source."""
    stmt = (
        update(IngestionHealth)
        .where(IngestionHealth.source == source)
        .values(
            last_run_at=datetime.now(timezone.utc),
            records_count=records_count,
            last_error=last_error,
            status=status,
            updated_at=datetime.now(timezone.utc),
        )
    )
    db.execute(stmt)


# --- UN Ingester ---

def _text(elem: ET.Element | None) -> str | None:
    """Extract text from XML element, strip whitespace, return None if empty."""
    if elem is None or elem.text is None:
        return None
    t = elem.text.strip()
    return t if t else None


def _find_text(parent: ET.Element, tag: str) -> str | None:
    """Find first child with tag and return its text."""
    child = parent.find(tag)
    if child is not None:
        return _text(child)
    return None


def _parse_un_individual(elem: ET.Element) -> dict[str, Any] | None:
    """Parse UN INDIVIDUAL element into watchlist entry fields."""
    parts = [
        _find_text(elem, "FIRST_NAME"),
        _find_text(elem, "SECOND_NAME"),
        _find_text(elem, "THIRD_NAME"),
        _find_text(elem, "FOURTH_NAME"),
    ]
    primary = " ".join(p for p in parts if p).strip()
    if not primary:
        return None

    aliases: list[str] = []
    for alias_elem in elem.findall("INDIVIDUAL_ALIAS"):
        for sub in alias_elem:
            t = _text(sub)
            if t and t not in aliases:
                aliases.append(t)
        alias_group = _find_text(alias_elem, "ALIAS_NAME")
        if alias_group and alias_group not in aliases:
            aliases.append(alias_group)

    dob = _find_text(elem, "DATE_OF_BIRTH") or _find_text(elem, "YEAR_OF_BIRTH")
    nationality = _find_text(elem, "NATIONALITY")

    id_numbers: list[str] = []
    for doc in elem.findall("INDIVIDUAL_DOCUMENT"):
        num = _find_text(doc, "NUMBER")
        if num:
            id_numbers.append(num)

    list_data: dict[str, Any] = {}
    ref = _find_text(elem, "REFERENCE_NUMBER") or _find_text(elem, "DATAID")
    if ref:
        list_data["un_reference"] = ref

    return {
        "entity_type": EntityType.individual,
        "primary_name": primary[:500],
        "aliases": aliases[:50],
        "dob": (dob or None)[:50] if dob else None,
        "nationality": (nationality or None)[:100] if nationality else None,
        "id_numbers": id_numbers[:20],
        "list_specific_data": list_data if list_data else None,
        "crypto_addresses": [],
    }


def _parse_un_entity(elem: ET.Element) -> dict[str, Any] | None:
    """Parse UN ENTITY element into watchlist entry fields."""
    name = _find_text(elem, "FIRST_NAME") or _find_text(elem, "NAME")
    if not name:
        return None

    aliases: list[str] = []
    for alias_elem in elem.findall("ENTITY_ALIAS"):
        alias_name = _find_text(alias_elem, "ALIAS_NAME")
        if alias_name and alias_name not in aliases:
            aliases.append(alias_name)

    list_data: dict[str, Any] = {}
    ref = _find_text(elem, "REFERENCE_NUMBER") or _find_text(elem, "DATAID")
    if ref:
        list_data["un_reference"] = ref

    return {
        "entity_type": EntityType.entity,
        "primary_name": name[:500],
        "aliases": aliases[:50],
        "dob": None,
        "nationality": None,
        "id_numbers": [],
        "list_specific_data": list_data if list_data else None,
        "crypto_addresses": [],
    }


@shared_task(name="ingest_un_sanctions", bind=True, max_retries=3)
def ingest_un_sanctions(self: Any) -> dict[str, Any]:
    """Download UN consolidated XML, parse, replace watchlist entries, update ingestion_health."""
    db = get_sync_session()
    try:
        response = httpx.get(UN_CONSOLIDATED_URL, follow_redirects=True, timeout=60)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        err_msg = str(exc)
        _update_ingestion_health(db, IngestionSource.un, 0, err_msg, "error")
        db.commit()
        db.close()
        raise self.retry(exc=exc, countdown=300)

    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as exc:
        err_msg = f"XML parse error: {exc}"
        _update_ingestion_health(db, IngestionSource.un, 0, err_msg, "error")
        db.commit()
        db.close()
        return {"source": "un", "status": "error", "error": err_msg}

    entries: list[dict[str, Any]] = []

    individuals = root.find("INDIVIDUALS")
    if individuals is not None:
        for ind in individuals.findall("INDIVIDUAL"):
            parsed = _parse_un_individual(ind)
            if parsed:
                entries.append(parsed)

    entities = root.find("ENTITIES")
    if entities is not None:
        for ent in entities.findall("ENTITY"):
            parsed = _parse_un_entity(ent)
            if parsed:
                entries.append(parsed)

    if not entries:
        _update_ingestion_health(db, IngestionSource.un, 0, "No entries parsed", "warning")
        db.commit()
        db.close()
        return {"source": "un", "status": "warning", "records": 0, "error": "No entries parsed"}

    db.execute(delete(WatchlistEntry).where(WatchlistEntry.source == WatchlistSource.un))
    now = datetime.now(timezone.utc)
    for data in entries:
        db.add(
            WatchlistEntry(
                source=WatchlistSource.un,
                entity_type=data["entity_type"],
                primary_name=data["primary_name"],
                aliases=data["aliases"],
                dob=data["dob"],
                nationality=data["nationality"],
                id_numbers=data["id_numbers"],
                list_specific_data=data["list_specific_data"],
                crypto_addresses=data["crypto_addresses"],
                source_updated_at=now,
            )
        )

    _update_ingestion_health(db, IngestionSource.un, len(entries), None, "success")
    db.commit()
    db.close()
    return {"source": "un", "status": "success", "records": len(entries)}


# --- OFAC Ingester ---

def _fetch_csv(url: str, timeout: int = 120) -> str:
    """Fetch CSV content from URL."""
    response = httpx.get(url, follow_redirects=True, timeout=timeout)
    response.raise_for_status()
    return response.text


def _ofac_sdn_type_to_entity(sdn_type: str | None) -> EntityType:
    """Map OFAC SDN_Type to EntityType."""
    if not sdn_type:
        return EntityType.individual
    t = (sdn_type or "").strip().lower()
    if "vessel" in t:
        return EntityType.vessel
    if "aircraft" in t:
        return EntityType.aircraft
    if "individual" in t or "person" in t:
        return EntityType.individual
    return EntityType.entity


def _parse_ofac_sdn(sdn_text: str) -> dict[str, dict[str, Any]]:
    """Parse OFAC SDN CSV. Returns dict keyed by ent_num."""
    entries: dict[str, dict[str, Any]] = {}
    reader = csv.DictReader(io.StringIO(sdn_text))
    for row in reader:
        ent_num = (row.get("ent_num") or "").strip()
        name = (row.get("SDN_Name") or row.get("sdn_name") or "").strip()
        if not ent_num or not name:
            continue
        sdn_type = (row.get("SDN_Type") or row.get("sdn_type") or "").strip()
        program = (row.get("program") or "").strip()
        list_data: dict[str, Any] = {"ofac_ent_num": ent_num}
        if program:
            list_data["program"] = program[:200]
        entries[ent_num] = {
            "entity_type": _ofac_sdn_type_to_entity(sdn_type),
            "primary_name": name[:500],
            "aliases": [],
            "dob": None,
            "nationality": None,
            "id_numbers": [],
            "list_specific_data": list_data,
            "crypto_addresses": [],
        }
    return entries


def _parse_ofac_alt(alt_text: str, entries: dict[str, dict[str, Any]]) -> None:
    """Merge OFAC ALT (alternate names) into entries."""
    reader = csv.DictReader(io.StringIO(alt_text))
    for row in reader:
        ent_num = (row.get("ent_num") or "").strip()
        alt_name = (row.get("alt_name") or row.get("Alternate_Name") or "").strip()
        if not ent_num or not alt_name or ent_num not in entries:
            continue
        aliases = entries[ent_num]["aliases"]
        if alt_name not in aliases and alt_name != entries[ent_num]["primary_name"]:
            aliases.append(alt_name)


def _parse_ofac_add(add_text: str, entries: dict[str, dict[str, Any]]) -> None:
    """Merge OFAC ADD (addresses, including crypto) into entries."""
    reader = csv.DictReader(io.StringIO(add_text))
    for row in reader:
        ent_num = (row.get("ent_num") or "").strip()
        if ent_num not in entries:
            continue
        add_type = (row.get("add_type") or row.get("Address_Type") or "").lower()
        address = (row.get("address") or row.get("Address") or "").strip()
        if not address:
            continue
        if "digital" in add_type or "crypto" in add_type or "virtual" in add_type or "bitcoin" in add_type:
            crypto = entries[ent_num]["crypto_addresses"]
            if address not in crypto:
                crypto.append(address)


@shared_task(name="ingest_ofac_sdn", bind=True, max_retries=3)
def ingest_ofac_sdn(self: Any) -> dict[str, Any]:
    """Download OFAC SDN + ALT + ADD CSVs, parse, replace watchlist entries, update ingestion_health."""
    db = get_sync_session()
    try:
        sdn_text = _fetch_csv(OFAC_SDN_URL)
    except httpx.HTTPError as exc:
        err_msg = str(exc)
        _update_ingestion_health(db, IngestionSource.ofac, 0, err_msg, "error")
        db.commit()
        db.close()
        raise self.retry(exc=exc, countdown=300)

    try:
        entries = _parse_ofac_sdn(sdn_text)
    except Exception as exc:
        err_msg = f"SDN parse error: {exc}"
        _update_ingestion_health(db, IngestionSource.ofac, 0, err_msg, "error")
        db.commit()
        db.close()
        return {"source": "ofac", "status": "error", "error": err_msg}

    try:
        alt_text = _fetch_csv(OFAC_ALT_URL)
        _parse_ofac_alt(alt_text, entries)
    except httpx.HTTPError:
        pass
    except Exception:
        pass

    try:
        add_text = _fetch_csv(OFAC_ADD_URL)
        _parse_ofac_add(add_text, entries)
    except httpx.HTTPError:
        pass
    except Exception:
        pass

    if not entries:
        _update_ingestion_health(db, IngestionSource.ofac, 0, "No entries parsed", "warning")
        db.commit()
        db.close()
        return {"source": "ofac", "status": "warning", "records": 0, "error": "No entries parsed"}

    db.execute(delete(WatchlistEntry).where(WatchlistEntry.source == WatchlistSource.ofac))
    now = datetime.now(timezone.utc)
    for data in entries.values():
        data["aliases"] = data["aliases"][:50]
        data["crypto_addresses"] = data["crypto_addresses"][:50]
        db.add(
            WatchlistEntry(
                source=WatchlistSource.ofac,
                entity_type=data["entity_type"],
                primary_name=data["primary_name"],
                aliases=data["aliases"],
                dob=data["dob"],
                nationality=data["nationality"],
                id_numbers=data["id_numbers"],
                list_specific_data=data["list_specific_data"],
                crypto_addresses=data["crypto_addresses"],
                source_updated_at=now,
            )
        )

    _update_ingestion_health(db, IngestionSource.ofac, len(entries), None, "success")
    db.commit()
    db.close()
    return {"source": "ofac", "status": "success", "records": len(entries)}


# --- OpenSanctions (EU, NACTA, PEP) ---

def _parse_opensanctions_csv(
    csv_text: str,
    source: WatchlistSource,
    source_key: str,
) -> list[dict[str, Any]]:
    """
    Parse OpenSanctions targets.simple.csv.
    Columns vary; look for id, name, schema, firstName, lastName, alias, etc.
    """
    entries: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        name = (
            row.get("name")
            or row.get("caption")
            or row.get("target")
            or ""
        ).strip()
        if not name:
            first = (row.get("firstName") or row.get("first_name") or "").strip()
            last = (row.get("lastName") or row.get("last_name") or "").strip()
            name = f"{first} {last}".strip() or (row.get("schema") or "").strip()
        if not name or len(name) < 2:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)
        aliases_raw = row.get("alias") or row.get("aliases") or row.get("names") or ""
        aliases: list[str] = []
        if aliases_raw:
            for part in aliases_raw.replace(";", "|").split("|"):
                a = part.strip()
                if a and a != name and a not in aliases:
                    aliases.append(a)
        entity_id = (row.get("id") or "").strip()
        schema = (row.get("schema") or "").strip().lower()
        if schema == "vessel":
            entity_type = EntityType.vessel
        elif schema == "aircraft":
            entity_type = EntityType.aircraft
        elif schema in ("organization", "legalentity", "company"):
            entity_type = EntityType.entity
        else:
            entity_type = EntityType.individual
        list_data: dict[str, Any] = {}
        if entity_id:
            list_data[source_key] = entity_id[:200]
        dob = (row.get("birthDate") or row.get("birth_date") or row.get("dob") or "").strip()[:50] or None
        nationality = (row.get("nationality") or row.get("country") or row.get("countries") or "").strip()[:100] or None
        entries.append({
            "entity_type": entity_type,
            "primary_name": name[:500],
            "aliases": aliases[:50],
            "dob": dob,
            "nationality": nationality,
            "id_numbers": [],
            "list_specific_data": list_data if list_data else None,
            "crypto_addresses": [],
        })
    return entries


def _ingest_opensanctions(
    db: Session,
    url: str,
    source: IngestionSource,
    watchlist_source: WatchlistSource,
    source_key: str,
    task_self: Any,
) -> dict[str, Any]:
    """Shared logic for EU, NACTA, PEP OpenSanctions ingestors."""
    try:
        response = httpx.get(url, follow_redirects=True, timeout=300)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        err_msg = str(exc)
        _update_ingestion_health(db, source, 0, err_msg, "error")
        db.commit()
        db.close()
        raise task_self.retry(exc=exc, countdown=300)
    try:
        entries = _parse_opensanctions_csv(response.text, watchlist_source, source_key)
    except Exception as exc:
        err_msg = f"Parse error: {exc}"
        _update_ingestion_health(db, source, 0, err_msg, "error")
        db.commit()
        db.close()
        return {"source": source.value, "status": "error", "error": err_msg}
    if not entries:
        _update_ingestion_health(db, source, 0, "No entries parsed", "warning")
        db.commit()
        db.close()
        return {"source": source.value, "status": "warning", "records": 0, "error": "No entries parsed"}
    db.execute(delete(WatchlistEntry).where(WatchlistEntry.source == watchlist_source))
    now = datetime.now(timezone.utc)
    for data in entries:
        db.add(
            WatchlistEntry(
                source=watchlist_source,
                entity_type=data["entity_type"],
                primary_name=data["primary_name"],
                aliases=data["aliases"],
                dob=data["dob"],
                nationality=data["nationality"],
                id_numbers=data["id_numbers"],
                list_specific_data=data["list_specific_data"],
                crypto_addresses=data["crypto_addresses"],
                source_updated_at=now,
            )
        )
    _update_ingestion_health(db, source, len(entries), None, "success")
    db.commit()
    db.close()
    return {"source": source.value, "status": "success", "records": len(entries)}


@shared_task(name="ingest_eu_sanctions", bind=True, max_retries=3)
def ingest_eu_sanctions(self: Any) -> dict[str, Any]:
    """Download EU FSF from OpenSanctions, parse, replace watchlist entries."""
    db = get_sync_session()
    return _ingest_opensanctions(
        db, OPENSANCTIONS_EU_URL,
        IngestionSource.eu, WatchlistSource.eu, "eu_entity_id", self
    )


@shared_task(name="ingest_nacta_proscribed", bind=True, max_retries=3)
def ingest_nacta_proscribed(self: Any) -> dict[str, Any]:
    """Download NACTA Pakistan proscribed persons from OpenSanctions, parse, replace."""
    db = get_sync_session()
    return _ingest_opensanctions(
        db, OPENSANCTIONS_NACTA_URL,
        IngestionSource.nacta, WatchlistSource.nacta, "nacta_entity_id", self
    )


@shared_task(name="ingest_peps", bind=True, max_retries=3)
def ingest_peps(self: Any) -> dict[str, Any]:
    """Download PEPs from OpenSanctions, parse, replace watchlist entries."""
    db = get_sync_session()
    return _ingest_opensanctions(
        db, OPENSANCTIONS_PEP_URL,
        IngestionSource.pep, WatchlistSource.pep, "pep_entity_id", self
    )
