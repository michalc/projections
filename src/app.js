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
            var chartCoords = [];
            feature.geometry.coordinates[0].forEach(function(longLat) {
              var rotated = Mercator.rotate(longLat[0], longLat[1], offsetLongitude, offsetLatitude);
              var xy = Mercator.toChart(bounds, rotated.long, rotated.lat);
              chartCoords.push(xy);

            });

            path += '<path class="land" d="';
            chartCoords.forEach(function(coord, i) {
              path += (i == 0 ? 'M' : 'L') + Math.round(coord.x) + ',' + Math.round(coord.y);
            });
            path += 'z"/>';

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
        bottom: 665, 
        left: 0,
        right: 1010
      }
    };
  });

})(self.angular);
