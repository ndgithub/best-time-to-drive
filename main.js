function initMap() {
  // ── State ──────────────────────────────────────────────
  let timesArray    = [];
  let numIntervals  = 0;
  let isRetrieving  = false;
  let startMidnight = 0;

  // ── Config ─────────────────────────────────────────────
  const TOTAL_HOURS    = 24;
  const TIME_INTERVAL  = 3600000;  // 1 hour in ms
  const REQUEST_DELAY  = 500;      // ms between API calls

  // ── ECharts ────────────────────────────────────────────
  const myChart = echarts.init(document.getElementById('graph'));
  window.addEventListener('resize', () => myChart.resize());

  myChart.on('mouseover', params => {
    if (params.componentType === 'series' && timesArray[params.dataIndex]) {
      directionsRenderer.setDirections(timesArray[params.dataIndex][2]);
    }
  });

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
    polylineOptions: { strokeColor: '#2563EB', strokeWeight: 4 },
  });
  directionsRenderer.setMap(map);

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

  const datePicker = document.getElementById('date-picker');
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const yyyy = nextWeek.getFullYear();
  const mm   = String(nextWeek.getMonth() + 1).padStart(2, '0');
  const dd   = String(nextWeek.getDate()).padStart(2, '0');
  datePicker.value = `${yyyy}-${mm}-${dd}`;

  previewRoute();

  // ── Route preview (no traffic) ─────────────────────────
  function previewRoute() {
    directionsService.route({
      origin:      { query: input1.value },
      destination: { query: input2.value },
      travelMode:  google.maps.TravelMode.DRIVING,
    }).then(res => directionsRenderer.setDirections(res)).catch(() => {});
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

    isRetrieving  = true;
    timesArray    = [];
    numIntervals  = 0;
    startMidnight = midnight;

    const btn = document.getElementById('get-times');
    btn.classList.add('loading');
    btn.disabled = true;

    clearError();
    document.getElementById('progress-section').classList.remove('hidden');
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
      document.getElementById('chart-placeholder').classList.remove('hidden');
      return;
    }

    if (timesArray.length > 0) {
      drawChart(true);
      document.getElementById('chart-hint').classList.remove('hidden');
    }
  }

  // ── Progress bar ───────────────────────────────────────
  function updateProgress(count) {
    const pct = Math.round((count / TOTAL_HOURS) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
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
  function drawChart(isFinal = false) {
    if (timesArray.length === 0) return;

    const isMobile = window.innerWidth <= 760;
    const durations = timesArray.map(el => el[1]);
    const minDur    = Math.min(...durations);
    const maxDur    = Math.max(...durations);
    const bestIdx   = isFinal ? timesArray.findIndex(el => el[1] === minDur) : -1;
    const worstIdx  = isFinal ? timesArray.findIndex(el => el[1] === maxDur) : -1;

    const allTimestamps = Array.from({ length: TOTAL_HOURS }, (_, i) => startMidnight + i * TIME_INTERVAL);
    const durationMap   = new Map(timesArray.map(el => [el[0], el]));

    const barData = allTimestamps.map((ts, i) => {
      const entry   = durationMap.get(ts);
      if (!entry) return { value: null };
      const isBest  = isFinal && entry[1] === minDur;
      const isWorst = isFinal && entry[1] === maxDur && !isBest;
      return {
        value: entry[1],
        itemStyle: {
          color: isBest
            ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, global: false,
                colorStops: [{ offset: 0, color: '#86EFAC' }, { offset: 1, color: '#16A34A' }] }
            : isWorst
            ? { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, global: false,
                colorStops: [{ offset: 0, color: '#FCA5A5' }, { offset: 1, color: '#DC2626' }] }
            : { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, global: false,
                colorStops: [{ offset: 0, color: '#93C5FD' }, { offset: 1, color: '#1D4ED8' }] },
          borderRadius: [4, 4, 0, 0],
          shadowBlur:   (isBest || isWorst) ? 10 : 0,
          shadowColor:  isBest ? 'rgba(22,163,74,0.35)' : isWorst ? 'rgba(220,38,38,0.35)' : 'transparent',
        },
        label: {
          ...(isMobile && (isBest || isWorst) && { show: true }),
          color:    isBest ? '#16A34A' : isWorst ? '#DC2626' : '#4A5568',
          fontSize: (!isMobile && (isBest || isWorst)) ? 20 : 10,
        },
      };
    });

    myChart.setOption({
      backgroundColor: '#FFFFFF',
      animation:        true,
      animationDuration: 450,
      animationEasing:  'cubicOut',

      tooltip: { show: false },

      grid: { left: 12, right: 14, top: isMobile ? 28 : 40, bottom: 16, containLabel: true },

      xAxis: {
        type: 'category',
        data: allTimestamps,
        axisTick:  { show: false },
        axisLine:  { lineStyle: { color: '#DDDAD0' } },
        axisLabel: {
          interval: 0,
          fontFamily: "'Fira Code', monospace",
          fontSize:   12,
          color:      '#4A5568',
          rich: {
            best:  { fontWeight: 'bold', color: '#16A34A', fontFamily: "'Fira Code', monospace", fontSize: 14 },
            worst: { fontWeight: 'bold', color: '#DC2626', fontFamily: "'Fira Code', monospace", fontSize: 14 },
          },
          formatter: (val, index) => {
            const label = fmtTime(val);
            if (index === bestIdx)  return '{best|'  + label + '}';
            if (index === worstIdx) return '{worst|' + label + '}';
            if (index % 4 === 0) {
              if (bestIdx  >= 0 && Math.abs(index - bestIdx)  === 1) return '';
              if (worstIdx >= 0 && Math.abs(index - worstIdx) === 1) return '';
              return label;
            }
            return '';
          },
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
        label: {
          show: !isMobile,
          position: 'top',
          fontFamily: "'Fira Code', monospace",
          fontSize: 10,
          fontWeight: 'bold',
          formatter: params => Math.round(params.value / 60) + 'm',
        },
        cursor: 'default',
        emphasis: { disabled: true },
      }],
    }, false);
  }

}
