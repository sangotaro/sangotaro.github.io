/// <reference path="../local_typings/service_worker_api.d.ts" />
var DB_NAME = 'growthpush';
var DB_VERSION = 1;
var DB_STORE_NAME = 'misc';
var _initialized = false;
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
        setConfig(message.data).then(function () {
            init();
            event.ports[0].postMessage({});
        }).catch(function (err) {
            event.ports[0].postMessage({
                error: new Error('Fail initialization: ' + err)
            });
        });
    }
    else {
        event.ports[0].postMessage({
            error: new Error('Unsupported message type: ' + message.type)
        });
    }
});
function init() {
    if (_initialized)
        return;
    _initialized = true;
    self.addEventListener('push', function (event) {
        console.log('push', event);
        event.waitUntil(handlePush(event));
    });
    self.addEventListener('notificationclick', function (event) {
        console.log('notificationclick', event);
        event.waitUntil(handleNotificationClick(event).then(sendClientEvent));
    });
}
function handlePush(event) {
    return self.registration.showNotification('固定タイトル', {
        icon: '/sample/img/gp_icon.png',
        body: '固定テキスト',
        tag: 'growthpush-trialId=',
        vibrate: 1000,
    });
    //var _config:any = null;
    //return getConfig().then((config) => {
    //    _config = config;
    //    return self.registration.pushManager.getSubscription().then((subscription:PushSubscription) => {
    //        console.log('subscription:', subscription);
    //        console.log('applicationId:', _config['applicationId']);
    //        console.log('credentialId:', _config['credentialId']);
    //        var url = 'https://api.growthpush.com/1/trials' +
    //            '?token=' + getSubscriptionId(subscription) +
    //            '&applicationId=' + _config['applicationId'] +
    //            '&secret=' + _config['credentialId'];
    //
    //        return Promise.resolve(url);
    //    });
    //}).then((url) => {
    //    return self.fetch(url).then((res:Response) => {
    //        if (res.status !== 200) return Promise.reject('Status code isn\'t 200');
    //        return Promise.resolve(res);
    //    });
    //}).then((res:Response) => {
    //    return res.json().then((data:any) => {
    //        return Promise.resolve(data);
    //    });
    //}).then((data:any) => {
    //    var hash = (data.extra == null) ? '' : '#' + encodeURIComponent(data.extra);
    //
    //    return self.registration.showNotification(_config['title'], {
    //        icon: _config['icon'] + hash,
    //        body: data.text,
    //        tag: 'growthpush-trialId=' + data.trialId,
    //        vibrate: data.sound ? 1000 : 0,
    //        //silent: !data.sound
    //    });
    //}).catch((err) => {
    //    console.log(err);
    //});
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
    return getConfig().then(function (config) {
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
function openStore() {
    return new Promise(function (resolve, reject) {
        var req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = function (event) {
            console.log('DB open: upgradeneeded');
            var db = event.target.result;
            if (db.objectStoreNames.contains(DB_STORE_NAME)) {
                db.deleteObjectStore(DB_STORE_NAME);
            }
            db.createObjectStore(DB_STORE_NAME, { keyPath: 'key' });
        };
        req.onerror = function (err) {
            console.log('DB open: error');
            reject(err);
        };
        req.onsuccess = function (event) {
            console.log('DB open: success');
            var db = event.target.result;
            resolve(db);
        };
    });
}
function setConfig(data) {
    return openStore().then(function (db) {
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction(DB_STORE_NAME, 'readwrite');
            var store = transaction.objectStore(DB_STORE_NAME);
            var req = store.put({
                key: 'config',
                applicationId: data['applicationId'],
                credentialId: data['credentialId'],
                title: data['title'],
                icon: data['icon'],
                clickEventName: data['clickEventName'],
                clientId: data['clientId'],
                code: data['code']
            });
            req.onsuccess = function (event) {
                resolve(event);
            };
            req.onerror = function (err) {
                reject(err);
            };
        });
    });
}
function getConfig() {
    return openStore().then(function (db) {
        return new Promise(function (resolve, reject) {
            var transaction = db.transaction(DB_STORE_NAME, 'readonly');
            var store = transaction.objectStore(DB_STORE_NAME);
            var req = store.get('config');
            req.onsuccess = function (event) {
                var result = event.target.result;
                if (result) {
                    resolve(result);
                }
                else {
                    reject('no data');
                }
            };
            req.onerror = function (err) {
                reject(err);
            };
        });
    });
}
