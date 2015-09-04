/*globals fdescribe */
const fs = require('fs-extra')
const path = require('path')
const promisify = require("es6-promisify")

const Rasterizer = require('../../src/index')

const lstat = promisify(fs.lstat)

fs.emptyDirSync('svg-rasterizer-tmp')
fs.emptyDirSync('dist')

function checkExists(stats, file) {
  expect(stats && stats.isFile()).toBe(true, 'Checking file exists: ' + file)
}

describe('SVG rasterizer', () => {

  it('should build a list of input files', () => {
    let files = Rasterizer.buildInputFileList(['test/mock/data/**/*'])
    expect(files.length).toBe(7)
  })

  it('should optimize an SVG file', (done) => {
    let r = new Rasterizer(require('../mock/config/example1.js'))

    r.optimizeSVG(process.cwd() + '/test/mock/data/facebook.svg').then((data) => {
      lstat(data.tmp).then((stats) => {
        checkExists(stats, data.tmp)
        done()
      }, done.fail)

      expect(data.src).toBe(process.cwd() + '/test/mock/data/facebook.svg')
      expect(data.type).toBe('svg')
    })
  })

  it('should optimize a PNG file', (done) => {
    let r = new Rasterizer(require('../mock/config/example1.js'))

    r.optimizePNG(process.cwd() + '/test/mock/data/pnggrad16rgb.png').then((data) => {
      lstat(data.tmp).then((stats) => {
        checkExists(stats, data.tmp)
        done()
      }, done.fail)

      expect(data.src).toBe(process.cwd() + '/test/mock/data/pnggrad16rgb.png')
      expect(data.type).toBe('png')
    })
  })

  describe('staging input files', () => {

    it('should have a manifest of staged files', (done) => {
      let r = new Rasterizer(require('../mock/config/example1.js'))
      r.stageInputFiles().then((files) => {

        expect(files.length).toBe(7)
        expect(files[0].src).toContain('/test/mock/data/AJ_Digital_Camera.svg')
        expect(files[0].staged).toContain('.optimized.svg')
        expect(files[0].dist).toContain('/dist/test/mock/data/AJ_Digital_Camera.svg')
        expect(files[0].type).toBe('svg')

        done()
      }, done.fail)
    })

    it('should generate optimized copies of images into a temp directory', (done) => {
      let r = new Rasterizer(require('../mock/config/example1.js'))
      r.stageInputFiles().then((files) => {

        let operations = []

        files.forEach((file) => {
          operations.push(lstat(file.staged).then((stats) => {
            checkExists(stats, file.staged)
          }))
        })

        Promise.all(operations).then(done, done.fail)

      }, done.fail)
    })

  })

  fdescribe('processing staged files to dist', () => {
    it('should generate optimized rasterizations from a staged svg file', (done) => {
      let r = new Rasterizer(require('../mock/config/example1.js'))
      r.stageInputFiles().then((files) => {

        r.processStagedSVG(files[0]).then((rasters) => {

          let operations = []

          rasters.forEach((raster) => {
            operations.push(lstat(raster.staged).then((stats) => {
              checkExists(stats, raster.staged)
            }, done.fail))

          })

          done()
        }, done.fail)

      }, done.fail)
    })

    it('should copy a src file to dist', (done) => {
      let r = new Rasterizer(require('../mock/config/example1.js'))
      r.stageInputFiles().then((files) => {
        r.copyToDist(files[0].staged, files[0].dist).then(() => {
          lstat(files[0].dist).then((stats) => {
            checkExists(stats, files[0].dist)
            done()
          }, done.fail)
        }, done.fail)
      })
    })

    it('should run the full flow', (done) => {
      let r = new Rasterizer(require('../mock/config/example1.js'))
      r.process().then((files) => {

        expect(files.length).toBe(19)

        let operations = []

        files.forEach((file) => {
          operations.push(lstat(file).then((stats) => {
            checkExists(stats, file)
          }))
        })

        Promise.all(operations).then(done, done.fail)
      })
    })

  })
})
