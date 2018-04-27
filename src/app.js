/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

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

var charts;
var pathPool = [];
var rotatedCoords;
var rotationMatrix = new Float64Array(9);
var inverseRotationMatrix = new Float64Array(9);

var latitudeInput;
var longitudeInput;
var svg;
var svgRect;

var latitude;
var longitude;

var mousedown = false;
var draggingPointFrom = new Float64Array(2);
var draggingPointTo = new Float64Array(2);

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

function initCharts() {
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

function fillRotationMatrix(rotTheta, rotPhi) {
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
}

function fillRotationMatrixFromTo(a, b) {
  var a_theta = a[0];
  var a_phi = a[1];
  var a_sinPhi = Math.sin(a_phi)
  var a_1 = Math.cos(a_theta) * a_sinPhi;
  var a_2 = Math.sin(a_theta) * a_sinPhi;
  var a_3 = Math.cos(a_phi);

  var b_theta = b[0];
  var b_phi = b[1];
  var b_sinPhi = Math.sin(b_phi)
  var b_1 = Math.cos(b_theta) * b_sinPhi;
  var b_2 = Math.sin(b_theta) * b_sinPhi;
  var b_3 = Math.cos(b_phi);

  // Dot product
  var c = a_1 * b_1 + a_2 * b_2 + a_3 * b_3;
  var c_coef = 1 / (1 + c);

  // Cross product
  var v_1 = a_2 * b_3 - a_3 * b_2;
  var v_2 = a_3 * b_1 - a_1 * b_3;
  var v_3 = a_1 * b_2 - a_2 * b_1;

  var v_1_v_1 = v_1 * v_1;
  var v_1_v_2 = v_1 * v_2;
  var v_1_v_3 = v_1 * v_3;
  var v_2_v_2 = v_2 * v_2;
  var v_2_v_3 = v_2 * v_3;
  var v_3_v_3 = v_3 * v_3;

  rotationMatrix[0] = 1    + c_coef * (-v_3_v_3 - v_2_v_2);
  rotationMatrix[1] = -v_3 + c_coef * v_1_v_2;
  rotationMatrix[2] = v_2  + c_coef * v_1_v_3;
  rotationMatrix[3] = v_3  + c_coef * v_1_v_2;
  rotationMatrix[4] = 1    + c_coef * (-v_3_v_3 - v_1_v_1);
  rotationMatrix[5] = -v_1 + c_coef * v_2_v_3;
  rotationMatrix[6] = -v_2 + c_coef * v_1_v_3;
  rotationMatrix[7] = v_1  + c_coef * v_2_v_3;
  rotationMatrix[8] = 1    + c_coef * (-v_2_v_2 - v_1_v_1);
  //console.log(rotationMatrix);
}

function createChart(svg, charts, bounds) {
  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    for (var i = 0; i < charts[j].length; ++i) {
      Mercator.rotate(rotationMatrix, charts[j][i], 0, rotatedCoords, i*2);
    }

    var shape = Mercator.getShape(bounds, charts[j].length, rotatedCoords);
    pathPool[j].setAttributeNS(null, 'd', shape);
  }
}

function setSvgDimensions() {
  var screenBound = Math.min(window.innerWidth, window.innerHeight - 40);
  svg.setAttribute('width', screenBound);
  svg.setAttribute('height', screenBound);
  bounds.screen.right = screenBound;
  bounds.screen.bottom = screenBound;
}

function draw() {
  if (!charts) return;
  fillRotationMatrix(toRadians(longitude), toRadians(latitude))
  createChart(svg, charts, bounds);
}

function drawFromTo() {
  if (!charts) return;
  fillRotationMatrixFromTo(draggingPointFrom, draggingPointTo);
  createChart(svg, charts, bounds);
}

window.addEventListener('load', function() {
  latitudeInput = document.getElementById('latitude-input');
  longitudeInput = document.getElementById('longitude-input');
  svg = document.getElementById('svg');

  latitude = parseFloat(latitudeInput.value);
  latitudeInput.addEventListener('input', function() {
    latitude = parseFloat(latitudeInput.value);
    draw();
  });

  longitude = parseFloat(longitudeInput.value);
  longitudeInput.addEventListener('input', function() {
    longitude = parseFloat(longitudeInput.value);
    draw();
  });

  window.addEventListener('resize', setSvgDimensions);
  window.addEventListener('resize', draw);
  setSvgDimensions();

  document.body.addEventListener('mousemove', function(e) {
    if (!svgRect || !mousedown) return;
    var chartX = e.clientX - svgRect.left;
    var chartY = e.clientY - svgRect.top;
    var transformedEarth = Mercator.toEarth(bounds, chartX, chartY);
    draggingPointTo[0] = transformedEarth.theta;
    draggingPointTo[1] = transformedEarth.phi;
    drawFromTo();
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
    draggingPointFrom[0] = transformedEarth.theta;
    draggingPointFrom[1] = transformedEarth.phi;
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
    initCharts();
    draw();
    document.body.removeAttribute('class');
    svgRect = svg.getBoundingClientRect();
  });
});
