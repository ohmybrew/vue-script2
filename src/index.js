/**
 * Underscore helpers
 */
const _ = {
  /**
   * Returns true if value is undefined.
   * @param {} x - The object to check
   * @return {Boolean}
   */
  isUndefined(x) {
    return x === undefined;
  },

  /**
   * Return a copy of the object, filtered to only have values for the whitelisted keys.
   * @param {Object} o - The object to use
   * @param {Array} props - The whitelist
   * @return {Object} New object with whitelisted keys/values
   */
  pick(o, props) {
    const x = {};
    props.forEach((k) => {
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
  omit(o, props) {
    const x = {};
    Object.keys(o).forEach((k) => {
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
  omitBy(o, pred) {
    const x = {};
    Object.keys(o).forEach((k) => {
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
  defaults2(o, ...sources) {
    sources.forEach((s) => {
      Object.keys(s).forEach((k) => {
        if (_.isUndefined(o[k]) || o[k] === '') {
          o[k] = s[k];
        }
      });
    });
  },
};

/**
 * Plugin | vue-script2
 */
const Script2 = {
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
  install(Vue) {
    if (Script2.installed) {
      // We're installed, kill it
      return;
    }

    // Custom attributes not part of <script> tags
    const customAttrs = ['unload', 'data', 'reload', 'delay'];

    // from: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script
    // 'async' and 'defer' don't allow document.write according to:
    // http://www.html5rocks.com/en/tutorials/speed/script-loading/
    // we ignore 'defer' and handle 'async' specially.
    const props = customAttrs.concat(['src', 'type', 'async', 'integrity', 'text', 'crossorigin']);

    // Vue component for script2
    Vue.component('script2', {
      props,

      // Template for component
      // <slot> is important, see: http://vuejs.org/guide/components.html#Named-Slots
      template: '<div style="display:none"><slot></slot></div>',

      // NOTE: I tried doing this with Vue 2's new render() function.
      //       It was a nightmare and I never got it to work.
      mounted() {
        const parent = this.$el.parentElement;

        if (!this.src) {
          // No src file, use inner content
          Script2.p = Script2.p.then(() => {
            const s = document.createElement('script');
            s.type = 'text/javascript';
            s.appendChild(document.createTextNode(this.$el.innerHTML));

            // Inject into the DOM
            parent.appendChild(s);
          });
        } else {
          // Src is present
          const opts = _.omitBy(_.pick(this, props), _.isUndefined);
          opts.parent = parent;

          // This syntax results in an implicit return
          const load = () => Script2.load(this.src, opts);
          if (_.isUndefined(this.async)) {
            // Serialize execution
            Script2.p = Script2.p.then(load);
          } else {
            // Inject immediately
            load();
          }
        }

        // See: https://vuejs.org/v2/guide/migration.html#ready-replaced
        this.$nextTick(() => {
          // Code that assumes this.$el is in-document
          // Remove the dummy <div> template for component
          this.$el.remove();
        });
      },

      /**
       * On destroy of component
       */
      destroyed() {
        if (this.unload) {
          new Function(this.unload)() // eslint-disable-line
          delete Script2.loaded[this.src];
        }
      },
    });

    // Let Vue know we're now installed
    Script2.installed = true;
  },

  /**
   * Loading method
   * @param {String} src - The script tag source
   * @param {Object} opts - Options for the script tag
   */
  load(src, opts = { parent: document.head }) {
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
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');

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
        Object.entries(opts.data).forEach(([key, value]) => {
          s.dataset[key] = value;
        });
      }

      // crossorigin in HTML and crossOrigin in the DOM per HTML spec
      // https://html.spec.whatwg.org/multipage/embedded-content.html#dom-img-crossorigin
      s.crossOrigin = opts.crossorigin;

      // Inspiration from: https://github.com/eldargab/load-script/blob/master/index.js
      // and: https://github.com/ded/script.js/blob/master/src/script.js#L70-L82
      s.onload = () => {
        Script2.loaded[src] = true;
        resolve(src);
      };

      // IE should now support onerror and onload. If necessary, take a look
      // at this to add older IE support: http://stackoverflow.com/a/4845802/1781435
      s.onerror = () => reject(new Error(src));

      // Append the script to the DOM
      setTimeout(() => opts.parent.appendChild(s), (opts.delay || 0));
    });
  },
};

export default Script2;
