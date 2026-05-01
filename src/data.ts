import Papa from 'papaparse';

export interface Country {
  qid: string;
  label: string;
  description: string;
  description_lang: string;
  instance_qids: string[];
  instance_labels: string[];
  inception_year: number | null;
  dissolved_year: number | null;
  active_span: string;
  active_centuries: string;
  has_coord: boolean;
  lat: number | null;
  lon: number | null;
  has_geoshape: boolean;
  wikipedia_url: string;
  wikipedia_lang: string;
}

const DATE_RE = /^(-?)(\d+)-\d{2}-\d{2}T/;
function parseYear(iso: string): number | null {
  if (!iso || iso.includes('genid')) return null;
  const m = iso.match(DATE_RE);
  if (!m) return null;
  const y = parseInt(m[2], 10);
  return m[1] === '-' ? -y : y;
}

const POINT_RE = /^Point\(([\-\d.]+)\s+([\-\d.]+)\)/;
function parseCoord(s: string): { lat: number; lon: number } | null {
  if (!s) return null;
  // Multi-coord pipe-separated; take the first
  const first = s.split('|')[0];
  const m = first.match(POINT_RE);
  if (!m) return null;
  const lon = parseFloat(m[1]);
  const lat = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

export async function loadCountries(): Promise<Country[]> {
  const res = await fetch('/p27_countries_wikidata.tsv');
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, delimiter: '\t', skipEmptyLines: true });
  const rows = parsed.data as Record<string, string>[];
  const out: Country[] = [];
  for (const r of rows) {
    if (!r.qid) continue;
    const inceptions = (r.inception || '').split('|').filter(Boolean).map(parseYear).filter((y): y is number => y !== null);
    const dissolveds = (r.dissolved || '').split('|').filter(Boolean).map(parseYear).filter((y): y is number => y !== null);
    const inception_year = inceptions.length ? Math.min(...inceptions) : null;
    const dissolved_year = dissolveds.length ? Math.max(...dissolveds) : null;
    const c = parseCoord(r.coord || '');
    out.push({
      qid: r.qid,
      label: r.label || r.qid,
      description: r.description || '',
      description_lang: r.description_lang || '',
      instance_qids: (r.instance_qids || '').split('|').filter(Boolean),
      instance_labels: (r.instance_labels || '').split('|').filter(Boolean),
      inception_year,
      dissolved_year,
      active_span: r.active_span || '',
      active_centuries: r.active_centuries || '',
      has_coord: r.has_coord === 'True',
      lat: c?.lat ?? null,
      lon: c?.lon ?? null,
      has_geoshape: r.has_geoshape === 'True',
      wikipedia_url: r.wikipedia_url || '',
      wikipedia_lang: r.wikipedia_lang || '',
    });
  }
  return out;
}

export function instanceLabelCounts(countries: Country[]): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const c of countries) {
    if (!c.lat || !c.lon) continue;
    const seen = new Set<string>();
    for (const l of c.instance_labels) {
      if (seen.has(l)) continue;
      seen.add(l);
      m.set(l, (m.get(l) || 0) + 1);
    }
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export function isActiveAtYear(
  c: Country,
  year: number,
  includeUndated = false,
  extendOpenEnded = false,
): boolean {
  const a = c.inception_year, b = c.dissolved_year;
  // No date info -> only show if the user opted in.
  if (a == null && b == null) return includeUndated;
  // Both known -> bounded interval.
  if (a != null && b != null) return a <= year && year <= b;
  // Only inception known.
  if (a != null) {
    return extendOpenEnded ? year >= a : year === a;
  }
  // Only dissolved known.
  return extendOpenEnded ? year <= b! : year === b!;
}

export function hasAnyDate(c: Country): boolean {
  return c.inception_year != null || c.dissolved_year != null;
}
