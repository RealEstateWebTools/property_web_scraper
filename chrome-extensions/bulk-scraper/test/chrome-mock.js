/**
 * Chrome API mock factory for testing Chrome extensions.
 * Provides in-memory implementations of chrome.storage, chrome.runtime,
 * chrome.tabs, chrome.action, and chrome.scripting.
 */

export function createChromeMock() {
  // In-memory storage backends
  const localStore = {};
  const syncStore = {};

  function makeStorageArea(store) {
    return {
      get(keys, callback) {
        const result = {};
        const keyList = typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys || store);
        for (const k of keyList) {
          if (k in store) result[k] = JSON.parse(JSON.stringify(store[k]));
        }
        if (callback) { callback(result); return; }
        return Promise.resolve(result);
      },
      set(items, callback) {
        Object.assign(store, JSON.parse(JSON.stringify(items)));
        if (callback) { callback(); return; }
        return Promise.resolve();
      },
      remove(keys, callback) {
        const keyList = typeof keys === 'string' ? [keys] : keys;
        for (const k of keyList) delete store[k];
        if (callback) { callback(); return; }
        return Promise.resolve();
      },
    };
  }

  function makeEventTarget() {
    const listeners = [];
    return {
      addListener(fn) { listeners.push(fn); },
      removeListener(fn) {
        const idx = listeners.indexOf(fn);
        if (idx >= 0) listeners.splice(idx, 1);
      },
      _listeners: listeners,
      _fire(...args) {
        for (const fn of listeners) fn(...args);
      },
    };
  }

  const badgeState = {};
  const titleState = {};

  return {
    storage: {
      local: makeStorageArea(localStore),
      sync: makeStorageArea(syncStore),
      onChanged: makeEventTarget(),
    },
    runtime: {
      onMessage: makeEventTarget(),
      onStartup: makeEventTarget(),
      sendMessage(msg, callback) {
        const listeners = this.onMessage._listeners;
        for (const fn of listeners) {
          const result = fn(msg, {}, (response) => {
            if (callback) callback(response);
          });
          if (result === true) return;
          break;
        }
      },
    },
    tabs: {
      _tabs: [],
      _nextId: 1000,
      query(queryInfo, callback) {
        const result = this._tabs;
        if (callback) { callback(result); return; }
        return Promise.resolve(result);
      },
      get(tabId, callback) {
        const tab = this._tabs.find(t => t.id === tabId) || { id: tabId };
        if (callback) { callback(tab); return; }
        return Promise.resolve(tab);
      },
      sendMessage(tabId, msg, callback) {
        if (callback) { callback({}); return; }
        return Promise.resolve({});
      },
      create(opts) {
        const tab = { id: this._nextId++, ...opts };
        this._tabs.push(tab);
        return Promise.resolve(tab);
      },
      remove(tabId) {
        this._tabs = this._tabs.filter(t => t.id !== tabId);
        return Promise.resolve();
      },
      onUpdated: makeEventTarget(),
      onActivated: makeEventTarget(),
    },
    action: {
      setBadgeText(opts) { badgeState[opts.tabId || 'default'] = opts.text; },
      setBadgeBackgroundColor(opts) { /* stored but not asserted */ },
      setTitle(opts) { titleState[opts.tabId || 'default'] = opts.title; },
      _getBadgeText(tabId) { return badgeState[tabId]; },
      _getTitle(tabId) { return titleState[tabId]; },
    },
    scripting: {
      executeScript(opts) { return Promise.resolve([{ result: '<html></html>' }]); },
    },
  };
}
