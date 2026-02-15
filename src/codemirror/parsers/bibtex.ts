export interface BibEntry {
  key: string;
  type: string;
  title?: string;
  author?: string;
  year?: string;
}

export function parseBibtex(content: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const entryRegex = /@(\w+)\s*\{\s*([^,]+)\s*,([^@]*)/g;
  let match;

  while ((match = entryRegex.exec(content)) !== null) {
    const type = match[1].toLowerCase();
    const key = match[2].trim();
    const body = match[3];

    if (type === 'comment' || type === 'string' || type === 'preamble') continue;

    const entry: BibEntry = { key, type };

    const titleMatch = body.match(/title\s*=\s*[{"]([^}"]+)[}"]/i);
    if (titleMatch) entry.title = titleMatch[1].trim();

    const authorMatch = body.match(/author\s*=\s*[{"]([^}"]+)[}"]/i);
    if (authorMatch) entry.author = authorMatch[1].trim();

    const yearMatch = body.match(/year\s*=\s*[{"]?(\d{4})[}"]?/i);
    if (yearMatch) entry.year = yearMatch[1];

    entries.push(entry);
  }

  return entries;
}
