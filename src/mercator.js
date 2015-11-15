/* global exports */

(function(Mercator) {
  Mercator.toChart = toChart;
  Mercator.toEarth = toEarth;
  Mercator.bearing = bearing;
  Mercator.distance = distance;
  Mercator.greatCircle = greatCircle;
  Mercator.greatCirclePath = greatCirclePath;

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

  function toEarth(chartBounds, chartX, chartY) {
    var W = getW(chartBounds);

    var lambda_0 = getLambda_0(chartBounds, chartX);
    var x = chartX;
    var lambda = xToLambda(W, lambda_0, x);
    var long = toDegrees(lambda);

    var y_top = getY_top(chartBounds);
    var y = y_top - chartY;
    var theta = yToTheta(W, y);
    var lat = toDegrees(theta); 

    return {
      long: long,
      lat: lat
    };
  }

  function bearing(chartBounds, fromLong, fromLat, toLong, toLat) {
    var fromChartCoords = toChart(chartBounds, fromLong, fromLat);
    var toChartCoords = toChart(chartBounds, toLong, toLat);
    var dx = toChartCoords.x - fromChartCoords.x;
    var dy = fromChartCoords.y - toChartCoords.y; // y increasing doing down, not up
    if (dy === 0) {
      if (dx === 0) return 0;
      if (dx > 0) return 90;
      return 270;
    }
    var theta = Math.atan(dx/dy);
    return toDegrees(theta) + (dy < 0 ? 180 : 0) + (dx < 0 && dy > 0 ? 360 : 0);
  }

  // http://williams.best.vwh.net/avform.htm
  function distance(fromLong, fromLat, toLong, toLat) {
    fromLong = toRadians(fromLong);
    fromLat = toRadians(fromLat);
    toLong = toRadians(toLong);
    toLat = toRadians(toLat);

    return Math.acos(
        Math.sin(fromLat)*Math.sin(toLat)
      + Math.cos(fromLat)*Math.cos(toLat)*Math.cos(fromLong-fromLat)
    );
  }

  function greatCircle(fromLong, fromLat, toLong, toLat, f) {
    fromLong = toRadians(fromLong);
    fromLat = toRadians(fromLat);
    toLong = toRadians(toLong);
    toLat = toRadians(toLat);

    var d = distance(fromLong, fromLat, toLong, toLat);
    var A = Math.sin((1-f)*d)/Math.sin(d);
    var B = Math.sin(f*d)/Math.sin(d);
    var x = A*Math.cos(fromLat)*Math.cos(fromLong) + B*Math.cos(toLat)*Math.cos(toLong);
    var y = A*Math.cos(fromLat)*Math.sin(fromLong) + B*Math.cos(toLat)*Math.sin(toLong);
    var z = A*Math.sin(fromLat) + B*Math.sin(toLat)
    return {
      long: toDegrees(Math.atan2(y,x)),
      lat: toDegrees(Math.atan2(z, Math.sqrt(Math.pow(x,2)+Math.pow(y,2))))
    };
  }

  function greatCirclePath(fromLong, fromLat, toLong, toLat, numPoints) {
    var path = [];
    var i, f;
    for (i = 0; i < numPoints; ++i) {
      f = 1/(numPoints-1) * i;
      path.push(Mercator.greatCircle(fromLong, fromLat, toLong, toLat, f));
    }
    return path;
  }
})(typeof exports === 'undefined' ? this.Mercator = {} : exports);
