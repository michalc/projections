/* global exports */

'use strict';

var Mercator = module.exports;

Mercator.rotate = rotate;
Mercator.getShape = getShape;

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

function getY_top(W, chartBounds) {
  var theta_top = toRadians(chartBounds.earth.top);
  return thetaToY(W, theta_top);
}

function toChart(chartBounds, long, lat, out) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var theta = toRadians(lat);
  var y = thetaToY(W, theta);
  var y_top = getY_top(W, chartBounds);
  var chartY = y_top - y;

  var lambda = toRadians(long);
  var lambda_0 = toRadians(chartBounds.earth.left);
  var x = lambdaToX(W, lambda_0, lambda);
  var chartX = x;

  out[0] = Math.trunc(chartX);
  out[1] = Math.trunc(chartY);
}

// latRotation rotates about y axis (line through earth along original equator)
// longRotation rotates about z axis (line through earth pole to pole)
function rotate(longRotationDegrees, latRotationDegrees, longLat, resultArray, resultOffset) {
  var long = longLat[0];
  var lat = longLat[1];

  // Convert to spherical-polar radian coordinates
  var theeta = toRadians(long);
  var phi = toRadians(lat + 90); // In usual spherical-polar coords, phi is 0 along z-axis

  // Convert to cartesian coordinates (assuming radius of Earth is 1)
  // http://mathworld.wolfram.com/SphericalCoordinates.html
  var sinPhi = Math.sin(phi)
  var x = Math.cos(theeta) * sinPhi;
  var y = Math.sin(theeta) * sinPhi;
  var z = Math.cos(phi);

  // Convert rotation angle to radians
  var rotLong = toRadians(longRotationDegrees);
  var rotLat = toRadians(latRotationDegrees);

  // Rotate about z axis
  var sinRotLong = Math.sin(rotLong);
  var cosRotLong = Math.cos(rotLong);
  var x_r1 = x * cosRotLong - y * sinRotLong;
  var y_r1 = x * sinRotLong + y * cosRotLong;
  var z_r1 = z;

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

  // Convert to lat/long
  var long_r2 = toDegrees(theeta_r2);
  if      (x_r2 < 0 && y_r2 <= 0) long_r2 = long_r2 - 180;
  else if (x_r2 < 0 && y_r2 >= 0) long_r2 = long_r2 + 180;
  var lat_r2 = toDegrees(phi_r2) - 90;

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

var tempCoords = new Float64Array(8 * 2);
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
      toChart(bounds, currLong - 360 * direction, currLat, tempCoords);
      shape += (i == 0 ? 'M' : 'L') + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, currLong - 360 * direction, currLat, tempCoords)
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, currLong - (360 + extraLong) * direction, currLat, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, currLong - (360 + extraLong) * direction, offLat * pole, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, prevLong + (360 + extraLong) * direction, offLat * pole, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, prevLong + (360 + extraLong) * direction, prevLat, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, prevLong + 360 * direction, prevLat, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
      toChart(bounds, currLong, currLat, tempCoords);
      shape += 'L' + tempCoords[0] + ',' + tempCoords[1]
    } else {
      toChart(bounds, currLong, currLat, tempCoords);
      shape += (i == 0 ? 'M' : 'L') + tempCoords[0] + ',' + tempCoords[1]    
    }
  }

  return shape + 'z';
}
