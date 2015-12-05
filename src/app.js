/* eslint-env browser */

(function(angular) {
  'use strict';

  var app = angular.module('projections', []);

  app.factory('Mercator', function($window) {
    return $window.Mercator;
  });

  app.directive('ngModelInt', function() {
    return {
      require: 'ngModel',
      link: function(scope, element, attrs, ngModelController) {
        ngModelController.$parsers.push(function(value) {
          return parseInt(value);
        });
      }
    };
  });

  app.directive('chart', function(Mercator) {
    return {
      restrict:'E',
      scope: true,
      template: function(tElement, tAttrs) {
        return '' + 
          '<div>' +
            '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
              'width="' + tAttrs.width + '" height="' + tAttrs.height + '"' +
            '></svg>' +
          '</div>';
      },
      link: function(scope, element, attrs) {
        var svg = element.find('svg');
        var g = null;
        var bounds = scope.$eval(attrs.chartBounds);

        // Would it be faster to edit the existing one?
        function createChart(chart, offsetLongitude, offsetLatitude) {
          if (!chart || typeof offsetLongitude != 'number' || typeof offsetLatitude != 'number')  return;
          if (g) {
            g.remove();
            g = null;
          }
          var t1 = performance.now();
          var path = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1"><g>';

          chart.features.forEach(function(feature) {
            var rotatedCoords = [];
            var shapes = [];
            feature.geometry.coordinates[0].forEach(function(longLat) {
              var rotated = Mercator.rotate(longLat[0], longLat[1], offsetLongitude, offsetLatitude);
              rotatedCoords.push(rotated);
            });

            // 1 for -180 to 180, -1 for 180 to -180
            function discontinuityDirection(prev, curr) {
              return Math.abs(prev - curr) > DISCONTINUTY_THREASHOLD && prev * curr < 0 ? (prev < curr ? 1 : -1) : 0;
            }

            // Returns the segments points including either side of any discontiuity
            function segmentCoords(segment) {
              var coords = [];
              var i = segment.in;
              while (i != segment.out) {
                coords.push(rotatedCoords[i]);
                i = (i + 1) % rotatedCoords.length;
              }
              return coords;
            }

            // Fudge to determine is 2 points are discontinuous
            var DISCONTINUTY_THREASHOLD = 180;

            // Array of objects describing discontinuities in the path
            // described by the point after the discontinuity
            //   index:     where in the path it occurs
            //   longLat:   coords of the point
            //   direction: 1 is -ve to +ve, -1 is +ve to -ve 
            var discontinuities = [];

            // Find discontinuities
            rotatedCoords.forEach(function(longLat, i) {
              var prevIndex = i == 0 ? rotatedCoords.length - 1 : i - 1;
              var prev = rotatedCoords[prevIndex].long;
              var curr = longLat.long;
              var direction = discontinuityDirection(prev, curr);
              if (direction) {
                discontinuities.push({
                  index: i,
                  longLat: longLat,
                  direction: direction
                });
              }
            });

            // Array of objects describing the types of segments in the path
            //   type:       0 is simple with no discontinuities (must be the only one in path)
            //               1 is one that goes all the way around the earth
            //               2 shape that goes up to + beyond an edge
            //   in:         index of in point
            //   inCoords:   coords on in point,
            //   inEdge:     +ve or -ve edge of inPoint
            //   out:        index of out point (not inclusive)
            //   outCoords:  coords of out point
            //   coords:     set of all coords that make the path
            var segments = [];

            // No discontinuites mean the segment must be simple
            if (!discontinuities.length) {
              segments.push({
                type: 0,
                in: 0,
                inCoords: rotatedCoords[0],
                out: 0,
                outCoords: rotatedCoords[0],
                coords: rotatedCoords
              });
            }

            // Find segment types by comparing discontinuities
            discontinuities.forEach(function(discon, i) {
              var prevIndex = i == 0 ? discontinuities.length - 1 : i - 1;
              var nextIndex = (i + 1) % discontinuities.length;
              var prev = discontinuities[prevIndex];
              var curr = discon;
              var type = prev.direction == curr.direction ? 1 : 2;
              var segment = {
                type: type,
                in: prev.index,
                out: curr.index,
                inCoords: prev.longLat,
                outCoords: curr.longLat,
                coords: null
              };
              segment.coords = segmentCoords(segment);
              segments.push(segment);
            });

            // Combine the segments into separate shapes
            segments.forEach(function(segment) {
              shapes.push({
                coords: segment.coords
              });
            });

            shapes.forEach(function(shape, i) {
              path += '<path class="land" d="';
              shape.coords.forEach(function(coord, i) {
                var xy = Mercator.toChart(bounds, coord.long, coord.lat);
                var chartX = Math.round(xy.x);
                var chartY =  Math.round(xy.y);
                path += (i == 0 ? 'M' : 'L') + chartX + ',' + chartY;
              });
              path += 'z"/>';
            })
          });
          path += '</g></svg>';
          var t2 = performance.now();
          console.info(Math.round((t2 - t1) * 1000) / 1000, 'milliseconds to create text SVG element');
          var content = new DOMParser().parseFromString(path, 'text/xml');
          g = content.children[0].children[0];
          svg.append(g);
          var t3 = performance.now();
          console.info(Math.round((t3 - t2) * 1000) / 1000, 'milliseconds to append to document');
        }

        scope.$watchGroup([attrs.chart, function() {
          return scope.$eval(attrs.offsets).longitude;
        }, function() {
          return scope.$eval(attrs.offsets).latitude;
        }], function(group) {
          createChart(group[0], group[1], group[2]);
        });
      }
    };
  });

  app.controller('ProjectionsController', function($http, $scope, Mercator) {
    $scope.chart = null;
    $http.get('data/GSHHS_c_L1.json').then(function(results) {
      $scope.chart = results.data;
    });

    $scope.offsets = {
      longitude: 0,
      latitude: 0
    };

    $scope.bounds = {
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
  });

})(self.angular);
