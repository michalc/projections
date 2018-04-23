/* eslint-env browser */

(function() {
  'use strict';

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
  function getPath(i) {
      var needed = Math.max(i + 1 - pathPool.length, 0);
      for (var j = 0; j < needed; ++j) {
        pathPool.push(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
      }
      return pathPool[i];
  };
    
  var g = null;
  function createChart(svg, charts, bounds, offsetLongitude, offsetLatitude) {
    if (g) {
      g.remove();
      g = null;
    }

    var rotate = _.partial(Mercator.rotate, offsetLongitude, offsetLatitude);
    g = _(charts)
      .map(function(chart) {
        return chart.features;
      })
      .flatten()
      .map(function(feature) {
        return feature.geometry.coordinates[0];
      })
      .map(function(coordinates) {
        return _.map(coordinates, rotate);
      })
      .map(_.partial(Mercator.getShapes, bounds))
      .flatten()
      .map(function(shape, i) {
        var path = _.reduce(shape, function(path, chartCoord, i) {
            return path + (i == 0 ? 'M' : 'L') + chartCoord.x + ',' + chartCoord.y;
        }, '') + 'z';
        var pathElement = getPath(i);
        pathElement.setAttributeNS(null, 'class', 'land');
        pathElement.setAttributeNS(null, 'd', path);
        return pathElement;
      })
      .reduce(function(group, pathElement) {
        group.appendChild(pathElement);
        return group;
      }, document.createElementNS('http://www.w3.org/2000/svg', 'g'));

    svg.append(g);
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
      var parent = svg.parentElement;
      var screenBound = Math.min(parent.offsetWidth, parent.offsetHeight);
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
      charts = results;
      draw();
    });
  });
})();
