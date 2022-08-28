/*eslint-env mocha */
'use strict';

var { before, after, describe, it } = require('mocha');
var { expect, assert, should } = require('chai');

var Mercator = require('mercator');

var tolerance = 0.000001;

describe('mercator', function() {
  describe('rotate', function() {
    it('keeps 0 as the same', function() {
      var latLongCharts = [[[12.3 * 1000, 34.5 * 1000], [18.3 * 1000, 38.5 * 1000], [18.3 * 1000, 48.5 * 1000]]];
      const dimension = Math.min(window.innerWidth, window.innerHeight);
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

      document.body.appendChild(svg);
      const svgRect = svg.getBoundingClientRect();

      Mercator.init(latLongCharts, svg);
      Mercator.setBounds(dimension, dimension);

      expect(svg.outerHTML).to.be.equal(
        '<svg width="600" height="600" viewBox="0 0 60000 60000">' +
        '<path class="land" d="M32050,21407L33050,20578L33050,18272z"></path>' +
        '</svg>'
      );

      Mercator.onDown(0, 0, svgRect);
      Mercator.onMove(10, 10, svgRect);
      expect(svg.outerHTML).to.be.equal(
        '<svg width="600" height="600" viewBox="0 0 60000 60000">' +
        '<path class="land" d="M32007,21248L33009,20400L32987,18062z"></path>' +
        '</svg>'
      );

      svg.remove();
    });
  });
});
