function initMap() {
  let place1;
  let place2;
  let timeSpan = 86400000; // milliseconds in a day
  let timeInterval = 3600000; // milliseconds in one hour
  let timesArray = [];
  let startTime = Date.now();
  let numIntervals = 0;
  let requestDelay = 500;
  let myChart = echarts.init(document.getElementById('graph'));
  let isRetrieving = false;
  let isDate = false;

  let map = new google.maps.Map(document.getElementById('map'), {
    disableDefaultUI: true,
    zoomControl: false,
    disableZoom: true,
    center: {
      lat: 30.267153,
      lng: -97.743061,
    },
    zoom: 12,
    mapId: 'ad3981ee0e8f42a6',
  });

  const input1 = document.getElementById('pac-input');
  const autocomplete1 = new google.maps.places.Autocomplete(input1);

  const input2 = document.getElementById('pac-input-2');
  const autocomplete2 = new google.maps.places.Autocomplete(input2);

  var directionsService = new google.maps.DirectionsService();
  var directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);

  calculateAndDisplayRoute(directionsService, directionsRenderer);

  autocomplete1.addListener('place_changed', () => {
    place1 = autocomplete1.getPlace();
    if (!place1.geometry || !place1.geometry.location) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.
      window.alert("No details available for input: '" + place.name + "'");
      return;
    }

    map.setCenter(place1.geometry.location);
  });

  autocomplete2.addListener('place_changed', () => {
    place2 = autocomplete2.getPlace();
    if (!place2.geometry || !place2.geometry.location) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.
      window.alert("No details available for input: '" + place.name + "'");
      return;
    }

    calculateAndDisplayRoute(directionsService, directionsRenderer);
  });

  document
    .getElementById('get-times')
    .addEventListener('click', () => getTimes(startTime, timeInterval));

  function getTimes(startTime, timeInterval) {
    calculateAndDisplayRoute(directionsService, directionsRenderer);
    let datePicker = document.getElementById('date-picker');
    let dateSelectedMs = datePicker.valueAsNumber; //ms date at midnight GMT ****GOT IT***

    const date = new Date();
    const offset = date.getTimezoneOffset();
    console.log('offset: ' + offset);
    dateSelectedOffsetMs = dateSelectedMs + offset * 60 * 1000; //Midnight on the day picked using systme time zone.

    timesArray = [];
    numIntervals = 0;
    getDirections(dateSelectedOffsetMs + numIntervals * timeInterval);
  }

  function calculateAndDisplayRoute(directionsService, directionsRenderer) {
    directionsService
      .route({
        // so route is a fundtion defined somewhere tht returns a promise.
        origin: {
          query: document.getElementById('pac-input').value,
        },
        destination: {
          query: document.getElementById('pac-input-2').value,
        },
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((response) => {
        directionsRenderer.setDirections(response);
      })
      .catch((e) => window.alert('Directions request failed due to ' + status));
  }

  function getDirections(time) {
    console.log(time);
    time = new Date(time); //correct date object (midnight at systime of the selected date)
    console.log(time);

    directionsService
      .route({
        origin: {
          query: document.getElementById('pac-input').value,
        },
        destination: {
          query: document.getElementById('pac-input-2').value,
        },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: time,
        },
        //avoidTolls: document.getElementById('avoid-tolls').value,
      })
      .then((response) => {
        let leg = response.routes[0].legs[0];
        let value;

        if (!leg.duration_in_traffic) {
          value = leg.duration.value;
        }
        if (leg.duration_in_traffic) {
          value = leg.duration_in_traffic.value;
        }
        timesArray.push([time, value, response]);
        graphIt();
        if ((numIntervals + 1) * timeInterval < timeSpan) {
          timesArray.sort();
          console.log(timesArray);
          showStats();
          directionsRenderer.setDirections(response);

          setTimeout(() => {
            numIntervals++;
            getDirections(Number(time) + timeInterval);
          }, requestDelay);
        } else {
          timesArray.sort();
          console.log(timesArray);
          graphIt();
        }
      })
      .catch((e) => {
        console.log(e);
        window.alert('Directions request failed due to ' + e);
      });
  }

  function graphIt() {
    var option = {
      tooltip: {
        valueFormatter: function (value) {
          let hours = Math.floor(value / 3600) + 'h ';
          return hours + Math.floor(value / 60) + 'm';
        },
        formatter: function (params) {
          directionsRenderer.setDirections(timesArray[params.dataIndex][2]);
          let hours = Math.floor(params.value / 3600) + 'h ';
          return hours + Math.floor(params.value / 60) + 'm';
        },
      },
      legend: {
        show: false,
      },
      grid: {
        containLabel: true,
      },
      backgroundColor: 'rgb(255, 254, 250)',
      xAxis: {
        axisTick: {
          alignWithLabel: true,
        },
        nameLocation: 'center',
        scale: false,
        data: timesArray.map((el) => el[0]),
        axisLabel: {
          formatter: function (date) {
            console.log(date);
            return getFormattedTime(date);
          },
        },
      },
      yAxis: {
        min: function (value) {
          return Math.floor(value.min * 0.85);
        },
        axisLabel: {
          show: true,
          name: 'minutes',

          formatter: function (value) {
            console.log(value);
            console.log(Math.floor(value / 60));
            console.log(value % 60);
            return Math.floor(value / 60) + ' mins';
          },
        },
      },

      series: [
        {
          // color: '#EA4335',
          color: '#3B94F4',
          showInTooltip: false,
          type: 'bar',
          smooth: true,
          data: timesArray.map((el) => el[1]),
        },
      ],
    };

    // Display the chart using the configuration items and data just specified.
    myChart.setOption(option);
  }

  function showStats() {
    console.log(timesArray);
  }

  function getFormattedTime(timeMs) {
    let theDate = new Date(timeMs);

    let hrs =
      theDate.getHours() - 12 > 0
        ? theDate.getHours() - 12
        : theDate.getHours();
    let min =
      theDate.getMinutes() - 10 < 0
        ? '0' + theDate.getMinutes()
        : theDate.getMinutes();
    let amPm = theDate.getHours() - 12 >= 0 ? 'pm' : 'am';

    if (hrs + min === '000') {
      return 'Midnite';
    }
    if (hrs + min === '1200') {
      return 'Noon';
    }
    return hrs + ':' + min + amPm;
  }
}

function minutestoTime(mins) {}

// - Set map and all llistenrs including gettimes
// - Get times
