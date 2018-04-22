/* global exports */

(function(Mercator) {
  Mercator.toChart = toChart;
  Mercator.rotate = rotate;
  Mercator.getShapes = getShapes;

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

  function toChart(chartBounds, coords) {
    var long = coords.long;
    var lat = coords.lat;
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
      x: Math.round(chartX),
      y: Math.round(chartY)
    };
  }

  // latRotation rotates about y axis (line through earth along original equator)
  // longRotation rotates about z axis (line through earth pole to pole)
  function rotate(longRotationDegrees, latRotationDegrees, longLat) {
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

  function getShapes(bounds, rotatedCoords) {
    var shapes = [];

    // 1 for -180 to 180, -1 for 180 to -180
    function discontinuityDirection(prev, curr) {
      return Math.abs(prev - curr) > DISCONTINUTY_THREASHOLD && prev * curr < 0 ? (prev < curr ? 1 : -1) : 0;
    }

    function prev(length, i) {
      return i == 0 ? length - 1 : i - 1;
    }

    function next(length, i) {
      return (i + 1) % length;
    }

    // Point after i that is continous with i
    function continuousAfter(i) {
      var atPoint = rotatedCoords[i];
      var atAfter = rotatedCoords[next(rotatedCoords.length, i)];
      var discon = discontinuityDirection(atPoint.long, atAfter.long);
      var continous = {
        long: atAfter.long - discon * 360,
        lat: atAfter.lat
      };
      return continous;
    }

    // Point before i that is continous with i
    function continousBefore(i) {
      var atPoint = rotatedCoords[i];
      var atBefore = rotatedCoords[prev(rotatedCoords.length, i)];
      var discon = discontinuityDirection(atPoint.long, atBefore.long);
      var continous = {
        long: atBefore.long - discon * 360,
        lat: atBefore.lat
      };
      return continous;
    }

    function segmentCoords(segment) {
      var coords = [];
      var i = segment.in;
      do {
        coords.push(rotatedCoords[i]);
        i = next(rotatedCoords.length, i);
      } while (i != segment.out);

      // Add point before that is continous with first point in path
      coords.unshift(continousBefore(segment.in))

      // Add point after that is continous with last point in path
      // Note: The out point is not included in the path
      coords.push(continuousAfter(prev(rotatedCoords.length, segment.out)));

      return coords;
    }

    function toChart(coords) {
      return Mercator.toChart(bounds, coords);
    }

    // Fudge to determine is 2 points are discontinuous
    var DISCONTINUTY_THREASHOLD = 180;

    // Array of objects describing discontinuities in the path
    // described by the point after the discontinuity
    //   index:     where in the path it occurs
    //   longLat:   coords of the point
    //   direction: 1 is -ve to +ve, -1 is +ve to -ve 
    var discontinuities = [];

    // Find discontinuities
    rotatedCoords.forEach(function(longLat, i) {
      var prevIndex = prev(rotatedCoords.length, i);
      var prevLong = rotatedCoords[prevIndex].long;
      var currLong = longLat.long;
      var direction = discontinuityDirection(prevLong, currLong);
      if (direction) {
        discontinuities.push({
          index: i,
          longLat: longLat,
          direction: direction
        });
      }
    });

    // Array of objects describing the types of segments in the path
    //   type:       0 is simple with no discontinuities (must be the only one in path)
    //               1 is one that goes all the way around the earth
    //               2 shape that goes up to + beyond an edge
    //   in:         index of in point
    //   inCoords:   coords on in point,
    //   inEdge:     +ve or -ve edge of inPoint
    //   out:        index of out point (not inclusive)
    //   outCoords:  coords of out point
    //   coords:     set of all coords that make the path
    var segments = [];

    // No discontinuites mean the segment must be simple
    if (!discontinuities.length) {
      segments.push({
        type: 0,
        in: 0,
        inCoords: rotatedCoords[0],
        out: 0,
        outCoords: rotatedCoords[0],
        coords: rotatedCoords
      });
    }

    // Find segment types by comparing discontinuities
    discontinuities.forEach(function(discon, i) {
      var prevIndex = prev(discontinuities.length, i);
      var nextIndex = next(discontinuities.length, i);
      var prevDiscon = discontinuities[prevIndex];
      var currDiscon = discon;
      var type = prevDiscon.direction === currDiscon.direction ? 1 : 2;
      var segment = {
        type: type,
        in: prevDiscon.index,
        out: currDiscon.index,
        inCoords: prevDiscon.longLat,
        outCoords: currDiscon.longLat,
        coords: null
      };
      segment.coords = segmentCoords(segment);
      segments.push(segment);
    });

    var endpointsLeft = [];
    var endpointsRight = [];
    segments.forEach(function(segment) {
      if (segment.type === 0) return;
      var inArray = segment.coords[0].long < 0 ? endpointsLeft : endpointsRight;
      var inEndpoint = {
        type: 'beginning',
        side: inArray == endpointsLeft ? 'left' : 'right',
        otherSide: null,
        coords: segment.coords[0],
        segment: segment
      };
      var outArray = segment.coords[segment.coords.length - 1].long < 0 ? endpointsLeft : endpointsRight;
      var outEndpoint = {
        type: 'end',
        side: outArray == endpointsLeft ? 'left' : 'right',
        otherSide: null,
        coords: segment.coords[segment.coords.length - 1],
        segment: segment
      };
      inEndpoint.otherSide = outEndpoint.side;
      outEndpoint.otherSide = inEndpoint.side;
      inArray.push(inEndpoint);
      outArray.push(outEndpoint);
    });

    if (segments.length === 1 && segments[0].type == 0) {
      shapes = [segments[0].coords]
    } else {

      // Walk along each side creating shapes
      var leftShapeCoords = [];
      endpointsLeft.forEach(function(endpoint) {
        if (endpoint.side === endpoint.otherSide) {
          leftShapeCoords = leftShapeCoords.concat(endpoint.segment.coords);
        }
      });

      if (leftShapeCoords.length) {
        shapes.push(leftShapeCoords)
      }
      var rightShapeCoords = [];
      endpointsRight.forEach(function(endpoint) {
        if (endpoint.side === endpoint.otherSide) {
          rightShapeCoords = rightShapeCoords.concat(endpoint.segment.coords);
        }
      });
      if (rightShapeCoords.length) {
        shapes.push(rightShapeCoords);
      }

      endpointsLeft.forEach(function(endpoint) {
        if (endpoint.side !== endpoint.otherSide) {
          var first = endpoint.segment.coords[0];
          var pole = first.lat < 0 ? -1 : 1;
          endpoint.segment.coords.unshift({
            long: first.long,
            lat: 88 * pole
          });
          var last = endpoint.segment.coords[endpoint.segment.coords.length - 1];
          endpoint.segment.coords.push({
            long: last.long,
            lat: 88 * pole
          });
          shapes.push(endpoint.segment.coords);
        }
      })
    }

    return _.map(shapes, function(shape) {
      return _.map(shape, toChart);
    });
  }
})(typeof exports === 'undefined' ? this.Mercator = {} : exports);
