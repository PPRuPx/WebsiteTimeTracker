// --- Глобальные переменные ---
let currentTab = null;
let currentDomain = null;
let startTime = null;
let isWindowFocused = true;
let isPopupOpen = false;

// Запоминаем исходный URL, который был заблокирован, по tabId
const originalUrlByTabId = {};

// Подавление автоматического обновления правил при изменении storage
let suppressStorageRuleUpdate = false;

// --- Вспомогательные функции ---
function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.startsWith('www.') ? domain.slice(4) : domain;
  } catch (e) {
    return null;
  }
}

function saveTime(domain, milliseconds) {
  if (!domain || milliseconds <= 0) return;
  chrome.storage.local.get({ sites: {} }, (data) => {
    const sites = data.sites;
    if (!sites[domain]) {
      sites[domain] = {
        time: 0,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}`,
        title: domain,
      };
    }
    sites[domain].time += milliseconds;
    chrome.storage.local.set({ sites });
  });
}

function isWindowActive() {
  // Проверяем видимость вкладки
  const isTabVisible = document.visibilityState === 'visible';
  // Проверяем, не свернуто ли окно (не всегда точно)
  const isWindowNotMinimized = window.innerHeight > 0;
  // Возвращаем true, только если вкладка видима и окно в фокусе
  return isTabVisible && isWindowFocused && isWindowNotMinimized;
}

function updateWindowFocusState(windowId) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    isWindowFocused = false;
    return;
  }
  chrome.windows.get(windowId, (win) => {
    if (chrome.runtime.lastError) {
      isWindowFocused = false;
      return;
    }
    isWindowFocused = win.state !== "minimized" && win.focused;
  });
}

// --- Следим за исходными запросами к заблокированным доменам ---
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== 'main_frame' || details.tabId < 0) return;

    const requestedUrl = details.url;
    const requestedDomain = getDomain(requestedUrl);
    if (!requestedDomain) return;

    chrome.storage.local.get({ blocked: [] }, (data) => {
      const blocked = data.blocked || [];
      const isBlocked = blocked.some(d => {
        // точное совпадение или поддомен
        return requestedDomain === d || requestedDomain.endsWith('.' + d);
      });
      if (isBlocked) {
        originalUrlByTabId[details.tabId] = requestedUrl;
      }
    });
  },
  { urls: ["<all_urls>"] }
);

// --- Основная логика отслеживания ---
function startTracking(tab) {
  if (!tab?.url) return;
  const domain = getDomain(tab.url);
  if (!domain) return;

  // Не учитываем страницы расширения (например, blocked.html)
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) 
    return;

  // Сохраняем время для предыдущего домена
  if (currentDomain && startTime && isWindowFocused) {
    const milliseconds = Date.now() - startTime;
    if (milliseconds > 0) {
      saveTime(currentDomain, milliseconds);
    }
  }

  // Начинаем новую сессию
  currentDomain = domain;
  startTime = Date.now();
  currentTab = tab;

  console.log(`Started tracking: ${currentDomain} at ${new Date(startTime).toISOString()}`);
}

// --- Обновление правил блокировок ---
function updateBlockedSites() {
  if (suppressStorageRuleUpdate) {
    console.log('updateBlockedSites: SUPPRESSED due to active unblock flow');
    return;
  }
  
  console.log('updateBlockedSites: STARTING (suppressStorageRuleUpdate =', suppressStorageRuleUpdate, ')');
  
  chrome.storage.local.get({ blocked: [] }, data => {
    const blockedDomains = data.blocked;
    console.log('Blocked domains from storage:', blockedDomains);
    
    // Получаем все существующие правила
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting dynamic rules:', chrome.runtime.lastError);
        return;
      }
      
      const existingRuleIds = rules.map(rule => rule.id);
      console.log('Existing rule IDs:', existingRuleIds);
      
      // Удаляем все существующие правила
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: []
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error removing existing rules:', chrome.runtime.lastError);
          return;
        }
        
        console.log('Removed existing rules');
        
        // После удаления добавляем новые правила
        if (blockedDomains.length > 0) {
          const newRules = blockedDomains.map((domain, i) => ({
            id: i + 1,
            priority: 1,
            action: {
              type: "redirect",
              redirect: { 
                url: chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`)
              }
            },
            condition: {
              urlFilter: `||${domain}^`,
              resourceTypes: ["main_frame"]
            }
          }));
          
          console.log('Adding new rules:', newRules);
          
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [],
            addRules: newRules
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error adding rules:', chrome.runtime.lastError);
            } else {
              console.log(`Successfully updated blocking rules for ${blockedDomains.length} domains:`, blockedDomains);
            }
          });
        } else {
          console.log('No domains to block, rules cleared');
        }
      });
    });
  });
}

