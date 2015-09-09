'use strict';

var gulp   = require('gulp');
var karma = require('karma').server;
var path = require('path');
var del = require('del');
var browserify = require('gulp-browserify');
var fs = require('fs');
var tap = require('gulp-tap');
var uglify = require('gulp-uglify');

var configFile = path.resolve(__dirname, 'spec/karma.conf.js');

gulp.task('clean', function(done) {
  del(['../DomParserWorker.js', '../JSONDomUtils.js'], {force: true}, done);
});

gulp.task('worker-dist', function() {
  return gulp.src('lib/DomParserWorker.js').pipe(browserify({
    // insertGlobals : true,
    // debug : true
  }))
  .pipe(gulp.dest('dist/'))
  .pipe(gulp.dest('../'));
});

gulp.task('domutils-dist', function() {
  return gulp.src('lib/JSONDomUtils.js').pipe(browserify({
    debug: true,
    standalone: 'JSONDomUtils'
  })).pipe(tap(function(file) {
    file.contents = Buffer.concat([
      new Buffer('var global = this;\nvar EXPORTED_SYMBOLS = ["JSONDomUtils"];\n'),
      file.contents,
      new Buffer('Components.utils.import(\'resource://exchangeEws/soapNSDef.js\');\n' +
        'function XPathNSResolve(prefix) { return soapNSDef[prefix] || null; }\n' +
        'JSONDomUtils.evaluate = function(doc, expr) { return JSONDomUtils._evaluate(doc, expr, XPathNSResolve); }'
      )
    ]);
  }))
  .pipe(uglify())
  .pipe(gulp.dest('../'));
});

gulp.task('dist', ['worker-dist', 'domutils-dist']);
/**
 * Run test once and exit
 */
gulp.task('test', ['worker-dist'], function (done) {
  karma.start({
    configFile: configFile,
    singleRun: true
  }, done);
});

/**
 * Watch for file changes and re-run tests on each change
 */
gulp.task('dev', function (done) {
  karma.start({
    configFile: configFile,
  }, done);
});

gulp.task('default', ['clean', 'dist', 'test']);
