(function() {
  'use strict';

  // DOM helpers
  function $(id) { return document.getElementById(id); }

  // Проверяем доступность Chrome Extension API
  function checkChromeAPI() {
    console.log('=== Checking Chrome Extension API ===');
    console.log('typeof chrome:', typeof chrome);
    console.log('chrome object:', chrome);
    
    if (typeof chrome === 'undefined') {
      console.error('Chrome object is undefined');
      return false;
    }
    
    if (!chrome.runtime) {
      console.error('chrome.runtime is undefined');
      return false;
    }
    
    if (!chrome.storage) {
      console.error('chrome.storage is undefined');
      return false;
    }
    
    console.log('✅ Chrome Extension API is available');
    return true;
  }
  
  // Получаем информацию о заблокированном сайте
  function getBlockedSiteInfo() {
    console.log('=== getBlockedSiteInfo() called ===');
    console.log('Current URL:', window.location.href);
    console.log('URL search params:', window.location.search);
    console.log('Document ready state:', document.readyState);
    
    // Пытаемся получить домен из различных источников
    let domain = getDomainFromMultipleSources();
    
    console.log('Final detected domain:', domain);
    
    if (!domain) {
      console.log('No domain detected, showing error message');
      $('timeSpent').textContent = 'Информация недоступна';
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    console.log('Detected domain:', domain);
    
    // Проверяем доступность Chrome API
    if (!checkChromeAPI()) {
      console.error('Chrome Extension API not available');
      $('timeSpent').textContent = 'Ошибка: Chrome Extension API недоступен';
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    // Пытаемся получить данные через runtime.sendMessage как альтернативу
    if (chrome.runtime && chrome.runtime.sendMessage) {
      console.log('Trying to get data via runtime.sendMessage...');
      chrome.runtime.sendMessage({
        action: 'getSiteStats',
        domain: domain
      }, (response) => {
        console.log('Runtime message response:', response);
        if (chrome.runtime.lastError) {
          console.log('Runtime message failed, falling back to storage:', chrome.runtime.lastError);
          getDataFromStorage(domain);
        } else if (response && response.success) {
          console.log('Got data via runtime message:', response);
          displayTimeStats(domain, response.timeSpent);
        } else {
          console.log('Runtime message failed, falling back to storage');
          getDataFromStorage(domain);
        }
      });
    } else {
      console.log('Runtime not available, using storage directly');
      getDataFromStorage(domain);
    }
  }
  
  // Функция для получения данных из storage
  function getDataFromStorage(domain) {
    console.log('=== getDataFromStorage() called ===');
    console.log('Getting data from storage for domain:', domain);
    
    // Дополнительная проверка storage
    if (!chrome.storage || !chrome.storage.local) {
      console.error('Chrome storage.local is not available');
      $('timeSpent').textContent = 'Ошибка: Chrome storage недоступен';
      $('timeSpent').className = 'time-spent error';
      return;
    }
    
    console.log('Chrome storage.local is available, calling get...');
    
    chrome.storage.local.get({ sites: {}, blocked: [] }, (data) => {
      console.log('=== Storage callback executed ===');
      console.log('Storage data received:', data);
      console.log('Looking for domain:', domain);
      console.log('Available sites:', Object.keys(data.sites || {}));
      
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        $('timeSpent').textContent = 'Ошибка загрузки данных';
        $('timeSpent').className = 'time-spent error';
        return;
      }
      
      if (data.sites && data.sites[domain]) {
        const timeSpent = data.sites[domain].time;
        console.log(`Raw time data for ${domain}:`, timeSpent);
        displayTimeStats(domain, timeSpent);
      } else {
        console.log(`No data found for domain: ${domain}`);
        console.log('Available domains in storage:', Object.keys(data.sites || {}));
        
        // Попробуем найти похожие домены
        const similarDomains = Object.keys(data.sites || {}).filter(site => 
          site.includes(domain) || domain.includes(site)
        );
        console.log('Similar domains found:', similarDomains);
        
        if (similarDomains.length > 0) {
          console.log('Using similar domain:', similarDomains[0]);
          const timeSpent = data.sites[similarDomains[0]].time;
          displayTimeStats(similarDomains[0], timeSpent);
        } else {
          $('timeSpent').textContent = 'Данные не найдены';
          $('timeSpent').className = 'time-spent error';
        }
      }
    });
  }
  
  // Функция для отображения статистики времени
  function displayTimeStats(domain, timeSpent) {
    console.log('=== displayTimeStats() called ===');
    console.log(`Displaying time stats for ${domain}:`, timeSpent);
    console.log('timeSpent type:', typeof timeSpent);
    console.log('timeSpent value:', timeSpent);
    
    if (!timeSpent || timeSpent <= 0) {
      console.log('Time spent is 0 or invalid, showing "no time tracked" message');
      $('timeSpent').textContent = 'Время не отслеживалось';
      $('timeSpent').className = 'time-spent';
      return;
    }
    
    const hours = Math.floor(timeSpent / 3600000);
    const minutes = Math.floor((timeSpent % 3600000) / 60000);
    
    console.log(`Calculated hours: ${hours}, minutes: ${minutes}`);
    
    let timeText = '';
    if (hours > 0) {
      timeText = `${hours}ч ${minutes}м`;
    } else if (minutes > 0) {
      timeText = `${minutes} минут`;
    } else {
      timeText = 'Менее минуты';
    }
    
    console.log(`Final time text: "${timeText}"`);
    console.log(`Setting element text to: "Проведено времени: ${timeText}"`);
    
    const timeElement = $('timeSpent');
    if (timeElement) {
      timeElement.textContent = `Проведено времени: ${timeText}`;
      timeElement.className = 'time-spent';
      console.log('Element updated successfully');
    } else {
      console.error('Element with id "timeSpent" not found!');
    }
  }
  
  // Функция для получения домена из нескольких источников
  function getDomainFromMultipleSources() {
    console.log('=== Getting domain from multiple sources ===');
    
    // 1. Пытаемся получить из URL параметров (если есть)
    const urlParams = new URLSearchParams(window.location.search);
    const domainFromUrl = urlParams.get('domain');
    console.log('1. Domain from URL params:', domainFromUrl);
    if (domainFromUrl) {
      console.log('✅ Using domain from URL params:', domainFromUrl);
      return domainFromUrl;
    }
    
    // 2. Пытаемся получить из referrer
    const referrer = document.referrer;
    console.log('2. Document referrer:', referrer);
    if (referrer && !referrer.includes('blocked.html')) {
      try {
        const domain = new URL(referrer).hostname;
        if (domain.startsWith('www.')) {
          const cleanDomain = domain.slice(4);
          console.log('✅ Using domain from referrer (cleaned):', cleanDomain);
          return cleanDomain;
        }
        console.log('✅ Using domain from referrer:', domain);
        return domain;
      } catch (e) {
        console.error('Error parsing referrer:', e);
      }
    }
    
    // 3. Пытаемся получить из sessionStorage (если был установлен)
    const domainFromSession = sessionStorage.getItem('blockedDomain');
    console.log('3. Domain from sessionStorage:', domainFromSession);
    if (domainFromSession) {
      console.log('✅ Using domain from sessionStorage:', domainFromSession);
      return domainFromSession;
    }
    
    // 4. Пытаемся получить из localStorage
    const domainFromLocal = localStorage.getItem('lastBlockedDomain');
    console.log('4. Domain from localStorage:', domainFromLocal);
    if (domainFromLocal) {
      console.log('✅ Using domain from localStorage:', domainFromLocal);
      return domainFromLocal;
    }
    
    console.log('❌ No domain found from any source');
    return null;
  }
  
  // Подтверждение разблокировки
  function confirmUnblock() {
    const domain = getDomainFromMultipleSources();
    
    const message = domain 
      ? `Вы уверены, что хотите разблокировать сайт "${domain}"?`
      : 'Вы уверены, что хотите разблокировать этот сайт?';
    
    if (confirm(message)) {
      unblockSite();
    }
  }
  
  // Разблокировать сайт
  function unblockSite() {
    console.log('=== unblockSite() called ===');
    
    if (!checkChromeAPI()) {
      console.error('Chrome Extension API not available');
      alert('Ошибка: Chrome Extension API недоступен');
      return;
    }
    
    const domain = getDomainFromMultipleSources();
    if (!domain) {
      console.log('No domain to unblock, going back');
      window.history.back();
      return;
    }
    
    console.log('Domain to unblock:', domain);
    console.log('Sending unblockAndOpen message to background...');
    
    // Используем новую логику через background.js
    chrome.runtime.sendMessage({
      action: 'getOriginalBlockedUrl'
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting original URL:', chrome.runtime.lastError);
        // Fallback: просто перейти на https://domain
        window.location.href = `https://${domain}`;
        return;
      }
      
      console.log('Original URL response:', response);
      const originalUrl = response && response.originalUrl ? response.originalUrl : null;
      
      // Отправляем запрос на разблокировку и переход
      chrome.runtime.sendMessage({
        action: 'unblockAndOpen',
        domain: domain,
        originalUrl: originalUrl
      }, (unblockResponse) => {
        if (chrome.runtime.lastError) {
          console.error('Error in unblockAndOpen:', chrome.runtime.lastError);
          // Fallback: просто перейти на https://domain
          window.location.href = originalUrl || `https://${domain}`;
          return;
        }
        
        console.log('unblockAndOpen response:', unblockResponse);
        
        if (unblockResponse && unblockResponse.success) {
          console.log('Unblock successful, background will handle navigation');
          // Background.js обработает навигацию, здесь ничего не делаем
        } else {
          console.log('Unblock failed, using fallback navigation');
          // Fallback: просто перейти на https://domain
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
    console.log('Blocked page loaded');
    
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