/* eslint-env browser */

(function(angular) {
  'use strict';

  function clamp(val, min, max) {
    return Math.max(Math.min(val, max), min);
  }

  var app = angular.module('projections', []);

  app.factory('Mercator', function($window) {
    return $window.Mercator;
  });

  app.controller('MercatorController', function($scope, Mercator) {
    $scope.chart = {
      src: 'data/world.svg',
      projection: 'mercator',
      bounds: {
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
      }
    };
  });

})(self.angular);
