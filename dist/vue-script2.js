'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

/**
 * Underscore helpers
 */
var _ = {
  /**
   * Returns true if value is undefined.
   * @param {} x - The object to check
   * @return {Boolean}
   */
  isUndefined: function isUndefined(x) {
    return x === undefined;
  },


  /**
   * Return a copy of the object, filtered to only have values for the whitelisted keys.
   * @param {Object} o - The object to use
   * @param {Array} props - The whitelist
   * @return {Object} New object with whitelisted keys/values
   */
  pick: function pick(o, props) {
    var x = {};
    props.forEach(function (k) {
      x[k] = o[k];
    });

    return x;
  },


  /**
   * Return a copy of the object, filtered to omit the blacklisted keys (or array of keys).
   * @param {Object} o - The object to use
   * @param {Array} props - The blacklist
   * @return {Object} New object without blacklisted keys/values
   */
  omit: function omit(o, props) {
    var x = {};
    Object.keys(o).forEach(function (k) {
      if (props.indexOf(k) === -1) {
        x[k] = o[k];
      }
    });

    return x;
  },


  /**
   * Return a copy of the object, filtered to omit based on a function.
   * @param {Object} o - The object to use
   * @param {Array} pred - The predicate function
   * @return {Object} New object without blacklisted keys/values
   */
  omitBy: function omitBy(o, pred) {
    var x = {};
    Object.keys(o).forEach(function (k) {
      if (!pred(o[k])) {
        x[k] = o[k];
      }
    });

    return x;
  },


  /**
   * Custom defaults function suited to our specific purpose.
   * @param {Object} o - The object to use
   * @param {Array} sources - The source array
   */
  defaults2: function defaults2(o) {
    for (var _len = arguments.length, sources = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      sources[_key - 1] = arguments[_key];
    }

    sources.forEach(function (s) {
      Object.keys(s).forEach(function (k) {
        if (_.isUndefined(o[k]) || o[k] === '') {
          o[k] = s[k];
        }
      });
    });
  }
};

/**
 * Plugin | vue-script2
 */
var Script2 = {
  // Installed or not
  installed: false,

  // Promise handler
  p: Promise.resolve(),

  // Grint will overwrite to match package.json
  version: '2.1.0',

  // Scripts that have been loaded
  loaded: {},

  /**
   * Installer function for Vue plugins
   * @param {Function} Vue - Vue's lib
   */
  install: function install(Vue) {
    if (Script2.installed) {
      // We're installed, kill it
      return;
    }

    // Custom attributes not part of <script> tags
    var customAttrs = ['unload', 'data', 'reload', 'delay'];

    // from: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
    // 'async' and 'defer' don't allow document.write according to:
    // http://www.html5rocks.com/en/tutorials/speed/script-loading/
    // we ignore 'defer' and handle 'async' specially.
    var props = customAttrs.concat(['src', 'type', 'async', 'integrity', 'text', 'crossorigin']);

    // Vue component for script2
    Vue.component('script2', {
      props: props,

      // Template for component
      // <slot> is important, see: http://vuejs.org/guide/components.html#Named-Slots
      template: '<div style="display:none"><slot></slot></div>',

      // NOTE: I tried doing this with Vue 2's new render() function.
      //       It was a nightmare and I never got it to work.
      mounted: function mounted() {
        var _this = this;

        var parent = this.$el.parentElement;

        if (!this.src) {
          // No src file, use inner content
          Script2.p = Script2.p.then(function () {
            var s = document.createElement('script');
            s.type = 'text/javascript';
            s.appendChild(document.createTextNode(_this.$el.innerHTML));

            // Inject into the DOM
            parent.appendChild(s);
          });
        } else {
          // Src is present
          var opts = _.omitBy(_.pick(this, props), _.isUndefined);
          opts.parent = parent;

          // This syntax results in an implicit return
          var load = function load() {
            return Script2.load(_this.src, opts);
          };
          if (_.isUndefined(this.async)) {
            // Serialize execution
            Script2.p = Script2.p.then(load);
          } else {
            // Inject immediately
            load();
          }
        }

        // See: https://vuejs.org/v2/guide/migration.html#ready-replaced
        this.$nextTick(function () {
          // Code that assumes this.$el is in-document
          // Remove the dummy <div> template for component
          _this.$el.remove();
        });
      },


      /**
       * On destroy of component
       */
      destroyed: function destroyed() {
        if (this.unload) {
          new Function(this.unload) // eslint-disable-line
          ();delete Script2.loaded[this.src];
        }
      }
    });

    // Let Vue know we're now installed
    Script2.installed = true;
  },


  /**
   * Loading method
   * @param {String} src - The script tag source
   * @param {Object} opts - Options for the script tag
   */
  load: function load(src) {
    var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : { parent: document.head };

    // Allows for the same script to load multiple times as some libraries
    // Require this to work (like FourSixty and widget scripts)
    if (!_.isUndefined(opts.reload) && !_.isUndefined(Script2.loaded[src])) {
      // Remove the src from loaded now since we want to reload it again
      delete Script2.loaded[src];
    }

    if (Script2.loaded[src]) {
      // Already loaded and no reload needed... simply resolve
      return Promise.resolve(src);
    }

    // New setup for script
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');

      // omit the special options that Script2 supports
      _.defaults2(s, _.omit(opts, ['unload', 'parent', 'reload', 'data', 'delay']), { type: 'text/javascript' });

      // according to: http://www.html5rocks.com/en/tutorials/speed/script-loading/
      // async does not like 'document.write' usage, which we & vue.js make
      // heavy use of based on the SPA style. Also, async can result
      // in code getting executed out of order from how it is inlined on the page.
      // therefore set this to false
      s.async = false;

      // Set the src of the script
      s.src = src;

      // Handle data attributes as needed by some scripts
      // Format of camelCase which gets converted to dashed (feedId => data-feed-id)
      if (!_.isUndefined(opts.data) && opts.data.constructor === Object) {
        Object.entries(opts.data).forEach(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              key = _ref2[0],
              value = _ref2[1];

          s.dataset[key] = value;
        });
      }

      // crossorigin in HTML and crossOrigin in the DOM per HTML spec
      // https://html.spec.whatwg.org/multipage/embedded-content.html#dom-img-crossorigin
      s.crossOrigin = opts.crossorigin;

      // Inspiration from: https://github.com/eldargab/load-script/blob/master/index.js
      // and: https://github.com/ded/script.js/blob/master/src/script.js#L70-L82
      s.onload = function () {
        Script2.loaded[src] = true;
        resolve(src);
      };

      // IE should now support onerror and onload. If necessary, take a look
      // at this to add older IE support: http://stackoverflow.com/a/4845802/1781435
      s.onerror = function () {
        return reject(new Error(src));
      };

      // Append the script to the DOM
      setTimeout(function () {
        return opts.parent.appendChild(s);
      }, opts.delay || 0);
    });
  }
};

exports.default = Script2;
