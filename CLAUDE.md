# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, no-build-step web app. Open `index.html` in a browser via a local HTTP server — no npm, no bundler, no framework.

```bash
# Serve locally (any of these work)
python3 -m http.server 8080
npx serve .
# or use VS Code Live Server (launch config targets localhost:8080)
```

## Architecture

Everything runs inside `initMap()` in `main.js`, which Google Maps calls as its async callback after loading. All state is local to that closure.

**Data flow:**
1. User picks origin/destination (Google Places Autocomplete) and a date
2. "Get Times" iterates through all 24 hours of that day, firing one `directionsService.route()` call per hour with a 500ms delay between requests (`requestDelay`)
3. Each response pushes `[Date, durationSeconds, routeResponse]` into `timesArray`
4. `graphIt()` redraws the ECharts bar chart after each response lands
5. Hovering a bar in the chart calls `directionsRenderer.setDirections()` with that hour's stored response — updating the map in real time

**Key globals in `initMap()` closure:**
- `timesArray` — accumulates `[time, value, response]` tuples
- `numIntervals` — tracks which hour slot is currently being fetched
- `timeSpan` / `timeInterval` — 86400000ms / 3600000ms (1 day, 1-hour slots)
- `myChart` — ECharts instance bound to `#graph`
- `directionsRenderer` — single renderer reused for both preview and hover

## Dependencies (all external/local, no package manager)

| Dependency | How loaded |
|---|---|
| Google Maps JS API + Places | CDN script tag with key in `index.html`; `initMap` is the callback |
| ECharts | Local `echarts.js` (vendored) |
| Bootstrap 4 CSS + Bootstrap 5 JS | CDN — mixed versions, intentional or not |

## Known issues / unfinished work

- "Avoid Tolls" checkbox is rendered but `avoidTolls` option is commented out in `getDirections()`
- `scratch.js` is a dev scratch file, not loaded by `index.html`
- `minutestoTime()` at the bottom of `main.js` is empty stub
- Google Maps API key is hardcoded in `index.html` — treat it as potentially public
