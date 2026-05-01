import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, MapPoint } from './MapView';
import { loadCountries, instanceLabelCounts, isActiveAtYear, Country } from './data';

const CURRENT_YEAR = new Date().getFullYear();

type Projection = 'globe' | 'mercator';

export default function App() {
  const [countries, setCountries] = useState<Country[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('country');
  const [year, setYear] = useState<number>(2000);
  const [hovered, setHovered] = useState<MapPoint | null>(null);
  const [mouse, setMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(false);
  const [projection, setProjection] = useState<Projection>('globe');
  const [showLabels, setShowLabels] = useState(true);
  const [includeUndated, setIncludeUndated] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    loadCountries().then(setCountries).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setContainerSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setYear((y) => {
        const next = y + 25;
        if (next > CURRENT_YEAR) {
          setPlaying(false);
          return CURRENT_YEAR;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(t);
  }, [playing]);

  const types = useMemo(() => (countries ? instanceLabelCounts(countries) : []), [countries]);

  const points: MapPoint[] = useMemo(() => {
    if (!countries) return [];
    const out: MapPoint[] = [];
    for (const c of countries) {
      if (c.lat == null || c.lon == null) continue;
      if (selectedType !== '__all__' && !c.instance_labels.includes(selectedType)) continue;
      if (!isActiveAtYear(c, year, includeUndated)) continue;
      out.push({
        qid: c.qid,
        label: c.label,
        description: c.description,
        description_lang: c.description_lang,
        active_span: c.active_span,
        active_centuries: c.active_centuries,
        instance_labels: c.instance_labels,
        wikipedia_url: c.wikipedia_url,
        lat: c.lat,
        lng: c.lon,
      });
    }
    return out;
  }, [countries, selectedType, year, includeUndated]);

  const stats = useMemo(() => {
    if (!countries) return null;
    return {
      total: countries.length,
      withCoord: countries.filter((c) => c.lat != null).length,
      shown: points.length,
    };
  }, [countries, points]);

  return (
    <div className="app app-light">
      <aside className="sidebar">
        <div>
          <h1>Country Visualizer</h1>
          <div className="sub">Wikidata P27 · {countries ? `${countries.length.toLocaleString()} entities` : 'loading…'}</div>
        </div>

        <div className="field">
          <label>Projection</label>
          <div className="seg">
            <button className={projection === 'globe' ? 'on' : ''} onClick={() => setProjection('globe')}>Globe</button>
            <button className={projection === 'mercator' ? 'on' : ''} onClick={() => setProjection('mercator')}>Flat</button>
          </div>
        </div>
        <div className="field">
          <label className="row">
            <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
            <span>Show entity names on map</span>
          </label>
        </div>

        <div className="field">
          <label>Entity type</label>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="__all__">All ({stats?.withCoord ?? '…'})</option>
            {types.map((t) => (
              <option key={t.label} value={t.label}>
                {t.label} ({t.count})
              </option>
            ))}
          </select>
          <div className="sub">Filter to entities tagged as this Wikidata class.</div>
        </div>

        <div className="field">
          <label className="row">
            <input
              type="checkbox"
              checked={includeUndated}
              onChange={(e) => setIncludeUndated(e.target.checked)}
            />
            <span>Show entities with no dates</span>
          </label>
        </div>

        <div className="legend">
          <span className="dot" />
          {stats ? `${stats.shown.toLocaleString()} active points` : ''}
        </div>

        {stats && (
          <div className="stat">
            <div>Total in dataset: <strong>{stats.total.toLocaleString()}</strong></div>
            <div>With coordinates: <strong>{stats.withCoord.toLocaleString()}</strong></div>
          </div>
        )}
      </aside>

      <div
        className="map-area"
        ref={containerRef}
        onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      >
        {!countries && !error && <div className="loading">Loading TSV…</div>}
        {error && <div className="loading">Error: {error}</div>}

        {countries && (
          <MapView
            points={points}
            projection={projection}
            showLabels={showLabels}
            onHover={setHovered}
            onClick={(p) => {
              if (p.wikipedia_url) window.open(p.wikipedia_url, '_blank');
            }}
          />
        )}

        {hovered && (
          <div
            className="tooltip"
            style={{
              left: mouse.x - (containerRef.current?.getBoundingClientRect().left ?? 0),
              top: mouse.y - (containerRef.current?.getBoundingClientRect().top ?? 0),
            }}
          >
            <Tooltip h={hovered} />
          </div>
        )}

        <div className="timebar">
          <button className="ctrl" onClick={() => setPlaying((p) => !p)}>{playing ? '❚❚' : '▶'}</button>
          <button className="ctrl" onClick={() => setYear(-2000)}>−2000</button>
          <button className="ctrl" onClick={() => setYear(0)}>0</button>
          <button className="ctrl" onClick={() => setYear(1500)}>1500</button>
          <button className="ctrl" onClick={() => setYear(CURRENT_YEAR)}>now</button>
          <input
            type="range"
            min={-3000}
            max={CURRENT_YEAR}
            step={1}
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
          />
          <div className="year">{formatYear(year)}</div>
        </div>
      </div>
    </div>
  );
}

function Tooltip({ h }: { h: MapPoint }) {
  return (
    <>
      <div className="name">{h.label}</div>
      <div className="meta">
        {h.active_span && <>{h.active_span} · </>}
        {h.active_centuries && <>{h.active_centuries} · </>}
        {h.instance_labels[0] || ''}
      </div>
      {h.description && (
        <div className="desc">
          {h.description}
          {h.description_lang && h.description_lang !== 'en' && (
            <> <span style={{ color: '#5a6373' }}>[{h.description_lang}]</span></>
          )}
        </div>
      )}
      {h.wikipedia_url && (
        <div style={{ marginTop: 6, fontSize: 11 }}>
          <a href={h.wikipedia_url} target="_blank" rel="noreferrer">Wikipedia →</a>
        </div>
      )}
    </>
  );
}

function formatYear(y: number) {
  if (y < 0) return `${-y} BCE`;
  if (y === 0) return '1 BCE';
  return `${y} CE`;
}
