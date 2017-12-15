var MemoryFS = require('memory-fs')
var path = require('path')
var webpack = require('webpack')


var fs = new MemoryFS()

function compile (config, callback) {
  config.runner = config.runner || 'ruby'
  config.engine = config.engine || 'erb'

  var compiler = webpack({
    entry: './test/erb/' + config.file,
    module: {
      loaders: [
        {
          test: /\.erb$/,
          loader: './index',
          options: {
            runner: config.runner,
            engine: config.engine,
            timeout: config.timeout,
            dependenciesRoot: './test/dependencies'
          }
        }
      ]
    },
    output: {
      filename: './output.js'
    }
  })
  compiler.outputFileSystem = fs
  compiler.run(callback)
}

function compile2 (config, done, successCallback) {
  compile (config, function (err, stats) {
    if (err) {
      fail(error)
      done()
      return
    }
    successCallback(stats)
  })
}

function readOutput () {
  var fileContent = fs.readFileSync(path.resolve(__dirname, './output.js'))
  return fileContent.toString()
}

function expectInOutput(str) {
  expect(readOutput()).toEqual(expect.stringContaining(str))
}

test('loads a simple file', function (done) {
  compile2({ file: 'simple.js.erb' }, done, function (stats) {
    expect(stats.compilation.errors).toEqual([])
    expectInOutput("var helloWorld = 'Hello World'")
    done()
  })
})

test('loads with erb', function (done) {
  compile2({ file: 'engine.js.erb', engine: 'erb' }, done, function (stats) {
    expect(stats.compilation.errors).toEqual([])
    expectInOutput("var engine = 'erb'")
    done()
  })
})

test('loads with erubis', function (done) {
  compile2({ file: 'engine.js.erb', engine: 'erubis' }, done, function (stats) {
    expect(stats.compilation.errors).toEqual([])
    expectInOutput("var engine = 'erubis'")
    done()
  })
})

test('loads with erubi', function (done) {
  compile2({ file: 'engine.js.erb', engine: 'erubi' }, done, function (stats) {
    expect(stats.compilation.errors).toEqual([])
    expectInOutput("var engine = 'erubi'")
    done()
  })
})


test('loads through a Rails-like runner', function (done) {
  compile2({ file: 'runner.js.erb', runner: './test/runner' }, done, function (stats) {
    expect(stats.compilation.errors).toEqual([])
    expectInOutput("var env = 'test'")
    done()
  })
})

test('times out with error', function (done) {
  compile2({ file: 'sleep.js.erb', runner: './test/runner', timeout: 1 }, done, function (stats) {
    expect(stats.compilation.errors[0].message).toMatch(
      'rails-erb-loader took longer than the specified 1.0 second timeout'
    )
    done()
  })
})

test.skip('loads single file dependencies in dev', function (done) {
  var prevEnv = process.env.NODE_ENV
  compile2({ file: 'dependencies.js.erb' }, done, function (stats) {
    process.env.NODE_ENV = 'development'
    expect(stats.compilation.errors).toEqual([])

    // TODO: Check that dependencies/dependency.rb and dependencies/dependency/version.rb
    // are being watched

    done()
  })
  process.env.NODE_ENV = prevEnv
})

test.skip('loads directory dependencies in dev', function (done) {
  var prevEnv = process.env.NODE_ENV
  compile2({ file: 'dependencies-all.js.erb' }, done, function (stats) {
    process.env.NODE_ENV = 'development'
    expect(stats.compilation.errors).toEqual([])

    // TODO: Check that the whole dependencies tree is being watched

    done()
  })
  process.env.NODE_ENV = prevEnv
})
