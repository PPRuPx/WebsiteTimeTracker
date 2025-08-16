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

// Кэш заблокированных доменов для быстрого доступа
let blockedDomainsCache = [];

// --- Вспомогательные функции ---
function getDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.startsWith('www.') ? domain.slice(4) : domain;
  } catch (e) {
    return null;
  }
}

function isDomainBlocked(domain) {
  if (!domain) return false;
  return blockedDomainsCache.some(d => {
    // точное совпадение или поддомен
    return domain === d || domain.endsWith('.' + d);
  });
}

function updateBlockedDomainsCache() {
  chrome.storage.local.get({ blocked: [] }, (data) => {
    blockedDomainsCache = data.blocked || [];
  });
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

// --- Основная система блокировки через webRequest ---
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== 'main_frame' || details.tabId < 0) return;

    const requestedUrl = details.url;
    const requestedDomain = getDomain(requestedUrl);
    if (!requestedDomain) return;

    // Проверяем, заблокирован ли домен
    if (isDomainBlocked(requestedDomain)) {
      originalUrlByTabId[details.tabId] = requestedUrl;
      
      // Сразу перенаправляем на страницу блокировки
      const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(requestedDomain)}`);
      return { redirectUrl: blockedUrl };
    }

    // Дополнительная проверка через declarativeNetRequest (на всякий случай)
    if (chrome.declarativeNetRequest) {
      chrome.declarativeNetRequest.getDynamicRules((rules) => {
        if (chrome.runtime.lastError) {
          return;
        }
        const isBlockedByDeclarative = rules.some(rule => {
          const urlFilter = rule.condition.urlFilter;
          if (urlFilter.startsWith('||') && urlFilter.endsWith('^')) {
            const domain = urlFilter.slice(2, -1);
            return requestedDomain === domain || requestedDomain.endsWith('.' + domain);
          }
          return false;
        });

        if (isBlockedByDeclarative) {
          originalUrlByTabId[details.tabId] = requestedUrl;
        }
      });
    }
  },
  { urls: ["<all_urls>"] }
);

// Дополнительный обработчик для перехвата навигации через history API
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Проверяем только основные навигационные запросы
    if (details.type !== 'main_frame' || details.tabId < 0) return;
    
    const requestedUrl = details.url;
    const requestedDomain = getDomain(requestedUrl);
    if (!requestedDomain) return;

    // Дополнительная проверка для случаев, когда основной обработчик мог не сработать
    if (isDomainBlocked(requestedDomain)) {
      originalUrlByTabId[details.tabId] = requestedUrl;
      
      const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(requestedDomain)}`);
      return { redirectUrl: blockedUrl };
    }
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
}

// --- Обновление правил блокировок ---
function updateBlockedSites() {
  if (suppressStorageRuleUpdate) {
    return;
  }
  
  chrome.storage.local.get({ blocked: [] }, data => {
    const blockedDomains = data.blocked;
    
    // Обновляем кэш заблокированных доменов
    updateBlockedDomainsCache();
    
    // Проверяем доступность declarativeNetRequest API
    if (!chrome.declarativeNetRequest) {
      return;
    }
    
    // Получаем все существующие правила
    chrome.declarativeNetRequest.getDynamicRules((rules) => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      const existingRuleIds = rules.map(rule => rule.id);
      
      // Удаляем все существующие правила
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: []
      }, () => {
        if (chrome.runtime.lastError) {
          return;
        }
        
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
          
          chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [],
            addRules: newRules
          }, () => {
            if (chrome.runtime.lastError) {
              // Ошибка добавления правил
            }
          });
        }
      });
    });
  });
}

// --- Обработчики событий Chrome ---
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab) {
      // Проверяем, не заблокирован ли сайт на активированной вкладке
      if (tab.url) {
        const domain = getDomain(tab.url);
        if (domain && isDomainBlocked(domain)) {
          const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
          
          // Перенаправляем на страницу блокировки
          chrome.tabs.update(tab.id, { url: blockedUrl }, () => {
            if (chrome.runtime.lastError) {
              // Ошибка перенаправления
            }
          });
          return;
        }
      }
      
      startTracking(tab);
    }
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Проверяем блокировку при изменении URL
  if (changeInfo.url && tab.url) {
    const domain = getDomain(tab.url);
    if (domain && isDomainBlocked(domain)) {
      const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
      
      // Перенаправляем на страницу блокировки
      chrome.tabs.update(tabId, { url: blockedUrl }, () => {
        if (chrome.runtime.lastError) {
          // Ошибка перенаправления
        }
      });
      return;
    }
  }
  
  if (tabId === currentTab?.id && changeInfo.url) {
    startTracking(tab);
  }
});

