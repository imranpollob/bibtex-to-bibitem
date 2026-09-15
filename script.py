"""
BibTeX to Bibitem Converter - Python Implementation
Converts BibTeX entries to IEEE-style \\bibitem format for LaTeX documents.
"""

import argparse
import os
import re
import bibtexparser
from bibtexparser.bparser import BibTexParser

MONTH_MAP = {
    "jan": "Jan.", "feb": "Feb.", "mar": "Mar.", "apr": "Apr.",
    "may": "May", "jun": "Jun.", "jul": "Jul.", "aug": "Aug.",
    "sep": "Sep.", "oct": "Oct.", "nov": "Nov.", "dec": "Dec.",
    "january": "Jan.", "february": "Feb.", "march": "Mar.", "april": "Apr.",
    "june": "Jun.", "july": "Jul.", "august": "Aug.", "september": "Sep.",
    "october": "Oct.", "november": "Nov.", "december": "Dec."
}


def remove_comments(text):
    """
    Remove comments outside quotes and braces while preserving inline % in values.
    """
    lines = []
    for line in text.splitlines():
        in_quote = False
        brace_level = 0
        cleaned = []
        i = 0
        while i < len(line):
            ch = line[i]
            if ch == "\\" and i + 1 < len(line):
                cleaned.append(line[i:i + 2])
                i += 2
                continue
            if ch == "\"":
                in_quote = not in_quote
            elif ch == "{":
                brace_level += 1
            elif ch == "}":
                if brace_level > 0:
                    brace_level -= 1
            elif ch == "%":
                # Line comment if outside field value
                if not in_quote and brace_level <= 1:
                    break
            cleaned.append(ch)
            i += 1
        lines.append("".join(cleaned))
    return "\n".join(lines)


def split_respecting_braces(s, delimiter=None):
    """
    Split string by delimiter (or whitespace if None), ignoring delimiters inside braces.
    """
    tokens = []
    curr = []
    depth = 0
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c == "\\" and i + 1 < n:
            curr.append(s[i:i + 2])
            i += 2
            continue
        if c == "{":
            depth += 1
            curr.append(c)
            i += 1
            continue
        if c == "}":
            if depth > 0:
                depth -= 1
            curr.append(c)
            i += 1
            continue

        if depth == 0:
            if delimiter is None:
                if c.isspace():
                    if curr:
                        tokens.append("".join(curr))
                        curr = []
                    i += 1
                    continue
            elif s[i:i + len(delimiter)] == delimiter:
                tokens.append("".join(curr))
                curr = []
                i += len(delimiter)
                continue

        curr.append(c)
        i += 1
    if curr:
        tokens.append("".join(curr))
    return tokens


def is_fully_braced(s):
    """
    Check if a string is completely enclosed by balanced outer braces.
    """
    s = s.strip()
    if not (s.startswith("{") and s.endswith("}")):
        return False
    depth = 0
    for i, c in enumerate(s):
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and i < len(s) - 1:
                return False
    return depth == 0


def strip_outer_braces(s):
    """
    Strip outermost enclosing braces if fully enclosed.
    """
    s = s.strip()
    while is_fully_braced(s):
        s = s[1:-1].strip()
    return s


