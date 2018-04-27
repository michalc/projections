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

function xToTheta(W, theta_0, x) {
  return theta_0 + x * 2 * Math.PI / W;
}

function getY_top(W, chartBounds) {
  var phi_top = chartBounds.earth.top;
  return phiToY(W, phi_top);
}

function toChart(chartBounds, theta, phi, out, outOffset) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var y = phiToY(W, phi);
  var y_top = getY_top(W, chartBounds);
  var chartY = y_top - y;

  var theta_0 = chartBounds.earth.left;
  var chartX = W / (2 * Math.PI) * (theta - theta_0);

  out[outOffset] = Math.trunc(chartX);
  out[outOffset + 1] = Math.trunc(chartY);
}

function toEarth(chartBounds, chartX, chartY, out, outOffset) {
  var W = chartBounds.screen.right - chartBounds.screen.left;

  var theta_0 = chartBounds.earth.left;
  var x = chartX;
  var theta = xToTheta(W, theta_0, x);

  var y_top = getY_top(W, chartBounds);
  var y = y_top - chartY;
  var phi = Math.PI - 2 * Math.atan(Math.exp(y * 2 * Math.PI / W));

  out[outOffset] = theta;
  out[outOffset + 1] = phi;
}

// longRotation rotates about z axis (line through earth pole to pole)
// latRotation rotates about y axis (line through earth along original equator
function rotate(rot, thetaPhiArray, thetaPhiOffset, resultArray, resultOffset) {
  var theta = thetaPhiArray[thetaPhiOffset];
  var phi = thetaPhiArray[thetaPhiOffset+1];

  // Convert to cartesian coordinates (assuming radius of Earth is 1)
  // http://mathworld.wolfram.com/SphericalCoordinates.html
  var sinPhi = Math.sin(phi)
  var x = Math.cos(theta) * sinPhi;
  var y = Math.sin(theta) * sinPhi;
  var z = Math.cos(phi);

  var x_r = rot[0] * x + rot[1] * y + rot[2] * z;
  var y_r = rot[3] * x + rot[4] * y + rot[5] * z;
  var z_r = rot[6] * x + rot[7] * y + rot[8] * z;

  // +ve / 0 = Infinity, -ve / 0 = -Infinity, and
  // atan works for +- Infinity, but, 0 / 0 = NaN,
  // so we have to handle that case
  var theta_r = x_r != 0 || y_r != 0 ?  Math.atan2(y_r, x_r) :
                  Object.is(y_r, -0) ? -Math.PI / 2 :
                                        Math.PI / 2;

  var phi_r = Math.acos(z_r);

  resultArray[resultOffset] = theta_r;
  resultArray[resultOffset + 1] = phi_r;
}

// Fudge to determine is 2 points are discontinuous
var DISCONTINUTY_THREASHOLD = Math.PI;

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

  var minPhi = Infinity;
  var maxPhi = -Infinity;
  for (var i = 0; i < numCoords; ++i) {
    minPhi = Math.min(rotatedCoords[i*2+1], minPhi);
    maxPhi = Math.max(rotatedCoords[i*2+1], maxPhi);
  }

  // Slight hack: pole is determined by the point closest
  var latDiffToSouthPole = Math.abs(Math.PI - maxPhi);
  var latDiffToNorthPole = Math.abs(minPhi);
  var offPhi = latDiffToSouthPole <= latDiffToNorthPole ? toRadians(90 + 88) : toRadians(90 - 88);
  var extraTheta = toRadians(10);

  var shape = ''
  for (var i = 0; i < numCoords; ++i) {
    var currTheta = rotatedCoords[i*2];
    var currPhi = rotatedCoords[i*2+1];
    var prevIndex = prev(numCoords, i);
    var prevTheta = rotatedCoords[prevIndex*2];
    var prevPhi = rotatedCoords[prevIndex*2+1];
    var direction = discontinuityDirection(prevTheta, currTheta);
    if (direction) {
      toChart(bounds, currTheta - 2*Math.PI * direction, currPhi, tempCoords, 0);
      toChart(bounds, currTheta - (2*Math.PI + extraTheta) * direction, currPhi, tempCoords, 2);
      toChart(bounds, currTheta - (2*Math.PI + extraTheta) * direction, offPhi, tempCoords, 4);
      toChart(bounds, prevTheta + (2*Math.PI + extraTheta) * direction, offPhi, tempCoords, 6);
      toChart(bounds, prevTheta + (2*Math.PI + extraTheta) * direction, prevPhi, tempCoords, 8);
      toChart(bounds, prevTheta + 2*Math.PI * direction, prevPhi, tempCoords, 10);
      toChart(bounds, currTheta, currPhi, tempCoords, 12);
      shape += (i == 0 ? 'M' : 'L') +
              tempCoords[0]  + ',' + tempCoords[1]  +
        'L' + tempCoords[2]  + ',' + tempCoords[3]  +
        'L' + tempCoords[4]  + ',' + tempCoords[5]  +
        'L' + tempCoords[6]  + ',' + tempCoords[7]  +
        'L' + tempCoords[8]  + ',' + tempCoords[9]  +
        'L' + tempCoords[10] + ',' + tempCoords[11] +
        'L' + tempCoords[12] + ',' + tempCoords[13];
    } else {
      toChart(bounds, currTheta, currPhi, tempCoords, 0);
      shape += (i == 0 ? 'M' : 'L') + tempCoords[0] + ',' + tempCoords[1];
    }
  }

  return shape + 'z';
}
