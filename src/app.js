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

function removeClass(el, className) {
  var classNameReg = new RegExp('(\\s|^)' + className + '(\\s|$)')
  el.className = el.className.replace(classNameReg, ' ');
}

window.addEventListener('load', function() {
  var svg = document.getElementById('svg');
  var instructions = document.getElementById('instructions');
  var svgRect;

  window.addEventListener('resize', function() {
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });

  var hidden = false;
  var isDown = false;
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

  document.body.addEventListener('mousedown', function(e) {
    onDown(e.clientX, e.clientY);
  });
  document.body.addEventListener('touchstart', function(e) {
    e.preventDefault();
    onDown(e.clientX, e.clientY);
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

  fetch('data/data.json').then(function(latLongCharts) {
    removeClass(document.body, 'loading');
    Mercator.init(latLongCharts, svg);
    var dimension = Math.min(window.innerWidth, window.innerHeight);
    Mercator.setBounds(dimension, dimension);
    svgRect = svg.getBoundingClientRect();
  });
});
