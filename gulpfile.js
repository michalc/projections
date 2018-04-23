/* eslint-env node */

var gulp = require('gulp');
var eslint = require('gulp-eslint');
var changed = require('gulp-changed');
var merge = require('merge2');

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
  var l1Land = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L1.shp'))
    .pipe(geoJsonStream.stringify())
    .pipe(source('GSHHS_c_L1.json'))
    .pipe(gulp.dest(outputDir));

  // Lakes
  var l2Land = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L2.shp'))
    .pipe(geoJsonStream.stringify())
    .pipe(source('GSHHS_c_L2.json'))
    .pipe(gulp.dest(outputDir));

  // Border
  var l2Land = (new mapJsonStream({}, 'data_src/WDBII_shp/c/WDBII_border_c_L1.shp'))
    .pipe(geoJsonStream.stringify())
    .pipe(source('WDBII_border_c_L1.json'))
    .pipe(gulp.dest(outputDir));

  return merge(l1Land, l2Land, l2Land);
});

gulp.task('lint', function () {
  return gulp.src(['gulpfile.js', 'src/*.js'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('default', [], function() {
  var cssnext = require('gulp-cssnext');
  var build = 'build';
  var dest = build;

  var dataSrc = 'data/*.json';
  var dataDest = build + '/data';
  var data = gulp.src(dataSrc)
    .pipe(changed(dataDest))
    .pipe(gulp.dest(dataDest));

  var jsSrc = [
    'node_modules/lodash/lodash.min.js',
    'src/mercator.js',
    'src/app.js'
  ];
  var js= gulp.src(jsSrc)
    .pipe(changed(dest))
    .pipe(gulp.dest(dest));

  var htmlSrc = [
    'src/index.html'
  ];
  var html = gulp.src(htmlSrc)
    .pipe(changed(dest))
    .pipe(gulp.dest(dest));

  var cssSrc = [
    'node_modules/normalize.css/normalize.css',
    'src/style.css'
  ];
  var css = gulp.src(cssSrc)
    .pipe(changed(dest))
    .pipe(cssnext({
      browsers: 'Safari >= 8, iOS >= 8, Chrome >= 46, Firefox >= 42'
    }))
    .pipe(gulp.dest(dest));

  return merge(data, html, js, css);
});
