/* global exports */

'use strict';

var Mercator = module.exports;
Mercator.init = init;
Mercator.onUp = onUp;
Mercator.onMove = onMove;
Mercator.onDown = onDown;
Mercator.setBounds = setBounds;

// Points at infinity on the chart
// get mapped to this
var MAX_BOUND = 99999;

var bounds = {
  earth: {
    top: toRadians(90 - 83.6),
    left: toRadians(-180)
  },
  screen: {
    top: 0,
    bottom: 740,
    left: 0,
    right: 800
  }
};

var rotationMatrix = new Float64Array(9);
rotationMatrix[0] = 1;
rotationMatrix[4] = 1;
rotationMatrix[8] = 1;

var rotationMatrixExtra = new Float64Array(9);
var rotationMatrixCombined = new Float64Array(9);

var draggingPointFrom = new Float64Array(2);
var draggingPointTo = new Float64Array(2);
var path;
var bounds;
var rotatedCoords;
var charts;

var mousedown = false;

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

function getY_top(W) {
  var phi_top = bounds.earth.top;
  return phiToY(W, phi_top);
}

function toChart(theta, phi, out, outOffset) {
  var W = bounds.screen.right - bounds.screen.left;

  var y = phiToY(W, phi);
  var y_top = getY_top(W);
  var chartY = y_top - y;

  var theta_0 = bounds.earth.left;
  var chartX = W / (2 * Math.PI) * (theta - theta_0);

  out[outOffset] = Math.trunc(chartX);
  out[outOffset + 1] = Math.trunc(chartY);
}

