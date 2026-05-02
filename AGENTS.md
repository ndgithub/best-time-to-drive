# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A static, no-build-step web app. Open `index.html` via a local HTTP server — no npm, no bundler, no framework.

```bash
python3 -m http.server 8081
# or: npx serve .
```

## Architecture

Everything runs inside `initMap()` in `main.js`, which Google Maps calls as its async callback. All state is local to that closure.

**Data flow:**
1. User picks origin/destination (Google Places Autocomplete) and a date
2. "Find Best Time" validates the date (must be today or future), then iterates through all 24 hours of that day, firing one `directionsService.route()` call per hour with a 500ms delay between requests
3. Each response pushes `[timestampMs, durationSeconds, routeResponse]` into `timesArray`
4. `drawChart(isFinal)` redraws the ECharts bar chart after each response — during loading all bars are blue; once all 24 are done (`isFinal = true`), the best bar turns green and the worst turns red
5. Hovering a bar fires a `mouseover` event that calls `directionsRenderer.setDirections()` with that hour's stored response, updating the map polyline in real time

**Key state in `initMap()` closure:**
- `timesArray` — sorted `[timestampMs, durationSeconds, routeResponse]` tuples
- `numIntervals` — how many hour slots have been fetched
- `isRetrieving` — guards against double-submission
- `myChart` — ECharts instance on `#graph`
- `directionsRenderer` — single renderer; no `preserveViewport`, map auto-fits to route

## Layout

`#app` is a full-viewport flex column (`height: 100vh; max-height: 900px`). Inside `main` (which flexes to fill remaining height):

```
#app (max-width: 1100px, flex column)
  #site-header (title)
  main (flex column, fills remaining height)
    #top-row (grid: 1fr 1.45fr)
      #controls-section
        origin / destination / date / tolls toggle
        Find Best Time button
        #progress-section (always-visible bar flush to card bottom, fills as data loads)
      #map-panel (Google Map, stretches to match controls height)
    #error-banner (hidden unless validation/API error)
    #chart-panel (flex: 1 — fills all remaining vertical space)
      #graph (ECharts bar chart)
      .chart-hint (hover hint, flex-shrink: 0)
```

## Default route

Downtown Los Angeles (200 N Spring St) → Santa Monica Pier — the notorious I-10/405 corridor where rush hour multiplies commute time 3–4×.

## Chart behavior

- **During loading**: all 24 bars render in blue as responses arrive
- **On completion**: best bar = green gradient (`#86EFAC` → `#16A34A`), worst bar = red gradient (`#FCA5A5` → `#DC2626`)
- **Bar-top labels**: bold `Xm` for all bars (desktop); on mobile, only best/worst show labels; best/worst labels are `fontSize: 20` on desktop
- **X-axis labels**: every 4th bar + best/worst; best/worst are bold, colored (green/red), `fontSize: 14`; regular labels adjacent (distance 1) to best/worst are suppressed; hovering an unlabeled bar shows a subtle axis label
- **No tooltip** — map route updates via ECharts `mouseover` event instead

## Dependencies (all external/local, no package manager)

| Dependency | How loaded |
|---|---|
| Google Maps JS API + Places | CDN script tag with key in `index.html`; `initMap` is the callback |
| ECharts | Local `echarts.js` (vendored) |
| Cormorant Garamond + Fira Code + Fira Sans | Google Fonts CDN |

## Google Maps APIs used

- **Maps JavaScript API** — map display
- **Directions API** (`DirectionsService` with `drivingOptions.departureTime` + `duration_in_traffic`) — traffic-aware routing; requires future departure times
- **Places API** (`Autocomplete`) — address suggestions

## Design system

- `--font-display`: Cormorant Garamond (site title, stat values)
- `--font-body`: Fira Sans (UI text)
- `--font-mono`: Fira Code (all labels, axis ticks, progress text)
- `--accent` / `--accent-mid`: deep/mid blue for bars and interactive elements
- `--success` (#16A34A): best-time bar and label
- `--danger` (#DC2626): worst-time bar and label
- Grid background pattern on `body` (`rgba(30,64,175,0.035)` lines at 28px)

## Known issues / unfinished

- "Avoid Tolls" checkbox is wired up but the Directions API only honours it on some routes
- `scratch.js` is a dev scratch file, not loaded by `index.html`
- Google Maps API key is hardcoded in `index.html`
