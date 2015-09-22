module.exports = {
  debug: true,
  svgOptimizer: {
    plugins: [
      { removeViewBox: false },
      { removeComments: true }
    ]
  },
  outputFormats: [
    {
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
  input: [
    'test/mock/data/**/*.svg',
    'test/mock/data/**/*.png'
  ],
  cleanOutputDir: true,
  outputDir: 'dist',
  cacheDir: 'svg-rasterizer-cache'
}
