/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function fetch(url) {
  return new Promise(function(resolve, reject) {
    function reqListener() {
      resolve(JSON.parse(oReq.responseText));
    }

    var oReq = new XMLHttpRequest();
    oReq.addEventListener('load', reqListener);
    oReq.open('GET', url);
    oReq.send();
  });
}

var pathPool = [];
var rotatedCoords;
function initCharts(charts, svg) {
  var maxLength = -Infinity;
  for (var i = 0; i < charts.length; ++i) {
    maxLength = Math.max(charts[i].length, maxLength);

    var pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttributeNS(null, 'class', 'land');
    pathPool.push(pathElement);
    svg.appendChild(pathElement);
  }
  rotatedCoords = new Float64Array(8 * 2 * maxLength);
}

function createChart(svg, charts, bounds, offsetLongitude, offsetLatitude) {
  // Convert rotation angle to radians
  var rotTheta = toRadians(offsetLongitude);
  var rotPhi = toRadians(offsetLatitude);

  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    for (var i = 0; i < charts[j].length; ++i) {
      Mercator.rotate(rotTheta, rotPhi, charts[j][i], rotatedCoords, i*2);
    }

    var shape = Mercator.getShape(bounds, charts[j].length, rotatedCoords);
    pathPool[j].setAttributeNS(null, 'd', shape);
  }
}

window.addEventListener('load', function() {
  var bounds = {
    earth: {
      top: toRadians(90 - 83.6),
      left: toRadians(-180)
    },
    screen: {
      top: 0,
      bottom: 740,
      left: 0,
      right: 800
    }
  };

  var latitudeInput = document.getElementById('latitude-input');
  var longitudeInput = document.getElementById('longitude-input');

  var latitude = parseFloat(latitudeInput.value);
  latitudeInput.addEventListener('input', function() {
    latitude = parseFloat(latitudeInput.value);
    draw();
  });

  var longitude = parseFloat(longitudeInput.value);
  longitudeInput.addEventListener('input', function() {
    longitude = parseFloat(longitudeInput.value);
    draw();
  });

  var svg = document.getElementById('svg');
  var svgRect;
  function setSvgDimensions() {
    var screenBound = Math.min(window.innerWidth, window.innerHeight - 40);
    svg.setAttribute('width', screenBound);
    svg.setAttribute('height', screenBound);
    bounds.screen.right = screenBound;
    bounds.screen.bottom = screenBound;
  }
  window.addEventListener('resize', setSvgDimensions);
  window.addEventListener('resize', draw);
  setSvgDimensions();

  var charts;
  function draw() {
    if (!charts) return;
    createChart(svg, charts, bounds, longitude, latitude);
  }

  var mousedown = false;
  var longitudeDragging;
  var latitudeDragging;
  document.body.addEventListener('mousemove', function(e) {
    if (!svgRect || !mousedown) return;
    var chartX = e.clientX - svgRect.left;
    var chartY = e.clientY - svgRect.top;
    var transformedEarth = Mercator.toEarth(bounds, chartX, chartY);
    longitude = transformedEarth.long - longitudeDragging;
    latitude = latitudeDragging - transformedEarth.lat;
    longitudeInput.value = longitude;
    latitudeInput.value = latitude;
    draw();
  });

  svg.addEventListener('mousedown', function(e) {
    mousedown = true;
    var chartX = e.clientX - svgRect.left;
    var chartY = e.clientY - svgRect.top;
    var transformedEarth = Mercator.toEarth(bounds, chartX, chartY);
    longitudeDragging = transformedEarth.long - longitude;
    latitudeDragging = transformedEarth.lat - latitude;
  });

  document.body.addEventListener('mouseup', function(e) {
    mousedown = false;
  });

  fetch('data/data.json').then(function(results) {
    charts = results.map(function(shape) {
      return shape.map(function(coord) {
        var long = coord[0];
        var lat = coord[1];
        var theeta = toRadians(long);
        var phi = toRadians(90 - lat);
        return [theeta, phi];
      });
    });
    initCharts(charts, svg);
    draw();
    document.body.removeAttribute('class');
    svgRect = svg.getBoundingClientRect();
  });
});
