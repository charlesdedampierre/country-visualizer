import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

export interface MapPoint {
  qid: string;
  label: string;
  description: string;
  description_lang: string;
  active_span: string;
  active_centuries: string;
  instance_labels: string[];
  wikipedia_url: string;
  lat: number;
  lng: number;
}

const LIGHT_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors © CARTO',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#eef0f3' } },
    { id: 'carto-layer', type: 'raster', source: 'carto', minzoom: 0, maxzoom: 22 },
  ],
};

interface Props {
  points: MapPoint[];
  projection: 'globe' | 'mercator';
  showLabels: boolean;
  onHover?: (p: MapPoint | null) => void;
  onClick?: (p: MapPoint) => void;
}

export function MapView({ points, projection, showLabels, onHover, onClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: LIGHT_STYLE,
      center: [10, 25],
      zoom: 1.4,
      attributionControl: false,
    });
    mapRef.current = m;
    m.on('load', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (m as any).setProjection({ type: projection });

      m.addSource('points', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'point-circles',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 3, 6, 6],
          'circle-color': '#1e6fdb',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.4,
          'circle-opacity': 0.9,
        },
      });
      m.addLayer({
        id: 'point-labels',
        type: 'symbol',
        source: 'points',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 0, 10, 4, 12, 8, 14],
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'symbol-sort-key': ['*', -1, ['to-number', ['get', 'priority']]],
        },
        paint: {
          'text-color': '#1f2937',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      });

      m.on('mousemove', 'point-circles', (e) => {
        if (!e.features?.length) return;
        m.getCanvas().style.cursor = 'pointer';
        const p = e.features[0].properties as Record<string, string>;
        onHover?.({
          qid: p.qid,
          label: p.label,
          description: p.description,
          description_lang: p.description_lang,
          active_span: p.active_span,
          active_centuries: p.active_centuries,
          instance_labels: (p.instance_labels || '').split('|').filter(Boolean),
          wikipedia_url: p.wikipedia_url,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng),
        });
      });
      m.on('mouseleave', 'point-circles', () => {
        m.getCanvas().style.cursor = '';
        onHover?.(null);
      });
      m.on('click', 'point-circles', (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties as Record<string, string>;
        onClick?.({
          qid: p.qid,
          label: p.label,
          description: p.description,
          description_lang: p.description_lang,
          active_span: p.active_span,
          active_centuries: p.active_centuries,
          instance_labels: (p.instance_labels || '').split('|').filter(Boolean),
          wikipedia_url: p.wikipedia_url,
          lat: parseFloat(p.lat),
          lng: parseFloat(p.lng),
        });
      });

      setReady(true);
    });
    return () => {
      m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update projection when toggled
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (m as any).setProjection({ type: projection });
  }, [projection, ready]);

  // Toggle label layer visibility
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    if (m.getLayer('point-labels')) {
      m.setLayoutProperty('point-labels', 'visibility', showLabels ? 'visible' : 'none');
    }
  }, [showLabels, ready]);

  // Push points
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !ready) return;
    const src = m.getSource('points') as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: points.map((p, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          qid: p.qid,
          label: p.label,
          description: p.description,
          description_lang: p.description_lang,
          active_span: p.active_span,
          active_centuries: p.active_centuries,
          instance_labels: p.instance_labels.join('|'),
          wikipedia_url: p.wikipedia_url,
          lat: p.lat,
          lng: p.lng,
          // sort small-set first so popular ones get labels
          priority: points.length - i,
        },
      })),
    };
    src.setData(fc);
  }, [points, ready]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
