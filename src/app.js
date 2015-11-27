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
            var chartCoordsSet = [];
            feature.geometry.coordinates[0].forEach(function(longLat) {
              var rotated = Mercator.rotate(longLat[0], longLat[1], offsetLongitude, offsetLatitude);
              rotatedCoords.push(rotated);
            });

            // Need to properly display
            // - shapes going over a pole (there can be at most one at each pole)
            // - shapes with points on both side of the map
            //   (shapes going over the pole are examples of these, there are others)


            //Check how many discontinuites of longitude there are
            var DISCONTINUTY_THREASHOLD = 180;
            var numDiscontinuities = 0;
            rotatedCoords.forEach(function(longLat, i) {
              var prev = rotatedCoords[i == 0 ? rotatedCoords.length - 1 : i - 1].long;
              var curr = longLat.long;
              if (Math.abs(prev - curr) > DISCONTINUTY_THREASHOLD && prev * curr < 0) {
                ++numDiscontinuities;
              }
            });

            var shapeOver180 = numDiscontinuities > 0 && numDiscontinuities % 2 == 0;

            if (!shapeOver180) {
              chartCoordsSet[0] = rotatedCoords;
            } else {
              // If the shape goes over the 180 meridian, need 2 copies
              var rotated1 = [];
              var rotated2 = [];
              rotatedCoords.forEach(function(longLat, i) {
                rotated1.push({
                  long: (longLat.long + 360) % 360,
                  lat: longLat.lat
                });
                rotated2.push({
                  long: (longLat.long - 360) % 360,
                  lat: longLat.lat
                });
              });
              chartCoordsSet = [rotated1, rotated2];
            }

            chartCoordsSet.forEach(function(chartCoords) {
              path += '<path class="land" d="';
              chartCoords.forEach(function(coord, i) {
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