function toEarth(chartX, chartY, out, outOffset) {
  var W = bounds.screen.right - bounds.screen.left;

  var theta_0 = bounds.earth.left;
  var x = chartX;
  var theta = xToTheta(W, theta_0, x);

  var y_top = getY_top(W);
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

// Needs to be able to handle a single shape's coords
var tempCoords = new Float64Array(1024 * 10);
function getShape(numCoords, rotatedCoords) {
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

  var tempCoordsOffset = 0;
  for (var i = 0; i < numCoords; ++i) {
    var currTheta = rotatedCoords[i*2];
    var currPhi = rotatedCoords[i*2+1];
    var prevIndex = prev(numCoords, i);
    var prevTheta = rotatedCoords[prevIndex*2];
    var prevPhi = rotatedCoords[prevIndex*2+1];
    var direction = discontinuityDirection(prevTheta, currTheta);
    if (direction) {
      toChart(currTheta - 2*Math.PI * direction, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(currTheta - (2*Math.PI + extraTheta) * direction, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(currTheta - (2*Math.PI + extraTheta) * direction, offPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + (2*Math.PI + extraTheta) * direction, offPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + (2*Math.PI + extraTheta) * direction, prevPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + 2*Math.PI * direction, prevPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(currTheta, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
    } else {
      toChart(currTheta, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
    }
  }

  var newNumCoords = tempCoordsOffset / 2;
  var shape = ''
  tempCoordsOffset = 0;
  for (var i = 0; i < newNumCoords; ++i) {
    shape += (i == 0 ? 'M' : 'L') + tempCoords[tempCoordsOffset]  + ',' + tempCoords[tempCoordsOffset + 1];
    tempCoordsOffset += 2;
  }

  return shape + 'z';
}

function fillRotationMatrixFromTo(rotationMatrix, a, b) {
  var a_theta = a[0];
  var a_phi = a[1];
  var a_sinPhi = Math.sin(a_phi)
  var a_1 = Math.cos(a_theta) * a_sinPhi;
  var a_2 = Math.sin(a_theta) * a_sinPhi;
  var a_3 = Math.cos(a_phi);

  var b_theta = b[0];
  var b_phi = b[1];
  var b_sinPhi = Math.sin(b_phi)
  var b_1 = Math.cos(b_theta) * b_sinPhi;
  var b_2 = Math.sin(b_theta) * b_sinPhi;
  var b_3 = Math.cos(b_phi);

  // Dot product
  var c = a_1 * b_1 + a_2 * b_2 + a_3 * b_3;
  var c_coef = 1 / (1 + c);

  // Cross product
  var v_1 = a_2 * b_3 - a_3 * b_2;
  var v_2 = a_3 * b_1 - a_1 * b_3;
  var v_3 = a_1 * b_2 - a_2 * b_1;

  var v_1_v_1 = v_1 * v_1;
  var v_1_v_2 = v_1 * v_2;
  var v_1_v_3 = v_1 * v_3;
  var v_2_v_2 = v_2 * v_2;
  var v_2_v_3 = v_2 * v_3;
  var v_3_v_3 = v_3 * v_3;

  rotationMatrix[0] = 1    + c_coef * (-v_3_v_3 - v_2_v_2);
  rotationMatrix[1] = -v_3 + c_coef * v_1_v_2;
  rotationMatrix[2] = v_2  + c_coef * v_1_v_3;
  rotationMatrix[3] = v_3  + c_coef * v_1_v_2;
  rotationMatrix[4] = 1    + c_coef * (-v_3_v_3 - v_1_v_1);
  rotationMatrix[5] = -v_1 + c_coef * v_2_v_3;
  rotationMatrix[6] = -v_2 + c_coef * v_1_v_3;
  rotationMatrix[7] = v_1  + c_coef * v_2_v_3;
  rotationMatrix[8] = 1    + c_coef * (-v_2_v_2 - v_1_v_1);
}

function multiply(target, b, a) {
  target[0] = b[0]*a[0] + b[1]*a[3] + b[2]*a[6];
  target[1] = b[0]*a[1] + b[1]*a[4] + b[2]*a[7];
  target[2] = b[0]*a[2] + b[1]*a[5] + b[2]*a[8];
  target[3] = b[3]*a[0] + b[4]*a[3] + b[5]*a[6];
  target[4] = b[3]*a[1] + b[4]*a[4] + b[5]*a[7];
  target[5] = b[3]*a[2] + b[4]*a[5] + b[5]*a[8];
  target[6] = b[6]*a[0] + b[7]*a[3] + b[8]*a[6];
  target[7] = b[6]*a[1] + b[7]*a[4] + b[8]*a[7];
  target[8] = b[6]*a[2] + b[7]*a[5] + b[8]*a[8];
}

function draw(svg, rotationMatrix) {
  var shape = '';
  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    var numCoords = charts[j].length / 2;
    for (var i = 0; i < numCoords; ++i) {
      rotate(rotationMatrix, charts[j], i*2, rotatedCoords, i*2);
    }
    shape += getShape(numCoords, rotatedCoords);
  }
  shape += 'z';
  path.setAttributeNS(null, 'd', shape);
}

function drawFromTo() {
  if (!charts) return;
  fillRotationMatrixFromTo(rotationMatrixExtra, draggingPointFrom, draggingPointTo);
  multiply(rotationMatrixCombined, rotationMatrixExtra, rotationMatrix);
  draw(svg, rotationMatrixCombined);
}

function onMove(x, y, svgRect) {
  if (!charts || !mousedown) return;
  var chartX = x - svgRect.left;
  var chartY = y - svgRect.top;
  toEarth(chartX, chartY, draggingPointTo, 0);
  drawFromTo();   
}

function onDown(x, y, svgRect) {
  if (mousedown) return;
  mousedown = true;
  var chartX = x - svgRect.left;
  var chartY = y - svgRect.top;
  toEarth(chartX, chartY, draggingPointFrom, 0);
}

function onUp() {
  mousedown = false;
  rotationMatrix.set(rotationMatrixCombined);
  draggingPointFrom.set(draggingPointTo);
}

function setBounds(width, height) {
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  bounds.screen.right = width;
  bounds.screen.bottom = height;
  drawFromTo();
}

function init(latLongCharts, svg) {
  charts = latLongCharts.map(function(shape) {
    var shapeCoords = new Float64Array(shape.length * 2);
    for (var i = 0; i < shape.length; ++i) {
      var long = shape[i][0];
      var lat = shape[i][1];
      var theta = toRadians(long);
      var phi = toRadians(90 - lat);
      shapeCoords[i*2] = theta;
      shapeCoords[i*2 + 1] = phi;
    }
    return shapeCoords;
  });

  var maxLength = -Infinity;
  path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttributeNS(null, 'class', 'land');
  svg.appendChild(path);
  for (var i = 0; i < charts.length; ++i) {
    maxLength = Math.max(charts[i].length / 2, maxLength);
  }
  rotatedCoords = new Float64Array(8 * 2 * maxLength);
}
