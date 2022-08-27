/* eslint-env node */

var browserify = require('browserify');
var CleanCSS = require('clean-css');
var gulp = require('gulp');
var buffer = require('gulp-buffer');
var Handlebars = require('handlebars');
var eslint = require('gulp-eslint');
var changed = require('gulp-changed');
var _ = require('lodash');
var merge = require('merge2');
var source = require('vinyl-source-stream');
var stream = require('stream');
var streamToPromise = require('stream-to-promise');
var fs = require('fs');

// Requires dev dependencies to be installed
gulp.task('download-charts', function () {
  var download = require('gulp-download-stream');
  var unzip = require('gulp-unzip');
  var url = 'https://www.ngdc.noaa.gov/mgg/shorelines/data/gshhg/latest/gshhg-shp-2.3.7.zip';
  return download(url)
    .pipe(unzip())
    .pipe(gulp.dest('data_src/'));
});

// Requires dev dependencies to be installed,
// and download-charts task to be run
gulp.task('generate-charts', function () {
  var source = require('vinyl-source-stream');
  var mapJsonStream = require('./src/map-json-stream');
  var geoJsonStream = require('geojson-stream');
  var outputDir = 'data';

  // Land
  var mostOfWorldStream = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L1.shp'))
    .pipe(geoJsonStream.stringify());

  // Antarctica
  var antarticaStream = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L5.shp'))
    .pipe(geoJsonStream.stringify());

  // Lackes
  var lakesStream = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L2.shp'))
    .pipe(geoJsonStream.stringify());

  return Promise.all([
    streamToPromise(mostOfWorldStream),
    streamToPromise(antarticaStream),
    streamToPromise(lakesStream),
  ]).then(function(collections) {
    var mostOfWorldFeatures = JSON.parse(collections[0]).features;
    var mostOfWorld = _(mostOfWorldFeatures)
      .map(function(feature) {
        return feature.geometry.coordinates[0];
      })
      .value();

    var antarticaFeatures = JSON.parse(collections[1]).features;
    var antarticaIslands = _(antarticaFeatures)
      .filter(function(feature) {
        return feature.id > 2;
      })
      .map(function(feature) {
        return feature.geometry.coordinates[0];
      })
      .value();
    
    var antarticaProper = _(antarticaFeatures)
      .filter(function(feature) {
        return feature.id <= 2;
      })
      .map(function(feature) {
        return feature.geometry.coordinates[0];
      })
      .map(function(featureCoords) {
        // Annoyingly land masses stradding 180 longtidue are split up.
        // This is most obvious in Antartica,  and done by adding in points
        // at the South Pole and after
        var seenSouthPole = false;
        return _.filter(featureCoords, function(coords) {
          seenSouthPole = seenSouthPole || coords[1] == -90;
          return !seenSouthPole;
        });
      })
      .reverse()
      .flatten()
      .value();

    var lakesFeatures = JSON.parse(collections[2]).features;
    var lakes = _(lakesFeatures)
      .map(function(feature) {
        // Reverse so lakaes are holes in the shape
        return _.reverse(feature.geometry.coordinates[0]);
      })
      .value();

    charts = _.flatten([mostOfWorld, antarticaIslands, [antarticaProper], lakes]);
    chartsString = JSON.stringify(charts);

    var saveStream = new stream.Readable()
    saveStream.pipe(source('data-v2.json'))
      .pipe(gulp.dest(outputDir));

    saveStream.push(chartsString) 
    saveStream.push(null) 

    return streamToPromise(saveStream);
  });
});

gulp.task('lint', function () {
  return gulp.src(['gulpfile.js', 'src/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', function() {
  var cssnext = require('gulp-cssnext');
  var build = 'build';
  var dest = build;

  var dataSrc = 'data/*.json';
  var dataDest = build + '/data';
  var data = gulp.src(dataSrc)
    .pipe(changed(dataDest))
    .pipe(gulp.dest(dataDest));

  var javascriptStream = browserify('src/app.js')
    .plugin('tinyify', {})
    .bundle();
  var javascript = streamToPromise(javascriptStream).then(function(jsBuffers) {
    return Buffer.concat(jsBuffers);
  });

  var cssSrc = [
    'src/style.css'
  ];
  var cssStream = gulp.src(cssSrc)
    .pipe(changed(dest))
    .pipe(cssnext({
      browsers: 'Safari >= 8, iOS >= 8, Chrome >= 46, Firefox >= 42'
    }));
  var css = streamToPromise(cssStream).then(function(css) {
    var concatedCss = css.map(function(file) {
      return file.contents.toString('utf-8');
    }).join('\n');

    return new CleanCSS({}).minify(concatedCss).styles;
  });

  var handlebarOpts = {
    helpers: {
      javascript: function(context) {
        return new Handlebars.SafeString(context.data.root.javascript);
      },
      css: function(context) {
        return new Handlebars.SafeString(context.data.root.css);
      }
    }
  };
  var htmlSrc = [
    'src/index.html'
  ];
  var html = Promise.all([javascript, css]).then(function(results) {
    var javascriptContents = results[0];
    var cssContents = results[1];
    var template = Handlebars.compile(fs.readFileSync('src/index.html', 'utf8'));
    return template({
      javascript: javascriptContents,
      css: cssContents,
    }, handlebarOpts);
  });

  return Promise.all([streamToPromise(css), html])
});
