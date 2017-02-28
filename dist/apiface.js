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

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
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
    var timeout = runTimeout(cleanUpNextTick);
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
    runClearTimeout(timeout);
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
        runTimeout(drainQueue);
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

},{"./class/main":40}],25:[function(require,module,exports){
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
    function Apiface() {
        var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
            adapter = _ref.adapter;

        _classCallCheck(this, Apiface);

        //this.defaultAdapter = adapter;
        this.setDefaultAdapter(adapter);

        this.entityContainer = new _EntityContainer2.default({ entityFactory: new _EntityFactory2.default() });

        this.entityController = new _EntityController2.default({ adapter: this.getDefaultAdapter() });
        this.eventManager = new _EventManager2.default();
    }

    _createClass(Apiface, [{
        key: 'setDefaultAdapter',
        value: function setDefaultAdapter(adapter) {
            return this.defaultAdapter = adapter;
        }
    }, {
        key: 'getDefaultAdapter',
        value: function getDefaultAdapter() {
            return this.defaultAdapter;
        }
    }, {
        key: 'setAdapter',
        value: function setAdapter(adapter) {
            this.setDefaultAdapter(adapter);

            this.entityController.setAdapter(this.getDefaultAdapter());
        }
    }, {
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
            var entity = _ref2.entity,
                customAdapter = _ref2.customAdapter;

            return new _PowerEntity2.default({
                entity: entity,
                customAdapter: customAdapter,
                entityController: this.getEntityController(),
                eventManager: this.getEventManager()
            });
        }
    }, {
        key: 'getPowerEntity',
        value: function getPowerEntity(_ref3) {
            var name = _ref3.name,
                uri = _ref3.uri,
                fixedParams = _ref3.fixedParams,
                entityClass = _ref3.entityClass,
                customAdapter = _ref3.customAdapter,
                _ref3$overwrite = _ref3.overwrite,
                overwrite = _ref3$overwrite === undefined ? false : _ref3$overwrite;

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

            var eventName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
            var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

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

},{"./EntityContainer":26,"./EntityController":27,"./EntityFactory":28,"./EventManager":29,"./PowerEntity":30,"./helper/helper":39}],26:[function(require,module,exports){
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
            var uri = _ref2.uri,
                name = _ref2.name,
                fixedParams = _ref2.fixedParams,
                entityClass = _ref2.entityClass;

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

},{}],27:[function(require,module,exports){
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

        //this.adapter = adapter;
        this.setAdapter(adapter);
    }

    _createClass(EntityController, [{
        key: "getAdapter",
        value: function getAdapter(_ref2) {
            var uri = _ref2.uri,
                _ref2$params = _ref2.params,
                params = _ref2$params === undefined ? {} : _ref2$params,
                _ref2$adapter = _ref2.adapter,
                adapter = _ref2$adapter === undefined ? null : _ref2$adapter;

            if (!adapter) adapter = this.adapter;

            adapter.setUri(uri);
            //adapter.setParams( params );
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
            var uri = _ref3.uri,
                _ref3$params = _ref3.params,
                params = _ref3$params === undefined ? {} : _ref3$params,
                _ref3$adapter = _ref3.adapter,
                adapter = _ref3$adapter === undefined ? null : _ref3$adapter,
                _ref3$checkIfExist = _ref3.checkIfExist,
                checkIfExist = _ref3$checkIfExist === undefined ? false : _ref3$checkIfExist;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).createData(params, checkIfExist);
        } //return Promise

    }, {
        key: "readData",
        value: function readData(_ref4) {
            var uri = _ref4.uri,
                _ref4$params = _ref4.params,
                params = _ref4$params === undefined ? {} : _ref4$params,
                _ref4$data = _ref4.data,
                data = _ref4$data === undefined ? {} : _ref4$data,
                _ref4$adapter = _ref4.adapter,
                adapter = _ref4$adapter === undefined ? null : _ref4$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).readData(params);
        } //return Promise

    }, {
        key: "updateData",
        value: function updateData(_ref5) {
            var uri = _ref5.uri,
                _ref5$params = _ref5.params,
                params = _ref5$params === undefined ? {} : _ref5$params,
                _ref5$data = _ref5.data,
                data = _ref5$data === undefined ? {} : _ref5$data,
                _ref5$adapter = _ref5.adapter,
                adapter = _ref5$adapter === undefined ? null : _ref5$adapter,
                _ref5$oldData = _ref5.oldData,
                oldData = _ref5$oldData === undefined ? null : _ref5$oldData;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).updateData(data, oldData);
        } //return Promise

    }, {
        key: "deleteData",
        value: function deleteData(_ref6) {
            var uri = _ref6.uri,
                _ref6$params = _ref6.params,
                params = _ref6$params === undefined ? {} : _ref6$params,
                _ref6$data = _ref6.data,
                data = _ref6$data === undefined ? {} : _ref6$data,
                _ref6$adapter = _ref6.adapter,
                adapter = _ref6$adapter === undefined ? null : _ref6$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).deleteData(data);
        } //return Promise

    }, {
        key: "pushData",
        value: function pushData(_ref7) {
            var uri = _ref7.uri,
                _ref7$params = _ref7.params,
                params = _ref7$params === undefined ? {} : _ref7$params,
                _ref7$data = _ref7.data,
                data = _ref7$data === undefined ? {} : _ref7$data,
                _ref7$adapter = _ref7.adapter,
                adapter = _ref7$adapter === undefined ? null : _ref7$adapter;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).pushData(data);
        } //return Promise

    }, {
        key: "onChangeData",
        value: function onChangeData(_ref8) {
            var uri = _ref8.uri,
                _ref8$params = _ref8.params,
                params = _ref8$params === undefined ? {} : _ref8$params,
                _ref8$data = _ref8.data,
                data = _ref8$data === undefined ? {} : _ref8$data,
                _ref8$adapter = _ref8.adapter,
                adapter = _ref8$adapter === undefined ? null : _ref8$adapter,
                _ref8$callback = _ref8.callback,
                callback = _ref8$callback === undefined ? function () {} : _ref8$callback;

            return this.getAdapter({ uri: uri, params: params, adapter: adapter }).onChangeData(callback);
        } //return Promise

    }]);

    return EntityController;
}();

