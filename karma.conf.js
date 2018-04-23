// Karma configuration
// Generated on Mon Apr 23 2018 21:07:12 GMT+0100 (BST)

module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['browserify', 'mocha', 'sinon-chai'],
    files: [
      // 'src/app.js',
      'tests/*Spec.js'
    ],

    preprocessors: {
      // 'src/app.js': ['browserify'],
      'tests/*Spec.js': ['browserify']
    },
    browserify: {
      'paths': ['src/']
    },
    exclude: [
    ],
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: false,
    browsers: ['ChromeHeadless'],
    singleRun: true,
    concurrency: Infinity
  })
}
