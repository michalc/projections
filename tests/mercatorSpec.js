/*eslint-env mocha */
'use strict';

var { before, after, describe, it } = require('mocha');
var { expect, assert, should } = require('chai');

var Mercator = require('mercator');

var tolerance = 0.000001;

describe('mercator', function() {
  describe('rotate', function() {
    it('keeps 0 as the same', function() {
      var longLat = [12.3, 34.5];
      var rotated = Mercator.rotate(0, 0, longLat);
      expect(rotated.long).to.be.within(longLat[0] - tolerance, longLat[0] + tolerance);
      expect(rotated.lat).to.be.within(longLat[1] - tolerance, longLat[1] + tolerance);;
    });
  });
});