// --- Обработчики событий Chrome ---
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab) startTracking(tab);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === currentTab?.id && changeInfo.url) {
    startTracking(tab);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (isPopupOpen) {
    console.log("Popup is open, ignoring focus change.");
    return;
  }
});

// Следим за изменениями в списке блокировок
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blocked) {
    console.log('=== storage.onChanged triggered ===');
    console.log('Changes:', changes);
    console.log('suppressStorageRuleUpdate =', suppressStorageRuleUpdate);
    
    if (suppressStorageRuleUpdate) {
      console.log('updateBlockedSites: SUPPRESSED due to active unblock flow');
      return;
    }
    
    console.log('updateBlockedSites: PROCEEDING (suppressStorageRuleUpdate =', suppressStorageRuleUpdate, ')');
    console.log('Old value:', changes.blocked.oldValue);
    console.log('New value:', changes.blocked.newValue);
    updateBlockedSites();
  }
});

// --- Таймер для регулярного сохранения времени ---
setInterval(() => {
  chrome.windows.getAll({ populate: false }, (windows) => {
    const activeNormalWindow = windows.find(w =>
      w.type === "normal" && w.state !== "minimized" && w.focused
    );
    if (currentDomain && startTime && (activeNormalWindow || isPopupOpen)) {
      const milliseconds = Date.now() - startTime;
      startTime = Date.now();
      saveTime(currentDomain, milliseconds);
    }
  });
}, 1000);

// --- Отслеживание открытия и закрытия попапа ---
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    isPopupOpen = true;
    console.log("Popup opened");
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
      console.log("Popup closed");
    });
  }
});

// --- Инициализация ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) startTracking(tabs[0]);
});

// Инициализируем правила блокировки при запуске
console.log('Initializing Website Time Tracker...');
updateBlockedSites();

