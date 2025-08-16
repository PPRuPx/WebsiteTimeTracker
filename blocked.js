(function() {
  'use strict';

  // DOM helpers
  function $(id) { return document.getElementById(id); }

  // Функция для применения локализации
  function applyLocalization() {
    // Заголовок
    const blockedTitle = $('blockedTitle');
    if (blockedTitle) {
      blockedTitle.textContent = localeUtils.t('siteBlockedTitle');
    }
    
    // Сообщение
    const blockedMessage = $('blockedMessage');
    if (blockedMessage) {
      blockedMessage.textContent = localeUtils.t('siteBlockedMessage');
    }
    
    // Лейбл времени
    const timeSpentLabel = $('timeSpentLabel');
    if (timeSpentLabel) {
      timeSpentLabel.textContent = localeUtils.t('timeSpent');
    }
    
    // Кнопка разблокировки
    const unblockButtonText = $('unblockButtonText');
    if (unblockButtonText) {
      unblockButtonText.textContent = localeUtils.t('unblockButton').replace('🔓 ', '');
    }
    
    // Футер
    const footer = $('footer');
    if (footer) {
      footer.textContent = localeUtils.t('footer');
    }
  }

  // Проверяем доступность Chrome Extension API
  function checkChromeAPI() {
    if (typeof chrome === 'undefined') {
      return false;
    }
    
    if (!chrome.runtime) {
      return false;
    }
    
    if (!chrome.storage) {
      return false;
    }
    
    return true;
  }
  
  // Получаем информацию о заблокированном сайте
  function getBlockedSiteInfo() {
    // Пытаемся получить домен из различных источников
    let domain = getDomainFromMultipleSources();
    
    if (!domain) {
      $('timeSpent').textContent = localeUtils.t('timeSpentNoData');
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    // Проверяем доступность Chrome API
    if (!checkChromeAPI()) {
      $('timeSpent').textContent = localeUtils.t('timeSpentError');
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    // Пытаемся получить данные через runtime.sendMessage как альтернативу
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        action: 'getSiteStats',
        domain: domain
      }, (response) => {
        if (chrome.runtime.lastError) {
          getDataFromStorage(domain);
        } else if (response && response.success) {
          displayTimeStats(domain, response.timeSpent);
        } else {
          getDataFromStorage(domain);
        }
      });
    } else {
      getDataFromStorage(domain);
    }
  }
  
  // Функция для получения данных из storage
  function getDataFromStorage(domain) {
    // Дополнительная проверка storage
    if (!chrome.storage || !chrome.storage.local) {
      $('timeSpent').textContent = 'Ошибка: Chrome storage недоступен';
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    chrome.storage.local.get({ sites: {}, blocked: [] }, (data) => {
      if (chrome.runtime.lastError) {
        $('timeSpent').textContent = localeUtils.t('timeSpentLoadError');
        $('timeSpent').className = 'time-spent error';
        return;
      }
      
      if (data.sites && data.sites[domain]) {
        const timeSpent = data.sites[domain].time;
        displayTimeStats(domain, timeSpent);
      } else {
        // Попробуем найти похожие домены
        const similarDomains = Object.keys(data.sites || {}).filter(site => 
          site.includes(domain) || domain.includes(site)
        );
        
        if (similarDomains.length > 0) {
          const timeSpent = data.sites[similarDomains[0]].time;
          displayTimeStats(similarDomains[0], timeSpent);
        } else {
          $('timeSpent').textContent = localeUtils.t('timeSpentNotFound');
          $('timeSpent').className = 'time-spent error';
        }
      }
    });
  }
  
  // Функция для отображения статистики времени
  function displayTimeStats(domain, timeSpent) {
    if (!timeSpent || timeSpent <= 0) {
      $('timeSpent').textContent = localeUtils.t('timeNotTracked');
      $('timeSpent').className = 'time-spent';
      return;
    }
    
    const hours = Math.floor(timeSpent / 3600000);
    const minutes = Math.floor((timeSpent % 3600000) / 60000);
    
    let timeText = '';
    if (hours > 0) {
      timeText = localeUtils.t('hoursMinutes', { hours, minutes });
    } else if (minutes > 0) {
      timeText = localeUtils.t('minutes', { minutes });
    } else {
      timeText = localeUtils.t('lessThanMinute');
    }
    
    const timeElement = $('timeSpent');
    if (timeElement) {
      timeElement.textContent = `${timeText}`;
      timeElement.className = 'time-spent';
    }
  }
  
  // Функция для получения домена из нескольких источников
  function getDomainFromMultipleSources() {
    // 1. Пытаемся получить из URL параметров (если есть)
    const urlParams = new URLSearchParams(window.location.search);
    const domainFromUrl = urlParams.get('domain');
    if (domainFromUrl) {
      return domainFromUrl;
    }
    
    // 2. Пытаемся получить из referrer
    const referrer = document.referrer;
    if (referrer && !referrer.includes('blocked.html')) {
      try {
        const domain = new URL(referrer).hostname;
        if (domain.startsWith('www.')) {
          const cleanDomain = domain.slice(4);
          return cleanDomain;
        }
        return domain;
      } catch (e) {
        // Ошибка парсинга referrer
      }
    }
    
    // 3. Пытаемся получить из sessionStorage (если был установлен)
    const domainFromSession = sessionStorage.getItem('blockedDomain');
    if (domainFromSession) {
      return domainFromSession;
    }
    
    // 4. Пытаемся получить из localStorage
    const domainFromLocal = localStorage.getItem('lastBlockedDomain');
    if (domainFromLocal) {
      return domainFromLocal;
    }
    
    return null;
  }
  
  // Подтверждение разблокировки
  function confirmUnblock() {
    const domain = getDomainFromMultipleSources();
    
    const message = domain 
      ? localeUtils.t('confirmUnblock', { domain })
      : localeUtils.t('confirmUnblockGeneric');
    
    if (confirm(message)) {
      unblockSite();
    }
  }
  
  // Разблокировать сайт
  function unblockSite() {
    if (!checkChromeAPI()) {
      alert(localeUtils.t('timeSpentError'));
      return;
    }
    
    const domain = getDomainFromMultipleSources();
    if (!domain) {
      window.history.back();
      return;
    }
    
    // Показываем индикатор загрузки
    const btnUnblock = document.getElementById('btnUnblock');
    if (btnUnblock) {
      btnUnblock.disabled = true;
      btnUnblock.innerHTML = `<span>⏳</span> ${localeUtils.t('unblocking')}`;
    }
    
    // Используем новую логику через background.js
    chrome.runtime.sendMessage({
      action: 'getOriginalBlockedUrl'
    }, (response) => {
      if (chrome.runtime.lastError) {
        // Fallback: просто перейти на https://domain
        window.location.href = `https://${domain}`;
        return;
      }
      
      const originalUrl = response && response.originalUrl ? response.originalUrl : null;
      
      // Отправляем запрос на разблокировку и переход
      chrome.runtime.sendMessage({
        action: 'unblockAndOpen',
        domain: domain,
        originalUrl: originalUrl
      }, (unblockResponse) => {
        if (chrome.runtime.lastError) {
          // Fallback: просто перейти на https://domain
          window.location.href = originalUrl || `https://${domain}`;
          return;
        }
        
        if (unblockResponse && unblockResponse.success) {
          // Background.js обработает навигацию, показываем сообщение об успехе
          if (btnUnblock) {
            btnUnblock.innerHTML = `<span>✅</span> ${localeUtils.t('unblocked')}`;
            btnUnblock.style.background = '#28a745';
          }
          
          // Небольшая задержка перед переходом
          setTimeout(() => {
            window.location.href = originalUrl || `https://${domain}`;
          }, 500);
        } else {
          // Fallback: просто перейти на https://domain
          if (btnUnblock) {
            btnUnblock.disabled = false;
            btnUnblock.innerHTML = `<span>🔓</span> ${localeUtils.t('unblockButton').replace('🔓 ', '')}`;
          }
          window.location.href = originalUrl || `https://${domain}`;
        }
      });
    });
  }
  
  // Вернуться назад
  function goBack() {
    if (document.referrer && !document.referrer.includes('blocked.html')) {
      window.location.href = document.referrer;
    } else {
      window.history.back();
    }
  }

  // Bind events after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    // Применяем локализацию
    applyLocalization();
    
    // Bind button events
    const btnUnblock = $('btnUnblock');
    const btnBack = $('btnBack');
    
    if (btnUnblock) {
      btnUnblock.addEventListener('click', confirmUnblock);
    }
    
    if (btnBack) {
      btnBack.addEventListener('click', goBack);
    }
    
    // Load site info
    getBlockedSiteInfo();
  });
})(); 