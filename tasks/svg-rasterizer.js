'use strict'
var Rasterizer = require('../lib')

module.exports = function(grunt) {

  grunt.registerMultiTask('svg-rasterizer', 'Batch rasterizes svg files', function () {
    var done = this.async()

    var conf = this.options({})

    var r = new Rasterizer(conf)
    r.process().then(function() {
      grunt.log.ok('svg-rasterizer completed')
      done(true)
    }, function(err) {
      throw grunt.task.taskError(err)
    })

  })

}
