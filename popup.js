// popup.js
document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refreshBtn');
    const listEl = document.getElementById('list');
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    let currentTab = null;
    let currentData = { localStorage: {}, sessionStorage: {}, cookies: [] };
    let activeTabName = 'local';
  
    // Tab buttons
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeTabName = btn.dataset.tab;
        renderList();
      });
    });
  
    refreshBtn.addEventListener('click', fetchAll);
    exportBtn.addEventListener('click', () => exportJSON(currentData));
    clearBtn.addEventListener('click', clearAllForCurrentTab);
  
    async function getActiveTab() {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0];
    }
  
    async function fetchAll() {
      listEl.innerHTML = 'Loading...';
      currentTab = await getActiveTab();
      if (!currentTab || !currentTab.url) { listEl.innerText = 'No active tab'; return; }
  
      // inject content script into page to ensure listener is available
      try {
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ['content.js']
        });
      } catch (err) {
        console.error('executeScript error', err);
      }
  
      // Ask content script for storage
      chrome.tabs.sendMessage(currentTab.id, { type: 'GET_WEBSTORAGE' }, (res) => {
        if (!res) {
          listEl.innerText = 'Unable to access storage on this page (maybe extension not allowed).';
          currentData.localStorage = {};
          currentData.sessionStorage = {};
        } else if (!res.success) {
          listEl.innerText = 'Error reading storage: ' + res.error;
        } else {
          currentData.localStorage = res.localStorage || {};
          currentData.sessionStorage = res.sessionStorage || {};
        }
        // Ask background for cookies
        chrome.runtime.sendMessage({ type: 'GET_COOKIES', urlOrDomain: currentTab.url }, (cookieResp) => {
          if (!cookieResp || !cookieResp.success) currentData.cookies = [];
          else currentData.cookies = cookieResp.cookies || [];
          renderList();
        });
      });
    }
  
    function renderList() {
      listEl.innerHTML = '';
      if (activeTabName === 'local') {
        renderKeyValue(currentData.localStorage, 'local');
      } else if (activeTabName === 'session') {
        renderKeyValue(currentData.sessionStorage, 'session');
      } else {
        renderCookies(currentData.cookies);
      }
    }
  
    function renderKeyValue(obj, area) {
      if (!obj || Object.keys(obj).length === 0) { listEl.innerText = '(empty)'; return; }
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        const item = document.createElement('div');
        item.className = 'item';
        item.innerHTML = `
          <div class="key" title="${escapeHtml(k)}">${escapeHtml(k)}</div>
          <div class="value" title="${escapeHtml(String(v))}">${escapeHtml(truncate(String(v), 80))}</div>
          <div class="actions">
            <button data-act="edit">Edit</button>
            <button data-act="delete">Delete</button>
          </div>
        `;
        // attach handlers
        item.querySelector('[data-act="edit"]').addEventListener('click', () => editKey(area, k, v));
        item.querySelector('[data-act="delete"]').addEventListener('click', () => removeKey(area, k));
        listEl.appendChild(item);
      }
    }
  
    function renderCookies(cookies) {
      if (!cookies || cookies.length === 0) { 
        listEl.innerText = '(no cookies)'; 
        return; 
      }
    
      for (const c of cookies) {
        const item = document.createElement('div');
        item.className = 'item';
        
        // Format expiry date nicely
        let expiry = c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleString() : 'Session';
        
        item.innerHTML = `
          <div class="key" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          <div class="value" title="${escapeHtml(c.value)}">${escapeHtml(truncate(c.value, 80))}</div>
          <div class="expiry">Expiry: ${expiry}</div>
          <div class="actions">
            <button data-act="edit">Edit</button>
            <button data-act="del">Delete</button>
          </div>
        `;
        
        // Edit cookie
        item.querySelector('[data-act="edit"]').addEventListener('click', () => {
          const newVal = prompt(`Edit value for cookie "${c.name}"`, c.value);
          if (newVal === null) return;
          
          chrome.runtime.sendMessage({
            type: 'EDIT_COOKIE',
            name: c.name,
            url: buildCookieUrlFromCookie(c),
            value: newVal,
            path: c.path,
            domain: c.domain,
            secure: c.secure,
            httpOnly: c.httpOnly,
          }, (resp) => {
            if (resp && resp.success) fetchAll();
            else alert('Failed to edit cookie (HttpOnly or domain restriction may apply)');
          });
        });
    
        // Delete cookie
        item.querySelector('[data-act="del"]').addEventListener('click', () => {
          chrome.runtime.sendMessage({ 
            type: 'REMOVE_COOKIE', 
            name: c.name, 
            url: buildCookieUrlFromCookie(c) 
          }, (resp) => {
            if (resp && resp.success) fetchAll();
            else alert('Failed to delete cookie');
          });
        });
    
        listEl.appendChild(item);
      }
    }
    
  
    function buildCookieUrlFromCookie(c) {
      // cookie.url required for chrome.cookies.remove — construct from domain and secure flag
      const protocol = c.secure ? 'https://' : 'http://';
      // cookie.domain may start with dot
      const domain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      const path = c.path || '/';
      return protocol + domain + path;
    }
  
    function editKey(area, key, oldVal) {
      const newVal = prompt(`Edit value for "${key}"`, oldVal);
      if (newVal === null) return;
      chrome.tabs.sendMessage(currentTab.id, { type: 'SET_WEBSTORAGE', area: area === 'local' ? 'local' : 'session', key, value: newVal }, (res) => {
        if (res && res.success) fetchAll();
        else alert('Failed to set value');
      });
    }
  
    function removeKey(area, key) {
      if (!confirm(`Remove "${key}"?`)) return;
      chrome.tabs.sendMessage(currentTab.id, { type: 'REMOVE_WEBSTORAGE', area: area === 'local' ? 'local' : 'session', key }, (res) => {
        if (res && res.success) fetchAll();
        else alert('Failed to remove key');
      });
    }
  
    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, (m) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;" }[m]));
    }
    function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }
  
    function exportJSON(data) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      chrome.downloads ? chrome.downloads.download({ url, filename: 'storage_export.json' }) : downloadURL(url, 'storage_export.json');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function downloadURL(url, filename) {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    }
  
    function clearAllForCurrentTab() {
      if (!confirm('Clear all localStorage, sessionStorage and cookies for current tab?')) return;
      // clear local/session via content script
      chrome.tabs.sendMessage(currentTab.id, { type: 'CLEAR_ALL' }, (res) => {
        // implement CLEAR_ALL in content.js if you want; for now we remove keys individually
        fetchAll();
      });
      // remove cookies
      for (const c of currentData.cookies || []) {
        chrome.runtime.sendMessage({ type: 'REMOVE_COOKIE', name: c.name, url: buildCookieUrlFromCookie(c) }, () => {});
      }
      setTimeout(fetchAll, 700);
    }
  
    // initial load
    fetchAll();
  });
  