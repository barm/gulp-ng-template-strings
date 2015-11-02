'use strict';
var es = require('event-stream');
var gutil = require('gulp-util');
var fs = require('fs');
var path = require('path');
var minify = require('html-minifier').minify;
var _defaults = require('lodash').defaults;
var NAME = 'gulp-ng-template-strings';

var DEFAULT_MINIFY_OPTIONS = {
  removeComments: true,
  removeCommentsFromCDATA: true,
  collapseWhitespace: true,
  caseSensitive: true
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

function getTemplateRegex(url) {
  if (!url) {
    url = '[^"\']+'; // Url can be anything except quotes
  } else {
    url = escapeRegExp(url);
  }
  var regexStr = [
    '(["\']?)', // Optional quote around keyword, saved in group \1
    'templateUrl', // Keyword
    '\\1', // Match first quote if exists
    '\\s*:\\s*', // Colon surrounded by any whitespace (including newline)
    '(["\'])', // One quote around url, saved in \2
    '(', url, ')', // Save the url in the third group
    '\\2', // Match quote around url
  ].join('');
  return new RegExp(regexStr, 'g');
}

function findUrls(contents) {
  var templateUrls = getTemplateRegex();
  var urls = [];
  var match;
  while ((match = templateUrls.exec(contents)) !== null) {
    urls.push(match[3]);
  }
  return urls;
}

function buffer(options, file, cb) {
  var skipMinification = false;
  var minifyOptions = {};
  var contents = file.contents.toString();
  var urls = findUrls(contents);
  var cwd = options.cwd || file.cwd;
  switch (options.minify) {
    case false:
      // if options.minify is explictly false, skip minification altogether
      skipMinification = true;
      break;
    case undefined:
      // if options.minify is undefined, use default options
      minifyOptions = DEFAULT_MINIFY_OPTIONS;
      break;
    default:
      // otherwise combine passed options with default set
      minifyOptions = _defaults(options.minify, DEFAULT_MINIFY_OPTIONS);
  }
  if (urls.length === 0) {
    return cb(null, file);
  }
  urls.forEach(function(url) {
    var template;
    try {
      template = fs.readFileSync(path.join(cwd, url)).toString();
    } catch (e) {
      gutil.log(NAME, gutil.colors.yellow('WARN'), 'unable to read', cwd, url);
    }
    if (template) {
      if (!skipMinification) {
        template = minify(template, minifyOptions);
        if (typeof minifyOptions.postProcess === "function") {
          template = minifyOptions.postProcess(template);
        }
      }
      contents = contents.replace(getTemplateRegex(url),
                                  'template: \'' + template + '\'');
    }
  });
  file.contents = new Buffer(contents);
  cb(null, file);
}

module.exports = function(options) {
  options = options || {};
  return es.map(templates);

  function templates(file, cb) {
    if (file.isBuffer()) {
      return buffer(options, file, cb);
    }
    if (file.isStream()) {
      return cb(new gutil.PluginError(NAME, 'Streaming not supported'));
    }
    return cb(null, file);
  }
};