exports.default = EntityController;

},{}],28:[function(require,module,exports){
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
            var _ref$uri = _ref.uri,
                uri = _ref$uri === undefined ? '' : _ref$uri,
                _ref$name = _ref.name,
                name = _ref$name === undefined ? null : _ref$name,
                _ref$fixedParams = _ref.fixedParams,
                fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams,
                _ref$entityClass = _ref.entityClass,
                entityClass = _ref$entityClass === undefined ? _BaseEntity2.default : _ref$entityClass;


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

},{"./entities/BaseEntity":37}],29:[function(require,module,exports){
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
            var priority = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

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
            var priority = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

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
            var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

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

},{"./config/constants":36}],30:[function(require,module,exports){
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
        var entity = _ref.entity,
            customAdapter = _ref.customAdapter,
            entityController = _ref.entityController,
            eventManager = _ref.eventManager,
            _ref$safeMode = _ref.safeMode,
            safeMode = _ref$safeMode === undefined ? false : _ref$safeMode;

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
        key: 'get',
        value: function get() {
            var entity = this.getEntity();
            return entity.get.apply(entity, arguments);
        }
    }, {
        key: 'set',
        value: function set() {
            var entity = this.getEntity();
            return entity.set.apply(entity, arguments);
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

            return this;
        }
    }, {
        key: 'addData',
        value: function addData(node) {
            if (!node) return false;

            this.getEntity().addData(node);

            this.nodeAdded.push(node);
        }
    }, {
        key: 'getFixedParams',
        value: function getFixedParams() {
            return this.getEntity().getFixedParams();
        }
    }, {
        key: 'setFixedParams',
        value: function setFixedParams(params) {
            if (params) {
                this.getEntity().setFixedParams(params);
            }

            return this;
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
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

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
                var data = _ref2.data,
                    response = _ref2.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(entity);
            }).catch(function (_ref3) {
                var response = _ref3.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(entity);
            });

            return promise.await;
        }
    }, {
        key: 'save',
        value: function save() {
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

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
                    promise.reject(entity);
                    break;
                case _constants.DATA_STATUS.synced:
                    if (eventsName.success) {
                        eventManager.trigger(eventsName.success, {
                            entity: entity,
                            response: entity.getData()
                        });
                    }
                    promise.resolve(entity);
                    break;
                case _constants.DATA_STATUS.created:
                    entityController.createData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, checkIfExist: this.safeMode }).then(function (_ref4) {
                        var data = _ref4.data,
                            response = _ref4.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(entity);
                    }).catch(function (_ref5) {
                        var response = _ref5.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(entity);
                    });
                    break;
                case _constants.DATA_STATUS.modified:
                    entityController.updateData({ uri: entity.getUri(), data: entity.getData(), adapter: this.customAdapter, oldData: this.safeMode ? this.oldData : null }).then(function (_ref6) {
                        var data = _ref6.data,
                            response = _ref6.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);
                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }
                        promise.resolve(entity);
                    }).catch(function (_ref7) {
                        var response = _ref7.response;

                        entity.setStatus(_constants.DATA_STATUS.error);
                        if (eventsName.error) {
                            eventManager.trigger(eventsName.error, {
                                entity: entity,
                                error: response
                            });
                        }
                        promise.reject(entity);
                    });
                    break;
                case _constants.DATA_STATUS.added:
                    entityController.pushData({ uri: entity.getUri(), data: this.getNodeAdded(), adapter: this.customAdapter }).then(function (_ref8) {
                        var data = _ref8.data,
                            response = _ref8.response;

                        entity.setData(data);
                        entity.setStatus(_constants.DATA_STATUS.synced);

                        this.resetNodeAdded();

                        if (eventsName.success) {
                            eventManager.trigger(eventsName.success, {
                                entity: entity,
                                response: response
                            });
                        }

                        promise.resolve(entity);
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
                                    var _ref11 = _step.value;
                                    var node = _ref11.node;

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

                        promise.reject(entity);
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
            var callback = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : function () {};

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

            entityController.onChangeData({ uri: entity.getUri(), adapter: this.customAdapter, callback: callback }).then(function (_ref12) {
                var data = _ref12.data,
                    response = _ref12.response;

                entity.setData(data);
                entity.setStatus(_constants.DATA_STATUS.synced);

                if (eventsName.success) {
                    eventManager.trigger(eventsName.success, {
                        entity: entity,
                        response: response
                    });
                }

                promise.resolve(entity);
            }).catch(function (_ref13) {
                var response = _ref13.response;

                entity.setStatus(_constants.DATA_STATUS.error);

                if (eventsName.error) {
                    eventManager.trigger(eventsName.error, {
                        entity: entity,
                        error: response
                    });
                }

                promise.reject(entity);
            });

            return promise.await;
        }
    }, {
        key: 'on',
        value: function on() {
            var eventName = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
            var callback = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function () {};

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

},{"./config/constants.js":36,"./helper/helper":39}],31:[function(require,module,exports){
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

    function AjaxAdapter(config) {
        _classCallCheck(this, AjaxAdapter);

        return _possibleConstructorReturn(this, (AjaxAdapter.__proto__ || Object.getPrototypeOf(AjaxAdapter)).call(this, config));
    }

    _createClass(AjaxAdapter, [{
        key: 'createData',
        value: function createData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', data);
        }
    }, {
        key: 'readData',
        value: function readData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('get', data);
        }
    }, {
        key: 'updateData',
        value: function updateData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', data);
        }

        /*pushData( params = {} ) {
         return this.ajaxCall( 'post', params );
         }*/

    }]);

    return AjaxAdapter;
}(_AbstractHttpAdapter3.default);

