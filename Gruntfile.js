module.exports = function(grunt) {
  'use strict';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take
  require('time-grunt')(grunt);

  var pkg        =  require('./package')
    , moduleName =  pkg.title || pkg.name
    , nodeMajVer = +process.versions.node[0];

  grunt.initConfig({
    pkg:        pkg,
    modulename: moduleName,

    /**
     * Watch files and do stuff
     */
    watch: {
      src: {
        files: [
          '*.js'
        ],
        tasks: ['newer:jshint:src'],
        options: {
          livereload: true
        }
      },
      test: {
        files: ['test/test.js'],
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
      },
      coverage: {
        options: {
          livereload: false
        }
      }
    },

    // Mocha for Node.js testing
    mochacov: {
      test: {
        options: {
          reporter: 'spec',
          timeout: 5000
        }
      },
      coverage: {
        options: {
          coveralls: nodeMajVer ?  true : false,
          reporter:  nodeMajVer ? 'mocha-lcov-reporter' : 'spec',
          output:    nodeMajVer ? 'coverage.lcov'       :  null
        }
      },
      options: {
        ui: 'bdd',
        files: 'test/test.js'
      }
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
     * Lint JavaScript
     */
    jshint: {
      options: {
        reporter: require('jshint-stylish')
      },
      src: {
        options: {
          jshintrc: '.jshintrc'
        },
        src: [
          '*.js',
          'Gruntfile.js'
        ]
      },
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: ['test/*.js']
      }
    },

    /**
     * Compress JavaScript
     */
    uglify: {
      options: {
        preserveComments: 'some',
        sourceMap: true
      },
      my_target: {
        files: {
          'depth-reader.min.js': ['depth-reader.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');

  grunt.registerTask('build', [
    'jshint:src',
    'uglify'
  ]);

  grunt.registerTask('serve', [
    'connect:all:keepalive'
  ]);

  grunt.registerTask('test', [
    'connect:test',
    'mochacov:test',
    'mocha_phantomjs'
  ]);

  grunt.registerTask('travis', [
    'connect:coverage',
    'mochacov:coverage'
  ]);

  grunt.registerTask('default', [
    'jshint:src',
    'test'
  ]);
};
