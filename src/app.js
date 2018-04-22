/* eslint-env browser */

(function(angular) {
  'use strict';

  var app = angular.module('projections', []);

  app.factory('Mercator', function($window) {
    return $window.Mercator;
  });

  app.directive('ngModelFloat', function() {
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

        // Would it be faster to edit the existing one?
        function createChart(chart, offsetLongitude, offsetLatitude) {
          if (g) {
            g.remove();
            g = null;
          }

          var rotate = _.partial(Mercator.rotate, offsetLongitude, offsetLatitude);
          var t1 = performance.now();
          var allShapes = _(chart.features)
            .map(function(feature) {
              return feature.geometry.coordinates[0];
            })
            .map(function(coordinates) {
              return _.map(coordinates, rotate);
            })
            .map(_.partial(Mercator.getShapes, bounds))
            .flatten();

          var path = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1"><g>' 
            + allShapes.reduce(function(pathForShapes, shape) {
              return pathForShapes
                + '<path class="land" d="'
                + _.map(shape, function(chartCoord, i) {
                    return (i == 0 ? 'M' : 'L') + chartCoord.x + ',' + chartCoord.y;
                }).join()
                + 'z"/>';
            }, '')
            + '</g></svg>';

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
  });

})(self.angular);
