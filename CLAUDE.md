# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
4. `drawChart()` redraws the ECharts bar chart after each response — the best (minimum) time bar renders in amber/gold, the rest in blue
5. `renderStats()` populates the three stat cards (Best Departure, Peak Traffic, Time Saved) once all 24 slots are done
6. Hovering a chart bar calls `directionsRenderer.setDirections()` with that hour's stored response, updating the map polyline in real time

**Key state in `initMap()` closure:**
- `timesArray` — sorted `[timestampMs, durationSeconds, routeResponse]` tuples
- `numIntervals` — how many hour slots have been fetched
- `isRetrieving` — guards against double-submission
- `myChart` — ECharts instance on `#graph`
- `directionsRenderer` — single renderer with `preserveViewport: true`; viewport only moves via `fitRoute()`

**`fitRoute(bounds)`** — calls `map.fitBounds` with `left: 500` padding so the route centers in the visible right-hand portion of the screen (clear of the sidebar).

## Layout

Full-page Google Map as background (`position: fixed; inset: 0; z-index: 0`). A fixed left sidebar (`#sidebar`, 460px wide, scrollable) floats above it with frosted-glass cards (`backdrop-filter: blur(20px)`).

```
[Map — full page background]
[#sidebar — fixed left panel]
  header pill (title + ? info tooltip)
  #controls-section (origin, destination, date, tolls toggle, button)
  #error-banner (hidden unless validation/API error)
  #progress-section (shown during fetch, hidden on completion)
  #stats-row (Best Departure | Peak Traffic | Time Saved — shown after completion)
  #chart-panel (ECharts bar chart + placeholder before first run)
```

## Dependencies (all external/local, no package manager)

| Dependency | How loaded |
|---|---|
| Google Maps JS API + Places | CDN script tag with key in `index.html`; `initMap` is the callback |
| ECharts | Local `echarts.js` (vendored) |
| Fira Code + Fira Sans | Google Fonts CDN |

## Google Maps APIs used

- **Maps JavaScript API** — map display
- **Directions API** (`DirectionsService` with `drivingOptions.departureTime` + `duration_in_traffic`) — traffic-aware routing; requires future departure times
- **Places API** (`Autocomplete`) — address suggestions

## Design system

- `--font-body`: Fira Sans (UI text, title)
- `--font-mono`: Fira Code (all labels, stat values, axis ticks)
- `--accent` / `--accent-mid`: deep/mid blue for bars and interactive elements
- `--gold` / `--gold-light`: amber for the best-time bar and best departure stat card
- `--glass-bg` + `--glass-blur`: frosted glass token applied to all sidebar cards

## Known issues / unfinished

- "Avoid Tolls" checkbox is wired up but the Directions API only honours it on some routes
- `scratch.js` is a dev scratch file, not loaded by `index.html`
- Google Maps API key is hardcoded in `index.html`