// --- API для страниц расширения ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getCurrentTime") {
    const elapsedTime = isWindowFocused && currentDomain && startTime
      ? Date.now() - startTime
      : 0;
    sendResponse({
      domain: currentDomain,
      currentTime: elapsedTime,
      isActive: isWindowFocused,
    });
  } else if (request.action === "getSiteStats") {
    // Данные для blocked.html
    console.log('Getting site stats for domain:', request.domain);
    
    chrome.storage.local.get({ sites: {} }, (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error in getSiteStats:', chrome.runtime.lastError);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      const domain = request.domain;
      if (data.sites && data.sites[domain]) {
        const timeSpent = data.sites[domain].time;
        console.log(`Site stats for ${domain}: ${timeSpent}ms`);
        sendResponse({ 
          success: true, 
          timeSpent: timeSpent,
          domain: domain
        });
      } else {
        console.log(`No stats found for domain: ${domain}`);
        sendResponse({ 
          success: false, 
          error: 'No data found',
          domain: domain
        });
      }
    });
    return true;
  } else if (request.action === 'getOriginalBlockedUrl') {
    const tabId = sender?.tab?.id ?? null;
    const originalUrl = tabId != null ? originalUrlByTabId[tabId] : undefined;
    console.log('getOriginalBlockedUrl -> tabId:', tabId, 'originalUrl:', originalUrl);
    sendResponse({ success: true, originalUrl: originalUrl || null, tabId });
  } else if (request.action === 'unblockAndOpen') {
    const domain = request.domain;
    const targetUrl = request.originalUrl || `https://${domain}`;
    const tabId = sender?.tab?.id ?? null;
    console.log('=== unblockAndOpen START ===');
    console.log('Request details:', { domain, targetUrl, tabId });
    console.log('Current suppressStorageRuleUpdate:', suppressStorageRuleUpdate);

    // Устанавливаем флаг подавления
    suppressStorageRuleUpdate = true;
    console.log('Set suppressStorageRuleUpdate = true');

    chrome.storage.local.get({ blocked: [] }, (data) => {
      console.log('Current blocked sites from storage:', data.blocked);
      const blocked = (data.blocked || []).filter(d => d !== domain);
      console.log('Filtered blocked sites (removed', domain, '):', blocked);
      
      chrome.storage.local.set({ blocked }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving unblocked sites:', chrome.runtime.lastError);
          suppressStorageRuleUpdate = false;
          console.log('Reset suppressStorageRuleUpdate = false due to error');
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        console.log('Successfully saved updated blocked sites to storage');
        console.log('Starting declarativeNetRequest rules update...');

        // Перестраиваем правила и после этого переходим на нужный URL
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
          console.log('Current dynamic rules:', rules);
          const existingRuleIds = rules.map(r => r.id);
          console.log('Removing existing rule IDs:', existingRuleIds);
          
          chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRuleIds, addRules: [] }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error removing existing rules:', chrome.runtime.lastError);
              suppressStorageRuleUpdate = false;
              sendResponse({ success: false, error: 'Failed to remove rules' });
              return;
            }
            
            console.log('Successfully removed existing rules');
            
            const newRules = blocked.map((d, i) => ({
              id: i + 1,
              priority: 1,
              action: { type: 'redirect', redirect: { url: chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(d)}`) } },
              condition: { urlFilter: `||${d}^`, resourceTypes: ['main_frame'] }
            }));
            
            console.log('Adding new rules:', newRules);
            
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [], addRules: newRules }, () => {
              if (chrome.runtime.lastError) {
                console.error('Error adding new rules:', chrome.runtime.lastError);
                suppressStorageRuleUpdate = false;
                sendResponse({ success: false, error: 'Failed to add new rules' });
                return;
              }
              
              console.log('Successfully updated declarativeNetRequest rules');
              console.log('Now updating tab URL to:', targetUrl);
              
              if (tabId != null) {
                delete originalUrlByTabId[tabId];
                console.log('Deleted originalUrlByTabId for tabId:', tabId);
                
                chrome.tabs.update(tabId, { url: targetUrl }, () => {
                  if (chrome.runtime.lastError) {
                    console.error('Error updating tab URL:', chrome.runtime.lastError);
                  } else {
                    console.log('Successfully updated tab URL to:', targetUrl);
                  }
                  
                  // Снимаем флаг подавления ПОСЛЕ навигации
                  suppressStorageRuleUpdate = false;
                  console.log('Reset suppressStorageRuleUpdate = false after navigation');
                  sendResponse({ success: true });
                });
              } else {
                console.log('No tabId provided, skipping tab update');
                suppressStorageRuleUpdate = false;
                console.log('Reset suppressStorageRuleUpdate = false (no tab update)');
                sendResponse({ success: true });
              }
            });
          });
        });
      });
    });
    return true;
  } else if (request.action === "ping") {
    // Отвечаем на ping от тестовой страницы
    sendResponse({
      status: "ok",
      message: "Website Time Tracker is running",
      currentDomain: currentDomain,
      isTracking: !!startTime,
      timestamp: Date.now()
    });
  }
});