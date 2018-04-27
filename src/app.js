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

var svg;
var svgRect;

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

function setSvgDimensions() {
  var screenBound = Math.min(window.innerWidth, window.innerHeight);
  svg.setAttribute('width', screenBound);
  svg.setAttribute('height', screenBound);
  bounds.screen.right = screenBound;
  bounds.screen.bottom = screenBound;
  Mercator.setBounds(bounds);
}

window.addEventListener('load', function() {
  svg = document.getElementById('svg');

  window.addEventListener('resize', setSvgDimensions);
  window.addEventListener('resize', Mercator.drawFromTo);
  setSvgDimensions();

  document.body.addEventListener('mousemove', function(e) {
    Mercator.onMove(e.clientX, e.clientY, svgRect);
  });
  document.body.addEventListener('touchmove', function(e) {
    e.preventDefault();
    Mercator.onMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY, svgRect);
  });

  document.body.addEventListener('mousedown', function(e) {
    Mercator.onDown(e.clientX, e.clientY, svgRect);
  });
  document.body.addEventListener('touchstart', function(e) {
    e.preventDefault();
    Mercator.onDown(e.changedTouches[0].clientX, e.changedTouches[0].clientY, svgRect);
  });

  document.body.addEventListener('mouseup', Mercator.onUp);
  document.body.addEventListener('touchend', function(e) {
    e.preventDefault();
    Mercator.onUp();
  });
  document.body.addEventListener('touchcancel', function(e) {
    e.preventDefault();
    Mercator.onUp();
  });

  fetch('data/data.json').then(function(latLongCharts) {
    document.body.removeAttribute('class');
    svgRect = svg.getBoundingClientRect();
    Mercator.init(latLongCharts, svg);
  });
});
