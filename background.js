// --- Глобальные переменные ---
let currentTab = null;
let currentDomain = null;
let startTime = null;
let isWindowFocused = true;
let isPopupOpen = false;

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

// --- Основная логика отслеживания ---
function startTracking(tab) {
  if (!tab?.url) return;
  const domain = getDomain(tab.url);
  if (!domain) return;

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

  updateWindowFocusState(windowId);

  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) startTracking(tabs[0]);
    });
  } else if (currentDomain && startTime) {
    const milliseconds = Date.now() - startTime;
    if (milliseconds > 0) {
      saveTime(currentDomain, milliseconds);
    }
    startTime = null;
    console.log(`Window lost focus. Paused tracking: ${currentDomain}`);
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

// --- API для popup.js ---
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
  }
});