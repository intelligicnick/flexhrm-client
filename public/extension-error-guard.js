/**
 * Suppress noisy browser-extension errors in DevTools (password managers, tab sync, ad blockers).
 * Extensions call chrome.runtime.sendMessage without listeners — not an app bug.
 */
(function () {
  var MARKERS = [
    'tabs:outgoing.message.ready',
    'outgoing.message.ready',
    'no listener:',
    'message channel closed before a response was received',
    'could not establish connection',
    'receiving end does not exist',
    'the message port closed before a response was received',
    'a listener indicated an asynchronous response by returning true',
    'extension context invalidated',
    'chrome.runtime.sendmessage',
  ];

  var DEVTOOLS_PROMOS = [
    'download the react devtools',
    'react.dev/link/react-devtools',
  ];

  function flatten(value, depth) {
    if (value == null || depth > 6) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Error) {
      return [value.message, value.stack, value.cause ? flatten(value.cause, depth + 1) : '']
        .filter(Boolean)
        .join(' ');
    }
    if (typeof value === 'object') {
      return [
        value.message,
        value.name,
        value.stack,
        value.reason ? flatten(value.reason, depth + 1) : '',
        value.error ? flatten(value.error, depth + 1) : '',
        String(value),
      ]
        .filter(Boolean)
        .join(' ');
    }
    return String(value);
  }

  function isExtensionNoise(value) {
    var text = flatten(value, 0).toLowerCase();
    for (var i = 0; i < MARKERS.length; i++) {
      if (text.indexOf(MARKERS[i]) !== -1) return true;
    }
    return false;
  }

  function isDevToolsPromo(value) {
    var text = flatten(value, 0).toLowerCase();
    for (var i = 0; i < DEVTOOLS_PROMOS.length; i++) {
      if (text.indexOf(DEVTOOLS_PROMOS[i]) !== -1) return true;
    }
    return false;
  }

  function isExtensionSource(filename) {
    if (!filename) return false;
    return (
      filename.indexOf('chrome-extension://') !== -1 ||
      filename.indexOf('moz-extension://') !== -1 ||
      /(^|\/)vendor\.js($|\?)/.test(filename) ||
      /^VM\d+ /.test(filename)
    );
  }

  function argsToText(args) {
    return Array.prototype.slice.call(args).map(function (arg) {
      return flatten(arg, 0);
    }).join(' ');
  }

  function swallow(event, reason) {
    if (!isExtensionNoise(reason)) return false;
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    if (event && typeof event.stopImmediatePropagation === 'function') {
      event.stopImmediatePropagation();
    }
    return true;
  }

  function onUnhandledRejection(event) {
    swallow(event, event.reason);
  }

  function onWindowError(event) {
    if (
      swallow(event, event.message) ||
      swallow(event, event.error) ||
      (isExtensionSource(event.filename) && swallow(event, event.message || event.error))
    ) {
      return;
    }
  }

  var root = typeof globalThis !== 'undefined' ? globalThis : window;

  root.addEventListener('unhandledrejection', onUnhandledRejection, true);
  root.addEventListener('error', onWindowError, true);
  root.onunhandledrejection = onUnhandledRejection;
  root.onerror = function (message, source, _lineno, _colno, error) {
    if (
      isExtensionNoise(message) ||
      isExtensionNoise(error) ||
      (isExtensionSource(source) && isExtensionNoise(message || error))
    ) {
      return true;
    }
    return false;
  };

  ['error', 'warn', 'info', 'log', 'debug'].forEach(function (method) {
    var original = console[method];
    if (typeof original !== 'function') return;

    console[method] = function () {
      var text = argsToText(arguments);
      if (isExtensionNoise(text)) return;
      if (isDevToolsPromo(text)) return;
      if (/vendor\.js/.test(text) && isExtensionNoise(text)) return;
      return original.apply(console, arguments);
    };
  });
})();
