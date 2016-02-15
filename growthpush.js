/**
 * Modules in this bundle
 * 
 * eventemitter3:
 *   license: MIT
 *   author: Arnout Kazemier
 *   maintainers: v1 <npm@3rd-Eden.com>, 3rdeden <npm@3rd-Eden.com>, lpinca <luigipinca@gmail.com>
 *   version: 1.1.1
 * 
 * growthpush-javascript:
 *   version: 1.1.3
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = HttpClient;

},{"nanoajax":9}],2:[function(require,module,exports){
var indexeddb_wrapper_1 = require('../utils/indexeddb-wrapper');
var local_storage_wrapper_1 = require('../utils/local-storage-wrapper');
var client_1 = require('./model/client');
var http_client_1 = require('./http/http-client');
var timer_1 = require('../utils/timer');
var EventEmitter3 = require('eventemitter3');
var _httpClient = new http_client_1.default('https://api.growthpush.com/');
var _emitter = new EventEmitter3();
var _initialized = false;
var _registered = false;
var _params = null;
var _client = null;
var _timer = new timer_1.default(300);
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
    var client = client_1.default.load();
    if (client != null && client.getApplicationId() === _params.applicationId) {
        if (client.getToken() === _getSubscriptionId(subscription) &&
            client.getEnvironment() === _params.environment) {
            _client = client;
            return Promise.resolve({ client: client, subscription: subscription });
        }
        return _updateClient(client, subscription);
    }
    return _createClient(subscription);
};
var _createClient = function (subscription) {
    return new Promise(function (resolve, reject) {
        var c = client_1.default.create({
            applicationId: _params.applicationId,
            credentialId: _params.credentialId,
            environment: _params.environment,
            token: _getSubscriptionId(subscription)
        });
        c.on('created', function () {
            _client = c;
            client_1.default.save(c);
            resolve({ client: c, subscription: subscription });
        });
        c.on('error', function () {
            reject(new Error('Error during creating client'));
        });
    });
};
var _updateClient = function (client, subscription) {
    return new Promise(function (resolve, reject) {
        var c = client_1.default.update(client, {
            code: client.getCode(),
            token: _getSubscriptionId(subscription),
            environment: _params.environment
        });
        c.on('updated', function () {
            _client = c;
            client_1.default.save(c);
            resolve({ client: c, subscription: subscription });
        });
        c.on('error', function () {
            reject(new Error('Error during updating client'));
        });
    });
};
var _configure = function (params) {
    var idbWrapper = new indexeddb_wrapper_1.default('growthpush', 1, [
        { name: 'kvs' }
    ]);
    return idbWrapper.open().then(function () {
        return idbWrapper.put('kvs', 'config', {
            applicationId: _params.applicationId,
            credentialId: _params.credentialId,
            title: _params.appName,
            icon: _params.icon,
            clickEventName: _params.clickEventName,
            isDetailEvent: _params.isDetailEvent,
            clientId: params.client.getId(),
            code: params.client.getCode()
        });
    }).catch(function (err) {
        return Promise.reject(new Error('DB configure failed'));
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
        params.environment = 'development';
    if (params.environment !== 'development' && params.environment !== 'production') {
        throw new Error('GrowthPush: unsupported environment: ' + params.environment);
    }
    if (params.isDetailEvent == null)
        params.isDetailEvent = false;
    _params = params;
    _timer.start();
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
    if (!('Notification' in window)) {
        console.warn('Notification API aren\'t supported in this browser.');
        return;
    }
    if (!('indexedDB' in window)) {
        console.warn('indexedDB API aren\'t supported in this browser.');
        return;
    }
    navigator.serviceWorker.register(_params.receiver)
        .then(_fetchRegistration)
        .then(_fetchSubscription)
        .then(_registerClient)
        .then(_configure)
        .then(function (data) {
        console.log('done:', data);
        _registered = true;
        _emitter.emit('registered');
    })
        .catch(function (err) {
        console.log(err);
        if (Notification.permission === 'denied') {
            _timer.stop();
        }
        _emitter.emit('error');
    });
}
exports.register = register;
var _isAndroid = function () {
    var ua = window.navigator.userAgent.toLowerCase();
    return (ua.indexOf('android') !== -1);
};
// TODO: move to Growthbeat
var _fetchClient = function (callback) {
    _timer.add(function () {
        if (_client) {
            callback(_client);
            return false;
        }
        return true;
    });
};
// TODO: move to Growthbeat
function tag(name, value) {
    if (!('Notification' in window))
        return;
    if (!('indexedDB' in window))
        return;
    if (Notification.permission === 'denied')
        return;
    if (name == null)
        return;
    var existingTag = JSON.parse(local_storage_wrapper_1.default.get('growthpush.tag:' + name));
    if (existingTag) {
        if (existingTag.value === value ||
            (existingTag.value == null && (value === '' || value == null))) {
            return;
        }
    }
    _fetchClient(function (client) {
        var params = { clientId: client.getId(), code: client.getCode(), name: name };
        if (value != null && value !== '')
            params.value = value;
        _httpClient.post('1/tags', { params: params }, function (data, code) {
            console.log(data);
            local_storage_wrapper_1.default.set('growthpush.tag:' + name, JSON.stringify(data));
        }, function (err, code) {
            console.log(err);
        });
    });
}
exports.tag = tag;
// TODO: move to Growthbeat
function track(name, value) {
    if (!('Notification' in window))
        return;
    if (!('indexedDB' in window))
        return;
    if (Notification.permission === 'denied')
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
    if (!('Notification' in window))
        return false;
    if (!('indexedDB' in window))
        return;
    if (Notification.permission !== 'granted')
        return false;
    return true;
}
exports.permitted = permitted;
function on(event, fn) {
    _emitter.on(event, fn);
}
exports.on = on;
function once(event, fn) {
    _emitter.once(event, fn);
}
exports.once = once;
function off(event, fn) {
    _emitter.off(event, fn);
}
exports.off = off;
function emit(event) {
    var args = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args[_i - 1] = arguments[_i];
    }
    _emitter.emit(event, args);
}
exports.emit = emit;

},{"../utils/indexeddb-wrapper":5,"../utils/local-storage-wrapper":6,"../utils/timer":7,"./http/http-client":1,"./model/client":3,"eventemitter3":8}],3:[function(require,module,exports){
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var local_storage_wrapper_1 = require('../../utils/local-storage-wrapper');
var http_client_1 = require('../http/http-client');
var EventEmitter3 = require('eventemitter3');
var _httpClient = new http_client_1.default('https://api.growthpush.com/');
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
        var clientData = local_storage_wrapper_1.default.get('growthpush.client');
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
        local_storage_wrapper_1.default.set('growthpush.client', JSON.stringify(_data));
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
})(EventEmitter3);
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Client;

},{"../../utils/local-storage-wrapper":6,"../http/http-client":1,"eventemitter3":8}],4:[function(require,module,exports){
///<reference path="../typings/bundle.d.ts" />
///<reference path="../local_typings/service_worker_api.d.ts" />
///<reference path='../local_typings/nanoajax.d.ts' />
var GrowthPush = require('./growthpush/index');
module.exports = GrowthPush;

},{"./growthpush/index":2}],5:[function(require,module,exports){
var IDBWrapper = (function () {
    function IDBWrapper(dbName, dbVersion, stores) {
        this.db = null;
        this.dbName = dbName;
        this.dbVersion = dbVersion;
        this.stores = stores;
    }
    IDBWrapper.prototype.open = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            console.log('IDBWrapper#open', _this.dbName + '@' + _this.dbVersion);
            if (_this.db != null) {
                console.log('IDBWrapper#open', _this.dbName + '@' + _this.dbVersion + 'is already open');
                return resolve();
            }
            var req = indexedDB.open(_this.dbName, _this.dbVersion);
            req.onupgradeneeded = function (event) {
                console.log('IDBWrapper#open: upgradeneeded');
                var db = event.target.result;
                _this.stores.forEach(function (store) {
                    if (db.objectStoreNames.contains(store.name)) {
                        db.deleteObjectStore(store.name);
                    }
                    db.createObjectStore(store.name, { autoIncrement: false });
                });
            };
            req.onsuccess = function (event) {
                console.log('IDBWrapper#open: success');
                _this.db = event.target.result;
                resolve();
            };
            req.onerror = function (err) {
                console.log('IDBWrapper#open: err:', err);
                reject('Could not open DB');
            };
        });
    };
    IDBWrapper.prototype.put = function (storeName, key, data) {
        console.log('IDBHelper#put');
        if (this.db == null)
            return Promise.reject(new Error('DB: ' + this.dbName + ' is not open'));
        var tx = this.db.transaction([storeName], 'readwrite');
        var store = tx.objectStore(storeName);
        return new Promise(function (resolve, reject) {
            var req = store.put(data, key);
            req.onsuccess = function (event) {
                console.log('IDBWrapper#put: success');
                resolve();
            };
            req.onerror = function (err) {
                console.log('IDBWrapper#put:', err);
                reject('Could not put item');
            };
        });
    };
    IDBWrapper.prototype.get = function (storeName, key) {
        console.log('IDBWrapper#get');
        if (this.db == null)
            return Promise.reject(new Error('DB: ' + this.dbName + ' is not open'));
        var tx = this.db.transaction([storeName], 'readwrite');
        var store = tx.objectStore(storeName);
        return new Promise(function (resolve, reject) {
            var req = store.get(key);
            req.onsuccess = function (event) {
                console.log('IDBWrapper#get: success');
                var result = event.target.result;
                resolve(result);
            };
            req.onerror = function (err) {
                console.log('IDBWrapper#get: err:', err);
                reject('Could not get item');
            };
        });
    };
    return IDBWrapper;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = IDBWrapper;

},{}],6:[function(require,module,exports){
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    get: get,
    set: set
};

},{}],7:[function(require,module,exports){
var Timer = (function () {
    function Timer(delay) {
        this.delay = 1000;
        this.timerId = 0;
        this.timers = [];
        this.delay = delay;
    }
    Timer.prototype.add = function (fn) {
        this.timers.push(fn);
        return this;
    };
    Timer.prototype.start = function () {
        if (this.timerId)
            return;
        var self = this;
        (function runNext() {
            if (self.timers.length > 0) {
                var i;
                for (i = 0; i < self.timers.length; i++) {
                    if (self.timers[i]() === false) {
                        self.timers.splice(i, 1);
                        i--;
                    }
                }
            }
            self.timerId = setTimeout(runNext, self.delay);
        })();
    };
    Timer.prototype.stop = function () {
        clearTimeout(this.timerId);
        this.timerId = 0;
    };
    return Timer;
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Timer;

},{}],8:[function(require,module,exports){
'use strict';

//
// We store our EE objects in a plain object whose properties are event names.
// If `Object.create(null)` is not supported we prefix the event names with a
// `~` to make sure that the built-in object properties are not overridden or
// used as an attack vector.
// We also assume that `Object.create(null)` is available when the event name
// is an ES6 Symbol.
//
var prefix = typeof Object.create !== 'function' ? '~' : false;

/**
 * Representation of a single EventEmitter function.
 *
 * @param {Function} fn Event handler to be called.
 * @param {Mixed} context Context for function execution.
 * @param {Boolean} once Only emit once
 * @api private
 */
