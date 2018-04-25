/* eslint-env browser */

(function() {
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

  var pathPool = [];
  function getPath(svg, i) {
      var needed = Math.max(i + 1 - pathPool.length, 0);
      var pathElement;
      for (var j = 0; j < needed; ++j) {
        pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathElement.setAttributeNS(null, 'class', 'land');
        pathPool.push(pathElement);
        svg.appendChild(pathElement);
      }
      return pathPool[i];
  };

  var rotatedCoordPool = [];
  function initCharts(charts) {
    for (var i = 0; i < charts.length; ++i) {
      rotatedCoordPool.push(new Float64Array(8 * 2 * charts[i].length));
    }
  }
    
  function createChart(svg, charts, bounds, offsetLongitude, offsetLatitude) {
    for (var j = 0; j < charts.length; ++j) {
      // Fill rotatedCoords
      for (var i = 0; i < charts[j].length; ++i) {
        Mercator.rotate(offsetLongitude, offsetLatitude, charts[j][i], rotatedCoordPool[j], i*2);
      }

      var shape = Mercator.getShape(bounds, charts[j].length, rotatedCoordPool[j]);
      var path = '';
      for (var i = 0; i < shape.length; ++i) {
        path += (i == 0 ? 'M' : 'L') + shape[i].x + ',' + shape[i].y;
      }
      path += 'z';
      var pathElement = getPath(svg, j);
      pathElement.setAttributeNS(null, 'd', path);
    }
  }

  window.addEventListener('load', function() {
    var bounds = {
      earth: {
        top: 83.6,
        bottom: -83.6,
        left: -180,
        right: 180
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

    fetch('data/data.json').then(function(results) {
      charts = results;
      initCharts(charts);
      draw();
      document.body.removeAttribute('class');
    });
  });
})();