def parse_name(name_str):
    """
    Parse an individual author or editor name into IEEE format: Initial(s) Surname.
    Handles von-parts, Jr. suffixes, LaTeX accents, and corporate names.
    """
    name_str = name_str.strip()
    if not name_str:
        return ""
    if is_fully_braced(name_str):
        return strip_outer_braces(name_str)

    parts = [p.strip() for p in split_respecting_braces(name_str, delimiter=",")]

    def get_initials(first_str):
        tokens = split_respecting_braces(first_str)
        res = []
        for t in tokens:
            if not t:
                continue
            if "-" in t:
                sub_parts = t.split("-")
                sub_res = [get_initial(sp) for sp in sub_parts if sp]
                res.append(".-".join(sub_res) + ".")
            else:
                res.append(get_initial(t))
        return " ".join(res)

    def get_initial(tok):
        if not tok:
            return ""
        if tok.endswith("."):
            return tok
        if tok.startswith("{\\") or tok.startswith("\\"):
            m = re.match(r"^(\{\\[a-zA-Z0-9\'\"`^~=.]+\}|\\[\'\"`^~=.]\{?[a-zA-Z]\}?)", tok)
            if m:
                return m.group(1) + "."
        return tok[0] + "."

    if len(parts) == 1:
        tokens = split_respecting_braces(parts[0])
        if len(tokens) == 1:
            return tokens[0]

        first_tokens = []
        von_tokens = []

        i = 0
        while i < len(tokens) - 1:
            tok = tokens[i]
            clean_tok = tok.lstrip("{")
            if clean_tok and clean_tok[0].islower():
                break
            first_tokens.append(tok)
            i += 1

        while i < len(tokens) - 1:
            von_tokens.append(tokens[i])
            i += 1

        last_tokens = [tokens[-1]]

        initials_str = get_initials(" ".join(first_tokens))
        res = []
        if initials_str:
            res.append(initials_str)
        if von_tokens:
            res.append(" ".join(von_tokens))
        res.append(" ".join(last_tokens))
        return " ".join(res)
    elif len(parts) == 2:
        last_part = parts[0]
        first_part = parts[1]
        initials_str = get_initials(first_part)
        return f"{initials_str} {last_part}" if initials_str else last_part
    elif len(parts) == 3:
        last_part = parts[0]
        jr_part = parts[1]
        first_part = parts[2]
        initials_str = get_initials(first_part)
        return f"{initials_str} {last_part}, {jr_part}"
    return name_str


def format_author_list(author_str):
    """
    Format full author string according to IEEE guidelines:
    - Single author: J. Smith
    - Two authors: J. Smith and A. Brown
    - 3+ authors: J. Smith, A. Brown, and R. Wilson
    - Preserves corporate authors.
    """
    if not author_str:
        return ""
    clean = author_str.strip()
    if is_fully_braced(clean):
        return strip_outer_braces(clean)

    tokens = split_respecting_braces(clean.replace("\n", " "))
    raw_names = []
    curr_name = []
    for tok in tokens:
        if tok.lower() == "and":
            if curr_name:
                raw_names.append(" ".join(curr_name))
                curr_name = []
        else:
            curr_name.append(tok)
    if curr_name:
        raw_names.append(" ".join(curr_name))

    names = [parse_name(n) for n in raw_names if n.strip()]
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    elif len(names) == 2:
        return f"{names[0]} and {names[1]}"
    else:
        return ", ".join(names[:-1]) + f", and {names[-1]}"


def format_editor_list(editor_str):
    """
    Format editor list with ', Ed.' or ', Eds.' suffix.
    """
    if not editor_str:
        return ""
    clean = editor_str.strip()
    tokens = split_respecting_braces(clean.replace("\n", " "))
    raw_names = []
    curr_name = []
    for tok in tokens:
        if tok.lower() == "and":
            if curr_name:
                raw_names.append(" ".join(curr_name))
                curr_name = []
        else:
            curr_name.append(tok)
    if curr_name:
        raw_names.append(" ".join(curr_name))

    names = [parse_name(n) for n in raw_names if n.strip()]
    if not names:
        return ""
    suffix = ", Eds." if len(names) > 1 else ", Ed."
    if len(names) == 1:
        return names[0] + suffix
    elif len(names) == 2:
        return f"{names[0]} and {names[1]}{suffix}"
    else:
        return ", ".join(names[:-1]) + f", and {names[-1]}{suffix}"


