/* global exports */

'use strict';

var Mercator = module.exports;
Mercator.init = init;
Mercator.onUp = onUp;
Mercator.onMove = onMove;
Mercator.onDown = onDown;
Mercator.setBounds = setBounds;

var svg;

var PI = Math.PI;
var PI_2 = PI * 2;
var W_over_PI_2;
var PI_2_over_W;

// SVG coordinates are only output as integers. To allow sub-pixel rendering
// for small features, we multiply the viewbox by this factor.
// An alternative would be to allow non-integer SVG coordinates, but
// float -> string is _much_ slower than int -> string
var SVG_SCALE = 100;

var CROP_LAT = 5;
var BOUNDS_EARTH_TOP = toRadians(CROP_LAT);
var BOUNDS_EARTH_BOTTOM = toRadians(180 - CROP_LAT);
var BOUNDS_EARTH_LEFT = toRadians(-180);
var BOUNDS_SCREEN_TOP = 0;
var BOUNDS_SCREEN_LEFT = 0;
var BOUNDS_SCREEN_RIGHT;
var Y_TOP = phiToY(BOUNDS_EARTH_TOP);
var Y_BOTTOM = phiToY(BOUNDS_EARTH_BOTTOM);
var CHART_Y_PER_Y;
var Y_PER_CHART_Y;
var W;

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
var decoder = new TextDecoder('ascii');
var digitsReversed = new Uint8Array(6);
var ASCII_ZERO = 48;
var ASCII_MINUS = 45;
var ASCII_M = 77;
var ASCII_L = 76;
var ASCII_z = 122;
var ASCII_comma = 44;

function toRadians(deg) {
  return deg * PI / 180;
}

function phiToY(phi) {
  return Math.log(Math.tan((PI - phi) / 2));
}

function xToTheta(theta_0, x) {
  return theta_0 + x * PI_2_over_W;
}

function toChart(theta, phi, out, outOffset) {
  var y = phiToY(phi);
  var chartY = (Y_TOP - y) * CHART_Y_PER_Y;

  var theta_0 = BOUNDS_EARTH_LEFT;
  var chartX = W_over_PI_2 * (theta - theta_0);

  out[outOffset] = Math.trunc(chartX);
  out[outOffset + 1] = Math.trunc(chartY);
}

function toEarth(chartX, chartY, out, outOffset) {
  var theta_0 = BOUNDS_EARTH_LEFT;
  var x = chartX;
  var theta = xToTheta(theta_0, x);

  var y = Y_TOP - chartY * Y_PER_CHART_Y;
  var phi = PI - 2 * Math.atan(Math.exp(y));

  out[outOffset] = theta;
  out[outOffset + 1] = phi;
}

function rotate(rot, xzyArray, xyzOffset, resultArray, resultOffset) {
  var x = xzyArray[xyzOffset];
  var y = xzyArray[xyzOffset+1];
  var z = xzyArray[xyzOffset+2];

  var x_r = rot[0] * x + rot[1] * y + rot[2] * z;
  var y_r = rot[3] * x + rot[4] * y + rot[5] * z;
  var z_r = rot[6] * x + rot[7] * y + rot[8] * z;

  // +ve / 0 = Infinity, -ve / 0 = -Infinity, and
  // atan2 works for +- Infinity
  resultArray[resultOffset] = Math.atan2(y_r, x_r); // theta_r
  resultArray[resultOffset + 1] = Math.acos(z_r);   // phi_r
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

  var maxOffset = stringOffset + offset;
  for (; stringOffset < maxOffset; ++stringOffset) {
    string[stringOffset] = digitsReversed[maxOffset - stringOffset - 1];
  }

  return stringOffset;
}

// Fudge to determine is 2 points are discontinuous
var DISCONTINUTY_THREASHOLD = PI;

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
  var latDiffToSouthPole = Math.abs(PI - maxPhi);
  var latDiffToNorthPole = Math.abs(minPhi);
  var offPhi = latDiffToSouthPole <= latDiffToNorthPole ? toRadians(90 + 88) : toRadians(90 - 88);

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
      toChart(currTheta - PI_2 * direction, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(currTheta - PI_2 * direction, currPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(currTheta - PI_2 * direction, offPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + PI_2 * direction, offPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + PI_2 * direction, prevPhi, tempCoords, tempCoordsOffset);
      tempCoordsOffset += 2;
      toChart(prevTheta + PI_2 * direction, prevPhi, tempCoords, tempCoordsOffset);
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

function draw(rotationMatrix) {
  var coordsStringOffset = 0;
  for (var j = 0; j < charts.length; ++j) {
    // Fill rotatedCoords
    var numCoords = charts[j].length / 3;
    for (var i = 0; i < numCoords; ++i) {
      rotate(rotationMatrix, charts[j], i*3, rotatedCoords, i*2);
    }
    coordsStringOffset = getShape(numCoords, rotatedCoords, coordsString, coordsStringOffset);
  }
  path.setAttributeNS(null, 'd', decoder.decode(new Uint8Array(coordsString.buffer, 0, coordsStringOffset)));
}

function drawFromTo() {
  if (!charts) return;
  fillRotationMatrixFromTo(rotationMatrixExtra, draggingPointFrom, draggingPointTo);
  multiply(rotationMatrixCombined, rotationMatrixExtra, rotationMatrix);
  draw(rotationMatrixCombined);
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
  svg.setAttribute('viewBox', '0 0 ' + (width * SVG_SCALE) + ' ' + (height * SVG_SCALE));
  BOUNDS_SCREEN_RIGHT = width * SVG_SCALE;
  W = BOUNDS_SCREEN_RIGHT - BOUNDS_SCREEN_LEFT;
  PI_2_over_W = PI_2 / W;
  W_over_PI_2 = W / PI_2;
  CHART_Y_PER_Y = (height * SVG_SCALE) / (Y_TOP - Y_BOTTOM);
  Y_PER_CHART_Y = (Y_TOP - Y_BOTTOM) / (height * SVG_SCALE);

  drawFromTo();
}

function init(latLongCharts, _svg) {
  svg = _svg;
  charts = latLongCharts.map(function(shape) {
    var shapeCoords = new Float64Array(shape.length * 3);
    for (var i = 0; i < shape.length; ++i) {
      var long = shape[i][0] / 100.0;
      var lat = shape[i][1] / 100.0;
      var theta = toRadians(long);
      var phi = toRadians(90 - lat);

      // Convert to cartesian coordinates (assuming radius of Earth is 1)
      // http://mathworld.wolfram.com/SphericalCoordinates.html
      var sinPhi = Math.sin(phi)
      var x = Math.cos(theta) * sinPhi;
      var y = Math.sin(theta) * sinPhi;
      var z = Math.cos(phi);

      shapeCoords[i*3] = x;
      shapeCoords[i*3 + 1] = y;
      shapeCoords[i*3 + 2] = z;
    }
    return shapeCoords;
  });

  var maxLength = -Infinity;
  path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.appendChild(path);
  for (var i = 0; i < charts.length; ++i) {
    maxLength = Math.max(charts[i].length / 3, maxLength);
  }
  rotatedCoords = new Float64Array(2 * maxLength);
}
