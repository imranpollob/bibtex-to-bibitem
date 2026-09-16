/** Strict, position-aware BibTeX scanner. Values are never silently truncated. */
function parseBibTeX(text) {
  let i = 0;
  const entries = [];
  const strings = new Map(Object.entries(MONTH_MAP));
  const ids = new Set();
  const warnings = [];
  const fail = message => {
    const line = text.slice(0, i).split('\n').length;
    throw new Error(`${message} (line ${line})`);
  };
  const skip = () => {
    while (i < text.length) {
      if (/\s/.test(text[i])) i++;
      else if (text[i] === '%') {
        while (i < text.length && text[i] !== '\n') i++;
      } else break;
    }
  };
  const grouped = () => {
    const open = text[i++];
    const close = open === '{' ? '}' : '"';
    let depth = 0;
    let value = '';
    while (i < text.length) {
      const c = text[i++];
      if (c === '\\' && i < text.length) { value += c + text[i++]; continue; }
      if (c === close && depth === 0) return value;
      if (c === '{') depth++;
      if (c === '}') {
        if (depth === 0) fail('Unbalanced brace in quoted value');
        depth--;
      }
      value += c;
    }
    fail(`Unterminated ${open === '{' ? 'braced' : 'quoted'} value`);
  };
  const value = () => {
    let result = '';
    do {
      skip();
      if (text[i] === '{' || text[i] === '"') result += grouped();
      else {
        const token = text.slice(i).match(/^[^\s,#{}()="]+/)?.[0];
        if (!token) fail('Expected a field value');
        i += token.length;
        if (/^\d+$/.test(token)) result += token;
        else if (strings.has(token.toLowerCase())) result += strings.get(token.toLowerCase());
        else fail(`Undefined string macro "${token}"; enclose literal text in braces`);
      }
      skip();
      if (text[i] !== '#') return result;
      i++;
    } while (i <= text.length);
  };
  while (i < text.length) {
    skip();
    if (i >= text.length) break;
    // BibTeX permits free commentary between records.
    if (text[i] !== '@') { i++; continue; }
    const header = text.slice(i).match(/^@([\w-]+)\s*([{(])/);
    if (!header) fail('Invalid entry header');
    const type = header[1].toLowerCase();
    i += header[0].length;
    const close = header[2] === '{' ? '}' : ')';
    if (type === 'comment') {
      let depth = 1;
      while (i < text.length && depth) {
        const c = text[i++];
        if (c === '\\') { i++; continue; }
        if (c === header[2]) depth++;
        if (c === close) depth--;
      }
      if (depth) fail('Unterminated comment');
      continue;
    }
    skip();
    if (type === 'preamble') {
      value(); skip();
      if (text[i] === ',') { i++; skip(); }
      if (text[i++] !== close) fail('Expected end of preamble');
      warnings.push('A @preamble was omitted. Add any required LaTeX definitions to your document.');
      continue;
    }
    let entry;
    if (type !== 'string') {
      const start = i;
      while (i < text.length && text[i] !== ',' && text[i] !== close) i++;
      const id = text.slice(start, i).trim();
      if (!id || /[\s\\{}%#~^$&\[\]]/.test(id)) fail(`Invalid citation key "${id}"`);
      if (ids.has(id)) fail(`Duplicate citation key "${id}"`);
      ids.add(id);
      entry = { ENTRYTYPE: type, ID: id };
      if (text[i] === ',') i++;
    }
    let fieldCount = 0;
    while (true) {
      skip();
      if (text[i] === close) { i++; break; }
      const field = text.slice(i).match(/^([\w-]+)\s*=/);
      if (!field) fail('Expected field = value or closing delimiter');
      i += field[0].length;
      const key = field[1].toLowerCase();
      const val = value();
      if (type === 'string') {
        if (fieldCount) fail('Only one definition is allowed per @string');
        strings.set(key, val);
      } else {
        if (Object.hasOwn(entry, key)) fail(`Duplicate field "${key}" in ${entry.ID}`);
        entry[key] = val;
      }
      fieldCount++;
      skip();
      if (text[i] === ',') i++;
      else if (text[i] !== close) fail('Expected comma between fields');
    }
    if (entry) entries.push(entry);
  }
  const byId = new Map(entries.map(e => [e.ID, e]));
  const resolved = new Set();
  const resolve = (entry, visiting = new Set()) => {
    if (resolved.has(entry.ID)) return;
    if (visiting.has(entry.ID)) fail(`Cyclic cross-reference involving "${entry.ID}"`);
    visiting.add(entry.ID);
    if (entry.crossref) {
      const parent = byId.get(entry.crossref);
      if (!parent) fail(`Missing cross-reference "${entry.crossref}" for ${entry.ID}`);
      resolve(parent, visiting);
      if (['inproceedings', 'conference', 'incollection', 'inbook'].includes(entry.ENTRYTYPE)) {
        entry.booktitle ||= parent.booktitle || parent.title;
      }
      for (const [key, val] of Object.entries(parent)) {
        if (!['ID', 'ENTRYTYPE', 'crossref', 'title'].includes(key) && !Object.hasOwn(entry, key)) entry[key] = val;
      }
    }
    visiting.delete(entry.ID);
    resolved.add(entry.ID);
  };
  entries.forEach(e => resolve(e));
  Object.defineProperty(entries, 'warnings', { value: warnings });
  return entries;
}

/** Report incomplete or unsupported metadata instead of claiming publication readiness. */
function getWarnings(entries) {
  const warnings = [...(entries.warnings || [])];
  const required = {
    article: ['author', 'journal'], inproceedings: ['author', 'booktitle'], conference: ['author', 'booktitle'],
    book: ['publisher'], incollection: ['author', 'booktitle', 'publisher'], inbook: ['publisher'],
    phdthesis: ['author', 'school'], mastersthesis: ['author', 'school'], techreport: ['author', 'institution'],
    proceedings: [], manual: [], unpublished: ['author', 'note'], software: [], dataset: [], patent: ['number'], misc: [], online: ['url']
  };
  const baseFields = 'author title year date month doi url howpublished note urldate crossref';
  const typeFields = {
    article: 'journal volume number pages',
    inproceedings: 'booktitle address pages', conference: 'booktitle address pages',
    book: 'editor edition publisher address chapter pages', inbook: 'editor edition publisher address chapter pages',
    incollection: 'booktitle editor address publisher pages',
    phdthesis: 'school address', mastersthesis: 'school address', techreport: 'institution address number',
    proceedings: 'editor address organization publisher', manual: 'organization',
    software: 'version', dataset: 'publisher', patent: 'number entrysubtype', unpublished: '',
    misc: 'organization eprint archiveprefix eprinttype', online: 'organization eprint archiveprefix eprinttype'
  };
  const nonCitation = new Set('abstract keywords file timestamp owner groups bibtex_show preview annotation primaryclass eprintclass isbn issn language'.split(' '));
  for (const e of entries) {
    const warn = message => warnings.push(`${e.ID}: ${message}`);
    const rendered = new Set((baseFields + ' ' + (typeFields[e.ENTRYTYPE] ?? typeFields.misc)).split(' '));
    if (!Object.hasOwn(required, e.ENTRYTYPE)) warn(`Unsupported type @${e.ENTRYTYPE}; using generic formatting.`);
    for (const field of ['title', ...(required[e.ENTRYTYPE] || [])]) if (!e[field]) warn(`Missing ${field}.`);
    if (!e.year && !e.date) warn('Missing publication year/date.');
    if (!e.author && !e.editor && !e.organization) warn('No author, editor, or organization supplied.');
    if (e.doi && !/^10\.\d{4,9}\/\S+$/i.test(normalizeDoi(e.doi))) warn('DOI has an unusual format; verify it against the source.');
    for (const field of ['date', 'urldate']) {
      if (e[field] && !validDate(e[field], field === 'urldate')) warn(`Invalid or unsupported ${field}: ${e[field]}. Preserved for review.`);
    }
    if (e.ENTRYTYPE === 'inbook' && !e.chapter && !e.pages) warn('Missing chapter or pages for book part.');
    if (e.eprint && !e.archiveprefix && !e.eprinttype) warn('No eprint archive supplied; the identifier is not assumed to be arXiv.');
    for (const key of Object.keys(e)) {
      if (!['ID', 'ENTRYTYPE'].includes(key) && !rendered.has(key) && !nonCitation.has(key)) warn(`Field "${key}" is not rendered; check whether it is required.`);
    }
  }
  return warnings;
}

function validDate(value, full = false) {
  if (!full && /^\d{4}$/.test(value)) return true;
  if (!full && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Escape plain text specials while retaining existing TeX commands, groups and math. */
function escapeLatex(value) {
  let out = '', math = false;
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '\\') {
      const command = value.slice(i).match(/^\\(?:[a-zA-Z]+|.)/s)?.[0] || c;
      out += command; i += command.length - 1;
      if (command === '\\(' || command === '\\[') math = true;
      if (command === '\\)' || command === '\\]') math = false;
    } else if (c === '$') { math = !math; out += c; if (value[i + 1] === '$') out += value[++i]; }
    else if ('&%#'.includes(c) || (!math && c === '_')) out += '\\' + c;
    else if (!math && c === '^') out += '\\textasciicircum{}';
    else out += c;
  }
  return out;
}

const MONTH_MAP = {
  jan: 'Jan.', feb: 'Feb.', mar: 'Mar.', apr: 'Apr.',
  may: 'May', jun: 'Jun.', jul: 'Jul.', aug: 'Aug.',
  sep: 'Sep.', oct: 'Oct.', nov: 'Nov.', dec: 'Dec.',
  january: 'Jan.', february: 'Feb.', march: 'Mar.', april: 'Apr.',
  june: 'Jun.', july: 'Jul.', august: 'Aug.', september: 'Sep.',
  october: 'Oct.', november: 'Nov.', december: 'Dec.'
};


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
        res.push(subRes.join('-'));
      } else {
        res.push(getInitial(t));
      }
    }
    return res.join(' ');
  }

  function getInitial(tok) {
    if (!tok) return '';
    if (isFullyBraced(tok) && !tok.startsWith('{\\')) tok = stripOuterBraces(tok);
    if (tok.endsWith('.')) return tok;
    const accent = tok.match(/^(\{\\(?:['"`^~=.]|[a-zA-Z]+)\s*\{?[^{}]\}?\}|\\(?:['"`^~=.]|[a-zA-Z]+)\s*\{[^{}]+\}|\\[A-Za-z]+(?=\s|$))/);
    if (accent) return accent[0] + '.';
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

  const others = rawNames.at(-1) === 'others';
  if (others) rawNames.pop();
  const names = rawNames.map(n => parseName(n)).filter(Boolean);
  if (others) return names.join(', ') + ', et al.';
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
 * Preserve source capitalization and LaTeX commands, normalizing whitespace only.
 */
function formatTitle(titleRaw) {
  // Source capitalization and TeX grouping carry meaning; do not guess at either.
  return titleRaw.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize DOI identifier.
 */
function normalizeDoi(doi) {
  if (!doi) return '';
  doi = doi.trim();
  doi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
  doi = doi.replace(/^doi:\s*/i, '');
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
  if (m && validDate(dateStr.trim(), true)) {
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
  entry = { ...entry };
  // Identifiers/URLs are handled separately; all display fields retain TeX markup.
  for (const key of Object.keys(entry)) {
    if (!['ID', 'ENTRYTYPE', 'url', 'doi', 'howpublished'].includes(key)) entry[key] = escapeLatex(entry[key]);
  }
  if (entry.pages) entry.pages = entry.pages.replace(/(\d)\s*[-–—]+\s*(?=\d)/g, '$1--');
  const etype = (entry.ENTRYTYPE || '').toLowerCase();
  const eid = entry.ID || '';

  const authorRaw = (entry.author || '').trim();
  const editorRaw = (entry.editor || '').trim();
  const orgRaw = (entry.organization || '').trim();

  let creator = '';
  if (authorRaw) {
    creator = formatAuthorList(authorRaw);
  } else if (editorRaw && (etype === 'book' || etype === 'inbook' || etype === 'proceedings')) {
    creator = formatEditorList(editorRaw);
  } else if (orgRaw && (etype === 'misc' || etype === 'online')) {
    creator = stripOuterBraces(orgRaw);
  }

  const rawTitle = (entry.title || '').trim();
  const titleFormatted = formatTitle(rawTitle);

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

  const doi = escapeLatex(normalizeDoi(entry.doi || ''));
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
      if (mUd && validDate(urldate, true)) {
        const [, yU, moU, dU] = mUd;
        const moNames = {
          '01': 'Jan.', '02': 'Feb.', '03': 'Mar.', '04': 'Apr.',
          '05': 'May', '06': 'Jun.', '07': 'Jul.', '08': 'Aug.',
          '09': 'Sep.', '10': 'Oct.', '11': 'Nov.', '12': 'Dec.'
        };
        onlineSuffix += ` Accessed: ${moNames[moU] || moU} ${parseInt(dU, 10)}, ${yU}.`;
      } else {
        onlineSuffix += ` Accessed: ${urldate}.`;
      }
    } else if (note && note.includes('Accessed:')) {
      onlineSuffix += ` ${note.replace(/\.$/, '')}.`;
    }
  }

  let body = '';

  if (etype === 'article') {
    const journal = formatTitle(entry.journal || '');
    const volume = (entry.volume || '').trim();
    const number = (entry.number || '').trim();
    const pages = (entry.pages || '').trim();

    if (creator) body += `${creator}, `;
    body += `\`\`${titleFormatted},'' `;
    if (journal) body += `\\emph{${journal}}`;

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
    const booktitle = formatTitle(entry.booktitle || '');
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
  } else if (etype === 'book' || etype === 'inbook') {
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
    if (entry.chapter) body = body.replace(/\.$/, '') + `, ch. ${entry.chapter}.`;
    if (entry.pages) body = body.replace(/\.$/, '') + `, pp. ${entry.pages}.`;
  } else if (etype === 'incollection') {
    const booktitle = formatTitle(entry.booktitle || '');
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

    if (creator) body += `${creator}, `;
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
    } else if (!body.endsWith('.')) {
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
    } else if (!body.endsWith('.')) {
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
    body += `${entry.entrysubtype || 'Patent'} ${number}`;
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
      const archive = entry.archiveprefix || entry.eprinttype || 'eprint';
      body += `${archive.toLowerCase() === 'arxiv' ? 'arXiv' : archive}:${eprint}`;
      if (dateFormatted) body += `, ${dateFormatted}.`;
      else body += '.';
    } else {
      if (creator) body += `${creator}, `;
      if (!dateFormatted) {
        body += `\`\`${titleFormatted}.''`;
      } else {
        body += `\`\`${titleFormatted},'' `;
        if (dateFormatted) body += `${dateFormatted}.`;
      }
      if (onlineSuffix) body += onlineSuffix;
    }
  }

  // Preserve locators for every type, including books, theses, and software.
  if (doi && !body.includes('doi: ')) body = body.trim().replace(/\.$/, '') + ', doi: ' + doi + '.';
  if (onlineSuffix && !body.includes('[Online]')) body = body.trim().replace(/\.$/, '') + '.' + onlineSuffix;
  if (howpublished && !howpublished.includes('\\url{') && !body.includes(howpublished)) body += ' ' + escapeLatex(howpublished).replace(/\.$/, '') + '.';
  if (note && !body.toLowerCase().includes(note.toLowerCase())) body += ' ' + note.replace(/\.$/, '') + '.';
  body = body.trim();
  if (!/[.!?](?:'')?$/.test(body)) body += '.';
  return `\\bibitem{${eid}}\n${body}`;
}

/**
 * Convert parsed entries to bibitem format.
 */
function convertToBibitem(entries) {
  const bibitems = [];
  const seenIds = new Set();

  for (const entry of entries) {
    if (!entry.ID || seenIds.has(entry.ID)) {
      throw new Error(`Missing or duplicate citation key: ${entry.ID || '(empty)'}`);
    }
    seenIds.add(entry.ID);
    bibitems.push(convertSingleEntry(entry));
  }

  return bibitems;
}


export { getWarnings, escapeLatex, parseBibTeX, convertToBibitem, convertSingleEntry, formatTitle, parseName, formatAuthorList };
