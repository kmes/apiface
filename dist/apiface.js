(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./../utils');
var settle = require('./../core/settle');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var createError = require('../core/createError');
var btoa = (typeof window !== 'undefined' && window.btoa) || require('./../helpers/btoa');

module.exports = function xhrAdapter(config) {
  return new Promise(function dispatchXhrRequest(resolve, reject) {
    var requestData = config.data;
    var requestHeaders = config.headers;

    if (utils.isFormData(requestData)) {
      delete requestHeaders['Content-Type']; // Let the browser set it
    }

    var request = new XMLHttpRequest();
    var loadEvent = 'onreadystatechange';
    var xDomain = false;

    // For IE 8/9 CORS support
    // Only supports POST and GET calls and doesn't returns the response headers.
    // DON'T do this for testing b/c XMLHttpRequest is mocked, not XDomainRequest.
    if (process.env.NODE_ENV !== 'test' &&
        typeof window !== 'undefined' &&
        window.XDomainRequest && !('withCredentials' in request) &&
        !isURLSameOrigin(config.url)) {
      request = new window.XDomainRequest();
      loadEvent = 'onload';
      xDomain = true;
      request.onprogress = function handleProgress() {};
      request.ontimeout = function handleTimeout() {};
    }

    // HTTP basic authentication
    if (config.auth) {
      var username = config.auth.username || '';
      var password = config.auth.password || '';
      requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
    }

    request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

    // Set the request timeout in MS
    request.timeout = config.timeout;

    // Listen for ready state
    request[loadEvent] = function handleLoad() {
      if (!request || (request.readyState !== 4 && !xDomain)) {
        return;
      }

      // The request errored out and we didn't get a response, this will be
      // handled by onerror instead
      if (request.status === 0) {
        return;
      }

      // Prepare the response
      var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
      var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
      var response = {
        data: responseData,
        // IE sends 1223 instead of 204 (https://github.com/mzabriskie/axios/issues/201)
        status: request.status === 1223 ? 204 : request.status,
        statusText: request.status === 1223 ? 'No Content' : request.statusText,
        headers: responseHeaders,
        config: config,
        request: request
      };

      settle(resolve, reject, response);

      // Clean up request
      request = null;
    };

    // Handle low level network errors
    request.onerror = function handleError() {
      // Real errors are hidden from us by the browser
      // onerror should only fire if it's a network error
      reject(createError('Network Error', config));

      // Clean up request
      request = null;
    };

    // Handle timeout
    request.ontimeout = function handleTimeout() {
      reject(createError('timeout of ' + config.timeout + 'ms exceeded', config, 'ECONNABORTED'));

      // Clean up request
      request = null;
    };

    // Add xsrf header
    // This is only done if running in a standard browser environment.
    // Specifically not if we're in a web worker, or react-native.
    if (utils.isStandardBrowserEnv()) {
      var cookies = require('./../helpers/cookies');

      // Add xsrf header
      var xsrfValue = config.withCredentials || isURLSameOrigin(config.url) ?
          cookies.read(config.xsrfCookieName) :
          undefined;

      if (xsrfValue) {
        requestHeaders[config.xsrfHeaderName] = xsrfValue;
      }
    }

    // Add headers to the request
    if ('setRequestHeader' in request) {
      utils.forEach(requestHeaders, function setRequestHeader(val, key) {
        if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
          // Remove Content-Type if data is undefined
          delete requestHeaders[key];
        } else {
          // Otherwise add header to the request
          request.setRequestHeader(key, val);
        }
      });
    }

    // Add withCredentials to request if needed
    if (config.withCredentials) {
      request.withCredentials = true;
    }

    // Add responseType to request if needed
    if (config.responseType) {
      try {
        request.responseType = config.responseType;
      } catch (e) {
        if (request.responseType !== 'json') {
          throw e;
        }
      }
    }

    // Handle progress if needed
    if (typeof config.progress === 'function') {
      if (config.method === 'post' || config.method === 'put') {
        request.upload.addEventListener('progress', config.progress);
      } else if (config.method === 'get') {
        request.addEventListener('progress', config.progress);
      }
    }

    if (requestData === undefined) {
      requestData = null;
    }

    // Send the request
    request.send(requestData);
  });
};

}).call(this,require('_process'))
},{"../core/createError":6,"./../core/settle":9,"./../helpers/btoa":13,"./../helpers/buildURL":14,"./../helpers/cookies":16,"./../helpers/isURLSameOrigin":18,"./../helpers/parseHeaders":20,"./../utils":22,"_process":23}],3:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var bind = require('./helpers/bind');
var Axios = require('./core/Axios');

/**
 * Create an instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 * @return {Axios} A new instance of Axios
 */
function createInstance(defaultConfig) {
  var context = new Axios(defaultConfig);
  var instance = bind(Axios.prototype.request, context);

  // Copy axios.prototype to instance
  utils.extend(instance, Axios.prototype, context);

  // Copy context to instance
  utils.extend(instance, context);

  return instance;
}

// Create the default instance to be exported
var axios = module.exports = createInstance();

// Expose Axios class to allow class inheritance
axios.Axios = Axios;

// Factory for creating new instances
axios.create = function create(defaultConfig) {
  return createInstance(defaultConfig);
};

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

},{"./core/Axios":4,"./helpers/bind":12,"./helpers/spread":21,"./utils":22}],4:[function(require,module,exports){
'use strict';

var defaults = require('./../defaults');
var utils = require('./../utils');
var InterceptorManager = require('./InterceptorManager');
var dispatchRequest = require('./dispatchRequest');
var isAbsoluteURL = require('./../helpers/isAbsoluteURL');
var combineURLs = require('./../helpers/combineURLs');

/**
 * Create a new instance of Axios
 *
 * @param {Object} defaultConfig The default config for the instance
 */
function Axios(defaultConfig) {
  this.defaults = utils.merge(defaults, defaultConfig);
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

/**
 * Dispatch a request
 *
 * @param {Object} config The config specific for this request (merged with this.defaults)
 */
Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, this.defaults, { method: 'get' }, config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
});

module.exports = Axios;

},{"./../defaults":11,"./../helpers/combineURLs":15,"./../helpers/isAbsoluteURL":17,"./../utils":22,"./InterceptorManager":5,"./dispatchRequest":7}],5:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":22}],6:[function(require,module,exports){
'use strict';

var enhanceError = require('./enhanceError');

/**
 * Create an Error with the specified message, config, error code, and response.
 *
 * @param {string} message The error message.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 @ @param {Object} [response] The response.
 * @returns {Error} The created error.
 */
module.exports = function createError(message, config, code, response) {
  var error = new Error(message);
  return enhanceError(error, config, code, response);
};

},{"./enhanceError":8}],7:[function(require,module,exports){
(function (process){
'use strict';

var utils = require('./../utils');
var transformData = require('./transformData');

/**
 * Dispatch a request to the server using whichever adapter
 * is supported by the current environment.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  // Ensure headers exist
  config.headers = config.headers || {};

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  var adapter;

  if (typeof config.adapter === 'function') {
    // For custom adapter support
    adapter = config.adapter;
  } else if (typeof XMLHttpRequest !== 'undefined') {
    // For browsers use XHR adapter
    adapter = require('../adapters/xhr');
  } else if (typeof process !== 'undefined') {
    // For node use HTTP adapter
    adapter = require('../adapters/http');
  }

  return Promise.resolve(config)
    // Wrap synchronous adapter errors and pass configuration
    .then(adapter)
    .then(function onFulfilled(response) {
      // Transform response data
      response.data = transformData(
        response.data,
        response.headers,
        config.transformResponse
      );

      return response;
    }, function onRejected(error) {
      // Transform response data
      if (error && error.response) {
        error.response.data = transformData(
          error.response.data,
          error.response.headers,
          config.transformResponse
        );
      }

      return Promise.reject(error);
    });
};

}).call(this,require('_process'))
},{"../adapters/http":2,"../adapters/xhr":2,"./../utils":22,"./transformData":10,"_process":23}],8:[function(require,module,exports){
'use strict';

/**
 * Update an Error with the specified config, error code, and response.
 *
 * @param {Error} error The error to update.
 * @param {Object} config The config.
 * @param {string} [code] The error code (for example, 'ECONNABORTED').
 @ @param {Object} [response] The response.
 * @returns {Error} The error.
 */
module.exports = function enhanceError(error, config, code, response) {
  error.config = config;
  if (code) {
    error.code = code;
  }
  error.response = response;
  return error;
};

},{}],9:[function(require,module,exports){
'use strict';

var createError = require('./createError');

/**
 * Resolve or reject a Promise based on response status.
 *
 * @param {Function} resolve A function that resolves the promise.
 * @param {Function} reject A function that rejects the promise.
 * @param {object} response The response.
 */
module.exports = function settle(resolve, reject, response) {
  var validateStatus = response.config.validateStatus;
  // Note: status is not exposed by XDomainRequest
  if (!response.status || !validateStatus || validateStatus(response.status)) {
    resolve(response);
  } else {
    reject(createError(
      'Request failed with status code ' + response.status,
      response.config,
      null,
      response
    ));
  }
};

},{"./createError":6}],10:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

},{"./../utils":22}],11:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var normalizeHeaderName = require('./helpers/normalizeHeaderName');

var PROTECTION_PREFIX = /^\)\]\}',?\n/;
var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

function setContentTypeIfUnset(headers, value) {
  if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
    headers['Content-Type'] = value;
  }
}

module.exports = {
  transformRequest: [function transformRequest(data, headers) {
    normalizeHeaderName(headers, 'Content-Type');
    if (utils.isFormData(data) ||
      utils.isArrayBuffer(data) ||
      utils.isStream(data) ||
      utils.isFile(data) ||
      utils.isBlob(data)
    ) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isURLSearchParams(data)) {
      setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
      return data.toString();
    }
    if (utils.isObject(data)) {
      setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponse(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      data = data.replace(PROTECTION_PREFIX, '');
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    },
    patch: utils.merge(DEFAULT_CONTENT_TYPE),
    post: utils.merge(DEFAULT_CONTENT_TYPE),
    put: utils.merge(DEFAULT_CONTENT_TYPE)
  },

  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',

  maxContentLength: -1,

  validateStatus: function validateStatus(status) {
    return status >= 200 && status < 300;
  }
};

},{"./helpers/normalizeHeaderName":19,"./utils":22}],12:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],13:[function(require,module,exports){
'use strict';

// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function E() {
  this.message = 'String contains an invalid character';
}
E.prototype = new Error;
E.prototype.code = 5;
E.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new E();
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;

},{}],14:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else if (utils.isURLSearchParams(params)) {
    serializedParams = params.toString();
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      }

      if (!utils.isArray(val)) {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};

},{"./../utils":22}],15:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '');
};

},{}],16:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);

},{"./../utils":22}],17:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],18:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);

},{"./../utils":22}],19:[function(require,module,exports){
'use strict';

var utils = require('../utils');

module.exports = function normalizeHeaderName(headers, normalizedName) {
  utils.forEach(headers, function processHeader(value, name) {
    if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
      headers[normalizedName] = value;
      delete headers[name];
    }
  });
};

},{"../utils":22}],20:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  return parsed;
};

},{"./../utils":22}],21:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],22:[function(require,module,exports){
'use strict';

var bind = require('./helpers/bind');

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return (typeof FormData !== 'undefined') && (val instanceof FormData);
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Determine if a value is a Function
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Function, otherwise false
 */
function isFunction(val) {
  return toString.call(val) === '[object Function]';
}

/**
 * Determine if a value is a Stream
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Stream, otherwise false
 */
function isStream(val) {
  return isObject(val) && isFunction(val.pipe);
}

/**
 * Determine if a value is a URLSearchParams object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a URLSearchParams object, otherwise false
 */
function isURLSearchParams(val) {
  return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  typeof document.createElement -> undefined
 */
function isStandardBrowserEnv() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object' && !isArray(obj)) {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

/**
 * Extends object a by mutably adding to it the properties of object b.
 *
 * @param {Object} a The object to be extended
 * @param {Object} b The object to copy properties from
 * @param {Object} thisArg The object to bind function to
 * @return {Object} The resulting value of object a
 */
function extend(a, b, thisArg) {
  forEach(b, function assignValue(val, key) {
    if (thisArg && typeof val === 'function') {
      a[key] = bind(val, thisArg);
    } else {
      a[key] = val;
    }
  });
  return a;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isFunction: isFunction,
  isStream: isStream,
  isURLSearchParams: isURLSearchParams,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  extend: extend,
  trim: trim
};

},{"./helpers/bind":12}],23:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

(function () {
  try {
    cachedSetTimeout = setTimeout;
  } catch (e) {
    cachedSetTimeout = function () {
      throw new Error('setTimeout is not defined');
    }
  }
  try {
    cachedClearTimeout = clearTimeout;
  } catch (e) {
    cachedClearTimeout = function () {
      throw new Error('clearTimeout is not defined');
    }
  }
} ())
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = cachedSetTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    cachedClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        cachedSetTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],24:[function(require,module,exports){
/**
 *  Firebase libraries for browser - npm package.
 *
 * Usage:
 *
 *   firebase = require('firebase');
 */
require('./firebase');
module.exports = firebase;

},{"./firebase":25}],25:[function(require,module,exports){
(function (global){
/*! @license Firebase v3.2.0
    Build: 3.2.0-rc.2
    Terms: https://developers.google.com/terms */
(function() { var k="undefined"!=typeof window&&window===this?this:"undefined"!=typeof global?global:this,l=function(){k.Symbol||(k.Symbol=aa);l=function(){}},ba=0,aa=function(a){return"jscomp_symbol_"+a+ba++},m=function(){l();k.Symbol.iterator||(k.Symbol.iterator=k.Symbol("iterator"));m=function(){}},ca=function(){var a=["next","error","complete"];m();var b=a[Symbol.iterator];if(b)return b.call(a);var c=0;return{next:function(){return c<a.length?{done:!1,value:a[c++]}:{done:!0}}}},da="function"==typeof Object.defineProperties?
Object.defineProperty:function(a,b,c){if(c.get||c.set)throw new TypeError("ES3 does not support getters and setters.");a!=Array.prototype&&a!=Object.prototype&&(a[b]=c.value)},p=function(a,b){if(b){var c=k;a=a.split(".");for(var d=0;d<a.length-1;d++){var e=a[d];e in c||(c[e]={});c=c[e]}a=a[a.length-1];d=c[a];b=b(d);b!=d&&da(c,a,{configurable:!0,ca:!0,value:b})}};
p("String.prototype.repeat",function(a){return a?a:function(a){var c;if(null==this)throw new TypeError("The 'this' value for String.prototype.repeat must not be null or undefined");c=this+"";if(0>a||1342177279<a)throw new RangeError("Invalid count value");a|=0;for(var d="";a;)if(a&1&&(d+=c),a>>>=1)c+=c;return d}});
var ea=function(a,b){m();a instanceof String&&(a+="");var c=0,d={next:function(){if(c<a.length){var e=c++;return{value:b(e,a[e]),done:!1}}d.next=function(){return{done:!0,value:void 0}};return d.next()}};d[Symbol.iterator]=function(){return d};return d};p("Array.prototype.keys",function(a){return a?a:function(){return ea(this,function(a){return a})}});
var q=this,r=function(){},t=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b},u=function(a){return"function"==t(a)},fa=function(a,b,c){return a.call.apply(a.bind,arguments)},ga=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},v=function(a,b,c){v=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?
fa:ga;return v.apply(null,arguments)},w=function(a,b){var c=Array.prototype.slice.call(arguments,1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}},x=function(a,b){function c(){}c.prototype=b.prototype;a.ba=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.aa=function(a,c,g){for(var h=Array(arguments.length-2),f=2;f<arguments.length;f++)h[f-2]=arguments[f];return b.prototype[c].apply(a,h)}};function __extends(a,b){function c(){this.constructor=a}for(var d in b)b.hasOwnProperty(d)&&(a[d]=b[d]);a.prototype=null===b?Object.create(b):(c.prototype=b.prototype,new c)}
function __decorate(a,b,c,d){var e=arguments.length,g=3>e?b:null===d?d=Object.getOwnPropertyDescriptor(b,c):d,h;h=(window||global).Reflect;if("object"===typeof h&&"function"===typeof h.decorate)g=h.decorate(a,b,c,d);else for(var f=a.length-1;0<=f;f--)if(h=a[f])g=(3>e?h(g):3<e?h(b,c,g):h(b,c))||g;return 3<e&&g&&Object.defineProperty(b,c,g),g}function __metadata(a,b){var c=(window||global).Reflect;if("object"===typeof c&&"function"===typeof c.metadata)return c.metadata(a,b)}
var __param=function(a,b){return function(c,d){b(c,d,a)}},__awaiter=function(a,b,c,d){return new (c||(c=Promise))(function(e,g){function h(a){try{n(d.next(a))}catch(b){g(b)}}function f(a){try{n(d.throw(a))}catch(b){g(b)}}function n(a){a.done?e(a.value):(new c(function(b){b(a.value)})).then(h,f)}n((d=d.apply(a,b)).next())})};var y=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,y);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};x(y,Error);y.prototype.name="CustomError";var ha=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")};var z=function(a,b){b.unshift(a);y.call(this,ha.apply(null,b));b.shift()};x(z,y);z.prototype.name="AssertionError";var A=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),g=d;else a&&(e+=": "+a,g=b);throw new z(""+e,g||[]);},B=function(a,b,c){a||A("",null,b,Array.prototype.slice.call(arguments,2))},C=function(a,b,c){u(a)||A("Expected function but got %s: %s.",[t(a),a],b,Array.prototype.slice.call(arguments,2))};var D=function(a,b,c){this.S=c;this.L=a;this.U=b;this.s=0;this.o=null};D.prototype.get=function(){var a;0<this.s?(this.s--,a=this.o,this.o=a.next,a.next=null):a=this.L();return a};D.prototype.put=function(a){this.U(a);this.s<this.S&&(this.s++,a.next=this.o,this.o=a)};var E;a:{var F=q.navigator;if(F){var ia=F.userAgent;if(ia){E=ia;break a}}E=""};var ja=function(a){q.setTimeout(function(){throw a;},0)},G,ka=function(){var a=q.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&-1==E.indexOf("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+
"//"+b.location.host,a=v(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&-1==E.indexOf("Trident")&&-1==E.indexOf("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(void 0!==c.next){c=c.next;var a=c.F;c.F=null;a()}};return function(a){d.next={F:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in
document.createElement("SCRIPT")?function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){q.setTimeout(a,0)}};var H=function(){this.v=this.f=null},la=new D(function(){return new J},function(a){a.reset()},100);H.prototype.add=function(a,b){var c=la.get();c.set(a,b);this.v?this.v.next=c:(B(!this.f),this.f=c);this.v=c};H.prototype.remove=function(){var a=null;this.f&&(a=this.f,this.f=this.f.next,this.f||(this.v=null),a.next=null);return a};var J=function(){this.next=this.scope=this.B=null};J.prototype.set=function(a,b){this.B=a;this.scope=b;this.next=null};
J.prototype.reset=function(){this.next=this.scope=this.B=null};var M=function(a,b){K||ma();L||(K(),L=!0);na.add(a,b)},K,ma=function(){if(q.Promise&&q.Promise.resolve){var a=q.Promise.resolve(void 0);K=function(){a.then(oa)}}else K=function(){var a=oa,c;!(c=!u(q.setImmediate))&&(c=q.Window&&q.Window.prototype)&&(c=-1==E.indexOf("Edge")&&q.Window.prototype.setImmediate==q.setImmediate);c?(G||(G=ka()),G(a)):q.setImmediate(a)}},L=!1,na=new H,oa=function(){for(var a;a=na.remove();){try{a.B.call(a.scope)}catch(b){ja(b)}la.put(a)}L=!1};var O=function(a,b){this.b=0;this.K=void 0;this.j=this.g=this.u=null;this.m=this.A=!1;if(a!=r)try{var c=this;a.call(b,function(a){N(c,2,a)},function(a){try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}N(c,3,a)})}catch(d){N(this,3,d)}},pa=function(){this.next=this.context=this.h=this.c=this.child=null;this.w=!1};pa.prototype.reset=function(){this.context=this.h=this.c=this.child=null;this.w=!1};
var qa=new D(function(){return new pa},function(a){a.reset()},100),ra=function(a,b,c){var d=qa.get();d.c=a;d.h=b;d.context=c;return d},ta=function(a,b,c){sa(a,b,c,null)||M(w(b,a))};O.prototype.then=function(a,b,c){null!=a&&C(a,"opt_onFulfilled should be a function.");null!=b&&C(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return ua(this,u(a)?a:null,u(b)?b:null,c)};O.prototype.then=O.prototype.then;O.prototype.$goog_Thenable=!0;
O.prototype.X=function(a,b){return ua(this,null,a,b)};var wa=function(a,b){a.g||2!=a.b&&3!=a.b||va(a);B(null!=b.c);a.j?a.j.next=b:a.g=b;a.j=b},ua=function(a,b,c,d){var e=ra(null,null,null);e.child=new O(function(a,h){e.c=b?function(c){try{var e=b.call(d,c);a(e)}catch(I){h(I)}}:a;e.h=c?function(b){try{var e=c.call(d,b);a(e)}catch(I){h(I)}}:h});e.child.u=a;wa(a,e);return e.child};O.prototype.Y=function(a){B(1==this.b);this.b=0;N(this,2,a)};O.prototype.Z=function(a){B(1==this.b);this.b=0;N(this,3,a)};
var N=function(a,b,c){0==a.b&&(a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself")),a.b=1,sa(c,a.Y,a.Z,a)||(a.K=c,a.b=b,a.u=null,va(a),3!=b||xa(a,c)))},sa=function(a,b,c,d){if(a instanceof O)return null!=b&&C(b,"opt_onFulfilled should be a function."),null!=c&&C(c,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),wa(a,ra(b||r,c||null,d)),!0;var e;if(a)try{e=!!a.$goog_Thenable}catch(h){e=!1}else e=!1;if(e)return a.then(b,c,d),
!0;e=typeof a;if("object"==e&&null!=a||"function"==e)try{var g=a.then;if(u(g))return ya(a,g,b,c,d),!0}catch(h){return c.call(d,h),!0}return!1},ya=function(a,b,c,d,e){var g=!1,h=function(a){g||(g=!0,c.call(e,a))},f=function(a){g||(g=!0,d.call(e,a))};try{b.call(a,h,f)}catch(n){f(n)}},va=function(a){a.A||(a.A=!0,M(a.N,a))},za=function(a){var b=null;a.g&&(b=a.g,a.g=b.next,b.next=null);a.g||(a.j=null);null!=b&&B(null!=b.c);return b};
O.prototype.N=function(){for(var a;a=za(this);){var b=this.b,c=this.K;if(3==b&&a.h&&!a.w){var d;for(d=this;d&&d.m;d=d.u)d.m=!1}if(a.child)a.child.u=null,Aa(a,b,c);else try{a.w?a.c.call(a.context):Aa(a,b,c)}catch(e){Ba.call(null,e)}qa.put(a)}this.A=!1};var Aa=function(a,b,c){2==b?a.c.call(a.context,c):a.h&&a.h.call(a.context,c)},xa=function(a,b){a.m=!0;M(function(){a.m&&Ba.call(null,b)})},Ba=ja;function P(a,b){if(!(b instanceof Object))return b;switch(b.constructor){case Date:return new Date(b.getTime());case Object:void 0===a&&(a={});break;case Array:a=[];break;default:return b}for(var c in b)b.hasOwnProperty(c)&&(a[c]=P(a[c],b[c]));return a};var Ca=Error.captureStackTrace,R=function(a,b){this.code=a;this.message=b;if(Ca)Ca(this,Q.prototype.create);else{var c=Error.apply(this,arguments);this.name="FirebaseError";Object.defineProperty(this,"stack",{get:function(){return c.stack}})}};R.prototype=Object.create(Error.prototype);R.prototype.constructor=R;R.prototype.name="FirebaseError";var Q=function(a,b,c){this.V=a;this.W=b;this.M=c;this.pattern=/\{\$([^}]+)}/g};
Q.prototype.create=function(a,b){void 0===b&&(b={});var c=this.M[a];a=this.V+"/"+a;var c=void 0===c?"Error":c.replace(this.pattern,function(a,c){return void 0!==b[c]?b[c].toString():"<"+c+"?>"}),c=this.W+": "+c+" ("+a+").",c=new R(a,c),d;for(d in b)b.hasOwnProperty(d)&&"_"!==d.slice(-1)&&(c[d]=b[d]);return c};O.all=function(a){return new O(function(b,c){var d=a.length,e=[];if(d)for(var g=function(a,c){d--;e[a]=c;0==d&&b(e)},h=function(a){c(a)},f=0,n;f<a.length;f++)n=a[f],ta(n,w(g,f),h);else b(e)})};O.resolve=function(a){if(a instanceof O)return a;var b=new O(r);N(b,2,a);return b};O.reject=function(a){return new O(function(b,c){c(a)})};O.prototype["catch"]=O.prototype.X;var S=O;"undefined"!==typeof Promise&&(S=Promise);var Da=S;function Ea(a,b){a=new T(a,b);return a.subscribe.bind(a)}var T=function(a,b){var c=this;this.a=[];this.J=0;this.task=Da.resolve();this.l=!1;this.D=b;this.task.then(function(){a(c)}).catch(function(a){c.error(a)})};T.prototype.next=function(a){U(this,function(b){b.next(a)})};T.prototype.error=function(a){U(this,function(b){b.error(a)});this.close(a)};T.prototype.complete=function(){U(this,function(a){a.complete()});this.close()};
T.prototype.subscribe=function(a,b,c){var d=this,e;if(void 0===a&&void 0===b&&void 0===c)throw Error("Missing Observer.");e=Fa(a)?a:{next:a,error:b,complete:c};void 0===e.next&&(e.next=V);void 0===e.error&&(e.error=V);void 0===e.complete&&(e.complete=V);a=this.$.bind(this,this.a.length);this.l&&this.task.then(function(){try{d.G?e.error(d.G):e.complete()}catch(a){}});this.a.push(e);return a};
T.prototype.$=function(a){void 0!==this.a&&void 0!==this.a[a]&&(this.a[a]=void 0,--this.J,0===this.J&&void 0!==this.D&&this.D(this))};var U=function(a,b){if(!a.l)for(var c=0;c<a.a.length;c++)Ga(a,c,b)},Ga=function(a,b,c){a.task.then(function(){if(void 0!==a.a&&void 0!==a.a[b])try{c(a.a[b])}catch(d){}})};T.prototype.close=function(a){var b=this;this.l||(this.l=!0,void 0!==a&&(this.G=a),this.task.then(function(){b.a=void 0;b.D=void 0}))};
function Fa(a){if("object"!==typeof a||null===a)return!1;for(var b=ca(),c=b.next();!c.done;c=b.next())if(c=c.value,c in a&&"function"===typeof a[c])return!0;return!1}function V(){};var W=S,X=function(a,b,c){var d=this;this.H=c;this.I=!1;this.i={};this.P={};this.C=b;this.T=P(void 0,a);Object.keys(c.INTERNAL.factories).forEach(function(a){d[a]=d.R.bind(d,a)})};X.prototype.delete=function(){var a=this;return(new W(function(b){Y(a);b()})).then(function(){a.H.INTERNAL.removeApp(a.C);return W.all(Object.keys(a.i).map(function(b){return a.i[b].INTERNAL.delete()}))}).then(function(){a.I=!0;a.i=null;a.P=null})};
X.prototype.R=function(a){Y(this);void 0===this.i[a]&&(this.i[a]=this.H.INTERNAL.factories[a](this,this.O.bind(this)));return this.i[a]};X.prototype.O=function(a){P(this,a)};var Y=function(a){a.I&&Z(Ha("deleted",{name:a.C}))};Object.defineProperties(X.prototype,{name:{configurable:!0,enumerable:!0,get:function(){Y(this);return this.C}},options:{configurable:!0,enumerable:!0,get:function(){Y(this);return this.T}}});X.prototype.name&&X.prototype.options||X.prototype.delete||console.log("dc");
function Ia(){function a(a){a=a||"[DEFAULT]";var c=b[a];void 0===c&&Z("noApp",{name:a});return c}var b={},c={},d=[],e={initializeApp:function(a,c){void 0===c?c="[DEFAULT]":"string"===typeof c&&""!==c||Z("bad-app-name",{name:c+""});void 0!==b[c]&&Z("dupApp",{name:c});var f=new X(a,c,e);b[c]=f;d.forEach(function(a){return a("create",f)});void 0!=f.INTERNAL&&void 0!=f.INTERNAL.getToken||P(f,{INTERNAL:{getToken:function(){return W.resolve(null)},addAuthTokenListener:function(){},removeAuthTokenListener:function(){}}});
return f},app:a,apps:null,Promise:W,SDK_VERSION:"0.0.0",INTERNAL:{registerService:function(b,d,f){c[b]&&Z("dupService",{name:b});c[b]=d;d=function(c){void 0===c&&(c=a());return c[b]()};void 0!==f&&P(d,f);return e[b]=d},createFirebaseNamespace:Ia,extendNamespace:function(a){P(e,a)},createSubscribe:Ea,ErrorFactory:Q,registerAppHook:function(a){d.push(a)},removeApp:function(a){d.forEach(function(c){return c("delete",b[a])});delete b[a]},factories:c,Promise:O,deepExtend:P}};Object.defineProperty(e,"apps",
{get:function(){return Object.keys(b).map(function(a){return b[a]})}});a.App=X;return e}function Z(a,b){throw Error(Ha(a,b));}
function Ha(a,b){b=b||{};b={noApp:"No Firebase App '"+b.name+"' has been created - call Firebase App.initializeApp().","bad-app-name":"Illegal App name: '"+b.name+"'.",dupApp:"Firebase App named '"+b.name+"' already exists.",deleted:"Firebase App named '"+b.name+"' already deleted.",dupService:"Firebase Service named '"+b.name+"' already registered."}[a];return void 0===b?"Application Error: ("+a+")":b};"undefined"!==typeof window&&(window.firebase=Ia()); })();
firebase.SDK_VERSION = "3.2.0";
(function(){var h,aa=aa||{},l=this,ba=function(){},ca=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&
!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},da=function(a){return null===a},ea=function(a){return"array"==ca(a)},fa=function(a){var b=ca(a);return"array"==b||"object"==b&&"number"==typeof a.length},m=function(a){return"string"==typeof a},ga=function(a){return"number"==typeof a},n=function(a){return"function"==ca(a)},ha=function(a){var b=typeof a;return"object"==b&&null!=a||"function"==b},ia=function(a,
b,c){return a.call.apply(a.bind,arguments)},ja=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},q=function(a,b,c){q=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ia:ja;return q.apply(null,arguments)},ka=function(a,b){var c=Array.prototype.slice.call(arguments,
1);return function(){var b=c.slice();b.push.apply(b,arguments);return a.apply(this,b)}},la=Date.now||function(){return+new Date},r=function(a,b){function c(){}c.prototype=b.prototype;a.Fc=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.He=function(a,c,f){for(var g=Array(arguments.length-2),k=2;k<arguments.length;k++)g[k-2]=arguments[k];return b.prototype[c].apply(a,g)}};var t=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,t);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};r(t,Error);t.prototype.name="CustomError";var ma=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")},na=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},oa=/&/g,pa=/</g,qa=/>/g,ra=/"/g,sa=/'/g,ta=/\x00/g,ua=/[\x00&<>"']/,u=function(a,b){return-1!=a.indexOf(b)},va=function(a,b){return a<b?-1:a>b?1:0};var wa=function(a,b){b.unshift(a);t.call(this,ma.apply(null,b));b.shift()};r(wa,t);wa.prototype.name="AssertionError";
var xa=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),f=d;else a&&(e+=": "+a,f=b);throw new wa(""+e,f||[]);},v=function(a,b,c){a||xa("",null,b,Array.prototype.slice.call(arguments,2))},ya=function(a,b){throw new wa("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));},za=function(a,b,c){ga(a)||xa("Expected number but got %s: %s.",[ca(a),a],b,Array.prototype.slice.call(arguments,2));return a},Aa=function(a,b,c){m(a)||xa("Expected string but got %s: %s.",[ca(a),a],b,Array.prototype.slice.call(arguments,
2))},Ba=function(a,b,c){n(a)||xa("Expected function but got %s: %s.",[ca(a),a],b,Array.prototype.slice.call(arguments,2))};var Ca=Array.prototype.indexOf?function(a,b,c){v(null!=a.length);return Array.prototype.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(m(a))return m(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},w=Array.prototype.forEach?function(a,b,c){v(null!=a.length);Array.prototype.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=m(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Da=function(a,b){for(var c=m(a)?
a.split(""):a,d=a.length-1;0<=d;--d)d in c&&b.call(void 0,c[d],d,a)},Ea=Array.prototype.map?function(a,b,c){v(null!=a.length);return Array.prototype.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=m(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},Fa=Array.prototype.some?function(a,b,c){v(null!=a.length);return Array.prototype.some.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=m(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return!0;return!1},
Ha=function(a){var b;a:{b=Ga;for(var c=a.length,d=m(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1}return 0>b?null:m(a)?a.charAt(b):a[b]},Ia=function(a,b){return 0<=Ca(a,b)},Ka=function(a,b){var c=Ca(a,b),d;(d=0<=c)&&Ja(a,c);return d},Ja=function(a,b){v(null!=a.length);return 1==Array.prototype.splice.call(a,b,1).length},La=function(a,b){var c=0;Da(a,function(d,e){b.call(void 0,d,e,a)&&Ja(a,e)&&c++})},Ma=function(a){return Array.prototype.concat.apply(Array.prototype,
arguments)},Na=function(a){return Array.prototype.concat.apply(Array.prototype,arguments)},Oa=function(a){var b=a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return[]},Pa=function(a,b){for(var c=1;c<arguments.length;c++){var d=arguments[c];if(fa(d)){var e=a.length||0,f=d.length||0;a.length=e+f;for(var g=0;g<f;g++)a[e+g]=d[g]}else a.push(d)}};var Qa=function(a,b){for(var c in a)b.call(void 0,a[c],c,a)},Ra=function(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b},Sa=function(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b},Va=function(a){for(var b in a)return!1;return!0},Wa=function(a,b){for(var c in a)if(!(c in b)||a[c]!==b[c])return!1;for(c in b)if(!(c in a))return!1;return!0},Xa=function(a){var b={},c;for(c in a)b[c]=a[c];return b},Ya="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" "),
Za=function(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<Ya.length;f++)c=Ya[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};var $a;a:{var ab=l.navigator;if(ab){var bb=ab.userAgent;if(bb){$a=bb;break a}}$a=""}var x=function(a){return u($a,a)};var cb=x("Opera"),y=x("Trident")||x("MSIE"),db=x("Edge"),eb=db||y,fb=x("Gecko")&&!(u($a.toLowerCase(),"webkit")&&!x("Edge"))&&!(x("Trident")||x("MSIE"))&&!x("Edge"),gb=u($a.toLowerCase(),"webkit")&&!x("Edge"),hb=function(){var a=l.document;return a?a.documentMode:void 0},ib;
a:{var jb="",kb=function(){var a=$a;if(fb)return/rv\:([^\);]+)(\)|;)/.exec(a);if(db)return/Edge\/([\d\.]+)/.exec(a);if(y)return/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(gb)return/WebKit\/(\S+)/.exec(a);if(cb)return/(?:Version)[ \/]?(\S+)/.exec(a)}();kb&&(jb=kb?kb[1]:"");if(y){var lb=hb();if(null!=lb&&lb>parseFloat(jb)){ib=String(lb);break a}}ib=jb}
var mb=ib,nb={},z=function(a){var b;if(!(b=nb[a])){b=0;for(var c=na(String(mb)).split("."),d=na(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",k=d[f]||"",p=RegExp("(\\d*)(\\D*)","g"),Y=RegExp("(\\d*)(\\D*)","g");do{var Ta=p.exec(g)||["","",""],Ua=Y.exec(k)||["","",""];if(0==Ta[0].length&&0==Ua[0].length)break;b=va(0==Ta[1].length?0:parseInt(Ta[1],10),0==Ua[1].length?0:parseInt(Ua[1],10))||va(0==Ta[2].length,0==Ua[2].length)||va(Ta[2],Ua[2])}while(0==b)}b=nb[a]=
0<=b}return b},ob=l.document,pb=ob&&y?hb()||("CSS1Compat"==ob.compatMode?parseInt(mb,10):5):void 0;var qb=null,rb=null,tb=function(a){var b="";sb(a,function(a){b+=String.fromCharCode(a)});return b},sb=function(a,b){function c(b){for(;d<a.length;){var c=a.charAt(d++),e=rb[c];if(null!=e)return e;if(!/^[\s\xa0]*$/.test(c))throw Error("Unknown base64 encoding at char: "+c);}return b}ub();for(var d=0;;){var e=c(-1),f=c(0),g=c(64),k=c(64);if(64===k&&-1===e)break;b(e<<2|f>>4);64!=g&&(b(f<<4&240|g>>2),64!=k&&b(g<<6&192|k))}},ub=function(){if(!qb){qb={};rb={};for(var a=0;65>a;a++)qb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),
rb[qb[a]]=a,62<=a&&(rb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a)]=a)}};var wb=function(){this.Wb="";this.Dd=vb};wb.prototype.oc=!0;wb.prototype.mc=function(){return this.Wb};wb.prototype.toString=function(){return"Const{"+this.Wb+"}"};var xb=function(a){if(a instanceof wb&&a.constructor===wb&&a.Dd===vb)return a.Wb;ya("expected object of type Const, got '"+a+"'");return"type_error:Const"},vb={};var A=function(){this.da="";this.Cd=yb};A.prototype.oc=!0;A.prototype.mc=function(){return this.da};A.prototype.toString=function(){return"SafeUrl{"+this.da+"}"};
var zb=function(a){if(a instanceof A&&a.constructor===A&&a.Cd===yb)return a.da;ya("expected object of type SafeUrl, got '"+a+"' of type "+ca(a));return"type_error:SafeUrl"},Ab=/^(?:(?:https?|mailto|ftp):|[^&:/?#]*(?:[/?#]|$))/i,Cb=function(a){if(a instanceof A)return a;a=a.oc?a.mc():String(a);Ab.test(a)||(a="about:invalid#zClosurez");return Bb(a)},yb={},Bb=function(a){var b=new A;b.da=a;return b};Bb("about:blank");var Eb=function(){this.da="";this.Bd=Db};Eb.prototype.oc=!0;Eb.prototype.mc=function(){return this.da};Eb.prototype.toString=function(){return"SafeHtml{"+this.da+"}"};var Fb=function(a){if(a instanceof Eb&&a.constructor===Eb&&a.Bd===Db)return a.da;ya("expected object of type SafeHtml, got '"+a+"' of type "+ca(a));return"type_error:SafeHtml"},Db={};Eb.prototype.ge=function(a){this.da=a;return this};var Gb=function(a,b){var c;c=b instanceof A?b:Cb(b);a.href=zb(c)};var Hb=function(a){Hb[" "](a);return a};Hb[" "]=ba;var Ib=!y||9<=Number(pb),Jb=y&&!z("9");!gb||z("528");fb&&z("1.9b")||y&&z("8")||cb&&z("9.5")||gb&&z("528");fb&&!z("8")||y&&z("9");var Kb=function(){this.ua=this.ua;this.Mb=this.Mb};Kb.prototype.ua=!1;Kb.prototype.isDisposed=function(){return this.ua};Kb.prototype.Ka=function(){if(this.Mb)for(;this.Mb.length;)this.Mb.shift()()};var Lb=function(a,b){this.type=a;this.currentTarget=this.target=b;this.defaultPrevented=this.Sa=!1;this.nd=!0};Lb.prototype.preventDefault=function(){this.defaultPrevented=!0;this.nd=!1};var Mb=function(a,b){Lb.call(this,a?a.type:"");this.relatedTarget=this.currentTarget=this.target=null;this.charCode=this.keyCode=this.button=this.screenY=this.screenX=this.clientY=this.clientX=this.offsetY=this.offsetX=0;this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1;this.Cb=this.state=null;a&&this.init(a,b)};r(Mb,Lb);
Mb.prototype.init=function(a,b){var c=this.type=a.type,d=a.changedTouches?a.changedTouches[0]:null;this.target=a.target||a.srcElement;this.currentTarget=b;var e=a.relatedTarget;if(e){if(fb){var f;a:{try{Hb(e.nodeName);f=!0;break a}catch(g){}f=!1}f||(e=null)}}else"mouseover"==c?e=a.fromElement:"mouseout"==c&&(e=a.toElement);this.relatedTarget=e;null===d?(this.offsetX=gb||void 0!==a.offsetX?a.offsetX:a.layerX,this.offsetY=gb||void 0!==a.offsetY?a.offsetY:a.layerY,this.clientX=void 0!==a.clientX?a.clientX:
a.pageX,this.clientY=void 0!==a.clientY?a.clientY:a.pageY,this.screenX=a.screenX||0,this.screenY=a.screenY||0):(this.clientX=void 0!==d.clientX?d.clientX:d.pageX,this.clientY=void 0!==d.clientY?d.clientY:d.pageY,this.screenX=d.screenX||0,this.screenY=d.screenY||0);this.button=a.button;this.keyCode=a.keyCode||0;this.charCode=a.charCode||("keypress"==c?a.keyCode:0);this.ctrlKey=a.ctrlKey;this.altKey=a.altKey;this.shiftKey=a.shiftKey;this.metaKey=a.metaKey;this.state=a.state;this.Cb=a;a.defaultPrevented&&
this.preventDefault()};Mb.prototype.preventDefault=function(){Mb.Fc.preventDefault.call(this);var a=this.Cb;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,Jb)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1}catch(b){}};var Nb="closure_listenable_"+(1E6*Math.random()|0),Ob=0;var Pb=function(a,b,c,d,e){this.listener=a;this.Ob=null;this.src=b;this.type=c;this.yb=!!d;this.Hb=e;this.key=++Ob;this.Va=this.xb=!1},Qb=function(a){a.Va=!0;a.listener=null;a.Ob=null;a.src=null;a.Hb=null};var Rb=function(a){this.src=a;this.s={};this.wb=0};Rb.prototype.add=function(a,b,c,d,e){var f=a.toString();a=this.s[f];a||(a=this.s[f]=[],this.wb++);var g=Sb(a,b,d,e);-1<g?(b=a[g],c||(b.xb=!1)):(b=new Pb(b,this.src,f,!!d,e),b.xb=c,a.push(b));return b};Rb.prototype.remove=function(a,b,c,d){a=a.toString();if(!(a in this.s))return!1;var e=this.s[a];b=Sb(e,b,c,d);return-1<b?(Qb(e[b]),Ja(e,b),0==e.length&&(delete this.s[a],this.wb--),!0):!1};
var Tb=function(a,b){var c=b.type;c in a.s&&Ka(a.s[c],b)&&(Qb(b),0==a.s[c].length&&(delete a.s[c],a.wb--))};Rb.prototype.lc=function(a,b,c,d){a=this.s[a.toString()];var e=-1;a&&(e=Sb(a,b,c,d));return-1<e?a[e]:null};var Sb=function(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.Va&&f.listener==b&&f.yb==!!c&&f.Hb==d)return e}return-1};var Ub="closure_lm_"+(1E6*Math.random()|0),Vb={},Wb=0,Xb=function(a,b,c,d,e){if(ea(b))for(var f=0;f<b.length;f++)Xb(a,b[f],c,d,e);else c=Yb(c),a&&a[Nb]?a.listen(b,c,d,e):Zb(a,b,c,!1,d,e)},Zb=function(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=!!e,k=$b(a);k||(a[Ub]=k=new Rb(a));c=k.add(b,c,d,e,f);if(c.Ob)return;d=ac();c.Ob=d;d.src=a;d.listener=c;if(a.addEventListener)a.addEventListener(b.toString(),d,g);else if(a.attachEvent)a.attachEvent(bc(b.toString()),d);else throw Error("addEventListener and attachEvent are unavailable.");
Wb++},ac=function(){var a=cc,b=Ib?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b},dc=function(a,b,c,d,e){if(ea(b))for(var f=0;f<b.length;f++)dc(a,b[f],c,d,e);else c=Yb(c),a&&a[Nb]?ec(a,b,c,d,e):Zb(a,b,c,!0,d,e)},fc=function(a,b,c,d,e){if(ea(b))for(var f=0;f<b.length;f++)fc(a,b[f],c,d,e);else c=Yb(c),a&&a[Nb]?a.T.remove(String(b),c,d,e):a&&(a=$b(a))&&(b=a.lc(b,c,!!d,e))&&gc(b)},gc=function(a){if(!ga(a)&&a&&!a.Va){var b=a.src;if(b&&b[Nb])Tb(b.T,
a);else{var c=a.type,d=a.Ob;b.removeEventListener?b.removeEventListener(c,d,a.yb):b.detachEvent&&b.detachEvent(bc(c),d);Wb--;(c=$b(b))?(Tb(c,a),0==c.wb&&(c.src=null,b[Ub]=null)):Qb(a)}}},bc=function(a){return a in Vb?Vb[a]:Vb[a]="on"+a},ic=function(a,b,c,d){var e=!0;if(a=$b(a))if(b=a.s[b.toString()])for(b=b.concat(),a=0;a<b.length;a++){var f=b[a];f&&f.yb==c&&!f.Va&&(f=hc(f,d),e=e&&!1!==f)}return e},hc=function(a,b){var c=a.listener,d=a.Hb||a.src;a.xb&&gc(a);return c.call(d,b)},cc=function(a,b){if(a.Va)return!0;
if(!Ib){var c;if(!(c=b))a:{c=["window","event"];for(var d=l,e;e=c.shift();)if(null!=d[e])d=d[e];else{c=null;break a}c=d}e=c;c=new Mb(e,this);d=!0;if(!(0>e.keyCode||void 0!=e.returnValue)){a:{var f=!1;if(0==e.keyCode)try{e.keyCode=-1;break a}catch(p){f=!0}if(f||void 0==e.returnValue)e.returnValue=!0}e=[];for(f=c.currentTarget;f;f=f.parentNode)e.push(f);for(var f=a.type,g=e.length-1;!c.Sa&&0<=g;g--){c.currentTarget=e[g];var k=ic(e[g],f,!0,c),d=d&&k}for(g=0;!c.Sa&&g<e.length;g++)c.currentTarget=e[g],
k=ic(e[g],f,!1,c),d=d&&k}return d}return hc(a,new Mb(b,this))},$b=function(a){a=a[Ub];return a instanceof Rb?a:null},jc="__closure_events_fn_"+(1E9*Math.random()>>>0),Yb=function(a){v(a,"Listener can not be null.");if(n(a))return a;v(a.handleEvent,"An object listener must have handleEvent method.");a[jc]||(a[jc]=function(b){return a.handleEvent(b)});return a[jc]};var kc=/^[+a-zA-Z0-9_.!#$%&'*\/=?^`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z0-9]{2,63}$/;var lc=function(a){a=String(a);if(/^\s*$/.test(a)?0:/^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g,"@").replace(/(?:"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)[\s\u2028\u2029]*(?=:|,|]|}|$)/g,"]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g,"")))try{return eval("("+a+")")}catch(b){}throw Error("Invalid JSON string: "+a);},oc=function(a){var b=[];mc(new nc,a,b);return b.join("")},nc=function(){this.Rb=void 0},mc=function(a,b,c){if(null==
b)c.push("null");else{if("object"==typeof b){if(ea(b)){var d=b;b=d.length;c.push("[");for(var e="",f=0;f<b;f++)c.push(e),e=d[f],mc(a,a.Rb?a.Rb.call(d,String(f),e):e,c),e=",";c.push("]");return}if(b instanceof String||b instanceof Number||b instanceof Boolean)b=b.valueOf();else{c.push("{");f="";for(d in b)Object.prototype.hasOwnProperty.call(b,d)&&(e=b[d],"function"!=typeof e&&(c.push(f),pc(d,c),c.push(":"),mc(a,a.Rb?a.Rb.call(b,d,e):e,c),f=","));c.push("}");return}}switch(typeof b){case "string":pc(b,
c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?String(b):"null");break;case "boolean":c.push(String(b));break;case "function":c.push("null");break;default:throw Error("Unknown type: "+typeof b);}}},qc={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},rc=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g,pc=function(a,b){b.push('"',a.replace(rc,function(a){var b=qc[a];b||(b="\\u"+(a.charCodeAt(0)|65536).toString(16).substr(1),
qc[a]=b);return b}),'"')};var sc=function(){};sc.prototype.Jc=null;var tc=function(a){return a.Jc||(a.Jc=a.qc())};var uc,vc=function(){};r(vc,sc);vc.prototype.zb=function(){var a=wc(this);return a?new ActiveXObject(a):new XMLHttpRequest};vc.prototype.qc=function(){var a={};wc(this)&&(a[0]=!0,a[1]=!0);return a};
var wc=function(a){if(!a.Yc&&"undefined"==typeof XMLHttpRequest&&"undefined"!=typeof ActiveXObject){for(var b=["MSXML2.XMLHTTP.6.0","MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"],c=0;c<b.length;c++){var d=b[c];try{return new ActiveXObject(d),a.Yc=d}catch(e){}}throw Error("Could not create ActiveXObject. ActiveX might be disabled, or MSXML might not be installed");}return a.Yc};uc=new vc;var xc=function(){};r(xc,sc);xc.prototype.zb=function(){var a=new XMLHttpRequest;if("withCredentials"in a)return a;if("undefined"!=typeof XDomainRequest)return new yc;throw Error("Unsupported browser");};xc.prototype.qc=function(){return{}};
var yc=function(){this.ia=new XDomainRequest;this.readyState=0;this.onreadystatechange=null;this.responseText="";this.status=-1;this.statusText=this.responseXML=null;this.ia.onload=q(this.Vd,this);this.ia.onerror=q(this.Wc,this);this.ia.onprogress=q(this.Wd,this);this.ia.ontimeout=q(this.Xd,this)};h=yc.prototype;h.open=function(a,b,c){if(null!=c&&!c)throw Error("Only async requests are supported.");this.ia.open(a,b)};
h.send=function(a){if(a)if("string"==typeof a)this.ia.send(a);else throw Error("Only string data is supported");else this.ia.send()};h.abort=function(){this.ia.abort()};h.setRequestHeader=function(){};h.Vd=function(){this.status=200;this.responseText=this.ia.responseText;zc(this,4)};h.Wc=function(){this.status=500;this.responseText="";zc(this,4)};h.Xd=function(){this.Wc()};h.Wd=function(){this.status=200;zc(this,1)};var zc=function(a,b){a.readyState=b;if(a.onreadystatechange)a.onreadystatechange()};var B=function(a,b){this.h=[];this.g=b;for(var c=!0,d=a.length-1;0<=d;d--){var e=a[d]|0;c&&e==b||(this.h[d]=e,c=!1)}},Ac={},Bc=function(a){if(-128<=a&&128>a){var b=Ac[a];if(b)return b}b=new B([a|0],0>a?-1:0);-128<=a&&128>a&&(Ac[a]=b);return b},E=function(a){if(isNaN(a)||!isFinite(a))return C;if(0>a)return D(E(-a));for(var b=[],c=1,d=0;a>=c;d++)b[d]=a/c|0,c*=4294967296;return new B(b,0)},Cc=function(a,b){if(0==a.length)throw Error("number format error: empty string");var c=b||10;if(2>c||36<c)throw Error("radix out of range: "+
c);if("-"==a.charAt(0))return D(Cc(a.substring(1),c));if(0<=a.indexOf("-"))throw Error('number format error: interior "-" character');for(var d=E(Math.pow(c,8)),e=C,f=0;f<a.length;f+=8){var g=Math.min(8,a.length-f),k=parseInt(a.substring(f,f+g),c);8>g?(g=E(Math.pow(c,g)),e=e.multiply(g).add(E(k))):(e=e.multiply(d),e=e.add(E(k)))}return e},C=Bc(0),Dc=Bc(1),Ec=Bc(16777216),Fc=function(a){if(-1==a.g)return-Fc(D(a));for(var b=0,c=1,d=0;d<a.h.length;d++)b+=Gc(a,d)*c,c*=4294967296;return b};
B.prototype.toString=function(a){a=a||10;if(2>a||36<a)throw Error("radix out of range: "+a);if(F(this))return"0";if(-1==this.g)return"-"+D(this).toString(a);for(var b=E(Math.pow(a,6)),c=this,d="";;){var e=Hc(c,b),c=Ic(c,e.multiply(b)),f=((0<c.h.length?c.h[0]:c.g)>>>0).toString(a),c=e;if(F(c))return f+d;for(;6>f.length;)f="0"+f;d=""+f+d}};
var G=function(a,b){return 0>b?0:b<a.h.length?a.h[b]:a.g},Gc=function(a,b){var c=G(a,b);return 0<=c?c:4294967296+c},F=function(a){if(0!=a.g)return!1;for(var b=0;b<a.h.length;b++)if(0!=a.h[b])return!1;return!0};B.prototype.Bb=function(a){if(this.g!=a.g)return!1;for(var b=Math.max(this.h.length,a.h.length),c=0;c<b;c++)if(G(this,c)!=G(a,c))return!1;return!0};B.prototype.compare=function(a){a=Ic(this,a);return-1==a.g?-1:F(a)?0:1};
var D=function(a){for(var b=a.h.length,c=[],d=0;d<b;d++)c[d]=~a.h[d];return(new B(c,~a.g)).add(Dc)};B.prototype.add=function(a){for(var b=Math.max(this.h.length,a.h.length),c=[],d=0,e=0;e<=b;e++){var f=d+(G(this,e)&65535)+(G(a,e)&65535),g=(f>>>16)+(G(this,e)>>>16)+(G(a,e)>>>16),d=g>>>16,f=f&65535,g=g&65535;c[e]=g<<16|f}return new B(c,c[c.length-1]&-2147483648?-1:0)};var Ic=function(a,b){return a.add(D(b))};
B.prototype.multiply=function(a){if(F(this)||F(a))return C;if(-1==this.g)return-1==a.g?D(this).multiply(D(a)):D(D(this).multiply(a));if(-1==a.g)return D(this.multiply(D(a)));if(0>this.compare(Ec)&&0>a.compare(Ec))return E(Fc(this)*Fc(a));for(var b=this.h.length+a.h.length,c=[],d=0;d<2*b;d++)c[d]=0;for(d=0;d<this.h.length;d++)for(var e=0;e<a.h.length;e++){var f=G(this,d)>>>16,g=G(this,d)&65535,k=G(a,e)>>>16,p=G(a,e)&65535;c[2*d+2*e]+=g*p;Jc(c,2*d+2*e);c[2*d+2*e+1]+=f*p;Jc(c,2*d+2*e+1);c[2*d+2*e+1]+=
g*k;Jc(c,2*d+2*e+1);c[2*d+2*e+2]+=f*k;Jc(c,2*d+2*e+2)}for(d=0;d<b;d++)c[d]=c[2*d+1]<<16|c[2*d];for(d=b;d<2*b;d++)c[d]=0;return new B(c,0)};
var Jc=function(a,b){for(;(a[b]&65535)!=a[b];)a[b+1]+=a[b]>>>16,a[b]&=65535},Hc=function(a,b){if(F(b))throw Error("division by zero");if(F(a))return C;if(-1==a.g)return-1==b.g?Hc(D(a),D(b)):D(Hc(D(a),b));if(-1==b.g)return D(Hc(a,D(b)));if(30<a.h.length){if(-1==a.g||-1==b.g)throw Error("slowDivide_ only works with positive integers.");for(var c=Dc,d=b;0>=d.compare(a);)c=c.shiftLeft(1),d=d.shiftLeft(1);for(var e=Kc(c,1),f=Kc(d,1),g,d=Kc(d,2),c=Kc(c,2);!F(d);)g=f.add(d),0>=g.compare(a)&&(e=e.add(c),
f=g),d=Kc(d,1),c=Kc(c,1);return e}c=C;for(d=a;0<=d.compare(b);){e=Math.max(1,Math.floor(Fc(d)/Fc(b)));f=Math.ceil(Math.log(e)/Math.LN2);f=48>=f?1:Math.pow(2,f-48);g=E(e);for(var k=g.multiply(b);-1==k.g||0<k.compare(d);)e-=f,g=E(e),k=g.multiply(b);F(g)&&(g=Dc);c=c.add(g);d=Ic(d,k)}return c},Lc=function(a,b){for(var c=Math.max(a.h.length,b.h.length),d=[],e=0;e<c;e++)d[e]=G(a,e)|G(b,e);return new B(d,a.g|b.g)};
B.prototype.shiftLeft=function(a){var b=a>>5;a%=32;for(var c=this.h.length+b+(0<a?1:0),d=[],e=0;e<c;e++)d[e]=0<a?G(this,e-b)<<a|G(this,e-b-1)>>>32-a:G(this,e-b);return new B(d,this.g)};var Kc=function(a,b){for(var c=b>>5,d=b%32,e=a.h.length-c,f=[],g=0;g<e;g++)f[g]=0<d?G(a,g+c)>>>d|G(a,g+c+1)<<32-d:G(a,g+c);return new B(f,a.g)};var Mc=function(a,b){this.ib=a;this.ha=b};Mc.prototype.Bb=function(a){return this.ha==a.ha&&this.ib.Bb(Xa(a.ib))};
var Pc=function(a){try{var b;if(b=0==a.lastIndexOf("[",0)){var c=a.length-1;b=0<=c&&a.indexOf("]",c)==c}return b?new Nc(a.substring(1,a.length-1)):new Oc(a)}catch(d){return null}},Oc=function(a){var b=C;if(a instanceof B){if(0!=a.g||0>a.compare(C)||0<a.compare(Qc))throw Error("The address does not look like an IPv4.");b=Xa(a)}else{if(!Rc.test(a))throw Error(a+" does not look like an IPv4 address.");var c=a.split(".");if(4!=c.length)throw Error(a+" does not look like an IPv4 address.");for(var d=0;d<
c.length;d++){var e;e=c[d];var f=Number(e);e=0==f&&/^[\s\xa0]*$/.test(e)?NaN:f;if(isNaN(e)||0>e||255<e||1!=c[d].length&&0==c[d].lastIndexOf("0",0))throw Error("In "+a+", octet "+d+" is not valid");e=E(e);b=Lc(b.shiftLeft(8),e)}}Mc.call(this,b,4)};r(Oc,Mc);var Rc=/^[0-9.]*$/,Qc=Ic(Dc.shiftLeft(32),Dc);Oc.prototype.toString=function(){if(this.ya)return this.ya;for(var a=Gc(this.ib,0),b=[],c=3;0<=c;c--)b[c]=String(a&255),a>>>=8;return this.ya=b.join(".")};
var Nc=function(a){var b=C;if(a instanceof B){if(0!=a.g||0>a.compare(C)||0<a.compare(Sc))throw Error("The address does not look like a valid IPv6.");b=Xa(a)}else{if(!Tc.test(a))throw Error(a+" is not a valid IPv6 address.");var c=a.split(":");if(-1!=c[c.length-1].indexOf(".")){a=Gc(Xa((new Oc(c[c.length-1])).ib),0);var d=[];d.push((a>>>16&65535).toString(16));d.push((a&65535).toString(16));Ja(c,c.length-1);Pa(c,d);a=c.join(":")}d=a.split("::");if(2<d.length||1==d.length&&8!=c.length)throw Error(a+
" is not a valid IPv6 address.");if(1<d.length){c=d[0].split(":");d=d[1].split(":");1==c.length&&""==c[0]&&(c=[]);1==d.length&&""==d[0]&&(d=[]);var e=8-(c.length+d.length);if(1>e)c=[];else{for(var f=[],g=0;g<e;g++)f[g]="0";c=Na(c,f,d)}}if(8!=c.length)throw Error(a+" is not a valid IPv6 address");for(d=0;d<c.length;d++){e=Cc(c[d],16);if(0>e.compare(C)||0<e.compare(Uc))throw Error(c[d]+" in "+a+" is not a valid hextet.");b=Lc(b.shiftLeft(16),e)}}Mc.call(this,b,6)};r(Nc,Mc);
var Tc=/^([a-fA-F0-9]*:){2}[a-fA-F0-9:.]*$/,Uc=Bc(65535),Sc=Ic(Dc.shiftLeft(128),Dc);Nc.prototype.toString=function(){if(this.ya)return this.ya;for(var a=[],b=3;0<=b;b--){var c=Gc(this.ib,b),d=c&65535;a.push((c>>>16).toString(16));a.push(d.toString(16))}for(var c=b=-1,e=d=0,f=0;f<a.length;f++)"0"==a[f]?(e++,-1==c&&(c=f),e>d&&(d=e,b=c)):(c=-1,e=0);0<d&&(b+d==a.length&&a.push(""),a.splice(b,d,""),0==b&&(a=[""].concat(a)));return this.ya=a.join(":")};!fb&&!y||y&&9<=Number(pb)||fb&&z("1.9.1");y&&z("9");var Wc=function(a,b){Qa(b,function(b,d){"style"==d?a.style.cssText=b:"class"==d?a.className=b:"for"==d?a.htmlFor=b:Vc.hasOwnProperty(d)?a.setAttribute(Vc[d],b):0==d.lastIndexOf("aria-",0)||0==d.lastIndexOf("data-",0)?a.setAttribute(d,b):a[d]=b})},Vc={cellpadding:"cellPadding",cellspacing:"cellSpacing",colspan:"colSpan",frameborder:"frameBorder",height:"height",maxlength:"maxLength",nonce:"nonce",role:"role",rowspan:"rowSpan",type:"type",usemap:"useMap",valign:"vAlign",width:"width"};var Xc=function(a,b,c){this.ie=c;this.Kd=a;this.se=b;this.Lb=0;this.Ib=null};Xc.prototype.get=function(){var a;0<this.Lb?(this.Lb--,a=this.Ib,this.Ib=a.next,a.next=null):a=this.Kd();return a};Xc.prototype.put=function(a){this.se(a);this.Lb<this.ie&&(this.Lb++,a.next=this.Ib,this.Ib=a)};var Yc=function(a){l.setTimeout(function(){throw a;},0)},Zc,$c=function(){var a=l.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&!x("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,
a=q(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&!x("Trident")&&!x("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(void 0!==c.next){c=c.next;var a=c.Nc;c.Nc=null;a()}};return function(a){d.next={Nc:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("SCRIPT")?
function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){l.setTimeout(a,0)}};var ad=function(){this.$b=this.Ga=null},cd=new Xc(function(){return new bd},function(a){a.reset()},100);ad.prototype.add=function(a,b){var c=cd.get();c.set(a,b);this.$b?this.$b.next=c:(v(!this.Ga),this.Ga=c);this.$b=c};ad.prototype.remove=function(){var a=null;this.Ga&&(a=this.Ga,this.Ga=this.Ga.next,this.Ga||(this.$b=null),a.next=null);return a};var bd=function(){this.next=this.scope=this.kc=null};bd.prototype.set=function(a,b){this.kc=a;this.scope=b;this.next=null};
bd.prototype.reset=function(){this.next=this.scope=this.kc=null};var hd=function(a,b){dd||ed();fd||(dd(),fd=!0);gd.add(a,b)},dd,ed=function(){if(l.Promise&&l.Promise.resolve){var a=l.Promise.resolve(void 0);dd=function(){a.then(id)}}else dd=function(){var a=id;!n(l.setImmediate)||l.Window&&l.Window.prototype&&!x("Edge")&&l.Window.prototype.setImmediate==l.setImmediate?(Zc||(Zc=$c()),Zc(a)):l.setImmediate(a)}},fd=!1,gd=new ad,id=function(){for(var a;a=gd.remove();){try{a.kc.call(a.scope)}catch(b){Yc(b)}cd.put(a)}fd=!1};var jd=function(a){a.prototype.then=a.prototype.then;a.prototype.$goog_Thenable=!0},kd=function(a){if(!a)return!1;try{return!!a.$goog_Thenable}catch(b){return!1}};var H=function(a,b){this.A=0;this.fa=void 0;this.Ja=this.aa=this.l=null;this.Gb=this.jc=!1;if(a!=ba)try{var c=this;a.call(b,function(a){ld(c,2,a)},function(a){if(!(a instanceof md))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}ld(c,3,a)})}catch(d){ld(this,3,d)}},nd=function(){this.next=this.context=this.Pa=this.za=this.child=null;this.ab=!1};nd.prototype.reset=function(){this.context=this.Pa=this.za=this.child=null;this.ab=!1};
var od=new Xc(function(){return new nd},function(a){a.reset()},100),pd=function(a,b,c){var d=od.get();d.za=a;d.Pa=b;d.context=c;return d},I=function(a){if(a instanceof H)return a;var b=new H(ba);ld(b,2,a);return b},J=function(a){return new H(function(b,c){c(a)})},rd=function(a,b,c){qd(a,b,c,null)||hd(ka(b,a))},sd=function(a){return new H(function(b){var c=a.length,d=[];if(c)for(var e=function(a,e,f){c--;d[a]=e?{Td:!0,value:f}:{Td:!1,reason:f};0==c&&b(d)},f=0,g;f<a.length;f++)g=a[f],rd(g,ka(e,f,!0),
ka(e,f,!1));else b(d)})};H.prototype.then=function(a,b,c){null!=a&&Ba(a,"opt_onFulfilled should be a function.");null!=b&&Ba(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return td(this,n(a)?a:null,n(b)?b:null,c)};jd(H);var vd=function(a,b){var c=pd(b,b,void 0);c.ab=!0;ud(a,c);return a};H.prototype.N=function(a,b){return td(this,null,a,b)};H.prototype.cancel=function(a){0==this.A&&hd(function(){var b=new md(a);wd(this,b)},this)};
var wd=function(a,b){if(0==a.A)if(a.l){var c=a.l;if(c.aa){for(var d=0,e=null,f=null,g=c.aa;g&&(g.ab||(d++,g.child==a&&(e=g),!(e&&1<d)));g=g.next)e||(f=g);e&&(0==c.A&&1==d?wd(c,b):(f?(d=f,v(c.aa),v(null!=d),d.next==c.Ja&&(c.Ja=d),d.next=d.next.next):xd(c),yd(c,e,3,b)))}a.l=null}else ld(a,3,b)},ud=function(a,b){a.aa||2!=a.A&&3!=a.A||zd(a);v(null!=b.za);a.Ja?a.Ja.next=b:a.aa=b;a.Ja=b},td=function(a,b,c,d){var e=pd(null,null,null);e.child=new H(function(a,g){e.za=b?function(c){try{var e=b.call(d,c);a(e)}catch(Y){g(Y)}}:
a;e.Pa=c?function(b){try{var e=c.call(d,b);void 0===e&&b instanceof md?g(b):a(e)}catch(Y){g(Y)}}:g});e.child.l=a;ud(a,e);return e.child};H.prototype.Be=function(a){v(1==this.A);this.A=0;ld(this,2,a)};H.prototype.Ce=function(a){v(1==this.A);this.A=0;ld(this,3,a)};
var ld=function(a,b,c){0==a.A&&(a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself")),a.A=1,qd(c,a.Be,a.Ce,a)||(a.fa=c,a.A=b,a.l=null,zd(a),3!=b||c instanceof md||Ad(a,c)))},qd=function(a,b,c,d){if(a instanceof H)return null!=b&&Ba(b,"opt_onFulfilled should be a function."),null!=c&&Ba(c,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),ud(a,pd(b||ba,c||null,d)),!0;if(kd(a))return a.then(b,c,d),!0;if(ha(a))try{var e=a.then;if(n(e))return Bd(a,
e,b,c,d),!0}catch(f){return c.call(d,f),!0}return!1},Bd=function(a,b,c,d,e){var f=!1,g=function(a){f||(f=!0,c.call(e,a))},k=function(a){f||(f=!0,d.call(e,a))};try{b.call(a,g,k)}catch(p){k(p)}},zd=function(a){a.jc||(a.jc=!0,hd(a.Od,a))},xd=function(a){var b=null;a.aa&&(b=a.aa,a.aa=b.next,b.next=null);a.aa||(a.Ja=null);null!=b&&v(null!=b.za);return b};H.prototype.Od=function(){for(var a;a=xd(this);)yd(this,a,this.A,this.fa);this.jc=!1};
var yd=function(a,b,c,d){if(3==c&&b.Pa&&!b.ab)for(;a&&a.Gb;a=a.l)a.Gb=!1;if(b.child)b.child.l=null,Cd(b,c,d);else try{b.ab?b.za.call(b.context):Cd(b,c,d)}catch(e){Dd.call(null,e)}od.put(b)},Cd=function(a,b,c){2==b?a.za.call(a.context,c):a.Pa&&a.Pa.call(a.context,c)},Ad=function(a,b){a.Gb=!0;hd(function(){a.Gb&&Dd.call(null,b)})},Dd=Yc,md=function(a){t.call(this,a)};r(md,t);md.prototype.name="cancel";/*
 Portions of this code are from MochiKit, received by
 The Closure Authors under the MIT license. All other code is Copyright
 2005-2009 The Closure Authors. All Rights Reserved.
*/
var Ed=function(a,b){this.Sb=[];this.gd=a;this.Pc=b||null;this.fb=this.Ma=!1;this.fa=void 0;this.Dc=this.Ic=this.dc=!1;this.Yb=0;this.l=null;this.ec=0};Ed.prototype.cancel=function(a){if(this.Ma)this.fa instanceof Ed&&this.fa.cancel();else{if(this.l){var b=this.l;delete this.l;a?b.cancel(a):(b.ec--,0>=b.ec&&b.cancel())}this.gd?this.gd.call(this.Pc,this):this.Dc=!0;this.Ma||Fd(this,new Gd)}};Ed.prototype.Oc=function(a,b){this.dc=!1;Hd(this,a,b)};
var Hd=function(a,b,c){a.Ma=!0;a.fa=c;a.fb=!b;Id(a)},Kd=function(a){if(a.Ma){if(!a.Dc)throw new Jd;a.Dc=!1}};Ed.prototype.callback=function(a){Kd(this);Ld(a);Hd(this,!0,a)};var Fd=function(a,b){Kd(a);Ld(b);Hd(a,!1,b)},Ld=function(a){v(!(a instanceof Ed),"An execution sequence may not be initiated with a blocking Deferred.")},Nd=function(a,b){Md(a,null,b,void 0)},Md=function(a,b,c,d){v(!a.Ic,"Blocking Deferreds can not be re-used");a.Sb.push([b,c,d]);a.Ma&&Id(a)};
Ed.prototype.then=function(a,b,c){var d,e,f=new H(function(a,b){d=a;e=b});Md(this,d,function(a){a instanceof Gd?f.cancel():e(a)});return f.then(a,b,c)};jd(Ed);
var Od=function(a){return Fa(a.Sb,function(a){return n(a[1])})},Id=function(a){if(a.Yb&&a.Ma&&Od(a)){var b=a.Yb,c=Pd[b];c&&(l.clearTimeout(c.gb),delete Pd[b]);a.Yb=0}a.l&&(a.l.ec--,delete a.l);for(var b=a.fa,d=c=!1;a.Sb.length&&!a.dc;){var e=a.Sb.shift(),f=e[0],g=e[1],e=e[2];if(f=a.fb?g:f)try{var k=f.call(e||a.Pc,b);void 0!==k&&(a.fb=a.fb&&(k==b||k instanceof Error),a.fa=b=k);if(kd(b)||"function"===typeof l.Promise&&b instanceof l.Promise)d=!0,a.dc=!0}catch(p){b=p,a.fb=!0,Od(a)||(c=!0)}}a.fa=b;d&&
(k=q(a.Oc,a,!0),d=q(a.Oc,a,!1),b instanceof Ed?(Md(b,k,d),b.Ic=!0):b.then(k,d));c&&(b=new Qd(b),Pd[b.gb]=b,a.Yb=b.gb)},Jd=function(){t.call(this)};r(Jd,t);Jd.prototype.message="Deferred has already fired";Jd.prototype.name="AlreadyCalledError";var Gd=function(){t.call(this)};r(Gd,t);Gd.prototype.message="Deferred was canceled";Gd.prototype.name="CanceledError";var Qd=function(a){this.gb=l.setTimeout(q(this.Ae,this),0);this.G=a};
Qd.prototype.Ae=function(){v(Pd[this.gb],"Cannot throw an error that is not scheduled.");delete Pd[this.gb];throw this.G;};var Pd={};var Vd=function(a){var b={},c=b.document||document,d=document.createElement("SCRIPT"),e={od:d,vb:void 0},f=new Ed(Rd,e),g=null,k=null!=b.timeout?b.timeout:5E3;0<k&&(g=window.setTimeout(function(){Sd(d,!0);Fd(f,new Td(1,"Timeout reached for loading script "+a))},k),e.vb=g);d.onload=d.onreadystatechange=function(){d.readyState&&"loaded"!=d.readyState&&"complete"!=d.readyState||(Sd(d,b.Ie||!1,g),f.callback(null))};d.onerror=function(){Sd(d,!0,g);Fd(f,new Td(0,"Error while loading script "+a))};e=b.attributes||
{};Za(e,{type:"text/javascript",charset:"UTF-8",src:a});Wc(d,e);Ud(c).appendChild(d);return f},Ud=function(a){var b=a.getElementsByTagName("HEAD");return b&&0!=b.length?b[0]:a.documentElement},Rd=function(){if(this&&this.od){var a=this.od;a&&"SCRIPT"==a.tagName&&Sd(a,!0,this.vb)}},Sd=function(a,b,c){null!=c&&l.clearTimeout(c);a.onload=ba;a.onerror=ba;a.onreadystatechange=ba;b&&window.setTimeout(function(){a&&a.parentNode&&a.parentNode.removeChild(a)},0)},Td=function(a,b){var c="Jsloader error (code #"+
a+")";b&&(c+=": "+b);t.call(this,c);this.code=a};r(Td,t);var Wd=function(){Kb.call(this);this.T=new Rb(this);this.Gd=this;this.tc=null};r(Wd,Kb);Wd.prototype[Nb]=!0;h=Wd.prototype;h.addEventListener=function(a,b,c,d){Xb(this,a,b,c,d)};h.removeEventListener=function(a,b,c,d){fc(this,a,b,c,d)};
h.dispatchEvent=function(a){Xd(this);var b,c=this.tc;if(c){b=[];for(var d=1;c;c=c.tc)b.push(c),v(1E3>++d,"infinite loop")}c=this.Gd;d=a.type||a;if(m(a))a=new Lb(a,c);else if(a instanceof Lb)a.target=a.target||c;else{var e=a;a=new Lb(d,c);Za(a,e)}var e=!0,f;if(b)for(var g=b.length-1;!a.Sa&&0<=g;g--)f=a.currentTarget=b[g],e=Yd(f,d,!0,a)&&e;a.Sa||(f=a.currentTarget=c,e=Yd(f,d,!0,a)&&e,a.Sa||(e=Yd(f,d,!1,a)&&e));if(b)for(g=0;!a.Sa&&g<b.length;g++)f=a.currentTarget=b[g],e=Yd(f,d,!1,a)&&e;return e};
h.Ka=function(){Wd.Fc.Ka.call(this);if(this.T){var a=this.T,b=0,c;for(c in a.s){for(var d=a.s[c],e=0;e<d.length;e++)++b,Qb(d[e]);delete a.s[c];a.wb--}}this.tc=null};h.listen=function(a,b,c,d){Xd(this);return this.T.add(String(a),b,!1,c,d)};
var ec=function(a,b,c,d,e){a.T.add(String(b),c,!0,d,e)},Yd=function(a,b,c,d){b=a.T.s[String(b)];if(!b)return!0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.Va&&g.yb==c){var k=g.listener,p=g.Hb||g.src;g.xb&&Tb(a.T,g);e=!1!==k.call(p,d)&&e}}return e&&0!=d.nd};Wd.prototype.lc=function(a,b,c,d){return this.T.lc(String(a),b,c,d)};var Xd=function(a){v(a.T,"Event target is not initialized. Did you call the superclass (goog.events.EventTarget) constructor?")};var Zd="StopIteration"in l?l.StopIteration:{message:"StopIteration",stack:""},$d=function(){};$d.prototype.next=function(){throw Zd;};$d.prototype.Fd=function(){return this};var ae=function(a,b){this.U={};this.m=[];this.ha=this.i=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1])}else a&&this.addAll(a)};h=ae.prototype;h.Uc=function(){return this.i};h.O=function(){be(this);for(var a=[],b=0;b<this.m.length;b++)a.push(this.U[this.m[b]]);return a};h.ba=function(){be(this);return this.m.concat()};h.cb=function(a){return ce(this.U,a)};
h.Bb=function(a,b){if(this===a)return!0;if(this.i!=a.Uc())return!1;var c=b||de;be(this);for(var d,e=0;d=this.m[e];e++)if(!c(this.get(d),a.get(d)))return!1;return!0};var de=function(a,b){return a===b};ae.prototype.remove=function(a){return ce(this.U,a)?(delete this.U[a],this.i--,this.ha++,this.m.length>2*this.i&&be(this),!0):!1};
var be=function(a){if(a.i!=a.m.length){for(var b=0,c=0;b<a.m.length;){var d=a.m[b];ce(a.U,d)&&(a.m[c++]=d);b++}a.m.length=c}if(a.i!=a.m.length){for(var e={},c=b=0;b<a.m.length;)d=a.m[b],ce(e,d)||(a.m[c++]=d,e[d]=1),b++;a.m.length=c}};h=ae.prototype;h.get=function(a,b){return ce(this.U,a)?this.U[a]:b};h.set=function(a,b){ce(this.U,a)||(this.i++,this.m.push(a),this.ha++);this.U[a]=b};
h.addAll=function(a){var b;a instanceof ae?(b=a.ba(),a=a.O()):(b=Sa(a),a=Ra(a));for(var c=0;c<b.length;c++)this.set(b[c],a[c])};h.forEach=function(a,b){for(var c=this.ba(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this)}};h.clone=function(){return new ae(this)};h.Fd=function(a){be(this);var b=0,c=this.ha,d=this,e=new $d;e.next=function(){if(c!=d.ha)throw Error("The map has changed since the iterator was created");if(b>=d.m.length)throw Zd;var e=d.m[b++];return a?e:d.U[e]};return e};
var ce=function(a,b){return Object.prototype.hasOwnProperty.call(a,b)};var ee=function(a){if(a.O&&"function"==typeof a.O)return a.O();if(m(a))return a.split("");if(fa(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}return Ra(a)},fe=function(a){if(a.ba&&"function"==typeof a.ba)return a.ba();if(!a.O||"function"!=typeof a.O){if(fa(a)||m(a)){var b=[];a=a.length;for(var c=0;c<a;c++)b.push(c);return b}return Sa(a)}},ge=function(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(fa(a)||m(a))w(a,b,void 0);else for(var c=fe(a),d=ee(a),e=
d.length,f=0;f<e;f++)b.call(void 0,d[f],c&&c[f],a)};var he=function(a,b,c,d,e){this.reset(a,b,c,d,e)};he.prototype.Rc=null;var ie=0;he.prototype.reset=function(a,b,c,d,e){"number"==typeof e||ie++;d||la();this.lb=a;this.ke=b;delete this.Rc};he.prototype.rd=function(a){this.lb=a};var je=function(a){this.le=a;this.Xc=this.fc=this.lb=this.l=null},ke=function(a,b){this.name=a;this.value=b};ke.prototype.toString=function(){return this.name};var le=new ke("SEVERE",1E3),me=new ke("CONFIG",700),ne=new ke("FINE",500);je.prototype.getParent=function(){return this.l};je.prototype.rd=function(a){this.lb=a};var oe=function(a){if(a.lb)return a.lb;if(a.l)return oe(a.l);ya("Root logger has no level set.");return null};
je.prototype.log=function(a,b,c){if(a.value>=oe(this).value)for(n(b)&&(b=b()),a=new he(a,String(b),this.le),c&&(a.Rc=c),c="log:"+a.ke,l.console&&(l.console.timeStamp?l.console.timeStamp(c):l.console.markTimeline&&l.console.markTimeline(c)),l.msWriteProfilerMark&&l.msWriteProfilerMark(c),c=this;c;){b=c;var d=a;if(b.Xc)for(var e=0,f;f=b.Xc[e];e++)f(d);c=c.getParent()}};
var pe={},qe=null,re=function(a){qe||(qe=new je(""),pe[""]=qe,qe.rd(me));var b;if(!(b=pe[a])){b=new je(a);var c=a.lastIndexOf("."),d=a.substr(c+1),c=re(a.substr(0,c));c.fc||(c.fc={});c.fc[d]=b;b.l=c;pe[a]=b}return b};var K=function(a,b){a&&a.log(ne,b,void 0)};var se=function(a,b,c){if(n(a))c&&(a=q(a,c));else if(a&&"function"==typeof a.handleEvent)a=q(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:l.setTimeout(a,b||0)},te=function(a){var b=null;return(new H(function(c,d){b=se(function(){c(void 0)},a);-1==b&&d(Error("Failed to schedule timer."))})).N(function(a){l.clearTimeout(b);throw a;})};var ue=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#(.*))?$/,ve=function(a,b){if(a)for(var c=a.split("&"),d=0;d<c.length;d++){var e=c[d].indexOf("="),f,g=null;0<=e?(f=c[d].substring(0,e),g=c[d].substring(e+1)):f=c[d];b(f,g?decodeURIComponent(g.replace(/\+/g," ")):"")}};var L=function(a){Wd.call(this);this.headers=new ae;this.bc=a||null;this.ja=!1;this.ac=this.a=null;this.kb=this.cd=this.Kb="";this.xa=this.pc=this.Jb=this.ic=!1;this.Ya=0;this.Xb=null;this.md="";this.Zb=this.re=this.xd=!1};r(L,Wd);var we=L.prototype,xe=re("goog.net.XhrIo");we.L=xe;var ye=/^https?$/i,ze=["POST","PUT"];
L.prototype.send=function(a,b,c,d){if(this.a)throw Error("[goog.net.XhrIo] Object is active with another request="+this.Kb+"; newUri="+a);b=b?b.toUpperCase():"GET";this.Kb=a;this.kb="";this.cd=b;this.ic=!1;this.ja=!0;this.a=this.bc?this.bc.zb():uc.zb();this.ac=this.bc?tc(this.bc):tc(uc);this.a.onreadystatechange=q(this.jd,this);this.re&&"onprogress"in this.a&&(this.a.onprogress=q(function(a){this.hd(a,!0)},this),this.a.upload&&(this.a.upload.onprogress=q(this.hd,this)));try{K(this.L,Ae(this,"Opening Xhr")),
this.pc=!0,this.a.open(b,String(a),!0),this.pc=!1}catch(f){K(this.L,Ae(this,"Error opening Xhr: "+f.message));this.G(5,f);return}a=c||"";var e=this.headers.clone();d&&ge(d,function(a,b){e.set(b,a)});d=Ha(e.ba());c=l.FormData&&a instanceof l.FormData;!Ia(ze,b)||d||c||e.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");e.forEach(function(a,b){this.a.setRequestHeader(b,a)},this);this.md&&(this.a.responseType=this.md);"withCredentials"in this.a&&this.a.withCredentials!==this.xd&&(this.a.withCredentials=
this.xd);try{Be(this),0<this.Ya&&(this.Zb=Ce(this.a),K(this.L,Ae(this,"Will abort after "+this.Ya+"ms if incomplete, xhr2 "+this.Zb)),this.Zb?(this.a.timeout=this.Ya,this.a.ontimeout=q(this.vb,this)):this.Xb=se(this.vb,this.Ya,this)),K(this.L,Ae(this,"Sending request")),this.Jb=!0,this.a.send(a),this.Jb=!1}catch(f){K(this.L,Ae(this,"Send error: "+f.message)),this.G(5,f)}};var Ce=function(a){return y&&z(9)&&ga(a.timeout)&&void 0!==a.ontimeout},Ga=function(a){return"content-type"==a.toLowerCase()};
L.prototype.vb=function(){"undefined"!=typeof aa&&this.a&&(this.kb="Timed out after "+this.Ya+"ms, aborting",K(this.L,Ae(this,this.kb)),this.dispatchEvent("timeout"),this.abort(8))};L.prototype.G=function(a,b){this.ja=!1;this.a&&(this.xa=!0,this.a.abort(),this.xa=!1);this.kb=b;De(this);Ee(this)};var De=function(a){a.ic||(a.ic=!0,a.dispatchEvent("complete"),a.dispatchEvent("error"))};
L.prototype.abort=function(){this.a&&this.ja&&(K(this.L,Ae(this,"Aborting")),this.ja=!1,this.xa=!0,this.a.abort(),this.xa=!1,this.dispatchEvent("complete"),this.dispatchEvent("abort"),Ee(this))};L.prototype.Ka=function(){this.a&&(this.ja&&(this.ja=!1,this.xa=!0,this.a.abort(),this.xa=!1),Ee(this,!0));L.Fc.Ka.call(this)};L.prototype.jd=function(){this.isDisposed()||(this.pc||this.Jb||this.xa?Fe(this):this.pe())};L.prototype.pe=function(){Fe(this)};
var Fe=function(a){if(a.ja&&"undefined"!=typeof aa)if(a.ac[1]&&4==Ge(a)&&2==He(a))K(a.L,Ae(a,"Local request error detected and ignored"));else if(a.Jb&&4==Ge(a))se(a.jd,0,a);else if(a.dispatchEvent("readystatechange"),4==Ge(a)){K(a.L,Ae(a,"Request complete"));a.ja=!1;try{var b=He(a),c;a:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:c=!0;break a;default:c=!1}var d;if(!(d=c)){var e;if(e=0===b){var f=String(a.Kb).match(ue)[1]||null;if(!f&&l.self&&l.self.location)var g=l.self.location.protocol,
f=g.substr(0,g.length-1);e=!ye.test(f?f.toLowerCase():"")}d=e}if(d)a.dispatchEvent("complete"),a.dispatchEvent("success");else{var k;try{k=2<Ge(a)?a.a.statusText:""}catch(p){K(a.L,"Can not get status: "+p.message),k=""}a.kb=k+" ["+He(a)+"]";De(a)}}finally{Ee(a)}}};L.prototype.hd=function(a,b){v("progress"===a.type,"goog.net.EventType.PROGRESS is of the same type as raw XHR progress.");this.dispatchEvent(Ie(a,"progress"));this.dispatchEvent(Ie(a,b?"downloadprogress":"uploadprogress"))};
var Ie=function(a,b){return{type:b,lengthComputable:a.lengthComputable,loaded:a.loaded,total:a.total}},Ee=function(a,b){if(a.a){Be(a);var c=a.a,d=a.ac[0]?ba:null;a.a=null;a.ac=null;b||a.dispatchEvent("ready");try{c.onreadystatechange=d}catch(e){(c=a.L)&&c.log(le,"Problem encountered resetting onreadystatechange: "+e.message,void 0)}}},Be=function(a){a.a&&a.Zb&&(a.a.ontimeout=null);ga(a.Xb)&&(l.clearTimeout(a.Xb),a.Xb=null)},Ge=function(a){return a.a?a.a.readyState:0},He=function(a){try{return 2<Ge(a)?
a.a.status:-1}catch(b){return-1}},Je=function(a){try{return a.a?a.a.responseText:""}catch(b){return K(a.L,"Can not get responseText: "+b.message),""}},Ae=function(a,b){return b+" ["+a.cd+" "+a.Kb+" "+He(a)+"]"};var Ke=function(a,b){this.la=this.Fa=this.qa="";this.Ra=null;this.wa=this.na="";this.I=this.he=!1;var c;if(a instanceof Ke)this.I=void 0!==b?b:a.I,Le(this,a.qa),c=a.Fa,M(this),this.Fa=c,Me(this,a.la),Ne(this,a.Ra),Oe(this,a.na),Pe(this,a.W.clone()),c=a.wa,M(this),this.wa=c;else if(a&&(c=String(a).match(ue))){this.I=!!b;Le(this,c[1]||"",!0);var d=c[2]||"";M(this);this.Fa=Qe(d);Me(this,c[3]||"",!0);Ne(this,c[4]);Oe(this,c[5]||"",!0);Pe(this,c[6]||"",!0);c=c[7]||"";M(this);this.wa=Qe(c)}else this.I=
!!b,this.W=new N(null,0,this.I)};Ke.prototype.toString=function(){var a=[],b=this.qa;b&&a.push(Re(b,Se,!0),":");var c=this.la;if(c||"file"==b)a.push("//"),(b=this.Fa)&&a.push(Re(b,Se,!0),"@"),a.push(encodeURIComponent(String(c)).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.Ra,null!=c&&a.push(":",String(c));if(c=this.na)this.la&&"/"!=c.charAt(0)&&a.push("/"),a.push(Re(c,"/"==c.charAt(0)?Te:Ue,!0));(c=this.W.toString())&&a.push("?",c);(c=this.wa)&&a.push("#",Re(c,Ve));return a.join("")};
Ke.prototype.resolve=function(a){var b=this.clone(),c=!!a.qa;c?Le(b,a.qa):c=!!a.Fa;if(c){var d=a.Fa;M(b);b.Fa=d}else c=!!a.la;c?Me(b,a.la):c=null!=a.Ra;d=a.na;if(c)Ne(b,a.Ra);else if(c=!!a.na){if("/"!=d.charAt(0))if(this.la&&!this.na)d="/"+d;else{var e=b.na.lastIndexOf("/");-1!=e&&(d=b.na.substr(0,e+1)+d)}e=d;if(".."==e||"."==e)d="";else if(u(e,"./")||u(e,"/.")){for(var d=0==e.lastIndexOf("/",0),e=e.split("/"),f=[],g=0;g<e.length;){var k=e[g++];"."==k?d&&g==e.length&&f.push(""):".."==k?((1<f.length||
1==f.length&&""!=f[0])&&f.pop(),d&&g==e.length&&f.push("")):(f.push(k),d=!0)}d=f.join("/")}else d=e}c?Oe(b,d):c=""!==a.W.toString();c?Pe(b,Qe(a.W.toString())):c=!!a.wa;c&&(a=a.wa,M(b),b.wa=a);return b};Ke.prototype.clone=function(){return new Ke(this)};
var Le=function(a,b,c){M(a);a.qa=c?Qe(b,!0):b;a.qa&&(a.qa=a.qa.replace(/:$/,""))},Me=function(a,b,c){M(a);a.la=c?Qe(b,!0):b},Ne=function(a,b){M(a);if(b){b=Number(b);if(isNaN(b)||0>b)throw Error("Bad port number "+b);a.Ra=b}else a.Ra=null},Oe=function(a,b,c){M(a);a.na=c?Qe(b,!0):b},Pe=function(a,b,c){M(a);b instanceof N?(a.W=b,a.W.Cc(a.I)):(c||(b=Re(b,We)),a.W=new N(b,0,a.I))},O=function(a,b,c){M(a);a.W.set(b,c)},M=function(a){if(a.he)throw Error("Tried to modify a read-only Uri");};
Ke.prototype.Cc=function(a){this.I=a;this.W&&this.W.Cc(a);return this};
var Xe=function(a,b){var c=new Ke(null,void 0);Le(c,"https");a&&Me(c,a);b&&Oe(c,b);return c},Qe=function(a,b){return a?b?decodeURI(a.replace(/%25/g,"%2525")):decodeURIComponent(a):""},Re=function(a,b,c){return m(a)?(a=encodeURI(a).replace(b,Ye),c&&(a=a.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),a):null},Ye=function(a){a=a.charCodeAt(0);return"%"+(a>>4&15).toString(16)+(a&15).toString(16)},Se=/[#\/\?@]/g,Ue=/[\#\?:]/g,Te=/[\#\?]/g,We=/[\#\?@]/g,Ve=/#/g,N=function(a,b,c){this.i=this.j=null;this.F=a||null;
this.I=!!c},Ze=function(a){a.j||(a.j=new ae,a.i=0,a.F&&ve(a.F,function(b,c){a.add(decodeURIComponent(b.replace(/\+/g," ")),c)}))},af=function(a){var b=fe(a);if("undefined"==typeof b)throw Error("Keys are undefined");var c=new N(null,0,void 0);a=ee(a);for(var d=0;d<b.length;d++){var e=b[d],f=a[d];ea(f)?$e(c,e,f):c.add(e,f)}return c};h=N.prototype;h.Uc=function(){Ze(this);return this.i};
h.add=function(a,b){Ze(this);this.F=null;a=this.H(a);var c=this.j.get(a);c||this.j.set(a,c=[]);c.push(b);this.i=za(this.i)+1;return this};h.remove=function(a){Ze(this);a=this.H(a);return this.j.cb(a)?(this.F=null,this.i=za(this.i)-this.j.get(a).length,this.j.remove(a)):!1};h.cb=function(a){Ze(this);a=this.H(a);return this.j.cb(a)};h.ba=function(){Ze(this);for(var a=this.j.O(),b=this.j.ba(),c=[],d=0;d<b.length;d++)for(var e=a[d],f=0;f<e.length;f++)c.push(b[d]);return c};
h.O=function(a){Ze(this);var b=[];if(m(a))this.cb(a)&&(b=Ma(b,this.j.get(this.H(a))));else{a=this.j.O();for(var c=0;c<a.length;c++)b=Ma(b,a[c])}return b};h.set=function(a,b){Ze(this);this.F=null;a=this.H(a);this.cb(a)&&(this.i=za(this.i)-this.j.get(a).length);this.j.set(a,[b]);this.i=za(this.i)+1;return this};h.get=function(a,b){var c=a?this.O(a):[];return 0<c.length?String(c[0]):b};var $e=function(a,b,c){a.remove(b);0<c.length&&(a.F=null,a.j.set(a.H(b),Oa(c)),a.i=za(a.i)+c.length)};
N.prototype.toString=function(){if(this.F)return this.F;if(!this.j)return"";for(var a=[],b=this.j.ba(),c=0;c<b.length;c++)for(var d=b[c],e=encodeURIComponent(String(d)),d=this.O(d),f=0;f<d.length;f++){var g=e;""!==d[f]&&(g+="="+encodeURIComponent(String(d[f])));a.push(g)}return this.F=a.join("&")};N.prototype.clone=function(){var a=new N;a.F=this.F;this.j&&(a.j=this.j.clone(),a.i=this.i);return a};N.prototype.H=function(a){a=String(a);this.I&&(a=a.toLowerCase());return a};
N.prototype.Cc=function(a){a&&!this.I&&(Ze(this),this.F=null,this.j.forEach(function(a,c){var d=c.toLowerCase();c!=d&&(this.remove(c),$e(this,d,a))},this));this.I=a};var bf=function(){return l.window&&l.window.location.href||""},cf=function(a,b){var c=[],d;for(d in a)d in b?typeof a[d]!=typeof b[d]?c.push(d):ea(a[d])?Wa(a[d],b[d])||c.push(d):"object"==typeof a[d]&&null!=a[d]&&null!=b[d]?0<cf(a[d],b[d]).length&&c.push(d):a[d]!==b[d]&&c.push(d):c.push(d);for(d in b)d in a||c.push(d);return c},ff=function(){var a;a=df();a="Chrome"!=ef(a)?null:(a=a.match(/\sChrome\/(\d+)/i))&&2==a.length?parseInt(a[1],10):null;return a&&30>a?!1:!y||!pb||9<pb},gf=function(a){(a||l.window).close()},
hf=function(a,b,c){var d=Math.floor(1E9*Math.random()).toString();b=b||500;c=c||600;var e=(window.screen.availHeight-c)/2,f=(window.screen.availWidth-b)/2;b={width:b,height:c,top:0<e?e:0,left:0<f?f:0,location:!0,resizable:!0,statusbar:!0,toolbar:!1};d&&(b.target=d);"Firefox"==ef(df())&&(a=a||"http://localhost",b.scrollbars=!0);var g;c=a||"about:blank";(d=b)||(d={});a=window;b=c instanceof A?c:Cb("undefined"!=typeof c.href?c.href:String(c));c=d.target||c.target;e=[];for(g in d)switch(g){case "width":case "height":case "top":case "left":e.push(g+
"="+d[g]);break;case "target":case "noreferrer":break;default:e.push(g+"="+(d[g]?1:0))}g=e.join(",");(x("iPhone")&&!x("iPod")&&!x("iPad")||x("iPad")||x("iPod"))&&a.navigator&&a.navigator.standalone&&c&&"_self"!=c?(g=a.document.createElement("A"),b=b instanceof A?b:Cb(b),g.href=zb(b),g.setAttribute("target",c),d.noreferrer&&g.setAttribute("rel","noreferrer"),d=document.createEvent("MouseEvent"),d.initMouseEvent("click",!0,!0,a,1),g.dispatchEvent(d),g={}):d.noreferrer?(g=a.open("",c,g),d=zb(b),g&&(eb&&
u(d,";")&&(d="'"+d.replace(/'/g,"%27")+"'"),g.opener=null,a=new wb,a.Wb="b/12014412, meta tag with sanitized URL",ua.test(d)&&(-1!=d.indexOf("&")&&(d=d.replace(oa,"&amp;")),-1!=d.indexOf("<")&&(d=d.replace(pa,"&lt;")),-1!=d.indexOf(">")&&(d=d.replace(qa,"&gt;")),-1!=d.indexOf('"')&&(d=d.replace(ra,"&quot;")),-1!=d.indexOf("'")&&(d=d.replace(sa,"&#39;")),-1!=d.indexOf("\x00")&&(d=d.replace(ta,"&#0;"))),d='<META HTTP-EQUIV="refresh" content="0; url='+d+'">',Aa(xb(a),"must provide justification"),v(!/^[\s\xa0]*$/.test(xb(a)),
"must provide non-empty justification"),g.document.write(Fb((new Eb).ge(d))),g.document.close())):g=a.open(zb(b),c,g);if(g)try{g.focus()}catch(k){}return g},jf=function(a){return new H(function(b){var c=function(){te(2E3).then(function(){if(!a||a.closed)b();else return c()})};return c()})},kf=function(){var a=null;return(new H(function(b){"complete"==l.document.readyState?b():(a=function(){b()},dc(window,"load",a))})).N(function(b){fc(window,"load",a);throw b;})},lf=function(a){switch(a||l.navigator&&
l.navigator.product||""){case "ReactNative":return"ReactNative";default:return"undefined"!==typeof l.process?"Node":"Browser"}},mf=function(){var a=lf();return"ReactNative"===a||"Node"===a},ef=function(a){var b=a.toLowerCase();if(u(b,"opera/")||u(b,"opr/")||u(b,"opios/"))return"Opera";if(u(b,"msie")||u(b,"trident/"))return"IE";if(u(b,"edge/"))return"Edge";if(u(b,"firefox/"))return"Firefox";if(u(b,"silk/"))return"Silk";if(u(b,"safari/")&&!u(b,"chrome/"))return"Safari";if(!u(b,"chrome/")&&!u(b,"crios/")||
u(b,"edge/")){if((a=a.match(/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/))&&2==a.length)return a[1]}else return"Chrome";return"Other"},nf=function(a){var b=lf(void 0);return("Browser"===b?ef(df()):b)+"/JsCore/"+a},df=function(){return l.navigator&&l.navigator.userAgent||""},of=function(a){a=a.split(".");for(var b=l,c=0;c<a.length&&"object"==typeof b&&null!=b;c++)b=b[a[c]];c!=a.length&&(b=void 0);return b},pf=function(){return!(!l.location||!l.location.protocol||"http:"!=l.location.protocol&&"https:"!=l.location.protocol||
mf())},qf=function(){var a=df(),b=a.match(/(ipad)|(iphone)|(ipod)/i),c=a.match(/\sOS\s(\d+)_/i);if(b&&b.length&&c&&2==c.length){if(8>parseInt(c[1],10))return!1}else if("Firefox"==ef(a))return!1;return!0},rf=function(a){return"undefined"===typeof a?null:oc(a)},sf=function(a){if(null!==a){var b;try{b=lc(a)}catch(c){try{b=JSON.parse(a)}catch(d){throw c;}}return b}};var tf;try{var uf={};Object.defineProperty(uf,"abcd",{configurable:!0,enumerable:!0,value:1});Object.defineProperty(uf,"abcd",{configurable:!0,enumerable:!0,value:2});tf=2==uf.abcd}catch(a){tf=!1}
var P=function(a,b,c){tf?Object.defineProperty(a,b,{configurable:!0,enumerable:!0,value:c}):a[b]=c},vf=function(a,b){if(b)for(var c in b)b.hasOwnProperty(c)&&P(a,c,b[c])},wf=function(a){var b={},c;for(c in a)a.hasOwnProperty(c)&&(b[c]=a[c]);return b},xf=function(a,b){if(!b||!b.length)return!0;if(!a)return!1;for(var c=0;c<b.length;c++){var d=a[b[c]];if(void 0===d||null===d||""===d)return!1}return!0};var yf={yd:{qb:985,pb:735,providerId:"facebook.com"},zd:{qb:500,pb:620,providerId:"github.com"},Ad:{qb:515,pb:680,providerId:"google.com"},Ed:{qb:485,pb:705,providerId:"twitter.com"}},zf=function(a){for(var b in yf)if(yf[b].providerId==a)return yf[b];return null};var Q=function(a,b){this.code="auth/"+a;this.message=b||Af[a]||""};r(Q,Error);Q.prototype.C=function(){return{name:this.code,code:this.code,message:this.message}};
var Af={"argument-error":"","app-not-authorized":"This app, identified by the domain where it's hosted, is not authorized to use Firebase Authentication with the provided API key. Review your key configuration in the Google API console.","cors-unsupported":"This browser is not supported.","credential-already-in-use":"This credential is already associated with a different user account.","custom-token-mismatch":"The custom token corresponds to a different audience.","requires-recent-login":"This operation is sensitive and requires recent authentication. Log in again before retrying this request.",
"email-already-in-use":"The email address is already in use by another account.","expired-action-code":"The action code has expired. ","cancelled-popup-request":"This operation has been cancelled due to another conflicting popup being opened.","internal-error":"An internal error has occurred.","invalid-user-token":"The user's credential is no longer valid. The user must sign in again.","invalid-auth-event":"An internal error has occurred.","invalid-custom-token":"The custom token format is incorrect. Please check the documentation.",
"invalid-email":"The email address is badly formatted.","invalid-api-key":"Your API key is invalid, please check you have copied it correctly.","invalid-credential":"The supplied auth credential is malformed or has expired.","invalid-oauth-provider":"EmailAuthProvider is not supported for this operation. This operation only supports OAuth providers.","unauthorized-domain":"This domain is not authorized for OAuth operations for your Firebase project. Edit the list of authorized domains from the Firebase console.",
"invalid-action-code":"The action code is invalid. This can happen if the code is malformed, expired, or has already been used.","wrong-password":"The password is invalid or the user does not have a password.","missing-iframe-start":"An internal error has occurred.","auth-domain-config-required":"Be sure to include authDomain when calling firebase.initializeApp(), by following the instructions in the Firebase console.","app-deleted":"This instance of FirebaseApp has been deleted.","account-exists-with-different-credential":"An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.",
"network-request-failed":"A network error (such as timeout, interrupted connection or unreachable host) has occurred.","no-auth-event":"An internal error has occurred.","no-such-provider":"User was not linked to an account with the given provider.","operation-not-allowed":"The given sign-in provider is disabled for this Firebase project. Enable it in the Firebase console, under the sign-in method tab of the Auth section.","operation-not-supported-in-this-environment":'This operation is not supported in the environment this application is running on. "location.protocol" must be http or https.',
"popup-blocked":"Unable to establish a connection with the popup. It may have been blocked by the browser.","popup-closed-by-user":"The popup has been closed by the user before finalizing the operation.","provider-already-linked":"User can only be linked to one identity for the given provider.",timeout:"The operation has timed out.","user-token-expired":"The user's credential is no longer valid. The user must sign in again.","too-many-requests":"We have blocked all requests from this device due to unusual activity. Try again later.",
"user-not-found":"There is no user record corresponding to this identifier. The user may have been deleted.","user-disabled":"The user account has been disabled by an administrator.","user-mismatch":"The supplied credentials do not correspond to the previously signed in user.","user-signed-out":"","weak-password":"The password must be 6 characters long or more.","web-storage-unsupported":"This browser is not supported."};var Bf=function(a,b,c,d,e){this.sa=a;this.va=b||null;this.$a=c||null;this.Tb=d||null;this.G=e||null;if(this.$a||this.G){if(this.$a&&this.G)throw new Q("invalid-auth-event");if(this.$a&&!this.Tb)throw new Q("invalid-auth-event");}else throw new Q("invalid-auth-event");};Bf.prototype.getError=function(){return this.G};Bf.prototype.C=function(){return{type:this.sa,eventId:this.va,urlResponse:this.$a,sessionId:this.Tb,error:this.G&&this.G.C()}};var Cf=function(a){this.je=a.sub;la();this.Ab=a.email||null};var Df=function(a,b,c,d){var e={};ha(c)?e=c:b&&m(c)&&m(d)?e={oauthToken:c,oauthTokenSecret:d}:!b&&m(c)&&(e={accessToken:c});if(b||!e.idToken&&!e.accessToken)if(b&&e.oauthToken&&e.oauthTokenSecret)P(this,"accessToken",e.oauthToken),P(this,"secret",e.oauthTokenSecret);else{if(b)throw new Q("argument-error","credential failed: expected 2 arguments (the OAuth access token and secret).");throw new Q("argument-error","credential failed: expected 1 argument (the OAuth access token).");}else e.idToken&&P(this,
"idToken",e.idToken),e.accessToken&&P(this,"accessToken",e.accessToken);P(this,"provider",a)};Df.prototype.Eb=function(a){return Ef(a,Ff(this))};Df.prototype.dd=function(a,b){var c=Ff(this);c.idToken=b;return R(a,Gf,c)};var Ff=function(a){var b={};a.idToken&&(b.id_token=a.idToken);a.accessToken&&(b.access_token=a.accessToken);a.secret&&(b.oauth_token_secret=a.secret);b.providerId=a.provider;return{postBody:af(b).toString(),requestUri:pf()?bf():"http://localhost"}};
Df.prototype.C=function(){var a={provider:this.provider};this.idToken&&(a.oauthIdToken=this.idToken);this.accessToken&&(a.oauthAccessToken=this.accessToken);this.secret&&(a.oauthTokenSecret=this.secret);return a};
var Hf=function(a,b){var c=!!b,d=function(){vf(this,{providerId:a,isOAuthProvider:!0});this.Bc=[];"google.com"==a&&this.addScope("profile")};c||(d.prototype.addScope=function(a){Ia(this.Bc,a)||this.Bc.push(a)});d.prototype.Fb=function(){return Oa(this.Bc)};d.credential=function(b,d){return new Df(a,c,b,d)};vf(d,{PROVIDER_ID:a});return d},If=Hf("facebook.com");If.prototype.addScope=If.prototype.addScope||void 0;var Jf=Hf("github.com");Jf.prototype.addScope=Jf.prototype.addScope||void 0;var Kf=Hf("google.com");
Kf.prototype.addScope=Kf.prototype.addScope||void 0;Kf.credential=function(a,b){if(!a&&!b)throw new Q("argument-error","credential failed: must provide the ID token and/or the access token.");return new Df("google.com",!1,ha(a)?a:{idToken:a||null,accessToken:b||null})};var Lf=Hf("twitter.com",!0),Mf=function(a,b){this.Ab=a;this.uc=b;P(this,"provider","password")};Mf.prototype.Eb=function(a){return R(a,Nf,{email:this.Ab,password:this.uc})};
Mf.prototype.dd=function(a,b){return R(a,Of,{idToken:b,email:this.Ab,password:this.uc})};Mf.prototype.C=function(){return{email:this.Ab,password:this.uc}};var Pf=function(){vf(this,{providerId:"password",isOAuthProvider:!1})};vf(Pf,{PROVIDER_ID:"password"});
var Qf={Ge:Pf,yd:If,Ad:Kf,zd:Jf,Ed:Lf},Rf=function(a){var b=a&&a.providerId;if(!b)return null;var c=a&&a.oauthAccessToken,d=a&&a.oauthTokenSecret;a=a&&a.oauthIdToken;for(var e in Qf)if(Qf[e].PROVIDER_ID==b)try{return Qf[e].credential({accessToken:c,idToken:a,oauthToken:c,oauthTokenSecret:d})}catch(f){break}return null};var Sf=function(a,b,c){Q.call(this,"account-exists-with-different-credential",c);P(this,"email",a);P(this,"credential",b)};r(Sf,Q);Sf.prototype.C=function(){var a={code:this.code,message:this.message,email:this.email},b=this.credential&&this.credential.C();b&&(Za(a,b),a.providerId=b.provider,delete a.provider);return a};var Tf=function(a){this.Fe=a};r(Tf,sc);Tf.prototype.zb=function(){return new this.Fe};Tf.prototype.qc=function(){return{}};
var S=function(a,b,c){var d;d="Node"==lf();d=l.XMLHttpRequest||d&&firebase.INTERNAL.node&&firebase.INTERNAL.node.XMLHttpRequest;if(!d)throw new Q("internal-error","The XMLHttpRequest compatibility library was not found.");this.u=a;a=b||{};this.ue=a.secureTokenEndpoint||"https://securetoken.googleapis.com/v1/token";this.ve=a.secureTokenTimeout||1E4;this.pd=Xa(a.secureTokenHeaders||Uf);this.Rd=a.firebaseEndpoint||"https://www.googleapis.com/identitytoolkit/v3/relyingparty/";this.Sd=a.firebaseTimeout||
1E4;this.Tc=Xa(a.firebaseHeaders||Vf);c&&(this.Tc["X-Client-Version"]=c,this.pd["X-Client-Version"]=c);this.Jd=new xc;this.Ee=new Tf(d)},Wf,Uf={"Content-Type":"application/x-www-form-urlencoded"},Vf={"Content-Type":"application/json"},Yf=function(a,b,c,d,e,f,g){ff()?a=q(a.xe,a):(Wf||(Wf=new H(function(a,b){Xf(a,b)})),a=q(a.we,a));a(b,c,d,e,f,g)};
S.prototype.xe=function(a,b,c,d,e,f){var g="Node"==lf(),k=mf()?g?new L(this.Ee):new L:new L(this.Jd),p;f&&(k.Ya=Math.max(0,f),p=setTimeout(function(){k.dispatchEvent("timeout")},f));k.listen("complete",function(){p&&clearTimeout(p);var a=null;try{var c;c=this.a?lc(this.a.responseText):void 0;a=c||null}catch(d){try{a=JSON.parse(Je(this))||null}catch(e){a=null}}b&&b(a)});ec(k,"ready",function(){p&&clearTimeout(p);this.ua||(this.ua=!0,this.Ka())});ec(k,"timeout",function(){p&&clearTimeout(p);this.ua||
(this.ua=!0,this.Ka());b&&b(null)});k.send(a,c,d,e)};var Zf="__fcb"+Math.floor(1E6*Math.random()).toString(),Xf=function(a,b){((window.gapi||{}).client||{}).request?a():(l[Zf]=function(){((window.gapi||{}).client||{}).request?a():b(Error("CORS_UNSUPPORTED"))},Nd(Vd("https://apis.google.com/js/client.js?onload="+Zf),function(){b(Error("CORS_UNSUPPORTED"))}))};
S.prototype.we=function(a,b,c,d,e){var f=this;Wf.then(function(){window.gapi.client.setApiKey(f.u);var g=window.gapi.auth.getToken();window.gapi.auth.setToken(null);window.gapi.client.request({path:a,method:c,body:d,headers:e,authType:"none",callback:function(a){window.gapi.auth.setToken(g);b&&b(a)}})}).N(function(a){b&&b({error:{message:a&&a.message||"CORS_UNSUPPORTED"}})})};
var ag=function(a,b){return new H(function(c,d){"refresh_token"==b.grant_type&&b.refresh_token||"authorization_code"==b.grant_type&&b.code?Yf(a,a.ue+"?key="+encodeURIComponent(a.u),function(a){a?a.error?d($f(a)):a.access_token&&a.refresh_token?c(a):d(new Q("internal-error")):d(new Q("network-request-failed"))},"POST",af(b).toString(),a.pd,a.ve):d(new Q("internal-error"))})},bg=function(a){var b={},c;for(c in a)null!==a[c]&&void 0!==a[c]&&(b[c]=a[c]);return oc(b)},cg=function(a,b,c,d,e){var f=a.Rd+
b+"?key="+encodeURIComponent(a.u);e&&(f+="&cb="+la().toString());return new H(function(b,e){Yf(a,f,function(a){a?a.error?e($f(a)):b(a):e(new Q("network-request-failed"))},c,bg(d),a.Tc,a.Sd)})},dg=function(a){if(!kc.test(a.email))throw new Q("invalid-email");},eg=function(a){"email"in a&&dg(a)},gg=function(a,b){return R(a,fg,{identifier:b,continueUri:pf()?bf():"http://localhost"}).then(function(a){return a.allProviders||[]})},ig=function(a){return R(a,hg,{}).then(function(a){return a.authorizedDomains||
[]})},jg=function(a){if(!a.idToken)throw new Q("internal-error");};S.prototype.signInAnonymously=function(){return R(this,kg,{})};S.prototype.updateEmail=function(a,b){return R(this,lg,{idToken:a,email:b})};S.prototype.updatePassword=function(a,b){return R(this,Of,{idToken:a,password:b})};var mg={displayName:"DISPLAY_NAME",photoUrl:"PHOTO_URL"};
S.prototype.updateProfile=function(a,b){var c={idToken:a},d=[];Qa(mg,function(a,f){var g=b[f];null===g?d.push(a):f in b&&(c[f]=g)});d.length&&(c.deleteAttribute=d);return R(this,lg,c)};S.prototype.sendPasswordResetEmail=function(a){return R(this,ng,{requestType:"PASSWORD_RESET",email:a})};S.prototype.sendEmailVerification=function(a){return R(this,og,{requestType:"VERIFY_EMAIL",idToken:a})};
var qg=function(a,b,c){return R(a,pg,{idToken:b,deleteProvider:c})},rg=function(a){if(!a.requestUri||!a.sessionId&&!a.postBody)throw new Q("internal-error");},sg=function(a){if(a.needConfirmation)throw(a&&a.email?new Sf(a.email,Rf(a),a.message):null)||new Q("account-exists-with-different-credential");if(!a.idToken)throw new Q("internal-error");},Ef=function(a,b){return R(a,tg,b)},ug=function(a){if(!a.oobCode)throw new Q("invalid-action-code");};
S.prototype.confirmPasswordReset=function(a,b){return R(this,vg,{oobCode:a,newPassword:b})};S.prototype.checkActionCode=function(a){return R(this,wg,{oobCode:a})};S.prototype.applyActionCode=function(a){return R(this,xg,{oobCode:a})};
var xg={endpoint:"setAccountInfo",w:ug,Xa:"email"},wg={endpoint:"resetPassword",w:ug,oa:function(a){if(!kc.test(a.email))throw new Q("internal-error");}},yg={endpoint:"signupNewUser",w:function(a){dg(a);if(!a.password)throw new Q("weak-password");},oa:jg,pa:!0},fg={endpoint:"createAuthUri"},zg={endpoint:"deleteAccount",Wa:["idToken"]},pg={endpoint:"setAccountInfo",Wa:["idToken","deleteProvider"],w:function(a){if(!ea(a.deleteProvider))throw new Q("internal-error");}},Ag={endpoint:"getAccountInfo"},
og={endpoint:"getOobConfirmationCode",Wa:["idToken","requestType"],w:function(a){if("VERIFY_EMAIL"!=a.requestType)throw new Q("internal-error");},Xa:"email"},ng={endpoint:"getOobConfirmationCode",Wa:["requestType"],w:function(a){if("PASSWORD_RESET"!=a.requestType)throw new Q("internal-error");dg(a)},Xa:"email"},hg={Id:!0,endpoint:"getProjectConfig",$d:"GET"},vg={endpoint:"resetPassword",w:ug,Xa:"email"},lg={endpoint:"setAccountInfo",Wa:["idToken"],w:eg,pa:!0},Of={endpoint:"setAccountInfo",Wa:["idToken"],
w:function(a){eg(a);if(!a.password)throw new Q("weak-password");},oa:jg,pa:!0},kg={endpoint:"signupNewUser",oa:jg,pa:!0},tg={endpoint:"verifyAssertion",w:rg,oa:sg,pa:!0},Gf={endpoint:"verifyAssertion",w:function(a){rg(a);if(!a.idToken)throw new Q("internal-error");},oa:sg,pa:!0},Bg={endpoint:"verifyCustomToken",w:function(a){if(!a.token)throw new Q("invalid-custom-token");},oa:jg,pa:!0},Nf={endpoint:"verifyPassword",w:function(a){dg(a);if(!a.password)throw new Q("wrong-password");},oa:jg,pa:!0},R=
function(a,b,c){if(!xf(c,b.Wa))return J(new Q("internal-error"));var d=b.$d||"POST",e;return I(c).then(b.w).then(function(){b.pa&&(c.returnSecureToken=!0);return cg(a,b.endpoint,d,c,b.Id||!1)}).then(function(a){return e=a}).then(b.oa).then(function(){if(!b.Xa)return e;if(!(b.Xa in e))throw new Q("internal-error");return e[b.Xa]})},$f=function(a){var b,c;c=(a.error&&a.error.errors&&a.error.errors[0]||{}).reason||"";b={keyInvalid:"invalid-api-key",ipRefererBlocked:"app-not-authorized"};if(c=b[c]?new Q(b[c]):
null)return c;a=a.error&&a.error.message||"";c={INVALID_CUSTOM_TOKEN:"invalid-custom-token",CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_EMAIL:"invalid-email",INVALID_PASSWORD:"wrong-password",USER_DISABLED:"user-disabled",MISSING_PASSWORD:"internal-error",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",
FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",EMAIL_NOT_FOUND:"user-not-found",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",CORS_UNSUPPORTED:"cors-unsupported",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",WEAK_PASSWORD:"weak-password",OPERATION_NOT_ALLOWED:"operation-not-allowed"};
b=(b=a.match(/:\s*(.*)$/))&&1<b.length?b[1]:void 0;for(var d in c)if(0===a.indexOf(d))return new Q(c[d],b);return new Q("internal-error",b)};var Cg=function(a){this.M=a};Cg.prototype.value=function(){return this.M};Cg.prototype.sd=function(a){this.M.style=a;return this};var Dg=function(a){this.M=a||{}};Dg.prototype.value=function(){return this.M};Dg.prototype.sd=function(a){this.M.style=a;return this};var Fg=function(a){this.De=a;this.nc=null;this.oe=Eg(this)},Gg,Hg=function(a){var b=new Dg;b.M.where=document.body;b.M.url=a.De;b.M.messageHandlersFilter=of("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER");b.M.attributes=b.M.attributes||{};(new Cg(b.M.attributes)).sd({position:"absolute",top:"-100px",width:"1px",height:"1px"});b.M.dontclear=!0;return b},Eg=function(a){return Ig().then(function(){return new H(function(b){of("gapi.iframes.getContext")().open(Hg(a).value(),function(c){a.nc=c;a.nc.restyle({setHideOnLeave:!1});
b()})})})},Jg=function(a,b){a.oe.then(function(){a.nc.register("authEvent",b,of("gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER"))})},Kg="__iframefcb"+Math.floor(1E6*Math.random()).toString(),Ig=function(){return Gg?Gg:Gg=new H(function(a,b){var c=function(){of("gapi.load")("gapi.iframes",function(){a()})};of("gapi.iframes.Iframe")?a():of("gapi.load")?c():(l[Kg]=function(){of("gapi.load")?c():b()},Nd(Vd("https://apis.google.com/js/api.js?onload="+Kg),function(){b()}))})};var Mg=function(a,b,c,d){this.S=a;this.u=b;this.ka=c;d=this.ta=d||null;a=Xe(a,"/__/auth/iframe");O(a,"apiKey",b);O(a,"appName",c);d&&O(a,"v",d);this.be=a.toString();this.ce=new Fg(this.be);this.cc=[];Lg(this)},Ng=function(a,b,c,d,e,f,g,k,p){a=Xe(a,"/__/auth/handler");O(a,"apiKey",b);O(a,"appName",c);O(a,"authType",d);O(a,"providerId",e);f&&f.length&&O(a,"scopes",f.join(","));g&&O(a,"redirectUrl",g);k&&O(a,"eventId",k);p&&O(a,"v",p);return a.toString()},Lg=function(a){Jg(a.ce,function(b){var c={};
if(b&&b.authEvent){var d=!1;b=b.authEvent||{};if(b.type){if(c=b.error)var e=(c=b.error)&&(c.name||c.code),c=e?new Q(e.substring(5),c.message):null;b=new Bf(b.type,b.eventId,b.urlResponse,b.sessionId,c)}else b=null;for(c=0;c<a.cc.length;c++)d=a.cc[c](b)||d;c={};c.status=d?"ACK":"ERROR";return I(c)}c.status="ERROR";return I(c)})};var Og=function(a){this.B=a||firebase.INTERNAL.reactNative&&firebase.INTERNAL.reactNative.AsyncStorage;if(!this.B)throw new Q("internal-error","The React Native compatibility library was not found.");};h=Og.prototype;h.get=function(a){return I(this.B.getItem(a)).then(function(a){return a&&sf(a)})};h.set=function(a,b){return I(this.B.setItem(a,rf(b)))};h.remove=function(a){return I(this.B.removeItem(a))};h.Ia=function(){};h.Ua=function(){};var Qg=function(){if(!Pg()){if("Node"==lf())throw new Q("internal-error","The LocalStorage compatibility library was not found.");throw new Q("web-storage-unsupported");}this.B=l.localStorage||firebase.INTERNAL.node.localStorage},Pg=function(){var a="Node"==lf(),a=l.localStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.localStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=Qg.prototype;
h.get=function(a){var b=this;return I().then(function(){var c=b.B.getItem(a);return sf(c)})};h.set=function(a,b){var c=this;return I().then(function(){var d=rf(b);null===d?c.remove(a):c.B.setItem(a,d)})};h.remove=function(a){var b=this;return I().then(function(){b.B.removeItem(a)})};h.Ia=function(a){l.window&&Xb(l.window,"storage",a)};h.Ua=function(a){l.window&&fc(l.window,"storage",a)};var Rg=function(){this.B={}};h=Rg.prototype;h.get=function(){return I(null)};h.set=function(){return I()};h.remove=function(){return I()};h.Ia=function(){};h.Ua=function(){};var Tg=function(){if(!Sg()){if("Node"==lf())throw new Q("internal-error","The SessionStorage compatibility library was not found.");throw new Q("web-storage-unsupported");}this.B=l.sessionStorage||firebase.INTERNAL.node.sessionStorage},Sg=function(){var a="Node"==lf(),a=l.sessionStorage||a&&firebase.INTERNAL.node&&firebase.INTERNAL.node.sessionStorage;if(!a)return!1;try{return a.setItem("__sak","1"),a.removeItem("__sak"),!0}catch(b){return!1}};h=Tg.prototype;
h.get=function(a){var b=this;return I().then(function(){var c=b.B.getItem(a);return sf(c)})};h.set=function(a,b){var c=this;return I().then(function(){var d=rf(b);null===d?c.remove(a):c.B.setItem(a,d)})};h.remove=function(a){var b=this;return I().then(function(){b.B.removeItem(a)})};h.Ia=function(){};h.Ua=function(){};var Xg=function(){this.Qc={Browser:Ug,Node:Vg,ReactNative:Wg}[lf()]},Yg,Ug={v:Qg,Gc:Tg},Vg={v:Qg,Gc:Tg},Wg={v:Og,Gc:Rg};var Zg="First Second Third Fourth Fifth Sixth Seventh Eighth Ninth".split(" "),T=function(a,b){return{name:a||"",Y:"a valid string",optional:!!b,Z:m}},$g=function(a){return{name:a||"",Y:"a valid object",optional:!1,Z:ha}},ah=function(a,b){return{name:a||"",Y:"a function",optional:!!b,Z:n}},bh=function(){return{name:"",Y:"null",optional:!1,Z:da}},ch=function(){return{name:"credential",Y:"a valid credential",optional:!1,Z:function(a){return!(!a||!a.Eb)}}},dh=function(){return{name:"authProvider",Y:"a valid Auth provider",
optional:!1,Z:function(a){return!!(a&&a.providerId&&a.hasOwnProperty&&a.hasOwnProperty("isOAuthProvider"))}}},eh=function(a,b,c,d){return{name:c||"",Y:a.Y+" or "+b.Y,optional:!!d,Z:function(c){return a.Z(c)||b.Z(c)}}};var gh=function(a,b){for(var c in b){var d=b[c].name;a[d]=fh(d,a[c],b[c].b)}},U=function(a,b,c,d){a[b]=fh(b,c,d)},fh=function(a,b,c){if(!c)return b;var d=hh(a);a=function(){var a=Array.prototype.slice.call(arguments),e;a:{e=Array.prototype.slice.call(a);var k;k=0;for(var p=!1,Y=0;Y<c.length;Y++)if(c[Y].optional)p=!0;else{if(p)throw new Q("internal-error","Argument validator encountered a required argument after an optional argument.");k++}p=c.length;if(e.length<k||p<e.length)e="Expected "+(k==p?1==
k?"1 argument":k+" arguments":k+"-"+p+" arguments")+" but got "+e.length+".";else{for(k=0;k<e.length;k++)if(p=c[k].optional&&void 0===e[k],!c[k].Z(e[k])&&!p){e=c[k];if(0>k||k>=Zg.length)throw new Q("internal-error","Argument validator received an unsupported number of arguments.");e=Zg[k]+" argument "+(e.name?'"'+e.name+'" ':"")+"must be "+e.Y+".";break a}e=null}}if(e)throw new Q("argument-error",d+" failed: "+e);return b.apply(this,a)};for(var e in b)a[e]=b[e];for(e in b.prototype)a.prototype[e]=
b.prototype[e];return a},hh=function(a){a=a.split(".");return a[a.length-1]};var kh=function(a,b,c){var d=(this.ta=firebase.SDK_VERSION||null)?nf(this.ta):null;this.c=new S(b,null,d);this.Qa=null;this.S=a;this.u=b;this.ka=c;this.ub=[];this.ad=!1;this.Hd=q(this.Ud,this);this.rb=new ih(this);this.kd=new jh(this);this.Za={};this.Za.unknown=this.rb;this.Za.signInViaRedirect=this.rb;this.Za.linkViaRedirect=this.rb;this.Za.signInViaPopup=this.kd;this.Za.linkViaPopup=this.kd},lh=function(a){var b=bf();return ig(a).then(function(a){a:{for(var d=(b instanceof Ke?b.clone():new Ke(b,
void 0)).la,e=0;e<a.length;e++){var f;var g=a[e];f=d;var k=Pc(g);k?f=(f=Pc(f))?k.Bb(f):!1:(k=g.split(".").join("\\."),f=(new RegExp("^(.+."+k+"|"+k+")$","i")).test(f));if(f){a=!0;break a}}a=!1}if(!a)throw new Q("unauthorized-domain");})},mh=function(a){a.ad=!0;kf().then(function(){a.ae=new Mg(a.S,a.u,a.ka,a.ta);a.ae.cc.push(a.Hd)})};kh.prototype.subscribe=function(a){Ia(this.ub,a)||this.ub.push(a);this.ad||mh(this)};kh.prototype.unsubscribe=function(a){La(this.ub,function(b){return b==a})};
kh.prototype.Ud=function(a){if(!a)throw new Q("invalid-auth-event");for(var b=!1,c=0;c<this.ub.length;c++){var d=this.ub[c];if(d.Mc(a.sa,a.va)){(b=this.Za[a.sa])&&b.ld(a,d);b=!0;break}}a=this.rb;a.yc||(a.yc=!0,nh(a,!1,null,null));return b};kh.prototype.getRedirectResult=function(){return this.rb.getRedirectResult()};
var ph=function(a,b,c,d,e){if(!b)return J(new Q("popup-blocked"));a.Qa||(a.Qa=lh(a.c));return a.Qa.then(function(){oh(d);var f=Ng(a.S,a.u,a.ka,c,d.providerId,d.Fb(),null,e,a.ta);Gb((b||l.window).location,f);return b})},qh=function(a,b,c,d){a.Qa||(a.Qa=lh(a.c));return a.Qa.then(function(){oh(c);var e=Ng(a.S,a.u,a.ka,b,c.providerId,c.Fb(),bf(),d,a.ta);Gb(l.window.location,e)})},rh=function(a,b,c,d){var e=new Q("popup-closed-by-user");return jf(c).then(function(){return te(3E4).then(function(){a.Ea(b,
null,e,d)})})},oh=function(a){if(!a.isOAuthProvider)throw new Q("invalid-oauth-provider");},sh={},th=function(a,b,c){var d=b+":"+c;sh[d]||(sh[d]=new kh(a,b,c));return sh[d]},ih=function(a){this.P=a;this.zc=this.Qb=this.Ta=this.X=null;this.yc=!1};ih.prototype.ld=function(a,b){if(!a)return J(new Q("invalid-auth-event"));this.yc=!0;var c=a.sa,d=a.va;"unknown"==c?(this.X||nh(this,!1,null,null),c=I()):c=a.G?this.wc(a,b):b.eb(c,d)?this.xc(a,b):J(new Q("invalid-auth-event"));return c};
ih.prototype.wc=function(a){this.X||nh(this,!0,null,a.getError());return I()};ih.prototype.xc=function(a,b){var c=this,d=a.sa,e=b.eb(d,a.va),f="signInViaRedirect"==d||"linkViaRedirect"==d;return e(a.$a,a.Tb).then(function(a){c.X||nh(c,f,a,null)}).N(function(a){c.X||nh(c,f,null,a)})};var nh=function(a,b,c,d){b?d?(a.X=function(){return J(d)},a.Qb&&a.Qb(d)):(a.X=function(){return I(c)},a.Ta&&a.Ta(c)):(a.X=function(){return I({user:null})},a.Ta&&a.Ta({user:null}));a.Ta=null;a.Qb=null};
ih.prototype.getRedirectResult=function(){var a=this;this.Kc||(this.Kc=new H(function(b,c){a.X?a.X().then(b,c):(a.Ta=b,a.Qb=c,uh(a))}));return this.Kc};var uh=function(a){var b=new Q("timeout");a.zc&&a.zc.cancel();a.zc=te(3E4).then(function(){a.X||nh(a,!0,null,b)})},jh=function(a){this.P=a};jh.prototype.ld=function(a,b){if(!a)return J(new Q("invalid-auth-event"));var c=a.sa,d=a.va;return a.G?this.wc(a,b):b.eb(c,d)?this.xc(a,b):J(new Q("invalid-auth-event"))};
jh.prototype.wc=function(a,b){b.Ea(a.sa,null,a.getError(),a.va);return I()};jh.prototype.xc=function(a,b){var c=a.va,d=a.sa;return b.eb(d,c)(a.$a,a.Tb).then(function(a){b.Ea(d,a,null,c)}).N(function(a){b.Ea(d,null,a,c)})};var vh=function(a){this.c=a;this.Ha=this.ea=null;this.La=0};vh.prototype.C=function(){return{apiKey:this.c.u,refreshToken:this.ea,accessToken:this.Ha,expirationTime:this.La}};var xh=function(a,b){var c=b.idToken,d=b.refreshToken,e=wh(b.expiresIn);a.Ha=c;a.La=e;a.ea=d},wh=function(a){return la()+1E3*parseInt(a,10)},yh=function(a,b){return ag(a.c,b).then(function(b){a.Ha=b.access_token;a.La=wh(b.expires_in);a.ea=b.refresh_token;return{accessToken:a.Ha,expirationTime:a.La,refreshToken:a.ea}})};
vh.prototype.getToken=function(a){return a||!this.Ha||la()>this.La-3E4?this.ea?yh(this,{grant_type:"refresh_token",refresh_token:this.ea}):I(null):I({accessToken:this.Ha,expirationTime:this.La,refreshToken:this.ea})};var zh=function(a,b,c,d,e){vf(this,{uid:a,displayName:d||null,photoURL:e||null,email:c||null,providerId:b})},Ah=function(a,b){Lb.call(this,a);for(var c in b)this[c]=b[c]};r(Ah,Lb);
var V=function(a,b,c){this.R=[];this.u=a.apiKey;this.ka=a.appName;this.S=a.authDomain||null;a=firebase.SDK_VERSION?nf(firebase.SDK_VERSION):null;this.c=new S(this.u,null,a);this.ra=new vh(this.c);Bh(this,b.idToken);xh(this.ra,b);P(this,"refreshToken",this.ra.ea);Ch(this,c||{});Wd.call(this);this.Nb=!1;this.S&&pf()&&(this.o=th(this.S,this.u,this.ka));this.Ub=[]};r(V,Wd);
var Bh=function(a,b){a.bd=b;P(a,"_lat",b)},Dh=function(a,b){La(a.Ub,function(a){return a==b})},Eh=function(a){for(var b=[],c=0;c<a.Ub.length;c++)b.push(a.Ub[c](a));return sd(b).then(function(){return a})},Fh=function(a){a.o&&!a.Nb&&(a.Nb=!0,a.o.subscribe(a))},Ch=function(a,b){vf(a,{uid:b.uid,displayName:b.displayName||null,photoURL:b.photoURL||null,email:b.email||null,emailVerified:b.emailVerified||!1,isAnonymous:b.isAnonymous||!1,providerData:[]})};P(V.prototype,"providerId","firebase");
var Gh=function(){},Hh=function(a){return I().then(function(){if(a.Md)throw new Q("app-deleted");})},Ih=function(a){return Ea(a.providerData,function(a){return a.providerId})},Kh=function(a,b){b&&(Jh(a,b.providerId),a.providerData.push(b))},Jh=function(a,b){La(a.providerData,function(a){return a.providerId==b})},Lh=function(a,b,c){("uid"!=b||c)&&a.hasOwnProperty(b)&&P(a,b,c)};
V.prototype.copy=function(a){var b=this;b!=a&&(vf(this,{uid:a.uid,displayName:a.displayName,photoURL:a.photoURL,email:a.email,emailVerified:a.emailVerified,isAnonymous:a.isAnonymous,providerData:[]}),w(a.providerData,function(a){Kh(b,a)}),this.ra=a.ra,P(this,"refreshToken",this.ra.ea))};V.prototype.reload=function(){var a=this;return Hh(this).then(function(){return Mh(a).then(function(){return Eh(a)}).then(Gh)})};
var Mh=function(a){return a.getToken().then(function(b){var c=a.isAnonymous;return Nh(a,b).then(function(){c||Lh(a,"isAnonymous",!1);return b}).N(function(b){"auth/user-token-expired"==b.code&&(a.dispatchEvent(new Ah("userDeleted")),Oh(a));throw b;})})};V.prototype.getToken=function(a){var b=this;return Hh(this).then(function(){return b.ra.getToken(a)}).then(function(a){if(!a)throw new Q("internal-error");a.accessToken!=b.bd&&(Bh(b,a.accessToken),b.ma());Lh(b,"refreshToken",a.refreshToken);return a.accessToken})};
var Ph=function(a,b){b.idToken&&a.bd!=b.idToken&&(xh(a.ra,b),a.ma(),Bh(a,b.idToken))};V.prototype.ma=function(){this.dispatchEvent(new Ah("tokenChanged"))};var Nh=function(a,b){return R(a.c,Ag,{idToken:b}).then(q(a.qe,a))};
V.prototype.qe=function(a){a=a.users;if(!a||!a.length)throw new Q("internal-error");a=a[0];Ch(this,{uid:a.localId,displayName:a.displayName,photoURL:a.photoUrl,email:a.email,emailVerified:!!a.emailVerified});for(var b=Qh(a),c=0;c<b.length;c++)Kh(this,b[c]);Lh(this,"isAnonymous",!(this.email&&a.passwordHash)&&!(this.providerData&&this.providerData.length))};
var Qh=function(a){return(a=a.providerUserInfo)&&a.length?Ea(a,function(a){return new zh(a.rawId,a.providerId,a.email,a.displayName,a.photoUrl)}):[]};V.prototype.reauthenticate=function(a){var b=this;return this.f(a.Eb(this.c).then(function(a){var d;a:{var e=a.idToken.split(".");if(3==e.length){for(var e=e[1],f=(4-e.length%4)%4,g=0;g<f;g++)e+=".";try{var k=lc(tb(e));if(k.sub&&k.iss&&k.aud&&k.exp){d=new Cf(k);break a}}catch(p){}}d=null}if(!d||b.uid!=d.je)throw new Q("user-mismatch");Ph(b,a);return b.reload()}))};
var Rh=function(a,b){return Mh(a).then(function(){if(Ia(Ih(a),b))return Eh(a).then(function(){throw new Q("provider-already-linked");})})};h=V.prototype;h.link=function(a){var b=this;return this.f(Rh(this,a.provider).then(function(){return b.getToken()}).then(function(c){return a.dd(b.c,c)}).then(q(this.Sc,this)))};h.Sc=function(a){Ph(this,a);var b=this;return this.reload().then(function(){return b})};
h.updateEmail=function(a){var b=this;return this.f(this.getToken().then(function(c){return b.c.updateEmail(c,a)}).then(function(a){Ph(b,a);return b.reload()}))};h.updatePassword=function(a){var b=this;return this.f(this.getToken().then(function(c){return b.c.updatePassword(c,a)}).then(function(a){Ph(b,a);return b.reload()}))};
h.updateProfile=function(a){if(void 0===a.displayName&&void 0===a.photoURL)return Hh(this);var b=this;return this.f(this.getToken().then(function(c){return b.c.updateProfile(c,{displayName:a.displayName,photoUrl:a.photoURL})}).then(function(a){Ph(b,a);Lh(b,"displayName",a.displayName||null);Lh(b,"photoURL",a.photoUrl||null);return Eh(b)}).then(Gh))};
h.unlink=function(a){var b=this;return this.f(Mh(this).then(function(c){return Ia(Ih(b),a)?qg(b.c,c,[a]).then(function(a){var c={};w(a.providerUserInfo||[],function(a){c[a.providerId]=!0});w(Ih(b),function(a){c[a]||Jh(b,a)});return Eh(b)}):Eh(b).then(function(){throw new Q("no-such-provider");})}))};h["delete"]=function(){var a=this;return this.f(this.getToken().then(function(b){return R(a.c,zg,{idToken:b})}).then(function(){a.dispatchEvent(new Ah("userDeleted"))})).then(function(){Oh(a)})};
h.Mc=function(a,b){return"linkViaPopup"==a&&(this.ca||null)==b&&this.V||"linkViaRedirect"==a&&(this.Pb||null)==b?!0:!1};h.Ea=function(a,b,c,d){"linkViaPopup"==a&&d==(this.ca||null)&&(c&&this.Aa?this.Aa(c):b&&!c&&this.V&&this.V(b),this.Ba&&(this.Ba.cancel(),this.Ba=null),delete this.V,delete this.Aa)};h.eb=function(a,b){return"linkViaPopup"==a&&b==(this.ca||null)||"linkViaRedirect"==a&&(this.Pb||null)==b?q(this.Pd,this):null};h.Db=function(){return this.uid+":::"+Math.floor(1E9*Math.random()).toString()};
h.linkWithPopup=function(a){if(!pf())return J(new Q("operation-not-supported-in-this-environment"));var b=this,c=zf(a.providerId),d=this.Db(),e=null;!qf()&&this.S&&a.isOAuthProvider&&(e=Ng(this.S,this.u,this.ka,"linkViaPopup",a.providerId,a.Fb(),null,d,firebase.SDK_VERSION||null));var f=hf(e,c&&c.qb,c&&c.pb),c=Rh(this,a.providerId).then(function(){return Eh(b)}).then(function(){b.Na();return b.getToken()}).then(function(){if(!e)return ph(b.o,f,"linkViaPopup",a,d)}).then(function(){return new H(function(a,
c){b.Ea("linkViaPopup",null,new Q("cancelled-popup-request"),b.ca||null);b.V=a;b.Aa=c;b.ca=d;b.Ba=rh(b,"linkViaPopup",f,d)})}).then(function(a){f&&gf(f);return a}).N(function(a){f&&gf(f);throw a;});return this.f(c)};
h.linkWithRedirect=function(a){if(!pf())return J(new Q("operation-not-supported-in-this-environment"));var b=this,c=null,d=this.Db(),e=Rh(this,a.providerId).then(function(){b.Na();return b.getToken()}).then(function(){b.Pb=d;return Eh(b)}).then(function(a){b.Ca&&(a=b.Ca,a=a.P.set(Sh,b.C(),a.$));return a}).then(function(){return qh(b.o,"linkViaRedirect",a,d)}).N(function(a){c=a;if(b.Ca)return Th(b.Ca);throw c;}).then(function(){if(c)throw c;});return this.f(e)};
h.Na=function(){if(this.o&&this.Nb)return this.o;if(this.o&&!this.Nb)throw new Q("internal-error");throw new Q("auth-domain-config-required");};h.Pd=function(a,b){var c=this,d=null,e=this.getToken().then(function(d){return R(c.c,Gf,{requestUri:a,sessionId:b,idToken:d})}).then(function(a){d=Rf(a);return c.Sc(a)}).then(function(a){return{user:a,credential:d}});return this.f(e)};
h.sendEmailVerification=function(){var a=this;return this.f(this.getToken().then(function(b){return a.c.sendEmailVerification(b)}).then(function(b){if(a.email!=b)return a.reload()}).then(function(){}))};var Oh=function(a){for(var b=0;b<a.R.length;b++)a.R[b].cancel("app-deleted");a.R=[];a.Md=!0;P(a,"refreshToken",null);a.o&&a.o.unsubscribe(a)};V.prototype.f=function(a){var b=this;this.R.push(a);vd(a,function(){Ka(b.R,a)});return a};V.prototype.toJSON=function(){return this.C()};
V.prototype.C=function(){var a={uid:this.uid,displayName:this.displayName,photoURL:this.photoURL,email:this.email,emailVerified:this.emailVerified,isAnonymous:this.isAnonymous,providerData:[],apiKey:this.u,appName:this.ka,authDomain:this.S,stsTokenManager:this.ra.C(),redirectEventId:this.Pb||null};w(this.providerData,function(b){a.providerData.push(wf(b))});return a};
var Uh=function(a){if(!a.apiKey)return null;var b={apiKey:a.apiKey,authDomain:a.authDomain,appName:a.appName},c={};if(a.stsTokenManager&&a.stsTokenManager.accessToken&&a.stsTokenManager.refreshToken&&a.stsTokenManager.expirationTime)c.idToken=a.stsTokenManager.accessToken,c.refreshToken=a.stsTokenManager.refreshToken,c.expiresIn=(a.stsTokenManager.expirationTime-la())/1E3;else return null;var d=new V(b,c,a);a.providerData&&w(a.providerData,function(a){if(a){var b={};vf(b,a);Kh(d,b)}});a.redirectEventId&&
(d.Pb=a.redirectEventId);return d},Vh=function(a,b,c){var d=new V(a,b);c&&(d.Ca=c);return d.reload().then(function(){return d})};var Wh,Xh=function(a,b,c,d,e,f){this.Ld=a;this.sc=b;this.gc=c;this.wd=d;this.ha=e;this.K={};this.tb=[];this.nb=0;this.de=f||l.indexedDB},Yh=function(a){return new H(function(b,c){var d=a.de.open(a.Ld,a.ha);d.onerror=function(a){c(Error(a.target.errorCode))};d.onupgradeneeded=function(b){b=b.target.result;try{b.createObjectStore(a.sc,{keyPath:a.gc})}catch(d){c(d)}};d.onsuccess=function(a){b(a.target.result)}})},Zh=function(a){a.$c||(a.$c=Yh(a));return a.$c},$h=function(a,b){return b.objectStore(a.sc)},
ai=function(a,b,c){return b.transaction([a.sc],c?"readwrite":"readonly")},bi=function(a){return new H(function(b,c){a.onsuccess=function(a){a&&a.target?b(a.target.result):b()};a.onerror=function(a){c(Error(a.target.errorCode))}})};h=Xh.prototype;
h.set=function(a,b){var c=!1,d,e=this;return vd(Zh(this).then(function(b){d=b;b=$h(e,ai(e,d,!0));return bi(b.get(a))}).then(function(f){var g=$h(e,ai(e,d,!0));if(f)return f.value=b,bi(g.put(f));e.nb++;c=!0;f={};f[e.gc]=a;f[e.wd]=b;return bi(g.add(f))}).then(function(){e.K[a]=b}),function(){c&&e.nb--})};h.get=function(a){var b=this;return Zh(this).then(function(c){return bi($h(b,ai(b,c,!1)).get(a))})};
h.remove=function(a){var b=!1,c=this;return vd(Zh(this).then(function(d){b=!0;c.nb++;return bi($h(c,ai(c,d,!0))["delete"](a))}).then(function(){delete c.K[a]}),function(){b&&c.nb--})};
h.ze=function(){var a=this;return Zh(this).then(function(b){var c=$h(a,ai(a,b,!1));return c.getAll?bi(c.getAll()):new H(function(a,b){var f=[],g=c.openCursor();g.onsuccess=function(b){(b=b.target.result)?(f.push(b.value),b["continue"]()):a(f)};g.onerror=function(a){b(Error(a.target.errorCode))}})}).then(function(b){var c={},d=[];if(0==a.nb){for(d=0;d<b.length;d++)c[b[d][a.gc]]=b[d][a.wd];d=cf(a.K,c);a.K=c}return d})};h.Ia=function(a){0==this.tb.length&&this.Ec();this.tb.push(a)};
h.Ua=function(a){La(this.tb,function(b){return b==a});0==this.tb.length&&this.Vb()};h.Ec=function(){var a=this;this.Vb();var b=function(){a.vc=te(1E3).then(q(a.ze,a)).then(function(b){0<b.length&&w(a.tb,function(a){a(b)})}).then(b).N(function(a){"STOP_EVENT"!=a.message&&b()});return a.vc};b()};h.Vb=function(){this.vc&&this.vc.cancel("STOP_EVENT")};var ci=function(a,b,c,d,e,f){this.me=a;this.qd=b;this.mb=d;this.te=e;this.sb=f;this.J={};Yg||(Yg=new Xg);a=Yg;this.ob=new a.Qc.v;this.Hc=new a.Qc.Gc;this.hb=c;this.ed=q(this.fd,this);this.Zc=q(this.ee,this);this.K={}},di,ei=function(){di||(Wh||(Wh=new Xh("firebaseLocalStorageDb","firebaseLocalStorage","fbase_key","value",1)),di=new ci("firebase",":",Wh,y&&!!pb&&11==pb||/Edge\/\d+/.test($a),"Safari"==ef(df())&&l.window&&l.window!=l.window.top?!0:!1,qf()));return di};h=ci.prototype;
h.H=function(a,b){return this.me+this.qd+a.name+(b?this.qd+b:"")};h.get=function(a,b){var c=this.H(a,b);return this.mb&&a.v?this.hb.get(c).then(function(a){return a&&a.value}):(a.v?this.ob:this.Hc).get(c)};h.remove=function(a,b){var c=this.H(a,b);if(this.mb&&a.v)return this.hb.remove(c);a.v&&!this.sb&&(this.K[c]=null);return(a.v?this.ob:this.Hc).remove(c)};
h.set=function(a,b,c){var d=this.H(a,c);if(this.mb&&a.v)return this.hb.set(d,b);var e=this,f=a.v?this.ob:this.Hc;return f.set(d,b).then(function(){return f.get(d)}).then(function(b){a.v&&!this.sb&&(e.K[d]=b)})};h.addListener=function(a,b,c){a=this.H(a,b);this.sb||(this.K[a]=l.localStorage.getItem(a));Va(this.J)&&this.Ec();this.J[a]||(this.J[a]=[]);this.J[a].push(c)};
h.removeListener=function(a,b,c){a=this.H(a,b);this.J[a]&&(La(this.J[a],function(a){return a==c}),0==this.J[a].length&&delete this.J[a]);Va(this.J)&&this.Vb()};h.Ec=function(){this.mb?this.hb.Ia(this.Zc):(this.ob.Ia(this.ed),this.sb||fi(this))};
var fi=function(a){gi(a);a.rc=setInterval(function(){for(var b in a.J){var c=l.localStorage.getItem(b);c!=a.K[b]&&(a.K[b]=c,c=new Mb({type:"storage",key:b,target:window,oldValue:a.K[b],newValue:c}),a.fd(c))}},2E3)},gi=function(a){a.rc&&(clearInterval(a.rc),a.rc=null)};ci.prototype.Vb=function(){this.mb?this.hb.Ua(this.Zc):(this.ob.Ua(this.ed),this.sb||gi(this))};
ci.prototype.fd=function(a){var b=a.Cb.key;if(this.te){var c=l.localStorage.getItem(b);a=a.Cb.newValue;a!=c&&(a?l.localStorage.setItem(b,a):a||l.localStorage.removeItem(b))}this.K[b]=l.localStorage.getItem(b);this.Lc(b)};ci.prototype.ee=function(a){w(a,q(this.Lc,this))};ci.prototype.Lc=function(a){this.J[a]&&w(this.J[a],function(a){a()})};var hi=function(a){this.$=a;this.P=ei()},Sh={name:"redirectUser",v:!1},Th=function(a){return a.P.remove(Sh,a.$)},ii=function(a,b){return a.P.get(Sh,a.$).then(function(a){a&&b&&(a.authDomain=b);return Uh(a||{})})};var ji=function(a){this.$=a;this.P=ei()},ki={name:"authUser",v:!0},li=function(a){return a.P.remove(ki,a.$)},mi=function(a,b){return a.P.get(ki,a.$).then(function(a){a&&b&&(a.authDomain=b);return Uh(a||{})})};var X=function(a){this.hc=!1;P(this,"app",a);if(W(this).options&&W(this).options.apiKey)a=firebase.SDK_VERSION?nf(firebase.SDK_VERSION):null,this.c=new S(W(this).options&&W(this).options.apiKey,null,a);else throw new Q("invalid-api-key");this.R=[];this.bb=[];this.ne=firebase.INTERNAL.createSubscribe(q(this.fe,this));ni(this,null);this.Da=this.ga=null;try{this.ga=new ji(W(this).options.apiKey+":"+W(this).name),this.Da=new hi(W(this).options.apiKey+":"+W(this).name),this.D=this.f(oi(this))}catch(b){this.D=
J(b)}this.jb=!1;this.Vc=q(this.ye,this);this.ud=q(this.Oa,this);this.vd=q(this.Zd,this);this.td=q(this.Yd,this);pi(this);this.INTERNAL={};this.INTERNAL["delete"]=q(this["delete"],this)};X.prototype.toJSON=function(){return{apiKey:W(this).options.apiKey,authDomain:W(this).options.authDomain,appName:W(this).name,currentUser:Z(this)&&Z(this).C()}};X.prototype.Na=function(){return this.Nd||J(new Q("auth-domain-config-required"))};
var pi=function(a){var b=W(a).options.authDomain,c=W(a).options.apiKey;b&&pf()&&(a.Nd=a.D.then(function(){a.o=th(b,c,W(a).name);a.o.subscribe(a);Z(a)&&Fh(Z(a));a.Ac&&(Fh(a.Ac),a.Ac=null);return a.o}))};h=X.prototype;h.Mc=function(a,b){switch(a){case "unknown":case "signInViaRedirect":return!0;case "signInViaPopup":return this.ca==b&&!!this.V;default:return!1}};
h.Ea=function(a,b,c,d){"signInViaPopup"==a&&this.ca==d&&(c&&this.Aa?this.Aa(c):b&&!c&&this.V&&this.V(b),this.Ba&&(this.Ba.cancel(),this.Ba=null),delete this.V,delete this.Aa)};h.eb=function(a,b){return"signInViaRedirect"==a||"signInViaPopup"==a&&this.ca==b&&this.V?q(this.Qd,this):null};
h.Qd=function(a,b){var c=this,d=null,e=Ef(c.c,{requestUri:a,sessionId:b}).then(function(a){d=Rf(a);return a}),f=c.D.then(function(){return e}).then(function(a){return qi(c,a)}).then(function(){return{user:Z(c),credential:d}});return this.f(f)};h.Db=function(){return Math.floor(1E9*Math.random()).toString()};
h.signInWithPopup=function(a){if(!pf())return J(new Q("operation-not-supported-in-this-environment"));var b=this,c=zf(a.providerId),d=this.Db(),e=null;!qf()&&W(this).options.authDomain&&a.isOAuthProvider&&(e=Ng(W(this).options.authDomain,W(this).options.apiKey,W(this).name,"signInViaPopup",a.providerId,a.Fb(),null,d,firebase.SDK_VERSION||null));var f=hf(e,c&&c.qb,c&&c.pb),c=this.Na().then(function(b){if(!e)return ph(b,f,"signInViaPopup",a,d)}).then(function(){return new H(function(a,c){b.Ea("signInViaPopup",
null,new Q("cancelled-popup-request"),b.ca);b.V=a;b.Aa=c;b.ca=d;b.Ba=rh(b,"signInViaPopup",f,d)})}).then(function(a){f&&gf(f);return a}).N(function(a){f&&gf(f);throw a;});return this.f(c)};h.signInWithRedirect=function(a){if(!pf())return J(new Q("operation-not-supported-in-this-environment"));var b=this,c=this.Na().then(function(){return qh(b.o,"signInViaRedirect",a)});return this.f(c)};
h.getRedirectResult=function(){if(!pf())return J(new Q("operation-not-supported-in-this-environment"));var a=this,b=this.Na().then(function(){return a.o.getRedirectResult()});return this.f(b)};
var qi=function(a,b){var c={};c.apiKey=W(a).options.apiKey;c.authDomain=W(a).options.authDomain;c.appName=W(a).name;return a.D.then(function(){return Vh(c,b,a.Da)}).then(function(b){if(Z(a)&&b.uid==Z(a).uid)return Z(a).copy(b),a.Oa(b);ni(a,b);Fh(b);return a.Oa(b)}).then(function(){a.ma()})},ni=function(a,b){Z(a)&&(Dh(Z(a),a.ud),fc(Z(a),"tokenChanged",a.vd),fc(Z(a),"userDeleted",a.td));b&&(b.Ub.push(a.ud),Xb(b,"tokenChanged",a.vd),Xb(b,"userDeleted",a.td));P(a,"currentUser",b)};
X.prototype.signOut=function(){var a=this,b=this.D.then(function(){if(!Z(a))return I();ni(a,null);return li(a.ga).then(function(){a.ma()})});return this.f(b)};
var ri=function(a){var b=ii(a.Da,W(a).options.authDomain).then(function(b){if(a.Ac=b)b.Ca=a.Da;return Th(a.Da)});return a.f(b)},oi=function(a){var b=W(a).options.authDomain,c=vd(ri(a).then(function(){return mi(a.ga,b)}).then(function(b){return b?(b.Ca=a.Da,b.reload().then(function(){return b}).N(function(c){return"auth/network-request-failed"==c.code?b:li(a.ga)})):null}).then(function(b){ni(a,b||null);a.jb=!0;a.ma()}),function(){if(!a.hc){a.jb=!0;var b=a.ga;b.P.addListener(ki,b.$,a.Vc)}});return a.f(c)};
X.prototype.ye=function(){var a=this;return mi(this.ga,W(this).options.authDomain).then(function(b){if(!a.hc){var c;if(c=Z(a)&&b){c=Z(a).uid;var d=b.uid;c=void 0===c||null===c||""===c||void 0===d||null===d||""===d?!1:c==d}if(c)return Z(a).copy(b),Z(a).getToken();ni(a,b);b&&(Fh(b),b.Ca=a.Da);a.o.subscribe(a);a.ma()}})};X.prototype.Oa=function(a){var b=this.ga;return b.P.set(ki,a.C(),b.$)};X.prototype.Zd=function(){this.jb=!0;this.ma();this.Oa(Z(this))};X.prototype.Yd=function(){this.signOut()};
var si=function(a,b){return a.f(b.then(function(b){return qi(a,b)}).then(function(){return Z(a)}))};h=X.prototype;h.fe=function(a){var b=this;this.addAuthTokenListener(function(){a.next(Z(b))})};h.onAuthStateChanged=function(a,b,c){var d=this;this.jb&&firebase.Promise.resolve().then(function(){n(a)?a(Z(d)):n(a.next)&&a.next(Z(d))});return this.ne(a,b,c)};h.getToken=function(a){var b=this,c=this.D.then(function(){return Z(b)?Z(b).getToken(a).then(function(a){return{accessToken:a}}):null});return this.f(c)};
h.signInWithCustomToken=function(a){var b=this;return this.D.then(function(){return si(b,R(b.c,Bg,{token:a}))}).then(function(a){Lh(a,"isAnonymous",!1);return b.Oa(a)}).then(function(){return Z(b)})};h.signInWithEmailAndPassword=function(a,b){var c=this;return this.D.then(function(){return si(c,R(c.c,Nf,{email:a,password:b}))})};h.createUserWithEmailAndPassword=function(a,b){var c=this;return this.D.then(function(){return si(c,R(c.c,yg,{email:a,password:b}))})};
h.signInWithCredential=function(a){var b=this;return this.D.then(function(){return si(b,a.Eb(b.c))})};h.signInAnonymously=function(){var a=Z(this),b=this;return a&&a.isAnonymous?I(a):this.D.then(function(){return si(b,b.c.signInAnonymously())}).then(function(a){Lh(a,"isAnonymous",!0);return b.Oa(a)}).then(function(){return Z(b)})};var W=function(a){return a.app},Z=function(a){return a.currentUser};h=X.prototype;
h.ma=function(){for(var a=0;a<this.bb.length;a++)if(this.bb[a])this.bb[a](Z(this)&&Z(this)._lat||null)};h.addAuthTokenListener=function(a){this.bb.push(a);var b=this;this.jb&&this.D.then(function(){a(Z(b)&&Z(b)._lat||null)})};h.removeAuthTokenListener=function(a){La(this.bb,function(b){return b==a})};h["delete"]=function(){this.hc=!0;for(var a=0;a<this.R.length;a++)this.R[a].cancel("app-deleted");this.R=[];this.ga&&(a=this.ga,a.P.removeListener(ki,a.$,this.Vc));this.o&&this.o.unsubscribe(this)};
h.f=function(a){var b=this;this.R.push(a);vd(a,function(){Ka(b.R,a)});return a};h.fetchProvidersForEmail=function(a){return this.f(gg(this.c,a))};h.verifyPasswordResetCode=function(a){return this.checkActionCode(a).then(function(a){return a.data.email})};h.confirmPasswordReset=function(a,b){return this.f(this.c.confirmPasswordReset(a,b).then(function(){}))};h.checkActionCode=function(a){return this.f(this.c.checkActionCode(a).then(function(a){return{data:{email:a.email}}}))};h.applyActionCode=function(a){return this.f(this.c.applyActionCode(a).then(function(){}))};
h.sendPasswordResetEmail=function(a){return this.f(this.c.sendPasswordResetEmail(a).then(function(){}))};gh(X.prototype,{applyActionCode:{name:"applyActionCode",b:[T("code")]},checkActionCode:{name:"checkActionCode",b:[T("code")]},confirmPasswordReset:{name:"confirmPasswordReset",b:[T("code"),T("newPassword")]},createUserWithEmailAndPassword:{name:"createUserWithEmailAndPassword",b:[T("email"),T("password")]},fetchProvidersForEmail:{name:"fetchProvidersForEmail",b:[T("email")]},getRedirectResult:{name:"getRedirectResult",b:[]},onAuthStateChanged:{name:"onAuthStateChanged",b:[eh($g(),ah(),"nextOrObserver"),
ah("opt_error",!0),ah("opt_completed",!0)]},sendPasswordResetEmail:{name:"sendPasswordResetEmail",b:[T("email")]},signInAnonymously:{name:"signInAnonymously",b:[]},signInWithCredential:{name:"signInWithCredential",b:[ch()]},signInWithCustomToken:{name:"signInWithCustomToken",b:[T("token")]},signInWithEmailAndPassword:{name:"signInWithEmailAndPassword",b:[T("email"),T("password")]},signInWithPopup:{name:"signInWithPopup",b:[dh()]},signInWithRedirect:{name:"signInWithRedirect",b:[dh()]},signOut:{name:"signOut",
b:[]},toJSON:{name:"toJSON",b:[T(null,!0)]},verifyPasswordResetCode:{name:"verifyPasswordResetCode",b:[T("code")]}});
gh(V.prototype,{"delete":{name:"delete",b:[]},getToken:{name:"getToken",b:[{name:"opt_forceRefresh",Y:"a boolean",optional:!0,Z:function(a){return"boolean"==typeof a}}]},link:{name:"link",b:[ch()]},linkWithPopup:{name:"linkWithPopup",b:[dh()]},linkWithRedirect:{name:"linkWithRedirect",b:[dh()]},reauthenticate:{name:"reauthenticate",b:[ch()]},reload:{name:"reload",b:[]},sendEmailVerification:{name:"sendEmailVerification",b:[]},toJSON:{name:"toJSON",b:[T(null,!0)]},unlink:{name:"unlink",b:[T("provider")]},
updateEmail:{name:"updateEmail",b:[T("email")]},updatePassword:{name:"updatePassword",b:[T("password")]},updateProfile:{name:"updateProfile",b:[$g("profile")]}});gh(H.prototype,{N:{name:"catch"},then:{name:"then"}});U(Pf,"credential",function(a,b){return new Mf(a,b)},[T("email"),T("password")]);gh(If.prototype,{addScope:{name:"addScope",b:[T("scope")]}});U(If,"credential",If.credential,[eh(T(),$g(),"token")]);gh(Jf.prototype,{addScope:{name:"addScope",b:[T("scope")]}});
U(Jf,"credential",Jf.credential,[eh(T(),$g(),"token")]);gh(Kf.prototype,{addScope:{name:"addScope",b:[T("scope")]}});U(Kf,"credential",Kf.credential,[eh(T(),eh($g(),bh()),"idToken"),eh(T(),bh(),"accessToken",!0)]);U(Lf,"credential",Lf.credential,[eh(T(),$g(),"token"),T("secret",!0)]);
(function(){if("undefined"!==typeof firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerService){var a={Auth:X,Error:Q};U(a,"EmailAuthProvider",Pf,[]);U(a,"FacebookAuthProvider",If,[]);U(a,"GithubAuthProvider",Jf,[]);U(a,"GoogleAuthProvider",Kf,[]);U(a,"TwitterAuthProvider",Lf,[]);firebase.INTERNAL.registerService("auth",function(a,c){var d=new X(a);c({INTERNAL:{getToken:q(d.getToken,d),addAuthTokenListener:q(d.addAuthTokenListener,d),removeAuthTokenListener:q(d.removeAuthTokenListener,d)}});return d},
a);firebase.INTERNAL.registerAppHook(function(a,c){"create"===a&&c.auth()});firebase.INTERNAL.extendNamespace({User:V})}else throw Error("Cannot find the firebase namespace; be sure to include firebase-app.js before this library.");})();})();
(function() {var g,n=this;function p(a){return void 0!==a}function aa(){}function ba(a){a.Wb=function(){return a.af?a.af:a.af=new a}}
function ca(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";
else if("function"==b&&"undefined"==typeof a.call)return"object";return b}function da(a){return"array"==ca(a)}function ea(a){var b=ca(a);return"array"==b||"object"==b&&"number"==typeof a.length}function q(a){return"string"==typeof a}function fa(a){return"number"==typeof a}function ga(a){return"function"==ca(a)}function ha(a){var b=typeof a;return"object"==b&&null!=a||"function"==b}function ia(a,b,c){return a.call.apply(a.bind,arguments)}
function ja(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}}function r(a,b,c){r=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ia:ja;return r.apply(null,arguments)}
function ka(a,b){function c(){}c.prototype=b.prototype;a.Fg=b.prototype;a.prototype=new c;a.prototype.constructor=a;a.Cg=function(a,c,f){for(var h=Array(arguments.length-2),k=2;k<arguments.length;k++)h[k-2]=arguments[k];return b.prototype[c].apply(a,h)}};function t(a,b){for(var c in a)b.call(void 0,a[c],c,a)}function la(a,b){var c={},d;for(d in a)c[d]=b.call(void 0,a[d],d,a);return c}function ma(a,b){for(var c in a)if(!b.call(void 0,a[c],c,a))return!1;return!0}function na(a){var b=0,c;for(c in a)b++;return b}function oa(a){for(var b in a)return b}function pa(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b}function qa(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b}function ra(a,b){for(var c in a)if(a[c]==b)return!0;return!1}
function sa(a,b,c){for(var d in a)if(b.call(c,a[d],d,a))return d}function ta(a,b){var c=sa(a,b,void 0);return c&&a[c]}function ua(a){for(var b in a)return!1;return!0}function va(a){var b={},c;for(c in a)b[c]=a[c];return b};function wa(a){a=String(a);if(/^\s*$/.test(a)?0:/^[\],:{}\s\u2028\u2029]*$/.test(a.replace(/\\["\\\/bfnrtu]/g,"@").replace(/"[^"\\\n\r\u2028\u2029\x00-\x08\x0a-\x1f]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:[\s\u2028\u2029]*\[)+/g,"")))try{return eval("("+a+")")}catch(b){}throw Error("Invalid JSON string: "+a);}function xa(){this.Fd=void 0}
function ya(a,b,c){switch(typeof b){case "string":za(b,c);break;case "number":c.push(isFinite(b)&&!isNaN(b)?b:"null");break;case "boolean":c.push(b);break;case "undefined":c.push("null");break;case "object":if(null==b){c.push("null");break}if(da(b)){var d=b.length;c.push("[");for(var e="",f=0;f<d;f++)c.push(e),e=b[f],ya(a,a.Fd?a.Fd.call(b,String(f),e):e,c),e=",";c.push("]");break}c.push("{");d="";for(f in b)Object.prototype.hasOwnProperty.call(b,f)&&(e=b[f],"function"!=typeof e&&(c.push(d),za(f,c),
c.push(":"),ya(a,a.Fd?a.Fd.call(b,f,e):e,c),d=","));c.push("}");break;case "function":break;default:throw Error("Unknown type: "+typeof b);}}var Aa={'"':'\\"',"\\":"\\\\","/":"\\/","\b":"\\b","\f":"\\f","\n":"\\n","\r":"\\r","\t":"\\t","\x0B":"\\u000b"},Ba=/\uffff/.test("\uffff")?/[\\\"\x00-\x1f\x7f-\uffff]/g:/[\\\"\x00-\x1f\x7f-\xff]/g;
function za(a,b){b.push('"',a.replace(Ba,function(a){if(a in Aa)return Aa[a];var b=a.charCodeAt(0),e="\\u";16>b?e+="000":256>b?e+="00":4096>b&&(e+="0");return Aa[a]=e+b.toString(16)}),'"')};var v;a:{var Ca=n.navigator;if(Ca){var Da=Ca.userAgent;if(Da){v=Da;break a}}v=""};function Ea(a){if(Error.captureStackTrace)Error.captureStackTrace(this,Ea);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))}ka(Ea,Error);Ea.prototype.name="CustomError";var w=Array.prototype,Fa=w.indexOf?function(a,b,c){return w.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(q(a))return q(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},Ga=w.forEach?function(a,b,c){w.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},Ha=w.filter?function(a,b,c){return w.filter.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=[],f=0,h=q(a)?
a.split(""):a,k=0;k<d;k++)if(k in h){var m=h[k];b.call(c,m,k,a)&&(e[f++]=m)}return e},Ia=w.map?function(a,b,c){return w.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=q(a)?a.split(""):a,h=0;h<d;h++)h in f&&(e[h]=b.call(c,f[h],h,a));return e},Ja=w.reduce?function(a,b,c,d){for(var e=[],f=1,h=arguments.length;f<h;f++)e.push(arguments[f]);d&&(e[0]=r(b,d));return w.reduce.apply(a,e)}:function(a,b,c,d){var e=c;Ga(a,function(c,h){e=b.call(d,e,c,h,a)});return e},Ka=w.every?function(a,b,
c){return w.every.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&!b.call(c,e[f],f,a))return!1;return!0};function La(a,b){var c=Ma(a,b,void 0);return 0>c?null:q(a)?a.charAt(c):a[c]}function Ma(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return f;return-1}function Na(a,b){var c=Fa(a,b);0<=c&&w.splice.call(a,c,1)}function Oa(a,b,c){return 2>=arguments.length?w.slice.call(a,b):w.slice.call(a,b,c)}
function Pa(a,b){a.sort(b||Qa)}function Qa(a,b){return a>b?1:a<b?-1:0};var Ra=-1!=v.indexOf("Opera")||-1!=v.indexOf("OPR"),Sa=-1!=v.indexOf("Trident")||-1!=v.indexOf("MSIE"),Ta=-1!=v.indexOf("Gecko")&&-1==v.toLowerCase().indexOf("webkit")&&!(-1!=v.indexOf("Trident")||-1!=v.indexOf("MSIE")),Ua=-1!=v.toLowerCase().indexOf("webkit");
(function(){var a="",b;if(Ra&&n.opera)return a=n.opera.version,ga(a)?a():a;Ta?b=/rv\:([^\);]+)(\)|;)/:Sa?b=/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/:Ua&&(b=/WebKit\/(\S+)/);b&&(a=(a=b.exec(v))?a[1]:"");return Sa&&(b=(b=n.document)?b.documentMode:void 0,b>parseFloat(a))?String(b):a})();function Va(a){n.setTimeout(function(){throw a;},0)}var Wa;
function Xa(){var a=n.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&-1==v.indexOf("Presto")&&(a=function(){var a=document.createElement("iframe");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,a=r(function(a){if(("*"==d||a.origin==
d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&-1==v.indexOf("Trident")&&-1==v.indexOf("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(p(c.next)){c=c.next;var a=c.Le;c.Le=null;a()}};return function(a){d.next={Le:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("script")?function(a){var b=
document.createElement("script");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){n.setTimeout(a,0)}};function Ya(a,b){Za||$a();ab||(Za(),ab=!0);bb.push(new cb(a,b))}var Za;function $a(){if(n.Promise&&n.Promise.resolve){var a=n.Promise.resolve();Za=function(){a.then(db)}}else Za=function(){var a=db;!ga(n.setImmediate)||n.Window&&n.Window.prototype&&n.Window.prototype.setImmediate==n.setImmediate?(Wa||(Wa=Xa()),Wa(a)):n.setImmediate(a)}}var ab=!1,bb=[];[].push(function(){ab=!1;bb=[]});
function db(){for(;bb.length;){var a=bb;bb=[];for(var b=0;b<a.length;b++){var c=a[b];try{c.Vf.call(c.scope)}catch(d){Va(d)}}}ab=!1}function cb(a,b){this.Vf=a;this.scope=b};function eb(a,b){this.L=fb;this.tf=void 0;this.Ca=this.Ha=null;this.jd=this.be=!1;if(a==gb)hb(this,ib,b);else try{var c=this;a.call(b,function(a){hb(c,ib,a)},function(a){if(!(a instanceof jb))try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}hb(c,kb,a)})}catch(d){hb(this,kb,d)}}var fb=0,ib=2,kb=3;function gb(){}eb.prototype.then=function(a,b,c){return lb(this,ga(a)?a:null,ga(b)?b:null,c)};eb.prototype.then=eb.prototype.then;eb.prototype.$goog_Thenable=!0;g=eb.prototype;
g.yg=function(a,b){return lb(this,null,a,b)};g.cancel=function(a){this.L==fb&&Ya(function(){var b=new jb(a);mb(this,b)},this)};function mb(a,b){if(a.L==fb)if(a.Ha){var c=a.Ha;if(c.Ca){for(var d=0,e=-1,f=0,h;h=c.Ca[f];f++)if(h=h.m)if(d++,h==a&&(e=f),0<=e&&1<d)break;0<=e&&(c.L==fb&&1==d?mb(c,b):(d=c.Ca.splice(e,1)[0],nb(c,d,kb,b)))}a.Ha=null}else hb(a,kb,b)}function ob(a,b){a.Ca&&a.Ca.length||a.L!=ib&&a.L!=kb||pb(a);a.Ca||(a.Ca=[]);a.Ca.push(b)}
function lb(a,b,c,d){var e={m:null,gf:null,jf:null};e.m=new eb(function(a,h){e.gf=b?function(c){try{var e=b.call(d,c);a(e)}catch(l){h(l)}}:a;e.jf=c?function(b){try{var e=c.call(d,b);!p(e)&&b instanceof jb?h(b):a(e)}catch(l){h(l)}}:h});e.m.Ha=a;ob(a,e);return e.m}g.Bf=function(a){this.L=fb;hb(this,ib,a)};g.Cf=function(a){this.L=fb;hb(this,kb,a)};
function hb(a,b,c){if(a.L==fb){if(a==c)b=kb,c=new TypeError("Promise cannot resolve to itself");else{var d;if(c)try{d=!!c.$goog_Thenable}catch(e){d=!1}else d=!1;if(d){a.L=1;c.then(a.Bf,a.Cf,a);return}if(ha(c))try{var f=c.then;if(ga(f)){qb(a,c,f);return}}catch(h){b=kb,c=h}}a.tf=c;a.L=b;a.Ha=null;pb(a);b!=kb||c instanceof jb||rb(a,c)}}function qb(a,b,c){function d(b){f||(f=!0,a.Cf(b))}function e(b){f||(f=!0,a.Bf(b))}a.L=1;var f=!1;try{c.call(b,e,d)}catch(h){d(h)}}
function pb(a){a.be||(a.be=!0,Ya(a.Tf,a))}g.Tf=function(){for(;this.Ca&&this.Ca.length;){var a=this.Ca;this.Ca=null;for(var b=0;b<a.length;b++)nb(this,a[b],this.L,this.tf)}this.be=!1};function nb(a,b,c,d){if(c==ib)b.gf(d);else{if(b.m)for(;a&&a.jd;a=a.Ha)a.jd=!1;b.jf(d)}}function rb(a,b){a.jd=!0;Ya(function(){a.jd&&sb.call(null,b)})}var sb=Va;function jb(a){Ea.call(this,a)}ka(jb,Ea);jb.prototype.name="cancel";var tb=null,ub=null,vb=null;function wb(a,b){if(!ea(a))throw Error("encodeByteArray takes an array as a parameter");xb();for(var c=b?ub:tb,d=[],e=0;e<a.length;e+=3){var f=a[e],h=e+1<a.length,k=h?a[e+1]:0,m=e+2<a.length,l=m?a[e+2]:0,u=f>>2,f=(f&3)<<4|k>>4,k=(k&15)<<2|l>>6,l=l&63;m||(l=64,h||(k=64));d.push(c[u],c[f],c[k],c[l])}return d.join("")}
function xb(){if(!tb){tb={};ub={};vb={};for(var a=0;65>a;a++)tb[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a),ub[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.".charAt(a),vb[ub[a]]=a,62<=a&&(vb["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(a)]=a)}};function yb(){this.Ya=-1};function zb(){this.Ya=-1;this.Ya=64;this.N=[];this.Wd=[];this.If=[];this.zd=[];this.zd[0]=128;for(var a=1;a<this.Ya;++a)this.zd[a]=0;this.Pd=this.ac=0;this.reset()}ka(zb,yb);zb.prototype.reset=function(){this.N[0]=1732584193;this.N[1]=4023233417;this.N[2]=2562383102;this.N[3]=271733878;this.N[4]=3285377520;this.Pd=this.ac=0};
function Ab(a,b,c){c||(c=0);var d=a.If;if(q(b))for(var e=0;16>e;e++)d[e]=b.charCodeAt(c)<<24|b.charCodeAt(c+1)<<16|b.charCodeAt(c+2)<<8|b.charCodeAt(c+3),c+=4;else for(e=0;16>e;e++)d[e]=b[c]<<24|b[c+1]<<16|b[c+2]<<8|b[c+3],c+=4;for(e=16;80>e;e++){var f=d[e-3]^d[e-8]^d[e-14]^d[e-16];d[e]=(f<<1|f>>>31)&4294967295}b=a.N[0];c=a.N[1];for(var h=a.N[2],k=a.N[3],m=a.N[4],l,e=0;80>e;e++)40>e?20>e?(f=k^c&(h^k),l=1518500249):(f=c^h^k,l=1859775393):60>e?(f=c&h|k&(c|h),l=2400959708):(f=c^h^k,l=3395469782),f=(b<<
5|b>>>27)+f+m+l+d[e]&4294967295,m=k,k=h,h=(c<<30|c>>>2)&4294967295,c=b,b=f;a.N[0]=a.N[0]+b&4294967295;a.N[1]=a.N[1]+c&4294967295;a.N[2]=a.N[2]+h&4294967295;a.N[3]=a.N[3]+k&4294967295;a.N[4]=a.N[4]+m&4294967295}
zb.prototype.update=function(a,b){if(null!=a){p(b)||(b=a.length);for(var c=b-this.Ya,d=0,e=this.Wd,f=this.ac;d<b;){if(0==f)for(;d<=c;)Ab(this,a,d),d+=this.Ya;if(q(a))for(;d<b;){if(e[f]=a.charCodeAt(d),++f,++d,f==this.Ya){Ab(this,e);f=0;break}}else for(;d<b;)if(e[f]=a[d],++f,++d,f==this.Ya){Ab(this,e);f=0;break}}this.ac=f;this.Pd+=b}};function x(a,b,c,d){var e;d<b?e="at least "+b:d>c&&(e=0===c?"none":"no more than "+c);if(e)throw Error(a+" failed: Was called with "+d+(1===d?" argument.":" arguments.")+" Expects "+e+".");}function Bb(a,b,c){var d="";switch(b){case 1:d=c?"first":"First";break;case 2:d=c?"second":"Second";break;case 3:d=c?"third":"Third";break;case 4:d=c?"fourth":"Fourth";break;default:throw Error("errorPrefix called with argumentNumber > 4.  Need to update it?");}return a=a+" failed: "+(d+" argument ")}
function y(a,b,c,d){if((!d||p(c))&&!ga(c))throw Error(Bb(a,b,d)+"must be a valid function.");}function Cb(a,b,c){if(p(c)&&(!ha(c)||null===c))throw Error(Bb(a,b,!0)+"must be a valid context object.");};var Db=n.Promise||eb;eb.prototype["catch"]=eb.prototype.yg;function Eb(){var a=this;this.reject=this.resolve=null;this.ra=new Db(function(b,c){a.resolve=b;a.reject=c})}function Fb(a,b){return function(c,d){c?a.reject(c):a.resolve(d);ga(b)&&(Gb(a.ra),1===b.length?b(c):b(c,d))}}function Gb(a){a.then(void 0,aa)};function Hb(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function A(a,b){if(Object.prototype.hasOwnProperty.call(a,b))return a[b]}function Ib(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b(c,a[c])};function Jb(a){var b=[];Ib(a,function(a,d){da(d)?Ga(d,function(d){b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))}):b.push(encodeURIComponent(a)+"="+encodeURIComponent(d))});return b.length?"&"+b.join("&"):""};function Kb(a){return"undefined"!==typeof JSON&&p(JSON.parse)?JSON.parse(a):wa(a)}function B(a){if("undefined"!==typeof JSON&&p(JSON.stringify))a=JSON.stringify(a);else{var b=[];ya(new xa,a,b);a=b.join("")}return a};function Lb(a,b){if(!a)throw Mb(b);}function Mb(a){return Error("Firebase Database ("+firebase.SDK_VERSION+") INTERNAL ASSERT FAILED: "+a)};function Nb(a){for(var b=[],c=0,d=0;d<a.length;d++){var e=a.charCodeAt(d);55296<=e&&56319>=e&&(e-=55296,d++,Lb(d<a.length,"Surrogate pair missing trail surrogate."),e=65536+(e<<10)+(a.charCodeAt(d)-56320));128>e?b[c++]=e:(2048>e?b[c++]=e>>6|192:(65536>e?b[c++]=e>>12|224:(b[c++]=e>>18|240,b[c++]=e>>12&63|128),b[c++]=e>>6&63|128),b[c++]=e&63|128)}return b}function Ob(a){for(var b=0,c=0;c<a.length;c++){var d=a.charCodeAt(c);128>d?b++:2048>d?b+=2:55296<=d&&56319>=d?(b+=4,c++):b+=3}return b};function Pb(){return"undefined"!==typeof window&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test("undefined"!==typeof navigator&&"string"===typeof navigator.userAgent?navigator.userAgent:"")};function Qb(a){this.te=a;this.Bd=[];this.Rb=0;this.Yd=-1;this.Gb=null}function Rb(a,b,c){a.Yd=b;a.Gb=c;a.Yd<a.Rb&&(a.Gb(),a.Gb=null)}function Sb(a,b,c){for(a.Bd[b]=c;a.Bd[a.Rb];){var d=a.Bd[a.Rb];delete a.Bd[a.Rb];for(var e=0;e<d.length;++e)if(d[e]){var f=a;Tb(function(){f.te(d[e])})}if(a.Rb===a.Yd){a.Gb&&(clearTimeout(a.Gb),a.Gb(),a.Gb=null);break}a.Rb++}};function Ub(){this.qc={}}Ub.prototype.set=function(a,b){null==b?delete this.qc[a]:this.qc[a]=b};Ub.prototype.get=function(a){return Hb(this.qc,a)?this.qc[a]:null};Ub.prototype.remove=function(a){delete this.qc[a]};Ub.prototype.bf=!0;function Vb(a){this.vc=a;this.Cd="firebase:"}g=Vb.prototype;g.set=function(a,b){null==b?this.vc.removeItem(this.Cd+a):this.vc.setItem(this.Cd+a,B(b))};g.get=function(a){a=this.vc.getItem(this.Cd+a);return null==a?null:Kb(a)};g.remove=function(a){this.vc.removeItem(this.Cd+a)};g.bf=!1;g.toString=function(){return this.vc.toString()};function Wb(a){try{if("undefined"!==typeof window&&"undefined"!==typeof window[a]){var b=window[a];b.setItem("firebase:sentinel","cache");b.removeItem("firebase:sentinel");return new Vb(b)}}catch(c){}return new Ub}var Xb=Wb("localStorage"),Yb=Wb("sessionStorage");function Zb(a,b){this.type=$b;this.source=a;this.path=b}Zb.prototype.Nc=function(){return this.path.e()?new Zb(this.source,C):new Zb(this.source,D(this.path))};Zb.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" listen_complete)"};function ac(a,b,c){this.type=bc;this.source=a;this.path=b;this.Ja=c}ac.prototype.Nc=function(a){return this.path.e()?new ac(this.source,C,this.Ja.R(a)):new ac(this.source,D(this.path),this.Ja)};ac.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" overwrite: "+this.Ja.toString()+")"};function cc(a,b,c,d,e){this.host=a.toLowerCase();this.domain=this.host.substr(this.host.indexOf(".")+1);this.Sc=b;this.pe=c;this.Ag=d;this.mf=e||"";this.bb=Xb.get("host:"+a)||this.host}function dc(a,b){b!==a.bb&&(a.bb=b,"s-"===a.bb.substr(0,2)&&Xb.set("host:"+a.host,a.bb))}
function ec(a,b,c){E("string"===typeof b,"typeof type must == string");E("object"===typeof c,"typeof params must == object");if("websocket"===b)b=(a.Sc?"wss://":"ws://")+a.bb+"/.ws?";else if("long_polling"===b)b=(a.Sc?"https://":"http://")+a.bb+"/.lp?";else throw Error("Unknown connection type: "+b);a.host!==a.bb&&(c.ns=a.pe);var d=[];t(c,function(a,b){d.push(b+"="+a)});return b+d.join("&")}
cc.prototype.toString=function(){var a=(this.Sc?"https://":"http://")+this.host;this.mf&&(a+="<"+this.mf+">");return a};function fc(){this.Jd=F}fc.prototype.j=function(a){return this.Jd.Q(a)};fc.prototype.toString=function(){return this.Jd.toString()};function H(a,b,c,d){this.type=a;this.Ma=b;this.Za=c;this.qe=d;this.Dd=void 0}function gc(a){return new H(hc,a)}var hc="value";function ic(a,b,c,d){this.ae=b;this.Md=c;this.Dd=d;this.gd=a}ic.prototype.Zb=function(){var a=this.Md.xb();return"value"===this.gd?a.path:a.getParent().path};ic.prototype.ge=function(){return this.gd};ic.prototype.Ub=function(){return this.ae.Ub(this)};ic.prototype.toString=function(){return this.Zb().toString()+":"+this.gd+":"+B(this.Md.Te())};function jc(a,b,c){this.ae=a;this.error=b;this.path=c}jc.prototype.Zb=function(){return this.path};jc.prototype.ge=function(){return"cancel"};
jc.prototype.Ub=function(){return this.ae.Ub(this)};jc.prototype.toString=function(){return this.path.toString()+":cancel"};function kc(){}kc.prototype.We=function(){return null};kc.prototype.fe=function(){return null};var lc=new kc;function mc(a,b,c){this.Ff=a;this.Na=b;this.yd=c}mc.prototype.We=function(a){var b=this.Na.O;if(nc(b,a))return b.j().R(a);b=null!=this.yd?new oc(this.yd,!0,!1):this.Na.u();return this.Ff.rc(a,b)};mc.prototype.fe=function(a,b,c){var d=null!=this.yd?this.yd:pc(this.Na);a=this.Ff.Xd(d,b,1,c,a);return 0===a.length?null:a[0]};function qc(){this.wb=[]}function rc(a,b){for(var c=null,d=0;d<b.length;d++){var e=b[d],f=e.Zb();null===c||f.ca(c.Zb())||(a.wb.push(c),c=null);null===c&&(c=new sc(f));c.add(e)}c&&a.wb.push(c)}function tc(a,b,c){rc(a,c);uc(a,function(a){return a.ca(b)})}function vc(a,b,c){rc(a,c);uc(a,function(a){return a.contains(b)||b.contains(a)})}
function uc(a,b){for(var c=!0,d=0;d<a.wb.length;d++){var e=a.wb[d];if(e)if(e=e.Zb(),b(e)){for(var e=a.wb[d],f=0;f<e.hd.length;f++){var h=e.hd[f];if(null!==h){e.hd[f]=null;var k=h.Ub();wc&&I("event: "+h.toString());Tb(k)}}a.wb[d]=null}else c=!1}c&&(a.wb=[])}function sc(a){this.qa=a;this.hd=[]}sc.prototype.add=function(a){this.hd.push(a)};sc.prototype.Zb=function(){return this.qa};function oc(a,b,c){this.A=a;this.ea=b;this.Tb=c}function xc(a){return a.ea}function yc(a){return a.Tb}function zc(a,b){return b.e()?a.ea&&!a.Tb:nc(a,J(b))}function nc(a,b){return a.ea&&!a.Tb||a.A.Fa(b)}oc.prototype.j=function(){return this.A};function Ac(a,b){this.Oa=a;this.ba=b?b:Bc}g=Ac.prototype;g.Ra=function(a,b){return new Ac(this.Oa,this.ba.Ra(a,b,this.Oa).Y(null,null,!1,null,null))};g.remove=function(a){return new Ac(this.Oa,this.ba.remove(a,this.Oa).Y(null,null,!1,null,null))};g.get=function(a){for(var b,c=this.ba;!c.e();){b=this.Oa(a,c.key);if(0===b)return c.value;0>b?c=c.left:0<b&&(c=c.right)}return null};
function Cc(a,b){for(var c,d=a.ba,e=null;!d.e();){c=a.Oa(b,d.key);if(0===c){if(d.left.e())return e?e.key:null;for(d=d.left;!d.right.e();)d=d.right;return d.key}0>c?d=d.left:0<c&&(e=d,d=d.right)}throw Error("Attempted to find predecessor key for a nonexistent key.  What gives?");}g.e=function(){return this.ba.e()};g.count=function(){return this.ba.count()};g.Hc=function(){return this.ba.Hc()};g.fc=function(){return this.ba.fc()};g.ia=function(a){return this.ba.ia(a)};
g.Xb=function(a){return new Dc(this.ba,null,this.Oa,!1,a)};g.Yb=function(a,b){return new Dc(this.ba,a,this.Oa,!1,b)};g.$b=function(a,b){return new Dc(this.ba,a,this.Oa,!0,b)};g.Ze=function(a){return new Dc(this.ba,null,this.Oa,!0,a)};function Dc(a,b,c,d,e){this.Hd=e||null;this.le=d;this.Sa=[];for(e=1;!a.e();)if(e=b?c(a.key,b):1,d&&(e*=-1),0>e)a=this.le?a.left:a.right;else if(0===e){this.Sa.push(a);break}else this.Sa.push(a),a=this.le?a.right:a.left}
function K(a){if(0===a.Sa.length)return null;var b=a.Sa.pop(),c;c=a.Hd?a.Hd(b.key,b.value):{key:b.key,value:b.value};if(a.le)for(b=b.left;!b.e();)a.Sa.push(b),b=b.right;else for(b=b.right;!b.e();)a.Sa.push(b),b=b.left;return c}function Ec(a){if(0===a.Sa.length)return null;var b;b=a.Sa;b=b[b.length-1];return a.Hd?a.Hd(b.key,b.value):{key:b.key,value:b.value}}function Fc(a,b,c,d,e){this.key=a;this.value=b;this.color=null!=c?c:!0;this.left=null!=d?d:Bc;this.right=null!=e?e:Bc}g=Fc.prototype;
g.Y=function(a,b,c,d,e){return new Fc(null!=a?a:this.key,null!=b?b:this.value,null!=c?c:this.color,null!=d?d:this.left,null!=e?e:this.right)};g.count=function(){return this.left.count()+1+this.right.count()};g.e=function(){return!1};g.ia=function(a){return this.left.ia(a)||a(this.key,this.value)||this.right.ia(a)};function Gc(a){return a.left.e()?a:Gc(a.left)}g.Hc=function(){return Gc(this).key};g.fc=function(){return this.right.e()?this.key:this.right.fc()};
g.Ra=function(a,b,c){var d,e;e=this;d=c(a,e.key);e=0>d?e.Y(null,null,null,e.left.Ra(a,b,c),null):0===d?e.Y(null,b,null,null,null):e.Y(null,null,null,null,e.right.Ra(a,b,c));return Hc(e)};function Ic(a){if(a.left.e())return Bc;a.left.fa()||a.left.left.fa()||(a=Jc(a));a=a.Y(null,null,null,Ic(a.left),null);return Hc(a)}
g.remove=function(a,b){var c,d;c=this;if(0>b(a,c.key))c.left.e()||c.left.fa()||c.left.left.fa()||(c=Jc(c)),c=c.Y(null,null,null,c.left.remove(a,b),null);else{c.left.fa()&&(c=Kc(c));c.right.e()||c.right.fa()||c.right.left.fa()||(c=Lc(c),c.left.left.fa()&&(c=Kc(c),c=Lc(c)));if(0===b(a,c.key)){if(c.right.e())return Bc;d=Gc(c.right);c=c.Y(d.key,d.value,null,null,Ic(c.right))}c=c.Y(null,null,null,null,c.right.remove(a,b))}return Hc(c)};g.fa=function(){return this.color};
function Hc(a){a.right.fa()&&!a.left.fa()&&(a=Mc(a));a.left.fa()&&a.left.left.fa()&&(a=Kc(a));a.left.fa()&&a.right.fa()&&(a=Lc(a));return a}function Jc(a){a=Lc(a);a.right.left.fa()&&(a=a.Y(null,null,null,null,Kc(a.right)),a=Mc(a),a=Lc(a));return a}function Mc(a){return a.right.Y(null,null,a.color,a.Y(null,null,!0,null,a.right.left),null)}function Kc(a){return a.left.Y(null,null,a.color,null,a.Y(null,null,!0,a.left.right,null))}
function Lc(a){return a.Y(null,null,!a.color,a.left.Y(null,null,!a.left.color,null,null),a.right.Y(null,null,!a.right.color,null,null))}function Nc(){}g=Nc.prototype;g.Y=function(){return this};g.Ra=function(a,b){return new Fc(a,b,null)};g.remove=function(){return this};g.count=function(){return 0};g.e=function(){return!0};g.ia=function(){return!1};g.Hc=function(){return null};g.fc=function(){return null};g.fa=function(){return!1};var Bc=new Nc;var Oc=function(){var a=1;return function(){return a++}}(),E=Lb,Pc=Mb;
function Qc(a){try{var b;if("undefined"!==typeof atob)b=atob(a);else{xb();for(var c=vb,d=[],e=0;e<a.length;){var f=c[a.charAt(e++)],h=e<a.length?c[a.charAt(e)]:0;++e;var k=e<a.length?c[a.charAt(e)]:64;++e;var m=e<a.length?c[a.charAt(e)]:64;++e;if(null==f||null==h||null==k||null==m)throw Error();d.push(f<<2|h>>4);64!=k&&(d.push(h<<4&240|k>>2),64!=m&&d.push(k<<6&192|m))}if(8192>d.length)b=String.fromCharCode.apply(null,d);else{a="";for(c=0;c<d.length;c+=8192)a+=String.fromCharCode.apply(null,Oa(d,c,
c+8192));b=a}}return b}catch(l){I("base64Decode failed: ",l)}return null}function Rc(a){var b=Nb(a);a=new zb;a.update(b);var b=[],c=8*a.Pd;56>a.ac?a.update(a.zd,56-a.ac):a.update(a.zd,a.Ya-(a.ac-56));for(var d=a.Ya-1;56<=d;d--)a.Wd[d]=c&255,c/=256;Ab(a,a.Wd);for(d=c=0;5>d;d++)for(var e=24;0<=e;e-=8)b[c]=a.N[d]>>e&255,++c;return wb(b)}
function Sc(a){for(var b="",c=0;c<arguments.length;c++)b=ea(arguments[c])?b+Sc.apply(null,arguments[c]):"object"===typeof arguments[c]?b+B(arguments[c]):b+arguments[c],b+=" ";return b}var wc=null,Tc=!0;
function Uc(a,b){Lb(!b||!0===a||!1===a,"Can't turn on custom loggers persistently.");!0===a?("undefined"!==typeof console&&("function"===typeof console.log?wc=r(console.log,console):"object"===typeof console.log&&(wc=function(a){console.log(a)})),b&&Yb.set("logging_enabled",!0)):ga(a)?wc=a:(wc=null,Yb.remove("logging_enabled"))}function I(a){!0===Tc&&(Tc=!1,null===wc&&!0===Yb.get("logging_enabled")&&Uc(!0));if(wc){var b=Sc.apply(null,arguments);wc(b)}}
function Vc(a){return function(){I(a,arguments)}}function Wc(a){if("undefined"!==typeof console){var b="FIREBASE INTERNAL ERROR: "+Sc.apply(null,arguments);"undefined"!==typeof console.error?console.error(b):console.log(b)}}function Xc(a){var b=Sc.apply(null,arguments);throw Error("FIREBASE FATAL ERROR: "+b);}function L(a){if("undefined"!==typeof console){var b="FIREBASE WARNING: "+Sc.apply(null,arguments);"undefined"!==typeof console.warn?console.warn(b):console.log(b)}}
function Yc(a){var b,c,d,e,f,h=a;f=c=a=b="";d=!0;e="https";if(q(h)){var k=h.indexOf("//");0<=k&&(e=h.substring(0,k-1),h=h.substring(k+2));k=h.indexOf("/");-1===k&&(k=h.length);b=h.substring(0,k);f="";h=h.substring(k).split("/");for(k=0;k<h.length;k++)if(0<h[k].length){var m=h[k];try{m=decodeURIComponent(m.replace(/\+/g," "))}catch(l){}f+="/"+m}h=b.split(".");3===h.length?(a=h[1],c=h[0].toLowerCase()):2===h.length&&(a=h[0]);k=b.indexOf(":");0<=k&&(d="https"===e||"wss"===e)}"firebase"===a&&Xc(b+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead");
c&&"undefined"!=c||Xc("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com");d||"undefined"!==typeof window&&window.location&&window.location.protocol&&-1!==window.location.protocol.indexOf("https:")&&L("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().");return{kc:new cc(b,d,c,"ws"===e||"wss"===e),path:new M(f)}}function Zc(a){return fa(a)&&(a!=a||a==Number.POSITIVE_INFINITY||a==Number.NEGATIVE_INFINITY)}
function $c(a){if("complete"===document.readyState)a();else{var b=!1,c=function(){document.body?b||(b=!0,a()):setTimeout(c,Math.floor(10))};document.addEventListener?(document.addEventListener("DOMContentLoaded",c,!1),window.addEventListener("load",c,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",function(){"complete"===document.readyState&&c()}),window.attachEvent("onload",c))}}
function ad(a,b){if(a===b)return 0;if("[MIN_NAME]"===a||"[MAX_NAME]"===b)return-1;if("[MIN_NAME]"===b||"[MAX_NAME]"===a)return 1;var c=bd(a),d=bd(b);return null!==c?null!==d?0==c-d?a.length-b.length:c-d:-1:null!==d?1:a<b?-1:1}function cd(a,b){if(b&&a in b)return b[a];throw Error("Missing required key ("+a+") in object: "+B(b));}
function dd(a){if("object"!==typeof a||null===a)return B(a);var b=[],c;for(c in a)b.push(c);b.sort();c="{";for(var d=0;d<b.length;d++)0!==d&&(c+=","),c+=B(b[d]),c+=":",c+=dd(a[b[d]]);return c+"}"}function ed(a,b){if(a.length<=b)return[a];for(var c=[],d=0;d<a.length;d+=b)d+b>a?c.push(a.substring(d,a.length)):c.push(a.substring(d,d+b));return c}function fd(a,b){if(da(a))for(var c=0;c<a.length;++c)b(c,a[c]);else t(a,b)}
function gd(a){E(!Zc(a),"Invalid JSON number");var b,c,d,e;0===a?(d=c=0,b=-Infinity===1/a?1:0):(b=0>a,a=Math.abs(a),a>=Math.pow(2,-1022)?(d=Math.min(Math.floor(Math.log(a)/Math.LN2),1023),c=d+1023,d=Math.round(a*Math.pow(2,52-d)-Math.pow(2,52))):(c=0,d=Math.round(a/Math.pow(2,-1074))));e=[];for(a=52;a;--a)e.push(d%2?1:0),d=Math.floor(d/2);for(a=11;a;--a)e.push(c%2?1:0),c=Math.floor(c/2);e.push(b?1:0);e.reverse();b=e.join("");c="";for(a=0;64>a;a+=8)d=parseInt(b.substr(a,8),2).toString(16),1===d.length&&
(d="0"+d),c+=d;return c.toLowerCase()}var hd=/^-?\d{1,10}$/;function bd(a){return hd.test(a)&&(a=Number(a),-2147483648<=a&&2147483647>=a)?a:null}function Tb(a){try{a()}catch(b){setTimeout(function(){L("Exception was thrown by user callback.",b.stack||"");throw b;},Math.floor(0))}}function id(a,b,c){Object.defineProperty(a,b,{get:c})};function jd(a){var b={};try{var c=a.split(".");Kb(Qc(c[0])||"");b=Kb(Qc(c[1])||"");delete b.d}catch(d){}a=b;return"object"===typeof a&&!0===A(a,"admin")};function kd(a,b,c){this.type=ld;this.source=a;this.path=b;this.children=c}kd.prototype.Nc=function(a){if(this.path.e())return a=this.children.subtree(new M(a)),a.e()?null:a.value?new ac(this.source,C,a.value):new kd(this.source,C,a);E(J(this.path)===a,"Can't get a merge for a child not on the path of the operation");return new kd(this.source,D(this.path),this.children)};kd.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" merge: "+this.children.toString()+")"};function md(a){this.g=a}g=md.prototype;g.F=function(a,b,c,d,e,f){E(a.zc(this.g),"A node must be indexed if only a child is updated");e=a.R(b);if(e.Q(d).ca(c.Q(d))&&e.e()==c.e())return a;null!=f&&(c.e()?a.Fa(b)?nd(f,new H("child_removed",e,b)):E(a.J(),"A child remove without an old child only makes sense on a leaf node"):e.e()?nd(f,new H("child_added",c,b)):nd(f,new H("child_changed",c,b,e)));return a.J()&&c.e()?a:a.U(b,c).ob(this.g)};
g.za=function(a,b,c){null!=c&&(a.J()||a.P(N,function(a,e){b.Fa(a)||nd(c,new H("child_removed",e,a))}),b.J()||b.P(N,function(b,e){if(a.Fa(b)){var f=a.R(b);f.ca(e)||nd(c,new H("child_changed",e,b,f))}else nd(c,new H("child_added",e,b))}));return b.ob(this.g)};g.ga=function(a,b){return a.e()?F:a.ga(b)};g.Qa=function(){return!1};g.Vb=function(){return this};function od(a){this.he=new md(a.g);this.g=a.g;var b;a.ka?(b=pd(a),b=a.g.Fc(qd(a),b)):b=a.g.Ic();this.Uc=b;a.na?(b=rd(a),a=a.g.Fc(sd(a),b)):a=a.g.Gc();this.wc=a}g=od.prototype;g.matches=function(a){return 0>=this.g.compare(this.Uc,a)&&0>=this.g.compare(a,this.wc)};g.F=function(a,b,c,d,e,f){this.matches(new O(b,c))||(c=F);return this.he.F(a,b,c,d,e,f)};
g.za=function(a,b,c){b.J()&&(b=F);var d=b.ob(this.g),d=d.ga(F),e=this;b.P(N,function(a,b){e.matches(new O(a,b))||(d=d.U(a,F))});return this.he.za(a,d,c)};g.ga=function(a){return a};g.Qa=function(){return!0};g.Vb=function(){return this.he};function td(){this.hb={}}
function nd(a,b){var c=b.type,d=b.Za;E("child_added"==c||"child_changed"==c||"child_removed"==c,"Only child changes supported for tracking");E(".priority"!==d,"Only non-priority child changes can be tracked.");var e=A(a.hb,d);if(e){var f=e.type;if("child_added"==c&&"child_removed"==f)a.hb[d]=new H("child_changed",b.Ma,d,e.Ma);else if("child_removed"==c&&"child_added"==f)delete a.hb[d];else if("child_removed"==c&&"child_changed"==f)a.hb[d]=new H("child_removed",e.qe,d);else if("child_changed"==c&&
"child_added"==f)a.hb[d]=new H("child_added",b.Ma,d);else if("child_changed"==c&&"child_changed"==f)a.hb[d]=new H("child_changed",b.Ma,d,e.qe);else throw Pc("Illegal combination of changes: "+b+" occurred after "+e);}else a.hb[d]=b};function ud(a,b){this.Sd=a;this.Lf=b}function vd(a){this.V=a}
vd.prototype.gb=function(a,b,c,d){var e=new td,f;if(b.type===bc)b.source.ee?c=wd(this,a,b.path,b.Ja,c,d,e):(E(b.source.Ve,"Unknown source."),f=b.source.Ee||yc(a.u())&&!b.path.e(),c=xd(this,a,b.path,b.Ja,c,d,f,e));else if(b.type===ld)b.source.ee?c=yd(this,a,b.path,b.children,c,d,e):(E(b.source.Ve,"Unknown source."),f=b.source.Ee||yc(a.u()),c=zd(this,a,b.path,b.children,c,d,f,e));else if(b.type===Ad)if(b.Id)if(b=b.path,null!=c.mc(b))c=a;else{f=new mc(c,a,d);d=a.O.j();if(b.e()||".priority"===J(b))xc(a.u())?
b=c.Ba(pc(a)):(b=a.u().j(),E(b instanceof P,"serverChildren would be complete if leaf node"),b=c.sc(b)),b=this.V.za(d,b,e);else{var h=J(b),k=c.rc(h,a.u());null==k&&nc(a.u(),h)&&(k=d.R(h));b=null!=k?this.V.F(d,h,k,D(b),f,e):a.O.j().Fa(h)?this.V.F(d,h,F,D(b),f,e):d;b.e()&&xc(a.u())&&(d=c.Ba(pc(a)),d.J()&&(b=this.V.za(b,d,e)))}d=xc(a.u())||null!=c.mc(C);c=Cd(a,b,d,this.V.Qa())}else c=Dd(this,a,b.path,b.Pb,c,d,e);else if(b.type===$b)d=b.path,b=a.u(),f=b.j(),h=b.ea||d.e(),c=Ed(this,new Fd(a.O,new oc(f,
h,b.Tb)),d,c,lc,e);else throw Pc("Unknown operation type: "+b.type);e=pa(e.hb);d=c;b=d.O;b.ea&&(f=b.j().J()||b.j().e(),h=Gd(a),(0<e.length||!a.O.ea||f&&!b.j().ca(h)||!b.j().C().ca(h.C()))&&e.push(gc(Gd(d))));return new ud(c,e)};
function Ed(a,b,c,d,e,f){var h=b.O;if(null!=d.mc(c))return b;var k;if(c.e())E(xc(b.u()),"If change path is empty, we must have complete server data"),yc(b.u())?(e=pc(b),d=d.sc(e instanceof P?e:F)):d=d.Ba(pc(b)),f=a.V.za(b.O.j(),d,f);else{var m=J(c);if(".priority"==m)E(1==Hd(c),"Can't have a priority with additional path components"),f=h.j(),k=b.u().j(),d=d.$c(c,f,k),f=null!=d?a.V.ga(f,d):h.j();else{var l=D(c);nc(h,m)?(k=b.u().j(),d=d.$c(c,h.j(),k),d=null!=d?h.j().R(m).F(l,d):h.j().R(m)):d=d.rc(m,
b.u());f=null!=d?a.V.F(h.j(),m,d,l,e,f):h.j()}}return Cd(b,f,h.ea||c.e(),a.V.Qa())}function xd(a,b,c,d,e,f,h,k){var m=b.u();h=h?a.V:a.V.Vb();if(c.e())d=h.za(m.j(),d,null);else if(h.Qa()&&!m.Tb)d=m.j().F(c,d),d=h.za(m.j(),d,null);else{var l=J(c);if(!zc(m,c)&&1<Hd(c))return b;var u=D(c);d=m.j().R(l).F(u,d);d=".priority"==l?h.ga(m.j(),d):h.F(m.j(),l,d,u,lc,null)}m=m.ea||c.e();b=new Fd(b.O,new oc(d,m,h.Qa()));return Ed(a,b,c,e,new mc(e,b,f),k)}
function wd(a,b,c,d,e,f,h){var k=b.O;e=new mc(e,b,f);if(c.e())h=a.V.za(b.O.j(),d,h),a=Cd(b,h,!0,a.V.Qa());else if(f=J(c),".priority"===f)h=a.V.ga(b.O.j(),d),a=Cd(b,h,k.ea,k.Tb);else{c=D(c);var m=k.j().R(f);if(!c.e()){var l=e.We(f);d=null!=l?".priority"===Id(c)&&l.Q(c.parent()).e()?l:l.F(c,d):F}m.ca(d)?a=b:(h=a.V.F(k.j(),f,d,c,e,h),a=Cd(b,h,k.ea,a.V.Qa()))}return a}
function yd(a,b,c,d,e,f,h){var k=b;Jd(d,function(d,l){var u=c.m(d);nc(b.O,J(u))&&(k=wd(a,k,u,l,e,f,h))});Jd(d,function(d,l){var u=c.m(d);nc(b.O,J(u))||(k=wd(a,k,u,l,e,f,h))});return k}function Kd(a,b){Jd(b,function(b,d){a=a.F(b,d)});return a}
function zd(a,b,c,d,e,f,h,k){if(b.u().j().e()&&!xc(b.u()))return b;var m=b;c=c.e()?d:Ld(Q,c,d);var l=b.u().j();c.children.ia(function(c,d){if(l.Fa(c)){var G=b.u().j().R(c),G=Kd(G,d);m=xd(a,m,new M(c),G,e,f,h,k)}});c.children.ia(function(c,d){var G=!nc(b.u(),c)&&null==d.value;l.Fa(c)||G||(G=b.u().j().R(c),G=Kd(G,d),m=xd(a,m,new M(c),G,e,f,h,k))});return m}
function Dd(a,b,c,d,e,f,h){if(null!=e.mc(c))return b;var k=yc(b.u()),m=b.u();if(null!=d.value){if(c.e()&&m.ea||zc(m,c))return xd(a,b,c,m.j().Q(c),e,f,k,h);if(c.e()){var l=Q;m.j().P(Md,function(a,b){l=l.set(new M(a),b)});return zd(a,b,c,l,e,f,k,h)}return b}l=Q;Jd(d,function(a){var b=c.m(a);zc(m,b)&&(l=l.set(a,m.j().Q(b)))});return zd(a,b,c,l,e,f,k,h)};var Nd=function(){var a=0,b=[];return function(c){var d=c===a;a=c;for(var e=Array(8),f=7;0<=f;f--)e[f]="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c%64),c=Math.floor(c/64);E(0===c,"Cannot push at time == 0");c=e.join("");if(d){for(f=11;0<=f&&63===b[f];f--)b[f]=0;b[f]++}else for(f=0;12>f;f++)b[f]=Math.floor(64*Math.random());for(f=0;12>f;f++)c+="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);E(20===c.length,"nextPushId: Length should be 20.");
return c}}();function M(a,b){if(1==arguments.length){this.o=a.split("/");for(var c=0,d=0;d<this.o.length;d++)0<this.o[d].length&&(this.o[c]=this.o[d],c++);this.o.length=c;this.Z=0}else this.o=a,this.Z=b}function R(a,b){var c=J(a);if(null===c)return b;if(c===J(b))return R(D(a),D(b));throw Error("INTERNAL ERROR: innerPath ("+b+") is not within outerPath ("+a+")");}
function Od(a,b){for(var c=a.slice(),d=b.slice(),e=0;e<c.length&&e<d.length;e++){var f=ad(c[e],d[e]);if(0!==f)return f}return c.length===d.length?0:c.length<d.length?-1:1}function J(a){return a.Z>=a.o.length?null:a.o[a.Z]}function Hd(a){return a.o.length-a.Z}function D(a){var b=a.Z;b<a.o.length&&b++;return new M(a.o,b)}function Id(a){return a.Z<a.o.length?a.o[a.o.length-1]:null}g=M.prototype;
g.toString=function(){for(var a="",b=this.Z;b<this.o.length;b++)""!==this.o[b]&&(a+="/"+this.o[b]);return a||"/"};g.slice=function(a){return this.o.slice(this.Z+(a||0))};g.parent=function(){if(this.Z>=this.o.length)return null;for(var a=[],b=this.Z;b<this.o.length-1;b++)a.push(this.o[b]);return new M(a,0)};
g.m=function(a){for(var b=[],c=this.Z;c<this.o.length;c++)b.push(this.o[c]);if(a instanceof M)for(c=a.Z;c<a.o.length;c++)b.push(a.o[c]);else for(a=a.split("/"),c=0;c<a.length;c++)0<a[c].length&&b.push(a[c]);return new M(b,0)};g.e=function(){return this.Z>=this.o.length};g.ca=function(a){if(Hd(this)!==Hd(a))return!1;for(var b=this.Z,c=a.Z;b<=this.o.length;b++,c++)if(this.o[b]!==a.o[c])return!1;return!0};
g.contains=function(a){var b=this.Z,c=a.Z;if(Hd(this)>Hd(a))return!1;for(;b<this.o.length;){if(this.o[b]!==a.o[c])return!1;++b;++c}return!0};var C=new M("");function Pd(a,b){this.Ta=a.slice();this.Ka=Math.max(1,this.Ta.length);this.Se=b;for(var c=0;c<this.Ta.length;c++)this.Ka+=Ob(this.Ta[c]);Qd(this)}Pd.prototype.push=function(a){0<this.Ta.length&&(this.Ka+=1);this.Ta.push(a);this.Ka+=Ob(a);Qd(this)};Pd.prototype.pop=function(){var a=this.Ta.pop();this.Ka-=Ob(a);0<this.Ta.length&&--this.Ka};
function Qd(a){if(768<a.Ka)throw Error(a.Se+"has a key path longer than 768 bytes ("+a.Ka+").");if(32<a.Ta.length)throw Error(a.Se+"path specified exceeds the maximum depth that can be written (32) or object contains a cycle "+Rd(a));}function Rd(a){return 0==a.Ta.length?"":"in property '"+a.Ta.join(".")+"'"};var Sd=/[\[\].#$\/\u0000-\u001F\u007F]/,Td=/[\[\].#$\u0000-\u001F\u007F]/;function Ud(a){return q(a)&&0!==a.length&&!Sd.test(a)}function Vd(a){return null===a||q(a)||fa(a)&&!Zc(a)||ha(a)&&Hb(a,".sv")}function Wd(a,b,c,d){d&&!p(b)||Xd(Bb(a,1,d),b,c)}
function Xd(a,b,c){c instanceof M&&(c=new Pd(c,a));if(!p(b))throw Error(a+"contains undefined "+Rd(c));if(ga(b))throw Error(a+"contains a function "+Rd(c)+" with contents: "+b.toString());if(Zc(b))throw Error(a+"contains "+b.toString()+" "+Rd(c));if(q(b)&&b.length>10485760/3&&10485760<Ob(b))throw Error(a+"contains a string greater than 10485760 utf8 bytes "+Rd(c)+" ('"+b.substring(0,50)+"...')");if(ha(b)){var d=!1,e=!1;Ib(b,function(b,h){if(".value"===b)d=!0;else if(".priority"!==b&&".sv"!==b&&(e=
!0,!Ud(b)))throw Error(a+" contains an invalid key ("+b+") "+Rd(c)+'.  Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');c.push(b);Xd(a,h,c);c.pop()});if(d&&e)throw Error(a+' contains ".value" child '+Rd(c)+" in addition to actual children.");}}
function Yd(a,b){var c,d;for(c=0;c<b.length;c++){d=b[c];for(var e=d.slice(),f=0;f<e.length;f++)if((".priority"!==e[f]||f!==e.length-1)&&!Ud(e[f]))throw Error(a+"contains an invalid key ("+e[f]+") in path "+d.toString()+'. Keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]"');}b.sort(Od);e=null;for(c=0;c<b.length;c++){d=b[c];if(null!==e&&e.contains(d))throw Error(a+"contains a path "+e.toString()+" that is ancestor of another path "+d.toString());e=d}}
function Zd(a,b,c){var d=Bb(a,1,!1);if(!ha(b)||da(b))throw Error(d+" must be an object containing the children to replace.");var e=[];Ib(b,function(a,b){var k=new M(a);Xd(d,b,c.m(k));if(".priority"===Id(k)&&!Vd(b))throw Error(d+"contains an invalid value for '"+k.toString()+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");e.push(k)});Yd(d,e)}
function $d(a,b,c){if(Zc(c))throw Error(Bb(a,b,!1)+"is "+c.toString()+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!Vd(c))throw Error(Bb(a,b,!1)+"must be a valid Firebase priority (a string, finite number, server value, or null).");}
function ae(a,b,c){if(!c||p(b))switch(b){case "value":case "child_added":case "child_removed":case "child_changed":case "child_moved":break;default:throw Error(Bb(a,1,c)+'must be a valid event type: "value", "child_added", "child_removed", "child_changed", or "child_moved".');}}function be(a,b){if(p(b)&&!Ud(b))throw Error(Bb(a,2,!0)+'was an invalid key: "'+b+'".  Firebase keys must be non-empty strings and can\'t contain ".", "#", "$", "/", "[", or "]").');}
function ce(a,b){if(!q(b)||0===b.length||Td.test(b))throw Error(Bb(a,1,!1)+'was an invalid path: "'+b+'". Paths must be non-empty strings and can\'t contain ".", "#", "$", "[", or "]"');}function de(a,b){if(".info"===J(b))throw Error(a+" failed: Can't modify data under /.info/");}
function ee(a,b){var c=b.path.toString(),d;!(d=!q(b.kc.host)||0===b.kc.host.length||!Ud(b.kc.pe))&&(d=0!==c.length)&&(c&&(c=c.replace(/^\/*\.info(\/|$)/,"/")),d=!(q(c)&&0!==c.length&&!Td.test(c)));if(d)throw Error(Bb(a,1,!1)+'must be a valid firebase URL and the path can\'t contain ".", "#", "$", "[", or "]".');};function fe(){this.children={};this.ad=0;this.value=null}function ge(a,b,c){this.ud=a?a:"";this.Ha=b?b:null;this.A=c?c:new fe}function he(a,b){for(var c=b instanceof M?b:new M(b),d=a,e;null!==(e=J(c));)d=new ge(e,d,A(d.A.children,e)||new fe),c=D(c);return d}g=ge.prototype;g.Ea=function(){return this.A.value};function ie(a,b){E("undefined"!==typeof b,"Cannot set value to undefined");a.A.value=b;je(a)}g.clear=function(){this.A.value=null;this.A.children={};this.A.ad=0;je(this)};
g.kd=function(){return 0<this.A.ad};g.e=function(){return null===this.Ea()&&!this.kd()};g.P=function(a){var b=this;t(this.A.children,function(c,d){a(new ge(d,b,c))})};function ke(a,b,c,d){c&&!d&&b(a);a.P(function(a){ke(a,b,!0,d)});c&&d&&b(a)}function le(a,b){for(var c=a.parent();null!==c&&!b(c);)c=c.parent()}g.path=function(){return new M(null===this.Ha?this.ud:this.Ha.path()+"/"+this.ud)};g.name=function(){return this.ud};g.parent=function(){return this.Ha};
function je(a){if(null!==a.Ha){var b=a.Ha,c=a.ud,d=a.e(),e=Hb(b.A.children,c);d&&e?(delete b.A.children[c],b.A.ad--,je(b)):d||e||(b.A.children[c]=a.A,b.A.ad++,je(b))}};function me(a){E(da(a)&&0<a.length,"Requires a non-empty array");this.Jf=a;this.Ec={}}me.prototype.Ge=function(a,b){var c;c=this.Ec[a]||[];var d=c.length;if(0<d){for(var e=Array(d),f=0;f<d;f++)e[f]=c[f];c=e}else c=[];for(d=0;d<c.length;d++)c[d].Ke.apply(c[d].Pa,Array.prototype.slice.call(arguments,1))};me.prototype.hc=function(a,b,c){ne(this,a);this.Ec[a]=this.Ec[a]||[];this.Ec[a].push({Ke:b,Pa:c});(a=this.Xe(a))&&b.apply(c,a)};
me.prototype.Jc=function(a,b,c){ne(this,a);a=this.Ec[a]||[];for(var d=0;d<a.length;d++)if(a[d].Ke===b&&(!c||c===a[d].Pa)){a.splice(d,1);break}};function ne(a,b){E(La(a.Jf,function(a){return a===b}),"Unknown event: "+b)};function oe(a,b){this.value=a;this.children=b||pe}var pe=new Ac(function(a,b){return a===b?0:a<b?-1:1});function qe(a){var b=Q;t(a,function(a,d){b=b.set(new M(d),a)});return b}g=oe.prototype;g.e=function(){return null===this.value&&this.children.e()};function re(a,b,c){if(null!=a.value&&c(a.value))return{path:C,value:a.value};if(b.e())return null;var d=J(b);a=a.children.get(d);return null!==a?(b=re(a,D(b),c),null!=b?{path:(new M(d)).m(b.path),value:b.value}:null):null}
function se(a,b){return re(a,b,function(){return!0})}g.subtree=function(a){if(a.e())return this;var b=this.children.get(J(a));return null!==b?b.subtree(D(a)):Q};g.set=function(a,b){if(a.e())return new oe(b,this.children);var c=J(a),d=(this.children.get(c)||Q).set(D(a),b),c=this.children.Ra(c,d);return new oe(this.value,c)};
g.remove=function(a){if(a.e())return this.children.e()?Q:new oe(null,this.children);var b=J(a),c=this.children.get(b);return c?(a=c.remove(D(a)),b=a.e()?this.children.remove(b):this.children.Ra(b,a),null===this.value&&b.e()?Q:new oe(this.value,b)):this};g.get=function(a){if(a.e())return this.value;var b=this.children.get(J(a));return b?b.get(D(a)):null};
function Ld(a,b,c){if(b.e())return c;var d=J(b);b=Ld(a.children.get(d)||Q,D(b),c);d=b.e()?a.children.remove(d):a.children.Ra(d,b);return new oe(a.value,d)}function te(a,b){return ue(a,C,b)}function ue(a,b,c){var d={};a.children.ia(function(a,f){d[a]=ue(f,b.m(a),c)});return c(b,a.value,d)}function ve(a,b,c){return we(a,b,C,c)}function we(a,b,c,d){var e=a.value?d(c,a.value):!1;if(e)return e;if(b.e())return null;e=J(b);return(a=a.children.get(e))?we(a,D(b),c.m(e),d):null}
function xe(a,b,c){ye(a,b,C,c)}function ye(a,b,c,d){if(b.e())return a;a.value&&d(c,a.value);var e=J(b);return(a=a.children.get(e))?ye(a,D(b),c.m(e),d):Q}function Jd(a,b){ze(a,C,b)}function ze(a,b,c){a.children.ia(function(a,e){ze(e,b.m(a),c)});a.value&&c(b,a.value)}function Ae(a,b){a.children.ia(function(a,d){d.value&&b(a,d.value)})}var Q=new oe(null);oe.prototype.toString=function(){var a={};Jd(this,function(b,c){a[b.toString()]=c.toString()});return B(a)};function Be(a,b,c){this.type=Ad;this.source=Ce;this.path=a;this.Pb=b;this.Id=c}Be.prototype.Nc=function(a){if(this.path.e()){if(null!=this.Pb.value)return E(this.Pb.children.e(),"affectedTree should not have overlapping affected paths."),this;a=this.Pb.subtree(new M(a));return new Be(C,a,this.Id)}E(J(this.path)===a,"operationForChild called for unrelated child.");return new Be(D(this.path),this.Pb,this.Id)};
Be.prototype.toString=function(){return"Operation("+this.path+": "+this.source.toString()+" ack write revert="+this.Id+" affectedTree="+this.Pb+")"};var bc=0,ld=1,Ad=2,$b=3;function De(a,b,c,d){this.ee=a;this.Ve=b;this.Ib=c;this.Ee=d;E(!d||b,"Tagged queries must be from server.")}var Ce=new De(!0,!1,null,!1),Ee=new De(!1,!0,null,!1);De.prototype.toString=function(){return this.ee?"user":this.Ee?"server(queryID="+this.Ib+")":"server"};function Fe(){me.call(this,["visible"]);var a,b;"undefined"!==typeof document&&"undefined"!==typeof document.addEventListener&&("undefined"!==typeof document.hidden?(b="visibilitychange",a="hidden"):"undefined"!==typeof document.mozHidden?(b="mozvisibilitychange",a="mozHidden"):"undefined"!==typeof document.msHidden?(b="msvisibilitychange",a="msHidden"):"undefined"!==typeof document.webkitHidden&&(b="webkitvisibilitychange",a="webkitHidden"));this.Nb=!0;if(b){var c=this;document.addEventListener(b,
function(){var b=!document[a];b!==c.Nb&&(c.Nb=b,c.Ge("visible",b))},!1)}}ka(Fe,me);Fe.prototype.Xe=function(a){E("visible"===a,"Unknown event type: "+a);return[this.Nb]};ba(Fe);function Ge(){this.set={}}g=Ge.prototype;g.add=function(a,b){this.set[a]=null!==b?b:!0};g.contains=function(a){return Hb(this.set,a)};g.get=function(a){return this.contains(a)?this.set[a]:void 0};g.remove=function(a){delete this.set[a]};g.clear=function(){this.set={}};g.e=function(){return ua(this.set)};g.count=function(){return na(this.set)};function He(a,b){t(a.set,function(a,d){b(d,a)})}g.keys=function(){var a=[];t(this.set,function(b,c){a.push(c)});return a};function Ie(a,b){return a&&"object"===typeof a?(E(".sv"in a,"Unexpected leaf node or priority contents"),b[a[".sv"]]):a}function Je(a,b){var c=new Ke;Le(a,new M(""),function(a,e){Me(c,a,Ne(e,b))});return c}function Ne(a,b){var c=a.C().H(),c=Ie(c,b),d;if(a.J()){var e=Ie(a.Ea(),b);return e!==a.Ea()||c!==a.C().H()?new Oe(e,S(c)):a}d=a;c!==a.C().H()&&(d=d.ga(new Oe(c)));a.P(N,function(a,c){var e=Ne(c,b);e!==c&&(d=d.U(a,e))});return d};function Pe(){me.call(this,["online"]);this.ic=!0;if("undefined"!==typeof window&&"undefined"!==typeof window.addEventListener&&!Pb()){var a=this;window.addEventListener("online",function(){a.ic||(a.ic=!0,a.Ge("online",!0))},!1);window.addEventListener("offline",function(){a.ic&&(a.ic=!1,a.Ge("online",!1))},!1)}}ka(Pe,me);Pe.prototype.Xe=function(a){E("online"===a,"Unknown event type: "+a);return[this.ic]};ba(Pe);function Qe(){}var Re={};function Se(a){return r(a.compare,a)}Qe.prototype.nd=function(a,b){return 0!==this.compare(new O("[MIN_NAME]",a),new O("[MIN_NAME]",b))};Qe.prototype.Ic=function(){return Te};function Ue(a){E(!a.e()&&".priority"!==J(a),"Can't create PathIndex with empty path or .priority key");this.cc=a}ka(Ue,Qe);g=Ue.prototype;g.yc=function(a){return!a.Q(this.cc).e()};g.compare=function(a,b){var c=a.S.Q(this.cc),d=b.S.Q(this.cc),c=c.tc(d);return 0===c?ad(a.name,b.name):c};
g.Fc=function(a,b){var c=S(a),c=F.F(this.cc,c);return new O(b,c)};g.Gc=function(){var a=F.F(this.cc,Ve);return new O("[MAX_NAME]",a)};g.toString=function(){return this.cc.slice().join("/")};function We(){}ka(We,Qe);g=We.prototype;g.compare=function(a,b){var c=a.S.C(),d=b.S.C(),c=c.tc(d);return 0===c?ad(a.name,b.name):c};g.yc=function(a){return!a.C().e()};g.nd=function(a,b){return!a.C().ca(b.C())};g.Ic=function(){return Te};g.Gc=function(){return new O("[MAX_NAME]",new Oe("[PRIORITY-POST]",Ve))};
g.Fc=function(a,b){var c=S(a);return new O(b,new Oe("[PRIORITY-POST]",c))};g.toString=function(){return".priority"};var N=new We;function Xe(){}ka(Xe,Qe);g=Xe.prototype;g.compare=function(a,b){return ad(a.name,b.name)};g.yc=function(){throw Pc("KeyIndex.isDefinedOn not expected to be called.");};g.nd=function(){return!1};g.Ic=function(){return Te};g.Gc=function(){return new O("[MAX_NAME]",F)};g.Fc=function(a){E(q(a),"KeyIndex indexValue must always be a string.");return new O(a,F)};g.toString=function(){return".key"};
var Md=new Xe;function Ye(){}ka(Ye,Qe);g=Ye.prototype;g.compare=function(a,b){var c=a.S.tc(b.S);return 0===c?ad(a.name,b.name):c};g.yc=function(){return!0};g.nd=function(a,b){return!a.ca(b)};g.Ic=function(){return Te};g.Gc=function(){return Ze};g.Fc=function(a,b){var c=S(a);return new O(b,c)};g.toString=function(){return".value"};var $e=new Ye;function af(a,b){return ad(a.name,b.name)}function bf(a,b){return ad(a,b)};function cf(a,b){this.od=a;this.dc=b}cf.prototype.get=function(a){var b=A(this.od,a);if(!b)throw Error("No index defined for "+a);return b===Re?null:b};function df(a,b,c){var d=la(a.od,function(d,f){var h=A(a.dc,f);E(h,"Missing index implementation for "+f);if(d===Re){if(h.yc(b.S)){for(var k=[],m=c.Xb(ef),l=K(m);l;)l.name!=b.name&&k.push(l),l=K(m);k.push(b);return ff(k,Se(h))}return Re}h=c.get(b.name);k=d;h&&(k=k.remove(new O(b.name,h)));return k.Ra(b,b.S)});return new cf(d,a.dc)}
function gf(a,b,c){var d=la(a.od,function(a){if(a===Re)return a;var d=c.get(b.name);return d?a.remove(new O(b.name,d)):a});return new cf(d,a.dc)}var hf=new cf({".priority":Re},{".priority":N});function O(a,b){this.name=a;this.S=b}function ef(a,b){return new O(a,b)};function jf(a){this.sa=new od(a);this.g=a.g;E(a.xa,"Only valid if limit has been set");this.oa=a.oa;this.Jb=!kf(a)}g=jf.prototype;g.F=function(a,b,c,d,e,f){this.sa.matches(new O(b,c))||(c=F);return a.R(b).ca(c)?a:a.Fb()<this.oa?this.sa.Vb().F(a,b,c,d,e,f):lf(this,a,b,c,e,f)};
g.za=function(a,b,c){var d;if(b.J()||b.e())d=F.ob(this.g);else if(2*this.oa<b.Fb()&&b.zc(this.g)){d=F.ob(this.g);b=this.Jb?b.$b(this.sa.wc,this.g):b.Yb(this.sa.Uc,this.g);for(var e=0;0<b.Sa.length&&e<this.oa;){var f=K(b),h;if(h=this.Jb?0>=this.g.compare(this.sa.Uc,f):0>=this.g.compare(f,this.sa.wc))d=d.U(f.name,f.S),e++;else break}}else{d=b.ob(this.g);d=d.ga(F);var k,m,l;if(this.Jb){b=d.Ze(this.g);k=this.sa.wc;m=this.sa.Uc;var u=Se(this.g);l=function(a,b){return u(b,a)}}else b=d.Xb(this.g),k=this.sa.Uc,
m=this.sa.wc,l=Se(this.g);for(var e=0,z=!1;0<b.Sa.length;)f=K(b),!z&&0>=l(k,f)&&(z=!0),(h=z&&e<this.oa&&0>=l(f,m))?e++:d=d.U(f.name,F)}return this.sa.Vb().za(a,d,c)};g.ga=function(a){return a};g.Qa=function(){return!0};g.Vb=function(){return this.sa.Vb()};
function lf(a,b,c,d,e,f){var h;if(a.Jb){var k=Se(a.g);h=function(a,b){return k(b,a)}}else h=Se(a.g);E(b.Fb()==a.oa,"");var m=new O(c,d),l=a.Jb?mf(b,a.g):nf(b,a.g),u=a.sa.matches(m);if(b.Fa(c)){for(var z=b.R(c),l=e.fe(a.g,l,a.Jb);null!=l&&(l.name==c||b.Fa(l.name));)l=e.fe(a.g,l,a.Jb);e=null==l?1:h(l,m);if(u&&!d.e()&&0<=e)return null!=f&&nd(f,new H("child_changed",d,c,z)),b.U(c,d);null!=f&&nd(f,new H("child_removed",z,c));b=b.U(c,F);return null!=l&&a.sa.matches(l)?(null!=f&&nd(f,new H("child_added",
l.S,l.name)),b.U(l.name,l.S)):b}return d.e()?b:u&&0<=h(l,m)?(null!=f&&(nd(f,new H("child_removed",l.S,l.name)),nd(f,new H("child_added",d,c))),b.U(c,d).U(l.name,F)):b};function of(a){this.W=a;this.g=a.n.g}function pf(a,b,c,d){var e=[],f=[];Ga(b,function(b){"child_changed"===b.type&&a.g.nd(b.qe,b.Ma)&&f.push(new H("child_moved",b.Ma,b.Za))});qf(a,e,"child_removed",b,d,c);qf(a,e,"child_added",b,d,c);qf(a,e,"child_moved",f,d,c);qf(a,e,"child_changed",b,d,c);qf(a,e,hc,b,d,c);return e}function qf(a,b,c,d,e,f){d=Ha(d,function(a){return a.type===c});Pa(d,r(a.Nf,a));Ga(d,function(c){var d=rf(a,c,f);Ga(e,function(e){e.sf(c.type)&&b.push(e.createEvent(d,a.W))})})}
function rf(a,b,c){"value"!==b.type&&"child_removed"!==b.type&&(b.Dd=c.Ye(b.Za,b.Ma,a.g));return b}of.prototype.Nf=function(a,b){if(null==a.Za||null==b.Za)throw Pc("Should only compare child_ events.");return this.g.compare(new O(a.Za,a.Ma),new O(b.Za,b.Ma))};function sf(){this.Sb=this.na=this.Lb=this.ka=this.xa=!1;this.oa=0;this.oc="";this.ec=null;this.Ab="";this.bc=null;this.yb="";this.g=N}var tf=new sf;function kf(a){return""===a.oc?a.ka:"l"===a.oc}function qd(a){E(a.ka,"Only valid if start has been set");return a.ec}function pd(a){E(a.ka,"Only valid if start has been set");return a.Lb?a.Ab:"[MIN_NAME]"}function sd(a){E(a.na,"Only valid if end has been set");return a.bc}
function rd(a){E(a.na,"Only valid if end has been set");return a.Sb?a.yb:"[MAX_NAME]"}function uf(a){var b=new sf;b.xa=a.xa;b.oa=a.oa;b.ka=a.ka;b.ec=a.ec;b.Lb=a.Lb;b.Ab=a.Ab;b.na=a.na;b.bc=a.bc;b.Sb=a.Sb;b.yb=a.yb;b.g=a.g;return b}g=sf.prototype;g.ne=function(a){var b=uf(this);b.xa=!0;b.oa=a;b.oc="l";return b};g.oe=function(a){var b=uf(this);b.xa=!0;b.oa=a;b.oc="r";return b};g.Nd=function(a,b){var c=uf(this);c.ka=!0;p(a)||(a=null);c.ec=a;null!=b?(c.Lb=!0,c.Ab=b):(c.Lb=!1,c.Ab="");return c};
g.fd=function(a,b){var c=uf(this);c.na=!0;p(a)||(a=null);c.bc=a;p(b)?(c.Sb=!0,c.yb=b):(c.Eg=!1,c.yb="");return c};function vf(a,b){var c=uf(a);c.g=b;return c}function wf(a){var b={};a.ka&&(b.sp=a.ec,a.Lb&&(b.sn=a.Ab));a.na&&(b.ep=a.bc,a.Sb&&(b.en=a.yb));if(a.xa){b.l=a.oa;var c=a.oc;""===c&&(c=kf(a)?"l":"r");b.vf=c}a.g!==N&&(b.i=a.g.toString());return b}function T(a){return!(a.ka||a.na||a.xa)}function xf(a){return T(a)&&a.g==N}
function yf(a){var b={};if(xf(a))return b;var c;a.g===N?c="$priority":a.g===$e?c="$value":a.g===Md?c="$key":(E(a.g instanceof Ue,"Unrecognized index type!"),c=a.g.toString());b.orderBy=B(c);a.ka&&(b.startAt=B(a.ec),a.Lb&&(b.startAt+=","+B(a.Ab)));a.na&&(b.endAt=B(a.bc),a.Sb&&(b.endAt+=","+B(a.yb)));a.xa&&(kf(a)?b.limitToFirst=a.oa:b.limitToLast=a.oa);return b}g.toString=function(){return B(wf(this))};function Oe(a,b){this.B=a;E(p(this.B)&&null!==this.B,"LeafNode shouldn't be created with null/undefined value.");this.aa=b||F;zf(this.aa);this.Eb=null}var Af=["object","boolean","number","string"];g=Oe.prototype;g.J=function(){return!0};g.C=function(){return this.aa};g.ga=function(a){return new Oe(this.B,a)};g.R=function(a){return".priority"===a?this.aa:F};g.Q=function(a){return a.e()?this:".priority"===J(a)?this.aa:F};g.Fa=function(){return!1};g.Ye=function(){return null};
g.U=function(a,b){return".priority"===a?this.ga(b):b.e()&&".priority"!==a?this:F.U(a,b).ga(this.aa)};g.F=function(a,b){var c=J(a);if(null===c)return b;if(b.e()&&".priority"!==c)return this;E(".priority"!==c||1===Hd(a),".priority must be the last token in a path");return this.U(c,F.F(D(a),b))};g.e=function(){return!1};g.Fb=function(){return 0};g.P=function(){return!1};g.H=function(a){return a&&!this.C().e()?{".value":this.Ea(),".priority":this.C().H()}:this.Ea()};
g.hash=function(){if(null===this.Eb){var a="";this.aa.e()||(a+="priority:"+Bf(this.aa.H())+":");var b=typeof this.B,a=a+(b+":"),a="number"===b?a+gd(this.B):a+this.B;this.Eb=Rc(a)}return this.Eb};g.Ea=function(){return this.B};g.tc=function(a){if(a===F)return 1;if(a instanceof P)return-1;E(a.J(),"Unknown node type");var b=typeof a.B,c=typeof this.B,d=Fa(Af,b),e=Fa(Af,c);E(0<=d,"Unknown leaf type: "+b);E(0<=e,"Unknown leaf type: "+c);return d===e?"object"===c?0:this.B<a.B?-1:this.B===a.B?0:1:e-d};
g.ob=function(){return this};g.zc=function(){return!0};g.ca=function(a){return a===this?!0:a.J()?this.B===a.B&&this.aa.ca(a.aa):!1};g.toString=function(){return B(this.H(!0))};function P(a,b,c){this.k=a;(this.aa=b)&&zf(this.aa);a.e()&&E(!this.aa||this.aa.e(),"An empty node cannot have a priority");this.zb=c;this.Eb=null}g=P.prototype;g.J=function(){return!1};g.C=function(){return this.aa||F};g.ga=function(a){return this.k.e()?this:new P(this.k,a,this.zb)};g.R=function(a){if(".priority"===a)return this.C();a=this.k.get(a);return null===a?F:a};g.Q=function(a){var b=J(a);return null===b?this:this.R(b).Q(D(a))};g.Fa=function(a){return null!==this.k.get(a)};
g.U=function(a,b){E(b,"We should always be passing snapshot nodes");if(".priority"===a)return this.ga(b);var c=new O(a,b),d,e;b.e()?(d=this.k.remove(a),c=gf(this.zb,c,this.k)):(d=this.k.Ra(a,b),c=df(this.zb,c,this.k));e=d.e()?F:this.aa;return new P(d,e,c)};g.F=function(a,b){var c=J(a);if(null===c)return b;E(".priority"!==J(a)||1===Hd(a),".priority must be the last token in a path");var d=this.R(c).F(D(a),b);return this.U(c,d)};g.e=function(){return this.k.e()};g.Fb=function(){return this.k.count()};
var Cf=/^(0|[1-9]\d*)$/;g=P.prototype;g.H=function(a){if(this.e())return null;var b={},c=0,d=0,e=!0;this.P(N,function(f,h){b[f]=h.H(a);c++;e&&Cf.test(f)?d=Math.max(d,Number(f)):e=!1});if(!a&&e&&d<2*c){var f=[],h;for(h in b)f[h]=b[h];return f}a&&!this.C().e()&&(b[".priority"]=this.C().H());return b};g.hash=function(){if(null===this.Eb){var a="";this.C().e()||(a+="priority:"+Bf(this.C().H())+":");this.P(N,function(b,c){var d=c.hash();""!==d&&(a+=":"+b+":"+d)});this.Eb=""===a?"":Rc(a)}return this.Eb};
g.Ye=function(a,b,c){return(c=Df(this,c))?(a=Cc(c,new O(a,b)))?a.name:null:Cc(this.k,a)};function mf(a,b){var c;c=(c=Df(a,b))?(c=c.Hc())&&c.name:a.k.Hc();return c?new O(c,a.k.get(c)):null}function nf(a,b){var c;c=(c=Df(a,b))?(c=c.fc())&&c.name:a.k.fc();return c?new O(c,a.k.get(c)):null}g.P=function(a,b){var c=Df(this,a);return c?c.ia(function(a){return b(a.name,a.S)}):this.k.ia(b)};g.Xb=function(a){return this.Yb(a.Ic(),a)};
g.Yb=function(a,b){var c=Df(this,b);if(c)return c.Yb(a,function(a){return a});for(var c=this.k.Yb(a.name,ef),d=Ec(c);null!=d&&0>b.compare(d,a);)K(c),d=Ec(c);return c};g.Ze=function(a){return this.$b(a.Gc(),a)};g.$b=function(a,b){var c=Df(this,b);if(c)return c.$b(a,function(a){return a});for(var c=this.k.$b(a.name,ef),d=Ec(c);null!=d&&0<b.compare(d,a);)K(c),d=Ec(c);return c};g.tc=function(a){return this.e()?a.e()?0:-1:a.J()||a.e()?1:a===Ve?-1:0};
g.ob=function(a){if(a===Md||ra(this.zb.dc,a.toString()))return this;var b=this.zb,c=this.k;E(a!==Md,"KeyIndex always exists and isn't meant to be added to the IndexMap.");for(var d=[],e=!1,c=c.Xb(ef),f=K(c);f;)e=e||a.yc(f.S),d.push(f),f=K(c);d=e?ff(d,Se(a)):Re;e=a.toString();c=va(b.dc);c[e]=a;a=va(b.od);a[e]=d;return new P(this.k,this.aa,new cf(a,c))};g.zc=function(a){return a===Md||ra(this.zb.dc,a.toString())};
g.ca=function(a){if(a===this)return!0;if(a.J())return!1;if(this.C().ca(a.C())&&this.k.count()===a.k.count()){var b=this.Xb(N);a=a.Xb(N);for(var c=K(b),d=K(a);c&&d;){if(c.name!==d.name||!c.S.ca(d.S))return!1;c=K(b);d=K(a)}return null===c&&null===d}return!1};function Df(a,b){return b===Md?null:a.zb.get(b.toString())}g.toString=function(){return B(this.H(!0))};function S(a,b){if(null===a)return F;var c=null;"object"===typeof a&&".priority"in a?c=a[".priority"]:"undefined"!==typeof b&&(c=b);E(null===c||"string"===typeof c||"number"===typeof c||"object"===typeof c&&".sv"in c,"Invalid priority type found: "+typeof c);"object"===typeof a&&".value"in a&&null!==a[".value"]&&(a=a[".value"]);if("object"!==typeof a||".sv"in a)return new Oe(a,S(c));if(a instanceof Array){var d=F,e=a;t(e,function(a,b){if(Hb(e,b)&&"."!==b.substring(0,1)){var c=S(a);if(c.J()||!c.e())d=
d.U(b,c)}});return d.ga(S(c))}var f=[],h=!1,k=a;Ib(k,function(a){if("string"!==typeof a||"."!==a.substring(0,1)){var b=S(k[a]);b.e()||(h=h||!b.C().e(),f.push(new O(a,b)))}});if(0==f.length)return F;var m=ff(f,af,function(a){return a.name},bf);if(h){var l=ff(f,Se(N));return new P(m,S(c),new cf({".priority":l},{".priority":N}))}return new P(m,S(c),hf)}var Ef=Math.log(2);
function Ff(a){this.count=parseInt(Math.log(a+1)/Ef,10);this.Qe=this.count-1;this.Kf=a+1&parseInt(Array(this.count+1).join("1"),2)}function Gf(a){var b=!(a.Kf&1<<a.Qe);a.Qe--;return b}
function ff(a,b,c,d){function e(b,d){var f=d-b;if(0==f)return null;if(1==f){var l=a[b],u=c?c(l):l;return new Fc(u,l.S,!1,null,null)}var l=parseInt(f/2,10)+b,f=e(b,l),z=e(l+1,d),l=a[l],u=c?c(l):l;return new Fc(u,l.S,!1,f,z)}a.sort(b);var f=function(b){function d(b,h){var k=u-b,z=u;u-=b;var z=e(k+1,z),k=a[k],G=c?c(k):k,z=new Fc(G,k.S,h,null,z);f?f.left=z:l=z;f=z}for(var f=null,l=null,u=a.length,z=0;z<b.count;++z){var G=Gf(b),Bd=Math.pow(2,b.count-(z+1));G?d(Bd,!1):(d(Bd,!1),d(Bd,!0))}return l}(new Ff(a.length));
return null!==f?new Ac(d||b,f):new Ac(d||b)}function Bf(a){return"number"===typeof a?"number:"+gd(a):"string:"+a}function zf(a){if(a.J()){var b=a.H();E("string"===typeof b||"number"===typeof b||"object"===typeof b&&Hb(b,".sv"),"Priority must be a string or number.")}else E(a===Ve||a.e(),"priority of unexpected type.");E(a===Ve||a.C().e(),"Priority nodes can't have a priority of their own.")}var F=new P(new Ac(bf),null,hf);function Hf(){P.call(this,new Ac(bf),F,hf)}ka(Hf,P);g=Hf.prototype;
g.tc=function(a){return a===this?0:1};g.ca=function(a){return a===this};g.C=function(){return this};g.R=function(){return F};g.e=function(){return!1};var Ve=new Hf,Te=new O("[MIN_NAME]",F),Ze=new O("[MAX_NAME]",Ve);function Fd(a,b){this.O=a;this.Ld=b}function Cd(a,b,c,d){return new Fd(new oc(b,c,d),a.Ld)}function Gd(a){return a.O.ea?a.O.j():null}Fd.prototype.u=function(){return this.Ld};function pc(a){return a.Ld.ea?a.Ld.j():null};function If(a,b){this.W=a;var c=a.n,d=new md(c.g),c=T(c)?new md(c.g):c.xa?new jf(c):new od(c);this.nf=new vd(c);var e=b.u(),f=b.O,h=d.za(F,e.j(),null),k=c.za(F,f.j(),null);this.Na=new Fd(new oc(k,f.ea,c.Qa()),new oc(h,e.ea,d.Qa()));this.ab=[];this.Rf=new of(a)}function Jf(a){return a.W}g=If.prototype;g.u=function(){return this.Na.u().j()};g.jb=function(a){var b=pc(this.Na);return b&&(T(this.W.n)||!a.e()&&!b.R(J(a)).e())?b.Q(a):null};g.e=function(){return 0===this.ab.length};g.Ob=function(a){this.ab.push(a)};
g.mb=function(a,b){var c=[];if(b){E(null==a,"A cancel should cancel all event registrations.");var d=this.W.path;Ga(this.ab,function(a){(a=a.Oe(b,d))&&c.push(a)})}if(a){for(var e=[],f=0;f<this.ab.length;++f){var h=this.ab[f];if(!h.matches(a))e.push(h);else if(a.$e()){e=e.concat(this.ab.slice(f+1));break}}this.ab=e}else this.ab=[];return c};
g.gb=function(a,b,c){a.type===ld&&null!==a.source.Ib&&(E(pc(this.Na),"We should always have a full cache before handling merges"),E(Gd(this.Na),"Missing event cache, even though we have a server cache"));var d=this.Na;a=this.nf.gb(d,a,b,c);b=this.nf;c=a.Sd;E(c.O.j().zc(b.V.g),"Event snap not indexed");E(c.u().j().zc(b.V.g),"Server snap not indexed");E(xc(a.Sd.u())||!xc(d.u()),"Once a server snap is complete, it should never go back");this.Na=a.Sd;return Kf(this,a.Lf,a.Sd.O.j(),null)};
function Lf(a,b){var c=a.Na.O,d=[];c.j().J()||c.j().P(N,function(a,b){d.push(new H("child_added",b,a))});c.ea&&d.push(gc(c.j()));return Kf(a,d,c.j(),b)}function Kf(a,b,c,d){return pf(a.Rf,b,c,d?[d]:a.ab)};function Mf(a,b,c){this.f=Vc("p:rest:");this.M=a;this.Hb=b;this.Vd=c;this.$={}}function Nf(a,b){if(p(b))return"tag$"+b;E(xf(a.n),"should have a tag if it's not a default query.");return a.path.toString()}g=Mf.prototype;
g.cf=function(a,b,c,d){var e=a.path.toString();this.f("Listen called for "+e+" "+a.ya());var f=Nf(a,c),h={};this.$[f]=h;a=yf(a.n);var k=this;Of(this,e+".json",a,function(a,b){var u=b;404===a&&(a=u=null);null===a&&k.Hb(e,u,!1,c);A(k.$,f)===h&&d(a?401==a?"permission_denied":"rest_error:"+a:"ok",null)})};g.Df=function(a,b){var c=Nf(a,b);delete this.$[c]};g.pf=function(){};g.re=function(){};g.ff=function(){};g.xd=function(){};g.put=function(){};g.df=function(){};g.ye=function(){};
function Of(a,b,c,d){c=c||{};c.format="export";a.Vd.getToken(!1).then(function(e){(e=e&&e.accessToken)&&(c.auth=e);var f=(a.M.Sc?"https://":"http://")+a.M.host+b+"?"+Jb(c);a.f("Sending REST request for "+f);var h=new XMLHttpRequest;h.onreadystatechange=function(){if(d&&4===h.readyState){a.f("REST Response for "+f+" received. status:",h.status,"response:",h.responseText);var b=null;if(200<=h.status&&300>h.status){try{b=Kb(h.responseText)}catch(c){L("Failed to parse JSON response for "+f+": "+h.responseText)}d(null,
b)}else 401!==h.status&&404!==h.status&&L("Got unsuccessful REST response for "+f+" Status: "+h.status),d(h.status);d=null}};h.open("GET",f,!0);h.send()})};function Pf(a){this.He=a}Pf.prototype.getToken=function(a){return this.He.INTERNAL.getToken(a).then(null,function(a){return a&&"auth/token-not-initialized"===a.code?(I("Got auth/token-not-initialized error.  Treating as null token."),null):Promise.reject(a)})};function Qf(a,b){a.He.INTERNAL.addAuthTokenListener(b)};function Rf(a){this.Mf=a;this.rd=null}Rf.prototype.get=function(){var a=this.Mf.get(),b=va(a);if(this.rd)for(var c in this.rd)b[c]-=this.rd[c];this.rd=a;return b};function Sf(){this.uc={}}function Tf(a,b,c){p(c)||(c=1);Hb(a.uc,b)||(a.uc[b]=0);a.uc[b]+=c}Sf.prototype.get=function(){return va(this.uc)};function Uf(a,b){this.yf={};this.Vc=new Rf(a);this.va=b;var c=1E4+2E4*Math.random();setTimeout(r(this.qf,this),Math.floor(c))}Uf.prototype.qf=function(){var a=this.Vc.get(),b={},c=!1,d;for(d in a)0<a[d]&&Hb(this.yf,d)&&(b[d]=a[d],c=!0);c&&this.va.ye(b);setTimeout(r(this.qf,this),Math.floor(6E5*Math.random()))};var Vf={},Wf={};function Xf(a){a=a.toString();Vf[a]||(Vf[a]=new Sf);return Vf[a]}function Yf(a,b){var c=a.toString();Wf[c]||(Wf[c]=b());return Wf[c]};var Zf=null;"undefined"!==typeof MozWebSocket?Zf=MozWebSocket:"undefined"!==typeof WebSocket&&(Zf=WebSocket);function $f(a,b,c,d){this.Zd=a;this.f=Vc(this.Zd);this.frames=this.Ac=null;this.qb=this.rb=this.Fe=0;this.Xa=Xf(b);a={v:"5"};"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");c&&(a.s=c);d&&(a.ls=d);this.Me=ec(b,"websocket",a)}var ag;
$f.prototype.open=function(a,b){this.kb=b;this.gg=a;this.f("Websocket connecting to "+this.Me);this.xc=!1;Xb.set("previous_websocket_failure",!0);try{this.La=new Zf(this.Me)}catch(c){this.f("Error instantiating WebSocket.");var d=c.message||c.data;d&&this.f(d);this.fb();return}var e=this;this.La.onopen=function(){e.f("Websocket connected.");e.xc=!0};this.La.onclose=function(){e.f("Websocket connection was disconnected.");e.La=null;e.fb()};this.La.onmessage=function(a){if(null!==e.La)if(a=a.data,e.qb+=
a.length,Tf(e.Xa,"bytes_received",a.length),bg(e),null!==e.frames)cg(e,a);else{a:{E(null===e.frames,"We already have a frame buffer");if(6>=a.length){var b=Number(a);if(!isNaN(b)){e.Fe=b;e.frames=[];a=null;break a}}e.Fe=1;e.frames=[]}null!==a&&cg(e,a)}};this.La.onerror=function(a){e.f("WebSocket error.  Closing connection.");(a=a.message||a.data)&&e.f(a);e.fb()}};$f.prototype.start=function(){};
$f.isAvailable=function(){var a=!1;if("undefined"!==typeof navigator&&navigator.userAgent){var b=navigator.userAgent.match(/Android ([0-9]{0,}\.[0-9]{0,})/);b&&1<b.length&&4.4>parseFloat(b[1])&&(a=!0)}return!a&&null!==Zf&&!ag};$f.responsesRequiredToBeHealthy=2;$f.healthyTimeout=3E4;g=$f.prototype;g.sd=function(){Xb.remove("previous_websocket_failure")};function cg(a,b){a.frames.push(b);if(a.frames.length==a.Fe){var c=a.frames.join("");a.frames=null;c=Kb(c);a.gg(c)}}
g.send=function(a){bg(this);a=B(a);this.rb+=a.length;Tf(this.Xa,"bytes_sent",a.length);a=ed(a,16384);1<a.length&&dg(this,String(a.length));for(var b=0;b<a.length;b++)dg(this,a[b])};g.Tc=function(){this.Bb=!0;this.Ac&&(clearInterval(this.Ac),this.Ac=null);this.La&&(this.La.close(),this.La=null)};g.fb=function(){this.Bb||(this.f("WebSocket is closing itself"),this.Tc(),this.kb&&(this.kb(this.xc),this.kb=null))};g.close=function(){this.Bb||(this.f("WebSocket is being closed"),this.Tc())};
function bg(a){clearInterval(a.Ac);a.Ac=setInterval(function(){a.La&&dg(a,"0");bg(a)},Math.floor(45E3))}function dg(a,b){try{a.La.send(b)}catch(c){a.f("Exception thrown from WebSocket.send():",c.message||c.data,"Closing connection."),setTimeout(r(a.fb,a),0)}};function eg(a,b,c,d){this.Zd=a;this.f=Vc(a);this.kc=b;this.qb=this.rb=0;this.Xa=Xf(b);this.Af=c;this.xc=!1;this.Db=d;this.Yc=function(a){return ec(b,"long_polling",a)}}var fg,gg;
eg.prototype.open=function(a,b){this.Pe=0;this.ja=b;this.ef=new Qb(a);this.Bb=!1;var c=this;this.tb=setTimeout(function(){c.f("Timed out trying to connect.");c.fb();c.tb=null},Math.floor(3E4));$c(function(){if(!c.Bb){c.Wa=new hg(function(a,b,d,k,m){ig(c,arguments);if(c.Wa)if(c.tb&&(clearTimeout(c.tb),c.tb=null),c.xc=!0,"start"==a)c.id=b,c.lf=d;else if("close"===a)b?(c.Wa.Kd=!1,Rb(c.ef,b,function(){c.fb()})):c.fb();else throw Error("Unrecognized command received: "+a);},function(a,b){ig(c,arguments);
Sb(c.ef,a,b)},function(){c.fb()},c.Yc);var a={start:"t"};a.ser=Math.floor(1E8*Math.random());c.Wa.Qd&&(a.cb=c.Wa.Qd);a.v="5";c.Af&&(a.s=c.Af);c.Db&&(a.ls=c.Db);"undefined"!==typeof location&&location.href&&-1!==location.href.indexOf("firebaseio.com")&&(a.r="f");a=c.Yc(a);c.f("Connecting via long-poll to "+a);jg(c.Wa,a,function(){})}})};
eg.prototype.start=function(){var a=this.Wa,b=this.lf;a.eg=this.id;a.fg=b;for(a.Ud=!0;kg(a););a=this.id;b=this.lf;this.gc=document.createElement("iframe");var c={dframe:"t"};c.id=a;c.pw=b;this.gc.src=this.Yc(c);this.gc.style.display="none";document.body.appendChild(this.gc)};
eg.isAvailable=function(){return fg||!gg&&"undefined"!==typeof document&&null!=document.createElement&&!("object"===typeof window&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))&&!("object"===typeof Windows&&"object"===typeof Windows.Bg)&&!0};g=eg.prototype;g.sd=function(){};g.Tc=function(){this.Bb=!0;this.Wa&&(this.Wa.close(),this.Wa=null);this.gc&&(document.body.removeChild(this.gc),this.gc=null);this.tb&&(clearTimeout(this.tb),this.tb=null)};
g.fb=function(){this.Bb||(this.f("Longpoll is closing itself"),this.Tc(),this.ja&&(this.ja(this.xc),this.ja=null))};g.close=function(){this.Bb||(this.f("Longpoll is being closed."),this.Tc())};g.send=function(a){a=B(a);this.rb+=a.length;Tf(this.Xa,"bytes_sent",a.length);a=Nb(a);a=wb(a,!0);a=ed(a,1840);for(var b=0;b<a.length;b++){var c=this.Wa;c.Qc.push({tg:this.Pe,zg:a.length,Re:a[b]});c.Ud&&kg(c);this.Pe++}};function ig(a,b){var c=B(b).length;a.qb+=c;Tf(a.Xa,"bytes_received",c)}
function hg(a,b,c,d){this.Yc=d;this.kb=c;this.ve=new Ge;this.Qc=[];this.$d=Math.floor(1E8*Math.random());this.Kd=!0;this.Qd=Oc();window["pLPCommand"+this.Qd]=a;window["pRTLPCB"+this.Qd]=b;a=document.createElement("iframe");a.style.display="none";if(document.body){document.body.appendChild(a);try{a.contentWindow.document||I("No IE domain setting required")}catch(e){a.src="javascript:void((function(){document.open();document.domain='"+document.domain+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";
a.contentDocument?a.ib=a.contentDocument:a.contentWindow?a.ib=a.contentWindow.document:a.document&&(a.ib=a.document);this.Ga=a;a="";this.Ga.src&&"javascript:"===this.Ga.src.substr(0,11)&&(a='<script>document.domain="'+document.domain+'";\x3c/script>');a="<html><body>"+a+"</body></html>";try{this.Ga.ib.open(),this.Ga.ib.write(a),this.Ga.ib.close()}catch(f){I("frame writing exception"),f.stack&&I(f.stack),I(f)}}
hg.prototype.close=function(){this.Ud=!1;if(this.Ga){this.Ga.ib.body.innerHTML="";var a=this;setTimeout(function(){null!==a.Ga&&(document.body.removeChild(a.Ga),a.Ga=null)},Math.floor(0))}var b=this.kb;b&&(this.kb=null,b())};
function kg(a){if(a.Ud&&a.Kd&&a.ve.count()<(0<a.Qc.length?2:1)){a.$d++;var b={};b.id=a.eg;b.pw=a.fg;b.ser=a.$d;for(var b=a.Yc(b),c="",d=0;0<a.Qc.length;)if(1870>=a.Qc[0].Re.length+30+c.length){var e=a.Qc.shift(),c=c+"&seg"+d+"="+e.tg+"&ts"+d+"="+e.zg+"&d"+d+"="+e.Re;d++}else break;lg(a,b+c,a.$d);return!0}return!1}function lg(a,b,c){function d(){a.ve.remove(c);kg(a)}a.ve.add(c,1);var e=setTimeout(d,Math.floor(25E3));jg(a,b,function(){clearTimeout(e);d()})}
function jg(a,b,c){setTimeout(function(){try{if(a.Kd){var d=a.Ga.ib.createElement("script");d.type="text/javascript";d.async=!0;d.src=b;d.onload=d.onreadystatechange=function(){var a=d.readyState;a&&"loaded"!==a&&"complete"!==a||(d.onload=d.onreadystatechange=null,d.parentNode&&d.parentNode.removeChild(d),c())};d.onerror=function(){I("Long-poll script failed to load: "+b);a.Kd=!1;a.close()};a.Ga.ib.body.appendChild(d)}}catch(e){}},Math.floor(1))};function mg(a){ng(this,a)}var og=[eg,$f];function ng(a,b){var c=$f&&$f.isAvailable(),d=c&&!(Xb.bf||!0===Xb.get("previous_websocket_failure"));b.Ag&&(c||L("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),d=!0);if(d)a.Wc=[$f];else{var e=a.Wc=[];fd(og,function(a,b){b&&b.isAvailable()&&e.push(b)})}}function pg(a){if(0<a.Wc.length)return a.Wc[0];throw Error("No transports available");};function qg(a,b,c,d,e,f,h){this.id=a;this.f=Vc("c:"+this.id+":");this.te=c;this.Mc=d;this.ja=e;this.se=f;this.M=b;this.Ad=[];this.Ne=0;this.zf=new mg(b);this.L=0;this.Db=h;this.f("Connection created");rg(this)}
function rg(a){var b=pg(a.zf);a.I=new b("c:"+a.id+":"+a.Ne++,a.M,void 0,a.Db);a.xe=b.responsesRequiredToBeHealthy||0;var c=sg(a,a.I),d=tg(a,a.I);a.Xc=a.I;a.Rc=a.I;a.D=null;a.Cb=!1;setTimeout(function(){a.I&&a.I.open(c,d)},Math.floor(0));b=b.healthyTimeout||0;0<b&&(a.md=setTimeout(function(){a.md=null;a.Cb||(a.I&&102400<a.I.qb?(a.f("Connection exceeded healthy timeout but has received "+a.I.qb+" bytes.  Marking connection healthy."),a.Cb=!0,a.I.sd()):a.I&&10240<a.I.rb?a.f("Connection exceeded healthy timeout but has sent "+
a.I.rb+" bytes.  Leaving connection alive."):(a.f("Closing unhealthy connection after timeout."),a.close()))},Math.floor(b)))}function tg(a,b){return function(c){b===a.I?(a.I=null,c||0!==a.L?1===a.L&&a.f("Realtime connection lost."):(a.f("Realtime connection failed."),"s-"===a.M.bb.substr(0,2)&&(Xb.remove("host:"+a.M.host),a.M.bb=a.M.host)),a.close()):b===a.D?(a.f("Secondary connection lost."),c=a.D,a.D=null,a.Xc!==c&&a.Rc!==c||a.close()):a.f("closing an old connection")}}
function sg(a,b){return function(c){if(2!=a.L)if(b===a.Rc){var d=cd("t",c);c=cd("d",c);if("c"==d){if(d=cd("t",c),"d"in c)if(c=c.d,"h"===d){var d=c.ts,e=c.v,f=c.h;a.xf=c.s;dc(a.M,f);0==a.L&&(a.I.start(),ug(a,a.I,d),"5"!==e&&L("Protocol version mismatch detected"),c=a.zf,(c=1<c.Wc.length?c.Wc[1]:null)&&vg(a,c))}else if("n"===d){a.f("recvd end transmission on primary");a.Rc=a.D;for(c=0;c<a.Ad.length;++c)a.wd(a.Ad[c]);a.Ad=[];wg(a)}else"s"===d?(a.f("Connection shutdown command received. Shutting down..."),
a.se&&(a.se(c),a.se=null),a.ja=null,a.close()):"r"===d?(a.f("Reset packet received.  New host: "+c),dc(a.M,c),1===a.L?a.close():(xg(a),rg(a))):"e"===d?Wc("Server Error: "+c):"o"===d?(a.f("got pong on primary."),yg(a),zg(a)):Wc("Unknown control packet command: "+d)}else"d"==d&&a.wd(c)}else if(b===a.D)if(d=cd("t",c),c=cd("d",c),"c"==d)"t"in c&&(c=c.t,"a"===c?Ag(a):"r"===c?(a.f("Got a reset on secondary, closing it"),a.D.close(),a.Xc!==a.D&&a.Rc!==a.D||a.close()):"o"===c&&(a.f("got pong on secondary."),
a.wf--,Ag(a)));else if("d"==d)a.Ad.push(c);else throw Error("Unknown protocol layer: "+d);else a.f("message on old connection")}}qg.prototype.ua=function(a){Bg(this,{t:"d",d:a})};function wg(a){a.Xc===a.D&&a.Rc===a.D&&(a.f("cleaning up and promoting a connection: "+a.D.Zd),a.I=a.D,a.D=null)}
function Ag(a){0>=a.wf?(a.f("Secondary connection is healthy."),a.Cb=!0,a.D.sd(),a.D.start(),a.f("sending client ack on secondary"),a.D.send({t:"c",d:{t:"a",d:{}}}),a.f("Ending transmission on primary"),a.I.send({t:"c",d:{t:"n",d:{}}}),a.Xc=a.D,wg(a)):(a.f("sending ping on secondary."),a.D.send({t:"c",d:{t:"p",d:{}}}))}qg.prototype.wd=function(a){yg(this);this.te(a)};function yg(a){a.Cb||(a.xe--,0>=a.xe&&(a.f("Primary connection is healthy."),a.Cb=!0,a.I.sd()))}
function vg(a,b){a.D=new b("c:"+a.id+":"+a.Ne++,a.M,a.xf);a.wf=b.responsesRequiredToBeHealthy||0;a.D.open(sg(a,a.D),tg(a,a.D));setTimeout(function(){a.D&&(a.f("Timed out trying to upgrade."),a.D.close())},Math.floor(6E4))}function ug(a,b,c){a.f("Realtime connection established.");a.I=b;a.L=1;a.Mc&&(a.Mc(c,a.xf),a.Mc=null);0===a.xe?(a.f("Primary connection is healthy."),a.Cb=!0):setTimeout(function(){zg(a)},Math.floor(5E3))}
function zg(a){a.Cb||1!==a.L||(a.f("sending ping on primary."),Bg(a,{t:"c",d:{t:"p",d:{}}}))}function Bg(a,b){if(1!==a.L)throw"Connection is not connected";a.Xc.send(b)}qg.prototype.close=function(){2!==this.L&&(this.f("Closing realtime connection."),this.L=2,xg(this),this.ja&&(this.ja(),this.ja=null))};function xg(a){a.f("Shutting down all connections");a.I&&(a.I.close(),a.I=null);a.D&&(a.D.close(),a.D=null);a.md&&(clearTimeout(a.md),a.md=null)};function Cg(a,b,c,d,e,f){this.id=Dg++;this.f=Vc("p:"+this.id+":");this.qd={};this.$={};this.pa=[];this.Pc=0;this.Lc=[];this.ma=!1;this.Va=1E3;this.td=3E5;this.Hb=b;this.Kc=c;this.ue=d;this.M=a;this.pb=this.Ia=this.Db=this.ze=null;this.Vd=e;this.de=!1;this.ke=0;if(f)throw Error("Auth override specified in options, but not supported on non Node.js platforms");this.Je=f||null;this.vb=null;this.Nb=!1;this.Gd={};this.sg=0;this.Ue=!0;this.Bc=this.me=null;Eg(this,0);Fe.Wb().hc("visible",this.ig,this);-1===
a.host.indexOf("fblocal")&&Pe.Wb().hc("online",this.hg,this)}var Dg=0,Fg=0;g=Cg.prototype;g.ua=function(a,b,c){var d=++this.sg;a={r:d,a:a,b:b};this.f(B(a));E(this.ma,"sendRequest call when we're not connected not allowed.");this.Ia.ua(a);c&&(this.Gd[d]=c)};
g.cf=function(a,b,c,d){var e=a.ya(),f=a.path.toString();this.f("Listen called for "+f+" "+e);this.$[f]=this.$[f]||{};E(xf(a.n)||!T(a.n),"listen() called for non-default but complete query");E(!this.$[f][e],"listen() called twice for same path/queryId.");a={G:d,ld:b,og:a,tag:c};this.$[f][e]=a;this.ma&&Gg(this,a)};
function Gg(a,b){var c=b.og,d=c.path.toString(),e=c.ya();a.f("Listen on "+d+" for "+e);var f={p:d};b.tag&&(f.q=wf(c.n),f.t=b.tag);f.h=b.ld();a.ua("q",f,function(f){var k=f.d,m=f.s;if(k&&"object"===typeof k&&Hb(k,"w")){var l=A(k,"w");da(l)&&0<=Fa(l,"no_index")&&L("Using an unspecified index. Consider adding "+('".indexOn": "'+c.n.g.toString()+'"')+" at "+c.path.toString()+" to your security rules for better performance")}(a.$[d]&&a.$[d][e])===b&&(a.f("listen response",f),"ok"!==m&&Hg(a,d,e),b.G&&b.G(m,
k))})}g.pf=function(a){this.pb=a;this.f("Auth token refreshed");this.pb?Ig(this):this.ma&&this.ua("unauth",{},function(){});if(a&&40===a.length||jd(a))this.f("Admin auth credential detected.  Reducing max reconnect time."),this.td=3E4};function Ig(a){if(a.ma&&a.pb){var b=a.pb,c={cred:b};a.Je&&(c.authvar=a.Je);a.ua("auth",c,function(c){var e=c.s;c=c.d||"error";a.pb===b&&("ok"===e?this.ke=0:Jg(a,e,c))})}}
g.Df=function(a,b){var c=a.path.toString(),d=a.ya();this.f("Unlisten called for "+c+" "+d);E(xf(a.n)||!T(a.n),"unlisten() called for non-default but complete query");if(Hg(this,c,d)&&this.ma){var e=wf(a.n);this.f("Unlisten on "+c+" for "+d);c={p:c};b&&(c.q=e,c.t=b);this.ua("n",c)}};g.re=function(a,b,c){this.ma?Kg(this,"o",a,b,c):this.Lc.push({we:a,action:"o",data:b,G:c})};g.ff=function(a,b,c){this.ma?Kg(this,"om",a,b,c):this.Lc.push({we:a,action:"om",data:b,G:c})};
g.xd=function(a,b){this.ma?Kg(this,"oc",a,null,b):this.Lc.push({we:a,action:"oc",data:null,G:b})};function Kg(a,b,c,d,e){c={p:c,d:d};a.f("onDisconnect "+b,c);a.ua(b,c,function(a){e&&setTimeout(function(){e(a.s,a.d)},Math.floor(0))})}g.put=function(a,b,c,d){Lg(this,"p",a,b,c,d)};g.df=function(a,b,c,d){Lg(this,"m",a,b,c,d)};function Lg(a,b,c,d,e,f){d={p:c,d:d};p(f)&&(d.h=f);a.pa.push({action:b,rf:d,G:e});a.Pc++;b=a.pa.length-1;a.ma?Mg(a,b):a.f("Buffering put: "+c)}
function Mg(a,b){var c=a.pa[b].action,d=a.pa[b].rf,e=a.pa[b].G;a.pa[b].pg=a.ma;a.ua(c,d,function(d){a.f(c+" response",d);delete a.pa[b];a.Pc--;0===a.Pc&&(a.pa=[]);e&&e(d.s,d.d)})}g.ye=function(a){this.ma&&(a={c:a},this.f("reportStats",a),this.ua("s",a,function(a){"ok"!==a.s&&this.f("reportStats","Error sending stats: "+a.d)}))};
g.wd=function(a){if("r"in a){this.f("from server: "+B(a));var b=a.r,c=this.Gd[b];c&&(delete this.Gd[b],c(a.b))}else{if("error"in a)throw"A server-side error has occurred: "+a.error;"a"in a&&(b=a.a,a=a.b,this.f("handleServerMessage",b,a),"d"===b?this.Hb(a.p,a.d,!1,a.t):"m"===b?this.Hb(a.p,a.d,!0,a.t):"c"===b?Ng(this,a.p,a.q):"ac"===b?Jg(this,a.s,a.d):"sd"===b?this.ze?this.ze(a):"msg"in a&&"undefined"!==typeof console&&console.log("FIREBASE: "+a.msg.replace("\n","\nFIREBASE: ")):Wc("Unrecognized action received from server: "+
B(b)+"\nAre you using the latest client?"))}};g.Mc=function(a,b){this.f("connection ready");this.ma=!0;this.Bc=(new Date).getTime();this.ue({serverTimeOffset:a-(new Date).getTime()});this.Db=b;if(this.Ue){var c={};c["sdk.js."+firebase.SDK_VERSION.replace(/\./g,"-")]=1;Pb()?c["framework.cordova"]=1:"object"===typeof navigator&&"ReactNative"===navigator.product&&(c["framework.reactnative"]=1);this.ye(c)}Og(this);this.Ue=!1;this.Kc(!0)};
function Eg(a,b){E(!a.Ia,"Scheduling a connect when we're already connected/ing?");a.vb&&clearTimeout(a.vb);a.vb=setTimeout(function(){a.vb=null;Pg(a)},Math.floor(b))}g.ig=function(a){a&&!this.Nb&&this.Va===this.td&&(this.f("Window became visible.  Reducing delay."),this.Va=1E3,this.Ia||Eg(this,0));this.Nb=a};g.hg=function(a){a?(this.f("Browser went online."),this.Va=1E3,this.Ia||Eg(this,0)):(this.f("Browser went offline.  Killing connection."),this.Ia&&this.Ia.close())};
g.hf=function(){this.f("data client disconnected");this.ma=!1;this.Ia=null;for(var a=0;a<this.pa.length;a++){var b=this.pa[a];b&&"h"in b.rf&&b.pg&&(b.G&&b.G("disconnect"),delete this.pa[a],this.Pc--)}0===this.Pc&&(this.pa=[]);this.Gd={};Qg(this)&&(this.Nb?this.Bc&&(3E4<(new Date).getTime()-this.Bc&&(this.Va=1E3),this.Bc=null):(this.f("Window isn't visible.  Delaying reconnect."),this.Va=this.td,this.me=(new Date).getTime()),a=Math.max(0,this.Va-((new Date).getTime()-this.me)),a*=Math.random(),this.f("Trying to reconnect in "+
a+"ms"),Eg(this,a),this.Va=Math.min(this.td,1.3*this.Va));this.Kc(!1)};
function Pg(a){if(Qg(a)){a.f("Making a connection attempt");a.me=(new Date).getTime();a.Bc=null;var b=r(a.wd,a),c=r(a.Mc,a),d=r(a.hf,a),e=a.id+":"+Fg++,f=a.Db,h=!1,k=null,m=function(){k?k.close():(h=!0,d())};a.Ia={close:m,ua:function(a){E(k,"sendRequest call when we're not connected not allowed.");k.ua(a)}};var l=a.de;a.de=!1;a.Vd.getToken(l).then(function(l){h?I("getToken() completed but was canceled"):(I("getToken() completed. Creating connection."),a.pb=l&&l.accessToken,k=new qg(e,a.M,b,c,d,function(b){L(b+
" ("+a.M.toString()+")");a.eb("server_kill")},f))}).then(null,function(b){a.f("Failed to get token: "+b);h||m()})}}g.eb=function(a){I("Interrupting connection for reason: "+a);this.qd[a]=!0;this.Ia?this.Ia.close():(this.vb&&(clearTimeout(this.vb),this.vb=null),this.ma&&this.hf())};g.lc=function(a){I("Resuming connection for reason: "+a);delete this.qd[a];ua(this.qd)&&(this.Va=1E3,this.Ia||Eg(this,0))};
function Ng(a,b,c){c=c?Ia(c,function(a){return dd(a)}).join("$"):"default";(a=Hg(a,b,c))&&a.G&&a.G("permission_denied")}function Hg(a,b,c){b=(new M(b)).toString();var d;p(a.$[b])?(d=a.$[b][c],delete a.$[b][c],0===na(a.$[b])&&delete a.$[b]):d=void 0;return d}
function Jg(a,b,c){I("Auth token revoked: "+b+"/"+c);a.pb=null;a.de=!0;a.Ia.close();"invalid_token"===b&&(a.ke++,3<=a.ke&&(a.Va=3E4,L("Provided authentication credentials are invalid. This usually indicates your FirebaseApp instance was not initialized correctly. Make sure your apiKey and databaseURL match the values provided for your app at https://console.firebase.google.com/, or if you're using a service account, make sure it's authorized to access the specified databaseURL and is from the correct project.")))}
function Og(a){Ig(a);t(a.$,function(b){t(b,function(b){Gg(a,b)})});for(var b=0;b<a.pa.length;b++)a.pa[b]&&Mg(a,b);for(;a.Lc.length;)b=a.Lc.shift(),Kg(a,b.action,b.we,b.data,b.G)}function Qg(a){var b;b=Pe.Wb().ic;return ua(a.qd)&&b};function Rg(a){this.X=a}var Sg=new Rg(new oe(null));function Tg(a,b,c){if(b.e())return new Rg(new oe(c));var d=se(a.X,b);if(null!=d){var e=d.path,d=d.value;b=R(e,b);d=d.F(b,c);return new Rg(a.X.set(e,d))}a=Ld(a.X,b,new oe(c));return new Rg(a)}function Ug(a,b,c){var d=a;Ib(c,function(a,c){d=Tg(d,b.m(a),c)});return d}Rg.prototype.Ed=function(a){if(a.e())return Sg;a=Ld(this.X,a,Q);return new Rg(a)};function Vg(a,b){var c=se(a.X,b);return null!=c?a.X.get(c.path).Q(R(c.path,b)):null}
function Wg(a){var b=[],c=a.X.value;null!=c?c.J()||c.P(N,function(a,c){b.push(new O(a,c))}):a.X.children.ia(function(a,c){null!=c.value&&b.push(new O(a,c.value))});return b}function Xg(a,b){if(b.e())return a;var c=Vg(a,b);return null!=c?new Rg(new oe(c)):new Rg(a.X.subtree(b))}Rg.prototype.e=function(){return this.X.e()};Rg.prototype.apply=function(a){return Yg(C,this.X,a)};
function Yg(a,b,c){if(null!=b.value)return c.F(a,b.value);var d=null;b.children.ia(function(b,f){".priority"===b?(E(null!==f.value,"Priority writes must always be leaf nodes"),d=f.value):c=Yg(a.m(b),f,c)});c.Q(a).e()||null===d||(c=c.F(a.m(".priority"),d));return c};function Zg(){this.T=Sg;this.la=[];this.Cc=-1}function $g(a,b){for(var c=0;c<a.la.length;c++){var d=a.la[c];if(d.Zc===b)return d}return null}g=Zg.prototype;
g.Ed=function(a){var b=Ma(this.la,function(b){return b.Zc===a});E(0<=b,"removeWrite called with nonexistent writeId.");var c=this.la[b];this.la.splice(b,1);for(var d=c.visible,e=!1,f=this.la.length-1;d&&0<=f;){var h=this.la[f];h.visible&&(f>=b&&ah(h,c.path)?d=!1:c.path.contains(h.path)&&(e=!0));f--}if(d){if(e)this.T=bh(this.la,ch,C),this.Cc=0<this.la.length?this.la[this.la.length-1].Zc:-1;else if(c.Ja)this.T=this.T.Ed(c.path);else{var k=this;t(c.children,function(a,b){k.T=k.T.Ed(c.path.m(b))})}return!0}return!1};
g.Ba=function(a,b,c,d){if(c||d){var e=Xg(this.T,a);return!d&&e.e()?b:d||null!=b||null!=Vg(e,C)?(e=bh(this.la,function(b){return(b.visible||d)&&(!c||!(0<=Fa(c,b.Zc)))&&(b.path.contains(a)||a.contains(b.path))},a),b=b||F,e.apply(b)):null}e=Vg(this.T,a);if(null!=e)return e;e=Xg(this.T,a);return e.e()?b:null!=b||null!=Vg(e,C)?(b=b||F,e.apply(b)):null};
g.sc=function(a,b){var c=F,d=Vg(this.T,a);if(d)d.J()||d.P(N,function(a,b){c=c.U(a,b)});else if(b){var e=Xg(this.T,a);b.P(N,function(a,b){var d=Xg(e,new M(a)).apply(b);c=c.U(a,d)});Ga(Wg(e),function(a){c=c.U(a.name,a.S)})}else e=Xg(this.T,a),Ga(Wg(e),function(a){c=c.U(a.name,a.S)});return c};g.$c=function(a,b,c,d){E(c||d,"Either existingEventSnap or existingServerSnap must exist");a=a.m(b);if(null!=Vg(this.T,a))return null;a=Xg(this.T,a);return a.e()?d.Q(b):a.apply(d.Q(b))};
g.rc=function(a,b,c){a=a.m(b);var d=Vg(this.T,a);return null!=d?d:nc(c,b)?Xg(this.T,a).apply(c.j().R(b)):null};g.mc=function(a){return Vg(this.T,a)};g.Xd=function(a,b,c,d,e,f){var h;a=Xg(this.T,a);h=Vg(a,C);if(null==h)if(null!=b)h=a.apply(b);else return[];h=h.ob(f);if(h.e()||h.J())return[];b=[];a=Se(f);e=e?h.$b(c,f):h.Yb(c,f);for(f=K(e);f&&b.length<d;)0!==a(f,c)&&b.push(f),f=K(e);return b};
function ah(a,b){return a.Ja?a.path.contains(b):!!sa(a.children,function(c,d){return a.path.m(d).contains(b)})}function ch(a){return a.visible}
function bh(a,b,c){for(var d=Sg,e=0;e<a.length;++e){var f=a[e];if(b(f)){var h=f.path;if(f.Ja)c.contains(h)?(h=R(c,h),d=Tg(d,h,f.Ja)):h.contains(c)&&(h=R(h,c),d=Tg(d,C,f.Ja.Q(h)));else if(f.children)if(c.contains(h))h=R(c,h),d=Ug(d,h,f.children);else{if(h.contains(c))if(h=R(h,c),h.e())d=Ug(d,C,f.children);else if(f=A(f.children,J(h)))f=f.Q(D(h)),d=Tg(d,C,f)}else throw Pc("WriteRecord should have .snap or .children");}}return d}function dh(a,b){this.Mb=a;this.X=b}g=dh.prototype;
g.Ba=function(a,b,c){return this.X.Ba(this.Mb,a,b,c)};g.sc=function(a){return this.X.sc(this.Mb,a)};g.$c=function(a,b,c){return this.X.$c(this.Mb,a,b,c)};g.mc=function(a){return this.X.mc(this.Mb.m(a))};g.Xd=function(a,b,c,d,e){return this.X.Xd(this.Mb,a,b,c,d,e)};g.rc=function(a,b){return this.X.rc(this.Mb,a,b)};g.m=function(a){return new dh(this.Mb.m(a),this.X)};function Ke(){this.k=this.B=null}Ke.prototype.find=function(a){if(null!=this.B)return this.B.Q(a);if(a.e()||null==this.k)return null;var b=J(a);a=D(a);return this.k.contains(b)?this.k.get(b).find(a):null};function Me(a,b,c){if(b.e())a.B=c,a.k=null;else if(null!==a.B)a.B=a.B.F(b,c);else{null==a.k&&(a.k=new Ge);var d=J(b);a.k.contains(d)||a.k.add(d,new Ke);a=a.k.get(d);b=D(b);Me(a,b,c)}}
function eh(a,b){if(b.e())return a.B=null,a.k=null,!0;if(null!==a.B){if(a.B.J())return!1;var c=a.B;a.B=null;c.P(N,function(b,c){Me(a,new M(b),c)});return eh(a,b)}return null!==a.k?(c=J(b),b=D(b),a.k.contains(c)&&eh(a.k.get(c),b)&&a.k.remove(c),a.k.e()?(a.k=null,!0):!1):!0}function Le(a,b,c){null!==a.B?c(b,a.B):a.P(function(a,e){var f=new M(b.toString()+"/"+a);Le(e,f,c)})}Ke.prototype.P=function(a){null!==this.k&&He(this.k,function(b,c){a(b,c)})};function U(a,b){this.ta=a;this.qa=b}U.prototype.cancel=function(a){x("Firebase.onDisconnect().cancel",0,1,arguments.length);y("Firebase.onDisconnect().cancel",1,a,!0);var b=new Eb;this.ta.xd(this.qa,Fb(b,a));return b.ra};U.prototype.cancel=U.prototype.cancel;U.prototype.remove=function(a){x("Firebase.onDisconnect().remove",0,1,arguments.length);de("Firebase.onDisconnect().remove",this.qa);y("Firebase.onDisconnect().remove",1,a,!0);var b=new Eb;fh(this.ta,this.qa,null,Fb(b,a));return b.ra};
U.prototype.remove=U.prototype.remove;U.prototype.set=function(a,b){x("Firebase.onDisconnect().set",1,2,arguments.length);de("Firebase.onDisconnect().set",this.qa);Wd("Firebase.onDisconnect().set",a,this.qa,!1);y("Firebase.onDisconnect().set",2,b,!0);var c=new Eb;fh(this.ta,this.qa,a,Fb(c,b));return c.ra};U.prototype.set=U.prototype.set;
U.prototype.Kb=function(a,b,c){x("Firebase.onDisconnect().setWithPriority",2,3,arguments.length);de("Firebase.onDisconnect().setWithPriority",this.qa);Wd("Firebase.onDisconnect().setWithPriority",a,this.qa,!1);$d("Firebase.onDisconnect().setWithPriority",2,b);y("Firebase.onDisconnect().setWithPriority",3,c,!0);var d=new Eb;gh(this.ta,this.qa,a,b,Fb(d,c));return d.ra};U.prototype.setWithPriority=U.prototype.Kb;
U.prototype.update=function(a,b){x("Firebase.onDisconnect().update",1,2,arguments.length);de("Firebase.onDisconnect().update",this.qa);if(da(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;L("Passing an Array to Firebase.onDisconnect().update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}Zd("Firebase.onDisconnect().update",a,this.qa);y("Firebase.onDisconnect().update",2,b,!0);
c=new Eb;hh(this.ta,this.qa,a,Fb(c,b));return c.ra};U.prototype.update=U.prototype.update;function V(a,b,c){this.A=a;this.W=b;this.g=c}V.prototype.H=function(){x("Firebase.DataSnapshot.val",0,0,arguments.length);return this.A.H()};V.prototype.val=V.prototype.H;V.prototype.Te=function(){x("Firebase.DataSnapshot.exportVal",0,0,arguments.length);return this.A.H(!0)};V.prototype.exportVal=V.prototype.Te;V.prototype.Uf=function(){x("Firebase.DataSnapshot.exists",0,0,arguments.length);return!this.A.e()};V.prototype.exists=V.prototype.Uf;
V.prototype.m=function(a){x("Firebase.DataSnapshot.child",0,1,arguments.length);fa(a)&&(a=String(a));ce("Firebase.DataSnapshot.child",a);var b=new M(a),c=this.W.m(b);return new V(this.A.Q(b),c,N)};V.prototype.child=V.prototype.m;V.prototype.Fa=function(a){x("Firebase.DataSnapshot.hasChild",1,1,arguments.length);ce("Firebase.DataSnapshot.hasChild",a);var b=new M(a);return!this.A.Q(b).e()};V.prototype.hasChild=V.prototype.Fa;
V.prototype.C=function(){x("Firebase.DataSnapshot.getPriority",0,0,arguments.length);return this.A.C().H()};V.prototype.getPriority=V.prototype.C;V.prototype.forEach=function(a){x("Firebase.DataSnapshot.forEach",1,1,arguments.length);y("Firebase.DataSnapshot.forEach",1,a,!1);if(this.A.J())return!1;var b=this;return!!this.A.P(this.g,function(c,d){return a(new V(d,b.W.m(c),N))})};V.prototype.forEach=V.prototype.forEach;
V.prototype.kd=function(){x("Firebase.DataSnapshot.hasChildren",0,0,arguments.length);return this.A.J()?!1:!this.A.e()};V.prototype.hasChildren=V.prototype.kd;V.prototype.getKey=function(){x("Firebase.DataSnapshot.key",0,0,arguments.length);return this.W.getKey()};id(V.prototype,"key",V.prototype.getKey);V.prototype.Fb=function(){x("Firebase.DataSnapshot.numChildren",0,0,arguments.length);return this.A.Fb()};V.prototype.numChildren=V.prototype.Fb;
V.prototype.xb=function(){x("Firebase.DataSnapshot.ref",0,0,arguments.length);return this.W};id(V.prototype,"ref",V.prototype.xb);function ih(a,b,c){this.Qb=a;this.sb=b;this.ub=c||null}g=ih.prototype;g.sf=function(a){return"value"===a};g.createEvent=function(a,b){var c=b.n.g;return new ic("value",this,new V(a.Ma,b.xb(),c))};g.Ub=function(a){var b=this.ub;if("cancel"===a.ge()){E(this.sb,"Raising a cancel event on a listener with no cancel callback");var c=this.sb;return function(){c.call(b,a.error)}}var d=this.Qb;return function(){d.call(b,a.Md)}};g.Oe=function(a,b){return this.sb?new jc(this,a,b):null};
g.matches=function(a){return a instanceof ih?a.Qb&&this.Qb?a.Qb===this.Qb&&a.ub===this.ub:!0:!1};g.$e=function(){return null!==this.Qb};function jh(a,b,c){this.ha=a;this.sb=b;this.ub=c}g=jh.prototype;g.sf=function(a){a="children_added"===a?"child_added":a;return("children_removed"===a?"child_removed":a)in this.ha};g.Oe=function(a,b){return this.sb?new jc(this,a,b):null};
g.createEvent=function(a,b){E(null!=a.Za,"Child events should have a childName.");var c=b.xb().m(a.Za);return new ic(a.type,this,new V(a.Ma,c,b.n.g),a.Dd)};g.Ub=function(a){var b=this.ub;if("cancel"===a.ge()){E(this.sb,"Raising a cancel event on a listener with no cancel callback");var c=this.sb;return function(){c.call(b,a.error)}}var d=this.ha[a.gd];return function(){d.call(b,a.Md,a.Dd)}};
g.matches=function(a){if(a instanceof jh){if(!this.ha||!a.ha)return!0;if(this.ub===a.ub){var b=na(a.ha);if(b===na(this.ha)){if(1===b){var b=oa(a.ha),c=oa(this.ha);return c===b&&(!a.ha[b]||!this.ha[c]||a.ha[b]===this.ha[c])}return ma(this.ha,function(b,c){return a.ha[c]===b})}}}return!1};g.$e=function(){return null!==this.ha};function kh(){this.Aa={}}g=kh.prototype;g.e=function(){return ua(this.Aa)};g.gb=function(a,b,c){var d=a.source.Ib;if(null!==d)return d=A(this.Aa,d),E(null!=d,"SyncTree gave us an op for an invalid query."),d.gb(a,b,c);var e=[];t(this.Aa,function(d){e=e.concat(d.gb(a,b,c))});return e};g.Ob=function(a,b,c,d,e){var f=a.ya(),h=A(this.Aa,f);if(!h){var h=c.Ba(e?d:null),k=!1;h?k=!0:(h=d instanceof P?c.sc(d):F,k=!1);h=new If(a,new Fd(new oc(h,k,!1),new oc(d,e,!1)));this.Aa[f]=h}h.Ob(b);return Lf(h,b)};
g.mb=function(a,b,c){var d=a.ya(),e=[],f=[],h=null!=lh(this);if("default"===d){var k=this;t(this.Aa,function(a,d){f=f.concat(a.mb(b,c));a.e()&&(delete k.Aa[d],T(a.W.n)||e.push(a.W))})}else{var m=A(this.Aa,d);m&&(f=f.concat(m.mb(b,c)),m.e()&&(delete this.Aa[d],T(m.W.n)||e.push(m.W)))}h&&null==lh(this)&&e.push(new W(a.w,a.path));return{rg:e,Sf:f}};function mh(a){return Ha(pa(a.Aa),function(a){return!T(a.W.n)})}g.jb=function(a){var b=null;t(this.Aa,function(c){b=b||c.jb(a)});return b};
function nh(a,b){if(T(b.n))return lh(a);var c=b.ya();return A(a.Aa,c)}function lh(a){return ta(a.Aa,function(a){return T(a.W.n)})||null};function oh(a){this.wa=Q;this.lb=new Zg;this.De={};this.jc={};this.Dc=a}function ph(a,b,c,d,e){var f=a.lb,h=e;E(d>f.Cc,"Stacking an older write on top of newer ones");p(h)||(h=!0);f.la.push({path:b,Ja:c,Zc:d,visible:h});h&&(f.T=Tg(f.T,b,c));f.Cc=d;return e?qh(a,new ac(Ce,b,c)):[]}function rh(a,b,c,d){var e=a.lb;E(d>e.Cc,"Stacking an older merge on top of newer ones");e.la.push({path:b,children:c,Zc:d,visible:!0});e.T=Ug(e.T,b,c);e.Cc=d;c=qe(c);return qh(a,new kd(Ce,b,c))}
function sh(a,b,c){c=c||!1;var d=$g(a.lb,b);if(a.lb.Ed(b)){var e=Q;null!=d.Ja?e=e.set(C,!0):Ib(d.children,function(a,b){e=e.set(new M(a),b)});return qh(a,new Be(d.path,e,c))}return[]}function th(a,b,c){c=qe(c);return qh(a,new kd(Ee,b,c))}function uh(a,b,c,d){d=vh(a,d);if(null!=d){var e=wh(d);d=e.path;e=e.Ib;b=R(d,b);c=new ac(new De(!1,!0,e,!0),b,c);return xh(a,d,c)}return[]}
function yh(a,b,c,d){if(d=vh(a,d)){var e=wh(d);d=e.path;e=e.Ib;b=R(d,b);c=qe(c);c=new kd(new De(!1,!0,e,!0),b,c);return xh(a,d,c)}return[]}
oh.prototype.Ob=function(a,b){var c=a.path,d=null,e=!1;xe(this.wa,c,function(a,b){var f=R(a,c);d=d||b.jb(f);e=e||null!=lh(b)});var f=this.wa.get(c);f?(e=e||null!=lh(f),d=d||f.jb(C)):(f=new kh,this.wa=this.wa.set(c,f));var h;null!=d?h=!0:(h=!1,d=F,Ae(this.wa.subtree(c),function(a,b){var c=b.jb(C);c&&(d=d.U(a,c))}));var k=null!=nh(f,a);if(!k&&!T(a.n)){var m=zh(a);E(!(m in this.jc),"View does not exist, but we have a tag");var l=Ah++;this.jc[m]=l;this.De["_"+l]=m}h=f.Ob(a,b,new dh(c,this.lb),d,h);k||
e||(f=nh(f,a),h=h.concat(Bh(this,a,f)));return h};
oh.prototype.mb=function(a,b,c){var d=a.path,e=this.wa.get(d),f=[];if(e&&("default"===a.ya()||null!=nh(e,a))){f=e.mb(a,b,c);e.e()&&(this.wa=this.wa.remove(d));e=f.rg;f=f.Sf;b=-1!==Ma(e,function(a){return T(a.n)});var h=ve(this.wa,d,function(a,b){return null!=lh(b)});if(b&&!h&&(d=this.wa.subtree(d),!d.e()))for(var d=Ch(d),k=0;k<d.length;++k){var m=d[k],l=m.W,m=Dh(this,m);this.Dc.Ae(Eh(l),Fh(this,l),m.ld,m.G)}if(!h&&0<e.length&&!c)if(b)this.Dc.Od(Eh(a),null);else{var u=this;Ga(e,function(a){a.ya();
var b=u.jc[zh(a)];u.Dc.Od(Eh(a),b)})}Gh(this,e)}return f};oh.prototype.Ba=function(a,b){var c=this.lb,d=ve(this.wa,a,function(b,c){var d=R(b,a);if(d=c.jb(d))return d});return c.Ba(a,d,b,!0)};function Ch(a){return te(a,function(a,c,d){if(c&&null!=lh(c))return[lh(c)];var e=[];c&&(e=mh(c));t(d,function(a){e=e.concat(a)});return e})}function Gh(a,b){for(var c=0;c<b.length;++c){var d=b[c];if(!T(d.n)){var d=zh(d),e=a.jc[d];delete a.jc[d];delete a.De["_"+e]}}}
function Eh(a){return T(a.n)&&!xf(a.n)?a.xb():a}function Bh(a,b,c){var d=b.path,e=Fh(a,b);c=Dh(a,c);b=a.Dc.Ae(Eh(b),e,c.ld,c.G);d=a.wa.subtree(d);if(e)E(null==lh(d.value),"If we're adding a query, it shouldn't be shadowed");else for(e=te(d,function(a,b,c){if(!a.e()&&b&&null!=lh(b))return[Jf(lh(b))];var d=[];b&&(d=d.concat(Ia(mh(b),function(a){return a.W})));t(c,function(a){d=d.concat(a)});return d}),d=0;d<e.length;++d)c=e[d],a.Dc.Od(Eh(c),Fh(a,c));return b}
function Dh(a,b){var c=b.W,d=Fh(a,c);return{ld:function(){return(b.u()||F).hash()},G:function(b){if("ok"===b){if(d){var f=c.path;if(b=vh(a,d)){var h=wh(b);b=h.path;h=h.Ib;f=R(b,f);f=new Zb(new De(!1,!0,h,!0),f);b=xh(a,b,f)}else b=[]}else b=qh(a,new Zb(Ee,c.path));return b}f="Unknown Error";"too_big"===b?f="The data requested exceeds the maximum size that can be accessed with a single request.":"permission_denied"==b?f="Client doesn't have permission to access the desired data.":"unavailable"==b&&
(f="The service is unavailable");f=Error(b+" at "+c.path.toString()+": "+f);f.code=b.toUpperCase();return a.mb(c,null,f)}}}function zh(a){return a.path.toString()+"$"+a.ya()}function wh(a){var b=a.indexOf("$");E(-1!==b&&b<a.length-1,"Bad queryKey.");return{Ib:a.substr(b+1),path:new M(a.substr(0,b))}}function vh(a,b){var c=a.De,d="_"+b;return d in c?c[d]:void 0}function Fh(a,b){var c=zh(b);return A(a.jc,c)}var Ah=1;
function xh(a,b,c){var d=a.wa.get(b);E(d,"Missing sync point for query tag that we're tracking");return d.gb(c,new dh(b,a.lb),null)}function qh(a,b){return Hh(a,b,a.wa,null,new dh(C,a.lb))}function Hh(a,b,c,d,e){if(b.path.e())return Ih(a,b,c,d,e);var f=c.get(C);null==d&&null!=f&&(d=f.jb(C));var h=[],k=J(b.path),m=b.Nc(k);if((c=c.children.get(k))&&m)var l=d?d.R(k):null,k=e.m(k),h=h.concat(Hh(a,m,c,l,k));f&&(h=h.concat(f.gb(b,e,d)));return h}
function Ih(a,b,c,d,e){var f=c.get(C);null==d&&null!=f&&(d=f.jb(C));var h=[];c.children.ia(function(c,f){var l=d?d.R(c):null,u=e.m(c),z=b.Nc(c);z&&(h=h.concat(Ih(a,z,f,l,u)))});f&&(h=h.concat(f.gb(b,e,d)));return h};function X(a,b,c,d){this.w=a;this.path=b;this.n=c;this.Oc=d}
function Jh(a){var b=null,c=null;a.ka&&(b=qd(a));a.na&&(c=sd(a));if(a.g===Md){if(a.ka){if("[MIN_NAME]"!=pd(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==typeof b)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}if(a.na){if("[MAX_NAME]"!=rd(a))throw Error("Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().");if("string"!==
typeof c)throw Error("Query: When ordering by key, the argument passed to startAt(), endAt(),or equalTo() must be a string.");}}else if(a.g===N){if(null!=b&&!Vd(b)||null!=c&&!Vd(c))throw Error("Query: When ordering by priority, the first argument passed to startAt(), endAt(), or equalTo() must be a valid priority value (null, a number, or a string).");}else if(E(a.g instanceof Ue||a.g===$e,"unknown index type."),null!=b&&"object"===typeof b||null!=c&&"object"===typeof c)throw Error("Query: First argument passed to startAt(), endAt(), or equalTo() cannot be an object.");
}function Kh(a){if(a.ka&&a.na&&a.xa&&(!a.xa||""===a.oc))throw Error("Query: Can't combine startAt(), endAt(), and limit(). Use limitToFirst() or limitToLast() instead.");}function Lh(a,b){if(!0===a.Oc)throw Error(b+": You can't combine multiple orderBy calls.");}g=X.prototype;g.xb=function(){x("Query.ref",0,0,arguments.length);return new W(this.w,this.path)};
g.hc=function(a,b,c,d){x("Query.on",2,4,arguments.length);ae("Query.on",a,!1);y("Query.on",2,b,!1);var e=Mh("Query.on",c,d);if("value"===a)Nh(this.w,this,new ih(b,e.cancel||null,e.Pa||null));else{var f={};f[a]=b;Nh(this.w,this,new jh(f,e.cancel,e.Pa))}return b};
g.Jc=function(a,b,c){x("Query.off",0,3,arguments.length);ae("Query.off",a,!0);y("Query.off",2,b,!0);Cb("Query.off",3,c);var d=null,e=null;"value"===a?d=new ih(b||null,null,c||null):a&&(b&&(e={},e[a]=b),d=new jh(e,null,c||null));e=this.w;d=".info"===J(this.path)?e.pd.mb(this,d):e.K.mb(this,d);tc(e.da,this.path,d)};
g.jg=function(a,b){function c(k){f&&(f=!1,e.Jc(a,c),b&&b.call(d.Pa,k),h.resolve(k))}x("Query.once",1,4,arguments.length);ae("Query.once",a,!1);y("Query.once",2,b,!0);var d=Mh("Query.once",arguments[2],arguments[3]),e=this,f=!0,h=new Eb;Gb(h.ra);this.hc(a,c,function(b){e.Jc(a,c);d.cancel&&d.cancel.call(d.Pa,b);h.reject(b)});return h.ra};
g.ne=function(a){x("Query.limitToFirst",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToFirst: First argument must be a positive integer.");if(this.n.xa)throw Error("Query.limitToFirst: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new X(this.w,this.path,this.n.ne(a),this.Oc)};
g.oe=function(a){x("Query.limitToLast",1,1,arguments.length);if(!fa(a)||Math.floor(a)!==a||0>=a)throw Error("Query.limitToLast: First argument must be a positive integer.");if(this.n.xa)throw Error("Query.limitToLast: Limit was already set (by another call to limit, limitToFirst, or limitToLast).");return new X(this.w,this.path,this.n.oe(a),this.Oc)};
g.kg=function(a){x("Query.orderByChild",1,1,arguments.length);if("$key"===a)throw Error('Query.orderByChild: "$key" is invalid.  Use Query.orderByKey() instead.');if("$priority"===a)throw Error('Query.orderByChild: "$priority" is invalid.  Use Query.orderByPriority() instead.');if("$value"===a)throw Error('Query.orderByChild: "$value" is invalid.  Use Query.orderByValue() instead.');ce("Query.orderByChild",a);Lh(this,"Query.orderByChild");var b=new M(a);if(b.e())throw Error("Query.orderByChild: cannot pass in empty path.  Use Query.orderByValue() instead.");
b=new Ue(b);b=vf(this.n,b);Jh(b);return new X(this.w,this.path,b,!0)};g.lg=function(){x("Query.orderByKey",0,0,arguments.length);Lh(this,"Query.orderByKey");var a=vf(this.n,Md);Jh(a);return new X(this.w,this.path,a,!0)};g.mg=function(){x("Query.orderByPriority",0,0,arguments.length);Lh(this,"Query.orderByPriority");var a=vf(this.n,N);Jh(a);return new X(this.w,this.path,a,!0)};
g.ng=function(){x("Query.orderByValue",0,0,arguments.length);Lh(this,"Query.orderByValue");var a=vf(this.n,$e);Jh(a);return new X(this.w,this.path,a,!0)};g.Nd=function(a,b){x("Query.startAt",0,2,arguments.length);Wd("Query.startAt",a,this.path,!0);be("Query.startAt",b);var c=this.n.Nd(a,b);Kh(c);Jh(c);if(this.n.ka)throw Error("Query.startAt: Starting point was already set (by another call to startAt or equalTo).");p(a)||(b=a=null);return new X(this.w,this.path,c,this.Oc)};
g.fd=function(a,b){x("Query.endAt",0,2,arguments.length);Wd("Query.endAt",a,this.path,!0);be("Query.endAt",b);var c=this.n.fd(a,b);Kh(c);Jh(c);if(this.n.na)throw Error("Query.endAt: Ending point was already set (by another call to endAt or equalTo).");return new X(this.w,this.path,c,this.Oc)};
g.Qf=function(a,b){x("Query.equalTo",1,2,arguments.length);Wd("Query.equalTo",a,this.path,!1);be("Query.equalTo",b);if(this.n.ka)throw Error("Query.equalTo: Starting point was already set (by another call to endAt or equalTo).");if(this.n.na)throw Error("Query.equalTo: Ending point was already set (by another call to endAt or equalTo).");return this.Nd(a,b).fd(a,b)};
g.toString=function(){x("Query.toString",0,0,arguments.length);for(var a=this.path,b="",c=a.Z;c<a.o.length;c++)""!==a.o[c]&&(b+="/"+encodeURIComponent(String(a.o[c])));return this.w.toString()+(b||"/")};g.ya=function(){var a=dd(wf(this.n));return"{}"===a?"default":a};
function Mh(a,b,c){var d={cancel:null,Pa:null};if(b&&c)d.cancel=b,y(a,3,d.cancel,!0),d.Pa=c,Cb(a,4,d.Pa);else if(b)if("object"===typeof b&&null!==b)d.Pa=b;else if("function"===typeof b)d.cancel=b;else throw Error(Bb(a,3,!0)+" must either be a cancel callback or a context object.");return d}X.prototype.on=X.prototype.hc;X.prototype.off=X.prototype.Jc;X.prototype.once=X.prototype.jg;X.prototype.limitToFirst=X.prototype.ne;X.prototype.limitToLast=X.prototype.oe;X.prototype.orderByChild=X.prototype.kg;
X.prototype.orderByKey=X.prototype.lg;X.prototype.orderByPriority=X.prototype.mg;X.prototype.orderByValue=X.prototype.ng;X.prototype.startAt=X.prototype.Nd;X.prototype.endAt=X.prototype.fd;X.prototype.equalTo=X.prototype.Qf;X.prototype.toString=X.prototype.toString;id(X.prototype,"ref",X.prototype.xb);function Oh(a){a instanceof Ph||Xc("Don't call new Database() directly - please use firebase.database().");this.ta=a;this.ba=new W(a,C);this.INTERNAL=new Qh(this)}var Rh={TIMESTAMP:{".sv":"timestamp"}};g=Oh.prototype;g.app=null;g.of=function(a){Sh(this,"ref");x("database.ref",0,1,arguments.length);return p(a)?this.ba.m(a):this.ba};
g.qg=function(a){Sh(this,"database.refFromURL");x("database.refFromURL",1,1,arguments.length);var b=Yc(a);ee("database.refFromURL",b);var c=b.kc;c.host!==this.ta.M.host&&Xc("database.refFromURL: Host name does not match the current database: (found "+c.host+" but expected "+this.ta.M.host+")");return this.of(b.path.toString())};function Sh(a,b){null===a.ta&&Xc("Cannot call "+b+" on a deleted database.")}g.Zf=function(){x("database.goOffline",0,0,arguments.length);Sh(this,"goOffline");this.ta.eb()};
g.$f=function(){x("database.goOnline",0,0,arguments.length);Sh(this,"goOnline");this.ta.lc()};Object.defineProperty(Oh.prototype,"app",{get:function(){return this.ta.app}});function Qh(a){this.$a=a}Qh.prototype.delete=function(){Sh(this.$a,"delete");var a=Th.Wb(),b=this.$a.ta;A(a.nb,b.app.name)!==b&&Xc("Database "+b.app.name+" has already been deleted.");b.eb();delete a.nb[b.app.name];this.$a.ta=null;this.$a.ba=null;this.$a=this.$a.INTERNAL=null;return Promise.resolve()};Oh.prototype.ref=Oh.prototype.of;
Oh.prototype.refFromURL=Oh.prototype.qg;Oh.prototype.goOnline=Oh.prototype.$f;Oh.prototype.goOffline=Oh.prototype.Zf;Qh.prototype["delete"]=Qh.prototype.delete;function Ph(a,b,c){this.app=c;var d=new Pf(c);this.M=a;this.Xa=Xf(a);this.Vc=null;this.da=new qc;this.vd=1;this.Ua=null;if(b||0<=("object"===typeof window&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i))this.va=new Mf(this.M,r(this.Hb,this),d),setTimeout(r(this.Kc,this,!0),0);else{b=c.options.databaseAuthVariableOverride||null;if(null!==b){if("object"!==ca(b))throw Error("Only objects are supported for option databaseAuthVariableOverride");
try{B(b)}catch(e){throw Error("Invalid authOverride provided: "+e);}}this.va=this.Ua=new Cg(this.M,r(this.Hb,this),r(this.Kc,this),r(this.ue,this),d,b)}var f=this;Qf(d,function(a){f.va.pf(a)});this.xg=Yf(a,r(function(){return new Uf(this.Xa,this.va)},this));this.nc=new ge;this.ie=new fc;this.pd=new oh({Ae:function(a,b,c,d){b=[];c=f.ie.j(a.path);c.e()||(b=qh(f.pd,new ac(Ee,a.path,c)),setTimeout(function(){d("ok")},0));return b},Od:aa});Uh(this,"connected",!1);this.ja=new Ke;this.$a=new Oh(this);this.ed=
0;this.je=null;this.K=new oh({Ae:function(a,b,c,d){f.va.cf(a,c,b,function(b,c){var e=d(b,c);vc(f.da,a.path,e)});return[]},Od:function(a,b){f.va.Df(a,b)}})}g=Ph.prototype;g.toString=function(){return(this.M.Sc?"https://":"http://")+this.M.host};g.name=function(){return this.M.pe};function Vh(a){a=a.ie.j(new M(".info/serverTimeOffset")).H()||0;return(new Date).getTime()+a}function Wh(a){a=a={timestamp:Vh(a)};a.timestamp=a.timestamp||(new Date).getTime();return a}
g.Hb=function(a,b,c,d){this.ed++;var e=new M(a);b=this.je?this.je(a,b):b;a=[];d?c?(b=la(b,function(a){return S(a)}),a=yh(this.K,e,b,d)):(b=S(b),a=uh(this.K,e,b,d)):c?(d=la(b,function(a){return S(a)}),a=th(this.K,e,d)):(d=S(b),a=qh(this.K,new ac(Ee,e,d)));d=e;0<a.length&&(d=Xh(this,e));vc(this.da,d,a)};g.Kc=function(a){Uh(this,"connected",a);!1===a&&Yh(this)};g.ue=function(a){var b=this;fd(a,function(a,d){Uh(b,d,a)})};
function Uh(a,b,c){b=new M("/.info/"+b);c=S(c);var d=a.ie;d.Jd=d.Jd.F(b,c);c=qh(a.pd,new ac(Ee,b,c));vc(a.da,b,c)}g.Kb=function(a,b,c,d){this.f("set",{path:a.toString(),value:b,Dg:c});var e=Wh(this);b=S(b,c);var e=Ne(b,e),f=this.vd++,e=ph(this.K,a,e,f,!0);rc(this.da,e);var h=this;this.va.put(a.toString(),b.H(!0),function(b,c){var e="ok"===b;e||L("set at "+a+" failed: "+b);e=sh(h.K,f,!e);vc(h.da,a,e);Zh(d,b,c)});e=$h(this,a);Xh(this,e);vc(this.da,e,[])};
g.update=function(a,b,c){this.f("update",{path:a.toString(),value:b});var d=!0,e=Wh(this),f={};t(b,function(a,b){d=!1;var c=S(a);f[b]=Ne(c,e)});if(d)I("update() called with empty data.  Don't do anything."),Zh(c,"ok");else{var h=this.vd++,k=rh(this.K,a,f,h);rc(this.da,k);var m=this;this.va.df(a.toString(),b,function(b,d){var e="ok"===b;e||L("update at "+a+" failed: "+b);var e=sh(m.K,h,!e),f=a;0<e.length&&(f=Xh(m,a));vc(m.da,f,e);Zh(c,b,d)});b=$h(this,a);Xh(this,b);vc(this.da,a,[])}};
function Yh(a){a.f("onDisconnectEvents");var b=Wh(a),c=[];Le(Je(a.ja,b),C,function(b,e){c=c.concat(qh(a.K,new ac(Ee,b,e)));var f=$h(a,b);Xh(a,f)});a.ja=new Ke;vc(a.da,C,c)}g.xd=function(a,b){var c=this;this.va.xd(a.toString(),function(d,e){"ok"===d&&eh(c.ja,a);Zh(b,d,e)})};function fh(a,b,c,d){var e=S(c);a.va.re(b.toString(),e.H(!0),function(c,h){"ok"===c&&Me(a.ja,b,e);Zh(d,c,h)})}function gh(a,b,c,d,e){var f=S(c,d);a.va.re(b.toString(),f.H(!0),function(c,d){"ok"===c&&Me(a.ja,b,f);Zh(e,c,d)})}
function hh(a,b,c,d){var e=!0,f;for(f in c)e=!1;e?(I("onDisconnect().update() called with empty data.  Don't do anything."),Zh(d,"ok")):a.va.ff(b.toString(),c,function(e,f){if("ok"===e)for(var m in c){var l=S(c[m]);Me(a.ja,b.m(m),l)}Zh(d,e,f)})}function Nh(a,b,c){c=".info"===J(b.path)?a.pd.Ob(b,c):a.K.Ob(b,c);tc(a.da,b.path,c)}g.eb=function(){this.Ua&&this.Ua.eb("repo_interrupt")};g.lc=function(){this.Ua&&this.Ua.lc("repo_interrupt")};
g.Be=function(a){if("undefined"!==typeof console){a?(this.Vc||(this.Vc=new Rf(this.Xa)),a=this.Vc.get()):a=this.Xa.get();var b=Ja(qa(a),function(a,b){return Math.max(b.length,a)},0),c;for(c in a){for(var d=a[c],e=c.length;e<b+2;e++)c+=" ";console.log(c+d)}}};g.Ce=function(a){Tf(this.Xa,a);this.xg.yf[a]=!0};g.f=function(a){var b="";this.Ua&&(b=this.Ua.id+":");I(b,arguments)};
function Zh(a,b,c){a&&Tb(function(){if("ok"==b)a(null);else{var d=(b||"error").toUpperCase(),e=d;c&&(e+=": "+c);e=Error(e);e.code=d;a(e)}})};function ai(a,b,c,d,e){function f(){}a.f("transaction on "+b);var h=new W(a,b);h.hc("value",f);c={path:b,update:c,G:d,status:null,kf:Oc(),Ie:e,uf:0,Rd:function(){h.Jc("value",f)},Td:null,Da:null,bd:null,cd:null,dd:null};d=a.K.Ba(b,void 0)||F;c.bd=d;d=c.update(d.H());if(p(d)){Xd("transaction failed: Data returned ",d,c.path);c.status=1;e=he(a.nc,b);var k=e.Ea()||[];k.push(c);ie(e,k);"object"===typeof d&&null!==d&&Hb(d,".priority")?(k=A(d,".priority"),E(Vd(k),"Invalid priority returned by transaction. Priority must be a valid string, finite number, server value, or null.")):
k=(a.K.Ba(b)||F).C().H();e=Wh(a);d=S(d,k);e=Ne(d,e);c.cd=d;c.dd=e;c.Da=a.vd++;c=ph(a.K,b,e,c.Da,c.Ie);vc(a.da,b,c);bi(a)}else c.Rd(),c.cd=null,c.dd=null,c.G&&(a=new V(c.bd,new W(a,c.path),N),c.G(null,!1,a))}function bi(a,b){var c=b||a.nc;b||ci(a,c);if(null!==c.Ea()){var d=di(a,c);E(0<d.length,"Sending zero length transaction queue");Ka(d,function(a){return 1===a.status})&&ei(a,c.path(),d)}else c.kd()&&c.P(function(b){bi(a,b)})}
function ei(a,b,c){for(var d=Ia(c,function(a){return a.Da}),e=a.K.Ba(b,d)||F,d=e,e=e.hash(),f=0;f<c.length;f++){var h=c[f];E(1===h.status,"tryToSendTransactionQueue_: items in queue should all be run.");h.status=2;h.uf++;var k=R(b,h.path),d=d.F(k,h.cd)}d=d.H(!0);a.va.put(b.toString(),d,function(d){a.f("transaction put response",{path:b.toString(),status:d});var e=[];if("ok"===d){d=[];for(f=0;f<c.length;f++){c[f].status=3;e=e.concat(sh(a.K,c[f].Da));if(c[f].G){var h=c[f].dd,k=new W(a,c[f].path);d.push(r(c[f].G,
null,null,!0,new V(h,k,N)))}c[f].Rd()}ci(a,he(a.nc,b));bi(a);vc(a.da,b,e);for(f=0;f<d.length;f++)Tb(d[f])}else{if("datastale"===d)for(f=0;f<c.length;f++)c[f].status=4===c[f].status?5:1;else for(L("transaction at "+b.toString()+" failed: "+d),f=0;f<c.length;f++)c[f].status=5,c[f].Td=d;Xh(a,b)}},e)}function Xh(a,b){var c=fi(a,b),d=c.path(),c=di(a,c);gi(a,c,d);return d}
function gi(a,b,c){if(0!==b.length){for(var d=[],e=[],f=Ia(b,function(a){return a.Da}),h=0;h<b.length;h++){var k=b[h],m=R(c,k.path),l=!1,u;E(null!==m,"rerunTransactionsUnderNode_: relativePath should not be null.");if(5===k.status)l=!0,u=k.Td,e=e.concat(sh(a.K,k.Da,!0));else if(1===k.status)if(25<=k.uf)l=!0,u="maxretry",e=e.concat(sh(a.K,k.Da,!0));else{var z=a.K.Ba(k.path,f)||F;k.bd=z;var G=b[h].update(z.H());p(G)?(Xd("transaction failed: Data returned ",G,k.path),m=S(G),"object"===typeof G&&null!=
G&&Hb(G,".priority")||(m=m.ga(z.C())),z=k.Da,G=Wh(a),G=Ne(m,G),k.cd=m,k.dd=G,k.Da=a.vd++,Na(f,z),e=e.concat(ph(a.K,k.path,G,k.Da,k.Ie)),e=e.concat(sh(a.K,z,!0))):(l=!0,u="nodata",e=e.concat(sh(a.K,k.Da,!0)))}vc(a.da,c,e);e=[];l&&(b[h].status=3,setTimeout(b[h].Rd,Math.floor(0)),b[h].G&&("nodata"===u?(k=new W(a,b[h].path),d.push(r(b[h].G,null,null,!1,new V(b[h].bd,k,N)))):d.push(r(b[h].G,null,Error(u),!1,null))))}ci(a,a.nc);for(h=0;h<d.length;h++)Tb(d[h]);bi(a)}}
function fi(a,b){for(var c,d=a.nc;null!==(c=J(b))&&null===d.Ea();)d=he(d,c),b=D(b);return d}function di(a,b){var c=[];hi(a,b,c);c.sort(function(a,b){return a.kf-b.kf});return c}function hi(a,b,c){var d=b.Ea();if(null!==d)for(var e=0;e<d.length;e++)c.push(d[e]);b.P(function(b){hi(a,b,c)})}function ci(a,b){var c=b.Ea();if(c){for(var d=0,e=0;e<c.length;e++)3!==c[e].status&&(c[d]=c[e],d++);c.length=d;ie(b,0<c.length?c:null)}b.P(function(b){ci(a,b)})}
function $h(a,b){var c=fi(a,b).path(),d=he(a.nc,b);le(d,function(b){ii(a,b)});ii(a,d);ke(d,function(b){ii(a,b)});return c}
function ii(a,b){var c=b.Ea();if(null!==c){for(var d=[],e=[],f=-1,h=0;h<c.length;h++)4!==c[h].status&&(2===c[h].status?(E(f===h-1,"All SENT items should be at beginning of queue."),f=h,c[h].status=4,c[h].Td="set"):(E(1===c[h].status,"Unexpected transaction status in abort"),c[h].Rd(),e=e.concat(sh(a.K,c[h].Da,!0)),c[h].G&&d.push(r(c[h].G,null,Error("set"),!1,null))));-1===f?ie(b,null):c.length=f+1;vc(a.da,b.path(),e);for(h=0;h<d.length;h++)Tb(d[h])}};function Th(){this.nb={};this.Ef=!1}Th.prototype.eb=function(){for(var a in this.nb)this.nb[a].eb()};Th.prototype.lc=function(){for(var a in this.nb)this.nb[a].lc()};Th.prototype.ce=function(a){this.Ef=a};ba(Th);Th.prototype.interrupt=Th.prototype.eb;Th.prototype.resume=Th.prototype.lc;var Y={};Y.pc=Cg;Y.DataConnection=Y.pc;Cg.prototype.wg=function(a,b){this.ua("q",{p:a},b)};Y.pc.prototype.simpleListen=Y.pc.prototype.wg;Cg.prototype.Pf=function(a,b){this.ua("echo",{d:a},b)};Y.pc.prototype.echo=Y.pc.prototype.Pf;Cg.prototype.interrupt=Cg.prototype.eb;Y.Hf=qg;Y.RealTimeConnection=Y.Hf;qg.prototype.sendRequest=qg.prototype.ua;qg.prototype.close=qg.prototype.close;
Y.ag=function(a){var b=Cg.prototype.put;Cg.prototype.put=function(c,d,e,f){p(f)&&(f=a());b.call(this,c,d,e,f)};return function(){Cg.prototype.put=b}};Y.hijackHash=Y.ag;Y.Gf=cc;Y.ConnectionTarget=Y.Gf;Y.ya=function(a){return a.ya()};Y.queryIdentifier=Y.ya;Y.dg=function(a){return a.w.Ua.$};Y.listens=Y.dg;Y.ce=function(a){Th.Wb().ce(a)};Y.forceRestClient=Y.ce;Y.Context=Th;var Z={Wf:function(){fg=ag=!0}};Z.forceLongPolling=Z.Wf;Z.Xf=function(){gg=!0};Z.forceWebSockets=Z.Xf;Z.cg=function(){return $f.isAvailable()};Z.isWebSocketsAvailable=Z.cg;Z.vg=function(a,b){a.w.Ua.ze=b};Z.setSecurityDebugCallback=Z.vg;Z.Be=function(a,b){a.w.Be(b)};Z.stats=Z.Be;Z.Ce=function(a,b){a.w.Ce(b)};Z.statsIncrementCounter=Z.Ce;Z.ed=function(a){return a.w.ed};Z.dataUpdateCount=Z.ed;Z.bg=function(a,b){a.w.je=b};Z.interceptServerData=Z.bg;function ji(a,b){this.committed=a;this.snapshot=b};function W(a,b){if(!(a instanceof Ph))throw Error("new Firebase() no longer supported - use app.database().");X.call(this,a,b,tf,!1);this.then=void 0;this["catch"]=void 0}ka(W,X);g=W.prototype;g.getKey=function(){x("Firebase.key",0,0,arguments.length);return this.path.e()?null:Id(this.path)};
g.m=function(a){x("Firebase.child",1,1,arguments.length);if(fa(a))a=String(a);else if(!(a instanceof M))if(null===J(this.path)){var b=a;b&&(b=b.replace(/^\/*\.info(\/|$)/,"/"));ce("Firebase.child",b)}else ce("Firebase.child",a);return new W(this.w,this.path.m(a))};g.getParent=function(){x("Firebase.parent",0,0,arguments.length);var a=this.path.parent();return null===a?null:new W(this.w,a)};
g.Yf=function(){x("Firebase.ref",0,0,arguments.length);for(var a=this;null!==a.getParent();)a=a.getParent();return a};g.Of=function(){return this.w.$a};g.set=function(a,b){x("Firebase.set",1,2,arguments.length);de("Firebase.set",this.path);Wd("Firebase.set",a,this.path,!1);y("Firebase.set",2,b,!0);var c=new Eb;this.w.Kb(this.path,a,null,Fb(c,b));return c.ra};
g.update=function(a,b){x("Firebase.update",1,2,arguments.length);de("Firebase.update",this.path);if(da(a)){for(var c={},d=0;d<a.length;++d)c[""+d]=a[d];a=c;L("Passing an Array to Firebase.update() is deprecated. Use set() if you want to overwrite the existing data, or an Object with integer keys if you really do want to only update some of the children.")}Zd("Firebase.update",a,this.path);y("Firebase.update",2,b,!0);c=new Eb;this.w.update(this.path,a,Fb(c,b));return c.ra};
g.Kb=function(a,b,c){x("Firebase.setWithPriority",2,3,arguments.length);de("Firebase.setWithPriority",this.path);Wd("Firebase.setWithPriority",a,this.path,!1);$d("Firebase.setWithPriority",2,b);y("Firebase.setWithPriority",3,c,!0);if(".length"===this.getKey()||".keys"===this.getKey())throw"Firebase.setWithPriority failed: "+this.getKey()+" is a read-only object.";var d=new Eb;this.w.Kb(this.path,a,b,Fb(d,c));return d.ra};
g.remove=function(a){x("Firebase.remove",0,1,arguments.length);de("Firebase.remove",this.path);y("Firebase.remove",1,a,!0);return this.set(null,a)};
g.transaction=function(a,b,c){x("Firebase.transaction",1,3,arguments.length);de("Firebase.transaction",this.path);y("Firebase.transaction",1,a,!1);y("Firebase.transaction",2,b,!0);if(p(c)&&"boolean"!=typeof c)throw Error(Bb("Firebase.transaction",3,!0)+"must be a boolean.");if(".length"===this.getKey()||".keys"===this.getKey())throw"Firebase.transaction failed: "+this.getKey()+" is a read-only object.";"undefined"===typeof c&&(c=!0);var d=new Eb;ga(b)&&Gb(d.ra);ai(this.w,this.path,a,function(a,c,
h){a?d.reject(a):d.resolve(new ji(c,h));ga(b)&&b(a,c,h)},c);return d.ra};g.ug=function(a,b){x("Firebase.setPriority",1,2,arguments.length);de("Firebase.setPriority",this.path);$d("Firebase.setPriority",1,a);y("Firebase.setPriority",2,b,!0);var c=new Eb;this.w.Kb(this.path.m(".priority"),a,null,Fb(c,b));return c.ra};
g.push=function(a,b){x("Firebase.push",0,2,arguments.length);de("Firebase.push",this.path);Wd("Firebase.push",a,this.path,!0);y("Firebase.push",2,b,!0);var c=Vh(this.w),d=Nd(c),c=this.m(d);if(null!=a){var e=this,f=c.set(a,b).then(function(){return e.m(d)});c.then=r(f.then,f);c["catch"]=r(f.then,f,void 0);ga(b)&&Gb(f)}return c};g.kb=function(){de("Firebase.onDisconnect",this.path);return new U(this.w,this.path)};W.prototype.child=W.prototype.m;W.prototype.set=W.prototype.set;W.prototype.update=W.prototype.update;
W.prototype.setWithPriority=W.prototype.Kb;W.prototype.remove=W.prototype.remove;W.prototype.transaction=W.prototype.transaction;W.prototype.setPriority=W.prototype.ug;W.prototype.push=W.prototype.push;W.prototype.onDisconnect=W.prototype.kb;id(W.prototype,"database",W.prototype.Of);id(W.prototype,"key",W.prototype.getKey);id(W.prototype,"parent",W.prototype.getParent);id(W.prototype,"root",W.prototype.Yf);if("undefined"===typeof firebase)throw Error("Cannot install Firebase Database - be sure to load firebase-app.js first.");
try{firebase.INTERNAL.registerService("database",function(a){var b=Th.Wb(),c=a.options.databaseURL;p(c)||Xc("Can't determine Firebase Database URL.  Be sure to include databaseURL option when calling firebase.intializeApp().");var d=Yc(c),c=d.kc;ee("Invalid Firebase Database URL",d);d.path.e()||Xc("Database URL must point to the root of a Firebase Database (not including a child path).");(d=A(b.nb,a.name))&&Xc("FIREBASE INTERNAL ERROR: Database initialized multiple times.");d=new Ph(c,b.Ef,a);b.nb[a.name]=
d;return d.$a},{Reference:W,Query:X,Database:Oh,enableLogging:Uc,INTERNAL:Z,TEST_ACCESS:Y,ServerValue:Rh})}catch(ki){Xc("Failed to register the Firebase Database Service ("+ki+")")};})();

(function() {var k,aa=aa||{},m=this,n=function(a){return void 0!==a},ba=function(){},p=function(a){var b=typeof a;if("object"==b)if(a){if(a instanceof Array)return"array";if(a instanceof Object)return b;var c=Object.prototype.toString.call(a);if("[object Window]"==c)return"object";if("[object Array]"==c||"number"==typeof a.length&&"undefined"!=typeof a.splice&&"undefined"!=typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("splice"))return"array";if("[object Function]"==c||"undefined"!=typeof a.call&&"undefined"!=
typeof a.propertyIsEnumerable&&!a.propertyIsEnumerable("call"))return"function"}else return"null";else if("function"==b&&"undefined"==typeof a.call)return"object";return b},ca=function(a){var b=p(a);return"array"==b||"object"==b&&"number"==typeof a.length},q=function(a){return"string"==typeof a},r=function(a){return"function"==p(a)},da=function(a){var b=typeof a;return"object"==b&&null!=a||"function"==b},ea="closure_uid_"+(1E9*Math.random()>>>0),fa=0,ga=function(a,b,c){return a.call.apply(a.bind,
arguments)},ha=function(a,b,c){if(!a)throw Error();if(2<arguments.length){var d=Array.prototype.slice.call(arguments,2);return function(){var c=Array.prototype.slice.call(arguments);Array.prototype.unshift.apply(c,d);return a.apply(b,c)}}return function(){return a.apply(b,arguments)}},t=function(a,b,c){t=Function.prototype.bind&&-1!=Function.prototype.bind.toString().indexOf("native code")?ga:ha;return t.apply(null,arguments)},ia=Date.now||function(){return+new Date},u=function(a,b){function c(){}
c.prototype=b.prototype;a.J=b.prototype;a.prototype=new c;a.Ma=function(a,c,f){for(var g=Array(arguments.length-2),h=2;h<arguments.length;h++)g[h-2]=arguments[h];return b.prototype[c].apply(a,g)}};var ja=function(a,b,c){function d(){N||(N=!0,b.apply(null,arguments))}function e(b){l=setTimeout(function(){l=null;a(f,2===x)},b)}function f(a,b){if(!N)if(a)d.apply(null,arguments);else if(2===x||B)d.apply(null,arguments);else{64>h&&(h*=2);var c;1===x?(x=2,c=0):c=1E3*(h+Math.random());e(c)}}function g(a){Ub||(Ub=!0,N||(null!==l?(a||(x=2),clearTimeout(l),e(0)):a||(x=1)))}var h=1,l=null,B=!1,x=0,N=!1,Ub=!1;e(0);setTimeout(function(){B=!0;g(!0)},c);return g};var ka="https://firebasestorage.googleapis.com";var v=function(a,b){this.code="storage/"+a;this.message="Firebase Storage: "+b;this.serverResponse=null;this.name="FirebaseError"};u(v,Error);var la=function(){return new v("unknown","An unknown error occurred, please check the error payload for server response.")},ma=function(){return new v("canceled","User canceled the upload/download.")},na=function(a,b,c){return new v("invalid-argument","Invalid argument in `"+b+"` at index "+a+": "+c)},oa=function(){return new v("app-deleted","The Firebase app was deleted.")};var pa=function(a,b){for(var c in a)Object.prototype.hasOwnProperty.call(a,c)&&b(c,a[c])},qa=function(a){var b={};pa(a,function(a,d){b[a]=d});return b};var w=function(a,b,c,d){this.l=a;this.f={};this.i=b;this.b={};this.c="";this.N=c;this.g=this.a=null;this.h=[200];this.j=d};var ra={STATE_CHANGED:"state_changed"},sa={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"},ta=function(a){switch(a){case "running":case "pausing":case "canceling":return"running";case "paused":return"paused";case "success":return"success";case "canceled":return"canceled";case "error":return"error";default:return"error"}};var y=function(a){return n(a)&&null!==a},ua=function(a){return"string"===typeof a||a instanceof String};var va=function(a,b,c){this.f=c;this.c=a;this.g=b;this.b=0;this.a=null};va.prototype.get=function(){var a;0<this.b?(this.b--,a=this.a,this.a=a.next,a.next=null):a=this.c();return a};var wa=function(a,b){a.g(b);a.b<a.f&&(a.b++,b.next=a.a,a.a=b)};var xa=function(a){if(Error.captureStackTrace)Error.captureStackTrace(this,xa);else{var b=Error().stack;b&&(this.stack=b)}a&&(this.message=String(a))};u(xa,Error);xa.prototype.name="CustomError";var ya=function(a,b,c,d,e){this.reset(a,b,c,d,e)};ya.prototype.a=null;var za=0;ya.prototype.reset=function(a,b,c,d,e){"number"==typeof e||za++;d||ia();this.b=b;delete this.a};var Aa=function(a){var b=[],c=0,d;for(d in a)b[c++]=a[d];return b},Ba=function(a){var b=[],c=0,d;for(d in a)b[c++]=d;return b},Ca="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" "),Da=function(a,b){for(var c,d,e=1;e<arguments.length;e++){d=arguments[e];for(c in d)a[c]=d[c];for(var f=0;f<Ca.length;f++)c=Ca[f],Object.prototype.hasOwnProperty.call(d,c)&&(a[c]=d[c])}};var Ea=function(a){a.prototype.then=a.prototype.then;a.prototype.$goog_Thenable=!0},Fa=function(a){if(!a)return!1;try{return!!a.$goog_Thenable}catch(b){return!1}};var Ga=function(a){Ga[" "](a);return a};Ga[" "]=ba;var Ha=function(a,b){for(var c=a.split("%s"),d="",e=Array.prototype.slice.call(arguments,1);e.length&&1<c.length;)d+=c.shift()+e.shift();return d+c.join("%s")},Ia=String.prototype.trim?function(a){return a.trim()}:function(a){return a.replace(/^[\s\xa0]+|[\s\xa0]+$/g,"")},Ja=function(a,b){return a<b?-1:a>b?1:0};var Ka=function(a,b){this.a=a;this.b=b};Ka.prototype.clone=function(){return new Ka(this.a,this.b)};var z=function(a,b){this.bucket=a;this.path=b},La=function(a){var b=encodeURIComponent;return"/b/"+b(a.bucket)+"/o/"+b(a.path)},Ma=function(a){for(var b=null,c=[{ka:/^gs:\/\/([A-Za-z0-9.\-]+)(\/(.*))?$/i,da:{bucket:1,path:3},ja:function(a){"/"===a.path.charAt(a.path.length-1)&&(a.path=a.path.slice(0,-1))}},{ka:/^https?:\/\/firebasestorage\.googleapis\.com\/v[A-Za-z0-9_]+\/b\/([A-Za-z0-9.\-]+)\/o(\/([^?#]*).*)?$/i,da:{bucket:1,path:3},ja:function(a){a.path=decodeURIComponent(a.path)}}],d=0;d<c.length;d++){var e=
c[d],f=e.ka.exec(a);if(f){b=f[e.da.bucket];(f=f[e.da.path])||(f="");b=new z(b,f);e.ja(b);break}}if(null==b)throw new v("invalid-url","Invalid URL '"+a+"'.");return b};var Na=function(a,b,c){r(a)||y(b)||y(c)?(this.next=a,this.error=b||null,this.a=c||null):(this.next=a.next||null,this.error=a.error||null,this.a=a.complete||null)};var Oa=function(a){var b=encodeURIComponent,c="?";pa(a,function(a,e){a=b(a)+"="+b(e);c=c+a+"&"});return c=c.slice(0,-1)};var A=function(a,b,c,d,e,f){this.b=a;this.h=b;this.f=c;this.a=d;this.g=e;this.c=f};k=A.prototype;k.qa=function(){return this.b};k.La=function(){return this.h};k.Ia=function(){return this.f};k.Da=function(){return this.a};k.sa=function(){if(y(this.a)){var a=this.a.downloadURLs;return y(a)&&y(a[0])?a[0]:null}return null};k.Ka=function(){return this.g};k.Ga=function(){return this.c};var Pa=function(a,b){b.unshift(a);xa.call(this,Ha.apply(null,b));b.shift()};u(Pa,xa);Pa.prototype.name="AssertionError";
var Qa=function(a,b,c,d){var e="Assertion failed";if(c)var e=e+(": "+c),f=d;else a&&(e+=": "+a,f=b);throw new Pa(""+e,f||[]);},C=function(a,b,c){a||Qa("",null,b,Array.prototype.slice.call(arguments,2))},Ra=function(a,b){throw new Pa("Failure"+(a?": "+a:""),Array.prototype.slice.call(arguments,1));},Sa=function(a,b,c){r(a)||Qa("Expected function but got %s: %s.",[p(a),a],b,Array.prototype.slice.call(arguments,2))};var D=function(){this.g=this.g;this.s=this.s};D.prototype.g=!1;D.prototype.ga=function(){this.g||(this.g=!0,this.C())};D.prototype.C=function(){if(this.s)for(;this.s.length;)this.s.shift()()};var Ta="closure_listenable_"+(1E6*Math.random()|0),Ua=0;var Wa;a:{var Xa=m.navigator;if(Xa){var Ya=Xa.userAgent;if(Ya){Wa=Ya;break a}}Wa=""}var E=function(a){return-1!=Wa.indexOf(a)};var Za=function(){};Za.prototype.a=null;var ab=function(a){var b;(b=a.a)||(b={},$a(a)&&(b[0]=!0,b[1]=!0),b=a.a=b);return b};var bb=Array.prototype.indexOf?function(a,b,c){C(null!=a.length);return Array.prototype.indexOf.call(a,b,c)}:function(a,b,c){c=null==c?0:0>c?Math.max(0,a.length+c):c;if(q(a))return q(b)&&1==b.length?a.indexOf(b,c):-1;for(;c<a.length;c++)if(c in a&&a[c]===b)return c;return-1},cb=Array.prototype.forEach?function(a,b,c){C(null!=a.length);Array.prototype.forEach.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)f in e&&b.call(c,e[f],f,a)},db=Array.prototype.filter?function(a,
b,c){C(null!=a.length);return Array.prototype.filter.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=[],f=0,g=q(a)?a.split(""):a,h=0;h<d;h++)if(h in g){var l=g[h];b.call(c,l,h,a)&&(e[f++]=l)}return e},eb=Array.prototype.map?function(a,b,c){C(null!=a.length);return Array.prototype.map.call(a,b,c)}:function(a,b,c){for(var d=a.length,e=Array(d),f=q(a)?a.split(""):a,g=0;g<d;g++)g in f&&(e[g]=b.call(c,f[g],g,a));return e},fb=Array.prototype.some?function(a,b,c){C(null!=a.length);return Array.prototype.some.call(a,
b,c)}:function(a,b,c){for(var d=a.length,e=q(a)?a.split(""):a,f=0;f<d;f++)if(f in e&&b.call(c,e[f],f,a))return!0;return!1},hb=function(a){var b;a:{b=gb;for(var c=a.length,d=q(a)?a.split(""):a,e=0;e<c;e++)if(e in d&&b.call(void 0,d[e],e,a)){b=e;break a}b=-1}return 0>b?null:q(a)?a.charAt(b):a[b]},ib=function(a){if("array"!=p(a))for(var b=a.length-1;0<=b;b--)delete a[b];a.length=0},jb=function(a,b){b=bb(a,b);var c;if(c=0<=b)C(null!=a.length),Array.prototype.splice.call(a,b,1);return c},kb=function(a){var b=
a.length;if(0<b){for(var c=Array(b),d=0;d<b;d++)c[d]=a[d];return c}return[]};var mb=new va(function(){return new lb},function(a){a.reset()},100),ob=function(){var a=nb,b=null;a.a&&(b=a.a,a.a=a.a.next,a.a||(a.b=null),b.next=null);return b},lb=function(){this.next=this.b=this.a=null};lb.prototype.set=function(a,b){this.a=a;this.b=b;this.next=null};lb.prototype.reset=function(){this.next=this.b=this.a=null};var pb=function(a,b){this.type=a;this.a=this.target=b;this.la=!0};pb.prototype.b=function(){this.la=!1};var qb=function(a,b,c,d,e){this.listener=a;this.a=null;this.src=b;this.type=c;this.W=!!d;this.N=e;++Ua;this.O=this.V=!1},rb=function(a){a.O=!0;a.listener=null;a.a=null;a.src=null;a.N=null};var sb=/^(?:([^:/?#.]+):)?(?:\/\/(?:([^/?#]*)@)?([^/#?]*?)(?::([0-9]+))?(?=[/#?]|$))?([^?#]+)?(?:\?([^#]*))?(?:#(.*))?$/;var tb=function(a,b){b=db(b.split("/"),function(a){return 0<a.length}).join("/");return 0===a.length?b:a+"/"+b},ub=function(a){var b=a.lastIndexOf("/",a.length-2);return-1===b?a:a.slice(b+1)};var vb=function(a){this.src=a;this.a={};this.b=0},xb=function(a,b,c,d,e,f){var g=b.toString();b=a.a[g];b||(b=a.a[g]=[],a.b++);var h=wb(b,c,e,f);-1<h?(a=b[h],d||(a.V=!1)):(a=new qb(c,a.src,g,!!e,f),a.V=d,b.push(a));return a},yb=function(a,b){var c=b.type;c in a.a&&jb(a.a[c],b)&&(rb(b),0==a.a[c].length&&(delete a.a[c],a.b--))},wb=function(a,b,c,d){for(var e=0;e<a.length;++e){var f=a[e];if(!f.O&&f.listener==b&&f.W==!!c&&f.N==d)return e}return-1};var zb,Ab=function(){};u(Ab,Za);var Bb=function(a){return(a=$a(a))?new ActiveXObject(a):new XMLHttpRequest},$a=function(a){if(!a.b&&"undefined"==typeof XMLHttpRequest&&"undefined"!=typeof ActiveXObject){for(var b=["MSXML2.XMLHTTP.6.0","MSXML2.XMLHTTP.3.0","MSXML2.XMLHTTP","Microsoft.XMLHTTP"],c=0;c<b.length;c++){var d=b[c];try{return new ActiveXObject(d),a.b=d}catch(e){}}throw Error("Could not create ActiveXObject. ActiveX might be disabled, or MSXML might not be installed");}return a.b};zb=new Ab;var Cb=function(a){this.a=[];if(a)a:{var b;if(a instanceof Cb){if(b=a.H(),a=a.w(),0>=this.o()){for(var c=this.a,d=0;d<b.length;d++)c.push(new Ka(b[d],a[d]));break a}}else b=Ba(a),a=Aa(a);for(d=0;d<b.length;d++)Db(this,b[d],a[d])}},Db=function(a,b,c){var d=a.a;d.push(new Ka(b,c));b=d.length-1;a=a.a;for(c=a[b];0<b;)if(d=b-1>>1,a[d].a>c.a)a[b]=a[d],b=d;else break;a[b]=c};k=Cb.prototype;k.w=function(){for(var a=this.a,b=[],c=a.length,d=0;d<c;d++)b.push(a[d].b);return b};
k.H=function(){for(var a=this.a,b=[],c=a.length,d=0;d<c;d++)b.push(a[d].a);return b};k.clone=function(){return new Cb(this)};k.o=function(){return this.a.length};k.I=function(){return 0==this.a.length};k.clear=function(){ib(this.a)};var Eb=function(){this.b=[];this.a=[]},Fb=function(a){0==a.b.length&&(a.b=a.a,a.b.reverse(),a.a=[]);return a.b.pop()};Eb.prototype.o=function(){return this.b.length+this.a.length};Eb.prototype.I=function(){return 0==this.b.length&&0==this.a.length};Eb.prototype.clear=function(){this.b=[];this.a=[]};Eb.prototype.w=function(){for(var a=[],b=this.b.length-1;0<=b;--b)a.push(this.b[b]);for(var c=this.a.length,b=0;b<c;++b)a.push(this.a[b]);return a};var Gb=function(a){if(a.w&&"function"==typeof a.w)return a.w();if(q(a))return a.split("");if(ca(a)){for(var b=[],c=a.length,d=0;d<c;d++)b.push(a[d]);return b}return Aa(a)},Hb=function(a,b){if(a.forEach&&"function"==typeof a.forEach)a.forEach(b,void 0);else if(ca(a)||q(a))cb(a,b,void 0);else{var c;if(a.H&&"function"==typeof a.H)c=a.H();else if(a.w&&"function"==typeof a.w)c=void 0;else if(ca(a)||q(a)){c=[];for(var d=a.length,e=0;e<d;e++)c.push(e)}else c=Ba(a);for(var d=Gb(a),e=d.length,f=0;f<e;f++)b.call(void 0,
d[f],c&&c[f],a)}};var Ib=function(a){m.setTimeout(function(){throw a;},0)},Jb,Kb=function(){var a=m.MessageChannel;"undefined"===typeof a&&"undefined"!==typeof window&&window.postMessage&&window.addEventListener&&!E("Presto")&&(a=function(){var a=document.createElement("IFRAME");a.style.display="none";a.src="";document.documentElement.appendChild(a);var b=a.contentWindow,a=b.document;a.open();a.write("");a.close();var c="callImmediate"+Math.random(),d="file:"==b.location.protocol?"*":b.location.protocol+"//"+b.location.host,
a=t(function(a){if(("*"==d||a.origin==d)&&a.data==c)this.port1.onmessage()},this);b.addEventListener("message",a,!1);this.port1={};this.port2={postMessage:function(){b.postMessage(c,d)}}});if("undefined"!==typeof a&&!E("Trident")&&!E("MSIE")){var b=new a,c={},d=c;b.port1.onmessage=function(){if(n(c.next)){c=c.next;var a=c.fa;c.fa=null;a()}};return function(a){d.next={fa:a};d=d.next;b.port2.postMessage(0)}}return"undefined"!==typeof document&&"onreadystatechange"in document.createElement("SCRIPT")?
function(a){var b=document.createElement("SCRIPT");b.onreadystatechange=function(){b.onreadystatechange=null;b.parentNode.removeChild(b);b=null;a();a=null};document.documentElement.appendChild(b)}:function(a){m.setTimeout(a,0)}};var Lb="StopIteration"in m?m.StopIteration:{message:"StopIteration",stack:""},Mb=function(){};Mb.prototype.next=function(){throw Lb;};Mb.prototype.aa=function(){return this};var Nb=function(){Cb.call(this)};u(Nb,Cb);var Ob=E("Opera"),F=E("Trident")||E("MSIE"),Pb=E("Edge"),Qb=E("Gecko")&&!(-1!=Wa.toLowerCase().indexOf("webkit")&&!E("Edge"))&&!(E("Trident")||E("MSIE"))&&!E("Edge"),Rb=-1!=Wa.toLowerCase().indexOf("webkit")&&!E("Edge"),Sb=function(){var a=m.document;return a?a.documentMode:void 0},Tb;
a:{var Vb="",Wb=function(){var a=Wa;if(Qb)return/rv\:([^\);]+)(\)|;)/.exec(a);if(Pb)return/Edge\/([\d\.]+)/.exec(a);if(F)return/\b(?:MSIE|rv)[: ]([^\);]+)(\)|;)/.exec(a);if(Rb)return/WebKit\/(\S+)/.exec(a);if(Ob)return/(?:Version)[ \/]?(\S+)/.exec(a)}();Wb&&(Vb=Wb?Wb[1]:"");if(F){var Xb=Sb();if(null!=Xb&&Xb>parseFloat(Vb)){Tb=String(Xb);break a}}Tb=Vb}
var Yb=Tb,Zb={},G=function(a){var b;if(!(b=Zb[a])){b=0;for(var c=Ia(String(Yb)).split("."),d=Ia(String(a)).split("."),e=Math.max(c.length,d.length),f=0;0==b&&f<e;f++){var g=c[f]||"",h=d[f]||"",l=/(\d*)(\D*)/g,B=/(\d*)(\D*)/g;do{var x=l.exec(g)||["","",""],N=B.exec(h)||["","",""];if(0==x[0].length&&0==N[0].length)break;b=Ja(0==x[1].length?0:parseInt(x[1],10),0==N[1].length?0:parseInt(N[1],10))||Ja(0==x[2].length,0==N[2].length)||Ja(x[2],N[2])}while(0==b)}b=Zb[a]=0<=b}return b},$b=m.document,ac=$b&&
F?Sb()||("CSS1Compat"==$b.compatMode?parseInt(Yb,10):5):void 0;var ec=function(a,b){bc||cc();dc||(bc(),dc=!0);var c=nb,d=mb.get();d.set(a,b);c.b?c.b.next=d:(C(!c.a),c.a=d);c.b=d},bc,cc=function(){if(m.Promise&&m.Promise.resolve){var a=m.Promise.resolve(void 0);bc=function(){a.then(fc)}}else bc=function(){var a=fc;!r(m.setImmediate)||m.Window&&m.Window.prototype&&!E("Edge")&&m.Window.prototype.setImmediate==m.setImmediate?(Jb||(Jb=Kb()),Jb(a)):m.setImmediate(a)}},dc=!1,nb=new function(){this.b=this.a=null},fc=function(){for(var a;a=ob();){try{a.a.call(a.b)}catch(b){Ib(b)}wa(mb,
a)}dc=!1};var gc;(gc=!F)||(gc=9<=Number(ac));var hc=gc,ic=F&&!G("9");!Rb||G("528");Qb&&G("1.9b")||F&&G("8")||Ob&&G("9.5")||Rb&&G("528");Qb&&!G("8")||F&&G("9");var jc=function(a,b){this.b={};this.a=[];this.f=this.c=0;var c=arguments.length;if(1<c){if(c%2)throw Error("Uneven number of arguments");for(var d=0;d<c;d+=2)this.set(arguments[d],arguments[d+1])}else if(a){a instanceof jc?(c=a.H(),d=a.w()):(c=Ba(a),d=Aa(a));for(var e=0;e<c.length;e++)this.set(c[e],d[e])}};k=jc.prototype;k.o=function(){return this.c};k.w=function(){kc(this);for(var a=[],b=0;b<this.a.length;b++)a.push(this.b[this.a[b]]);return a};k.H=function(){kc(this);return this.a.concat()};
k.I=function(){return 0==this.c};k.clear=function(){this.b={};this.f=this.c=this.a.length=0};
var lc=function(a,b){return Object.prototype.hasOwnProperty.call(a.b,b)?(delete a.b[b],a.c--,a.f++,a.a.length>2*a.c&&kc(a),!0):!1},kc=function(a){if(a.c!=a.a.length){for(var b=0,c=0;b<a.a.length;){var d=a.a[b];Object.prototype.hasOwnProperty.call(a.b,d)&&(a.a[c++]=d);b++}a.a.length=c}if(a.c!=a.a.length){for(var e={},c=b=0;b<a.a.length;)d=a.a[b],Object.prototype.hasOwnProperty.call(e,d)||(a.a[c++]=d,e[d]=1),b++;a.a.length=c}};k=jc.prototype;
k.get=function(a,b){return Object.prototype.hasOwnProperty.call(this.b,a)?this.b[a]:b};k.set=function(a,b){Object.prototype.hasOwnProperty.call(this.b,a)||(this.c++,this.a.push(a),this.f++);this.b[a]=b};k.forEach=function(a,b){for(var c=this.H(),d=0;d<c.length;d++){var e=c[d],f=this.get(e);a.call(b,f,e,this)}};k.clone=function(){return new jc(this)};
k.aa=function(a){kc(this);var b=0,c=this.f,d=this,e=new Mb;e.next=function(){if(c!=d.f)throw Error("The map has changed since the iterator was created");if(b>=d.a.length)throw Lb;var e=d.a[b++];return a?e:d.b[e]};return e};var mc=function(a,b){pb.call(this,a?a.type:"");this.c=this.a=this.target=null;if(a){this.type=a.type;this.target=a.target||a.srcElement;this.a=b;if((b=a.relatedTarget)&&Qb)try{Ga(b.nodeName)}catch(c){}this.c=a;a.defaultPrevented&&this.b()}};u(mc,pb);mc.prototype.b=function(){mc.J.b.call(this);var a=this.c;if(a.preventDefault)a.preventDefault();else if(a.returnValue=!1,ic)try{if(a.ctrlKey||112<=a.keyCode&&123>=a.keyCode)a.keyCode=-1}catch(b){}};var H=function(a,b){this.a=0;this.i=void 0;this.c=this.b=this.f=null;this.g=this.h=!1;if(a!=ba)try{var c=this;a.call(b,function(a){nc(c,2,a)},function(a){try{if(a instanceof Error)throw a;throw Error("Promise rejected.");}catch(b){}nc(c,3,a)})}catch(d){nc(this,3,d)}},oc=function(){this.next=this.f=this.c=this.a=this.b=null;this.g=!1};oc.prototype.reset=function(){this.f=this.c=this.a=this.b=null;this.g=!1};
var pc=new va(function(){return new oc},function(a){a.reset()},100),qc=function(a,b,c){var d=pc.get();d.a=a;d.c=b;d.f=c;return d},rc=function(a){if(a instanceof H)return a;var b=new H(ba);nc(b,2,a);return b},sc=function(a){return new H(function(b,c){c(a)})};
H.prototype.then=function(a,b,c){null!=a&&Sa(a,"opt_onFulfilled should be a function.");null!=b&&Sa(b,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?");return tc(this,r(a)?a:null,r(b)?b:null,c)};Ea(H);H.prototype.l=function(a,b){return tc(this,null,a,b)};
var vc=function(a,b){a.b||2!=a.a&&3!=a.a||uc(a);C(null!=b.a);a.c?a.c.next=b:a.b=b;a.c=b},tc=function(a,b,c,d){var e=qc(null,null,null);e.b=new H(function(a,g){e.a=b?function(c){try{var e=b.call(d,c);a(e)}catch(B){g(B)}}:a;e.c=c?function(b){try{var e=c.call(d,b);a(e)}catch(B){g(B)}}:g});e.b.f=a;vc(a,e);return e.b};H.prototype.s=function(a){C(1==this.a);this.a=0;nc(this,2,a)};H.prototype.m=function(a){C(1==this.a);this.a=0;nc(this,3,a)};
var nc=function(a,b,c){if(0==a.a){a===c&&(b=3,c=new TypeError("Promise cannot resolve to itself"));a.a=1;var d;a:{var e=c,f=a.s,g=a.m;if(e instanceof H)null!=f&&Sa(f,"opt_onFulfilled should be a function."),null!=g&&Sa(g,"opt_onRejected should be a function. Did you pass opt_context as the second argument instead of the third?"),vc(e,qc(f||ba,g||null,a)),d=!0;else if(Fa(e))e.then(f,g,a),d=!0;else{if(da(e))try{var h=e.then;if(r(h)){wc(e,h,f,g,a);d=!0;break a}}catch(l){g.call(a,l);d=!0;break a}d=!1}}d||
(a.i=c,a.a=b,a.f=null,uc(a),3!=b||xc(a,c))}},wc=function(a,b,c,d,e){var f=!1,g=function(a){f||(f=!0,c.call(e,a))},h=function(a){f||(f=!0,d.call(e,a))};try{b.call(a,g,h)}catch(l){h(l)}},uc=function(a){a.h||(a.h=!0,ec(a.j,a))},yc=function(a){var b=null;a.b&&(b=a.b,a.b=b.next,b.next=null);a.b||(a.c=null);null!=b&&C(null!=b.a);return b};
H.prototype.j=function(){for(var a;a=yc(this);){var b=this.a,c=this.i;if(3==b&&a.c&&!a.g){var d;for(d=this;d&&d.g;d=d.f)d.g=!1}if(a.b)a.b.f=null,zc(a,b,c);else try{a.g?a.a.call(a.f):zc(a,b,c)}catch(e){Ac.call(null,e)}wa(pc,a)}this.h=!1};var zc=function(a,b,c){2==b?a.a.call(a.f,c):a.c&&a.c.call(a.f,c)},xc=function(a,b){a.g=!0;ec(function(){a.g&&Ac.call(null,b)})},Ac=Ib;var Cc=function(a){this.a=new jc;if(a){a=Gb(a);for(var b=a.length,c=0;c<b;c++){var d=a[c];this.a.set(Bc(d),d)}}},Bc=function(a){var b=typeof a;return"object"==b&&a||"function"==b?"o"+(a[ea]||(a[ea]=++fa)):b.substr(0,1)+a};k=Cc.prototype;k.o=function(){return this.a.o()};k.clear=function(){this.a.clear()};k.I=function(){return this.a.I()};k.w=function(){return this.a.w()};k.clone=function(){return new Cc(this)};k.aa=function(){return this.a.aa(!1)};var Dc=function(a){return function(){var b=[];Array.prototype.push.apply(b,arguments);rc(!0).then(function(){a.apply(null,b)})}};var Ec="closure_lm_"+(1E6*Math.random()|0),Fc={},Gc=0,Hc=function(a,b,c,d,e){if("array"==p(b)){for(var f=0;f<b.length;f++)Hc(a,b[f],c,d,e);return null}c=Ic(c);a&&a[Ta]?(Jc(a),a=xb(a.b,String(b),c,!1,d,e)):a=Kc(a,b,c,!1,d,e);return a},Kc=function(a,b,c,d,e,f){if(!b)throw Error("Invalid event type");var g=!!e,h=Lc(a);h||(a[Ec]=h=new vb(a));c=xb(h,b,c,d,e,f);if(c.a)return c;d=Mc();c.a=d;d.src=a;d.listener=c;if(a.addEventListener)a.addEventListener(b.toString(),d,g);else if(a.attachEvent)a.attachEvent(Nc(b.toString()),
d);else throw Error("addEventListener and attachEvent are unavailable.");Gc++;return c},Mc=function(){var a=Oc,b=hc?function(c){return a.call(b.src,b.listener,c)}:function(c){c=a.call(b.src,b.listener,c);if(!c)return c};return b},Pc=function(a,b,c,d,e){if("array"==p(b))for(var f=0;f<b.length;f++)Pc(a,b[f],c,d,e);else c=Ic(c),a&&a[Ta]?xb(a.b,String(b),c,!0,d,e):Kc(a,b,c,!0,d,e)},Qc=function(a,b,c,d,e){if("array"==p(b))for(var f=0;f<b.length;f++)Qc(a,b[f],c,d,e);else(c=Ic(c),a&&a[Ta])?(a=a.b,b=String(b).toString(),
b in a.a&&(f=a.a[b],c=wb(f,c,d,e),-1<c&&(rb(f[c]),C(null!=f.length),Array.prototype.splice.call(f,c,1),0==f.length&&(delete a.a[b],a.b--)))):a&&(a=Lc(a))&&(b=a.a[b.toString()],a=-1,b&&(a=wb(b,c,!!d,e)),(c=-1<a?b[a]:null)&&Rc(c))},Rc=function(a){if("number"!=typeof a&&a&&!a.O){var b=a.src;if(b&&b[Ta])yb(b.b,a);else{var c=a.type,d=a.a;b.removeEventListener?b.removeEventListener(c,d,a.W):b.detachEvent&&b.detachEvent(Nc(c),d);Gc--;(c=Lc(b))?(yb(c,a),0==c.b&&(c.src=null,b[Ec]=null)):rb(a)}}},Nc=function(a){return a in
Fc?Fc[a]:Fc[a]="on"+a},Tc=function(a,b,c,d){var e=!0;if(a=Lc(a))if(b=a.a[b.toString()])for(b=b.concat(),a=0;a<b.length;a++){var f=b[a];f&&f.W==c&&!f.O&&(f=Sc(f,d),e=e&&!1!==f)}return e},Sc=function(a,b){var c=a.listener,d=a.N||a.src;a.V&&Rc(a);return c.call(d,b)},Oc=function(a,b){if(a.O)return!0;if(!hc){if(!b)a:{b=["window","event"];for(var c=m,d;d=b.shift();)if(null!=c[d])c=c[d];else{b=null;break a}b=c}d=b;b=new mc(d,this);c=!0;if(!(0>d.keyCode||void 0!=d.returnValue)){a:{var e=!1;if(0==d.keyCode)try{d.keyCode=
-1;break a}catch(g){e=!0}if(e||void 0==d.returnValue)d.returnValue=!0}d=[];for(e=b.a;e;e=e.parentNode)d.push(e);a=a.type;for(e=d.length-1;0<=e;e--){b.a=d[e];var f=Tc(d[e],a,!0,b),c=c&&f}for(e=0;e<d.length;e++)b.a=d[e],f=Tc(d[e],a,!1,b),c=c&&f}return c}return Sc(a,new mc(b,this))},Lc=function(a){a=a[Ec];return a instanceof vb?a:null},Uc="__closure_events_fn_"+(1E9*Math.random()>>>0),Ic=function(a){C(a,"Listener can not be null.");if(r(a))return a;C(a.handleEvent,"An object listener must have handleEvent method.");
a[Uc]||(a[Uc]=function(b){return a.handleEvent(b)});return a[Uc]};var I=function(a,b){D.call(this);this.l=a||0;this.c=b||10;if(this.l>this.c)throw Error("[goog.structs.Pool] Min can not be greater than max");this.a=new Eb;this.b=new Cc;this.i=null;this.U()};u(I,D);I.prototype.Y=function(){var a=ia();if(!(null!=this.i&&0>a-this.i)){for(var b;0<this.a.o()&&(b=Fb(this.a),!this.j(b));)this.U();!b&&this.o()<this.c&&(b=this.h());b&&(this.i=a,this.b.a.set(Bc(b),b));return b}};var Wc=function(a){var b=Vc;lc(b.b.a,Bc(a))&&b.ba(a)};
I.prototype.ba=function(a){lc(this.b.a,Bc(a));this.j(a)&&this.o()<this.c?this.a.a.push(a):Xc(a)};I.prototype.U=function(){for(var a=this.a;this.o()<this.l;){var b=this.h();a.a.push(b)}for(;this.o()>this.c&&0<this.a.o();)Xc(Fb(a))};I.prototype.h=function(){return{}};var Xc=function(a){if("function"==typeof a.ga)a.ga();else for(var b in a)a[b]=null};I.prototype.j=function(a){return"function"==typeof a.ra?a.ra():!0};I.prototype.o=function(){return this.a.o()+this.b.o()};
I.prototype.I=function(){return this.a.I()&&this.b.I()};I.prototype.C=function(){I.J.C.call(this);if(0<this.b.o())throw Error("[goog.structs.Pool] Objects not released");delete this.b;for(var a=this.a;!a.I();)Xc(Fb(a));delete this.a};/*
 Portions of this code are from MochiKit, received by
 The Closure Authors under the MIT license. All other code is Copyright
 2005-2009 The Closure Authors. All Rights Reserved.
*/
var Yc=function(a,b){this.c=[];this.m=b||null;this.a=this.h=!1;this.b=void 0;this.j=this.g=!1;this.f=0;this.i=null;this.s=0};Yc.prototype.l=function(a,b){this.g=!1;this.h=!0;this.b=b;this.a=!a;Zc(this)};var $c=function(a,b,c){C(!a.j,"Blocking Deferreds can not be re-used");a.c.push([b,c,void 0]);a.h&&Zc(a)};Yc.prototype.then=function(a,b,c){var d,e,f=new H(function(a,b){d=a;e=b});$c(this,d,function(a){e(a)});return f.then(a,b,c)};Ea(Yc);
var ad=function(a){return fb(a.c,function(a){return r(a[1])})},Zc=function(a){if(a.f&&a.h&&ad(a)){var b=a.f,c=bd[b];c&&(m.clearTimeout(c.a),delete bd[b]);a.f=0}a.i&&(a.i.s--,delete a.i);for(var b=a.b,d=c=!1;a.c.length&&!a.g;){var e=a.c.shift(),f=e[0],g=e[1],e=e[2];if(f=a.a?g:f)try{var h=f.call(e||a.m,b);n(h)&&(a.a=a.a&&(h==b||h instanceof Error),a.b=b=h);if(Fa(b)||"function"===typeof m.Promise&&b instanceof m.Promise)d=!0,a.g=!0}catch(l){b=l,a.a=!0,ad(a)||(c=!0)}}a.b=b;d&&(h=t(a.l,a,!0),d=t(a.l,a,
!1),b instanceof Yc?($c(b,h,d),b.j=!0):b.then(h,d));c&&(b=new cd(b),bd[b.a]=b,a.f=b.a)},cd=function(a){this.a=m.setTimeout(t(this.c,this),0);this.b=a};cd.prototype.c=function(){C(bd[this.a],"Cannot throw an error that is not scheduled.");delete bd[this.a];throw this.b;};var bd={};var dd=function(a){this.f=a;this.b=this.c=this.a=null},ed=function(a,b){this.name=a;this.value=b};ed.prototype.toString=function(){return this.name};var fd=new ed("SEVERE",1E3),gd=new ed("CONFIG",700),hd=new ed("FINE",500),id=function(a){if(a.c)return a.c;if(a.a)return id(a.a);Ra("Root logger has no level set.");return null};
dd.prototype.log=function(a,b,c){if(a.value>=id(this).value)for(r(b)&&(b=b()),a=new ya(a,String(b),this.f),c&&(a.a=c),c="log:"+a.b,m.console&&(m.console.timeStamp?m.console.timeStamp(c):m.console.markTimeline&&m.console.markTimeline(c)),m.msWriteProfilerMark&&m.msWriteProfilerMark(c),c=this;c;)c=c.a};
var jd={},kd=null,ld=function(a){kd||(kd=new dd(""),jd[""]=kd,kd.c=gd);var b;if(!(b=jd[a])){b=new dd(a);var c=a.lastIndexOf("."),d=a.substr(c+1),c=ld(a.substr(0,c));c.b||(c.b={});c.b[d]=b;b.a=c;jd[a]=b}return b};var J=function(){D.call(this);this.b=new vb(this);this.$=this;this.G=null};u(J,D);J.prototype[Ta]=!0;J.prototype.removeEventListener=function(a,b,c,d){Qc(this,a,b,c,d)};
var K=function(a,b){Jc(a);var c,d=a.G;if(d){c=[];for(var e=1;d;d=d.G)c.push(d),C(1E3>++e,"infinite loop")}a=a.$;d=b.type||b;q(b)?b=new pb(b,a):b instanceof pb?b.target=b.target||a:(e=b,b=new pb(d,a),Da(b,e));var e=!0,f;if(c)for(var g=c.length-1;0<=g;g--)f=b.a=c[g],e=md(f,d,!0,b)&&e;f=b.a=a;e=md(f,d,!0,b)&&e;e=md(f,d,!1,b)&&e;if(c)for(g=0;g<c.length;g++)f=b.a=c[g],e=md(f,d,!1,b)&&e};
J.prototype.C=function(){J.J.C.call(this);if(this.b){var a=this.b,b=0,c;for(c in a.a){for(var d=a.a[c],e=0;e<d.length;e++)++b,rb(d[e]);delete a.a[c];a.b--}}this.G=null};var md=function(a,b,c,d){b=a.b.a[String(b)];if(!b)return!0;b=b.concat();for(var e=!0,f=0;f<b.length;++f){var g=b[f];if(g&&!g.O&&g.W==c){var h=g.listener,l=g.N||g.src;g.V&&yb(a.b,g);e=!1!==h.call(l,d)&&e}}return e&&0!=d.la},Jc=function(a){C(a.b,"Event target is not initialized. Did you call the superclass (goog.events.EventTarget) constructor?")};var L=function(a,b){this.f=new Nb;I.call(this,a,b)};u(L,I);k=L.prototype;k.Y=function(a,b){if(!a)return L.J.Y.call(this);Db(this.f,n(b)?b:100,a);this.ca()};k.ca=function(){for(var a=this.f;0<a.o();){var b=this.Y();if(b){var c;var d=a,e=d.a,f=e.length;c=e[0];if(0>=f)c=void 0;else{if(1==f)ib(e);else{e[0]=e.pop();for(var e=0,d=d.a,f=d.length,g=d[e];e<f>>1;){var h=2*e+1,l=2*e+2,h=l<f&&d[l].a<d[h].a?l:h;if(d[h].a>g.a)break;d[e]=d[h];e=h}d[e]=g}c=c.b}c.apply(this,[b])}else break}};
k.ba=function(a){L.J.ba.call(this,a);this.ca()};k.U=function(){L.J.U.call(this);this.ca()};k.C=function(){L.J.C.call(this);m.clearTimeout(void 0);this.f.clear();this.f=null};var M=function(a,b){a&&a.log(hd,b,void 0)};var nd=function(a,b,c){if(r(a))c&&(a=t(a,c));else if(a&&"function"==typeof a.handleEvent)a=t(a.handleEvent,a);else throw Error("Invalid listener argument");return 2147483647<Number(b)?-1:m.setTimeout(a,b||0)};var O=function(a){J.call(this);this.L=new jc;this.B=a||null;this.c=!1;this.A=this.a=null;this.P=this.l="";this.K=0;this.h="";this.f=this.F=this.j=this.D=!1;this.i=0;this.m=null;this.T="";this.u=this.ea=this.Z=!1};u(O,J);var od=O.prototype,pd=ld("goog.net.XhrIo");od.v=pd;var qd=/^https?$/i,rd=["POST","PUT"];
O.prototype.send=function(a,b,c,d){if(this.a)throw Error("[goog.net.XhrIo] Object is active with another request="+this.l+"; newUri="+a);b=b?b.toUpperCase():"GET";this.l=a;this.h="";this.K=0;this.P=b;this.D=!1;this.c=!0;this.a=this.B?Bb(this.B):Bb(zb);this.A=this.B?ab(this.B):ab(zb);this.a.onreadystatechange=t(this.S,this);this.ea&&"onprogress"in this.a&&(this.a.onprogress=t(function(a){this.R(a,!0)},this),this.a.upload&&(this.a.upload.onprogress=t(this.R,this)));try{M(this.v,P(this,"Opening Xhr")),
this.F=!0,this.a.open(b,String(a),!0),this.F=!1}catch(f){M(this.v,P(this,"Error opening Xhr: "+f.message));sd(this,f);return}a=c||"";var e=this.L.clone();d&&Hb(d,function(a,b){e.set(b,a)});d=hb(e.H());c=m.FormData&&a instanceof m.FormData;!(0<=bb(rd,b))||d||c||e.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");e.forEach(function(a,b){this.a.setRequestHeader(b,a)},this);this.T&&(this.a.responseType=this.T);"withCredentials"in this.a&&this.a.withCredentials!==this.Z&&(this.a.withCredentials=
this.Z);try{td(this),0<this.i&&(this.u=ud(this.a),M(this.v,P(this,"Will abort after "+this.i+"ms if incomplete, xhr2 "+this.u)),this.u?(this.a.timeout=this.i,this.a.ontimeout=t(this.M,this)):this.m=nd(this.M,this.i,this)),M(this.v,P(this,"Sending request")),this.j=!0,this.a.send(a),this.j=!1}catch(f){M(this.v,P(this,"Send error: "+f.message)),sd(this,f)}};var ud=function(a){return F&&G(9)&&"number"==typeof a.timeout&&n(a.ontimeout)},gb=function(a){return"content-type"==a.toLowerCase()};
O.prototype.M=function(){"undefined"!=typeof aa&&this.a&&(this.h="Timed out after "+this.i+"ms, aborting",this.K=8,M(this.v,P(this,this.h)),K(this,"timeout"),vd(this,8))};var sd=function(a,b){a.c=!1;a.a&&(a.f=!0,a.a.abort(),a.f=!1);a.h=b;a.K=5;wd(a);xd(a)},wd=function(a){a.D||(a.D=!0,K(a,"complete"),K(a,"error"))},vd=function(a,b){a.a&&a.c&&(M(a.v,P(a,"Aborting")),a.c=!1,a.f=!0,a.a.abort(),a.f=!1,a.K=b||7,K(a,"complete"),K(a,"abort"),xd(a))};
O.prototype.C=function(){this.a&&(this.c&&(this.c=!1,this.f=!0,this.a.abort(),this.f=!1),xd(this,!0));O.J.C.call(this)};O.prototype.S=function(){this.g||(this.F||this.j||this.f?yd(this):this.na())};O.prototype.na=function(){yd(this)};
var yd=function(a){if(a.c&&"undefined"!=typeof aa)if(a.A[1]&&4==zd(a)&&2==Q(a))M(a.v,P(a,"Local request error detected and ignored"));else if(a.j&&4==zd(a))nd(a.S,0,a);else if(K(a,"readystatechange"),4==zd(a)){M(a.v,P(a,"Request complete"));a.c=!1;try{if(Bd(a))K(a,"complete"),K(a,"success");else{a.K=6;var b;try{b=2<zd(a)?a.a.statusText:""}catch(c){M(a.v,"Can not get status: "+c.message),b=""}a.h=b+" ["+Q(a)+"]";wd(a)}}finally{xd(a)}}};
O.prototype.R=function(a,b){C("progress"===a.type,"goog.net.EventType.PROGRESS is of the same type as raw XHR progress.");K(this,Cd(a,"progress"));K(this,Cd(a,b?"downloadprogress":"uploadprogress"))};
var Cd=function(a,b){return{type:b,lengthComputable:a.lengthComputable,loaded:a.loaded,total:a.total}},xd=function(a,b){if(a.a){td(a);var c=a.a,d=a.A[0]?ba:null;a.a=null;a.A=null;b||K(a,"ready");try{c.onreadystatechange=d}catch(e){(a=a.v)&&a.log(fd,"Problem encountered resetting onreadystatechange: "+e.message,void 0)}}},td=function(a){a.a&&a.u&&(a.a.ontimeout=null);"number"==typeof a.m&&(m.clearTimeout(a.m),a.m=null)},Bd=function(a){var b=Q(a),c;a:switch(b){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:c=
!0;break a;default:c=!1}if(!c){if(b=0===b)a=String(a.l).match(sb)[1]||null,!a&&m.self&&m.self.location&&(a=m.self.location.protocol,a=a.substr(0,a.length-1)),b=!qd.test(a?a.toLowerCase():"");c=b}return c},zd=function(a){return a.a?a.a.readyState:0},Q=function(a){try{return 2<zd(a)?a.a.status:-1}catch(b){return-1}},Dd=function(a){try{return a.a?a.a.responseText:""}catch(b){return M(a.v,"Can not get responseText: "+b.message),""}},Ed=function(a,b){return a.a&&4==zd(a)?a.a.getResponseHeader(b):void 0},
P=function(a,b){return b+" ["+a.P+" "+a.l+" "+Q(a)+"]"};var Fd=function(a,b,c,d){this.m=a;this.u=!!d;L.call(this,b,c)};u(Fd,L);Fd.prototype.h=function(){var a=new O,b=this.m;b&&b.forEach(function(b,d){a.L.set(d,b)});this.u&&(a.Z=!0);return a};Fd.prototype.j=function(a){return!a.g&&!a.a};var Vc=new Fd;var Hd=function(a,b,c,d,e,f,g,h,l,B){this.L=a;this.F=b;this.A=c;this.m=d;this.G=e.slice();this.l=this.s=this.f=this.c=null;this.h=this.i=!1;this.u=f;this.j=g;this.g=l;this.M=B;this.D=h;var x=this;this.B=new H(function(a,b){x.s=a;x.l=b;Gd(x)})},Id=function(a,b,c){this.b=a;this.c=b;this.a=!!c},Gd=function(a){function b(a,b){b?a(!1,new Id(!1,null,!0)):Vc.Y(function(b){b.Z=d.M;d.c=b;var c=null;null!==d.g&&(b.ea=!0,c=Hc(b,"uploadprogress",function(a){d.g(a.loaded,a.lengthComputable?a.total:-1)}),b.ea=
null!==d.g);b.send(d.L,d.F,d.m,d.A);Pc(b,"complete",function(b){null!==c&&Rc(c);d.c=null;b=b.target;var f=6===b.K&&100<=Q(b),f=Bd(b)||f,g=Q(b);!f||500<=g&&600>g||429===g?(f=7===b.K,Wc(b),a(!1,new Id(!1,null,f))):(f=0<=bb(d.G,g),a(!0,new Id(f,b)))})})}function c(a,b){var c=d.s;a=d.l;var h=b.c;if(b.b)try{var l=d.u(h,Dd(h));n(l)?c(l):c()}catch(B){a(B)}else null!==h?(b=la(),l=Dd(h),b.serverResponse=l,d.j?a(d.j(h,b)):a(b)):(b=b.a?d.h?oa():ma():new v("retry-limit-exceeded","Max retry time for operation exceeded, please try again."),
a(b));Wc(h)}var d=a;a.i?c(0,new Id(!1,null,!0)):a.f=ja(b,c,a.D)};Hd.prototype.a=function(){return this.B};Hd.prototype.b=function(a){this.i=!0;this.h=a||!1;null!==this.f&&(0,this.f)(!1);null!==this.c&&vd(this.c)};var Jd=function(a,b,c){var d=Oa(a.f),d=a.l+d,e=a.b?qa(a.b):{};null!==b&&0<b.length&&(e.Authorization="Firebase "+b);e["X-Firebase-Storage-Version"]="webjs/"+("undefined"!==typeof firebase?firebase.SDK_VERSION:"AppManager");return new Hd(d,a.i,e,a.c,a.h,a.N,a.a,a.j,a.g,c)};var Kd=function(a){var b=m.BlobBuilder||m.WebKitBlobBuilder;if(n(b)){for(var b=new b,c=0;c<arguments.length;c++)b.append(arguments[c]);return b.getBlob()}b=kb(arguments);c=m.BlobBuilder||m.WebKitBlobBuilder;if(n(c)){for(var c=new c,d=0;d<b.length;d++)c.append(b[d],void 0);b=c.getBlob(void 0)}else if(n(m.Blob))b=new Blob(b,{});else throw Error("This browser doesn't seem to support creating Blobs");return b},Ld=function(a,b,c){n(c)||(c=a.size);return a.webkitSlice?a.webkitSlice(b,c):a.mozSlice?a.mozSlice(b,
c):a.slice?Qb&&!G("13.0")||Rb&&!G("537.1")?(0>b&&(b+=a.size),0>b&&(b=0),0>c&&(c+=a.size),c<b&&(c=b),a.slice(b,c-b)):a.slice(b,c):null};var Md=function(a){this.c=sc(a)};Md.prototype.a=function(){return this.c};Md.prototype.b=function(){};var Nd=function(){this.a={};this.b=Number.MIN_SAFE_INTEGER},Od=function(a,b){function c(){delete e.a[d]}var d=a.b;a.b++;a.a[d]=b;var e=a;b.a().then(c,c)};Nd.prototype.clear=function(){pa(this.a,function(a,b){b&&b.b(!0)});this.a={}};var Pd=function(a,b,c,d){this.a=a;this.g=null;if(null!==this.a&&(a=this.a.options,y(a))){a=a.storageBucket||null;if(null==a)a=null;else{var e=null;try{e=Ma(a)}catch(f){}if(null!==e){if(""!==e.path)throw new v("invalid-default-bucket","Invalid default bucket '"+a+"'.");a=e.bucket}}this.g=a}this.l=b;this.j=c;this.i=d;this.c=12E4;this.b=6E4;this.h=new Nd;this.f=!1},Qd=function(a){return null!==a.a&&y(a.a.INTERNAL)&&y(a.a.INTERNAL.getToken)?a.a.INTERNAL.getToken().then(function(a){return y(a)?a.accessToken:
null},function(){return null}):rc(null)};Pd.prototype.bucket=function(){if(this.f)throw oa();return this.g};var R=function(a,b,c){if(a.f)return new Md(oa());b=a.j(b,c,null===a.a);Od(a.h,b);return b};var Rd=function(a,b){return b},S=function(a,b,c,d){this.c=a;this.b=b||a;this.f=!!c;this.a=d||Rd},Sd=null,Td=function(){if(Sd)return Sd;var a=[];a.push(new S("bucket"));a.push(new S("generation"));a.push(new S("metageneration"));a.push(new S("name","fullPath",!0));var b=new S("name");b.a=function(a,b){return!ua(b)||2>b.length?b:ub(b)};a.push(b);b=new S("size");b.a=function(a,b){return y(b)?+b:b};a.push(b);a.push(new S("timeCreated"));a.push(new S("updated"));a.push(new S("md5Hash",null,!0));a.push(new S("cacheControl",
null,!0));a.push(new S("contentDisposition",null,!0));a.push(new S("contentEncoding",null,!0));a.push(new S("contentLanguage",null,!0));a.push(new S("contentType",null,!0));a.push(new S("metadata","customMetadata",!0));a.push(new S("downloadTokens","downloadURLs",!1,function(a,b){if(!(ua(b)&&0<b.length))return[];var e=encodeURIComponent;return eb(b.split(","),function(b){var d=a.fullPath,d="https://firebasestorage.googleapis.com/v0"+("/b/"+e(a.bucket)+"/o/"+e(d));b=Oa({alt:"media",token:b});return d+
b})}));return Sd=a},Ud=function(a,b){Object.defineProperty(a,"ref",{get:function(){return b.l(b,new z(a.bucket,a.fullPath))}})},Vd=function(a,b){for(var c={},d=b.length,e=0;e<d;e++){var f=b[e];f.f&&(c[f.c]=a[f.b])}return JSON.stringify(c)},Wd=function(a){if(!a||"object"!==typeof a)throw"Expected Metadata object.";for(var b in a){var c=a[b];if("customMetadata"===b&&"object"!==typeof c)throw"Expected object for 'customMetadata' mapping.";}};var T=function(a,b,c){for(var d=b.length,e=b.length,f=0;f<b.length;f++)if(b[f].b){d=f;break}if(!(d<=c.length&&c.length<=e))throw d===e?(b=d,d=1===d?"argument":"arguments"):(b="between "+d+" and "+e,d="arguments"),new v("invalid-argument-count","Invalid argument count in `"+a+"`: Expected "+b+" "+d+", received "+c.length+".");for(f=0;f<c.length;f++)try{b[f].a(c[f])}catch(g){if(g instanceof Error)throw na(f,a,g.message);throw na(f,a,g);}},U=function(a,b){var c=this;this.a=function(b){c.b&&!n(b)||a(b)};
this.b=!!b},Xd=function(a,b){return function(c){a(c);b(c)}},Yd=function(a,b){function c(a){if(!("string"===typeof a||a instanceof String))throw"Expected string.";}var d;a?d=Xd(c,a):d=c;return new U(d,b)},Zd=function(){return new U(function(a){if(!(a instanceof Blob))throw"Expected Blob or File.";})},$d=function(){return new U(function(a){if(!(("number"===typeof a||a instanceof Number)&&0<=a))throw"Expected a number 0 or greater.";})},ae=function(a,b){return new U(function(b){if(!(null===b||y(b)&&
b instanceof Object))throw"Expected an Object.";y(a)&&a(b)},b)},be=function(){return new U(function(a){if(null!==a&&!r(a))throw"Expected a Function.";},!0)};var ce=function(a){if(!a)throw la();},de=function(a,b){return function(c,d){a:{var e;try{e=JSON.parse(d)}catch(h){c=null;break a}c=da(e)?e:null}if(null===c)c=null;else{d={type:"file"};e=b.length;for(var f=0;f<e;f++){var g=b[f];d[g.b]=g.a(d,c[g.c])}Ud(d,a);c=d}ce(null!==c);return c}},ee=function(a){return function(b,c){b=401===Q(b)?new v("unauthenticated","User is not authenticated, please authenticate using Firebase Authentication and try again."):402===Q(b)?new v("quota-exceeded","Quota for bucket '"+
a.bucket+"' exceeded, please view quota on https://firebase.google.com/pricing/."):403===Q(b)?new v("unauthorized","User does not have permission to access '"+a.path+"'."):c;b.serverResponse=c.serverResponse;return b}},fe=function(a){var b=ee(a);return function(c,d){var e=b(c,d);404===Q(c)&&(e=new v("object-not-found","Object '"+a.path+"' does not exist."));e.serverResponse=d.serverResponse;return e}},ge=function(a,b,c){var d=La(b);a=new w(ka+"/v0"+d,"GET",de(a,c),a.c);a.a=fe(b);return a},he=function(a,
b){var c=La(b);a=new w(ka+"/v0"+c,"DELETE",function(){},a.c);a.h=[200,204];a.a=fe(b);return a},ie=function(a,b,c){c=c?qa(c):{};c.fullPath=a.path;c.size=b.size;c.contentType||(c.contentType=b&&b.type||"application/octet-stream");return c},je=function(a,b,c,d,e){var f="/b/"+encodeURIComponent(b.bucket)+"/o",g={"X-Goog-Upload-Protocol":"multipart"},h;h="";for(var l=0;2>l;l++)h+=Math.random().toString().slice(2);g["Content-Type"]="multipart/related; boundary="+h;e=ie(b,d,e);l=Vd(e,c);d=Kd("--"+h+"\r\nContent-Type: application/json; charset=utf-8\r\n\r\n"+
l+"\r\n--"+h+"\r\nContent-Type: "+e.contentType+"\r\n\r\n",d,"\r\n--"+h+"--");a=new w(ka+"/v0"+f,"POST",de(a,c),a.b);a.f={name:e.fullPath};a.b=g;a.c=d;a.a=ee(b);return a},ke=function(a,b,c,d){this.a=a;this.total=b;this.b=!!c;this.c=d||null},le=function(a,b){var c;try{c=Ed(a,"X-Goog-Upload-Status")}catch(d){ce(!1)}a=0<=bb(b||["active"],c);ce(a);return c},me=function(a,b,c,d,e){var f="/b/"+encodeURIComponent(b.bucket)+"/o",g=ie(b,d,e);e={name:g.fullPath};f=ka+"/v0"+f;d={"X-Goog-Upload-Protocol":"resumable",
"X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":d.size,"X-Goog-Upload-Header-Content-Type":g.contentType,"Content-Type":"application/json; charset=utf-8"};c=Vd(g,c);a=new w(f,"POST",function(a){le(a);var b;try{b=Ed(a,"X-Goog-Upload-URL")}catch(c){ce(!1)}ce(ua(b));return b},a.b);a.f=e;a.b=d;a.c=c;a.a=ee(b);return a},ne=function(a,b,c,d){a=new w(c,"POST",function(a){var b=le(a,["active","final"]),c;try{c=Ed(a,"X-Goog-Upload-Size-Received")}catch(h){ce(!1)}a=c;isFinite(a)&&(a=String(a));
a=q(a)?/^\s*-?0x/i.test(a)?parseInt(a,16):parseInt(a,10):NaN;ce(!isNaN(a));return new ke(a,d.size,"final"===b)},a.b);a.b={"X-Goog-Upload-Command":"query"};a.a=ee(b);return a},oe=function(a,b,c,d,e,f){var g=new ke(0,0);f?(g.a=f.a,g.total=f.total):(g.a=0,g.total=d.size);if(d.size!==g.total)throw new v("server-file-wrong-size","Server recorded incorrect upload file size, please retry the upload.");var h=f=g.total-g.a,h=Math.min(h,262144),l=g.a;f={"X-Goog-Upload-Command":h===f?"upload, finalize":"upload",
"X-Goog-Upload-Offset":g.a};l=Ld(d,l,l+h);if(null===l)throw new v("cannot-slice-blob","Cannot slice blob for upload. Please retry the upload.");c=new w(c,"POST",function(a,c){var f=le(a,["active","final"]),l=g.a+h,Ad=d.size,Va;"final"===f?Va=de(b,e)(a,c):Va=null;return new ke(l,Ad,"final"===f,Va)},b.b);c.b=f;c.c=l;c.g=null;c.a=ee(a);return c};var W=function(a,b,c,d,e,f){this.L=a;this.c=b;this.i=c;this.f=e;this.h=f||null;this.s=d;this.j=0;this.G=this.m=!1;this.B=[];this.$=262144<this.f.size;this.b="running";this.a=this.u=this.g=null;var g=this;this.X=function(a){g.a=null;"storage/canceled"===a.code?(g.m=!0,pe(g)):(g.g=a,V(g,"error"))};this.T=function(a){g.a=null;"storage/canceled"===a.code?pe(g):(g.g=a,V(g,"error"))};this.A=this.l=null;this.F=new H(function(a,b){g.l=a;g.A=b;qe(g)});this.F.then(null,function(){})},qe=function(a){"running"===
a.b&&null===a.a&&(a.$?null===a.u?re(a):a.m?se(a):a.G?te(a):ue(a):ve(a))},we=function(a,b){Qd(a.c).then(function(c){switch(a.b){case "running":b(c);break;case "canceling":V(a,"canceled");break;case "pausing":V(a,"paused")}})},re=function(a){we(a,function(b){var c=me(a.c,a.i,a.s,a.f,a.h);a.a=R(a.c,c,b);a.a.a().then(function(b){a.a=null;a.u=b;a.m=!1;pe(a)},this.X)})},se=function(a){var b=a.u;we(a,function(c){var d=ne(a.c,a.i,b,a.f);a.a=R(a.c,d,c);a.a.a().then(function(b){a.a=null;xe(a,b.a);a.m=!1;b.b&&
(a.G=!0);pe(a)},a.X)})},ue=function(a){var b=new ke(a.j,a.f.size),c=a.u;we(a,function(d){var e;try{e=oe(a.i,a.c,c,a.f,a.s,b)}catch(f){a.g=f;V(a,"error");return}a.a=R(a.c,e,d);a.a.a().then(function(b){a.a=null;xe(a,b.a);b.b?(a.h=b.c,V(a,"success")):pe(a)},a.X)})},te=function(a){we(a,function(b){var c=ge(a.c,a.i,a.s);a.a=R(a.c,c,b);a.a.a().then(function(b){a.a=null;a.h=b;V(a,"success")},a.T)})},ve=function(a){we(a,function(b){var c=je(a.c,a.i,a.s,a.f,a.h);a.a=R(a.c,c,b);a.a.a().then(function(b){a.a=
null;a.h=b;xe(a,a.f.size);V(a,"success")},a.X)})},xe=function(a,b){var c=a.j;a.j=b;a.j>c&&ye(a)},V=function(a,b){if(a.b!==b)switch(b){case "canceling":a.b=b;null!==a.a&&a.a.b();break;case "pausing":a.b=b;null!==a.a&&a.a.b();break;case "running":var c="paused"===a.b;a.b=b;c&&(ye(a),qe(a));break;case "paused":a.b=b;ye(a);break;case "canceled":a.g=ma();a.b=b;ye(a);break;case "error":a.b=b;ye(a);break;case "success":a.b=b,ye(a)}},pe=function(a){switch(a.b){case "pausing":V(a,"paused");break;case "canceling":V(a,
"canceled");break;case "running":qe(a)}};W.prototype.D=function(){return new A(this.j,this.f.size,ta(this.b),this.h,this,this.L)};
W.prototype.P=function(a,b,c,d){function e(a){try{g(a);return}catch(b){}try{if(h(a),!(n(a.next)||n(a.error)||n(a.complete)))throw"";}catch(b){throw"Expected a function or an Object with one of `next`, `error`, `complete` properties.";}}function f(a){return function(b,c,d){null!==a&&T("on",a,arguments);var e=new Na(b,c,d);ze(l,e);return function(){jb(l.B,e)}}}var g=be().a,h=ae(null,!0).a;T("on",[Yd(function(){if("state_changed"!==a)throw"Expected one of the event types: [state_changed].";}),ae(e,!0),
be(),be()],arguments);var l=this,B=[ae(function(a){if(null===a)throw"Expected a function or an Object with one of `next`, `error`, `complete` properties.";e(a)}),be(),be()];return n(b)||n(c)||n(d)?f(null)(b,c,d):f(B)};W.prototype.then=function(a,b){return this.F.then(a,b)};
var ze=function(a,b){a.B.push(b);Ae(a,b)},ye=function(a){Be(a);var b=kb(a.B);cb(b,function(b){Ae(a,b)})},Be=function(a){if(null!==a.l){var b=!0;switch(ta(a.b)){case "success":Dc(a.l.bind(null,a.D()))();break;case "canceled":case "error":Dc(a.A.bind(null,a.g))();break;default:b=!1}b&&(a.l=null,a.A=null)}},Ae=function(a,b){switch(ta(a.b)){case "running":case "paused":null!==b.next&&Dc(b.next.bind(b,a.D()))();break;case "success":null!==b.a&&Dc(b.a.bind(b))();break;case "canceled":case "error":null!==
b.error&&Dc(b.error.bind(b,a.g))();break;default:null!==b.error&&Dc(b.error.bind(b,a.g))()}};W.prototype.S=function(){T("resume",[],arguments);var a="paused"===this.b||"pausing"===this.b;a&&V(this,"running");return a};W.prototype.R=function(){T("pause",[],arguments);var a="running"===this.b;a&&V(this,"pausing");return a};W.prototype.M=function(){T("cancel",[],arguments);var a="running"===this.b||"pausing"===this.b;a&&V(this,"canceling");return a};var X=function(a,b){this.b=a;if(b)this.a=b instanceof z?b:Ma(b);else if(a=a.bucket(),null!==a)this.a=new z(a,"");else throw new v("no-default-bucket","No default bucket found. Did you set the 'storageBucket' property when initializing the app?");};X.prototype.toString=function(){T("toString",[],arguments);return"gs://"+this.a.bucket+"/"+this.a.path};var Ce=function(a,b){return new X(a,b)};k=X.prototype;
k.ha=function(a){T("child",[Yd()],arguments);var b=tb(this.a.path,a);return Ce(this.b,new z(this.a.bucket,b))};k.Fa=function(){var a;a=this.a.path;if(0==a.length)a=null;else{var b=a.lastIndexOf("/");a=-1===b?"":a.slice(0,b)}return null===a?null:Ce(this.b,new z(this.a.bucket,a))};k.Ha=function(){return Ce(this.b,new z(this.a.bucket,""))};k.pa=function(){return this.a.bucket};k.Aa=function(){return this.a.path};k.Ea=function(){return ub(this.a.path)};k.Ja=function(){return this.b.i};
k.ua=function(a,b){T("put",[Zd(),new U(Wd,!0)],arguments);De(this,"put");return new W(this,this.b,this.a,Td(),a,b)};k.delete=function(){T("delete",[],arguments);De(this,"delete");var a=this;return Qd(this.b).then(function(b){var c=he(a.b,a.a);return R(a.b,c,b).a()})};k.ia=function(){T("getMetadata",[],arguments);De(this,"getMetadata");var a=this;return Qd(this.b).then(function(b){var c=ge(a.b,a.a,Td());return R(a.b,c,b).a()})};
k.va=function(a){T("updateMetadata",[new U(Wd,void 0)],arguments);De(this,"updateMetadata");var b=this;return Qd(this.b).then(function(c){var d=b.b,e=b.a,f=a,g=Td(),h=La(e),h=ka+"/v0"+h,f=Vd(f,g),d=new w(h,"PATCH",de(d,g),d.c);d.b={"Content-Type":"application/json; charset=utf-8"};d.c=f;d.a=fe(e);return R(b.b,d,c).a()})};
k.ta=function(){T("getDownloadURL",[],arguments);De(this,"getDownloadURL");return this.ia().then(function(a){a=a.downloadURLs[0];if(y(a))return a;throw new v("no-download-url","The given file does not have any download URLs.");})};var De=function(a,b){if(""===a.a.path)throw new v("invalid-root-operation","The operation '"+b+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').");};var Y=function(a){this.a=new Pd(a,function(a,c){return new X(a,c)},Jd,this);this.b=a;this.c=new Ee(this)};k=Y.prototype;k.wa=function(a){T("ref",[Yd(function(a){if(/^[A-Za-z]+:\/\//.test(a))throw"Expected child path but got a URL, use refFromURL instead.";},!0)],arguments);var b=new X(this.a);return n(a)?b.ha(a):b};
k.xa=function(a){T("refFromURL",[Yd(function(a){if(!/^[A-Za-z]+:\/\//.test(a))throw"Expected full URL but got a child path, use ref instead.";try{Ma(a)}catch(c){throw"Expected valid full URL but got an invalid one.";}},!1)],arguments);return new X(this.a,a)};k.Ca=function(){return this.a.b};k.za=function(a){T("setMaxUploadRetryTime",[$d()],arguments);this.a.b=a};k.Ba=function(){return this.a.c};k.ya=function(a){T("setMaxOperationRetryTime",[$d()],arguments);this.a.c=a};k.oa=function(){return this.b};
k.ma=function(){return this.c};var Ee=function(a){this.a=a};Ee.prototype.delete=function(){var a=this.a.a;a.f=!0;a.a=null;a.h.clear()};var Z=function(a,b,c){Object.defineProperty(a,b,{get:c})};X.prototype.toString=X.prototype.toString;X.prototype.child=X.prototype.ha;X.prototype.put=X.prototype.ua;X.prototype["delete"]=X.prototype.delete;X.prototype.getMetadata=X.prototype.ia;X.prototype.updateMetadata=X.prototype.va;X.prototype.getDownloadURL=X.prototype.ta;Z(X.prototype,"parent",X.prototype.Fa);Z(X.prototype,"root",X.prototype.Ha);Z(X.prototype,"bucket",X.prototype.pa);Z(X.prototype,"fullPath",X.prototype.Aa);
Z(X.prototype,"name",X.prototype.Ea);Z(X.prototype,"storage",X.prototype.Ja);Y.prototype.ref=Y.prototype.wa;Y.prototype.refFromURL=Y.prototype.xa;Z(Y.prototype,"maxOperationRetryTime",Y.prototype.Ba);Y.prototype.setMaxOperationRetryTime=Y.prototype.ya;Z(Y.prototype,"maxUploadRetryTime",Y.prototype.Ca);Y.prototype.setMaxUploadRetryTime=Y.prototype.za;Z(Y.prototype,"app",Y.prototype.oa);Z(Y.prototype,"INTERNAL",Y.prototype.ma);Ee.prototype["delete"]=Ee.prototype.delete;
Y.prototype.capi_=function(a){ka=a};W.prototype.on=W.prototype.P;W.prototype.resume=W.prototype.S;W.prototype.pause=W.prototype.R;W.prototype.cancel=W.prototype.M;Z(W.prototype,"snapshot",W.prototype.D);Z(A.prototype,"bytesTransferred",A.prototype.qa);Z(A.prototype,"totalBytes",A.prototype.La);Z(A.prototype,"state",A.prototype.Ia);Z(A.prototype,"metadata",A.prototype.Da);Z(A.prototype,"downloadURL",A.prototype.sa);Z(A.prototype,"task",A.prototype.Ka);Z(A.prototype,"ref",A.prototype.Ga);
ra.STATE_CHANGED="state_changed";sa.RUNNING="running";sa.PAUSED="paused";sa.SUCCESS="success";sa.CANCELED="canceled";sa.ERROR="error";H.prototype["catch"]=H.prototype.l;H.prototype.then=H.prototype.then;
(function(){function a(a){return new Y(a)}var b={TaskState:sa,TaskEvent:ra,Storage:Y,Reference:X};if(window.firebase&&firebase.INTERNAL&&firebase.INTERNAL.registerService)firebase.INTERNAL.registerService("storage",a,b);else throw Error("Cannot install Firebase Storage - be sure to load firebase-app.js first.");})();})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _main = require('./class/main');

var _main2 = _interopRequireDefault(_main);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (window) {
    (function (window) {
        window.Apiface = _main2.default;
    })(window);
}

exports.default = _main2.default;

},{"./class/main":42}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _EventManager = require('./EventManager');

var _EventManager2 = _interopRequireDefault(_EventManager);

var _EntityContainer = require('./EntityContainer');

var _EntityContainer2 = _interopRequireDefault(_EntityContainer);

var _EntityController = require('./EntityController');

var _EntityController2 = _interopRequireDefault(_EntityController);

var _EntityFactory = require('./EntityFactory');

var _EntityFactory2 = _interopRequireDefault(_EntityFactory);

var _PowerEntity = require('./PowerEntity');

var _PowerEntity2 = _interopRequireDefault(_PowerEntity);

var _helper = require('./helper/helper');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Apiface = function () {
    function Apiface(_ref) {
        var adapter = _ref.adapter;

        _classCallCheck(this, Apiface);

        this.defaultAdapter = adapter;

        this.entityContainer = new _EntityContainer2.default({ entityFactory: new _EntityFactory2.default() });

        this.entityController = new _EntityController2.default({ adapter: this.defaultAdapter });
        this.eventManager = new _EventManager2.default();
    }

    _createClass(Apiface, [{
        key: 'getEntityContainer',
        value: function getEntityContainer() {
            return this.entityContainer;
        }
    }, {
        key: 'getEntityController',
        value: function getEntityController() {
            return this.entityController;
        }
    }, {
        key: 'getEventManager',
        value: function getEventManager() {
            return this.eventManager;
        }
    }, {
        key: 'makePowerEntity',
        value: function makePowerEntity(_ref2) {
            var entity = _ref2.entity;
            var customAdapter = _ref2.customAdapter;

            return new _PowerEntity2.default({
                entity: entity,
                customAdapter: customAdapter,
                entityController: this.getEntityController(),
                eventManager: this.getEventManager()
            });
        }
    }, {
        key: 'getEntity',
        value: function getEntity(_ref3) {
            var name = _ref3.name;
            var uri = _ref3.uri;
            var fixedParams = _ref3.fixedParams;
            var entityClass = _ref3.entityClass;
            var customAdapter = _ref3.customAdapter;
            var _ref3$overwrite = _ref3.overwrite;
            var overwrite = _ref3$overwrite === undefined ? false : _ref3$overwrite;

            var entityContainer = this.getEntityContainer();

            var entity = null;
            if (overwrite) {
                entity = entityContainer.setEntity({ name: name, uri: uri, fixedParams: fixedParams, entityClass: entityClass });
            } else {
                entity = entityContainer.getEntityByName(name) || entityContainer.setEntity({ name: name, uri: uri, fixedParams: fixedParams, entityClass: entityClass });
            }

            if (!entity) return null;

            if (uri) entity.setUri(uri);
            if (fixedParams) entity.setFixedParams(fixedParams);

            return this.makePowerEntity({ entity: entity, customAdapter: customAdapter });
        }
    }, {
        key: 'on',
        value: function on() {
            var _this = this,
                _arguments = arguments;

            var eventName = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
            var callback = arguments.length <= 1 || arguments[1] === undefined ? function () {} : arguments[1];

            if (!eventName) {
                return false;
            }

            var promise = (0, _helper.promiseFactory)();

            this.getEventManager().addEventListener(eventName, function (response) {
                if (response && response.error) {
                    promise.reject.apply(_this, _arguments);
                } else {
                    promise.resolve.apply(_this, _arguments);
                }

                callback.apply(_this, _arguments);
            });

            return promise.await;
        }
    }]);

    return Apiface;
}();

exports.default = Apiface;

},{"./EntityContainer":28,"./EntityController":29,"./EntityFactory":30,"./EventManager":31,"./PowerEntity":32,"./helper/helper":41}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityContainer = function () {
    function EntityContainer(_ref) {
        var entityFactory = _ref.entityFactory;

        _classCallCheck(this, EntityContainer);

        if (!entityFactory || typeof entityFactory.make !== 'function') {
            throw new Error('entityFactory params don\'t implements EntityFactory interface');
        }
        this.entityFactory = entityFactory;

        this.entities = {};
    }

    _createClass(EntityContainer, [{
        key: 'setEntity',
        value: function setEntity(_ref2) {
            var uri = _ref2.uri;
            var name = _ref2.name;
            var fixedParams = _ref2.fixedParams;
            var entityClass = _ref2.entityClass;

            var entity = this.entityFactory.make({
                uri: uri,
                name: name,
                fixedParams: fixedParams,
                entityClass: entityClass
            });

            if (!entity || !entity.name) {
                throw new Error('entityFactory.make don\'t return a valid implementation of BaseEntity interface');
                //return null;
            }

            return this.entities[entity.name] = entity;
        }
    }, {
        key: 'getEntityByName',
        value: function getEntityByName(name) {
            if (!name || typeof name !== 'string') return false;

            return this.entities[name] || null;
        }
    }, {
        key: 'getEntityByUri',
        value: function getEntityByUri(uri) {
            if (!uri || typeof uri !== 'string') return false;

            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                for (var _iterator = this.entities[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    var entity = _step.value;

                    if (entity.getUri() == uri) return entity;
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return null;
        }
    }]);

    return EntityContainer;
}();

exports.default = EntityContainer;

},{}],29:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityController = function () {
    function EntityController(_ref) {
        var adapter = _ref.adapter;

        _classCallCheck(this, EntityController);

        this.adapter = adapter;
    }

    _createClass(EntityController, [{
        key: "getAdapter",
        value: function getAdapter(_ref2) {
            var uri = _ref2.uri;
            var _ref2$params = _ref2.params;
            var params = _ref2$params === undefined ? {} : _ref2$params;
            var _ref2$adapter = _ref2.adapter;
            var adapter = _ref2$adapter === undefined ? null : _ref2$adapter;

            if (!adapter) adapter = this.adapter;

            adapter.setUri(uri);
            adapter.resetResults();

            return adapter;
        }
    }, {
        key: "setAdapter",
        value: function setAdapter(adapter) {
            return this.adapter = adapter;
        }
    }, {
        key: "createData",
        value: function createData(_ref3) {
            var uri = _ref3.uri;
            var _ref3$params = _ref3.params;
            var params = _ref3$params === undefined ? {} : _ref3$params;
            var _ref3$adapter = _ref3.adapter;
            var adapter = _ref3$adapter === undefined ? null : _ref3$adapter;
            var _ref3$checkIfExist = _ref3.checkIfExist;
            var checkIfExist = _ref3$checkIfExist === undefined ? false : _ref3$checkIfExist;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).createData(params, checkIfExist);
        } //return Promise

    }, {
        key: "readData",
        value: function readData(_ref4) {
            var uri = _ref4.uri;
            var _ref4$params = _ref4.params;
            var params = _ref4$params === undefined ? {} : _ref4$params;
            var _ref4$data = _ref4.data;
            var data = _ref4$data === undefined ? {} : _ref4$data;
            var _ref4$adapter = _ref4.adapter;
            var adapter = _ref4$adapter === undefined ? null : _ref4$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).readData(params);
        } //return Promise

    }, {
        key: "updateData",
        value: function updateData(_ref5) {
            var uri = _ref5.uri;
            var _ref5$params = _ref5.params;
            var params = _ref5$params === undefined ? {} : _ref5$params;
            var _ref5$data = _ref5.data;
            var data = _ref5$data === undefined ? {} : _ref5$data;
            var _ref5$adapter = _ref5.adapter;
            var adapter = _ref5$adapter === undefined ? null : _ref5$adapter;
            var _ref5$oldData = _ref5.oldData;
            var oldData = _ref5$oldData === undefined ? null : _ref5$oldData;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).updateData(data, oldData);
        } //return Promise

    }, {
        key: "deleteData",
        value: function deleteData(_ref6) {
            var uri = _ref6.uri;
            var _ref6$params = _ref6.params;
            var params = _ref6$params === undefined ? {} : _ref6$params;
            var _ref6$data = _ref6.data;
            var data = _ref6$data === undefined ? {} : _ref6$data;
            var _ref6$adapter = _ref6.adapter;
            var adapter = _ref6$adapter === undefined ? null : _ref6$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).deleteData(data);
        } //return Promise

    }, {
        key: "pushData",
        value: function pushData(_ref7) {
            var uri = _ref7.uri;
            var _ref7$params = _ref7.params;
            var params = _ref7$params === undefined ? {} : _ref7$params;
            var _ref7$data = _ref7.data;
            var data = _ref7$data === undefined ? {} : _ref7$data;
            var _ref7$adapter = _ref7.adapter;
            var adapter = _ref7$adapter === undefined ? null : _ref7$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).pushData(data);
        } //return Promise

    }, {
        key: "onChangeData",
        value: function onChangeData(_ref8) {
            var uri = _ref8.uri;
            var _ref8$params = _ref8.params;
            var params = _ref8$params === undefined ? {} : _ref8$params;
            var _ref8$data = _ref8.data;
            var data = _ref8$data === undefined ? {} : _ref8$data;
            var _ref8$adapter = _ref8.adapter;
            var adapter = _ref8$adapter === undefined ? null : _ref8$adapter;
            var _ref8$callback = _ref8.callback;
            var callback = _ref8$callback === undefined ? function () {} : _ref8$callback;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).onChangeData(callback);
        } //return Promise

    }]);

    return EntityController;
}();

exports.default = EntityController;

},{}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _BaseEntity = require('./entities/BaseEntity');

var _BaseEntity2 = _interopRequireDefault(_BaseEntity);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EntityFactory = function () {
    function EntityFactory() {
        _classCallCheck(this, EntityFactory);
    }

    _createClass(EntityFactory, [{
        key: 'make',
        value: function make(_ref) {
            var _ref$uri = _ref.uri;
            var uri = _ref$uri === undefined ? '' : _ref$uri;
            var _ref$name = _ref.name;
            var name = _ref$name === undefined ? null : _ref$name;
            var _ref$fixedParams = _ref.fixedParams;
            var fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams;
            var _ref$entityClass = _ref.entityClass;
            var entityClass = _ref$entityClass === undefined ? _BaseEntity2.default : _ref$entityClass;


            if (!uri && !name) return null;

            return new entityClass({
                name: name || uri,
                uri: uri,
                fixedParams: fixedParams
            });
        }
    }]);

    return EntityFactory;
}();

exports.default = EntityFactory;

},{"./entities/BaseEntity":39}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _constants = require('./config/constants');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventManager = function () {
    function EventManager() {
        _classCallCheck(this, EventManager);

        var eventsName = Object.keys(_constants.EVENT_TYPE);

        this.listeners = {};
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = eventsName[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var name = _step.value;

                this.listeners[name] = [{
                    priority: 0,
                    handler: function handler() {}
                }];
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }

    _createClass(EventManager, [{
        key: 'addEventListener',
        value: function addEventListener(evtName, callback) {
            var priority = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

            var errorMsg = '';
            if (!evtName || typeof evtName !== 'string') errorMsg = 'Event\'s name is not defined.';
            if (typeof callback !== 'function') errorMsg = 'Callback is not defined';
            if (!this.listeners[evtName]) errorMsg = 'Event\'s name is not valid.';

            if (errorMsg) {
                throw new Error(errorMsg);
                //return false;
            }

            var truePriority = this.getTruePriority(evtName, priority);

            this.listeners[evtName].push({
                priority: truePriority,
                handler: callback
            });

            this.sortListener();

            return truePriority;
        }
    }, {
        key: 'getTruePriority',
        value: function getTruePriority(evtName) {
            var priority = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            if (!this.listeners[evtName]) return false;

            var priorityList = Object.keys(this.listeners[evtName]).sort();
            if (!+priority) {
                return +priorityList.pop() + 1;
            }

            var truePriority = +priority;
            for (var i in priorityList) {
                if (truePriority == i) {
                    truePriority++;
                } else if (truePriority < i) {
                    break;
                }
            }

            return truePriority;
        }
    }, {
        key: 'sortListener',
        value: function sortListener() {
            for (var eventName in this.listeners) {
                this.listeners[eventName].sort(function (a, b) {
                    if (a.priority > b.priority) {
                        return -1;
                    } else {
                        return 1;
                    }
                });
            }

            return this.listeners;
        }
    }, {
        key: 'trigger',
        value: function trigger(evtName) {
            var data = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            if (!this.listeners[evtName]) return false;

            this.listeners[evtName].map(function (listener) {
                listener.handler.call(this, {
                    name: evtName,
                    priority: listener.priority,
                    data: data,
                    dt: new Date().getTime(),
                    handler: listener.handler
                });
            });
        }
    }]);

    return EventManager;
}();

exports.default = EventManager;

},{"./config/constants":38}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helper = require('./helper/helper');

var _constants = require('./config/constants.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PowerEntity = function () {
    function PowerEntity(_ref) {
        var entity = _ref.entity;
        var customAdapter = _ref.customAdapter;
        var entityController = _ref.entityController;
        var eventManager = _ref.eventManager;
        var _ref$safeMode = _ref.safeMode;
        var safeMode = _ref$safeMode === undefined ? false : _ref$safeMode;

        _classCallCheck(this, PowerEntity);

        this.entity = entity;
        this.entityController = entityController;
        this.customAdapter = customAdapter;

        this.eventManager = eventManager;

        this.nodeAdded = [];

        this.safeMode = safeMode;
        if (this.safeMode) {
            this.oldData = null;
        }
    }

    _createClass(PowerEntity, [{
        key: 'getEntity',
        value: function getEntity() {
            return this.entity;
        }
    }, {
        key: 'getEntityController',
        value: function getEntityController() {
            return this.entityController;
        }
    }, {
        key: 'getEventManager',
        value: function getEventManager() {
            return this.eventManager;
        }
    }, {
        key: 'getCreateAt',
        value: function getCreateAt() {
            return this.getEntity().getCreateAt();
        }
    }, {
        key: 'getUpdateAt',
        value: function getUpdateAt() {
            return this.getEntity().getUpdateAt();
        }
    }, {
        key: 'getData',
        value: function getData() {
            return this.getEntity().getData();
        }
    }, {
        key: 'setData',
        value: function setData(data) {
            if (!data) return false;

            if (this.safeMode) {
                this.oldData = Object.assing({}, this.getData());
            }

            this.getEntity().setData(data);
        }
    }, {
        key: 'addData',
        value: function addData(node) {
            if (!node) return false;

            this.getEntity().addData(node);

            this.nodeAdded.push(node);
        }
    }, {
        key: 'getNodeAdded',
        value: function getNodeAdded() {
            return this.nodeAdded;
        }
    }, {
        key: 'resetNodeAdded',
        value: function resetNodeAdded() {
            return this.nodeAdded = [];
        }
    }, {
        key: 'fetch',
        value: function fetch() {
            var actionParams = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            entity.setActionParams(actionParams);
            var params = entity.getParams();

            var eventsName = (0, _helper.getEventsName)({
                method: 'fetch',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    params: params
                });
            }

            entity.setStatus(_constants.DATA_STATUS.busy);

            entityController.readData({ uri: entity.getUri(), params: params, adapter: this.customAdapter }).then(function (_ref2) {
                var data = _ref2.data;
                var response = _ref2.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(data);
            }).catch(function (_ref3) {
                var response = _ref3.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(response);
            });

            return promise.await;
        }
    }, {
        key: 'save',
        value: function save() {
            var actionParams = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            entity.setActionParams(actionParams);
            var params = entity.getParams();

            var eventsName = (0, _helper.getEventsName)({
                method: 'save',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    params: params
                });
            }

            var status = entity.getStatus();
            switch (status) {
                case _constants.DATA_STATUS.busy:
                case _constants.DATA_STATUS.pending:
                    if (eventsName.error) {
                        eventManager.trigger(eventsName.error, {
                            entity: entity,
                            error: status
                        });
                    }
                    promise.reject(status);
                    break;
                case _constants.DATA_STATUS.synced:
                    if (eventsName.success) {
                        eventManager.trigger(eventsName.success, {
                            entity: entity,
                            response: entity.getData()
                        });
                    }
                    promise.resolve(entity.getData());
                    break;
                case _constants.DATA_STATUS.created:
                    entityController.createData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, checkIfExist: this.safeMode }).then(function (_ref4) {
                        var data = _ref4.data;
                        var response = _ref4.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(data);
                    }).catch(function (_ref5) {
                        var response = _ref5.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(response);
                    });
                    break;
                case _constants.DATA_STATUS.modified:
                    entityController.updateData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, oldData: this.safeMode ? this.oldData : null }).then(function (_ref6) {
                        var data = _ref6.data;
                        var response = _ref6.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(data);
                    }).catch(function (_ref7) {
                        var response = _ref7.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(response);
                    });
                    break;
                case _constants.DATA_STATUS.added:
                    entityController.pushData({ uri: entity.getUri(), data: this.getNodeAdded(), adapter: this.customAdapter }).then(function (_ref8) {
                        var data = _ref8.data;
                        var response = _ref8.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);

                        this.resetNodeAdded();

                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }

                        promise.resolve(data);
                    }.bind(this)).catch(function (_ref9) {
                        var response = _ref9.response;

                        entity.setStatus(_constants.DATA_STATUS.error);

                        if (response && response.notAdded && response.notAdded.length) {
                            this.resetNodeAdded();
                            var _iteratorNormalCompletion = true;
                            var _didIteratorError = false;
                            var _iteratorError = undefined;

                            try {
                                for (var _iterator = response.notAdded[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                                    var node = _step.value.node;

                                    this.nodeAdded.push(node);
                                }
                            } catch (err) {
                                _didIteratorError = true;
                                _iteratorError = err;
                            } finally {
                                try {
                                    if (!_iteratorNormalCompletion && _iterator.return) {
                                        _iterator.return();
                                    }
                                } finally {
                                    if (_didIteratorError) {
                                        throw _iteratorError;
                                    }
                                }
                            }
                        }

                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }

                        promise.reject(response);
                    }.bind(this));
                    break;
                default:

                    break;
            }

            return promise.await;
        }
    }, {
        key: 'sync',
        value: function sync() {
            var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

            var promise = (0, _helper.promiseFactory)();

            var entity = this.getEntity();
            var entityController = this.getEntityController();
            var eventManager = this.getEventManager();

            var eventsName = (0, _helper.getEventsName)({
                method: 'sync',
                dataStatus: entity.getStatus()
            });

            if (eventsName.request) {
                eventManager.trigger(eventsName.request, {
                    entity: entity,
                    callback: callback
                });
            }

            entityController.onChangeData({ uri: entity.getUri(), adapter: this.customAdapter, callback: callback }).then(function (_ref10) {
                var data = _ref10.data;
                var response = _ref10.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(data);
            }).catch(function (_ref11) {
                var response = _ref11.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(response);
            });

            return promise.await;
        }
    }, {
        key: 'on',
        value: function on() {
            var eventName = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];
            var callback = arguments.length <= 1 || arguments[1] === undefined ? function () {} : arguments[1];

            this.eventManager.addEventListener(eventName, function (response) {
                if (!response || !response.data || !response.data.entity) {
                    return false; //todo: throw new error
                }

                var promise = (0, _helper.promiseFactory)();

                if (response.data.entity == this.getEntity()) {
                    if (response && response.error) {
                        promise.reject.apply(this, arguments);
                    } else {
                        promise.resolve.apply(this, arguments);
                    }

                    callback.apply(this, arguments);
                }
            }.bind(this));
        }
    }]);

    return PowerEntity;
}();

exports.default = PowerEntity;

},{"./config/constants.js":38,"./helper/helper":41}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractHttpAdapter2 = require('./abstract/AbstractHttpAdapter');

var _AbstractHttpAdapter3 = _interopRequireDefault(_AbstractHttpAdapter2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AjaxAdapter = function (_AbstractHttpAdapter) {
    _inherits(AjaxAdapter, _AbstractHttpAdapter);

    function AjaxAdapter(_ref) {
        var url = _ref.url;

        _classCallCheck(this, AjaxAdapter);

        return _possibleConstructorReturn(this, Object.getPrototypeOf(AjaxAdapter).call(this, { url: url }));
    }

    _createClass(AjaxAdapter, [{
        key: 'createData',
        value: function createData() {
            var data = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            return this.httpCall('post', data);
        }
    }, {
        key: 'readData',
        value: function readData() {
            var params = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            return this.httpCall('get', params);
        }
    }, {
        key: 'updateData',
        value: function updateData() {
            var data = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            return this.httpCall('post', data);
        }

        /*pushData( params = {} ) {
         return this.ajaxCall( 'post', params );
         }*/

    }]);

    return AjaxAdapter;
}(_AbstractHttpAdapter3.default);

exports.default = AjaxAdapter;

},{"./abstract/AbstractHttpAdapter":36}],34:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractAdapter2 = require('./abstract/AbstractAdapter');

var _AbstractAdapter3 = _interopRequireDefault(_AbstractAdapter2);

var _firebase = require('firebase');

var _firebase2 = _interopRequireDefault(_firebase);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FirebaseAdapter = function (_AbstractAdapter) {
    _inherits(FirebaseAdapter, _AbstractAdapter);

    function FirebaseAdapter(_ref) {
        var _ref$url = _ref.url;
        var url = _ref$url === undefined ? '' : _ref$url;

        _classCallCheck(this, FirebaseAdapter);

        var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(FirebaseAdapter).call(this, { url: url }));

        _this.fb = new _firebase2.default(_this.getUrl());
        return _this;
    }

    _createClass(FirebaseAdapter, [{
        key: 'getUriRef',
        value: function getUriRef() {
            var uri = arguments.length <= 0 || arguments[0] === undefined ? this.getUri() : arguments[0];

            return this.fb.child(uri);
        }
    }, {
        key: 'createData',
        value: function createData(data) {
            var checkIfExist = arguments.length <= 1 || arguments[1] === undefined ? false : arguments[1];

            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            if (checkIfExist) {
                uriRef.transaction(function (currentData) {
                    if (!currentData || currentData === {} || currentData === []) {
                        promise.reject({ currentData: currentData });
                    } else {
                        return data;
                    }
                }).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            } else {
                uriRef.set(data).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            }

            return promise.await;
        }
    }, {
        key: 'readData',
        value: function readData(params) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.once('value', function (snap) {
                return promise.resolve({ data: snap.val(), response: snap });
            }, function (error) {
                return promise.reject({ response: error });
            });

            return promise.await;
        }
    }, {
        key: 'updateData',
        value: function updateData(data) {
            var oldData = arguments.length <= 1 || arguments[1] === undefined ? null : arguments[1];

            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            if (oldData) {
                uriRef.transaction(function (currentData) {
                    if (JSON.stringify(currentData) != JSON.stringify(oldData)) {
                        promise.reject({ currentData: currentData });
                    } else {
                        return data;
                    }
                }).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            } else {
                uriRef.update(data).then(function (response) {
                    return promise.resolve({ data: data, response: response || data });
                }).catch(function (error) {
                    return promise.reject({ response: error });
                });
            }

            return promise.await;
        }
    }, {
        key: 'deleteData',
        value: function deleteData(params) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.remove().then(function () {
                return promise.resolve({ data: params, response: params });
            }).catch(function (error) {
                return promise.reject({ response: error });
            });

            return promise.await;
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            var promise = this.getPromise();

            var uriRef = this.getUriRef();

            var _fnPushed = function (_ref2) {
                var node = _ref2.node;
                var id = _ref2.id;
                var error = _ref2.error;

                this.afterPush({ node: node, id: id, error: error });

                if (!this.results.pendingToPush.length) {

                    if (!this.results.notPushed.length) {
                        promise.resolve({ data: data, response: this.results });
                    } else {
                        promise.reject({ response: this.results });
                    }
                }
            }.bind(this);

            var nodes = data && typeof data.length !== 'undefined' ? data : [data];
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
                var _loop = function _loop() {
                    var node = _step.value;

                    var nodeRef = uriRef.push(node);
                    nodeRef.then(function () {
                        return _fnPushed({ node: node, id: nodeRef.key() });
                    }).catch(function (error) {
                        return _fnPushed({ node: node, id: nodeRef.key(), error: error || true });
                    });
                };

                for (var _iterator = nodes[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                    _loop();
                }
            } catch (err) {
                _didIteratorError = true;
                _iteratorError = err;
            } finally {
                try {
                    if (!_iteratorNormalCompletion && _iterator.return) {
                        _iterator.return();
                    }
                } finally {
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                }
            }

            return promise.await;
        }
    }, {
        key: 'onChangeData',
        value: function onChangeData() {
            var callback = arguments.length <= 0 || arguments[0] === undefined ? function () {} : arguments[0];

            var promise = this.getPromise();

            var uriRef = this.getUriRef();
            uriRef.once('value', function (snap) {
                var oldSnap = snap;

                uriRef.on('value', function (newSnap) {
                    callback({ data: newSnap.val(), response: newSnap }, { data: oldSnap.val(), response: oldSnap });
                    promise.resolve({ data: newSnap.val(), response: newSnap }, { data: oldSnap.val(), response: oldSnap });

                    oldSnap = newSnap;
                }, function (error) {
                    promise.reject({ response: error });
                });
            }, function (error) {
                promise.reject({ response: error });
            });

            return promise.await;
        }
    }]);

    return FirebaseAdapter;
}(_AbstractAdapter3.default);

exports.default = FirebaseAdapter;

},{"./abstract/AbstractAdapter":35,"firebase":24}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helper = require('../../helper/helper');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AbstractAdapter = function () {
    function AbstractAdapter(_ref) {
        var _ref$url = _ref.url;
        var url = _ref$url === undefined ? '' : _ref$url;

        _classCallCheck(this, AbstractAdapter);

        this.baseUrl = url;
        this.uri = '';

        this.results = {};
        this.resetResults();
    }

    _createClass(AbstractAdapter, [{
        key: 'resetResults',
        value: function resetResults() {
            return this.results = {
                pendingToCreate: [],
                created: [],
                notCreated: [],

                pendingToRead: [],
                readed: [],
                notReaded: [],

                pendingToUpdate: [],
                updated: [],
                notUpdated: [],

                pendingToDelete: [],
                deleted: [],
                notDeleted: [],

                pendingToPush: [],
                pushed: [],
                notPushed: []
            };
        }
    }, {
        key: 'getResults',
        value: function getResults() {
            return this.results;
        }
    }, {
        key: 'getPromise',
        value: function getPromise() {
            return (0, _helper.promiseFactory)();
        }
    }, {
        key: 'getUri',
        value: function getUri() {
            return this.uri;
        }
    }, {
        key: 'setUri',
        value: function setUri(uri) {
            this.uri = uri;
        }
    }, {
        key: 'getUrl',
        value: function getUrl() {
            return this.baseUrl + this.uri;
        }
    }, {
        key: 'voidAction',
        value: function voidAction(name) {
            throw new Error(name + ' adapter\'s method is not defined');
        }
    }, {
        key: 'afterAction',
        value: function afterAction(_ref2, _ref3) {
            var pendingName = _ref2.pendingName;
            var successName = _ref2.successName;
            var errorName = _ref2.errorName;
            var node = _ref3.node;
            var id = _ref3.id;
            var error = _ref3.error;

            if (!error) {
                this.results[successName].push({
                    node: node,
                    id: id
                });
            } else {
                this.results[errorName].push({
                    node: node,
                    id: id
                });
            }

            for (var n in this.results[pendingName]) {
                var pendingNode = this.results[pendingName][n].pendingNode;

                if (pendingNode === node) {
                    this.results[pendingName].splice(n, 1);
                    break;
                }
            }

            return !this.results[pendingName].length;
        }
    }, {
        key: 'createData',
        value: function createData(data, checkIfExist) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterCreate',
        value: function afterCreate(_ref4) {
            var node = _ref4.node;
            var id = _ref4.id;
            var error = _ref4.error;

            return this.afterAction({ pendingName: 'pendingToCreate', successName: 'created', errorName: 'notCreated' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'readData',
        value: function readData(params) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterRead',
        value: function afterRead(_ref5) {
            var node = _ref5.node;
            var id = _ref5.id;
            var error = _ref5.error;

            return this.afterAction({ pendingName: 'pendingToRead', successName: 'readed', errorName: 'notReaded' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'updateData',
        value: function updateData(data, oldData) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterUpdate',
        value: function afterUpdate(_ref6) {
            var node = _ref6.node;
            var id = _ref6.id;
            var error = _ref6.error;

            return this.afterAction({ pendingName: 'pendingToUpdate', successName: 'updated', errorName: 'notUpdated' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'deleteData',
        value: function deleteData(params) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterDelete',
        value: function afterDelete(_ref7) {
            var node = _ref7.node;
            var id = _ref7.id;
            var error = _ref7.error;

            return this.afterAction({ pendingName: 'pendingToDelete', successName: 'deleted', errorName: 'notDeleted' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            return this.voidAction(arguments.callee.name);
        }
    }, {
        key: 'afterPush',
        value: function afterPush(_ref8) {
            var node = _ref8.node;
            var id = _ref8.id;
            var error = _ref8.error;

            return this.afterAction({ pendingName: 'pendingToPush', successName: 'pushed', errorName: 'notPushed' }, { node: node, id: id, error: error });
        }
    }, {
        key: 'onChangeData',
        value: function onChangeData(callback) {
            return this.voidAction(arguments.callee.name);
        }
    }]);

    return AbstractAdapter;
}();

exports.default = AbstractAdapter;

},{"../../helper/helper":41}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _AbstractAdapter2 = require('./AbstractAdapter');

var _AbstractAdapter3 = _interopRequireDefault(_AbstractAdapter2);

var _axios = require('axios');

var _axios2 = _interopRequireDefault(_axios);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AbstractHttpAdapter = function (_AbstractAdapter) {
    _inherits(AbstractHttpAdapter, _AbstractAdapter);

    function AbstractHttpAdapter(_ref) {
        var url = _ref.url;

        _classCallCheck(this, AbstractHttpAdapter);

        return _possibleConstructorReturn(this, Object.getPrototypeOf(AbstractHttpAdapter).call(this, { url: url }));
    }

    _createClass(AbstractHttpAdapter, [{
        key: 'httpCall',
        value: function httpCall(method, params) {
            var promise = this.getPromise();

            console.log('httpCall', arguments);

            _axios2.default[method](this.getUrl(), { params: params }).then(function (resp) {
                console.log('then', resp);
                if (resp.status == 200) {
                    console.log('resolve');
                    promise.resolve({ response: resp, data: resp.data });
                } else {
                    promise.reject({ response: resp, data: resp.data });
                }
            }).catch(function (err) {
                console.log('catch', err);
                promise.reject({ response: err });
            });

            return promise.await;
        }
    }]);

    return AbstractHttpAdapter;
}(_AbstractAdapter3.default);

exports.default = AbstractHttpAdapter;

},{"./AbstractAdapter":35,"axios":1}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _AjaxAdapter = require('./AjaxAdapter');

var _AjaxAdapter2 = _interopRequireDefault(_AjaxAdapter);

var _FirebaseAdapter = require('./FirebaseAdapter');

var _FirebaseAdapter2 = _interopRequireDefault(_FirebaseAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = { AjaxAdapter: _AjaxAdapter2.default, FirebaseAdapter: _FirebaseAdapter2.default };

},{"./AjaxAdapter":33,"./FirebaseAdapter":34}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var DATA_STATUS = exports.DATA_STATUS = {
    busy: 0,
    pending: 1,
    created: 2,
    modified: 3,
    added: 4,
    synced: 5,
    error: 6
};

var EVENT_TYPE = exports.EVENT_TYPE = {
    create_request: 'create_request',
    create_success: 'create_success',
    create_error: 'create_error',

    read_request: 'read_request',
    read_success: 'read_success',
    read_error: 'read_error',

    update_request: 'update_request',
    update_success: 'update_success',
    update_error: 'update_error',

    delete_request: 'delete_request',
    delete_success: 'delete_success',
    delete_error: 'delete_error',

    add_request: 'add_request',
    add_success: 'add_success',
    add_error: 'add_error'
};

},{}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _constants = require('../config/constants.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseEntity = function () {
    function BaseEntity(_ref) {
        var uri = _ref.uri;
        var name = _ref.name;
        var _ref$fixedParams = _ref.fixedParams;
        var fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams;

        _classCallCheck(this, BaseEntity);

        this.uri = uri;
        this.name = name;
        this.fixedParams = fixedParams;
        this.actionParams = {};
        this.params = Object.assign({}, this.fixedParams, this.actionParams);

        this.status = _constants.DATA_STATUS.pending; //1: pending to fetch, 2: modified, 3: synched

        this.data = null;

        this.createAt = new Date();
        this.updateAt = null;
    }

    _createClass(BaseEntity, [{
        key: 'getCreateAt',
        value: function getCreateAt() {
            return this.createAt;
        }
    }, {
        key: 'getUpdateAt',
        value: function getUpdateAt() {
            return this.updateAt;
        }
    }, {
        key: 'refreshUpdateAt',
        value: function refreshUpdateAt() {
            return this.updateAt = new Date();
        }
    }, {
        key: 'getName',
        value: function getName() {
            return this.name;
        }
    }, {
        key: 'getUri',
        value: function getUri() {
            return this.uri;
        }
    }, {
        key: 'setUri',
        value: function setUri() {
            var uri = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

            if (!uri || typeof uri !== 'string') return this.uri;
            return this.uri = uri;
        }
    }, {
        key: 'getFixedParams',
        value: function getFixedParams() {
            return this.fixedParams;
        }
    }, {
        key: 'setFixedParams',
        value: function setFixedParams() {
            var params = arguments.length <= 0 || arguments[0] === undefined ? null : arguments[0];

            if ((typeof params === 'undefined' ? 'undefined' : _typeof(params)) !== 'object' || typeof params.length !== 'undefined') {
                return this.fixedParams;
            }

            this.fixedParams = params;
            this.mergeParams();

            return this.fixedParams;
        }
    }, {
        key: 'getActionParams',
        value: function getActionParams() {
            return this.actionParams;
        }
    }, {
        key: 'setActionParams',
        value: function setActionParams() {
            var actionParams = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.actionParams = actionParams;
            this.mergeParams();

            return this.actionParams;
        }
    }, {
        key: 'getParams',
        value: function getParams() {
            return this.params;
        }
    }, {
        key: 'mergeParams',
        value: function mergeParams() {
            return this.params = Object.assign({}, this.getFixedParams(), this.getActionParams());
        }
    }, {
        key: 'getStatus',
        value: function getStatus() {
            return this.status;
        }
    }, {
        key: 'setStatus',
        value: function setStatus(status) {
            this.status = status;
        }
    }, {
        key: 'getData',
        value: function getData() {
            return this.data;
        }
    }, {
        key: 'setData',
        value: function setData() {
            var data = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

            this.data = data;
            this.setStatus(_constants.DATA_STATUS.modified);
            this.refreshUpdateAt();
        }
    }, {
        key: 'addData',
        value: function addData(data) {
            if (!data) return false;
            if (_typeof(this.data) !== 'object' || typeof this.data.push !== 'function') {
                return false;
            }

            this.data.push(data);

            this.setStatus(_constants.DATA_STATUS.added);
            this.refreshUpdateAt();
        }
    }]);

    return BaseEntity;
}();

exports.default = BaseEntity;

},{"../config/constants.js":38}],40:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _BaseEntity = require('./BaseEntity');

var _BaseEntity2 = _interopRequireDefault(_BaseEntity);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = { BaseEntity: _BaseEntity2.default };

},{"./BaseEntity":39}],41:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.promiseFactory = promiseFactory;
exports.getEventsName = getEventsName;
exports.getCurrentPosition = getCurrentPosition;

var _constants = require('../config/constants');

function promiseFactory() {
    var _resolve = null;
    var _reject = null;
    var promise = new Promise(function (resolve, reject) {
        _resolve = resolve;
        _reject = reject;
    });

    return {
        resolve: _resolve,
        reject: _reject,
        await: promise
    };
}

function getEventsName(_ref) {
    var method = _ref.method;
    var dataStatus = _ref.dataStatus;

    var prefix = method;

    if (method == 'fetch') {
        prefix = 'read';
    } else if (method == 'save') {
        switch (dataStatus) {
            case _constants.DATA_STATUS.busy:
                return { error: 'busy' };
                break;
            case _constants.DATA_STATUS.pending:
                return { error: 'void_data' };
                break;
            case _constants.DATA_STATUS.synced:
                prefix = 'read';
                break;
            case _constants.DATA_STATUS.created:
                prefix = 'create';
                break;
            case _constants.DATA_STATUS.modified:
                prefix = 'update';
                break;
            default:

                break;
        }
    } else if (method == 'sync') {
        prefix = 'sync';
    }

    return {
        request: prefix + '_request',
        success: prefix + '_success',
        error: prefix + '_error'
    };
}

function getCurrentPosition(callback) {
    if (!callback) callback = function callback() {};

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
            callback({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            });
        }, function (error) {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    alert('Permessi per la Geolocalizzazione non attivi. Per favore attivali in Impostazioni > Generali > Ripristina posizione e privacy.');
                    break;
                case error.POSITION_UNAVAILABLE:
                    alert('Posizione utente non disponibile. Prova ad attivare il wi-fi o riprova più tardi.');
                    break;
                case error.TIMEOUT:
                    alert('La richiesta per la posizione è scaduta. Riprova più tardi.');
                    break;
                case error.UNKNOWN_ERROR:
                    alert('Sì è verificato un errore. Riprova più tardi.');
                    break;
                default:
                    alert('Sì è verificato un errore. Riprova più tardi.');
            }

            callback(false);
        });
    }
}

},{"../config/constants":38}],42:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _Apiface = require('./Apiface');

var _Apiface2 = _interopRequireDefault(_Apiface);

var _EntityContainer = require('./EntityContainer');

var _EntityContainer2 = _interopRequireDefault(_EntityContainer);

var _EntityController = require('./EntityController');

var _EntityController2 = _interopRequireDefault(_EntityController);

var _EntityFactory = require('./EntityFactory');

var _EntityFactory2 = _interopRequireDefault(_EntityFactory);

var _EventManager = require('./EventManager');

var _EventManager2 = _interopRequireDefault(_EventManager);

var _PowerEntity = require('./PowerEntity');

var _PowerEntity2 = _interopRequireDefault(_PowerEntity);

var _adapters = require('./adapters/adapters');

var _adapters2 = _interopRequireDefault(_adapters);

var _entities = require('./entities/entities');

var _entities2 = _interopRequireDefault(_entities);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

Object.assign(_Apiface2.default, {
    EntityContainer: _EntityContainer2.default,
    EntityController: _EntityController2.default,
    EntityFactory: _EntityFactory2.default,
    EventManager: _EventManager2.default,
    PowerEntity: _PowerEntity2.default,
    adapters: _adapters2.default,
    entities: _entities2.default
});

exports.default = _Apiface2.default;

},{"./Apiface":27,"./EntityContainer":28,"./EntityController":29,"./EntityFactory":30,"./EventManager":31,"./PowerEntity":32,"./adapters/adapters":37,"./entities/entities":40}]},{},[26]);
