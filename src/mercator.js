/* global exports */

'use strict';

var Mercator = module.exports;
Mercator.init = init;
Mercator.onUp = onUp;
Mercator.onMove = onMove;
Mercator.onDown = onDown;
Mercator.setBounds = setBounds;

// SVG coordinates are only output as integers. To allow sub-pixel rendering
// for small features, we multiply the viewbox by this factor.
// An alternative would be to allow non-integer SVG coordinates, but
// float -> string is _much_ slower than int -> string
var SVG_SCALE = 100;

// Points at infinity on the chart
// get mapped to this
var MAX_BOUND = 99999;

var BOUNDS_EARTH_TOP = toRadians(90 - 83.6);
var BOUNDS_EARTH_LEFT = toRadians(-180);
var BOUNDS_SCREEN_TOP = 0;
var BOUNDS_SCREEN_BOTTOM;
var BOUNDS_SCREEN_LEFT = 0;
var BOUNDS_SCREEN_RIGHT;

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

var coordsString = new Uint8Array(200000);
var decoder = new TextDecoder();
var digitsReversed = new Uint8Array(6);
var ASCII_ZERO = 48;
var ASCII_MINUS = 45;
var ASCII_M = 77;
var ASCII_L = 76;
var ASCII_z = 122;
var ASCII_comma = 44;


function toRadians(deg) {
  return deg * Math.PI / 180;
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
  var phi_top = BOUNDS_EARTH_TOP
  return phiToY(W, phi_top);
}

function toChart(theta, phi, out, outOffset) {
  var W = BOUNDS_SCREEN_RIGHT - BOUNDS_SCREEN_LEFT;

  var y = phiToY(W, phi);
  var y_top = getY_top(W);
  var chartY = y_top - y;

  var theta_0 = BOUNDS_EARTH_LEFT;
  var chartX = W / (2 * Math.PI) * (theta - theta_0);

  out[outOffset] = Math.trunc(chartX);
  out[outOffset + 1] = Math.trunc(chartY);
}

function toEarth(chartX, chartY, out, outOffset) {
  var W = BOUNDS_SCREEN_RIGHT - BOUNDS_SCREEN_LEFT;

  var theta_0 = BOUNDS_EARTH_LEFT;
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
  // atan2 works for +- Infinity
  var theta_r = Math.atan2(y_r, x_r);

  var phi_r = Math.acos(z_r);

  resultArray[resultOffset] = theta_r;
  resultArray[resultOffset + 1] = phi_r;
}

function concatInteger(integer, string, stringOffset) {
  var offset = 0;
  if (integer < 0) {
    string[stringOffset] = ASCII_MINUS;
    ++stringOffset;
  }
  integer = Math.abs(integer);

  while (integer > 0 || offset == 0) {
    digitsReversed[offset] = ASCII_ZERO + integer % 10;
    ++offset;
    integer = (integer/10)|0;
  }

  for (var i = 0; i < offset; ++i) {
    string[stringOffset] = digitsReversed[offset - i - 1];
    ++stringOffset
  }

  return stringOffset;
}

// Fudge to determine is 2 points are discontinuous
var DISCONTINUTY_THREASHOLD = Math.PI;

// Needs to be able to handle a single shape's coords
var tempCoords = new Int32Array(1024 * 10);
function getShape(numCoords, rotatedCoords, coordsString, coordsStringOffset) {
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
    var offset = i * 2;
    var currTheta = rotatedCoords[offset];
    var currPhi = rotatedCoords[offset+1];
    var prevIndex = i == 0 ? numCoords - 1 : i - 1;
    var prevOffset = prevIndex*2;
    var prevTheta = rotatedCoords[prevOffset];
    var prevPhi = rotatedCoords[prevOffset+1];

    // 1 for -180 to 180, -1 for 180 to -180
    var direction = Math.abs(prevTheta - currTheta) > DISCONTINUTY_THREASHOLD && prevTheta * currTheta < 0 ? (prevTheta < currTheta ? 1 : -1) : 0;
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
  tempCoordsOffset = 0;
  for (var i = 0; i < newNumCoords; ++i) {
    coordsString[coordsStringOffset] = (i == 0) ? ASCII_M : ASCII_L;
    ++coordsStringOffset;
    coordsStringOffset = concatInteger(tempCoords[tempCoordsOffset], coordsString, coordsStringOffset);
    ++tempCoordsOffset;
    coordsString[coordsStringOffset] = ASCII_comma
    ++coordsStringOffset;
    coordsStringOffset = concatInteger(tempCoords[tempCoordsOffset], coordsString, coordsStringOffset);
    ++tempCoordsOffset;
  }
  coordsString[coordsStringOffset] = ASCII_z;
  ++coordsStringOffset;

  return coordsStringOffset
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
  var coordsStringOffset = 0;
  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    var numCoords = charts[j].length / 2;
    for (var i = 0; i < numCoords; ++i) {
      rotate(rotationMatrix, charts[j], i*2, rotatedCoords, i*2);
    }
    coordsStringOffset = getShape(numCoords, rotatedCoords, coordsString, coordsStringOffset);
  }
  path.setAttributeNS(null, 'd', decoder.decode(new Uint8Array(coordsString.buffer, 0, coordsStringOffset)));
}

function drawFromTo() {
  if (!charts) return;
  fillRotationMatrixFromTo(rotationMatrixExtra, draggingPointFrom, draggingPointTo);
  multiply(rotationMatrixCombined, rotationMatrixExtra, rotationMatrix);
  draw(svg, rotationMatrixCombined);
}

function onMove(x, y, svgRect) {
  if (!charts || !mousedown) return;
  var chartX = (x - svgRect.left) * SVG_SCALE;
  var chartY = (y - svgRect.top) * SVG_SCALE;
  toEarth(chartX, chartY, draggingPointTo, 0);
  drawFromTo();   
}

function onDown(x, y, svgRect) {
  if (mousedown) return;
  mousedown = true;
  var chartX = (x - svgRect.left) * SVG_SCALE;
  var chartY = (y - svgRect.top) * SVG_SCALE;
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
  svg.setAttribute('viewBox', '0 0 ' + (width * SVG_SCALE) + ' ' + (height * SVG_SCALE));
  BOUNDS_SCREEN_RIGHT = width * SVG_SCALE;
  BOUNDS_SCREEN_BOTTOM = height * SVG_SCALE;
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