function EE(fn, context, once) {
  this.fn = fn;
  this.context = context;
  this.once = once || false;
}

/**
 * Minimal EventEmitter interface that is molded against the Node.js
 * EventEmitter interface.
 *
 * @constructor
 * @api public
 */
function EventEmitter() { /* Nothing to set */ }

/**
 * Holds the assigned EventEmitters by name.
 *
 * @type {Object}
 * @private
 */
EventEmitter.prototype._events = undefined;

/**
 * Return a list of assigned event listeners.
 *
 * @param {String} event The events that should be listed.
 * @param {Boolean} exists We only need to know if there are listeners.
 * @returns {Array|Boolean}
 * @api public
 */
EventEmitter.prototype.listeners = function listeners(event, exists) {
  var evt = prefix ? prefix + event : event
    , available = this._events && this._events[evt];

  if (exists) return !!available;
  if (!available) return [];
  if (available.fn) return [available.fn];

  for (var i = 0, l = available.length, ee = new Array(l); i < l; i++) {
    ee[i] = available[i].fn;
  }

  return ee;
};

/**
 * Emit an event to all registered event listeners.
 *
 * @param {String} event The name of the event.
 * @returns {Boolean} Indication if we've emitted an event.
 * @api public
 */
EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  var evt = prefix ? prefix + event : event;

  if (!this._events || !this._events[evt]) return false;

  var listeners = this._events[evt]
    , len = arguments.length
    , args
    , i;

  if ('function' === typeof listeners.fn) {
    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

    switch (len) {
      case 1: return listeners.fn.call(listeners.context), true;
      case 2: return listeners.fn.call(listeners.context, a1), true;
      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
    }

    for (i = 1, args = new Array(len -1); i < len; i++) {
      args[i - 1] = arguments[i];
    }

    listeners.fn.apply(listeners.context, args);
  } else {
    var length = listeners.length
      , j;

    for (i = 0; i < length; i++) {
      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

      switch (len) {
        case 1: listeners[i].fn.call(listeners[i].context); break;
        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
        default:
          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
            args[j - 1] = arguments[j];
          }

          listeners[i].fn.apply(listeners[i].context, args);
      }
    }
  }

  return true;
};

