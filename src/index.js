'use strict'

const glob = require('glob')
const tmp = require('tmp')
const fs = require('fs-extra')
const SVGO = require('svgo')
const path = require('path')
const execFile = require('child_process').execFile
const pngquant = require('pngquant-bin')
const svgexport = require('svgexport')
const xtend = require('xtend')
const promisify = require('es6-promisify')
const hash = require('json-hash')
const jsonfile = require('jsonfile')

const copy = promisify(fs.copy)
const remove = promisify(fs.remove)

/**
 * - creates a temporary staging directory for operations
 * - builds the input file list
 * - copies and optimizes svg to staging area
 *     - build input staging file list
 * - for each file, execute rasterizer, apply optimizations
 * - move rasterized files to target directory
 */
export default class SVGRasterizer {
  constructor(config) {
    this.log = require('./logger')('lib', { debug: config.debug })

    if (!config.debug) {
      tmp.setGracefulCleanup()
    }

    this.config = config
  }

  init() {
    this.createCacheDir()

    this.cacheFile = null
    this.cache = this.loadCache()

    this.input = this.buildInputFileList(this.config.input)

    this.stagedFiles = []

    this.tmpDir = null

    this.createTmpDir()

    this.distDir = null

    this.createDistDir()

    this.svgo = new SVGO(this.config.svgOptimizer)

  }

  createCacheDir() {
    if (this.config.cacheDir) {
      fs.ensureDir(this.config.cacheDir)
    }
  }

  /**
   * Directory for where temporary processed files go
   */
  createTmpDir() {
    fs.ensureDir('svg-rasterizer-tmp')

    this.tmpDir = tmp.dirSync({ template: process.cwd() + '/svg-rasterizer-tmp/XXXXXX' }).name

    this.log.info({ tmpDir: this.tmpDir }, 'Scratch directory')
  }

  createDistDir() {
    const config = this.config

    if (config.outputDir.indexOf('/') !== 0) {
      this.distDir = path.join(process.cwd(), config.outputDir)
    } else {
      this.distDir = config.outputDir
    }

    this.log.info({ dist: this.distDir }, 'Output directory')

    if (config.cleanOutputDir) {

      fs.removeSync(this.distDir)
      this.log.info('Output directory emptied for use')

    }

    fs.mkdirsSync(this.distDir)

  }

  static isSVGFile(file) {
    return path.extname(file).toLowerCase() === '.svg'
  }

  static isPNGFile(file) {
    return path.extname(file).toLowerCase() === '.png'
  }

  static isJPEGFile(file) {
    return path.extname(file).toLowerCase() === '.jpg'
  }

  static isGIFFile(file) {
    return path.extname(file).toLowerCase() === '.gif'
  }

  buildInputFileList(input) {
    var fileList = []

    input.forEach(function (file) {
      fileList = fileList.concat(glob.sync(file, { realpath: true, nodir: true }))
    })

    // remove dupes and unmodified files
    return fileList.filter((elem, pos) => {

      if (fileList.indexOf(elem) === pos) {
        if (this.config.cacheDir) {
          return this.hasFileBeenModified(elem)
        } else {
          return true
        }
      } else {
        // File is a dupe; filter out
        return false
      }
    })
  }

  /**
   * Used to determine if a file should be processed again
   * @param file
   * @returns {boolean}
   */
  hasFileBeenModified(file) {
    var fileStat = fs.statSync(file)

    // If the file does not exist in the cache or the modtimes do not match, consider the file modified/new
    if (!this.cache.files[file] || this.cache.files[file] && this.cache.files[file] !== fileStat.mtime.getTime()) {
      this.cache.files[file] = fileStat.mtime.getTime()
      return true
    }

    this.cache.files[file] = fileStat.mtime.getTime()
    return false
  }

  /**
   * Loads the cache which contains a list of files that were processed in prior runs.
   * If the optimization or output formats configurations have changed, a new cache is created
   * @returns {*}
   */
  loadCache() {

    const currConfig = xtend(
      this.config.outputFormats,
      this.config.svgOptimizer
    )

    if (this.config.cacheDir) {
      this.cacheFile = path.join(this.config.cacheDir, hash.digest(currConfig) + '.json')

      // If the file exists, then load the cache data
      // if not, then assume a new cache
      try {
        fs.statSync(this.cacheFile)

        this.log.info('Using cache file', { file: this.cacheFile })

        return jsonfile.readFileSync(this.cacheFile)
      } catch(e) {
        this.log.info('Using fresh cache', { file: this.cacheFile })

      }
    } else {
      this.log.info('Cache is not being used. Set a cache with the \'cacheDir\' option.')
    }

    return {
      files: {}
    }
  }