// Перехватываем создание новых вкладок с заблокированными URL
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url) {
    const domain = getDomain(tab.url);
    if (domain && isDomainBlocked(domain)) {
      const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
      
      // Перенаправляем на страницу блокировки
      chrome.tabs.update(tab.id, { url: blockedUrl }, () => {
        if (chrome.runtime.lastError) {
          // Ошибка перенаправления
        }
      });
    }
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (isPopupOpen) {
    return;
  }
});

// Следим за изменениями в списке блокировок
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blocked) {
    if (suppressStorageRuleUpdate) {
      return;
    }
    
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
    port.onDisconnect.addListener(() => {
      isPopupOpen = false;
    });
  }
});

// --- Инициализация ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) startTracking(tabs[0]);
});

// Функция для проверки всех открытых вкладок на предмет заблокированных сайтов
function checkAllOpenTabs() {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      return;
    }
    
    tabs.forEach(tab => {
      if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
        const domain = getDomain(tab.url);
        if (domain && isDomainBlocked(domain)) {
          const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
          
          // Перенаправляем на страницу блокировки
          chrome.tabs.update(tab.id, { url: blockedUrl }, () => {
            if (chrome.runtime.lastError) {
              // Ошибка перенаправления
            }
          });
        }
      }
    });
  });
}

// Инициализируем правила блокировки при запуске
updateBlockedSites();
updateBlockedDomainsCache(); // Инициализируем кэш при запуске

// Проверяем все открытые вкладки после инициализации
setTimeout(checkAllOpenTabs, 1000);

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
    chrome.storage.local.get({ sites: {} }, (data) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      
      const domain = request.domain;
      if (data.sites && data.sites[domain]) {
        const timeSpent = data.sites[domain].time;
        sendResponse({ 
          success: true, 
          timeSpent: timeSpent,
          domain: domain
        });
      } else {
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
    sendResponse({ success: true, originalUrl: originalUrl || null, tabId });
  } else if (request.action === 'unblockAndOpen') {
    const domain = request.domain;
    const targetUrl = request.originalUrl || `https://${domain}`;
    const tabId = sender?.tab?.id ?? null;

    // Устанавливаем флаг подавления
    suppressStorageRuleUpdate = true;

    chrome.storage.local.get({ blocked: [] }, (data) => {
      const blocked = (data.blocked || []).filter(d => d !== domain);
      
      chrome.storage.local.set({ blocked }, () => {
        if (chrome.runtime.lastError) {
          suppressStorageRuleUpdate = false;
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }

        // Перестраиваем правила и после этого переходим на нужный URL
        if (!chrome.declarativeNetRequest) {
          suppressStorageRuleUpdate = false;
          sendResponse({ success: false, error: 'declarativeNetRequest API not available' });
          return;
        }
        
        chrome.declarativeNetRequest.getDynamicRules((rules) => {
          const existingRuleIds = rules.map(r => r.id);
          
          chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: existingRuleIds, addRules: [] }, () => {
            if (chrome.runtime.lastError) {
              suppressStorageRuleUpdate = false;
              sendResponse({ success: false, error: 'Failed to remove rules' });
              return;
            }
            
            const newRules = blocked.map((d, i) => ({
              id: i + 1,
              priority: 1,
              action: { type: 'redirect', redirect: { url: chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(d)}`) } },
              condition: { urlFilter: `||${d}^`, resourceTypes: ['main_frame'] }
            }));
            
            chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [], addRules: newRules }, () => {
              if (chrome.runtime.lastError) {
                suppressStorageRuleUpdate = false;
                sendResponse({ success: false, error: 'Failed to add new rules' });
                return;
              }
              
              if (tabId != null) {
                delete originalUrlByTabId[tabId];
                
                chrome.tabs.update(tabId, { url: targetUrl }, () => {
                  if (chrome.runtime.lastError) {
                    // Ошибка обновления вкладки
                  }
                  
                  // Снимаем флаг подавления ПОСЛЕ навигации
                  suppressStorageRuleUpdate = false;
                  sendResponse({ success: true });
                });
              } else {
                suppressStorageRuleUpdate = false;
                sendResponse({ success: false, error: 'No tabId provided' });
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
  } else if (request.action === "checkAllTabs") {
    // Принудительная проверка всех вкладок
    checkAllOpenTabs();
    sendResponse({ success: true, message: "Checking all open tabs for blocked sites" });
  } else if (request.action === "getBlockedDomains") {
    // Получить список заблокированных доменов
    sendResponse({ success: true, blocked: blockedDomainsCache });
  }
});