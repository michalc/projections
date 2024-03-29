/*eslint-env mocha */
'use strict';

var { before, after, describe, it } = require('mocha');
var { expect, assert, should } = require('chai');

var Mercator = require('mercator');

var tolerance = 0.000001;

describe('mercator', function() {
  describe('rotate', function() {
    it('keeps 0 as the same', function() {
      var latLongCharts = [[[12.3 * 100, 34.5 * 100], [18.3 * 100, 38.5 * 100], [18.3 * 100, 48.5 * 100]]];
      const dimension = Math.min(window.innerWidth, window.innerHeight);
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

      document.body.appendChild(svg);
      const svgRect = svg.getBoundingClientRect();

      Mercator.init(latLongCharts, svg);
      Mercator.setBounds(dimension, dimension);

      expect(svg.outerHTML).to.be.equal(
        '<svg viewBox="0 0 60000 60000">' +
        '<path d="M32050,23847L33050,23014L33050,20701z"></path>' +
        '</svg>'
      );

      Mercator.onDown(0, 0, svgRect);
      Mercator.onMove(10, 10, svgRect);
      expect(svg.outerHTML).to.be.equal(
        '<svg viewBox="0 0 60000 60000">' +
        '<path d="M32014,23722L33016,22875L32999,20536z"></path>' +
        '</svg>'
      );

      svg.remove();
    });
  });
});
