// content.js
(function () {
    // Respond to a message from popup asking for storage data.
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg && msg.type === 'GET_WEBSTORAGE') {
            try {
                const ls = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    ls[k] = localStorage.getItem(k);
                }
                const ss = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    ss[k] = sessionStorage.getItem(k);
                }

                sendResponse({ success: true, localStorage: ls, sessionStorage: ss });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        } else if (msg && msg.type === 'SET_WEBSTORAGE') {
            try {
                const { area, key, value } = msg;
                if (area === 'local') localStorage.setItem(key, value);
                else sessionStorage.setItem(key, value);
                sendResponse({ success: true });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        } else if (msg && msg.type === 'REMOVE_WEBSTORAGE') {
            try {
                const { area, key } = msg;
                if (area === 'local') localStorage.removeItem(key);
                else sessionStorage.removeItem(key);
                sendResponse({ success: true });
            } catch (err) {
                sendResponse({ success: false, error: err.message });
            }
        }
        // add inside content.js message handler:
        else if (msg && msg.type === 'CLEAR_ALL') {
            try {
                localStorage.clear();
                sessionStorage.clear();
                sendResponse({ success: true });
            } catch (err) { sendResponse({ success: false, error: err.message }); }
        }
        // Return true if you want to respond async (we call sendResponse synchronously here)
        return true;
    });
})();
