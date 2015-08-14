/**
 * Modules in this bundle
 * 
 * component-emitter:
 *   license: MIT
 *   maintainers: tootallnate <nathan@tootallnate.net>, tjholowaychuk <tj@vision-media.ca>, rauchg <rauchg@gmail.com>, retrofox <rdsuarez@gmail.com>, coreh <thecoreh@gmail.com>, forbeslindesay <forbes@lindesay.co.uk>, kelonye <kelonyemitchel@gmail.com>, mattmueller <mattmuelle@gmail.com>, yields <yields@icloud.com>, anthonyshort <antshort@gmail.com>, jongleberry <jonathanrichardong@gmail.com>, ianstormtaylor <ian@ianstormtaylor.com>, cristiandouce <cristian@gravityonmars.com>, swatinem <arpad.borsos@googlemail.com>, stagas <gstagas@gmail.com>, amasad <amjad.masad@gmail.com>, juliangruber <julian@juliangruber.com>, shtylman <shtylman@gmail.com>, calvinfo <calvin@calv.info>, dominicbarnes <dominic@dbarnes.info>, blakeembrey <hello@blakeembrey.com>, timoxley <secoif@gmail.com>, jonathanong <jonathanrichardong@gmail.com>, queckezz <fabian.eichenberger@gmail.com>, nami-doc <vendethiel@hotmail.fr>, clintwood <clint@anotherway.co.za>, thehydroimpulse <dnfagnan@gmail.com>, stephenmathieson <me@stephenmathieson.com>, trevorgerhardt <trevorgerhardt@gmail.com>, timaschew <timaschew@gmail.com>, hughsk <hughskennedy@gmail.com>
 *   version: 1.2.0
 * 
 * growthpush-javascript:
 *   version: 1.1.1
 * 
 * nanoajax:
 *   license: MIT
 *   author: Jon Eisen <jon@joneisen.me>
 *   maintainers: yanatan16 <jon.m.eisen@gmail.com>
 *   version: 0.3.1
 * 
 */
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.GrowthPush = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var nanoajax = require('nanoajax');
var HttpClient = (function () {
    function HttpClient(baseUrl, timeout) {
        if (timeout === void 0) { timeout = 0; }
        this.baseUrl = baseUrl;
        this.timeout = timeout;
    }
    HttpClient.prototype.get = function (api, options, success, error) {
        return this._request('GET', api, options, success, error);
    };
    HttpClient.prototype.post = function (api, options, success, error) {
        return this._request('POST', api, options, success, error);
    };
    HttpClient.prototype.put = function (api, options, success, error) {
        return this._request('PUT', api, options, success, error);
    };
    HttpClient.prototype.delete = function (api, options, success, error) {
        return this._request('DELETE', api, options, success, error);
    };
    HttpClient.prototype._request = function (method, api, options, success, error) {
        if (options.dataType === 'jsonp') {
            this._requestByJsonp('GET', api, options, success, error);
        }
        else {
            this._requestByXhr(method, api, options, success, error);
        }
    };
    HttpClient.prototype._requestByJsonp = function (method, api, options, success, error) {
        var params = this._makeParamsArray(options.params);
        var jsonpCallbackName = 'growthbeat' + Math.random().toString(36).slice(-8);
        ;
        params = params.concat('callback=' + jsonpCallbackName);
        var url = this.baseUrl + api + '?' + params.join('&');
        var script = document.createElement('script');
        script.async = true;
        script.src = url;
        window[jsonpCallbackName] = function (data) {
            delete window[jsonpCallbackName];
            document.body.removeChild(script);
            success(data, 200);
        };
        script.onerror = function (err) {
            console.log('script error', err);
            error();
        };
        document.body.appendChild(script);
    };
    HttpClient.prototype._requestByXhr = function (method, api, options, success, error) {
        var params = this._makeParamsArray(options.params);
        var nanoParams = {
            method: method,
            url: this.baseUrl + api,
            withCredentials: options.withCredentials
        };
        if (method === 'GET') {
            nanoParams.url = nanoParams.url + '?' + params.join('&');
        }
        else {
            nanoParams.body = params.join('&');
        }
        // TODO: handle timeout
        nanoajax.ajax(nanoParams, function (code, responseText) {
            if (code === 200) {
                var data = JSON.parse(responseText);
                success(data, code);
            }
            else {
                var err = {};
                error(err, code);
            }
        });
    };
    HttpClient.prototype._makeParamsArray = function (obj) {
        var paramsObj = (obj == null) ? {} : obj;
        var params = Object.keys(paramsObj).map(function (key) {
            var val = '';
            if (typeof paramsObj[key] === 'object') {
                val = JSON.stringify(paramsObj[key]);
            }
            else {
                val = paramsObj[key];
            }
            return encodeURIComponent(key) + '=' + encodeURIComponent(val);
        });
        return params;
    };
    return HttpClient;
})();
module.exports = HttpClient;

},{"nanoajax":7}],2:[function(require,module,exports){
var localStorageWrapper = require('../utils/local-storage-wrapper');
var Client = require('./model/client');
var HttpClient = require('./http/http-client');
var HTTP_CLIENT_BASE_URL = 'https://api.growthpush.com/';
var _httpClient = new HttpClient(HTTP_CLIENT_BASE_URL);
var _initialized = false;
var _registered = false;
var _params = null;
var _client = null;
var _fetchRegistration = function () {
    if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
        return Promise.reject(new Error('Notifications aren\'t supported.'));
    }
    if (Notification.permission === 'denied') {
        return Promise.reject(new Error('The user has blocked notifications.'));
    }
    if (!('PushManager' in window)) {
        return Promise.reject(new Error('Push messaging isn\'t supported.'));
    }
    return navigator.serviceWorker.ready.then(function (registration) {
        var handleUpdateFound = function (event) {
            console.log('updatefound', event);
            registration.removeEventListener('updatefound', handleUpdateFound);
            // reinitialization
            console.log('reinitialization');
            register();
        };
        registration.addEventListener('updatefound', handleUpdateFound);
        return Promise.resolve(registration);
    });
};
var _fetchSubscription = function (registration) {
    console.log('service worker is ready:', registration);
    return registration.pushManager.getSubscription().then(function (subscription) {
        console.log('subscription:', subscription);
        if (!subscription)
            return _subscribe(registration);
        return Promise.resolve(subscription);
    }).catch(function (err) {
        return Promise.reject(new Error('Error during getSubscription()'));
    });
};
var _subscribe = function (registration) {
    return registration.pushManager.subscribe({ userVisibleOnly: true }).then(function (subscription) {
        console.log('subscription:', subscription);
        return Promise.resolve(subscription);
    }).catch(function (err) {
        if (Notification.permission === 'denied') {
            return Promise.reject(new Error('Permission for Notifications was denied'));
        }
        else {
            return Promise.reject(new Error('Unable to subscribe to push.'));
        }
    });
};
var _registerClient = function (subscription) {
    var client = Client.load();
    if (client != null && client.getApplicationId() === _params.applicationId) {
        if (client.getToken() === _getSubscriptionId(subscription) && client.getEnvironment() === _params.environment) {
            _client = client;
            return Promise.resolve({ client: client, subscription: subscription });
        }
        return _updateClient(client, subscription);
    }
    return _createClient(subscription);
};
var _createClient = function (subscription) {
    return new Promise(function (resolve, reject) {
        var c = Client.create({
            applicationId: _params.applicationId,
            credentialId: _params.credentialId,
            environment: _params.environment,
            token: _getSubscriptionId(subscription)
        });
        c.on('created', function () {
            _client = c;
            Client.save(c);
            resolve({ client: c, subscription: subscription });
        });
        c.on('error', function () {
            reject(new Error('Error during creating client'));
        });
    });
};
var _updateClient = function (client, subscription) {
    return new Promise(function (resolve, reject) {
        var c = Client.update(client, {
            code: client.getCode(),
            token: _getSubscriptionId(subscription),
            environment: _params.environment
        });
        c.on('updated', function () {
            _client = c;
            Client.save(c);
            resolve({ client: c, subscription: subscription });
        });
        c.on('error', function () {
            reject(new Error('Error during updating client'));
        });
    });
};
var _configure = function (params) {
    return _sendMessage({
        type: 'init',
        data: {
            applicationId: _params.applicationId,
            credentialId: _params.credentialId,
            title: _params.appName,
            icon: _params.icon,
            clickEventName: _params.clickEventName,
            clientId: params.client.getId(),
            code: params.client.getCode()
        }
    });
};
var _sendMessage = function (message) {
    return new Promise(function (resolve, reject) {
        var _message = JSON.stringify(message);
        var messageChannel = new MessageChannel();
        messageChannel.port1.onmessage = function (event) {
            console.log('message', event);
            if (event.data.error) {
                reject(event.data.error);
            }
            else {
                resolve(event.data);
            }
        };
        console.log('postMessage', message);
        navigator.serviceWorker.controller.postMessage(_message, [messageChannel.port2]);
    });
};
// 'PushSubscription.subscriptionId' is deprecated
var _getSubscriptionId = function (subscription) {
    if (subscription.subscriptionId == null) {
        return subscription.endpoint.split('/').pop();
    }
    return subscription.subscriptionId;
};
function init(params) {
    if (_initialized)
        return;
    _initialized = true;
    if (params.environment == null)
        params.environment = 'production';
    if (params.environment !== 'development' && params.environment !== 'production') {
        throw new Error('GrowthPush: unsupported environment: ' + params.environment);
    }
    _params = params;
}
exports.init = init;
function register() {
    if (!_initialized)
        return;
    if (!_isAndroid()) {
        console.warn('Growth Push isn\'t supported in this os.');
        return;
    }
    if (!('serviceWorker' in navigator)) {
        console.warn('Service workers aren\'t supported in this browser.');
        return;
    }
    navigator.serviceWorker.register(_params.receiver).then(_fetchRegistration).then(_fetchSubscription).then(_registerClient).then(_configure).then(function (data) {
        console.log('done:', data);
        _registered = true;
    }).catch(function (err) {
        console.log(err);
    });
}
exports.register = register;
var _isAndroid = function () {
    var ua = window.navigator.userAgent.toLowerCase();
    return (ua.indexOf('android') !== -1);
};
// TODO: move to Growthbeat
var _fetchClient = function (callback) {
    var timerId = setInterval(function () {
        if (_client) {
            clearInterval(timerId);
            callback(_client);
        }
    }, 500);
};
// TODO: move to Growthbeat
function tag(name, value) {
    if (!_registered)
        return;
    if (name == null)
        return;
    var existingTag = JSON.parse(localStorageWrapper.get('growthpush.tag:' + name));
    if (existingTag) {
        if (existingTag.value === value || (existingTag.value == null && (value === '' || value == null))) {
            return;
        }
    }
    _fetchClient(function (client) {
        var params = { clientId: client.getId(), code: client.getCode(), name: name };
        if (value != null && value !== '')
            params.value = value;
        _httpClient.post('1/tags', { params: params }, function (data, code) {
            console.log(data);
            localStorageWrapper.set('growthpush.tag:' + name, JSON.stringify(data));
        }, function (err, code) {
            console.log(err);
        });
    });
}
exports.tag = tag;
// TODO: move to Growthbeat
function track(name, value) {
    if (!_registered)
        return;
    if (name == null)
        return;
    _fetchClient(function (client) {
        var params = { clientId: client.getId(), code: client.getCode(), name: name };
        if (value != null && value !== '')
            params.value = value;
        _httpClient.post('1/events', { params: params }, function (data, code) {
            console.log(data);
        }, function (err, code) {
            console.log(err);
        });
    });
}
exports.track = track;
function permitted() {
    if (!('serviceWorker' in navigator))
        return false;
    if (Notification.permission !== 'granted')
        return false;
    return true;
}
exports.permitted = permitted;

},{"../utils/local-storage-wrapper":5,"./http/http-client":1,"./model/client":3}],3:[function(require,module,exports){
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var localStorageWrapper = require('../../utils/local-storage-wrapper');
var HttpClient = require('../http/http-client');
var Emitter = require('component-emitter');
var HTTP_CLIENT_BASE_URL = 'https://api.growthpush.com/';
var _httpClient = new HttpClient(HTTP_CLIENT_BASE_URL);
var Client = (function (_super) {
    __extends(Client, _super);
    function Client(data) {
        _super.call(this);
        if (data != null)
            this.setData(data);
    }
    Client.prototype.setData = function (data) {
        this.id = data.id;
        this.growthbeatClientId = data.growthbeatClientId;
        this.token = data.token;
        this.applicationId = data.applicationId;
        this.growthbeatApplicationId = data.growthbeatApplicationId;
        this.code = data.code;
        this.os = data.os;
        this.environment = data.environment;
        this.created = data.created;
    };
    Client.load = function () {
        var clientData = localStorageWrapper.get('growthpush.client');
        if (clientData == null)
            return null;
        return new Client(JSON.parse(clientData));
    };
    Client.save = function (data) {
        if (!data)
            return;
        var _data = {
            id: data.id,
            growthbeatClientId: data.growthbeatClientId,
            token: data.token,
            applicationId: data.applicationId,
            growthbeatApplicationId: data.growthbeatApplicationId,
            code: data.code,
            os: data.os,
            environment: data.environment,
            created: data.created
        };
        console.log("save client " + JSON.stringify(_data));
        localStorageWrapper.set('growthpush.client', JSON.stringify(_data));
    };
    Client.create = function (params) {
        var opt = {
            params: {
                applicationId: params.applicationId,
                secret: params.credentialId,
                token: params.token,
                environment: params.environment,
                os: 'android'
            }
        };
        var client = new Client();
        _httpClient.post('1/clients', opt, function (data, code) {
            client.setData(data);
            client.emit('created');
        }, function (err, code) {
            client.emit('error');
        });
        return client;
    };
    Client.update = function (client, params) {
        var opt = {
            params: {
                token: params.token,
                environment: params.environment,
                code: params.code
            }
        };
        var _client = new Client();
        _httpClient.put('1/clients/' + client.id, opt, function (data, code) {
            _client.setData(data);
            _client.emit('updated');
        }, function (err, code) {
            _client.emit('error');
        });
        return _client;
    };
    Client.prototype.getId = function () {
        return this.id;
    };
    Client.prototype.getApplicationId = function () {
        return this.applicationId;
    };
    Client.prototype.getToken = function () {
        return this.token;
    };
    Client.prototype.getEnvironment = function () {
        return this.environment;
    };
    Client.prototype.getCode = function () {
        return this.code;
    };
    return Client;
})(Emitter);
module.exports = Client;

},{"../../utils/local-storage-wrapper":5,"../http/http-client":1,"component-emitter":6}],4:[function(require,module,exports){
///<reference path="../typings/bundle.d.ts" />
///<reference path="../local_typings/service_worker_api.d.ts" />
///<reference path='../local_typings/nanoajax.d.ts' />
///<reference path='../local_typings/component-emitter.d.ts' />
var GrowthPush = require('./growthpush/index');
module.exports = GrowthPush;

},{"./growthpush/index":2}],5:[function(require,module,exports){
function get(name) {
    if (!window.localStorage)
        return null;
    return localStorage.getItem(name);
}
exports.get = get;
function set(name, value) {
    if (!window.localStorage)
        return;
    try {
        localStorage.setItem(name, value);
    }
    catch (e) {
    }
}
exports.set = set;

},{}],6:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],7:[function(require,module,exports){
(function (global){
exports.ajax = function (params, callback) {
  if (typeof params == 'string') params = {url: params}
  var headers = params.headers || {}
    , body = params.body
    , method = params.method || (body ? 'POST' : 'GET')
    , withCredentials = params.withCredentials || false

  var req = getRequest()

  req.onreadystatechange = function () {
    if (req.readyState == 4)
      callback(req.status, req.responseText, req)
  }

  if (body) {
    setDefault(headers, 'X-Requested-With', 'XMLHttpRequest')
    setDefault(headers, 'Content-Type', 'application/x-www-form-urlencoded')
  }

  req.open(method, params.url, true)

  // has no effect in IE
  // has no effect for same-origin requests
  // has no effect in CORS if user has disabled 3rd party cookies
  req.withCredentials = withCredentials

  for (var field in headers)
    req.setRequestHeader(field, headers[field])

  req.send(body)
}

function getRequest() {
  if (global.XMLHttpRequest)
    return new global.XMLHttpRequest;
  else
    try { return new global.ActiveXObject("MSXML2.XMLHTTP.3.0"); } catch(e) {}
  throw new Error('no xmlhttp request able to be created')
}

function setDefault(obj, key, value) {
  obj[key] = obj[key] || value
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[4])(4)
});(function(d) {
  var e;
  if ('function' === typeof CustomEvent) {
    e = new CustomEvent('growthpushReady', {});
  } else {
    e = d.createEvent('Event');
    e.initEvent('growthpushReady', true, true);
  }
  d.dispatchEvent(e);
})(document);