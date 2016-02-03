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
        files:   ['*.js'],
        tasks:   ['newer:jshint:src'],
        options: {
          livereload: true
        }
      },
      test: {
        files: ['test/test.js'],
        tasks: ['newer:jshint:test',
                'mochacli']
      },
      gruntfile: {
        files: ['Gruntfile.js']
      },
      livereload: {
        options:  {
          livereload: '<%= connect.options.livereload %>'
        },
        files: [
          'test/*.html',
          'images/*.jpg'
        ]
      }
    },

    clean: {
      src: {
        files: ['*.min.js*']
      },
      test: {
        files: [
          '*.cov.js',
          'coverage*'
        ]
      }
    },

    // HTTP server configuration
    connect: {
      options: {
        hostname: '0.0.0.0',
        port:      9000,
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
          open:      'http://localhost:<%= connect.options.port %>/test/test.html'
        }
      },
      coverage:  {
        options: {
          livereload: false
        }
      }
    },

    // Mocha for Node.js testing
    mochacli: {
      options: {
        ui:      'bdd',
        files:  ['test/test.js'],
        timeout:  5000
      },
      test: {
        options: {
          reporter: 'spec'
        }
      },
      coverage:  {
        options: {
          reporter: nodeMajVer ? 'json-cov'       : 'spec',
          save:     nodeMajVer ? 'coverage1.json' :  null
        }
      }
    },

    // Mocha for browser testing
    /* jshint camelcase: false */
    mocha_phantomjs: {
      options:  {
        urls:   ['http://localhost:<%= connect.options.port %>/test/test.html'],
        timeout: 10000
      },
      test: {
        options: {
          reporter: 'spec'
        }
      },
      coverage:  {
        options: {
          silent:   nodeMajVer,
          reporter: nodeMajVer ? 'json-cov'       : 'spec',
          output:   nodeMajVer ? 'coverage2.json' :  null
        }
      }
    },

    merge_jsoncov: {
      options: {
        src: [
          'coverage1.json',
          'coverage2.json'
        ],
        dest: {
          json: 'coverage.json',
          lcov: 'coverage.lcov'
        },
        delSrc: true
      }
    },

    coveralls: {
      options: {
        src: 'coverage.lcov'
      }
    },

    jscoverage: {
      src: {
        src:  'depth-reader.js',
        dest: 'depth-reader.cov.js'
      }
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
          '!*.cov.js',
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
        sourceMap:         true
      },
      my_target: {
        files: {
          'depth-reader.min.js': ['depth-reader.js']
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-jscoverage');
  grunt.loadNpmTasks('grunt-coveralls');
  grunt.loadNpmTasks('grunt-mocha-cli');
  grunt.loadNpmTasks('grunt-mocha-phantomjs');

  grunt.registerTask('merge_jsoncov', function() {
    var conf = ['merge_jsoncov','options','src'];
    grunt.config.requires(conf);

    var opts  = grunt.config(conf.slice(0,-1))
      , names = opts.src
      , objs  = names.map(function(file) {
          return require('./' + file);
        })
      , obj   = objs[0]
      , files = objs.map(function(obj) {
          return obj.files[0];
        })
      , file = files[0]
      , srcs = files.map(function(file) {
          return file.source;
        })
      , src  = srcs.shift()
      , nums = Object.keys(src)
      , sloc = 0
      , hits = 0;

    nums.forEach(function(n) {
      var line = src[n]
        , cov  = line.coverage;

      if ('number' === typeof cov) {
        srcs.forEach(function(s) {
          var  ln = s[n];
          if (!ln || ln.source !== line.source) {
            throw new Error('line '+ n +' not synced: '+ line.source);
          }
          cov += +ln.coverage;
        });
        line.coverage = cov;
        if (cov) {
          hits++;
        }
        sloc++;
      }
    });
    obj.sloc     = file.sloc     = sloc;
    obj.hits     = file.hits     = hits;
    obj.misses   = file.misses   = sloc - hits;
    obj.coverage = file.coverage = hits / sloc * 100;

    var fs   = require('fs')
      , name = opts.dest &&  opts.dest.json  ||
             (!opts.dest || !opts.dest.lcov) &&
                             'coverage.json';
    if (name) {
      var json = JSON.stringify(obj, null, 2);
      fs.writeFileSync(name, json);
    }
    name = opts.dest &&  opts.dest.lcov  ||
         (!opts.dest || !opts.dest.json) &&
                         'coverage.lcov';
    if (name) {
      var js2lcov = require('json2lcov');
      fs.writeFileSync(name, js2lcov(obj));
    }
    if (opts.delSrc) {
      names.forEach(fs.unlinkSync);
    }
  });

  grunt.registerTask('clean', function() {
    var files = grunt.config('clean.files')
      , glob  = require('glob')
      , fs    = require('fs');

    if (Array.isArray(files)) {
      files.forEach(function(pat) {
        glob.sync(pat).forEach(function(name) {
          if (fs.existsSync(name)) {
            fs.unlinkSync(name);
          }
        });
      });
    }
  });

  grunt.registerTask('build', [
    'clean:src',
    'jshint:src',
    'uglify'
  ]);

  grunt.registerTask('serve', [
    'connect:all:keepalive'
  ]);

  grunt.registerTask('test', [
    'clean:test',
    'connect:test',
    'jscoverage',
    'mochacli:test',
    'mocha_phantomjs:test'
  ]);

  grunt.registerTask('travis', [
    'clean:test',
    'connect:coverage',
    'jscoverage',
    'mochacli:coverage',
    'mocha_phantomjs:coverage',
    'merge_jsoncov',
    'coveralls'
  ]);

  grunt.registerTask('default', [
    'jshint',
    'test'
  ]);
};
