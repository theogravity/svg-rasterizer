const bunyan = require('bunyan')
const bformat = require('bunyan-format')
const formatOut = bformat({ outputMode: 'short' })

module.exports = function (section_name, opts) {

  opts = opts || {}

  var logOpts = {
    name: 'svg-rasterizer' + '/' + section_name,
    stream: formatOut,
    level: 'error',
    serializers: bunyan.stdSerializers
  }

  if (opts.debug) {
    logOpts.level = 'debug'
  }

  return bunyan.createLogger(logOpts)
}