/**
 * Register a new EventListener for the given event.
 *
 * @param {String} event Name of the event.
 * @param {Functon} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.on = function on(event, fn, context) {
  var listener = new EE(fn, context || this)
    , evt = prefix ? prefix + event : event;

  if (!this._events) this._events = prefix ? {} : Object.create(null);
  if (!this._events[evt]) this._events[evt] = listener;
  else {
    if (!this._events[evt].fn) this._events[evt].push(listener);
    else this._events[evt] = [
      this._events[evt], listener
    ];
  }

  return this;
};

/**
 * Add an EventListener that's only called once.
 *
 * @param {String} event Name of the event.
 * @param {Function} fn Callback function.
 * @param {Mixed} context The context of the function.
 * @api public
 */
EventEmitter.prototype.once = function once(event, fn, context) {
  var listener = new EE(fn, context || this, true)
    , evt = prefix ? prefix + event : event;

  if (!this._events) this._events = prefix ? {} : Object.create(null);
  if (!this._events[evt]) this._events[evt] = listener;
  else {
    if (!this._events[evt].fn) this._events[evt].push(listener);
    else this._events[evt] = [
      this._events[evt], listener
    ];
  }

  return this;
};

/**
 * Remove event listeners.
 *
 * @param {String} event The event we want to remove.
 * @param {Function} fn The listener that we need to find.
 * @param {Mixed} context Only remove listeners matching this context.
 * @param {Boolean} once Only remove once listeners.
 * @api public
 */
EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  var evt = prefix ? prefix + event : event;

  if (!this._events || !this._events[evt]) return this;

  var listeners = this._events[evt]
    , events = [];

  if (fn) {
    if (listeners.fn) {
      if (
           listeners.fn !== fn
        || (once && !listeners.once)
        || (context && listeners.context !== context)
      ) {
        events.push(listeners);
      }
    } else {
      for (var i = 0, length = listeners.length; i < length; i++) {
        if (
             listeners[i].fn !== fn
          || (once && !listeners[i].once)
          || (context && listeners[i].context !== context)
        ) {
          events.push(listeners[i]);
        }
      }
    }
  }

  //
  // Reset the array, or remove it completely if we have no more listeners.
  //
  if (events.length) {
    this._events[evt] = events.length === 1 ? events[0] : events;
  } else {
    delete this._events[evt];
  }

  return this;
};

/**
 * Remove all listeners or only the listeners for the specified event.
 *
 * @param {String} event The event want to remove all listeners for.
 * @api public
 */
EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  if (!this._events) return this;

  if (event) delete this._events[prefix ? prefix + event : event];
  else this._events = prefix ? {} : Object.create(null);

  return this;
};

//
// Alias methods names because people roll like that.
//
EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;

//
// This function doesn't apply anymore.
//
EventEmitter.prototype.setMaxListeners = function setMaxListeners() {
  return this;
};

//
// Expose the prefix.
//
EventEmitter.prefixed = prefix;

//
// Expose the module.
//
if ('undefined' !== typeof module) {
  module.exports = EventEmitter;
}

},{}],9:[function(require,module,exports){
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