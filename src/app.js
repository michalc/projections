/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

window.addEventListener('load', function() {
  var svg = document.getElementById('svg');
  var instructions = document.getElementById('instructions');
  var svgRect;
  var hidden = false;
  var isDown = false;

  window.addEventListener('resize', function() {
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });

  function onMove(x, y) {
    if (!hidden && isDown) {
      window.setTimeout(function() {
        instructions.setAttribute('class', 'hide');
      }, 2000);
      hidden = true;
    }
    Mercator.onMove(x, y, svgRect);
  }

  document.body.addEventListener('mousemove', function(e) {
    onMove(e.clientX, e.clientY);
  });
  document.body.addEventListener('touchmove', function(e) {
    e.preventDefault();
    onMove(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  function onDown(x, y) {
    isDown = true;
    Mercator.onDown(x, y, svgRect);
  }

  svg.addEventListener('mousedown', function(e) {
    onDown(e.clientX, e.clientY);
  });
  svg.addEventListener('touchstart', function(e) {
    e.preventDefault();
    onDown(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  });

  function onUp() {
    isDown = false;
    Mercator.onUp();
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

  fetch('data/data-v2.json').then(function(response) {
    return response.json()
  }).then(function(latLongCharts) {
    document.body.classList.remove('loading');
    Mercator.init(latLongCharts, svg);
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });
});
