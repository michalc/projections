/* global exports */

'use strict';

var Mercator = module.exports;

Mercator.rotate = rotate;
Mercator.getShape = getShape;
Mercator.toEarth = toEarth;

// Points at infinity on the chart
// get mapped to this
var MAX_BOUND = 99999;

function toRadians(deg) {
  return deg * Math.PI / 180;
}

function toDegrees(rad) {
  return rad * 180 / Math.PI;
}

function thetaToY(W, theta) {
  // Fudge to be able to plot things at (/beyond) pole
  // this is useful since shapes might contain vertices
  // that are at infinity, but still want to plot the ones
  // that aren't
  var theta_adjusted = Math.PI/2 - theta;
  if (0       >= theta) return MAX_BOUND;
  if (Math.PI <= theta) return -MAX_BOUND;
  return W / (2 * Math.PI) * Math.log(Math.tan(Math.PI / 4 + theta_adjusted / 2));
}

function xToLambda(W, lambda_0, x) {
  return lambda_0 + x * 2 * Math.PI / W; 
}

function lambdaToX(W, lambda_0, lambda) {
  return W / (2 * Math.PI) * (lambda - lambda_0);
}

function getY_top(W, chartBounds) {
  var theta_top = toRadians(90 - chartBounds.earth.top);
  return thetaToY(W, theta_top);
}

function toChart(chartBounds, long, lat, out, outOffset) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var theta = toRadians(90 - lat);
  var y = thetaToY(W, theta);
  var y_top = getY_top(W, chartBounds);
  var chartY = y_top - y;

  var lambda = toRadians(long);
  var lambda_0 = toRadians(chartBounds.earth.left);
  var x = lambdaToX(W, lambda_0, lambda);
  var chartX = x;

  out[outOffset] = Math.trunc(chartX);
  out[outOffset + 1] = Math.trunc(chartY);
}

function toEarth(chartBounds, chartX, chartY) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var lambda_0 = toRadians(chartBounds.earth.left);
  var x = chartX;
  var lambda = xToLambda(W, lambda_0, x);
  var long = toDegrees(lambda);

  var y_top = getY_top(W, chartBounds);
  var y = y_top - chartY;
  var theta = 2 * Math.atan(Math.exp(y * 2 * Math.PI / W)) - Math.PI / 2;
  var lat = toDegrees(theta); 

  return {
    long: long,
    lat: lat
  };
}

// longRotation rotates about z axis (line through earth pole to pole)
// latRotation rotates about y axis (line through earth along original equator
function rotate(longRotationDegrees, latRotationDegrees, longLat, resultArray, resultOffset) {
  var long = longLat[0];
  var lat = longLat[1];

  // Rotate about z axis
  var long_r1 = ((long + 180 + longRotationDegrees) % 360) - 180;

  // Convert to spherical-polar radian coordinates
  var theeta_r1 = toRadians(long_r1);
  var phi_r1 = toRadians(90 - lat); // In usual spherical-polar coords, phi is 0 along z-axis

  // Convert to cartesian coordinates (assuming radius of Earth is 1)
  // http://mathworld.wolfram.com/SphericalCoordinates.html
  var sinPhi = Math.sin(phi_r1)
  var x_r1 = Math.cos(theeta_r1) * sinPhi;
  var y_r1 = Math.sin(theeta_r1) * sinPhi;
  var z_r1 = Math.cos(phi_r1);

  // Convert rotation angle to radians
  var rotLat = toRadians(latRotationDegrees);

  // Rotate about y axis
  var sinRotLat = Math.sin(rotLat);
  var cosRotLat = Math.cos(rotLat);
  var x_r2 = x_r1 * cosRotLat + z_r1 * sinRotLat;
  var y_r2 = y_r1;
  var z_r2 = z_r1 * cosRotLat - x_r1 * sinRotLat;

  // +ve / 0 = Infinity, -ve / 0 = -Infinity, and
  // atan works for +- Infinity, but, 0 / 0 = NaN,
  // so we have to handle that case
  var theeta_r2 = x_r2 != 0 || y_r2 != 0 ?  Math.atan(y_r2 / x_r2) : 
                     Object.is(y_r2, -0) ? -Math.PI / 2 :
                                            Math.PI / 2;

  var phi_r2 = Math.acos(z_r2);

  // Convert to long/lat
  var long_r2 = toDegrees(theeta_r2) + (
    (x_r2 < 0 && y_r2 <= 0) ? -180 :
    (x_r2 < 0 && y_r2 >= 0) ?  180 :
    0
  );
  var lat_r2 = 90 - toDegrees(phi_r2);

  resultArray[resultOffset] = long_r2;
  resultArray[resultOffset + 1] = lat_r2;
}

