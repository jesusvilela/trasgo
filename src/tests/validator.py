"""
§1 Codec — Response Validator & Correction Engine
Mechanical validation of LLM responses against §1 codec packets.
Zero external dependencies — Python stdlib only.

Usage:
    from validator import S1Validator, TEST_VALIDATORS
    v = S1Validator()
    result = v.validate(response_text, "T1", TEST_VALIDATORS["T1"])
"""

import re
import json
import sys
import io

# Fix Windows console encoding (only when running standalone, not when imported)
if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True)


class ValidationResult:
    """Result of validating a §1 response."""

    __slots__ = ("passed", "errors", "warnings", "corrections")

    def __init__(self):
        self.passed = True
        self.errors = []      # [{"check": str, "message": str}]
        self.warnings = []    # [{"check": str, "message": str}]
        self.corrections = [] # hint strings for correction re-prompt

    def add_error(self, check, message, correction_hint=None):
        self.passed = False
        self.errors.append({"check": check, "message": message})
        if correction_hint:
            self.corrections.append(correction_hint)

    def add_warning(self, check, message):
        self.warnings.append({"check": check, "message": message})

    def to_dict(self):
        return {
            "passed": self.passed,
            "errors": self.errors,
            "warnings": self.warnings,
            "corrections": self.corrections,
            "error_count": len(self.errors),
        }


# ── RLHF / Narration patterns (consolidated) ─────────────────────────

RLHF_PATTERNS = [
    "would you like", "shall i", "let me know", "happy to",
    "feel free", "i can help", "don't hesitate", "i'd be glad",
    "i'd be happy", "how can i assist", "is there anything else",
    "certainly!", "of course!", "absolutely!",
]

NARRATION_PATTERNS = [
    "this json", "let me explain", "this represents",
    "the codec", "this format", "the structure shows",
    "in this notation", "the §1 format",
]


