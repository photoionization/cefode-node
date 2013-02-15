(function(process, isWorker) {
  if (!isWorker) {
    if (this.WebInspector) return;
    if (window && window.location == 'about:blank') return;

    var Script = process.binding('evals').NodeScript;
    var runInThisContext = Script.runInThisContext;
  }

  this.global = this;

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

  // Inject globals.
  global.global = global;
  global.GLOBAL = global;
  global.root = global;

  if (isWorker) {
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
    // Every window should has its own process object.
    var processProxy = {};
    var bindingCache = {};
    processProxy.__proto__ = Object.create(process);
    processProxy.parent = process;
    processProxy.nextTick = function(callback) { setTimeout(callback, 0); };
    processProxy.binding = function(id) {
      var cached = bindingCache[id];
      if (cached) return cached;

      return bindingCache[id] = process.binding(id);
    }

    global.process = processProxy;
    global.Buffer = NativeModule.require('buffer').Buffer;

    // Map global.errno to the one in node context.
    global.__defineGetter__('errno', function() {
      return process.global.errno;
    });
    global.__defineSetter__('errno', function(errno) {
      process.global.errno = errno;
    });

    // Emulate node.js script's execution everionment
    var Module = NativeModule.require('module');
    var module = new Module('.', null);

    global.__filename = decodeURIComponent(window.location.pathname);
    if (process.platform == 'win32') global.__filename = filename.substr(1);
    global.__dirname = NativeModule.require('path').dirname(global.__filename);

    module.filename = global.__filename;
    module.paths = NativeModule.require('module')._nodeModulePaths(global.__dirname);
    module.loaded = true;
    module._compile('global.module = module;\n' +
                    'global.require = require;\n', 'nw-emulate-node');

    global.process.mainModule = module;
  }
});
