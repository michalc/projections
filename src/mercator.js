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

function phiToY(W, phi) {
  // Fudge to be able to plot things at (/beyond) pole
  // this is useful since shapes might contain vertices
  // that are at infinity, but still want to plot the ones
  // that aren'ts
  if (0       >= phi) return MAX_BOUND;
  if (Math.PI <= phi) return -MAX_BOUND;
  return W / (2 * Math.PI) * Math.log(Math.tan((Math.PI - phi) / 2));
}

function xToLambda(W, lambda_0, x) {
  return lambda_0 + x * 2 * Math.PI / W; 
}

function getY_top(W, chartBounds) {
  var phi_top = toRadians(90 - chartBounds.earth.top);
  return phiToY(W, phi_top);
}

function toChart(chartBounds, long, lat, out, outOffset) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var phi = toRadians(90 - lat);
  var y = phiToY(W, phi);
  var y_top = getY_top(W, chartBounds);
  var chartY = y_top - y;

  var theta = toRadians(long);
  var theta_0 = toRadians(chartBounds.earth.left);
  var chartX = W / (2 * Math.PI) * (theta - theta_0);

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
function rotate(longRotationDegrees, latRotationDegrees, thetaPhi, resultArray, resultOffset) {
  var theta = thetaPhi[0];
  var phi = thetaPhi[1];

  // Convert rotation angle to radians
  var rotLong = toRadians(longRotationDegrees);

  // Rotate about z axis
  var theta_r1 = ((theta + Math.PI + rotLong) % (2*Math.PI)) - Math.PI;
  var phi_r1 = phi;

  // Convert to cartesian coordinates (assuming radius of Earth is 1)
  // http://mathworld.wolfram.com/SphericalCoordinates.html
  var sinPhi = Math.sin(phi_r1)
  var x_r1 = Math.cos(theta_r1) * sinPhi;
  var y_r1 = Math.sin(theta_r1) * sinPhi;
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
  var theta_r2 = x_r2 != 0 || y_r2 != 0 ?  Math.atan(y_r2 / x_r2) :
                     Object.is(y_r2, -0) ? -Math.PI / 2 :
                                            Math.PI / 2;

  var phi_r2 = Math.acos(z_r2);

  // Convert to long/lat
  var long_r2 = toDegrees(theta_r2) + (
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
