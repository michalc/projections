/* eslint-env node */

(function(module) {
  module.exports = MapJsonStream;

  var stream = require('stream');
  var mapnik = require('mapnik');
  var util = require('util');

  mapnik.register_default_input_plugins();

  function MapJsonStream(options, path, klass) {
    options = options || {};
    options.objectMode = true;
    stream.Readable.call(this, options);

    this.path = path;
    this.featureSet = null;
    this.klass = klass;
  }
  util.inherits(MapJsonStream, stream.Readable);

  MapJsonStream.prototype._read = function(numberOfObjects) {
    if (!this.featureSet) {
      this.featureSet = (new mapnik.Datasource({type:'shape', file: this.path})).featureset();
    }

    var i = 0;
    while (i < numberOfObjects) {
      var feat = this.featureSet.next();
      if (feat) {
        var obj = JSON.parse(feat.toJSON());
        if (this.klass) {
          obj.klass = this.klass;
        }
        this.push(obj);
      } else {
        this.push(null);
        this.featureSet = null;
        break;
      }
      ++i;
    }
  }

})(module);
