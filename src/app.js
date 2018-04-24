/* eslint-env browser */

(function() {
  'use strict';

  var _ = require('lodash');
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
    
  function createChart(svg, charts, bounds, offsetLongitude, offsetLatitude) {
    for (var j = 0; j < charts.length; ++j) {
      var shape = Mercator.getShape(offsetLongitude, offsetLatitude, bounds, charts[j]);
      var path = _.reduce(shape, function(path, chartCoord, i) {
          return path + (i == 0 ? 'M' : 'L') + chartCoord.x + ',' + chartCoord.y;
      }, '') + 'z';
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
      latitude = latitudeInput.value;
      draw();
    });

    var longitude = parseFloat(longitudeInput.value);
    longitudeInput.addEventListener('input', function() {
      longitude = longitudeInput.value;
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

    Promise.all([fetch('data/GSHHS_c_L1.json'), fetch('data/GSHHS_c_L5.json')]).then(function(results) {
      var mostOfWorld = _(results[0].features)
        .map(function(feature) {
          return feature.geometry.coordinates[0];
        })
        .value();

      var antarticaIslands = _(results[1].features)
        .filter(function(feature) {
          return feature.id > 2;
        })
        .map(function(feature) {
          return feature.geometry.coordinates[0];
        })
        .value();

      var antarticaProper = _(results[1].features)
        .filter(function(feature) {
          return feature.id <= 2;
        })
        .map(function(feature) {
          return feature.geometry.coordinates[0];
        })
        .map(function(featureCoords) {
          // Annoyingly land masses stradding 180 longtidue are split up.
          // This is most obvious in Antartica,  and done by adding in points
          // at the South Pole and after
          var seenSouthPole = false;
          return _.filter(featureCoords, function(coords) {
            seenSouthPole = seenSouthPole || coords[1] == -90;
            return !seenSouthPole;
          });
        })
        .reverse()
        .flatten()
        .value();

      charts = _.flatten([mostOfWorld, antarticaIslands, [antarticaProper]]);
      draw();
      document.body.removeAttribute('class');
    });
  });
})();
