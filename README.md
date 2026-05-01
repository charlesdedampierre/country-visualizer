# Country Visualizer

Interactive map of the **4,203 countries of citizenship (Wikidata P27)** that
have been used to describe a human in Wikidata, plotted on a globe (or flat
map) with a time slider.

## Features

- **Globe / Flat** projection toggle (maplibre-gl).
- **Entity-type filter** — pick any of the ~929 Wikidata classes used (country,
  kingdom, polis, dynasty, …).
- **Time slider** with play / scrub. An entity is shown at year *Y* when:
  - both inception and dissolved are known → `inception ≤ Y ≤ dissolved`
  - only inception known → `Y ≥ inception` for extant types (country, sovereign
    state, …); only at `Y == inception` for past types (historical, ancient,
    former, fictional, extinct, colonial, abolished, defunct, medieval,
    prehistoric, disestablished).
  - only dissolved known → only at `Y == dissolved`
  - both unknown → hidden by default; toggle the "Show entities with no dates"
    checkbox to surface them.
- **On-map labels** with halo rendering, drawn directly next to the points.
- **Hover tooltips** show the Wikidata description and a Wikipedia link.

## Run

```bash
npm install
npm run dev
```

App opens at http://localhost:5180/.

## Data

`public/p27_countries_wikidata.tsv` — extracted via Wikidata SPARQL + the
`wbgetentities` API. Columns: `qid`, `label`, `description`, `description_lang`,
`instance_qids`, `instance_labels`, `inception`, `dissolved`, `active_span`,
`active_centuries`, `has_coord`, `coord`, `has_geoshape`, `geoshape`,
`wikipedia_url`, `wikipedia_lang`.
