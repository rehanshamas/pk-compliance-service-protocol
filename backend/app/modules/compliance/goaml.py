"""goAML STR/CTR XML generation — FMU XSD v5.0.2 compliant.

Generates FMU-compatible XML for Suspicious Transaction Reports and
Currency Transaction Reports from approved/filed ISARs.
Validate against public XSD when GOAML_XSD_PATH is set.
"""

import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any
from xml.dom import minidom

from app.config import settings
from app.models.tenant import Tenant

if TYPE_CHECKING:
    from app.modules.compliance.models import Isar
    from app.modules.identity.models import Customer


def validate_str_xml_if_configured(xml_str: str) -> None:
    """Validate STR XML against XSD when GOAML_XSD_PATH is set. Raises ValidationError if invalid."""
    if settings.goaml_xsd_path:
        validate_str_xml(xml_str, settings.goaml_xsd_path)


def validate_str_xml(xml_str: str, xsd_path: str | Path) -> None:
    """Validate STR XML against XSD. Raises ValidationError if invalid."""
    from app.core.exceptions import ValidationError

    path = Path(xsd_path)
    if not path.exists():
        raise ValidationError(
            f"XSD file not found: {xsd_path}",
            details={"xsd_path": str(xsd_path)},
        )
    try:
        import xmlschema
    except ImportError:
        raise ValidationError(
            "XSD validation requires xmlschema package. Install with: pip install xmlschema",
            details={"xsd_path": str(xsd_path)},
        )
    try:
        schema = xmlschema.XMLSchema(str(path))
        schema.validate(xml_str)
    except xmlschema.XMLSchemaException as e:
        raise ValidationError(
            f"STR XML failed XSD validation: {e}",
            details={"xsd_path": str(xsd_path)},
        )


def _escape(txt: str | None) -> str:
    if txt is None:
        return ""
    return str(txt).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&apos;")


def _sub(parent: ET.Element, tag: str, text: str | None = None) -> ET.Element:
    """Add a subelement with optional text content."""
    el = ET.SubElement(parent, tag)
    if text is not None:
        el.text = str(text)
    return el


def _get(d: dict | None, key: str, default: str = "") -> str:
    """Safely get a value from a dict, returning default if missing."""
    if d is None:
        return default
    val = d.get(key)
    if val is None:
        return default
    return str(val)


def _build_address(parent: ET.Element, addr_data: dict | None, addr_type: str = "business") -> ET.Element:
    """Build an <address> element inside an <addresses> wrapper or directly."""
    addr = ET.SubElement(parent, "address")
    _sub(addr, "address_type", addr_type)
    _sub(addr, "address", _get(addr_data, "address"))
    _sub(addr, "city", _get(addr_data, "city"))
    _sub(addr, "country_code", _get(addr_data, "country_code", "PK"))
    if _get(addr_data, "zip"):
        _sub(addr, "zip", _get(addr_data, "zip"))
    _sub(addr, "state", _get(addr_data, "state"))
    return addr


def _build_person(
    parent: ET.Element,
    person_data: dict | None,
    *,
    include_identification: bool = False,
    include_occupation: bool = True,
) -> ET.Element:
    """Build a person element with gender, name, dob, nationality, phones, addresses, etc."""
    p = person_data or {}
    _sub(parent, "gender", _get(p, "gender", "M"))
    _sub(parent, "first_name", _get(p, "first_name"))
    _sub(parent, "last_name", _get(p, "last_name"))
    _sub(parent, "birthdate", _get(p, "birthdate"))
    _sub(parent, "nationality1", _get(p, "nationality", "PK"))

    # phones
    phones_el = _sub(parent, "phones")
    phone_val = _get(p, "phone")
    if phone_val:
        _sub(phones_el, "phone", phone_val)
    else:
        phones_list = p.get("phones", [])
        if isinstance(phones_list, list):
            for ph in phones_list:
                _sub(phones_el, "phone", str(ph))

    # addresses
    addresses_el = _sub(parent, "addresses")
    addr_data = p.get("address")
    if isinstance(addr_data, dict):
        _build_address(addresses_el, addr_data, _get(addr_data, "address_type", "residential"))
    elif isinstance(addr_data, list):
        for ad in addr_data:
            if isinstance(ad, dict):
                _build_address(addresses_el, ad, _get(ad, "address_type", "residential"))

    if include_occupation:
        _sub(parent, "occupation", _get(p, "occupation"))

    if include_identification:
        id_data = p.get("identification")
        if isinstance(id_data, dict):
            ident = _sub(parent, "identification")
            _sub(ident, "type", _get(id_data, "type", "C"))
            _sub(ident, "number", _get(id_data, "number"))
            _sub(ident, "country", _get(id_data, "country", "PK"))
        elif _get(p, "cnic"):
            ident = _sub(parent, "identification")
            _sub(ident, "type", "C")
            _sub(ident, "number", _get(p, "cnic"))
            _sub(ident, "country", _get(p, "nationality", "PK"))

    return parent


