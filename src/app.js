/* eslint-env browser */

(function(angular) {
  'use strict';

  var app = angular.module('projections', []);

  app.factory('Mercator', function($window) {
    return $window.Mercator;
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
        var bounds = scope.$eval(attrs.chartBounds);

        scope.$watch(attrs.chart, function(chart) {
          if (!chart) return;
          var t1 = performance.now();
          var path = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1"><g>';
          chart.features.forEach(function(feature) {
            var chartCoords = [];
            feature.geometry.coordinates[0].forEach(function(longLat) {
              chartCoords.push(Mercator.toChart(bounds, longLat[0], longLat[1]));
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
          var g = content.children[0].children[0];
          svg.append(g);
          var t3 = performance.now();
          console.info(Math.round((t3 - t2) * 1000) / 1000, 'milliseconds to append to document');
        });
      }
    };
  });

  app.controller('ProjectionsController', function($http, $scope, Mercator) {
    $scope.chart = null;
    $http.get('data/GSHHS_c_L1.json').then(function(results) {
      $scope.chart = results.data;
    });

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
