/**
 * BibTeX to Bibitem Converter - JavaScript Implementation
 * Ported from the Python script for web usage with IEEE-style bibliography formatting.
 * Designed & Maintained by Imran Pollob
 */

// Month Abbreviations Map
const MONTH_MAP = {
  jan: 'Jan.', feb: 'Feb.', mar: 'Mar.', apr: 'Apr.',
  may: 'May', jun: 'Jun.', jul: 'Jul.', aug: 'Aug.',
  sep: 'Sep.', oct: 'Oct.', nov: 'Nov.', dec: 'Dec.',
  january: 'Jan.', february: 'Feb.', march: 'Mar.', april: 'Apr.',
  june: 'Jun.', july: 'Jul.', august: 'Aug.', september: 'Sep.',
  october: 'Oct.', november: 'Nov.', december: 'Dec.'
};

// Preset Sample Entries
const SAMPLES = {
  article: `@article{vaswani2017attention,
  author  = {Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N. and Kaiser, \\Lukasz and Polosukhin, Illia},
  title   = {Attention Is All You Need},
  journal = {Advances in Neural Information Processing Systems},
  volume  = {30},
  pages   = {5998--6008},
  year    = {2017},
  doi     = {10.5555/3295222.3295349}
}`,

  conference: `@inproceedings{lee2024detecting,
  author    = {Michael Lee and Robert Jones and Sarah Ahmed},
  title     = {Detecting Vulnerabilities in Smart Contracts},
  booktitle = {Proceedings of the IEEE Symposium on Security and Privacy},
  pages     = {120--134},
  month     = may,
  year      = {2024},
  address   = {San Francisco, CA, USA},
  doi       = {10.1109/SP.2024.1234567}
}`,

  book: `@book{goodfellow2016deep,
  author    = {Goodfellow, Ian and Bengio, Yoshua and Courville, Aaron},
  title     = {Deep Learning},
  edition   = {1},
  publisher = {MIT Press},
  address   = {Cambridge, MA, USA},
  year      = {2016}
}`,

  suite: `@article{t01_basic_article,
  author  = {John Smith and Alice Brown},
  title   = {Security Analysis of Blockchain Systems},
  journal = {IEEE Transactions on Dependable and Secure Computing},
  volume  = {22},
  number  = {3},
  pages   = {421--435},
  year    = {2025}
}

@inproceedings{t02_conference,
  author    = {Michael Lee and Robert Jones and Sarah Ahmed},
  title     = {Detecting Vulnerabilities in Smart Contracts},
  booktitle = {Proceedings of the IEEE Symposium on Security and Privacy},
  pages     = {120--134},
  year      = {2024}
}

@book{t05_book,
  author    = {William Stallings},
  title     = {Cryptography and Network Security},
  edition   = {7th},
  publisher = {Pearson},
  address   = {Boston, MA, USA},
  year      = {2017}
}

@phdthesis{t08_phd,
  author  = {Jane Doe},
  title   = {Security and Privacy in Decentralized Systems},
  school  = {Wayne State University},
  address = {Detroit, MI, USA},
  year    = {2024}
}

@misc{t11_misc_url,
  author       = {{Ethereum Foundation}},
  title        = {{ERC-4337}: Account Abstraction Using Alt Mempool},
  howpublished = {\\url{https://eips.ethereum.org/EIPS/eip-4337}},
  year         = {2023},
  note         = {Accessed: Sep. 15, 2026}
}

@misc{t14_arxiv_misc,
  author        = {Li Wang and Peter Smith},
  title         = {Security Analysis of Programmable Accounts},
  year          = {2026},
  eprint        = {2604.01234},
  archivePrefix = {arXiv},
  primaryClass  = {cs.CR}
}`
};

/**
 * Remove comments outside quotes and braces while preserving inline % in values.
 */
function removeComments(text) {
  const lines = text.split(/\r?\n/);
  const cleanedLines = [];
  for (const line of lines) {
    let inQuote = false;
    let braceLevel = 0;
    let cleaned = '';
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      if (ch === '\\' && i + 1 < line.length) {
        cleaned += line.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === '{') {
        braceLevel++;
      } else if (ch === '}') {
        if (braceLevel > 0) braceLevel--;
      } else if (ch === '%') {
        if (!inQuote && braceLevel <= 1) {
          break;
        }
      }
      cleaned += ch;
      i++;
    }
    cleanedLines.push(cleaned);
  }
  return cleanedLines.join('\n');
}

/**
 * Count BibTeX entries in text.
 */
