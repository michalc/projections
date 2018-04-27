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

var svg;
var svgRect;

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
    maxLength = Math.max(charts[i].length / 2, maxLength);
    var pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttributeNS(null, 'class', 'land');
    pathPool.push(pathElement);
    svg.appendChild(pathElement);
  }
  rotatedCoords = new Float64Array(8 * 2 * maxLength);
}

function fillRotationMatrixFromTo(rotationMatrix, a, b) {
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
}

function setSvgDimensions() {
  var screenBound = Math.min(window.innerWidth, window.innerHeight);
  svg.setAttribute('width', screenBound);
  svg.setAttribute('height', screenBound);
  bounds.screen.right = screenBound;
  bounds.screen.bottom = screenBound;
}

function drawFromTo() {
  if (!charts) return;
  fillRotationMatrixFromTo(rotationMatrix, draggingPointFrom, draggingPointTo);
  Mercator.createChart(svg, charts, bounds, rotationMatrix, rotatedCoords, pathPool);
}

window.addEventListener('load', function() {
  svg = document.getElementById('svg');

  window.addEventListener('resize', setSvgDimensions);
  window.addEventListener('resize', drawFromTo);
  setSvgDimensions();

  function onMove(x, y) {
    if (!svgRect || !mousedown) return;
    var chartX = x - svgRect.left;
    var chartY = y - svgRect.top;
    Mercator.toEarth(bounds, chartX, chartY, draggingPointTo, 0);
    drawFromTo();   
  }
  document.body.addEventListener('mousemove', function(e) {
    onMove(e.clientX, e.clientY);
  });
  document.body.addEventListener('touchmove', function(e) {
    e.preventDefault();
    onMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  function onDown(x, y) {
    if (mousedown) return;
    mousedown = true;
    var chartX = x - svgRect.left;
    var chartY = y - svgRect.top;
    inverseRotationMatrix[0] = rotationMatrix[0];
    inverseRotationMatrix[1] = rotationMatrix[3];
    inverseRotationMatrix[2] = rotationMatrix[6];
    inverseRotationMatrix[3] = rotationMatrix[1];
    inverseRotationMatrix[4] = rotationMatrix[4];
    inverseRotationMatrix[5] = rotationMatrix[7];
    inverseRotationMatrix[6] = rotationMatrix[2];
    inverseRotationMatrix[7] = rotationMatrix[5];
    inverseRotationMatrix[8] = rotationMatrix[8];
    Mercator.toEarth(bounds, chartX, chartY, draggingPointFrom, 0);
    Mercator.rotate(inverseRotationMatrix, draggingPointFrom, 0, draggingPointFrom, 0);
  }
  document.body.addEventListener('mousedown', function(e) {
    onDown(e.clientX, e.clientY);
  });
  document.body.addEventListener('touchstart', function(e) {
    e.preventDefault();
    onDown(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  function onUp(e) {
    mousedown = false;
  }
  document.body.addEventListener('mouseup', onUp);
  document.body.addEventListener('touchend', function(e) {
    e.preventDefault();
    onUp();
  });
  document.body.addEventListener('touchcancel', function(e) {
    e.preventDefault();
    onUp();
  });


  fetch('data/data.json').then(function(results) {
    charts = results.map(function(shape) {
      var shapeCoords = new Float64Array(shape.length * 2);
      for (var i = 0; i < shape.length; ++i) {
        var long = shape[i][0];
        var lat = shape[i][1];
        var theta = toRadians(long);
        var phi = toRadians(90 - lat);
        shapeCoords[i*2] = theta;
        shapeCoords[i*2 + 1] = phi;
      }
      return shapeCoords;
    });
    initCharts();
    drawFromTo();
    document.body.removeAttribute('class');
    svgRect = svg.getBoundingClientRect();
  });
});