def _extract_customer_person(customer: "Customer") -> dict:
    """Extract person data dict from a Customer model."""
    full_name = customer.full_name or ""
    parts = full_name.strip().split(None, 1)
    first_name = parts[0] if parts else ""
    last_name = parts[1] if len(parts) > 1 else ""

    person: dict[str, Any] = {
        "first_name": first_name,
        "last_name": last_name,
        "nationality": customer.nationality or "PK",
    }
    if customer.dob:
        person["birthdate"] = customer.dob.isoformat()
    if customer.cnic_number:
        person["cnic"] = customer.cnic_number

    return person


def _to_pretty_xml(root: ET.Element) -> str:
    """Convert an ElementTree root to pretty-printed XML string with declaration."""
    xml_bytes = ET.tostring(root, encoding="unicode")
    dom = minidom.parseString(f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_bytes}')
    return dom.toprettyxml(indent="  ", encoding=None)


def generate_str_xml(
    isar: "Isar",
    customer: "Customer",
    tenant: Tenant,
    *,
    report_ref: str | None = None,
    schema_version: str = "5.0.2",
    data: dict | None = None,
) -> str:
    """Generate goAML v5.0.2 compliant STR XML from an approved or filed ISAR.

    The ``data`` dict may contain rich details for:
      - reporting_entity: {id, name}
      - reporting_person: {gender, first_name, last_name, birthdate, nationality, phone, address, occupation}
      - location: {address, city, zip, country_code, state}
      - transaction: {transactionnumber, transaction_location, date_transaction, teller, authorized,
                       amount_local, transmode_code, from_funds_code, currency_code, ...}
      - from_account: {institution_name, institution_code, branch, account, currency_code, account_name, opened}
      - from_person: (overrides customer-derived data)
      - action: str
    If ``data`` is None, reasonable defaults are derived from the isar, customer, and tenant objects.
    """
    d = data or {}
    ref = report_ref or f"STR-{isar.id}"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    filed_at = isar.filed_at.strftime("%Y-%m-%dT%H:%M:%SZ") if isar.filed_at else now
    submission_date = filed_at[:10]  # YYYY-MM-DD

    root = ET.Element("report")

    # --- Header ---
    re_data = d.get("reporting_entity", {}) or {}
    _sub(root, "rentity_id", _get(re_data, "id", str(tenant.id)))
    _sub(root, "submission_code", _get(d, "submission_code", "E"))
    _sub(root, "report_code", "STR")
    _sub(root, "entity_reference", ref)
    _sub(root, "submission_date", submission_date)
    _sub(root, "currency_code_local", _get(d, "currency_code_local", "PKR"))

    # --- Reporting person (MLRO) ---
    rp_el = _sub(root, "reporting_person")
    rp_data = d.get("reporting_person") or {}
    _build_person(rp_el, rp_data, include_identification=False, include_occupation=True)
    # Ensure occupation defaults to MLRO
    if not _get(rp_data, "occupation"):
        # Already set by _build_person with empty string; fix it
        for occ_el in rp_el.findall("occupation"):
            if not occ_el.text:
                occ_el.text = "MLRO"

    # --- Location ---
    loc_data = d.get("location") or {}
    loc_el = _sub(root, "location")
    _sub(loc_el, "address_type", _get(loc_data, "address_type", "business"))
    _sub(loc_el, "address", _get(loc_data, "address"))
    _sub(loc_el, "city", _get(loc_data, "city"))
    if _get(loc_data, "zip"):
        _sub(loc_el, "zip", _get(loc_data, "zip"))
    _sub(loc_el, "country_code", _get(loc_data, "country_code", "PK"))
    _sub(loc_el, "state", _get(loc_data, "state"))

    # --- Reason / Action ---
    _sub(root, "reason", isar.narrative or _get(d, "reason"))
    _sub(root, "action", _get(d, "action", "File STR with FMU"))

    # --- Transaction ---
    tx_data = d.get("transaction") or {}
    tx_el = _sub(root, "transaction")
    _sub(tx_el, "transactionnumber", _get(tx_data, "transactionnumber", f"TX-{isar.id}"))
    _sub(tx_el, "transaction_location", _get(tx_data, "transaction_location"))
    _sub(tx_el, "date_transaction", _get(tx_data, "date_transaction", submission_date))
    _sub(tx_el, "teller", _get(tx_data, "teller"))
    _sub(tx_el, "authorized", _get(tx_data, "authorized"))
    _sub(tx_el, "amount_local", _get(tx_data, "amount_local", "0"))
    _sub(tx_el, "transmode_code", _get(tx_data, "transmode_code", "W"))

    # --- t_from_my_client ---
    from_client = _sub(tx_el, "t_from_my_client")
    _sub(from_client, "from_funds_code", _get(tx_data, "from_funds_code", "V"))

    # from_account
    acct_data = d.get("from_account") or tx_data.get("from_account") or {}
    acct_el = _sub(from_client, "from_account")
    _sub(acct_el, "institution_name", _get(acct_data, "institution_name", tenant.name or ""))
    _sub(acct_el, "institution_code", _get(acct_data, "institution_code", str(tenant.id)))
    _sub(acct_el, "branch", _get(acct_data, "branch", "Main"))
    _sub(acct_el, "account", _get(acct_data, "account"))
    _sub(acct_el, "currency_code", _get(acct_data, "currency_code", "BTC"))
    _sub(acct_el, "account_name", _get(acct_data, "account_name", customer.full_name or ""))
    _sub(acct_el, "opened", _get(acct_data, "opened", customer.created_at.strftime("%Y-%m-%d") if customer.created_at else ""))

    # from_person — prefer explicit data, fall back to customer model
    fp_data = d.get("from_person") or {}
    customer_person = _extract_customer_person(customer)
    # Merge: explicit data wins, customer data is fallback
    merged_person: dict[str, Any] = {**customer_person, **{k: v for k, v in fp_data.items() if v}}
    fp_el = _sub(from_client, "from_person")
    _build_person(fp_el, merged_person, include_identification=True, include_occupation=True)

    return _to_pretty_xml(root)


