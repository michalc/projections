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

  var pathPool = [];
  function getPath(i) {
      var needed = Math.max(i + 1 - pathPool.length, 0);
      for (var j = 0; j < needed; ++j) {
        pathPool.push(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
      }
      return pathPool[i];
  };

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
          g = _(chart.features)
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
