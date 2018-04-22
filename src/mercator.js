/* global exports */

(function(Mercator) {
  Mercator.toChart = toChart;
  Mercator.rotate = rotate;

  // Points at infinity on the chart
  // get mapped to this
  var MAX_BOUND = 99999;

  function toRadians(deg) {
    return deg * Math.PI / 180;
  }

  function toDegrees(rad) {
    return rad * 180 / Math.PI;
  }

  function yToTheta(W, y) {
    return 2 * Math.atan(Math.exp(y * 2 * Math.PI / W)) - Math.PI / 2;
  }

  function thetaToY(W, theta) {
    // Fudge to be able to plot things at (/beyond) pole
    // this is useful since shapes might contain vertices
    // that are at infinity, but still want to plot the ones
    // that aren't
    if (theta >= Math.PI / 2) return MAX_BOUND;
    if (theta <= -Math.PI / 2) return -MAX_BOUND;
    return W / (2 * Math.PI) * Math.log(Math.tan(Math.PI / 4 + theta / 2));
  }

  function xToLambda(W, lambda_0, x) {
    return lambda_0 + x * 2 * Math.PI / W; 
  }

  function lambdaToX(W, lambda_0, lambda) {
    return W / (2 * Math.PI) * (lambda - lambda_0);
  }

  function getW(chartBounds) {
    return chartBounds.screen.right - chartBounds.screen.left;
  }

  function getLambda_0(chartBounds) {
    return toRadians(chartBounds.earth.left);
  }

  function getY_top(chartBounds) {
    var W = getW(chartBounds);
    var theta_top = toRadians(chartBounds.earth.top);
    return thetaToY(W, theta_top);
  }

  function toChart(chartBounds, long, lat) {
    var W = getW(chartBounds);

    var theta = toRadians(lat);
    var y = thetaToY(W, theta);
    var y_top = getY_top(chartBounds);
    var chartY = y_top - y;

    var lambda = toRadians(long);
    var lambda_0 = getLambda_0(chartBounds);
    var x = lambdaToX(W, lambda_0, lambda);
    var chartX = x;

    return {
      x: chartX,
      y: chartY
    };
  }

  // latRotation rotates about y axis (line through earth along original equator)
  // longRotation rotates about z axis (line through earth pole to pole)
  function rotate(longRotationDegrees, latRotationDegrees, long, lat) {
    // Convert to spherical-polar radian coordinates
    var theeta = toRadians(long);
    var phi = toRadians(lat + 90); // In usual spherical-polar coords, phi is 0 along z-axis

    // Convert to cartesian coordinates (assuming radius of Earth is 1)
    // http://mathworld.wolfram.com/SphericalCoordinates.html
    var x = Math.cos(theeta) * Math.sin(phi);
    var y = Math.sin(theeta) * Math.sin(phi);
    var z = Math.cos(phi);

    // Convert rotation angle to radians
    var rotLong = toRadians(longRotationDegrees);
    var rotLat = toRadians(latRotationDegrees);

    // Rotate about z axis
    var x_r1 = x * Math.cos(rotLong) - y * Math.sin(rotLong);
    var y_r1 = x * Math.sin(rotLong) + y * Math.cos(rotLong);
    var z_r1 = z;

    // Rotate about y axis
    var x_r2 = x_r1 * Math.cos(rotLat) + z_r1 * Math.sin(rotLat);
    var y_r2 = y_r1;
    var z_r2 = z_r1 * Math.cos(rotLat) - x_r1 * Math.sin(rotLat);

    // +ve / 0 = Infinity, -ve / 0 = -Infinity, and
    // atan works for +- Infinity, so no need to handle division by 2 case
    var theeta_r2 = Math.atan(y_r2 / x_r2);
    var phi_r2 = Math.acos(z_r2);

    // Convert to lat/long
    var long_r2 = toDegrees(theeta_r2);
    if      (x_r2 < 0 && y_r2 <= 0) long_r2 = long_r2 - 180;
    else if (x_r2 < 0 && y_r2 >= 0) long_r2 = long_r2 + 180;
    var lat_r2 = toDegrees(phi_r2) - 90;

    return {
      long: long_r2,
      lat: lat_r2
    };
  }
})(typeof exports === 'undefined' ? this.Mercator = {} : exports);
