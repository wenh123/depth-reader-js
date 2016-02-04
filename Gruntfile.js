module.exports = function(grunt) {
'use strict';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take
  require('time-grunt')(grunt);

  var pkg        =  require('./package')
    , moduleName =  pkg.title || pkg.name
    , nodeMajVer = +process.versions.node[0]
    , doCoverage =  1 <= +nodeMajVer;

  var fs   = require('fs')
    , path = require('path')
    , glob = require('glob');

  process.stderr.write = function() {};

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
        src: ['*.min.js*']
      },
      test: {
        src: [
          '**/*.cov.*',
          'coverage*'
        ]
      }
    },

    // HTTP server configuration
    connect: {
      options: {
        hostname: '0.0.0.0',
        baseUrl:  'http://localhost:<%= connect.options.port %>/',
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
        pageUrl: '<%= connect.options.baseUrl %>test/test.html',
        options: {
          livereload: false,
          open:  '<%= connect.test.pageUrl %>'
        }
      },
      coverage:  {
        pageUrl: '<%= connect.options.baseUrl %>test/test.cov.html',
        options: {
          livereload: false
        }
      }
    },

    // Mocha for Node.js testing
    mochacli: {
      options: {
        ui:      'bdd',
        timeout:  5000
      },
      test: {
        options: {
          files:   ['test/test.js'],
          reporter: 'spec'
        }
      },
      coverage:  {
        options: {
          files:   [doCoverage ? 'test/test.cov.js'
                               : 'test/test.js'],
          reporter: doCoverage ? 'json-cov'       : 'spec',
          save:     doCoverage ? 'coverage1.json' :  null
        }
      }
    },

    // Mocha for browser testing
    /* jshint camelcase: false */
    mocha_phantomjs: {
      options:  {
        config: {
          ignoreResourceErrors: true
        },
        phantomConfig: {
          '--web-security': false
        },
        timeout: 10000
      },
      test: {
        options: {
          urls:    ['<%= connect.test.pageUrl %>'],
          reporter: 'spec'
        }
      },
      coverage:  {
        options: {
          urls:    [doCoverage ? '<%= connect.coverage.pageUrl %>'
                               : '<%= connect.test.pageUrl %>'],
          reporter: doCoverage ? 'json-cov'       : 'spec',
          output:   doCoverage ? 'coverage2.json' :  null,
          silent:   doCoverage
        }
      }
    },

    merge_jsoncov: {
      src: [
        'coverage1.json',
        'coverage2.json'
      ],
      dest: {
        json: 'coverage.json',
        lcov: 'coverage.lcov'
      },
      delSrc: true
    },

    coveralls: {
      all: {
        src: 'coverage.lcov'
      }
    },

    jscoverage: {
      src: {
        src:  'depth-reader.js',
        dest: 'depth-reader.cov.js'
      }
    },

    create_covs: {
      src: [
        'test/test.{js,html}'
      ],
      destSuffix: '.cov'
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
      all: {
        files: {
          'depth-reader.min.js': ['depth-reader.js']
        }
      }
    }
  });

  grunt.registerTask('create_covs', function() {
    var sufx = grunt.config('create_covs.destSuffix')
      , srcs = grunt.config('create_covs.src')
      , jscv = grunt.config( 'jscoverage.src')
      , from = '/' + path.basename(jscv.src, '.js')
      , to   = '/' + path.basename(jscv.dest,'.js');

    srcs.forEach(function(pat) {
      glob.sync(pat).forEach(function(src) {
        var ext  = path.extname(src)
          , base = src.slice(0, -ext.length)
          , dest = base + sufx + ext
          , text = fs.readFileSync(src, 'utf8')
                  .replace(from, to);
        fs.writeFileSync(dest, text);
      });
    });
  });

  grunt.registerTask('report_coverage', function() {
    var prop  = '.coverage.options.reporter'
      , rpt1  =  grunt.config('mochacli'        + prop)
      , rpt2  =  grunt.config('mocha_phantomjs' + prop)
      , regex = /cov/;

    if (regex.test(rpt1) &&
        regex.test(rpt2)) {
      grunt.task.run('merge_jsoncov');

      if (process.env.TRAVIS) {
        return grunt.task.run('coveralls');
      }
    }
    grunt.log.writeln('Reporting not requested.');
  });

  grunt.registerTask('merge_jsoncov', function() {
    var conf = ['merge_jsoncov', 'src'];
    grunt.config.requires(conf);

    var opts  = grunt.config(conf.slice(0,-1))
      , names = opts.src
      , objs  = names.map(function(file) {
          // can't just use require() because
          // PhantomJS dumps errors to stdout
          var json = fs.readFileSync(file, 'utf8')
                  .replace(/^(.*\r?\n)*(?=\{)/,'');
          return JSON.parse(json);
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
      , hits = 0
      , name;

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

    name = opts.dest &&  opts.dest.json  ||
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

  grunt.registerMultiTask('clean', function() {
    var conf = [this.name, this.target, 'src']
      , srcs = grunt.config(conf);

    srcs.forEach(function(pat) {
      glob.sync(pat).forEach(function(src) {
        if (fs.existsSync(src)) {
          fs.unlinkSync(src);
        }
      });
    });
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
    'jshint:test',
    'connect:test',
    'mochacli:test',
    'mocha_phantomjs:test'
  ]);

  grunt.registerTask('cover', [
    'clean:test',
    'jshint:test',
    'jscoverage',
    'create_covs',
    'connect:coverage',
    'mochacli:coverage',
    'mocha_phantomjs:coverage',
    'report_coverage'
  ]);

  grunt.registerTask('travis', [
    doCoverage ? 'cover' : 'test'
  ]);

  grunt.registerTask('default', [
    'build',
    'test'
  ]);
};