def to_sentence_case(title_raw):
    """
    Apply sentence casing while strictly preserving:
    - Protected words inside {...}
    - Internal mixed case (e.g. arXiv)
    - Punctuation boundaries (colon, question mark, period)
    - LaTeX escapes and symbols (e.g. A\\_B)
    """
    s = strip_outer_braces(re.sub(r"\s+", " ", title_raw))
    s = s.replace("``", "`").replace("''", "'")

    tokens = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] == "{":
            depth = 1
            j = i + 1
            while j < n and depth > 0:
                if s[j] == "{":
                    depth += 1
                elif s[j] == "}":
                    depth -= 1
                j += 1
            protected_content = s[i + 1:j - 1]
            if protected_content.startswith("\\") and len(protected_content.split()) <= 2:
                tokens.append({"type": "accent_cmd", "val": f"{{{protected_content}}}"})
            else:
                clean_protected = protected_content.replace("{", "").replace("}", "")
                tokens.append({"type": "protected", "val": clean_protected})
            i = j
        elif s[i] == "\\" and i + 1 < n:
            if s[i + 1] == "c" and i + 4 < n and s[i + 2:i + 5] == "{c}":
                tokens.append({"type": "accent_cmd", "val": "\\c{c}"})
                i += 5
            elif s[i + 1] in ("'", "`", "^", "~", '"', "=", "."):
                cmd = s[i:i + 2]
                i += 2
                if i < n and s[i] == "{":
                    j = s.find("}", i)
                    if j != -1:
                        cmd += s[i:j + 1]
                        i = j + 1
                tokens.append({"type": "accent_cmd", "val": cmd})
            elif s[i + 1] in ("&", "%", "$", "#"):
                tokens.append({"type": "latex", "val": s[i:i + 2]})
                i += 2
            elif s[i + 1] == "_":
                tokens.append({"type": "escaped_underscore", "val": "\\_"})
                i += 2
            else:
                tokens.append({"type": "latex", "val": s[i:i + 2]})
                i += 2
        elif s[i].isspace():
            j = i
            while j < n and s[j].isspace():
                j += 1
            tokens.append({"type": "space", "val": s[i:j]})
            i = j
        elif s[i] in ":.?!-":
            tokens.append({"type": "punct", "val": s[i]})
            i += 1
        elif s[i] in "()[]\"'`/,":
            tokens.append({"type": "symbol", "val": s[i]})
            i += 1
        else:
            j = i
            while j < n and not s[j].isspace() and s[j] not in "{}\\:.?!-()[]\"'`/,":
                j += 1
            tokens.append({"type": "word", "val": s[i:j]})
            i = j

    new_sentence = True
    result_parts = []

    for idx, tok in enumerate(tokens):
        t_type = tok["type"]
        val = tok["val"]

        if t_type == "space":
            result_parts.append(val)
        elif t_type == "punct":
            result_parts.append(val)
            if val in (":", "?", "!", "."):
                new_sentence = True
        elif t_type in ("symbol", "latex", "escaped_underscore", "accent_cmd"):
            result_parts.append(val)
        elif t_type == "protected":
            result_parts.append(val)
            new_sentence = False
        elif t_type == "word":
            prev_tok = tokens[idx - 1] if idx > 0 else None
            next_tok = tokens[idx + 1] if idx + 1 < len(tokens) else None
            is_near_underscore = (prev_tok and prev_tok["type"] == "escaped_underscore") or \
                                 (next_tok and next_tok["type"] == "escaped_underscore")

            has_internal_upper = any(c.isupper() for c in val[1:])

            if is_near_underscore:
                result_parts.append(val)
                new_sentence = False
            elif new_sentence:
                if not has_internal_upper:
                    val = val[0].upper() + val[1:].lower()
                new_sentence = False
                result_parts.append(val)
            else:
                if not has_internal_upper:
                    val = val.lower()
                result_parts.append(val)

    return "".join(result_parts)


def format_title_case(title_raw):
    """
    Format title for books/proceedings/manuals: preserves title casing and strips grouping braces.
    """
    s = strip_outer_braces(re.sub(r"\s+", " ", title_raw))
    s = s.replace("``", "`").replace("''", "'")
    s = re.sub(r"\{([^}]+)\}", r"\1", s)
    return s


def normalize_doi(doi):
    """
    Normalize DOI string to bare DOI identifier.
    """
    if not doi:
        return ""
    doi = doi.strip()
    doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi)
    doi = re.sub(r"^doi:\s*", "", doi)
    return doi.strip()


