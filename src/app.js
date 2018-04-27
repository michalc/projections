/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function toDegrees(rad) {
  return rad * 180 / Math.PI;
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

var rotationMatrix = new Float64Array(8 * 9);
var inverseRotationMatrix = new Float64Array(8 * 9);
function createChart(svg, charts, bounds, rotTheta, rotPhi) {
  var cosPhi = Math.cos(rotPhi);
  var sinPhi = Math.sin(rotPhi);
  var cosTheta = Math.cos(rotTheta);
  var sinTheta = Math.sin(rotTheta);
  rotationMatrix[0] = cosPhi * cosTheta;
  rotationMatrix[1] = -cosPhi * sinTheta;
  rotationMatrix[2] = sinPhi;
  rotationMatrix[3] = sinTheta;
  rotationMatrix[4] = cosTheta;
  rotationMatrix[5] = 0
  rotationMatrix[6] = -sinPhi * cosTheta;
  rotationMatrix[7] = sinPhi * sinTheta;
  rotationMatrix[8] = cosPhi;

  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    for (var i = 0; i < charts[j].length; ++i) {
      Mercator.rotate(rotationMatrix, charts[j][i], 0, rotatedCoords, i*2);
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
    createChart(svg, charts, bounds, toRadians(longitude), toRadians(latitude));
  }

  var mousedown = false;
  var draggingPoint = new Float64Array(2);
  document.body.addEventListener('mousemove', function(e) {
    if (!svgRect || !mousedown) return;
    var chartX = e.clientX - svgRect.left;
    var chartY = e.clientY - svgRect.top;
    var transformedEarth = Mercator.toEarth(bounds, chartX, chartY);
    var rotTheta = transformedEarth.theta - draggingPoint[0];
    var rotPhi = transformedEarth.phi - draggingPoint[1];
    longitude = toDegrees(rotTheta);
    latitude = toDegrees(rotPhi);
    longitudeInput.value = longitude;
    latitudeInput.value = latitude;
    draw();
  });

  svg.addEventListener('mousedown', function(e) {
    mousedown = true;
    var chartX = e.clientX - svgRect.left;
    var chartY = e.clientY - svgRect.top;
    var transformedEarth = Mercator.toEarth(bounds, chartX, chartY);
    inverseRotationMatrix[0] = rotationMatrix[0];
    inverseRotationMatrix[1] = rotationMatrix[3];
    inverseRotationMatrix[2] = rotationMatrix[6];
    inverseRotationMatrix[3] = rotationMatrix[1];
    inverseRotationMatrix[4] = rotationMatrix[4];
    inverseRotationMatrix[5] = rotationMatrix[5];
    inverseRotationMatrix[6] = rotationMatrix[2];
    inverseRotationMatrix[7] = rotationMatrix[7];
    inverseRotationMatrix[8] = rotationMatrix[8];
    draggingPoint[0] = transformedEarth.theta;
    draggingPoint[1] = transformedEarth.phi;
    Mercator.rotate(inverseRotationMatrix, draggingPoint, 0, draggingPoint, 0);
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
