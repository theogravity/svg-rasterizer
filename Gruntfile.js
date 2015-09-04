require('babel/register')

module.exports = function(grunt) {
  require('load-grunt-tasks')(grunt)
  grunt.loadNpmTasks('minijasminenode23')

  var jsFiles = [
    '*.js',
    'test/**/*.js',
    'src/**/*.js'
  ]

  grunt.initConfig({
    eslint: {
      options: {
        configFile: '.eslintrc'
      },
      target: jsFiles
    },
    babel: {
      options: {
        stage: 0,
        sourceMap: true
      },
      all: {
        files: [{
          expand: true,
          cwd: 'src',
          src: ['**/*.js'],
          dest: 'lib'
        }]
      }
    },
    watch: {
      src: {
        files: ['src/**/*.js', 'test/**/*.js'],
        tasks: ['eslint', 'babel', 'jasmine23']
      }
    },
    jasmine23: {
      dev: {
        options: {
          // An array of filenames, relative to current dir. These will be
          // executed, as well as any tests added with addSpecs()
          specs: ['test/unit/test.spec.js'],
          // A function to call on completion.
          // function(passed)
          onComplete: function(passed) { console.log('done!') },
          // If true, display suite and spec names.
          isVerbose: true,
          // If true, print colors to the terminal.
          showColors: true,
          // If true, include stack traces in failures.
          includeStackTrace: true,
          // Time to wait in milliseconds before a test automatically fails
          defaultTimeoutInterval: 5000
        }
      }
    }
  })

  grunt.registerTask('dist', ['eslint', 'babel'])
  grunt.registerTask('dev', ['eslint', 'watch:src'])
  grunt.registerTask('default', ['eslint', 'babel', 'watch:src'])
}