def format_edition(edition):
    """
    Format edition string (e.g. '2' -> '2nd ed.', '7th' -> '7th ed.').
    """
    if not edition:
        return ""
    edition = edition.strip()
    if edition.isdigit():
        num = int(edition)
        if 11 <= (num % 100) <= 13:
            suf = "th"
        else:
            suf = {1: "st", 2: "nd", 3: "rd"}.get(num % 10, "th")
        edition = f"{num}{suf}"
    if not edition.endswith("ed.") and not edition.endswith("ed"):
        return f"{edition} ed."
    elif edition.endswith("ed"):
        return f"{edition}."
    return edition


def format_date(date_str):
    """
    Format YYYY-MM-DD date to 'Mon. DD, YYYY'.
    """
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", date_str.strip())
    if m:
        y, mo, d = m.groups()
        mo_names = {
            "01": "Jan.", "02": "Feb.", "03": "Mar.", "04": "Apr.",
            "05": "May", "06": "Jun.", "07": "Jul.", "08": "Aug.",
            "09": "Sep.", "10": "Oct.", "11": "Nov.", "12": "Dec."
        }
        return f"{mo_names.get(mo, mo)} {int(d)}, {y}"
    return date_str


def format_month(month_str):
    """
    Format month name or macro to standard abbreviation.
    """
    if not month_str:
        return ""
    clean = month_str.strip().lower()
    return MONTH_MAP.get(clean, month_str.strip())