// Fudge to determine is 2 points are discontinuous
var DISCONTINUTY_THREASHOLD = 180;

// 1 for -180 to 180, -1 for 180 to -180
function discontinuityDirection(prev, curr) {
  return Math.abs(prev - curr) > DISCONTINUTY_THREASHOLD && prev * curr < 0 ? (prev < curr ? 1 : -1) : 0;
}

function prev(length, i) {
  return i == 0 ? length - 1 : i - 1;
}

var tempCoords = new Float64Array(8 * 2 * 7);
function getShape(bounds, numCoords, rotatedCoords) {
  // Fairly performance critical

  var minLat = Infinity;
  var maxLat = -Infinity;
  for (var i = 0; i < numCoords; ++i) {
    minLat = Math.min(rotatedCoords[i*2+1], minLat);
    maxLat = Math.max(rotatedCoords[i*2+1], maxLat);
  }

  // Slight hack: pole is determined by the point closest
  var latDiffToSouthPole = Math.abs(-90 - minLat);
  var latDiffToNorthPole = Math.abs(90 - maxLat);
  var pole = latDiffToSouthPole <= latDiffToNorthPole ? -1 : 1;
  var offLat = 88;
  var extraLong = 10;

  var shape = ''
  for (var i = 0; i < numCoords; ++i) {
    var currLong = rotatedCoords[i*2];
    var currLat = rotatedCoords[i*2+1];
    var prevIndex = prev(numCoords, i);
    var prevLong = rotatedCoords[prevIndex*2];
    var prevLat = rotatedCoords[prevIndex*2+1];
    var direction = discontinuityDirection(prevLong, currLong);
    if (direction) {
      toChart(bounds, currLong - 360 * direction, currLat, tempCoords, 0);
      toChart(bounds, currLong - (360 + extraLong) * direction, currLat, tempCoords, 2);
      toChart(bounds, currLong - (360 + extraLong) * direction, offLat * pole, tempCoords, 4);
      toChart(bounds, prevLong + (360 + extraLong) * direction, offLat * pole, tempCoords, 6);
      toChart(bounds, prevLong + (360 + extraLong) * direction, prevLat, tempCoords, 8);
      toChart(bounds, prevLong + 360 * direction, prevLat, tempCoords, 10);
      toChart(bounds, currLong, currLat, tempCoords, 12);
      shape += (i == 0 ? 'M' : 'L') +
              tempCoords[0]  + ',' + tempCoords[1]  +
        'L' + tempCoords[2]  + ',' + tempCoords[3]  +
        'L' + tempCoords[4]  + ',' + tempCoords[5]  +
        'L' + tempCoords[6]  + ',' + tempCoords[7]  +
        'L' + tempCoords[8]  + ',' + tempCoords[9]  +
        'L' + tempCoords[10] + ',' + tempCoords[11] +
        'L' + tempCoords[12] + ',' + tempCoords[13];
    } else {
      toChart(bounds, currLong, currLat, tempCoords, 0);
      shape += (i == 0 ? 'M' : 'L') + tempCoords[0] + ',' + tempCoords[1];
    }
  }

  return shape + 'z';
}
