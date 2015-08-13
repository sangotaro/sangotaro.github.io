/// <reference path="../local_typings/service_worker_api.d.ts" />
var DB_NAME = 'growthpush';
var DB_VERSION = 1;
var DB_STORE_NAME = 'kvs';
self.addEventListener('install', function (event) {
    console.log('install', event);
    event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function (event) {
    console.log('activate', event);
    event.waitUntil(self.clients.claim());
});
self.addEventListener('message', function (event) {
    console.log('message', event);
    var message = JSON.parse(event.data);
    if (message.type === 'init') {
        IDBHelper.open().then(function () {
            //message.data.key = 'config';
            return IDBHelper.put('config', message.data).then(function () {
                event.ports[0].postMessage({});
            });
        }).catch(function (err) {
            event.ports[0].postMessage({
                error: 'Fail initialization: ' + JSON.stringify(err)
            });
        });
    }
    else {
        event.ports[0].postMessage({
            error: 'Unsupported message type: ' + message.type
        });
    }
});
self.addEventListener('push', function (event) {
    console.log('push', event);
    event.waitUntil(handlePush(event));
});
self.addEventListener('notificationclick', function (event) {
    console.log('notificationclick', event);
    event.waitUntil(handleNotificationClick(event).then(sendClientEvent));
});
function handlePush(event) {
    var _config = null;
    return IDBHelper.open().then(function () {
        return IDBHelper.get('config').then(function (result) {
            console.log('config:', result);
            _config = result;
        });
    }).then(function () {
        return self.registration.pushManager.getSubscription().then(function (subscription) {
            console.log('subscription:', subscription);
            console.log('applicationId:', _config['applicationId']);
            console.log('credentialId:', _config['credentialId']);
            var url = 'https://api.growthpush.com/1/trials' + '?token=' + getSubscriptionId(subscription) + '&applicationId=' + _config['applicationId'] + '&secret=' + _config['credentialId'];
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
        return self.registration.showNotification(_config['title'], {
            icon: _config['icon'] + hash,
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
function sendClientEvent() {
    return IDBHelper.open().then(function () {
        return IDBHelper.get('config').then(function (result) {
            console.log('config:', result);
            return Promise.resolve(result);
        });
    }).then(function (config) {
        return self.fetch('https://api.growthpush.com/1/events', {
            method: 'post',
            headers: {
                'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
            },
            body: 'clientId=' + config['clientId'] + '&code=' + config['code'] + '&name=' + config['clickEventName']
        });
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
var IDBHelper = (function () {
    var db = null;
    var open = function () {
        var promise = new Promise(function (resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = function (event) {
                db = event.target.result;
                //e.target.transaction.onerror = indexedDB.onerror;
                if (db.objectStoreNames.contains(DB_STORE_NAME)) {
                    db.deleteObjectStore(DB_STORE_NAME);
                }
                //db.createObjectStore(DB_STORE_NAME, {keyPath: 'key'});
                db.createObjectStore(DB_STORE_NAME, { autoIncrement: false });
            };
            req.onsuccess = function (event) {
                db = event.target.result;
                resolve();
            };
            req.onerror = function (err) {
                reject('Could not open DB');
            };
        });
        return promise;
    };
    var put = function (key, data) {
        var tx = db.transaction([DB_STORE_NAME], 'readwrite');
        var store = tx.objectStore(DB_STORE_NAME);
        var promise = new Promise(function (resolve, reject) {
            var req = store.put(data, key);
            req.onsuccess = function (event) {
                resolve();
            };
            req.onerror = function (err) {
                reject('Could not put item');
            };
        });
        return promise;
    };
    var get = function (key) {
        var tx = db.transaction([DB_STORE_NAME], 'readwrite');
        var store = tx.objectStore(DB_STORE_NAME);
        var promise = new Promise(function (resolve, reject) {
            var req = store.get(key);
            req.onsuccess = function (event) {
                var result = event.target.result;
                resolve(result);
            };
            req.onerror = function (err) {
                reject('Could not get item');
            };
        });
        return promise;
    };
    return {
        open: open,
        put: put,
        get: get
    };
})();