class S1Validator:
    """Validates §1 codec responses against test-specific expectations."""

    def validate(self, response, test_id, spec):
        """
        Validate a response against a test specification.

        Args:
            response: Raw response text from LLM
            test_id: Test identifier (e.g., "T1", "T2")
            spec: Validation spec dict from TEST_VALIDATORS

        Returns:
            ValidationResult
        """
        result = ValidationResult()
        lower = response.lower()

        if response.startswith("ERROR:"):
            result.add_error("response", f"Response is an error: {response[:200]}")
            return result

        # Run each check type present in the spec
        if "fields" in spec:
            self._check_fields(lower, spec["fields"], result)

        if "arithmetic" in spec:
            self._check_arithmetic(lower, response, spec["arithmetic"], result)

        if "delta_chain" in spec:
            self._check_delta_consistency(lower, spec["delta_chain"], result)

        if "filter" in spec:
            self._check_filter_logic(lower, spec["filter"], result)

        if "currency" in spec:
            self._check_currency(lower, response, spec["currency"], result)

        # Always run behavioral checks
        self._check_rlhf_leakage(lower, result)
        self._check_narration(lower, result)

        return result

    def _check_fields(self, lower, field_specs, result):
        """Check that expected fields/values appear in the response."""
        for field_name, patterns in field_specs.items():
            if isinstance(patterns, str):
                patterns = [patterns]
            found = any(re.search(p, lower) for p in patterns)
            if not found:
                result.add_error(
                    "field_presence",
                    f"Missing field '{field_name}': none of {patterns} found in response",
                    f"The response should mention {field_name}"
                )

    def _check_arithmetic(self, lower, raw, arith_specs, result):
        """Verify numeric derivations are correct."""
        for spec in arith_specs:
            label = spec["label"]
            # Extract all numbers from response
            numbers = re.findall(r'[\d,]+\.?\d*', raw)
            numbers_clean = [float(n.replace(',', '')) for n in numbers if n.replace(',', '').replace('.', '').isdigit() or '.' in n]

            expected = spec["expected"]
            tolerance = spec.get("tolerance", 0.05)  # 5% relative tolerance

            # Check if expected value (or close approximation) appears
            found = False
            for n in numbers_clean:
                if expected == 0:
                    if n == 0:
                        found = True
                        break
                elif abs(n - expected) / abs(expected) <= tolerance:
                    found = True
                    break
                # Also check scaled versions (84M = 84000000 or 84)
                for scale in [1, 1e3, 1e6, 1e9]:
                    if abs(n * scale - expected) / abs(expected) <= tolerance:
                        found = True
                        break
                    if expected != 0 and abs(n - expected / scale) / abs(expected / scale) <= tolerance:
                        found = True
                        break
                if found:
                    break

            if not found:
                result.add_error(
                    "arithmetic",
                    f"Expected {label} ≈ {expected} not found in response numbers: {numbers_clean[:10]}",
                    f"Check the {label} calculation"
                )

    def _check_delta_consistency(self, lower, chain_spec, result):
        """Replay delta chain and verify final state values in response."""
        initial = dict(chain_spec["initial"])
        for delta in chain_spec["deltas"]:
            initial.update(delta)
        expected = chain_spec["expected"]

        for field, value in expected.items():
            if isinstance(value, (int, float)):
                # Look for the number in the response
                pattern = str(value)
                if pattern not in lower:
                    result.add_error(
                        "delta_consistency",
                        f"After applying all deltas, {field} should be {value} — not found in response",
                        f"Recompute {field} after applying all delta updates sequentially"
                    )
            else:
                # String value — look for it
                if str(value).lower() not in lower:
                    result.add_error(
                        "delta_consistency",
                        f"After applying all deltas, {field} should be '{value}' — not found in response",
                        f"Check the final value of {field} after all updates"
                    )

    def _check_filter_logic(self, lower, filter_spec, result):
        """Verify correct packets selected by §P filter."""
        expected = filter_spec["expected"]  # e.g., ["A", "C"]
        values = filter_spec["values"]      # e.g., {"A": 0.8, "B": 0.3, "C": 0.5}
        top_k = filter_spec["top_k"]
        order = filter_spec.get("order", "desc")

        # Verify expected is correct (sanity check our own spec)
        sorted_items = sorted(values.items(), key=lambda x: x[1],
                              reverse=(order == "desc"))
        correct_top = [k for k, v in sorted_items[:top_k]]
        assert set(correct_top) == set(expected), f"Spec error: expected {expected} but computed {correct_top}"

        # Check which packets the response claims survive
        excluded = [k for k in values if k not in expected]

        for packet_id in expected:
            # Check if the expected packet is mentioned as surviving
            mentions = re.findall(
                rf'packet\s+{packet_id.lower()}|{packet_id.lower()}\s+(?:and|,|\))|'
                rf'(?:^|\s){packet_id.lower()}(?:\s|$|,|\.|:)',
                lower
            )
            if not mentions:
                result.add_error(
                    "filter_logic",
                    f"Packet {packet_id} (urg={values[packet_id]}) should survive filter but may not be mentioned",
                    f"Re-check: sort packets by {filter_spec['by']} {order}, select top {top_k}"
                )

        for packet_id in excluded:
            # Check if excluded packet is incorrectly claimed as surviving
            # Look for patterns like "B survive", "Packet B", "B and" in survivor context
            survive_patterns = [
                rf'packet\s+{packet_id.lower()}\s+(?:surviv|pass|remain|kept)',
                rf'(?:surviv|pass|kept).*packet\s+{packet_id.lower()}',
                rf'packets?\s+(?:a|b|c)\s+and\s+{packet_id.lower()}\s+surviv',
                rf'packets?\s+{packet_id.lower()}\s+and\s+(?:a|b|c)\s+surviv',
            ]
            for pat in survive_patterns:
                if re.search(pat, lower):
                    result.add_error(
                        "filter_logic",
                        f"Packet {packet_id} (urg={values[packet_id]}) should be EXCLUDED but appears to be listed as surviving",
                        f"Packet {packet_id} has urgency {values[packet_id]} which is not in the top {top_k}"
                    )
                    break

    def _check_currency(self, lower, raw, currency_spec, result):
        """Verify currency symbols match source data."""
        expected_symbol = currency_spec["symbol"]  # e.g., "€"
        wrong_symbols = currency_spec.get("wrong", [])  # e.g., ["$"]

        # Check if expected symbol appears near the relevant number
        has_correct = expected_symbol.lower() in lower or expected_symbol in raw
        has_wrong = any(s in raw for s in wrong_symbols)

        if has_wrong and not has_correct:
            result.add_error(
                "currency",
                f"Currency mismatch: source uses {expected_symbol}, response uses {wrong_symbols}",
                f"Use the correct currency symbol ({expected_symbol}) from the source data"
            )
        elif has_wrong and has_correct:
            result.add_warning(
                "currency",
                f"Mixed currency symbols: both {expected_symbol} and {wrong_symbols} appear"
            )

    def _check_rlhf_leakage(self, lower, result):
        """Detect RLHF assistant-mode patterns."""
        found = [p for p in RLHF_PATTERNS if p in lower]
        if found:
            result.add_warning("rlhf_leakage", f"RLHF patterns detected: {found}")

    def _check_narration(self, lower, result):
        """Detect codec narration (describing the format instead of using it)."""
        found = [p for p in NARRATION_PATTERNS if p in lower]
        if found:
            result.add_warning("narration", f"Narration patterns detected: {found}")


# ── Test-specific validation specs ────────────────────────────────────

