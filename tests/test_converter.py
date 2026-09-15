"""
Test script for BibTeX to Bibitem converter.

This script runs comprehensive regression tests against tests/bibtex_test_cases.bib
and validates that the converted output matches tests/expected_bibitems.tex exactly.
It also verifies that references.bib converts without errors.
"""

import os
import sys
import re
import difflib

# Add project root to sys.path so script.py can be imported from anywhere
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from script import load_bib_file, convert_to_bibitem


def load_expected_bibitems(tex_file):
    """
    Parse expected \\bibitem entries from a .tex file into a dict {ID: formatted_text}.
    """
    with open(tex_file, "r", encoding="utf-8") as f:
        content = f.read()

    matches = re.findall(
        r"\\bibitem\{([^}]+)\}\n(.*?)(?=\n\n\\bibitem|\Z)", content, re.DOTALL
    )
    return {k.strip(): v.strip() for k, v in matches}


def test_regression_suite():
    """
    Run full regression test comparing bibtex_test_cases.bib against expected_bibitems.tex.
    """
    print("=" * 70)
    print("RUNNING REGRESSION TEST SUITE (bibtex_test_cases.bib -> expected_bibitems.tex)")
    print("=" * 70)

    bib_file = os.path.join(TESTS_DIR, "bibtex_test_cases.bib")
    tex_file = os.path.join(TESTS_DIR, "expected_bibitems.tex")

    if not os.path.exists(bib_file) or not os.path.exists(tex_file):
        print(f"Error: Required test files '{bib_file}' or '{tex_file}' not found.")
        assert False, "Missing test files"

    expected_dict = load_expected_bibitems(tex_file)
    print(f"Loaded {len(expected_dict)} expected \\bibitem entries from {tex_file}")

    entries = load_bib_file(bib_file)
    print(f"Parsed {len(entries)} BibTeX entries from {bib_file}")
    print()

    bibitems = convert_to_bibitem(entries)

    passed = 0
    failed = 0

    for bibitem in bibitems:
        lines = bibitem.strip().split("\n", 1)
        key_match = re.match(r"^\\bibitem\{([^}]+)\}$", lines[0].strip())
        if not key_match:
            print(f"✗ Malformed bibitem header: {lines[0]}")
            failed += 1
            continue

        key = key_match.group(1)
        actual_body = lines[1].strip() if len(lines) > 1 else ""
        expected_body = expected_dict.get(key, "").strip()

        if actual_body == expected_body:
            passed += 1
            print(f"✓ {key}: PASS")
        else:
            failed += 1
            print(f"✗ {key}: FAIL")
            print("  EXPECTED:")
            print(f"    {expected_body}")
            print("  ACTUAL:")
            print(f"    {actual_body}")
            diff = difflib.ndiff([expected_body], [actual_body])
            print("  DIFF:")
            for d in diff:
                print(f"    {d}")
            print()

    print()
    print("=" * 70)
    print(f"REGRESSION SUITE RESULTS: {passed}/{len(bibitems)} passed (Failed: {failed})")
    print("=" * 70)
    print()
    assert failed == 0, f"{failed} test cases failed"


def test_references_bib():
    """
    Verify that the default references.bib converts without errors.
    """
    print("=" * 70)
    print("TESTING DEFAULT references.bib")
    print("=" * 70)

    bib_file = os.path.join(PROJECT_ROOT, "references.bib")
    if not os.path.exists(bib_file):
        print(f"Note: '{bib_file}' not present, skipping.")
        return True

    entries = load_bib_file(bib_file)
    print(f"Loaded {len(entries)} entries from {bib_file}")

    bibitems = convert_to_bibitem(entries)
    print(f"Converted {len(bibitems)} entries successfully.")

    valid_format = all(
        item.strip().startswith("\\bibitem{") and len(item.strip().split("\n")) >= 2
        for item in bibitems
    )

    if valid_format:
        print("✓ All references.bib entries produced valid \\bibitem structures.")
    else:
        print("✗ Some entries in references.bib produced invalid structures.")

    print("=" * 70)
    print()
    assert valid_format, "Invalid bibitem structures generated from references.bib"


def run_all_tests():
    """
    Run all automated test suites.
    """
    try:
        test_regression_suite()
        test_references_bib()
        print("🎉 ALL TESTS PASSED SUCCESSFULLY! CONVERTER IS 100% ACCURATE.")
        return 0
    except AssertionError as e:
        print(f"❌ TEST SUITE FAILED: {e}")
        return 1


if __name__ == "__main__":
    exit(run_all_tests())
