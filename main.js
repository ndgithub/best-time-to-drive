function initMap() {
  let place1;
  let place2;
  let timeSpan = 86400000; // milliseconds in a day
  let timeInterval = 3600000; // milliseconds in one hour
  let timesArray = [];
  let startTime = Date.now();
  let numIntervals = 0;
  let requestDelay = 600;
  var myChart = echarts.init(document.getElementById('graph'));

  map = new google.maps.Map(document.getElementById('map'), {
    disableDefaultUI: true,
    center: {
      lat: 30.267153,
      lng: -97.743061,
    },
    zoom: 8,
    mapId: '43338ce9ef1e18f0',
  });

  const input1 = document.getElementById('pac-input');
  const options1 = {};
  const autocomplete1 = new google.maps.places.Autocomplete(input1, options1);

  const input2 = document.getElementById('pac-input-2');
  const options2 = {};
  const autocomplete2 = new google.maps.places.Autocomplete(input2, options2);

  var directionsService = new google.maps.DirectionsService();
  var directionsRenderer = new google.maps.DirectionsRenderer();
  directionsRenderer.setMap(map);
  graphIt();
  autocomplete1.addListener('place_changed', () => {
    place1 = autocomplete1.getPlace();
    if (!place1.geometry || !place1.geometry.location) {
      // User entered the name of a Place that was not suggested and
      // pressed the Enter key, or the Place Details request failed.
      window.alert("No details available for input: '" + place.name + "'");
      return;
    }

    map.setCenter(place1.geometry.location);
    map.setZoom(17);
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
    // map.setCenter(place2.geometry.location);
    // map.setZoom(17);
  });

  document
    .getElementById('get-times')
    .addEventListener('click', () => getTimes(startTime, timeInterval));

  function calculateAndDisplayRoute(directionsService, directionsRenderer) {
    directionsService
      .route({
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
  function getTimes(startTime, timeInterval) {
    calculateAndDisplayRoute(directionsService, directionsRenderer);
    let datePicker = document.getElementById('date-picker');
    let dateSelectedMs = datePicker.valueAsNumber; //ms date at midnight GMT ****GOT IT***
    console.log(dateSelectedMs);
    const date = new Date();
    const offset = date.getTimezoneOffset();
    console.log('offset: ' + offset);
    dateSelectedOffsetMs = dateSelectedMs + offset * 60 * 1000; //Midnight on the day picked using systme time zone.
    console.log(dateSelectedOffsetMs);

    timesArray = [];
    numIntervals = 0;
    getDirections(dateSelectedOffsetMs + numIntervals * timeInterval);
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
        //avoidTolls: true,
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
        console.log(typeof time);
        if ((numIntervals + 1) * timeInterval < timeSpan) {
          timesArray.sort();
          console.log(timesArray);
          graphIt();
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
    //var myChart = echarts.init(document.getElementById('graph'));
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
      xAxis: {
        axisTick: {
          alignWithLabel: true,
        },
        name: 'Departure Time',
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
          return value.min * 0.85;
        },
        axisLabel: {
          formatter: function (value) {
            let hours = Math.floor(value / 3600) + 'h ';
            return hours + Math.floor(value / 60) + 'm';
          },
        },
      },

      series: [
        {
          color: '#EA4335',
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
    console.log(theDate);
    console.log(theDate.getHours());
    let hrs =
      theDate.getHours() - 12 > 0
        ? theDate.getHours() - 12
        : theDate.getHours();
    let min =
      theDate.getMinutes() - 10 < 0
        ? '0' + theDate.getMinutes()
        : theDate.getMinutes();
    let amPm = theDate.getHours() - 12 > 0 ? 'pm' : 'am';
    return hrs + ':' + min + amPm;
  }
}

function minutestoTime(mins) {}

// - Set map and all llistenrs including gettimes
// - Get times
