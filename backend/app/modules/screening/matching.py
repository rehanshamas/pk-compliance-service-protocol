"""Fuzzy name matching engine. Phase 3.8: Levenshtein + phonetic (Soundex/Metaphone) + Jaro-Winkler + Urdu/Arabic romanization. Configurable threshold. Score 0-100."""

from rapidfuzz import fuzz
from rapidfuzz.distance import JaroWinkler, Levenshtein

try:
    import jellyfish
    HAS_JELLYFISH = True
except ImportError:
    HAS_JELLYFISH = False


# Common Urdu/Arabic name romanization variants — map to canonical form for matching.
# Covers Pakistani and Arabic names: Muhammad/Mohammad, Ahmed/Ahmad, Hussain/Husain, etc.
_ROMANIZATION_MAP: dict[str, str] = {
    "muhammad": "muhammad",
    "mohammad": "muhammad",
    "mohamed": "muhammad",
    "mohammed": "muhammad",
    "muhammed": "muhammad",
    "ahmad": "ahmad",
    "ahmed": "ahmad",
    "hussain": "hussain",
    "husain": "hussain",
    "husayn": "hussain",
    "hassan": "hassan",
    "hasan": "hassan",
    "ali": "ali",
    "aley": "ali",
    "aaly": "ali",
    "abdul": "abdul",
    "abd": "abdul",
    "syed": "syed",
    "said": "syed",
    "sayed": "syed",
    "karim": "karim",
    "kareem": "karim",
    "rasheed": "rashid",
    "rashid": "rashid",
    "qasim": "qasim",
    "kasim": "qasim",
    "osman": "usman",
    "usman": "usman",
    "othman": "usman",
    "khan": "khan",
}


def _apply_romanization(text: str) -> str:
    """Apply romanization normalization: map common variants to canonical form."""
    tokens = text.lower().split()
    out = []
    for t in tokens:
        canonical = _ROMANIZATION_MAP.get(t, t)
        out.append(canonical)
    return " ".join(out)


def normalize_name(name: str) -> str:
    """Normalize for matching: lowercase, strip, collapse whitespace, apply romanization."""
    if not name:
        return ""
    base = " ".join(name.lower().split())
    return _apply_romanization(base)


def score_match(screened: str, watchlist_name: str) -> float:
    """
    Compare screened name to watchlist name. Returns 0-100.
    Combines token_set_ratio, Jaro-Winkler, phonetic (Soundex/Metaphone), and Levenshtein.
    """
    a = normalize_name(screened)
    b = normalize_name(watchlist_name)
    if not a or not b:
        return 0.0

    # 1. Token set ratio — handles word order, extra words ("John Smith" vs "Smith, John")
    token_score = float(fuzz.token_set_ratio(a, b))

    # 2. Jaro-Winkler — good for typos, short strings, prefix weight
    jaro_score = JaroWinkler.similarity(a, b) * 100.0

    # 3. Levenshtein similarity
    lev_dist = Levenshtein.distance(a, b)
    lev_sim = 1.0 - (lev_dist / max(len(a), len(b), 1))
    lev_score = lev_sim * 100.0

    # 4. Phonetic bonus: Soundex or Metaphone match — names that sound alike
    phonetic_bonus = 0.0
    if HAS_JELLYFISH:
        try:
            soundex_a = jellyfish.soundex(a) if a else ""
            soundex_b = jellyfish.soundex(b) if b else ""
            meta_a = jellyfish.metaphone(a) if a else ""
            meta_b = jellyfish.metaphone(b) if b else ""
            if soundex_a and soundex_b and soundex_a == soundex_b:
                phonetic_bonus = 8.0
            elif meta_a and meta_b and meta_a == meta_b:
                phonetic_bonus = 10.0  # Metaphone often more accurate for names
        except Exception:
            pass

    # Composite: take best of string metrics, add phonetic bonus
    best_string = max(token_score, jaro_score, lev_score)
    total = min(100.0, best_string + phonetic_bonus)
    return round(total, 1)


def score_match_levenshtein(screened: str, watchlist_name: str) -> float:
    """Simple Levenshtein similarity as 0-100. Kept for backward compatibility."""
    a = normalize_name(screened)
    b = normalize_name(watchlist_name)
    if not a or not b:
        return 0.0
    sim = 1.0 - (Levenshtein.distance(a, b) / max(len(a), len(b), 1))
    return round(sim * 100, 1)


def find_matches(
    screened_name: str,
    watchlist_entries: list[tuple],  # (id_str, primary_name) or (id_str, primary_name, aliases, source)
    threshold: float = 70.0,
    use_aliases: bool = True,
) -> list[dict]:
    """
    Find watchlist entries that match screened_name above threshold.
    Uses composite scoring: Levenshtein, Jaro-Winkler, phonetic (Soundex/Metaphone), Urdu/Arabic romanization.
    watchlist_entries: list of (entry_id, primary_name) or (entry_id, primary_name, aliases_list, source)
    Returns list of {watchlist_entry_id, score, source, matched_fields}.
    """
    results: list[dict] = []
    seen_scores: dict[str, float] = {}
    seen_source: dict[str, str] = {}

    def add_candidate(entry_id: str, name: str, field: str, source: str = ""):
        sc = score_match(screened_name, name)
        if sc >= threshold:
            key = entry_id
            if sc > seen_scores.get(key, 0):
                seen_scores[key] = sc
                seen_source[key] = source
                results.append({
                    "watchlist_entry_id": entry_id,
                    "score": round(sc, 1),
                    "source": source,
                    "matched_fields": [field],
                })

    for row in watchlist_entries:
        if len(row) == 2:
            entry_id, primary = row
            aliases, source = [], ""
        elif len(row) == 4:
            entry_id, primary, aliases, source = row[0], row[1], row[2] or [], row[3] or ""
        else:
            entry_id, primary = row[0], row[1]
            aliases = row[2] if len(row) > 2 else []
            source = row[3] if len(row) > 3 else ""

        add_candidate(entry_id, primary, "primary_name", source)
        if use_aliases and aliases:
            for alias in aliases:
                if isinstance(alias, str):
                    add_candidate(entry_id, alias, "alias", source)

    # Dedupe by entry_id, keep highest score
    by_id: dict[str, dict] = {}
    for r in results:
        eid = r["watchlist_entry_id"]
        if eid not in by_id or r["score"] > by_id[eid]["score"]:
            by_id[eid] = r

    return sorted(by_id.values(), key=lambda x: -x["score"])
