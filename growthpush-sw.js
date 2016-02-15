(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/// <reference path="../local_typings/service_worker_api.d.ts" />
var indexeddb_wrapper_1 = require('./utils/indexeddb-wrapper');
var DB_NAME = 'growthpush';
var DB_VERSION = 1;
var idbWrapper = new indexeddb_wrapper_1.default(DB_NAME, DB_VERSION, [
    { name: 'kvs' }
]);
self.addEventListener('install', function (event) {
    console.log('install', event);
    event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function (event) {
    console.log('activate', event);
    event.waitUntil(self.clients.claim());
});
self.addEventListener('push', function (event) {
    console.log('push', event);
    event.waitUntil(handlePush(event));
});
self.addEventListener('notificationclick', function (event) {
    console.log('notificationclick', event);
    event.waitUntil(handleNotificationClick(event));
});
function handlePush(event) {
    var _config = null;
    return idbWrapper.open().then(function () {
        return idbWrapper.get('kvs', 'config').then(function (result) {
            if (result == null) {
                return Promise.reject('Config does not exist');
            }
            console.log('config:', result);
            _config = result;
        });
    }).then(function () {
        return self.registration.pushManager.getSubscription().then(function (subscription) {
            console.log('subscription:', subscription);
            console.log('applicationId:', _config['applicationId']);
            console.log('credentialId:', _config['credentialId']);
            var url = 'https://api.growthpush.com/1/trials' +
                '?token=' + getSubscriptionId(subscription) +
                '&applicationId=' + _config['applicationId'] +
                '&secret=' + _config['credentialId'];
            return Promise.resolve(url);
        });
    }).then(function (url) {
        return self.fetch(url).then(function (res) {
            if (res.status !== 200)
                return Promise.reject('Status code isn\'t 200');
            return Promise.resolve(res);
        });
    }).then(function (res) {
        return res.json().then(function (data) {
            return Promise.resolve(data);
        });
    }).then(function (data) {
        var hash = (data.extra == null) ? '' : '#' + encodeURIComponent(data.extra);
        var extra = (data.extra == null) ? {} : JSON.parse(data.extra);
        var title = (extra.title == null) ? _config['title'] : extra.title;
        var icon = (extra.icon == null) ? _config['icon'] : extra.icon;
        return self.registration.showNotification(title, {
            icon: icon + hash,
            body: data.text,
            tag: 'growthpush-trialId=' + data.trialId,
            vibrate: data.sound ? 1000 : 0,
        });
    }).catch(function (err) {
        console.log(err);
    });
}
function handleNotificationClick(event) {
    event.notification.close();
    var data = {};
    var matches = event.notification.icon.match(/#(.+)/);
    if (matches != null && matches.length > 1)
        data = JSON.parse(decodeURIComponent(matches[1]));
    return Promise.all([openWindow(data), sendClientEvent(data)]);
}
function openWindow(data) {
    if (self.clients.openWindow) {
        if ('url' in data)
            return self.clients.openWindow(data['url']);
    }
    return self.clients.matchAll({ type: 'window' }).then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
            var client = clientList[i];
            if (client.url === '/' && 'focus' in client) {
                return client.focus();
            }
        }
        if (self.clients.openWindow) {
            return self.clients.openWindow('/');
        }
    });
}
function sendClientEvent(data) {
    var launchEventName = '';
    if ('growthpush' in data && 'notificationId' in data.growthpush) {
        launchEventName = 'Launch@Notification-' + data.growthpush.notificationId;
    }
    return idbWrapper.open().then(function () {
        return idbWrapper.get('kvs', 'config').then(function (result) {
            if (result == null) {
                return Promise.reject('Config does not exist');
            }
            console.log('config:', result);
            return Promise.resolve(result);
        });
    }).then(function (config) {
        var _body = 'clientId=' + config['clientId'] + '&code=' + config['code'];
        var fetches = [postEvent(_body + '&name=' + config['clickEventName'])];
        if (launchEventName !== '' && config['isDetailEvent']) {
            fetches.push(postEvent(_body + '&name=' + launchEventName));
        }
        return Promise.all(fetches);
    });
}
function postEvent(body) {
    return self.fetch('https://api.growthpush.com/1/events', {
        method: 'post',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: body
    }).then(function (res) {
        if (res.status !== 200)
            return Promise.reject('Status code isn\'t 200');
        return res.json().then(function (data) {
            console.log(data);
        });
    }).catch(function (err) {
        console.log(err);
    });
}
// 'PushSubscription.subscriptionId' is deprecated
function getSubscriptionId(subscription) {
    if (subscription.subscriptionId == null) {
        return subscription.endpoint.split('/').pop();
    }
    return subscription.subscriptionId;
}

},{"./utils/indexeddb-wrapper":2}],2:[function(require,module,exports){
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

},{}]},{},[1]);
