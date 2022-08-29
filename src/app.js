/* eslint-env browser */

'use strict';

var Mercator = require('./mercator');

document.addEventListener('DOMContentLoaded', function() {
  var svg = document.getElementsByTagName('svg')[0];
  var instructions = document.getElementsByTagName('p')[0];
  var svgRect;
  var hidden = false;
  var isDown = false;

  function setSize() {
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  }
  window.addEventListener('resize', setSize);

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
    onDown(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  }, {passive: true});

  function onUp() {
    isDown = false;
    Mercator.onUp();
  }
  document.body.addEventListener('mouseup', onUp);
  document.body.addEventListener('touchend', onUp);
  document.body.addEventListener('touchcancel', onUp);

  Mercator.init(window.data, svg);
  setSize();
});