function countBibTeXEntries(text) {
  const matches = text.match(/@\w+\s*\{/g);
  return matches ? matches.length : 0;
}

/**
 * Parse BibTeX text into entries with string macros and cross-reference resolution.
 */
function parseBibTeX(text) {
  const cleaned = removeComments(text);
  const strings = { ...MONTH_MAP };
  const entries = [];
  let i = 0;
  const n = cleaned.length;

  while (i < n) {
    const atIdx = cleaned.indexOf('@', i);
    if (atIdx === -1) break;

    const match = cleaned.slice(atIdx).match(/^@([a-zA-Z0-9_-]+)\s*\{/);
    if (!match) {
      i = atIdx + 1;
      continue;
    }

    const type = match[1].toLowerCase();
    const braceStart = atIdx + match[0].length - 1;

    let braceCount = 1;
    let pos = braceStart + 1;
    while (pos < n && braceCount > 0) {
      if (cleaned[pos] === '\\' && pos + 1 < n) {
        pos += 2;
        continue;
      }
      if (cleaned[pos] === '{') braceCount++;
      else if (cleaned[pos] === '}') braceCount--;
      pos++;
    }

    if (braceCount !== 0) {
      i = atIdx + 1;
      continue;
    }

    const content = cleaned.slice(braceStart + 1, pos - 1);
    i = pos;

    if (type === 'comment') {
      continue;
    }

    if (type === 'string') {
      const eqIdx = content.indexOf('=');
      if (eqIdx !== -1) {
        const sKey = content.slice(0, eqIdx).trim().toLowerCase();
        let sVal = content.slice(eqIdx + 1).trim();
        if ((sVal.startsWith('"') && sVal.endsWith('"')) || (sVal.startsWith('{') && sVal.endsWith('}'))) {
          sVal = sVal.slice(1, -1);
        }
        strings[sKey] = sVal;
      }
      continue;
    }

    const commaIdx = content.indexOf(',');
    if (commaIdx === -1) continue;

    const id = content.slice(0, commaIdx).trim();
    const fieldsText = content.slice(commaIdx + 1);

    const fields = parseFields(fieldsText, strings);
    entries.push({
      ENTRYTYPE: type,
      ID: id,
      ...fields
    });
  }

  // Resolve cross-references
  const entriesById = {};
  for (const e of entries) {
    entriesById[e.ID] = e;
  }
  for (const e of entries) {
    if (e.crossref && entriesById[e.crossref]) {
      const parent = entriesById[e.crossref];
      if (!e.booktitle && parent.title) {
        e.booktitle = parent.title;
      }
      for (const [k, v] of Object.entries(parent)) {
        if (!e[k] && k !== 'ID' && k !== 'ENTRYTYPE') {
          e[k] = v;
        }
      }
    }
  }

  return entries;
}

/**
 * Parse fields from BibTeX entry text supporting braces, quotes, bare numbers, and # concat.
 */
function parseFields(fieldsText, strings) {
  const fields = {};
  let i = 0;
  const n = fieldsText.length;

  while (i < n) {
    while (i < n && /[\s,]/.test(fieldsText[i])) i++;
    if (i >= n) break;

    const nameMatch = fieldsText.slice(i).match(/^([a-zA-Z0-9_-]+)\s*=/);
    if (!nameMatch) break;

    const fieldName = nameMatch[1].toLowerCase();
    i += nameMatch[0].length;

    while (i < n && /\s/.test(fieldsText[i])) i++;
    if (i >= n) break;

    const valParts = [];
    while (i < n) {
      while (i < n && /\s/.test(fieldsText[i])) i++;
      if (i >= n) break;

      if (fieldsText[i] === '{') {
        let depth = 1;
        i++;
        const start = i;
        while (i < n && depth > 0) {
          if (fieldsText[i] === '\\' && i + 1 < n) {
            i += 2;
            continue;
          }
          if (fieldsText[i] === '{') depth++;
          else if (fieldsText[i] === '}') depth--;
          if (depth > 0) i++;
        }
        valParts.push(fieldsText.slice(start, i));
        i++;
      } else if (fieldsText[i] === '"') {
        i++;
        let val = '';
        while (i < n) {
          if (fieldsText[i] === '\\' && i + 1 < n) {
            val += fieldsText.slice(i, i + 2);
            i += 2;
            continue;
          }
          if (fieldsText[i] === '"') {
            i++;
            break;
          }
          val += fieldsText[i];
          i++;
        }
        valParts.push(val);
      } else {
        const start = i;
        while (i < n && !/[\s,#,]/.test(fieldsText[i])) {
          i++;
        }
        const tok = fieldsText.slice(start, i).trim();
        if (tok) {
          const lowerTok = tok.toLowerCase();
          if (strings[lowerTok] !== undefined) {
            valParts.push(strings[lowerTok]);
          } else {
            valParts.push(tok);
          }
        }
      }

      while (i < n && /\s/.test(fieldsText[i])) i++;
      if (i < n && fieldsText[i] === '#') {
        i++;
        continue;
      } else {
        break;
      }
    }

    fields[fieldName] = valParts.join('');

    while (i < n && fieldsText[i] !== ',') {
      i++;
    }
    if (i < n && fieldsText[i] === ',') i++;
  }

  return fields;
}

/**
 * Split string by delimiter ignoring delimiters inside braces.
 */
function splitRespectingBraces(s, delimiter = null) {
  const tokens = [];
  let curr = '';
  let depth = 0;
  let i = 0;
  const n = s.length;

  while (i < n) {
    const c = s[i];
    if (c === '\\' && i + 1 < n) {
      curr += s.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (c === '{') {
      depth++;
      curr += c;
      i++;
      continue;
    }
    if (c === '}') {
      if (depth > 0) depth--;
      curr += c;
      i++;
      continue;
    }

    if (depth === 0) {
      if (delimiter === null) {
        if (/\s/.test(c)) {
          if (curr.length > 0) {
            tokens.push(curr);
            curr = '';
          }
          i++;
          continue;
        }
      } else if (s.slice(i, i + delimiter.length) === delimiter) {
        tokens.push(curr);
        curr = '';
        i += delimiter.length;
        continue;
      }
    }

    curr += c;
    i++;
  }

  if (curr.length > 0) {
    tokens.push(curr);
  }
  return tokens;
}

/**
 * Check if a string is completely enclosed by balanced outer braces.
 */
function isFullyBraced(s) {
  s = s.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return false;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') {
      depth--;
      if (depth === 0 && i < s.length - 1) return false;
    }
  }
  return depth === 0;
}

/**
 * Strip outer enclosing braces.
 */
function stripOuterBraces(s) {
  s = s.trim();
  while (isFullyBraced(s)) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Parse an author or editor name into IEEE format: Initial(s) Surname.
 */
function parseName(nameStr) {
  nameStr = nameStr.trim();
  if (!nameStr) return '';
  if (isFullyBraced(nameStr)) {
    return stripOuterBraces(nameStr);
  }

  const parts = splitRespectingBraces(nameStr, ',').map(p => p.trim());

  function getInitials(firstStr) {
    const tokens = splitRespectingBraces(firstStr);
    const res = [];
    for (const t of tokens) {
      if (!t) continue;
      if (t.includes('-')) {
        const subParts = t.split('-');
        const subRes = subParts.filter(Boolean).map(getInitial);
        res.push(subRes.join('.-') + '.');
      } else {
        res.push(getInitial(t));
      }
    }
    return res.join(' ');
  }

  function getInitial(tok) {
    if (!tok) return '';
    if (tok.endsWith('.')) return tok;
    if (tok.startsWith('{\\') || tok.startsWith('\\')) {
      const m = tok.match(/^(\{\\[a-zA-Z0-9'"^~=.]+\}|\\['"^~=.]\{?[a-zA-Z]\}?)/);
      if (m) return m[1] + '.';
    }
    return tok[0] + '.';
  }

  if (parts.length === 1) {
    const tokens = splitRespectingBraces(parts[0]);
    if (tokens.length === 1) return tokens[0];

    const firstTokens = [];
    const vonTokens = [];
    let i = 0;

    while (i < tokens.length - 1) {
      const tok = tokens[i];
      const cleanTok = tok.replace(/^\{+/, '');
      if (cleanTok && /^[a-z]/.test(cleanTok)) {
        break;
      }
      firstTokens.push(tok);
      i++;
    }

    while (i < tokens.length - 1) {
      vonTokens.push(tokens[i]);
      i++;
    }

    const lastTokens = [tokens[tokens.length - 1]];
    const initialsStr = getInitials(firstTokens.join(' '));
    const res = [];
    if (initialsStr) res.push(initialsStr);
    if (vonTokens.length > 0) res.push(vonTokens.join(' '));
    res.push(lastTokens.join(' '));
    return res.join(' ');
  } else if (parts.length === 2) {
    const lastPart = parts[0];
    const firstPart = parts[1];
    const initialsStr = getInitials(firstPart);
    return initialsStr ? `${initialsStr} ${lastPart}` : lastPart;
  } else if (parts.length === 3) {
    const lastPart = parts[0];
    const jrPart = parts[1];
    const firstPart = parts[2];
    const initialsStr = getInitials(firstPart);
    return initialsStr ? `${initialsStr} ${lastPart}, ${jrPart}` : `${lastPart}, ${jrPart}`;
  }
  return nameStr;
}

/**
 * Format author list according to IEEE guidelines.
 */
function formatAuthorList(authorStr) {
  if (!authorStr) return '';
  const clean = authorStr.trim();
  if (isFullyBraced(clean)) {
    return stripOuterBraces(clean);
  }

  const tokens = splitRespectingBraces(clean.replace(/\n/g, ' '));
  const rawNames = [];
  let currName = [];
  for (const tok of tokens) {
    if (tok.toLowerCase() === 'and') {
      if (currName.length > 0) {
        rawNames.push(currName.join(' '));
        currName = [];
      }
    } else {
      currName.push(tok);
    }
  }
  if (currName.length > 0) {
    rawNames.push(currName.join(' '));
  }

  const names = rawNames.map(n => parseName(n)).filter(Boolean);
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/**
 * Format editor list with ', Ed.' or ', Eds.' suffix.
 */
function formatEditorList(editorStr) {
  if (!editorStr) return '';
  const clean = editorStr.trim();
  const tokens = splitRespectingBraces(clean.replace(/\n/g, ' '));
  const rawNames = [];
  let currName = [];
  for (const tok of tokens) {
    if (tok.toLowerCase() === 'and') {
      if (currName.length > 0) {
        rawNames.push(currName.join(' '));
        currName = [];
      }
    } else {
      currName.push(tok);
    }
  }
  if (currName.length > 0) {
    rawNames.push(currName.join(' '));
  }

  const names = rawNames.map(n => parseName(n)).filter(Boolean);
  if (names.length === 0) return '';
  const suffix = names.length > 1 ? ', Eds.' : ', Ed.';
  if (names.length === 1) return names[0] + suffix;
  if (names.length === 2) return `${names[0]} and ${names[1]}${suffix}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}${suffix}`;
}

/**
 * Sentence case transformation preserving protected capitalization and LaTeX commands.
 */
function toSentenceCase(titleRaw) {
  let s = stripOuterBraces(titleRaw.replace(/\s+/g, ' '));
  s = s.replace(/``/g, '`').replace(/''/g, "'");

  const tokens = [];
  let i = 0;
  const n = s.length;

  while (i < n) {
    if (s[i] === '{') {
      let depth = 1;
      let j = i + 1;
      while (j < n && depth > 0) {
        if (s[j] === '{') depth++;
        else if (s[j] === '}') depth--;
        j++;
      }
      const protectedContent = s.slice(i + 1, j - 1);
      if (protectedContent.startsWith('\\') && protectedContent.split(/\s+/).length <= 2) {
        tokens.push({ type: 'accent_cmd', val: `{${protectedContent}}` });
      } else {
        const cleanProtected = protectedContent.replace(/[{}]/g, '');
        tokens.push({ type: 'protected', val: cleanProtected });
      }
      i = j;
    } else if (s[i] === '\\' && i + 1 < n) {
      if (s[i + 1] === 'c' && i + 4 < n && s.slice(i + 2, i + 5) === '{c}') {
        tokens.push({ type: 'accent_cmd', val: '\\c{c}' });
        i += 5;
      } else if ("'`^~\"=.".includes(s[i + 1])) {
        let cmd = s.slice(i, i + 2);
        i += 2;
        if (i < n && s[i] === '{') {
          const j = s.indexOf('}', i);
          if (j !== -1) {
            cmd += s.slice(i, j + 1);
            i = j + 1;
          }
        }
        tokens.push({ type: 'accent_cmd', val: cmd });
      } else if ('&%$#'.includes(s[i + 1])) {
        tokens.push({ type: 'latex', val: s.slice(i, i + 2) });
        i += 2;
      } else if (s[i + 1] === '_') {
        tokens.push({ type: 'escaped_underscore', val: '\\_' });
        i += 2;
      } else {
        tokens.push({ type: 'latex', val: s.slice(i, i + 2) });
        i += 2;
      }
    } else if (/\s/.test(s[i])) {
      let j = i;
      while (j < n && /\s/.test(s[j])) j++;
      tokens.push({ type: 'space', val: s.slice(i, j) });
      i = j;
    } else if (':.?!-'.includes(s[i])) {
      tokens.push({ type: 'punct', val: s[i] });
      i++;
    } else if ('()[]"\'`/,'.includes(s[i])) {
      tokens.push({ type: 'symbol', val: s[i] });
      i++;
    } else {
      let j = i;
      while (j < n && !/\s/.test(s[j]) && !'{}\\:.?!-()[]"\'`/,'.includes(s[j])) {
        j++;
      }
      tokens.push({ type: 'word', val: s.slice(i, j) });
      i = j;
    }
  }

  let newSentence = true;
  const resultParts = [];

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx];
    const val = tok.val;

    if (tok.type === 'space') {
      resultParts.push(val);
    } else if (tok.type === 'punct') {
      resultParts.push(val);
      if (':.?!'.includes(val)) {
        newSentence = true;
      }
    } else if (tok.type === 'symbol' || tok.type === 'latex' || tok.type === 'escaped_underscore' || tok.type === 'accent_cmd') {
      resultParts.push(val);
    } else if (tok.type === 'protected') {
      resultParts.push(val);
      newSentence = false;
    } else if (tok.type === 'word') {
      const prevTok = idx > 0 ? tokens[idx - 1] : null;
      const nextTok = idx + 1 < tokens.length ? tokens[idx + 1] : null;
      const isNearUnderscore = (prevTok && prevTok.type === 'escaped_underscore') ||
        (nextTok && nextTok.type === 'escaped_underscore');
      (nextTok && nextTok.type === 'escaped_underscore');

      const hasInternalUpper = /[A-Z]/.test(val.slice(1));

      if (isNearUnderscore) {
        resultParts.push(val);
        newSentence = false;
      } else if (newSentence) {
        let transformed = val;
        if (!hasInternalUpper && val.length > 0) {
          transformed = val[0].toUpperCase() + val.slice(1).toLowerCase();
        }
        newSentence = false;
        resultParts.push(transformed);
      } else {
        let transformed = val;
        if (!hasInternalUpper) {
          transformed = val.toLowerCase();
        }
        resultParts.push(transformed);
      }
    }
  }

  return resultParts.join('');
}

/**
 * Title case format for books, manuals, proceedings, software.
 */
function formatTitleCase(titleRaw) {
  let s = stripOuterBraces(titleRaw.replace(/\s+/g, ' '));
  s = s.replace(/``/g, '`').replace(/''/g, "'");
  s = s.replace(/\{([^}]+)\}/g, '$1');
  return s;
}

/**
 * Normalize DOI identifier.
 */
function normalizeDoi(doi) {
  if (!doi) return '';
  doi = doi.trim();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
  doi = doi.replace(/^doi:\s*/, '');
  return doi.trim();
}

/**
 * Format edition string.
 */
function formatEdition(edition) {
  if (!edition) return '';
  edition = edition.trim();
  if (/^\d+$/.test(edition)) {
    const num = parseInt(edition, 10);
    let suf = 'th';
    const mod100 = num % 100;
    if (mod100 < 11 || mod100 > 13) {
      const mod10 = num % 10;
      if (mod10 === 1) suf = 'st';
      else if (mod10 === 2) suf = 'nd';
      else if (mod10 === 3) suf = 'rd';
    }
    edition = `${num}${suf}`;
  }
  if (!edition.endsWith('ed.') && !edition.endsWith('ed')) {
    return `${edition} ed.`;
  } else if (edition.endsWith('ed')) {
    return `${edition}.`;
  }
  return edition;
}

/**
 * Format YYYY-MM-DD date.
 */
function formatDate(dateStr) {
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    const moNames = {
      '01': 'Jan.', '02': 'Feb.', '03': 'Mar.', '04': 'Apr.',
      '05': 'May', '06': 'Jun.', '07': 'Jul.', '08': 'Aug.',
      '09': 'Sep.', '10': 'Oct.', '11': 'Nov.', '12': 'Dec.'
    };
    return `${moNames[mo] || mo} ${parseInt(d, 10)}, ${y}`;
  }
  return dateStr;
}

/**
 * Format month name or macro.
 */
function formatMonth(monthStr) {
  if (!monthStr) return '';
  const clean = monthStr.trim().toLowerCase();
  return MONTH_MAP[clean] || monthStr.trim();
}

/**
 * Convert a single parsed entry object to IEEE \bibitem.
 */
function convertSingleEntry(entry) {
  const etype = (entry.ENTRYTYPE || '').toLowerCase();
  const eid = entry.ID || '';

  const authorRaw = (entry.author || '').trim();
  const editorRaw = (entry.editor || '').trim();
  const orgRaw = (entry.organization || '').trim();

  let creator = '';
  if (authorRaw) {
    creator = formatAuthorList(authorRaw);
  } else if (editorRaw && (etype === 'book' || etype === 'proceedings')) {
    creator = formatEditorList(editorRaw);
  } else if (orgRaw && (etype === 'misc' || etype === 'online')) {
    creator = stripOuterBraces(orgRaw);
  }

  const rawTitle = (entry.title || '').trim();
  let titleFormatted = '';
  if (etype === 'book' || etype === 'proceedings' || etype === 'manual' || etype === 'software') {
    titleFormatted = formatTitleCase(rawTitle);
  } else {
    titleFormatted = toSentenceCase(rawTitle);
  }

  const year = (entry.year || '').trim();
  const dateVal = (entry.date || '').trim();
  const month = formatMonth(entry.month || '');

  let dateFormatted = '';
  if (dateVal) {
    dateFormatted = formatDate(dateVal);
  } else if (month && year) {
    dateFormatted = `${month} ${year}`;
  } else if (year) {
    dateFormatted = year;
  }

  const doi = normalizeDoi(entry.doi || '');
  const url = (entry.url || '').trim();
  const howpublished = (entry.howpublished || '').trim();
  const note = (entry.note || '').trim();
  const urldate = (entry.urldate || '').trim();

  let includeUrl = false;
  let urlTarget = '';
  if (!doi) {
    if (url) {
      includeUrl = true;
      urlTarget = url;
    } else if (howpublished && howpublished.includes('\\url{')) {
      const m = howpublished.match(/\\url\{([^}]+)\}/);
      if (m) {
        includeUrl = true;
        urlTarget = m[1];
      }
    }
  }

  let onlineSuffix = '';
  if (includeUrl) {
    onlineSuffix = ` [Online]. Available: \\url{${urlTarget}}.`;
    if (urldate) {
      const mUd = urldate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (mUd) {
        const [, yU, moU, dU] = mUd;
        const moNames = {
          '01': 'Jan.', '02': 'Feb.', '03': 'Mar.', '04': 'Apr.',
          '05': 'May', '06': 'Jun.', '07': 'Jul.', '08': 'Aug.',
          '09': 'Sep.', '10': 'Oct.', '11': 'Nov.', '12': 'Dec.'
        };
        onlineSuffix += ` Accessed: ${moNames[moU] || moU} ${parseInt(dU, 10)}, ${yU}.`;
      }
    } else if (note && note.includes('Accessed:')) {
      onlineSuffix += ` ${note}.`;
    }
  }

  let body = '';

  if (etype === 'article') {
    const journal = formatTitleCase(entry.journal || '');
    const volume = (entry.volume || '').trim();
    const number = (entry.number || '').trim();
    const pages = (entry.pages || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `\\emph{${journal}}`;

    if (volume) body += `, vol. ${volume}`;
    if (number) body += `, no. ${number}`;
    if (pages) body += `, pp. ${pages}`;
    if (dateFormatted) body += `, ${dateFormatted}`;

    if (doi) {
      body += `, doi: ${doi}.`;
    } else if (onlineSuffix) {
      body += `.${onlineSuffix}`;
    } else {
      body += '.';
    }
  } else if (etype === 'inproceedings' || etype === 'conference') {
    const booktitle = formatTitleCase(entry.booktitle || '');
    const address = (entry.address || '').trim();
    const pages = (entry.pages || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `in \\emph{${booktitle}}`;

    if (address) body += `, ${address}`;
    if (dateFormatted) body += `, ${dateFormatted}`;
    if (pages) body += `, pp. ${pages}`;

    if (doi) {
      body += `, doi: ${doi}.`;
    } else if (onlineSuffix) {
      body += `.${onlineSuffix}`;
    } else {
      body += '.';
    }
  } else if (etype === 'book') {
    const edition = formatEdition(entry.edition || '');
    const publisher = (entry.publisher || '').trim();
    const address = (entry.address || '').trim();

    if (creator) body += `${creator}, `;
    body += `\\emph{${titleFormatted}}`;
    if (edition) body += `, ${edition}`;

    let pubPart = '';
    if (address && publisher) {
      pubPart = `${address}: ${publisher}`;
    } else if (publisher) {
      pubPart = publisher;
    }

    if (pubPart) {
      if (body.endsWith('.')) body += ` ${pubPart}`;
      else body += `. ${pubPart}`;
    }

    if (dateFormatted) {
      if (pubPart) {
        body += `, ${dateFormatted}.`;
      } else {
        if (body.endsWith('.')) body += ` ${dateFormatted}.`;
        else body += `. ${dateFormatted}.`;
      }
    } else {
      if (!body.endsWith('.')) body += '.';
    }
  } else if (etype === 'incollection') {
    const booktitle = formatTitleCase(entry.booktitle || '');
    const editor = formatEditorList(entry.editor || '');
    const address = (entry.address || '').trim();
    const publisher = (entry.publisher || '').trim();
    const pages = (entry.pages || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `in \\emph{${booktitle}}`;
    if (editor) body += `, ${editor}`;

    let pubPart = '';
    if (address && publisher) {
      pubPart = `${address}: ${publisher}`;
    } else if (publisher) {
      pubPart = publisher;
    }

    if (pubPart) {
      if (body.endsWith('.')) body += ` ${pubPart}`;
      else body += `. ${pubPart}`;
    }

    if (dateFormatted) body += `, ${dateFormatted}`;
    if (pages) body += `, pp. ${pages}`;
    body += '.';
  } else if (etype === 'phdthesis') {
    const school = (entry.school || '').trim();
    const address = (entry.address || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `Ph.D. dissertation, ${school}`;
    if (address) body += `, ${address}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
  } else if (etype === 'mastersthesis') {
    const school = (entry.school || '').trim();
    const address = (entry.address || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `Master's thesis, ${school}`;
    if (address) body += `, ${address}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
  } else if (etype === 'techreport') {
    const inst = (entry.institution || '').trim();
    const address = (entry.address || '').trim();
    const number = (entry.number || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `${inst}`;
    if (address) body += `, ${address}`;
    if (number) body += `, Tech. Rep. ${number}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
  } else if (etype === 'proceedings') {
    const address = (entry.address || '').trim();
    const org = (entry.organization || '').trim();
    const pub = (entry.publisher || '').trim();

    body += `\\emph{${titleFormatted}}.`;
    let locOrg = '';
    if (address && (org || pub)) {
      locOrg = `${address}: ${org || pub}`;
    } else if (org || pub) {
      locOrg = `${org || pub}`;
    }

    if (locOrg) body += ` ${locOrg}`;
    if (dateFormatted) {
      if (locOrg) body += `, ${dateFormatted}.`;
      else body += ` ${dateFormatted}.`;
    } else {
      body += '.';
    }
  } else if (etype === 'manual') {
    const org = (entry.organization || '').trim();

    if (creator) body += `${creator}, `;
    body += `\\emph{${titleFormatted}}.`;
    if (org) body += ` ${org}`;
    if (dateFormatted) {
      if (org) body += `, ${dateFormatted}.`;
      else body += ` ${dateFormatted}.`;
    } else {
      body += '.';
    }
    if (onlineSuffix) body += onlineSuffix;
  } else if (etype === 'unpublished') {
    let noteStr = note;
    if (noteStr) noteStr = noteStr[0].toLowerCase() + noteStr.slice(1);
    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    if (noteStr) body += `${noteStr}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
  } else if (etype === 'software') {
    const version = (entry.version || '').trim();
    if (creator) body += `${creator}, `;
    body += `\\emph{${titleFormatted}}`;
    if (version) body += `, version ${version}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
    if (onlineSuffix) body += onlineSuffix;
  } else if (etype === 'dataset') {
    const publisher = (entry.publisher || '').trim();
    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    if (publisher) body += `${publisher}`;
    if (dateFormatted) body += `, ${dateFormatted}`;
    if (doi) {
      body += `, doi: ${doi}.`;
    } else if (onlineSuffix) {
      body += `.${onlineSuffix}`;
    } else {
      body += '.';
    }
  } else if (etype === 'patent') {
    const number = (entry.number || '').trim();
    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    body += `U.S. Patent ${number}`;
    if (dateFormatted) body += `, ${dateFormatted}.`;
    else body += '.';
  } else {
    // misc, online, fallback
    const eprint = (entry.eprint || '').trim();

    if (howpublished && howpublished.includes('Patent')) {
      if (creator) body += `${creator}, `;
      body += `\`\`${titleFormatted},'' `;
      body += `${howpublished}`;
      if (dateFormatted) body += `, ${dateFormatted}.`;
      else body += '.';
    } else if (eprint) {
      if (creator) body += `${creator}, `;
      body += `\`\`${titleFormatted},'' `;
      body += `arXiv:${eprint}`;
      if (dateFormatted) body += `, ${dateFormatted}.`;
      else body += '.';
    } else {
      if (creator) body += `${creator}, `;
      if (!dateFormatted && onlineSuffix) {
        body += `\`\`${titleFormatted}.''`;
      } else {
        body += `\`\`${titleFormatted},'' `;
        if (dateFormatted) body += `${dateFormatted}.`;
      }
      if (onlineSuffix) body += onlineSuffix;
    }
  }

  return `\\bibitem{${eid}}\n${body.trim()}`;
}

/**
 * Convert parsed entries to bibitem format.
 */
function convertToBibitem(entries) {
  const bibitems = [];
  const seenIds = new Set();

  for (const entry of entries) {
    if (!entry.ID || seenIds.has(entry.ID)) {
      continue;
    }
    seenIds.add(entry.ID);
    bibitems.push(convertSingleEntry(entry));
  }

  return bibitems;
}

// ----------------------------------------------------
// Web UI Event Handlers and DOM Binding
// Interactive Web UI Controller
// ----------------------------------------------------
if (typeof document !== 'undefined') {
  // DOM Elements
  const bibtexInput = document.getElementById('bibtex-input');
  const bibitemOutput = document.getElementById('bibitem-output');
  const inputInfo = document.getElementById('input-info');
  const outputInfo = document.getElementById('output-info');
  const inputBadge = document.getElementById('input-badge');
  const outputBadge = document.getElementById('output-badge');
  const metricsTime = document.getElementById('metrics-time');
  const fileUpload = document.getElementById('file-upload');
  const convertBtn = document.getElementById('convert-btn');
  const clearInputBtn = document.getElementById('clear-input');
  const copyBtn = document.getElementById('copy-btn');
  const downloadBtn = document.getElementById('download-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const dropZone = document.getElementById('drop-zone');
  const copyLatexBtn = document.getElementById('copy-latex-template');
  const latexTemplateCode = document.getElementById('latex-template-code');

  // Theme Toggler
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      showToast(`Switched to ${newTheme} mode`, 'info');
    });
  }

  // OS theme change listener
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  });

  // Sample Loaders
  document.querySelectorAll('.btn-sample').forEach(btn => {
    btn.addEventListener('click', () => {
      const sampleKey = btn.getAttribute('data-sample');
      if (SAMPLES[sampleKey] && bibtexInput) {
        bibtexInput.value = SAMPLES[sampleKey];
        handleConvert();
        showToast(`Loaded ${sampleKey} sample!`, 'success');
      }
    });
  });

  // Copy LaTeX Template button
  if (copyLatexBtn && latexTemplateCode) {
    copyLatexBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(latexTemplateCode.textContent);
        showToast('LaTeX template copied to clipboard!', 'success');
      } catch {
        showToast('Failed to copy template', 'error');
      }
    });
  }

  // File drag & drop listeners
  function readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (bibtexInput) {
        bibtexInput.value = e.target.result;
        handleConvert();
        showToast(`Loaded ${file.name}!`, 'success');
      }
    };
    reader.readAsText(file);
  }

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt && dt.files;
      if (files && files.length > 0) {
        readFile(files[0]);
      }
    }, false);
  }

  // File upload input listener
  if (fileUpload) {
    fileUpload.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        readFile(file);
      }
    });
  }

  // Input changes & debounce auto-convert
  let convertTimeout;
  if (bibtexInput) {
    bibtexInput.addEventListener('input', () => {
      const text = bibtexInput.value.trim();
      if (convertBtn) convertBtn.disabled = !text;

      const count = countBibTeXEntries(text);
      if (inputBadge) inputBadge.textContent = `${count} ${count === 1 ? 'entry' : 'entries'}`;

      clearTimeout(convertTimeout);
      convertTimeout = setTimeout(() => {
        if (text) {
          handleConvert();
        } else {
          handleClear();
        }
      }, 400);
    });
  }

  function handleClear() {
    if (bibtexInput) bibtexInput.value = '';
    if (bibitemOutput) bibitemOutput.value = '';
    if (inputInfo) {
      inputInfo.textContent = 'Ready for input';
      inputInfo.className = 'entry-info';
    }
    if (outputInfo) {
      outputInfo.textContent = 'Waiting for conversion';
      outputInfo.className = 'entry-info';
    }
    if (inputBadge) inputBadge.textContent = '0 entries';
    if (outputBadge) outputBadge.textContent = '0 converted';
    if (metricsTime) metricsTime.textContent = '0 ms';
    if (copyBtn) copyBtn.disabled = true;
    if (downloadBtn) downloadBtn.disabled = true;
    if (convertBtn) convertBtn.disabled = true;
  }

  function handleConvert() {
    if (!bibtexInput) return;
    const bibtexText = bibtexInput.value.trim();

    if (!bibtexText) {
      handleClear();
      return;
    }

    const startTime = performance.now();
    try {
      const inputCount = countBibTeXEntries(bibtexText);
      if (inputBadge) inputBadge.textContent = `${inputCount} ${inputCount === 1 ? 'entry' : 'entries'}`;
      if (inputInfo) {
        inputInfo.textContent = `Detected ${inputCount} BibTeX ${inputCount === 1 ? 'entry' : 'entries'}`;
        inputInfo.className = 'entry-info';
      }

      const entries = parseBibTeX(bibtexText);
      const bibitems = convertToBibitem(entries);
      const elapsed = Math.round(performance.now() - startTime);
      if (metricsTime) metricsTime.textContent = `${elapsed} ms`;

      if (bibitems.length === 0) {
        if (outputInfo) {
          outputInfo.textContent = `0 entries converted (${inputCount} failed or skipped)`;
          outputInfo.className = 'entry-info error';
        }
        if (outputBadge) outputBadge.textContent = '0 converted';
        if (bibitemOutput) bibitemOutput.value = '';
        if (copyBtn) copyBtn.disabled = true;
        if (downloadBtn) downloadBtn.disabled = true;
        return;
      }

      if (bibitemOutput) bibitemOutput.value = bibitems.join('\n\n');
      if (outputBadge) outputBadge.textContent = `${bibitems.length} converted`;
      if (copyBtn) copyBtn.disabled = false;
      if (downloadBtn) downloadBtn.disabled = false;

      const skipped = inputCount - bibitems.length;
      if (outputInfo) {
        if (skipped > 0) {
          outputInfo.textContent = `Converted ${bibitems.length} ${bibitems.length === 1 ? 'entry' : 'entries'} (${skipped} skipped/duplicate) in ${elapsed} ms`;
          outputInfo.className = 'entry-info warning';
        } else {
          outputInfo.textContent = `Successfully converted ${bibitems.length} ${bibitems.length === 1 ? 'entry' : 'entries'} in ${elapsed} ms`;
          outputInfo.className = 'entry-info success';
        }
      }
    } catch (error) {
      if (outputInfo) {
        outputInfo.textContent = `Error: ${error.message}`;
        outputInfo.className = 'entry-info error';
      }
      if (bibitemOutput) bibitemOutput.value = '';
      if (copyBtn) copyBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
    }
  }

  async function handleCopy() {
    if (!bibitemOutput) return;
    const text = bibitemOutput.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied all bibitems to clipboard!', 'success');
    } catch {
      bibitemOutput.select();
      document.execCommand('copy');
      showToast('Copied all bibitems to clipboard!', 'success');
    }
  }

  function handleDownload() {
    if (!bibitemOutput) return;
    const text = bibitemOutput.value;
    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'bibitems.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded bibitems.txt!', 'success');
  }

  // Toast Notification System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }

  // Button actions
  if (convertBtn) convertBtn.addEventListener('click', handleConvert);
  if (clearInputBtn) clearInputBtn.addEventListener('click', handleClear);
  if (copyBtn) copyBtn.addEventListener('click', handleCopy);
  if (downloadBtn) downloadBtn.addEventListener('click', handleDownload);

  // Keyboard Shortcuts (Cmd/Ctrl+Enter -> Convert, Cmd/Ctrl+Shift+C -> Copy)
  window.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifier = isMac ? e.metaKey : e.ctrlKey;

    if (modifier && e.key === 'Enter') {
      e.preventDefault();
      if (convertBtn && !convertBtn.disabled) handleConvert();
    } else if (modifier && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      if (copyBtn && !copyBtn.disabled) handleCopy();
    }
  });
}

// Export for Node.js environments
// Export for Node.js testing environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseBibTeX,
    convertToBibitem,
    convertSingleEntry,
    toSentenceCase,
    formatTitleCase,
    parseName,
    formatAuthorList
  };
}