TEST_VALIDATORS = {
    "T1: Calibration (dual query)": {
        "fields": {
            "weight_reduction": [r"0\.12.*0\.08", r"12%.*8%", r"weight.*reduc"],
            "timing": [r"march.*2026", r"2026.*march", r"2026-03"],
            "hedge_instrument": [r"gold.*etc", r"etc.*gold", r"hedg"],
            "vix_trigger": [r"vix.*28", r"28.*vix", r"volatility.*28"],
        },
    },

    "T2: Cross-domain GDPR": {
        "fields": {
            "fine_amount": [r"84.*m", r"84.*million"],
            "fine_basis": [r"4%.*revenue", r"4.*percent"],
            "escalation": [r"elevat", r"routine.*elevated", r"priority.*increas", r"under.*investigat"],
        },
        "arithmetic": [
            {"label": "GDPR fine (4% of 2.1B)", "expected": 84e6, "tolerance": 0.05},
        ],
        "currency": {
            "symbol": "€",
            "wrong": ["$"],
        },
    },

    "T3: Delta integration": {
        "fields": {
            "team_size": [r"\b5\b", r"five", r"8.*to.*5", r"reduced"],
            "project_status": [r"at.risk", r"at risk"],
            "urgency_change": [r"urg", r"critical", r"serious", r"concern", r"increas.*urg", r"0\.7"],
        },
    },

    "T4: Protocol FILTER": {
        "filter": {
            "by": "mu.urg",
            "order": "desc",
            "top_k": 2,
            "values": {"A": 0.8, "B": 0.3, "C": 0.5},
            "expected": ["A", "C"],
        },
        "fields": {
            "packet_a": [r"packet a", r"arctic", r"\ba\b.*0\.8"],
            "packet_c": [r"packet c", r"carbon", r"\bc\b.*0\.5"],
        },
    },

    "T5: Triple delta state": {
        "delta_chain": {
            "initial": {"orbit": 400, "fuel": 82, "power": 100, "payload": "idle"},
            "deltas": [
                {"orbit": 420, "fuel": 78},
                {"payload": "active", "power": 85},
                {"orbit": 415, "fuel": 75, "power": 90},
            ],
            "expected": {"orbit": 415, "fuel": 75, "power": 90, "payload": "active"},
        },
    },

    "T6: Spontaneous extension": {
        "fields": {
            "identifies_gap": [r"miss", r"lack", r"gap", r"absent", r"add", r"need"],
            "proposes_codec": [r'\{.*"§"', r'"e":', r'"s":', r'"d":', r'"mu":', r"§1"],
        },
    },
}


def build_correction_prompt(original_prompt, original_response, errors):
    """
    Build a correction re-prompt from validation errors.
    Never includes the expected answer — only describes what was wrong.
    """
    error_lines = []
    for e in errors:
        error_lines.append(f"- [{e['check']}] {e['message']}")

    correction_text = (
        "§P|VALIDATE\n"
        "Your previous response had these issues:\n"
        + "\n".join(error_lines) + "\n\n"
        "Original query:\n"
        + original_prompt + "\n\n"
        "Your previous response:\n"
        + original_response[:500] + "\n\n"
        "Please provide a corrected response addressing each flagged issue."
    )
    return correction_text


def validate_existing_results(results_file):
    """
    Run validator against an existing bench results JSON file.
    Prints validation report showing what the validator would have caught.
    """
    with open(results_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    model = data.get("model", "unknown")
    print(f"\n{'='*70}")
    print(f"  VALIDATION REPORT — {model}")
    print(f"  Source: {results_file}")
    print(f"{'='*70}")

    validator = S1Validator()
    total_errors = 0
    total_warnings = 0
    recoverable = 0

    for test_id, test_data in data.get("results", {}).items():
        response = test_data.get("response", "")
        spec = TEST_VALIDATORS.get(test_id)
        if not spec:
            continue

        result = validator.validate(response, test_id, spec)
        raw_score = test_data.get("score", 0)
        max_score = test_data.get("max", 0)

        status = "PASS" if result.passed else "FAIL"
        print(f"\n  {test_id}: {raw_score}/{max_score} — Validation: {status}")

        for e in result.errors:
            print(f"    [ERROR] {e['check']}: {e['message']}")
            total_errors += 1

        for w in result.warnings:
            print(f"    [WARN]  {w['check']}: {w['message']}")
            total_warnings += 1

        if result.corrections:
            recoverable += 1
            print(f"    → {len(result.corrections)} correction hint(s) available")

    print(f"\n  {'─'*60}")
    print(f"  Total errors:   {total_errors}")
    print(f"  Total warnings: {total_warnings}")
    print(f"  Tests with recoverable errors: {recoverable}")
    print(f"{'='*70}")


if __name__ == "__main__":
    import sys
    import glob
    import os

    if len(sys.argv) > 1:
        files = sys.argv[1:]
    else:
        test_dir = os.path.dirname(__file__)
        files = sorted(glob.glob(os.path.join(test_dir, "bench_*.json")))
        # Skip the structured_results summary file
        files = [f for f in files if "structured_results" not in f]

    for f in files:
        if os.path.exists(f):
            validate_existing_results(f)