exports.default = AjaxAdapter;

},{"./abstract/AbstractHttpAdapter":34}],32:[function(require,module,exports){
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

var FormDataAdapter = function (_AbstractHttpAdapter) {
    _inherits(FormDataAdapter, _AbstractHttpAdapter);

    function FormDataAdapter(config) {
        _classCallCheck(this, FormDataAdapter);

        return _possibleConstructorReturn(this, (FormDataAdapter.__proto__ || Object.getPrototypeOf(FormDataAdapter)).call(this, config));
    }

    _createClass(FormDataAdapter, [{
        key: 'createData',
        value: function createData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', this.makeFormData(data), { headers: { 'Content-Type': 'multipart/form-data' } });
        }
    }, {
        key: 'readData',
        value: function readData() {
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('get', this.makeFormData(params), { headers: { 'Content-Type': 'multipart/form-data' } });
        }
    }, {
        key: 'updateData',
        value: function updateData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            return this.httpCall('post', this.makeFormData(data), { headers: { 'Content-Type': 'multipart/form-data' } });
        }
    }, {
        key: 'makeFormData',
        value: function makeFormData() {
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            var formData = new FormData();

            for (var key in data) {
                var value = data[key];
                formData.append(key, value);
            }

            return formData;
        }
    }]);

    return FormDataAdapter;
}(_AbstractHttpAdapter3.default);