  saveCache() {
    if (this.config.cacheDir) {
      this.log.debug('Writing cache file', { file: this.cacheFile })

      jsonfile.writeFileSync(this.cacheFile, this.cache)
    }
  }

  /**
   * Registers image files to be staged for processing / dist
   * - If svg or png, will run the corresponding optimizer, which creates optimized copies of the originals in a temp dir
   * before registering to the stage area
   * @returns {Promise}
   */
  stageInputFiles() {

    let operations = []

    this.input.forEach((file) => {

      if (SVGRasterizer.isSVGFile(file)) {
        operations.push(this.optimizeSVG(file).then(data => {
          return this.addToStaging(data.src, data.tmp, data.type)
        }))

      } else if (SVGRasterizer.isPNGFile(file)) {
        operations.push(this.optimizePNG(file).then(data => {
          return this.addToStaging(data.src, data.tmp, data.type)
        }))

      } else if (SVGRasterizer.isJPEGFile(file)) {
        operations.push(this.addToStaging(file, file, 'jpg'))

      } else if (SVGRasterizer.isGIFFile(file)) {
        operations.push(this.addToStaging(file, file, 'gif'))
      }
    })

    return Promise.all(operations)
  }

  getTempDir() {
    return this.tmpDir
  }

  getDistDir() {
    return this.distDir
  }

  /**
   * Optimizes an SVG using svgo
   * @param {String} file Path to the SVG to optimize
   */
  optimizeSVG(file) {

    const tmpFile = tmp.tmpNameSync( { template: this.getTempDir() + '/' + 'XXXXXX-opti-' + path.basename(file) })

    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) { reject(err) }