def generate_ctr_xml(
    isar: "Isar",
    customer: "Customer",
    tenant: Tenant,
    *,
    report_ref: str | None = None,
    schema_version: str = "5.0.2",
    data: dict | None = None,
) -> str:
    """Generate goAML v5.0.2 compliant CTR (Currency Transaction Report) XML.

    Structure is similar to STR but with report_code=CTR and threshold amount fields.
    The ``data`` dict follows the same structure as generate_str_xml() plus:
      - threshold_amount: the CTR threshold amount
      - threshold_currency: currency for threshold (default PKR)
    """
    d = data or {}
    ref = report_ref or f"CTR-{isar.id}"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    filed_at = isar.filed_at.strftime("%Y-%m-%dT%H:%M:%SZ") if isar.filed_at else now
    submission_date = filed_at[:10]

    root = ET.Element("report")

    # --- Header ---
    re_data = d.get("reporting_entity", {}) or {}
    _sub(root, "rentity_id", _get(re_data, "id", str(tenant.id)))
    _sub(root, "submission_code", _get(d, "submission_code", "E"))
    _sub(root, "report_code", "CTR")
    _sub(root, "entity_reference", ref)
    _sub(root, "submission_date", submission_date)
    _sub(root, "currency_code_local", _get(d, "currency_code_local", "PKR"))

    # --- Reporting person (MLRO) ---
    rp_el = _sub(root, "reporting_person")
    rp_data = d.get("reporting_person") or {}
    _build_person(rp_el, rp_data, include_identification=False, include_occupation=True)
    for occ_el in rp_el.findall("occupation"):
        if not occ_el.text:
            occ_el.text = "MLRO"

    # --- Location ---
    loc_data = d.get("location") or {}
    loc_el = _sub(root, "location")
    _sub(loc_el, "address_type", _get(loc_data, "address_type", "business"))
    _sub(loc_el, "address", _get(loc_data, "address"))
    _sub(loc_el, "city", _get(loc_data, "city"))
    if _get(loc_data, "zip"):
        _sub(loc_el, "zip", _get(loc_data, "zip"))
    _sub(loc_el, "country_code", _get(loc_data, "country_code", "PK"))
    _sub(loc_el, "state", _get(loc_data, "state"))

    # --- Reason / Action ---
    _sub(root, "reason", isar.narrative or _get(d, "reason", "Currency transaction exceeding threshold"))
    _sub(root, "action", _get(d, "action", "File CTR with FMU"))

    # --- CTR-specific: threshold fields ---
    _sub(root, "threshold_amount", _get(d, "threshold_amount", "0"))
    _sub(root, "threshold_currency", _get(d, "threshold_currency", "PKR"))

    # --- Transaction ---
    tx_data = d.get("transaction") or {}
    tx_el = _sub(root, "transaction")
    _sub(tx_el, "transactionnumber", _get(tx_data, "transactionnumber", f"TX-{isar.id}"))
    _sub(tx_el, "transaction_location", _get(tx_data, "transaction_location"))
    _sub(tx_el, "date_transaction", _get(tx_data, "date_transaction", submission_date))
    _sub(tx_el, "teller", _get(tx_data, "teller"))
    _sub(tx_el, "authorized", _get(tx_data, "authorized"))
    _sub(tx_el, "amount_local", _get(tx_data, "amount_local", "0"))
    _sub(tx_el, "transmode_code", _get(tx_data, "transmode_code", "W"))

    # --- t_from_my_client ---
    from_client = _sub(tx_el, "t_from_my_client")
    _sub(from_client, "from_funds_code", _get(tx_data, "from_funds_code", "V"))

    # from_account
    acct_data = d.get("from_account") or tx_data.get("from_account") or {}
    acct_el = _sub(from_client, "from_account")
    _sub(acct_el, "institution_name", _get(acct_data, "institution_name", tenant.name or ""))
    _sub(acct_el, "institution_code", _get(acct_data, "institution_code", str(tenant.id)))
    _sub(acct_el, "branch", _get(acct_data, "branch", "Main"))
    _sub(acct_el, "account", _get(acct_data, "account"))
    _sub(acct_el, "currency_code", _get(acct_data, "currency_code", "BTC"))
    _sub(acct_el, "account_name", _get(acct_data, "account_name", customer.full_name or ""))
    _sub(acct_el, "opened", _get(acct_data, "opened", customer.created_at.strftime("%Y-%m-%d") if customer.created_at else ""))

    # from_person
    fp_data = d.get("from_person") or {}
    customer_person = _extract_customer_person(customer)
    merged_person: dict[str, Any] = {**customer_person, **{k: v for k, v in fp_data.items() if v}}
    fp_el = _sub(from_client, "from_person")
    _build_person(fp_el, merged_person, include_identification=True, include_occupation=True)

    return _to_pretty_xml(root)
