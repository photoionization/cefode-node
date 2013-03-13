(function(process, scriptPath) {
  this.global = this;

  function createWritableStdioStream(fd) {
    var stream;
    var tty_wrap = process.binding('tty_wrap');

    // Note stream._type is used for test-module-load-list.js

    switch (tty_wrap.guessHandleType(fd)) {
      case 'TTY':
        var tty = NativeModule.require('tty');
        stream = new tty.WriteStream(fd);
        stream._type = 'tty';

        // Hack to have stream not keep the event loop alive.
        // See https://github.com/joyent/node/issues/1726
        if (stream._handle && stream._handle.unref) {
          stream._handle.unref();
        }
        break;

      case 'FILE':
        var fs = NativeModule.require('fs');
        stream = new fs.SyncWriteStream(fd);
        stream._type = 'fs';
        break;

      case 'PIPE':
        var net = NativeModule.require('net');
        stream = new net.Stream(fd);

        // FIXME Should probably have an option in net.Stream to create a
        // stream from an existing fd which is writable only. But for now
        // we'll just add this hack and set the `readable` member to false.
        // Test: ./node test/fixtures/echo.js < /etc/passwd
        stream.readable = false;
        stream._type = 'pipe';

        // FIXME Hack to have stream not keep the event loop alive.
        // See https://github.com/joyent/node/issues/1726
        if (stream._handle && stream._handle.unref) {
          stream._handle.unref();
        }
        break;

      default:
        // Probably an error on in uv_guess_handle()
        throw new Error('Implement me. Unknown stream file type!');
    }

    // For supporting legacy API we put the FD here.
    stream.fd = fd;

    stream._isStdio = true;

    return stream;
  }

  function processStdio() {
    var stdin, stdout, stderr;

    process.__defineGetter__('stdout', function() {
      if (stdout) return stdout;
      stdout = createWritableStdioStream(1);
      stdout.destroy = stdout.destroySoon = function(er) {
        er = er || new Error('process.stdout cannot be closed.');
        stdout.emit('error', er);
      };
      if (stdout.isTTY) {
        process.on('SIGWINCH', function() {
          stdout._refreshSize();
        });
      }
      return stdout;
    });

    process.__defineGetter__('stderr', function() {
      if (stderr) return stderr;
      stderr = createWritableStdioStream(2);
      stderr.destroy = stderr.destroySoon = function(er) {
        er = er || new Error('process.stderr cannot be closed.');
        stderr.emit('error', er);
      };
      return stderr;
    });

    process.__defineGetter__('stdin', function() {
      if (stdin) return stdin;

      var tty_wrap = process.binding('tty_wrap');
      var fd = 0;

      switch (tty_wrap.guessHandleType(fd)) {
        case 'TTY':
          var tty = NativeModule.require('tty');
          stdin = new tty.ReadStream(fd);
          break;

        case 'FILE':
          var fs = NativeModule.require('fs');
          stdin = new fs.ReadStream(null, {fd: fd});
          break;

        case 'PIPE':
          var net = NativeModule.require('net');
          stdin = new net.Stream(fd);
          stdin.readable = true;
          break;

        default:
          // Probably an error on in uv_guess_handle()
          throw new Error('Implement me. Unknown stdin file type!');
      }

      // For supporting legacy API we put the FD here.
      stdin.fd = fd;

      // stdin starts out life in a paused state, but node doesn't
      // know yet.  Call pause() explicitly to unref() it.
      stdin.pause();

      // when piping stdin to a destination stream,
      // let the data begin to flow.
      var pipe = stdin.pipe;
      stdin.pipe = function(dest, opts) {
        stdin.resume();
        return pipe.call(stdin, dest, opts);
      };

      return stdin;
    });

    process.openStdin = function() {
      process.stdin.resume();
      return process.stdin;
    };
  };

  var Script = process.binding('evals').NodeScript;
  var runInThisContext = Script.runInThisContext;

  // In workers, we evaluate all build-in modules in worker context.
  function NativeModule(id) {
    this.filename = id + '.js';
    this.id = id;
    this.exports = {};
    this.loaded = false;
  }

  NativeModule._source = process.binding('natives');
  NativeModule._cache = {};

  NativeModule.require = function(id) {
    if (id == 'native_module') {
      return NativeModule;
    }

    var cached = NativeModule.getCached(id);
    if (cached) {
      return cached.exports;
    }

    if (!NativeModule.exists(id)) {
      throw new Error('No such native module ' + id);
    }

    var nativeModule = new NativeModule(id);

    nativeModule.compile();
    nativeModule.cache();

    return nativeModule.exports;
  };

  NativeModule.getCached = function(id) {
    return NativeModule._cache[id];
  }

  NativeModule.exists = function(id) {
    return NativeModule._source.hasOwnProperty(id);
  }

  NativeModule.getSource = function(id) {
    return NativeModule._source[id];
  }

  NativeModule.wrap = function(script) {
    return NativeModule.wrapper[0] + script + NativeModule.wrapper[1];
  };

  NativeModule.wrapper = [
    '(function (exports, require, module, __filename, __dirname) { ',
    '\n});'
  ];

  NativeModule.prototype.compile = function() {
    var source = NativeModule.getSource(this.id);
    source = NativeModule.wrap(source);

    var fn = runInThisContext(source, this.filename, true);
    fn(this.exports, NativeModule.require, this, this.filename);

    this.loaded = true;
  };

  NativeModule.prototype.cache = function() {
    NativeModule._cache[this.id] = this;
  };

  // Make process inherit EventEmitter.
  var EventEmitter = NativeModule.require('events').EventEmitter;
  process.__proto__ = Object.create(EventEmitter.prototype, {
    constructor: {
      value: process.constructor
    }
  });

  // List of non-thread-safe modules, see
  // https://github.com/zcbenz/cefode/wiki/List-of-thread-safe-modules
  var unsafe_modules = [ 'crypto', 'https', 'tls' ];

  // Cache process.binding.
  var binding = process.binding;
  var bindingCache = {};
  process.binding = function(id) {
    if (unsafe_modules.indexOf(id) > 0) {
      var warning = id + " is not thread safe, don't use it in workers.\n" +
          "see https://github.com/zcbenz/cefode/wiki/List-of-thread-safe-modules";
      console.log(warning);
      throw new Error(warning);
    }

    var cached = bindingCache[id];
    if (cached) return cached;

    return bindingCache[id] = binding(id);
  }
  process.nextTick = function(callback) { setTimeout(callback, 0); };

  // Include console.
  processStdio();
  global.__defineGetter__('console', function() {
    return NativeModule.require('console');
  });

  // Inject globals.
  global.global = global;
  global.GLOBAL = global;
  global.root = global;
  global.process = process;
  global.Buffer = NativeModule.require('buffer').Buffer;

  // Emulate node.js script's execution everionment
  var Module = NativeModule.require('module');
  var module = new Module('.', null);
  global.process.mainModule = module;

  global.__filename = scriptPath;
  if (process.platform == 'win32') global.__filename = filename.substr(1);
  global.__dirname = NativeModule.require('path').dirname(global.__filename);

  module.filename = global.__filename;
  module.paths = Module._nodeModulePaths(global.__dirname);
  module.loaded = true;
  module._compile('global.module = module;\n' +
                  'global.require = require;\n', 'nw-emulate-node');
});

