# svg-rasterizer

Create batched rasterizations of SVG files to other formats suitable for multiple device types.

Given an input of images:

- if `png`, optimize using [`pngquaint`](https://github.com/imagemin/pngquant-bin)
- if `svg`, optimize using [`svgo`](https://github.com/svg/svgo), then rasterize using 
[`svgexport`](https://github.com/shakiba/svgexport), then optimize if rasters are `png`

And copy to a specified `dest` directory.

## Usage

`npm i svg-rasterizer --save`

```javascript
var Rasterizer = require('svg-rasterizer')

var r = new Rasterizer(<config>)
r.process().then(function(fileList) {}, function (err) {})
```

## Configuration

```javascript
module.exports = {
  // See debug messages, do not clean up the temporary directory
  debug: true,
  // svgo options
  svgOptimizer: {
    plugins: [
      { removeViewBox: false }
    ]
  },
  // Rasterizations to generate from an svg file
  // config uses svgexport
  outputFormats: [
    {
      //Use {{filename}} template to use the original file's filename as a base for the
      //rasterized file
      filename: "{{filename}}-2x",
      format: "png",
      quality: 100,
      inputViewbox: null,
      outputSize: "2x",
      viewboxMode: null,
      styles: null
    },
    {
      filename: "{{filename}}-3x",
      format: "png",
      quality: 100,
      inputViewbox: null,
      outputSize: "3x",
      viewboxMode: null,
      styles: null
    },
    {
      filename: "{{filename}}-jp",
      format: "jpg",
      quality: 100,
      inputViewbox: null,
      outputSize: null,
      viewboxMode: null,
      styles: null
    }
  ],
  // Glob'd directories containing files
  // Filetypes must be specified
  input: [
    'test/mock/data/**/*.svg',
    'test/mock/data/**/*.png'
  ],
  // Output directory - uses the directory structure of the input files
  // when generating output
  outputDir: 'dist',
  // Cleans the output dir before running (default is false)
  cleanOutputDir: false,
  // Directory containing cache metadata for faster build times
  // set to null to disable caching
  cacheDir: 'svg-rasterizer-cache'
}

```

## Grunt Task

A `Grunt` task is included, called `svg-rasterizer`:

```javascript
module.exports = function(grunt) {
  
 grunt.loadNpmTasks('svg-rasterizer')
  
  grunt.initConfig({
    'svg-rasterizer': {
      dev: {
        // Standard options apply here
        options: {
         svgOptimizer: {
           plugins: [
             { removeViewBox: false }
           ]
         },
         outputFormats: [
           {
             //Use {{filename}} template to use the original file's filename as a base for the
             //rasterized file
             filename: "{{filename}}-2x",
             format: "png",
             quality: 100,
             inputViewbox: null,
             outputSize: "2x",
             viewboxMode: null,
             styles: null
           }
         ],
         input: [
           'test/mock/data/**/*.svg',
           'test/mock/data/**/*.png'
         ],
         outputDir: 'dist'
        }
      }
    }
  })

  grunt.registerTask('default', ['svg-rasterizer:dev'])  
```

## Test

`npm run test`
