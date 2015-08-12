/// <reference path="../local_typings/service_worker_api.d.ts" />
var _initialized = false;
var _config = {};
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
        init(message.data);
        event.ports[0].postMessage({});
    }
    else {
        event.ports[0].postMessage({
            error: new Error('Unsupported message type: ' + message.type)
        });
    }
});
function init(data) {
    if (_initialized)
        return;
    _initialized = true;
    _config = data;
    self.addEventListener('push', function (event) {
        console.log('push', event);
        //event.waitUntil(handlePush(event));
        event.waitUntil(self.registration.pushManager.getSubscription().then(function (subscription) {
            var url = 'https://api.growthpush.com/1/trials' + '?token=' + getSubscriptionId(subscription) + '&applicationId=' + _config['applicationId'] + '&secret=' + _config['credentialId'];
            return self.fetch(url).then(function (res) {
                if (res.status !== 200)
                    return Promise.reject('Status code isn\'t 200');
                return res.json().then(function(data) {
                    var hash = (data.extra == null) ? '' : '#' + encodeURIComponent(data.extra);
                    return self.registration.showNotification(_config['title'], {
                        icon: _config['icon'] + hash,
                        body: data.text,
                        tag: 'growthpush-trialId=' + data.trialId,
                        vibrate: data.sound ? 1000 : 0,
                    });
                });
            }).catch(function (err) {
                console.log(err);
                return Promise.reject(err);
            });
        }));

    });
    self.addEventListener('notificationclick', function (event) {
        console.log('notificationclick', event);
        event.waitUntil(handleNotificationClick(event).then(sendClientEvent));
    });
}
function handlePush(event) {
    return self.registration.pushManager.getSubscription().then(function (subscription) {
        console.log('subscription:', subscription);
        console.log('applicationId:', _config['applicationId']);
        console.log('credentialId:', _config['credentialId']);
        var url = 'https://api.growthpush.com/1/trials' + '?token=' + getSubscriptionId(subscription) + '&applicationId=' + _config['applicationId'] + '&secret=' + _config['credentialId'];
        return Promise.resolve(url);
    }).then(function (url) {
        return self.fetch(url).then(function (res) {
            if (res.status !== 200)
                return Promise.reject('Status code isn\'t 200');
            return res.json();
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
    return self.fetch('https://api.growthpush.com/1/events', {
        method: 'post',
        headers: {
            'Content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: 'clientId=' + _config['clientId'] + '&code=' + _config['code'] + '&name=' + _config['clickEventName']
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
