/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

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

window.addEventListener('load', function() {
  var svg = document.getElementById('svg');
  var svgRect;

  window.addEventListener('resize', function() {
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });

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
    Mercator.init(latLongCharts, svg);
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });
});
