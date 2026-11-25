// ==UserScript==
// @name         Zalo Web Privacy Notifications (Orca)
// @namespace    zalo.privacy
// @version      3.0
// @description  Hides Zalo Web notification contents, keeping only a generic alert, and shows a banner for every message.
// @match        https://chat.zalo.me/*
// @run-at       document-start
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    const GENERIC_BODY = 'Bạn có tin nhắn mới'; // Customize your generic text here (null = keep real text)

    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    if (win.__zaloFixInstalled) return; // safe to paste twice
    win.__zaloFixInstalled = true;

    function modify(options) {
        const o = { ...(options || {}) };
        if (GENERIC_BODY !== null) o.body = GENERIC_BODY;
        // Zalo reuses one tag per conversation; Orca then shows only the first banner.
        // A unique tag gives every message its own banner.
        if (o.tag) o.tag = o.tag + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        return o;
    }

    // 1. Intercept standard notifications (what Zalo uses)
    if (win.Notification) {
        const OriginalNotification = win.Notification;
        win.Notification = new Proxy(OriginalNotification, {
            construct(target, args) {
                return Reflect.construct(target, [args[0], modify(args[1])]);
            },
            // keeps Notification.permission / requestPermission live
            get(target, prop) {
                const v = Reflect.get(target, prop, target);
                return typeof v === 'function' && prop !== 'prototype' ? v.bind(target) : v;
            }
        });
    }

    // 2. Intercept Service Worker notifications (fallback)
    if (win.ServiceWorkerRegistration) {
        const originalShowNotification = win.ServiceWorkerRegistration.prototype.showNotification;
        win.ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
            return originalShowNotification.call(this, title, modify(options));
        };
    }

    console.info('[zalo-fix] installed');
})();