exports.default = FormDataAdapter;

},{"./abstract/AbstractHttpAdapter":34}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helper = require('../../helper/helper');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AbstractAdapter = function () {
    function AbstractAdapter(_ref) {
        var _ref$url = _ref.url,
            url = _ref$url === undefined ? '' : _ref$url,
            _ref$params = _ref.params,
            params = _ref$params === undefined ? {} : _ref$params;

        _classCallCheck(this, AbstractAdapter);

        this.baseUrl = url;
        this.uri = '';
        this.params = params;
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
        key: 'getParams',
        value: function getParams() {
            return this.params;
        }
    }, {
        key: 'setParams',
        value: function setParams() {
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.params = params;

            return this;
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
        key: 'getBaseUrl',
        value: function getBaseUrl() {
            return this.baseUrl;
        }
    }, {
        key: 'setBaseUrl',
        value: function setBaseUrl(baseUrl) {
            this.baseUrl = baseUrl;
            return this;
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
            return this;
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
            var pendingName = _ref2.pendingName,
                successName = _ref2.successName,
                errorName = _ref2.errorName;
            var node = _ref3.node,
                id = _ref3.id,
                error = _ref3.error;

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
            var node = _ref4.node,
                id = _ref4.id,
                error = _ref4.error;

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
            var node = _ref5.node,
                id = _ref5.id,
                error = _ref5.error;

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
            var node = _ref6.node,
                id = _ref6.id,
                error = _ref6.error;

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
            var node = _ref7.node,
                id = _ref7.id,
                error = _ref7.error;

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
            var node = _ref8.node,
                id = _ref8.id,
                error = _ref8.error;

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

},{"../../helper/helper":39}],34:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

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

    function AbstractHttpAdapter(config) {
        _classCallCheck(this, AbstractHttpAdapter);

        return _possibleConstructorReturn(this, (AbstractHttpAdapter.__proto__ || Object.getPrototypeOf(AbstractHttpAdapter)).call(this, config));
    }

    _createClass(AbstractHttpAdapter, [{
        key: 'httpCall',
        value: function httpCall(method, params) {
            var config = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

            var promise = this.getPromise();

            console.log('httpCall', arguments);

            var newParams = null;
            if (params instanceof FormData && method != 'get') {
                newParams = params;
                for (var name in this.getParams()) {
                    var value = this.getParams()[name];
                    newParams.append(name, value);
                }
            } else {
                newParams = _extends({}, this.getParams(), params);
            }

            var data = {};
            if (method == 'get') {
                data = {
                    params: newParams
                };
            } else {
                data = newParams;
            }

            _axios2.default[method](this.getUrl(), data, config).then(function (resp) {
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

},{"./AbstractAdapter":33,"axios":1}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _AjaxAdapter = require('./AjaxAdapter');

var _AjaxAdapter2 = _interopRequireDefault(_AjaxAdapter);

var _FormDataAdapter = require('./FormDataAdapter');

var _FormDataAdapter2 = _interopRequireDefault(_FormDataAdapter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

//import FirebaseAdapter from './FirebaseAdapter';

exports.default = { AjaxAdapter: _AjaxAdapter2.default, FormDataAdapter: _FormDataAdapter2.default };

},{"./AjaxAdapter":31,"./FormDataAdapter":32}],36:[function(require,module,exports){
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

},{}],37:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _constants = require('../config/constants.js');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var BaseEntity = function () {
    function BaseEntity(_ref) {
        var uri = _ref.uri,
            name = _ref.name,
            _ref$fixedParams = _ref.fixedParams,
            fixedParams = _ref$fixedParams === undefined ? {} : _ref$fixedParams;

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
            var uri = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

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
            var params = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;

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
            var actionParams = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

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
            return this.params = _extends({}, this.getFixedParams(), this.getActionParams());
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
            var data = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

            this.data = data;
            this.setStatus(_constants.DATA_STATUS.modified);
            this.refreshUpdateAt();

            return this.getData();
        }
    }, {
        key: 'pushData',
        value: function pushData(data) {
            if (!data) return false;
            if (_typeof(this.data) !== 'object' || typeof this.data.push !== 'function') {
                return false;
            }

            this.data.push(data);

            this.setStatus(_constants.DATA_STATUS.added);
            this.refreshUpdateAt();
        }
    }, {
        key: 'get',
        value: function get(field) {
            var data = this.getData();
            return (typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object' ? data[field] : false;
        }
    }, {
        key: 'set',
        value: function set(field, value) {
            var data = this.getData();
            if (data === null) data = {};
            if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') return false;
            data[field] = value;

            return this.setData(data);
        }
    }]);

    return BaseEntity;
}();

exports.default = BaseEntity;

},{"../config/constants.js":36}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _BaseEntity = require('./BaseEntity');

var _BaseEntity2 = _interopRequireDefault(_BaseEntity);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = { BaseEntity: _BaseEntity2.default };

},{"./BaseEntity":37}],39:[function(require,module,exports){
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
    var method = _ref.method,
        dataStatus = _ref.dataStatus;

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

},{"../config/constants":36}],40:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.entities = exports.adapters = exports.PowerEntity = exports.EventManager = exports.EntityFactory = exports.EntityController = exports.EntityContainer = exports.Apiface = undefined;

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

exports.Apiface = _Apiface2.default;
exports.EntityContainer = _EntityContainer2.default;
exports.EntityController = _EntityController2.default;
exports.EntityFactory = _EntityFactory2.default;
exports.EventManager = _EventManager2.default;
exports.PowerEntity = _PowerEntity2.default;
exports.adapters = _adapters2.default;
exports.entities = _entities2.default;

},{"./Apiface":25,"./EntityContainer":26,"./EntityController":27,"./EntityFactory":28,"./EventManager":29,"./PowerEntity":30,"./adapters/adapters":35,"./entities/entities":38}]},{},[24]);
