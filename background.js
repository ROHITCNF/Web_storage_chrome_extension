// background.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || !msg.type) return;
    if (msg.type === 'GET_COOKIES') {
      const { urlOrDomain } = msg;
      // try to derive domain or url
      chrome.cookies.getAll({ url: urlOrDomain }, (cookies) => {
        // if cookies empty, try getAll by domain
        if (!cookies || cookies.length === 0) {
          // fallback: get by domain pattern
          chrome.cookies.getAll({ domain: new URL(urlOrDomain).hostname }, (byDomain) => {
            sendResponse({ success: true, cookies: byDomain || [] });
          });
        } else {
          sendResponse({ success: true, cookies: cookies });
        }
      });
      return true; // indicates sendResponse will be called async
    } else if (msg.type === 'REMOVE_COOKIE') {
      const { name, url } = msg;
      chrome.cookies.remove({ name, url }, (details) => {
        sendResponse({ success: !!details, details });
      });
      return true;
    }
    if (msg.type === 'EDIT_COOKIE') {
      const { name, url, value, path, domain, secure, httpOnly } = msg;
      chrome.cookies.set({ name, url, value, path, domain, secure, httpOnly }, (cookie) => {
        if (cookie) sendResponse({ success: true });
        else sendResponse({ success: false });
      });
      return true; // Keep sendResponse async
    }
  });
  