        this.svgo.optimize(data, (result) => {

          fs.writeFile(tmpFile, result.data, 'utf8', (err) => {
            if (err) { reject(err) }
          })

          this.log.debug('SVG optimization complete', { src: file, dst: tmpFile })

          resolve({
            src: file,
            tmp: tmpFile,
            type: 'svg'
          })
        })
      })
    })
  }

  /**
   * Optimizes a rasterized file using pngquant-bin
   * @param file
   */
  optimizePNG(file) {
    const tmpFile = tmp.tmpNameSync({ template: this.getTempDir() + '/' + 'XXXXXX-opti-' + path.basename(file) })

    return new Promise((resolve, reject) => {
      execFile(pngquant, [file, '--output', tmpFile], (err) => {
        if (err) { reject(err) }

        this.log.debug('PNG optimization complete', { src: file, dst: tmpFile })

        resolve({
          src: file,
          tmp: tmpFile,
          type: 'png'
        })
      })
    })
  }

  /**
   * For each staged file, rasterize and copy to dist if svg, else copy to dist
   * @returns {Promise} list of files copied (if svg, will contain a nest array of rastered files)
   */
  processStagedInput() {
    let operations = []

    this.stagedFiles.forEach((stagedFile) => {
      switch(stagedFile.type) {
        case 'svg':
          operations.push(this.processStagedSVG(stagedFile).then(results => {
            let copyOper = []

            results.forEach(meta => {
              copyOper.push(this.copyToDist(meta.staged, meta.dist))
            })

            return Promise.all(copyOper)
          }))
        default:
          operations.push(this.copyToDist(stagedFile.staged, stagedFile.dist))
      }
    })

    return Promise.all(operations)
  }

  /**
   * - rasterizes svg into temp files
   * - runs optimizations against the temp files
   * - copies the staged files to dist
   * @param stagedFile
   * @returns {Promise.<T>} List of added rasterized files
   */
  processStagedSVG(stagedFile) {
    let operations = []

    return this.rasterize(stagedFile.src).then((svgCfg) => {

      svgCfg.forEach((cfg) => {
        switch (cfg.type) {
          case 'png':
            operations.push(this.optimizePNG(cfg.tmp).then(data => {
              return this.addToStaging(cfg.dist, data.tmp, data.type)
            }))
            break
          default:
            operations.push(this.addToStaging(cfg.dist, cfg.tmp, cfg.type))
        }
      })

      return Promise.all(operations)

    })
  }

  copyToDist(src, dst) {
    this.log.debug('copying to dist', { src: src, dst: dst })
    
    return copy(src, dst).then(() => {
      return dst
    }, (err) => {
      throw err
    })

  }

  /**
   * Translates the original input path to an equiv dist path
   * @param {String} srcPath Original input path
   * @param {bool} rootOnly If true, do not append the dist path
   */
  generateDistPath(srcPath, rootOnly) {
    let dir = path.dirname(srcPath).split('/')
    let cwd = process.cwd().split('/')

    //Filter out like-paths
    dir = dir.filter((item, idx) => {
      return cwd[idx] != item
    })

    if (rootOnly) {
      return path.join(dir.join('/'), path.basename(srcPath))
    } else {
      return path.join(this.getDistDir(), dir.join('/'), path.basename(srcPath))
    }
  }

  /**
   * Builds out the svgexport output string
   * @param srcFile
   * @returns {Array}
   */
  generateSVGExportOpt(srcFile) {

    let svgCfg = []

    this.config.outputFormats.forEach((outputFmt) => {

      if (!outputFmt.format) {
        this.log.fatal({ outputFmt: outputFmt })

        throw new Error('outputFormat item lacks "format" type!')
      }

      let ext = path.extname(srcFile)
      let outStr = []
      let filename =  outputFmt.filename.replace('{{filename}}', path.basename(srcFile, ext)) + '.' + outputFmt.format
      let file = tmp.tmpNameSync({ template: this.getTempDir() + '/' + 'XXXXXX-rast-' + filename })
      let distPath = this.generateDistPath(path.dirname(srcFile), true) + '/' + filename

      outStr.push(outputFmt.format)

      if (outputFmt.quality) {
        outStr.push(outputFmt.quality)
      }

      if (outputFmt.inputViewbox) {
        outStr.push(outputFmt.inputViewbox)
      }

      if (outputFmt.outputSize) {
        outStr.push(outputFmt.outputSize)
      }

      if (outputFmt.viewboxMode) {
        outStr.push(outputFmt.viewboxMode)
      }

      if (outputFmt.styles) {
        outStr.push('"' + JSON.stringify(outputFmt.styles) + '"')
      }

      svgCfg.push({
        tmp: file,
        dist: distPath,
        input: srcFile,
        output: file + ' ' + outStr.join(' '),
        type: outputFmt.format
      })

    })

    return svgCfg
  }

  /**
   * Rasterizes an SVG input using svgexport
   * @param srcFile
   */
  rasterize(srcFile) {
    const config = this.generateSVGExportOpt(srcFile)

    return new Promise((resolve, reject) => {

      this.log.debug('executing svgexport', config)

      svgexport.render(config, (err) => {
        if (err) { reject(err) }

        resolve(config)
      })
    })
  }

  /**
   * Adds files to be staged
   * @param origFile
   * @param tmpFile
   * @param type file type
   * @returns {{src: *, staged: *, dist: *, type: *}}
   */
  addToStaging(origFile, tmpFile, type) {

    let stagedCfg = {
      src: origFile,
      staged: tmpFile,
      dist: this.generateDistPath(origFile),
      type: type
    }

    this.log.debug('added file to staging', stagedCfg)

    this.stagedFiles.push(stagedCfg)

    return stagedCfg
  }

  cleanup() {
    if (!this.config.debug) {
      return remove(process.cwd() + '/svg-rasterizer-tmp')
    }

    return new Promise((resolve) => { resolve() })
  }

  process() {
    let start = new Date()

    this.init()

    this.log.info('Running rasterizer against ' + this.input.length + ' files...')

    return this.stageInputFiles().then(() => {
      return this.processStagedInput().then((files) => {
        //flatten file structure
        return files.reduce((a, b) => {
          return a.concat(b)
        }, [])
      })
    }).then((files) => {

      return this.cleanup().then(() => {
        let finish = new Date()
        this.saveCache()
        this.log.info(files.length + ' files transferred in ' + (finish.getTime() - start.getTime()) + " ms")
        return files
      })

    }).catch((err) => {
      this.cleanup().then(() => {
        this.log.error(err)
        process.exit(-1)
      })
    })
  }
}