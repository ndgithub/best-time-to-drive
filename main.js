function initMap() {
  // ── State ──────────────────────────────────────────────
  let timesArray   = [];
  let numIntervals = 0;
  let isRetrieving = false;

  // ── Config ─────────────────────────────────────────────
  const TOTAL_HOURS    = 24;
  const TIME_INTERVAL  = 3600000;  // 1 hour in ms
  const REQUEST_DELAY  = 500;      // ms between API calls

  // ── ECharts ────────────────────────────────────────────
  const myChart = echarts.init(document.getElementById('graph'));
  window.addEventListener('resize', () => myChart.resize());

  // ── Google Maps ────────────────────────────────────────
  const map = new google.maps.Map(document.getElementById('map'), {
    disableDefaultUI: true,
    zoomControl: false,
    center: { lat: 34.05, lng: -118.35 },
    zoom: 12,
    mapId: 'ad3981ee0e8f42a6',
  });

  const directionsService  = new google.maps.DirectionsService();
  const directionsRenderer = new google.maps.DirectionsRenderer({
    polylineOptions:  { strokeColor: '#2563EB', strokeWeight: 4 },
    preserveViewport: true,
  });
  directionsRenderer.setMap(map);

  // Force the map to repaint after the fixed-position container settles
  setTimeout(() => google.maps.event.trigger(map, 'resize'), 100);

  // Fit the route into the right-hand portion of the screen (sidebar offset)
  function fitRoute(bounds) {
    map.fitBounds(bounds, { left: 500, top: 60, right: 60, bottom: 60 });
  }

  // ── Autocomplete ───────────────────────────────────────
  const input1 = document.getElementById('pac-input');
  const input2 = document.getElementById('pac-input-2');

  const autocomplete1 = new google.maps.places.Autocomplete(input1);
  const autocomplete2 = new google.maps.places.Autocomplete(input2);

  autocomplete1.addListener('place_changed', () => {
    const place = autocomplete1.getPlace();
    if (place?.geometry?.location) map.setCenter(place.geometry.location);
    previewRoute();
  });

  autocomplete2.addListener('place_changed', () => previewRoute());

  document.getElementById('get-times').addEventListener('click', startAnalysis);

  previewRoute();

  // ── Route preview (no traffic) ─────────────────────────
  function previewRoute() {
    directionsService.route({
      origin:      { query: input1.value },
      destination: { query: input2.value },
      travelMode:  google.maps.TravelMode.DRIVING,
    }).then(res => {
      directionsRenderer.setDirections(res);
      fitRoute(res.routes[0].bounds);
    }).catch(() => {});
  }

  // ── Error display ──────────────────────────────────────
  function showError(msg) {
    const banner = document.getElementById('error-banner');
    document.getElementById('error-message').textContent = msg;
    banner.classList.remove('hidden');
  }

  function clearError() {
    document.getElementById('error-banner').classList.add('hidden');
  }

  // ── Start full-day analysis ────────────────────────────
  function startAnalysis() {
    const datePicker = document.getElementById('date-picker');
    if (!datePicker.valueAsNumber) {
      datePicker.focus();
      datePicker.style.borderColor = 'var(--danger)';
      setTimeout(() => { datePicker.style.borderColor = ''; }, 2000);
      showError('Please select a date before searching.');
      return;
    }

    // Reject past dates — the Directions API requires future departure times
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const offset   = new Date().getTimezoneOffset();
    const midnight = datePicker.valueAsNumber + offset * 60 * 1000;
    if (midnight < today.getTime()) {
      datePicker.style.borderColor = 'var(--danger)';
      setTimeout(() => { datePicker.style.borderColor = ''; }, 2000);
      showError('Please pick today or a future date — traffic predictions aren\'t available for past dates.');
      return;
    }

    if (isRetrieving) return;

    isRetrieving = true;
    timesArray   = [];
    numIntervals = 0;

    const btn = document.getElementById('get-times');
    btn.classList.add('loading');
    btn.disabled = true;

    clearError();
    document.getElementById('progress-section').classList.remove('hidden');
    document.getElementById('stats-row').classList.add('hidden');
    document.getElementById('chart-placeholder').classList.add('hidden');
    document.getElementById('chart-hint').classList.add('hidden');
    updateProgress(0);

    previewRoute();
    fetchHour(midnight);
  }

  // ── Fetch one hour slot, recurse through the day ───────
  function fetchHour(timeMs) {
    const departureTime = new Date(timeMs);
    const avoidTolls    = document.getElementById('avoid-tolls-check').checked;

    directionsService.route({
      origin:         { query: input1.value },
      destination:    { query: input2.value },
      travelMode:     google.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime },
      avoidTolls,
    }).then(response => {
      const leg      = response.routes[0].legs[0];
      const duration = (leg.duration_in_traffic ?? leg.duration).value;

      timesArray.push([timeMs, duration, response]);
      timesArray.sort((a, b) => a[0] - b[0]);

      numIntervals++;
      updateProgress(numIntervals);
      drawChart();

      if (numIntervals < TOTAL_HOURS) {
        setTimeout(() => fetchHour(timeMs + TIME_INTERVAL), REQUEST_DELAY);
      } else {
        finish();
      }
    }).catch(err => {
      console.error('Directions error:', err);
      showError('Could not fetch directions. Check the addresses and try again.');
      finish(true);
    });
  }

  // ── Wrap up ────────────────────────────────────────────
  function finish(hadError = false) {
    isRetrieving = false;
    const btn = document.getElementById('get-times');
    btn.classList.remove('loading');
    btn.disabled = false;

    if (hadError) {
      document.getElementById('progress-section').classList.add('hidden');
      document.getElementById('chart-placeholder').classList.remove('hidden');
      return;
    }

    document.getElementById('progress-section').classList.add('hidden');

    if (timesArray.length > 0) {
      drawChart();
      renderStats();
      document.getElementById('chart-hint').classList.remove('hidden');
    }
  }

  // ── Progress bar ───────────────────────────────────────
  function updateProgress(count) {
    const pct = Math.round((count / TOTAL_HOURS) * 100);
    document.getElementById('progress-count').textContent = count;
    document.getElementById('progress-pct').textContent   = pct + '%';
    document.getElementById('progress-bar').style.width   = pct + '%';
  }

  // ── Duration → "1h 23m" ────────────────────────────────
  function fmtDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return m + 'm';
    if (m === 0) return h + 'h';
    return h + 'h ' + m + 'm';
  }

  // ── Timestamp → "6am", "12:30pm", "Midnight" ──────────
  function fmtTime(timeMs) {
    const d = new Date(Number(timeMs));
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 0  && m === 0) return 'Midnight';
    if (h === 12 && m === 0) return 'Noon';
    const ampm     = h >= 12 ? 'pm' : 'am';
    const displayH = h % 12 || 12;
    const displayM = m === 0 ? '' : ':' + String(m).padStart(2, '0');
    return displayH + displayM + ampm;
  }

  // ── Chart ──────────────────────────────────────────────
  function drawChart() {
    if (timesArray.length === 0) return;

    const durations = timesArray.map(el => el[1]);
    const minDur    = Math.min(...durations);

    const barData = timesArray.map(el => {
      const isBest = el[1] === minDur;
      return {
        value: el[1],
        itemStyle: {
          color: isBest
            ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, global: false,
                colorStops: [{ offset: 0, color: '#FCD34D' }, { offset: 1, color: '#D97706' }] }
            : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, global: false,
                colorStops: [{ offset: 0, color: '#93C5FD' }, { offset: 1, color: '#1D4ED8' }] },
          borderRadius: [4, 4, 0, 0],
          shadowBlur:   isBest ? 10 : 0,
          shadowColor:  isBest ? 'rgba(217,119,6,0.35)' : 'transparent',
        },
      };
    });

    myChart.setOption({
      backgroundColor: '#FFFFFF',
      animation:        true,
      animationDuration: 450,
      animationEasing:  'cubicOut',

      tooltip: {
        trigger: 'item',
        backgroundColor: '#0D1B2A',
        borderWidth: 0,
        padding: [10, 14],
        extraCssText: 'border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.28);',
        textStyle: {
          color: '#F8F7F2',
          fontFamily: "'Fira Code', monospace",
          fontSize: 12,
        },
        formatter(params) {
          directionsRenderer.setDirections(timesArray[params.dataIndex][2]);
          const timeLabel = fmtTime(timesArray[params.dataIndex][0]);
          const dur       = fmtDuration(params.value);
          const isBest    = params.value === minDur;
          const badge     = isBest
            ? '<span style="margin-left:7px;color:#FCD34D;font-size:10px;letter-spacing:0.05em">BEST</span>'
            : '';
          return `<div style="opacity:0.55;margin-bottom:4px;font-size:11px">${timeLabel}</div>`
               + `<div style="font-size:14px;font-weight:600">${dur}${badge}</div>`;
        },
      },

      grid: { left: 12, right: 14, top: 14, bottom: 0, containLabel: true },

      xAxis: {
        type: 'category',
        data: timesArray.map(el => el[0]),
        axisTick:  { show: false },
        axisLine:  { lineStyle: { color: '#DDDAD0' } },
        axisLabel: {
          fontFamily: "'Fira Code', monospace",
          fontSize:   12,
          color:      '#4A5568',
          formatter:  val => fmtTime(val),
          interval:   3,
        },
      },

      yAxis: {
        type: 'value',
        min:  val => Math.floor(val.min * 0.88),
        splitLine: { lineStyle: { color: '#E8E6DE', type: 'dashed' } },
        axisLine:  { show: false },
        axisTick:  { show: false },
        axisLabel: {
          fontFamily: "'Fira Code', monospace",
          fontSize:   12,
          color:      '#4A5568',
          formatter:  val => fmtDuration(val),
        },
      },

      series: [{
        type: 'bar',
        data: barData,
        barMaxWidth: 28,
        emphasis: {
          focus: 'self',
          itemStyle: { shadowBlur: 12, shadowColor: 'rgba(37,99,235,0.3)' },
        },
      }],
    }, false);
  }

  // ── Stats cards ────────────────────────────────────────
  function renderStats() {
    const durations = timesArray.map(el => el[1]);
    const minDur    = Math.min(...durations);
    const maxDur    = Math.max(...durations);

    const best  = timesArray.find(el => el[1] === minDur);
    const worst = timesArray.find(el => el[1] === maxDur);

    document.getElementById('stat-best-time').textContent  = fmtTime(best[0]);
    document.getElementById('stat-best-dur').textContent   = fmtDuration(minDur);
    document.getElementById('stat-worst-time').textContent = fmtTime(worst[0]);
    document.getElementById('stat-worst-dur').textContent  = fmtDuration(maxDur);
    document.getElementById('stat-savings').textContent    = fmtDuration(maxDur - minDur);

    document.getElementById('stats-row').classList.remove('hidden');
  }
}
