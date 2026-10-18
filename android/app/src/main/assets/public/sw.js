/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-afac4cd2'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "87f8ea937ca0f3cfe59c111660114d3f"
  }, {
    "url": "pwa-512x512.png",
    "revision": "79ce3118133b9de519f1b77c01330984"
  }, {
    "url": "pwa-192x192.png",
    "revision": "81ad0ecdb614533939c3f481765b40a8"
  }, {
    "url": "index.html",
    "revision": "ae8edf85197c2a60bb4c1dc8020c513c"
  }, {
    "url": "icon.svg",
    "revision": "746c78b2a4fbfed7d16c3f08e0e43c17"
  }, {
    "url": "favicon.ico",
    "revision": "2b9a6d5db08922b6c51cf955ba9cfb38"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "45b54d4d0667cd0ffce9a935d01bb39d"
  }, {
    "url": "assets/web-7oKq-jLC.js",
    "revision": null
  }, {
    "url": "assets/purify.es-Bvo9QlJ8.js",
    "revision": null
  }, {
    "url": "assets/index.es-BsPRmJgN.js",
    "revision": null
  }, {
    "url": "assets/index-UjZN62Cr.js",
    "revision": null
  }, {
    "url": "assets/index-Beu9VuUF.css",
    "revision": null
  }, {
    "url": "assets/html2canvas-CPwq80bC.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "45b54d4d0667cd0ffce9a935d01bb39d"
  }, {
    "url": "favicon.ico",
    "revision": "2b9a6d5db08922b6c51cf955ba9cfb38"
  }, {
    "url": "icon.svg",
    "revision": "746c78b2a4fbfed7d16c3f08e0e43c17"
  }, {
    "url": "pwa-192x192.png",
    "revision": "81ad0ecdb614533939c3f481765b40a8"
  }, {
    "url": "pwa-512x512.png",
    "revision": "79ce3118133b9de519f1b77c01330984"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "87f8ea937ca0f3cfe59c111660114d3f"
  }, {
    "url": "manifest.webmanifest",
    "revision": "d923713b9f225ddda621b2b911d4a5ff"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 15,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 15,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
