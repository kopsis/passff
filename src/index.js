/* jshint node: true */
'use strict';

let { Cc, Ci } = require('chrome');

let buttons = require('sdk/ui/button/action');
let simplePrefs = require('sdk/simple-prefs');
let prefs = simplePrefs.prefs;
let self = require('sdk/self');
let tabs = require('sdk/tabs');
let { Hotkey } = require('sdk/hotkeys');

let workers = require('lib/workers');
let pass = require('lib/pass');

let panel = require('sdk/panel').Panel({
  contentURL: self.data.url('panel.html'),
  contentScriptFile: self.data.url('panel.js')
});
let autoFillItems = new Array();

let copyToClipboard = function(text) {
  let str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
  let trans = Cc['@mozilla.org/widget/transferable;1'].createInstance(Ci.nsITransferable);
  let clip = Cc['@mozilla.org/widget/clipboard;1'].getService(Ci.nsIClipboard);

  str.data = text

  trans.addDataFlavor('text/unicode');
  trans.setTransferData('text/unicode', str, str.data.length * 2);

  clip.setData(trans, null, Ci.nsIClipboard.kGlobalClipboard);
}

let button;
let showPanel = function() {
  panel.show({ position: button });
  panel.port.emit('menu-opened');
};
button = buttons.ActionButton({
  id: 'passff-button',
  label: 'PassFF',
  icon: {
    '16': './img/icon-16.png',
    '32': './img/icon-32.png',
    '64': './img/icon-64.png',
    '128': './img/icon-128.png'
  },
  onClick: showPanel
});
// Set the global hotkey
var hotkey;
try {
  hotkey = Hotkey({combo: prefs.hotkey, onPress: showPanel});
} catch (e) {
  console.error("Invalid hotkey:", prefs.hotkey, e);
}
// Update hotkey if user changes it
simplePrefs.on('hotkey', function() {
  hotkey && hotkey.destroy && hotkey.destroy(); // destroy old hotkey
  try {
    hotkey = Hotkey({combo: prefs.hotkey, onPress: showPanel});
  } catch (e) {
    console.debug("Invalid hotkey:", prefs.hotkey, e);
  }
});


let setContextualMenuItems = function() {
  let activeURL = tabs.activeTab.url;
  panel.port.emit('update-items', pass.getUrlMatchingItems(activeURL));
};

panel.port.on('fill', function (item) {
  panel.hide();
  workers.getWorker(tabs.activeTab).port.emit('fill', pass.getPasswordData(item));
});

panel.port.on('fill-submit', function (item) {
  panel.hide();
  workers.getWorker(tabs.activeTab).port.emit('fill-submit', pass.getPasswordData(item));
});

panel.port.on('goto', function (item) {
  panel.hide();
  tabs.activeTab.url = pass.getPasswordData(item).url
});

panel.port.on('goto-fill-submit', function (item) {
  panel.hide();
  autoFillItems.push({'tab': tabs.activeTab, 'item': item})
  tabs.activeTab.url = pass.getPasswordData(item).url
});

panel.port.on('copy-login', function (item) {
  panel.hide();
  copyToClipboard(pass.getPasswordData(item).login);
});
panel.port.on('copy-password', function (item) {
  panel.hide();
  copyToClipboard(pass.getPasswordData(item).password);
});
panel.port.on('display-password', function (item) {
  panel.hide();
  workers.getWorker(tabs.activeTab).port.emit('display-password', pass.getPasswordData(item).fullText);
});
panel.port.on('enter-pressed', function (item, useNewTab) {
  panel.hide();
  let worker = workers.getWorker(tabs.activeTab);
  let passwordData = pass.getPasswordData(item)
  switch (prefs.enterBehavior) {
    case 0: // goto, fill, submit
      // DUP: 'goto-fill-submit' handler above
      autoFillItems.push({'tab': tabs.activeTab, 'item': item})
      let url = pass.getPasswordData(item).url;
      if (useNewTab) {
        tabs.open(url);
      } else {
        tabs.activeTab.url = url;
      }
      break;
    case 1: // fill, submit
      worker.port.emit('fill-submit', passwordData);
      break;
    case 2: // fill
      worker.port.emit('fill', passwordData);
      break;
  }
});
panel.port.on('search', function (searchTerm) {
  let searchResults = pass.getMatchingItems(searchTerm, 20);
  panel.port.emit('update-items', searchResults);
});
panel.port.on('refresh-items', function(searchTerm) {
  pass.reloadItems();
  let items = pass.getRootItems();
  if (/\S/.test(searchTerm)) {
    items = pass.getMatchingItems(searchTerm, 20);
  }
  panel.port.emit('update-items', items);
});
panel.port.on('display-contextual', setContextualMenuItems);
panel.port.on('display-all', function() {
  panel.port.emit('update-items', pass.getRootItems());
});

// Update the menu items to match the new URL as tabs open or switch
tabs.on('activate', setContextualMenuItems);
tabs.on('pageshow', setContextualMenuItems);

// If necessary, auto-fill when a new tab is loaded
tabs.on('ready', function(tab) {
  let elm = autoFillItems.find(function(elm) { return elm.tab == tab })
  if (elm) {
    workers.getWorker(tabs.activeTab).port.emit('fill-submit', pass.getPasswordData(elm.item));
    for (let i = 0; i < autoFillItems.length; i++) {
      if (autoFillItems[i] == elm) {
        autoFillItems.splice(i, 1);
        break;
      }
    }
  }
});

exports.main = function(options) {
  if (options.loadReason === 'install') {
    // Add-on was just installed. Set intelligent initial preferences
    let osString = Cc["@mozilla.org/xre/app-info;1"]
                     .getService(Ci.nsIXULRuntime)
                     .OS;
    console.info("PassFF installed");

    if (osString === 'Darwin') {
      console.log("Overriding initial preferences for OS X");
      prefs.command   = '/usr/local/bin/pass';
      prefs.shellArgs = '--login';
      prefs.callType  = 'shell';
    } else {
      console.log("OS is " + osString + ". Using default preferences");
    }
  }
};
