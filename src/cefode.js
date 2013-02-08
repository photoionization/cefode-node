(function(process) {
  if (this.WebInspector) return;
  if (window && window.location == 'about:blank') return;

  this.global = this;

  var Script = process.binding('evals').NodeScript;
  var runInThisContext = Script.runInThisContext;

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

  // Every window should has its own process object, so no code in WebKit will
  // be ran by libuv, which is wrapped by the node context.
  // TODO process.on may still run code under wrap of node context
  var processProxy = {};
  processProxy.__proto__ = Object.create(process);
  processProxy.parent = process;
  processProxy.nextTick = function(callback) { setTimeout(callback, 0); };

  // Inject globals.
  global.process = processProxy;
  global.global = global;
  global.GLOBAL = global;
  global.root = global;
  global.Buffer = NativeModule.require('buffer').Buffer;

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
});