def convert_single_entry(entry):
    """
    Convert a single parsed BibTeX entry dictionary into a formatted \\bibitem string.
    """
    etype = entry.get("ENTRYTYPE", "").lower()
    eid = entry.get("ID", "")

    author_raw = entry.get("author", "").strip()
    editor_raw = entry.get("editor", "").strip()
    org_raw = entry.get("organization", "").strip()

    creator = ""
    if author_raw:
        creator = format_author_list(author_raw)
    elif editor_raw and etype in ("book", "proceedings"):
        creator = format_editor_list(editor_raw)
    elif org_raw and etype in ("misc", "online"):
        creator = strip_outer_braces(org_raw)

    raw_title = entry.get("title", "").strip()
    if etype in ("book", "proceedings", "manual", "software"):
        title_formatted = format_title_case(raw_title)
    else:
        title_formatted = to_sentence_case(raw_title)

    year = entry.get("year", "").strip()
    date_val = entry.get("date", "").strip()
    month = format_month(entry.get("month", ""))

    date_formatted = ""
    if date_val:
        date_formatted = format_date(date_val)
    elif month and year:
        date_formatted = f"{month} {year}"
    elif year:
        date_formatted = year

    doi = normalize_doi(entry.get("doi", ""))
    url = entry.get("url", "").strip()
    howpublished = entry.get("howpublished", "").strip()
    note = entry.get("note", "").strip()
    urldate = entry.get("urldate", "").strip()

    include_url = False
    url_target = ""
    if not doi:
        if url:
            include_url = True
            url_target = url
        elif howpublished and "\\url{" in howpublished:
            m = re.search(r"\\url\{([^}]+)\}", howpublished)
            if m:
                include_url = True
                url_target = m.group(1)

    online_suffix = ""
    if include_url:
        online_suffix = f" [Online]. Available: \\url{{{url_target}}}."
        if urldate:
            m_ud = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", urldate)
            if m_ud:
                y_u, mo_u, d_u = m_ud.groups()
                mo_u_name = {
                    "01": "Jan.", "02": "Feb.", "03": "Mar.", "04": "Apr.",
                    "05": "May", "06": "Jun.", "07": "Jul.", "08": "Aug.",
                    "09": "Sep.", "10": "Oct.", "11": "Nov.", "12": "Dec."
                }.get(mo_u, mo_u)
                online_suffix += f" Accessed: {mo_u_name} {int(d_u)}, {y_u}."
        elif note and "Accessed:" in note:
            online_suffix += f" {note}."

    body = ""

    if etype == "article":
        journal = format_title_case(entry.get("journal", ""))
        volume = entry.get("volume", "").strip()
        number = entry.get("number", "").strip()
        pages = entry.get("pages", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"\\emph{{{journal}}}"

        if volume:
            body += f", vol. {volume}"
        if number:
            body += f", no. {number}"
        if pages:
            body += f", pp. {pages}"
        if date_formatted:
            body += f", {date_formatted}"

        if doi:
            body += f", doi: {doi}."
        elif online_suffix:
            body += f".{online_suffix}"
        else:
            body += "."

    elif etype in ("inproceedings", "conference"):
        booktitle = format_title_case(entry.get("booktitle", ""))
        address = entry.get("address", "").strip()
        pages = entry.get("pages", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"in \\emph{{{booktitle}}}"

        if address:
            body += f", {address}"
        if date_formatted:
            body += f", {date_formatted}"
        if pages:
            body += f", pp. {pages}"
        if doi:
            body += f", doi: {doi}."
        elif online_suffix:
            body += f".{online_suffix}"
        else:
            body += "."

    elif etype == "book":
        edition = format_edition(entry.get("edition", ""))
        publisher = entry.get("publisher", "").strip()
        address = entry.get("address", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"\\emph{{{title_formatted}}}"
        if edition:
            body += f", {edition}"

        pub_part = ""
        if address and publisher:
            pub_part = f"{address}: {publisher}"
        elif publisher:
            pub_part = publisher

        if pub_part:
            if body.endswith("."):
                body += f" {pub_part}"
            else:
                body += f". {pub_part}"
        if date_formatted:
            if pub_part:
                body += f", {date_formatted}."
            else:
                if body.endswith("."):
                    body += f" {date_formatted}."
                else:
                    body += f". {date_formatted}."
        else:
            if not body.endswith("."):
                body += "."

    elif etype == "incollection":
        booktitle = format_title_case(entry.get("booktitle", ""))
        editor = format_editor_list(entry.get("editor", ""))
        address = entry.get("address", "").strip()
        publisher = entry.get("publisher", "").strip()
        pages = entry.get("pages", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"in \\emph{{{booktitle}}}"
        if editor:
            body += f", {editor}"

        pub_part = ""
        if address and publisher:
            pub_part = f"{address}: {publisher}"
        elif publisher:
            pub_part = publisher

        if pub_part:
            if body.endswith("."):
                body += f" {pub_part}"
            else:
                body += f". {pub_part}"
        if date_formatted:
            body += f", {date_formatted}"
        if pages:
            body += f", pp. {pages}"
        body += "."

    elif etype == "phdthesis":
        school = entry.get("school", "").strip()
        address = entry.get("address", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"Ph.D. dissertation, {school}"
        if address:
            body += f", {address}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."

    elif etype == "mastersthesis":
        school = entry.get("school", "").strip()
        address = entry.get("address", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"Master's thesis, {school}"
        if address:
            body += f", {address}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."

    elif etype == "techreport":
        inst = entry.get("institution", "").strip()
        address = entry.get("address", "").strip()
        number = entry.get("number", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"{inst}"
        if address:
            body += f", {address}"
        if number:
            body += f", Tech. Rep. {number}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."

    elif etype == "proceedings":
        address = entry.get("address", "").strip()
        org = entry.get("organization", "").strip()
        pub = entry.get("publisher", "").strip()

        body += f"\\emph{{{title_formatted}}}."
        loc_org = ""
        if address and (org or pub):
            loc_org = f"{address}: {org or pub}"
        elif org or pub:
            loc_org = f"{org or pub}"

        if loc_org:
            body += f" {loc_org}"
        if date_formatted:
            if loc_org:
                body += f", {date_formatted}."
            else:
                body += f" {date_formatted}."
        else:
            body += "."

    elif etype == "manual":
        org = entry.get("organization", "").strip()

        if creator:
            body += f"{creator}, "
        body += f"\\emph{{{title_formatted}}}."
        if org:
            body += f" {org}"
        if date_formatted:
            if org:
                body += f", {date_formatted}."
            else:
                body += f" {date_formatted}."
        else:
            body += "."
        if online_suffix:
            body += online_suffix

    elif etype == "unpublished":
        note_str = note
        if note_str:
            note_str = note_str[0].lower() + note_str[1:]
        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        if note_str:
            body += f"{note_str}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."

    elif etype == "software":
        version = entry.get("version", "").strip()
        if creator:
            body += f"{creator}, "
        body += f"\\emph{{{title_formatted}}}"
        if version:
            body += f", version {version}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."
        if online_suffix:
            body += online_suffix

    elif etype == "dataset":
        publisher = entry.get("publisher", "").strip()
        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        if publisher:
            body += f"{publisher}"
        if date_formatted:
            body += f", {date_formatted}"
        if doi:
            body += f", doi: {doi}."
        elif online_suffix:
            body += f".{online_suffix}"
        else:
            body += "."

    elif etype == "patent":
        number = entry.get("number", "").strip()
        if creator:
            body += f"{creator}, "
        body += f"``{title_formatted},'' "
        body += f"U.S. Patent {number}"
        if date_formatted:
            body += f", {date_formatted}."
        else:
            body += "."

    else:
        eprint = entry.get("eprint", "").strip()

        if "Patent" in howpublished:
            if creator:
                body += f"{creator}, "
            body += f"``{title_formatted},'' "
            body += f"{howpublished}"
            if date_formatted:
                body += f", {date_formatted}."
            else:
                body += "."
        elif eprint:
            if creator:
                body += f"{creator}, "
            body += f"``{title_formatted},'' "
            body += f"arXiv:{eprint}"
            if date_formatted:
                body += f", {date_formatted}."
            else:
                body += "."
        else:
            if creator:
                body += f"{creator}, "

            if not date_formatted and online_suffix:
                body += f"``{title_formatted}.''"
            else:
                body += f"``{title_formatted},'' "
                if date_formatted:
                    body += f"{date_formatted}."

            if online_suffix:
                body += online_suffix

    return f"\\bibitem{{{eid}}}\n{body.strip()}"


def load_bib_file(file_path):
    """
    Load and parse a .bib file, resolving comments, strings, and cross-references.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    cleaned_text = remove_comments(text)
    parser = BibTexParser(common_strings=True, ignore_nonstandard_types=False)
    bib_database = bibtexparser.loads(cleaned_text, parser=parser)

    # Cross-reference resolution
    entries_by_id = {e["ID"]: e for e in bib_database.entries if "ID" in e}
    for e in bib_database.entries:
        if "crossref" in e:
            parent = entries_by_id.get(e["crossref"])
            if parent:
                if "booktitle" not in e and "title" in parent:
                    e["booktitle"] = parent["title"]
                for k, v in parent.items():
                    if k not in e and k not in ("ID", "ENTRYTYPE"):
                        e[k] = v

    return bib_database.entries


def convert_to_bibitem(entries):
    """
    Convert a list of parsed BibTeX entries to \\bibitem formatted strings.
    """
    bibitems = []
    seen_ids = set()
    for entry in entries:
        entry_id = entry.get("ID")
        if not entry_id or entry_id in seen_ids:
            continue
        seen_ids.add(entry_id)
        bibitem = convert_single_entry(entry)
        bibitems.append(bibitem)
    return bibitems


def save_to_file(bibitems, output_file):
    """
    Save converted \\bibitem entries to file, separated by blank lines.
    """
    with open(output_file, "w", encoding="utf-8") as f:
        f.write("\n\n".join(bibitems) + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert BibTeX entries to \\bibitem format.")
    parser.add_argument("--input", "-i", default="references.bib", help="Path to input .bib file")
    parser.add_argument("--output", "-o", default="bibitems.txt", help="Path to output .txt file")

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Error: Input file '{args.input}' not found.")
        exit(1)

    entries = load_bib_file(args.input)
    bibitems = convert_to_bibitem(entries)
    save_to_file(bibitems, args.output)
    print(f"Conversion complete. Converted {len(bibitems)} entries. Check output: {args.output}")
