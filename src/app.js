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

function setSvgDimensions() {
  var screenBound = Math.min(window.innerWidth, window.innerHeight);
  svg.setAttribute('width', screenBound);
  svg.setAttribute('height', screenBound);
  bounds.screen.right = screenBound;
  bounds.screen.bottom = screenBound;
}

function drawFromTo() {
  if (!charts) return;
  Mercator.fillRotationMatrixFromTo(rotationMatrix, draggingPointFrom, draggingPointTo);
  Mercator.draw(svg, charts, bounds, rotationMatrix, rotatedCoords, pathPool);
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
    var maxLength = Mercator.initSvg(charts, pathPool, svg);
    rotatedCoords = new Float64Array(8 * 2 * maxLength);
    drawFromTo();
    document.body.removeAttribute('class');
    svgRect = svg.getBoundingClientRect();
  });
});
