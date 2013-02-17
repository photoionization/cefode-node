(function(process, scriptPath, isWorker) {
  this.global = this;

  // Inject globals.
  global.global = global;
  global.GLOBAL = global;
  global.root = global;

  var NativeModule;
  var Script = process.binding('evals').NodeScript;
  var runInThisContext = Script.runInThisContext;

  if (isWorker) {
    // In workers, we evaluate all build-in modules in worker context.
    NativeModule = function (id) {
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

    global.process = process;

    var binding = process.binding;
    var bindingCache = {};
    process.nextTick = function(callback) { setTimeout(callback, 0); };
    process.binding = function(id) {
      var cached = bindingCache[id];
      if (cached) return cached;

      return bindingCache[id] = binding(id);
    }
  } else {
    // In normal page, we evaluate built-in modules in node context, and all
    // pages share the same built-in module code.
    NativeModule = process.NativeModule;

    // Every window should has its own process object.
    var processProxy = {};
    processProxy.__proto__ = process;
    processProxy.nextTick = function(callback) { setTimeout(callback, 0); };

    global.process = processProxy;
  }

  global.Buffer = NativeModule.require('buffer').Buffer;

  var Module;
  if (isWorker) {
    Module = NativeModule.require('module');
  } else {
    // Force use module.js in window context, so required third party code will
    // run under window context.
    var source = NativeModule.getSource('module');
    source = NativeModule.wrap(source);

    var module = new NativeModule('module');
    var fn = runInThisContext(source, module.filename, true);
    fn(module.exports, NativeModule.require, module, module.filename);

    Module = module.exports
  }

  // Emulate node.js script's execution everionment
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
