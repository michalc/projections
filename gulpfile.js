/* eslint-env node */

var browserify = require('browserify');
var CleanCSS = require('clean-css');
var gulp = require('gulp');
var buffer = require('gulp-buffer');
var handlebars = require('gulp-compile-handlebars');
var eslint = require('gulp-eslint');
var changed = require('gulp-changed');
var rev = require('gulp-rev');
var merge = require('merge2');
var source = require('vinyl-source-stream');
var stream = require('stream');
var streamToPromise = require('stream-to-promise');

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

  // Antarctica
  var l2Land = (new mapJsonStream({}, 'data_src/GSHHS_shp/c/GSHHS_c_L5.shp'))
    .pipe(geoJsonStream.stringify())
    .pipe(source('GSHHS_c_L5.json'))
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

  var manifestStream = browserify('src/app.js')
    .plugin('tinyify', {})
    .bundle()
    .pipe(source('app.js'))
    .pipe(buffer())
    .pipe(rev())
    .pipe(gulp.dest(dest))
    .pipe(rev.manifest());
  var manifest = streamToPromise(manifestStream).then(function(files) {
    return JSON.parse(files[0].contents);
  });

  var cssSrc = [
    'node_modules/normalize.css/normalize.css',
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
      assetPath: function (path, context) {
        return context.data.root.manifest[path];
      },
      css: function(context) {
        return new handlebars.Handlebars.SafeString(context.data.root.css);
      }
    }
  };
  var htmlSrc = [
    'src/index.html'
  ];
  var html = Promise.all([manifest, css]).then(function(results) {
    var manifestContents = results[0];
    var cssContents = results[1];
    var htmlStream = gulp.src(htmlSrc)
        .pipe(handlebars({
          manifest: manifestContents,
          css: cssContents
        }, handlebarOpts))
        .pipe(gulp.dest(dest));

    return streamToPromise(htmlStream);
  });

  return Promise.all([streamToPromise(css), html])
});
