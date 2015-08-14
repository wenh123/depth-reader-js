module.exports = function(grunt) {
  'use strict';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take
  require('time-grunt')(grunt);

  var pkg        = require('./package')
    , klei       = require('./klei')
    , modulename = klei.name || pkg.title || pkg.name;

  grunt.initConfig({
    pkg:        pkg,
    modulename: modulename,

    /**
     * Watch files and do stuff
     */
    watch: {
      src: {
        files: [
          'src/*.js'
        ],
        tasks: ['newer:jshint:src'],
        options: {
          livereload: true
        }
      },
      test: {
        files: ['test/*.js'],
        tasks: ['newer:jshint:test', 'mochacli']
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options: {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          'test/*.html',
          'images/*.jpg'
        ]
      }
    },

    // HTTP server configuration
    connect: {
      options: {
        hostname: '0.0.0.0',
        port: 9000,
        base: [
          '.',
          'node_modules',
          'bower_components'
        ]
      },
      all: {
        options: {
          livereload: 35729
        }
      },
      test: {
        options: {
          livereload: false,
          open: 'http://localhost:<%= connect.options.port %>/test/test.html'
        }
      }
    },

    // Mocha for Node.js testing
    mochacli: {
      options: {
        ui: 'bdd',
        reporter: 'spec',
        timeout: 5000
      },
      all: ['test/*.js']
    },

    // Mocha for browser testing
    /* jshint camelcase: false */
    mocha_phantomjs: {
      options: {
        silent: true,
        output: 'test/test.out',
        urls: ['http://localhost:<%= connect.options.port %>/test/test.html']
      },
      all: {}
    },

    /**
     * Lint Javascript
     */
    jshint: {
      options: {
        reporter: require('jshint-stylish')
      },
      src: {
        options: {
          jshintrc: 'src/.jshintrc'
        },
        src: [
          'src/*.js',
          'Gruntfile.js'
        ]
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: ['test/*.js']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');

  grunt.registerTask('serve', [
    'connect:all:keepalive'
  ]);

  grunt.registerTask('test', [
    'connect:test',
    'mochacli:all',
    'mocha_phantomjs'
  ]);

  grunt.registerTask('default', [
    'jshint:src',
    'test'
  ]);
};
