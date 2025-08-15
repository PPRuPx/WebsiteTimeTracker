(function() {
  'use strict';

  // DOM helpers
  function $(id) { return document.getElementById(id); }

  // Handlers
  function checkExtensionStatus() {
    const statusDiv = $('extensionStatus');
    statusDiv.textContent = 'Проверяем статус расширения...';
    statusDiv.className = 'status info';

    if (typeof chrome === 'undefined' || !chrome.runtime) {
      statusDiv.textContent = '❌ Chrome extension API недоступен';
      statusDiv.className = 'status error';
      return;
    }

    chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = `❌ Ошибка: ${chrome.runtime.lastError.message}`;
        statusDiv.className = 'status error';
      } else if (response) {
        statusDiv.textContent = `✅ Расширение работает!\n\nСтатус: ${response.status}\nСообщение: ${response.message}\nТекущий домен: ${response.currentDomain || 'Нет'}\nОтслеживание: ${response.isTracking ? 'Активно' : 'Неактивно'}\nВремя: ${new Date(response.timestamp).toLocaleString()}`;
        statusDiv.className = 'status success';
      } else {
        statusDiv.textContent = '❌ Нет ответа от расширения';
        statusDiv.className = 'status error';
      }
    });
  }

  function getSitesStats() {
    const statsDiv = $('sitesStats');
    statsDiv.textContent = 'Получаем статистику сайтов...';
    statsDiv.className = 'status info';

    chrome.storage.local.get({ sites: {} }, (data) => {
      if (chrome.runtime.lastError) {
        statsDiv.textContent = `❌ Ошибка: ${chrome.runtime.lastError.message}`;
        statsDiv.className = 'status error';
      } else {
        const sites = data.sites || {};
        const siteCount = Object.keys(sites).length;

        if (siteCount === 0) {
          statsDiv.textContent = '📊 Статистика пуста - нет данных о посещенных сайтах';
          statsDiv.className = 'status info';
        } else {
          let statsText = `📊 Найдено ${siteCount} сайтов:\n\n`;
          Object.entries(sites).forEach(([domain, info]) => {
            const timeMs = info.time || 0;
            const hours = Math.floor(timeMs / 3600000);
            const minutes = Math.floor((timeMs % 3600000) / 60000);
            const timeStr = hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
            statsText += `🌐 ${domain}: ${timeStr}\n`;
          });
          statsDiv.textContent = statsText;
          statsDiv.className = 'status success';
        }
      }
    });
  }

  function testBlocking() {
    const domain = $('testDomain').value.trim();
    const statusDiv = $('blockingStatus');
    if (!domain) {
      statusDiv.textContent = '❌ Введите домен для тестирования';
      statusDiv.className = 'status error';
      return;
    }
    statusDiv.textContent = `Добавляем ${domain} в список блокировки...`;
    statusDiv.className = 'status info';

    chrome.storage.local.get({ blocked: [] }, (data) => {
      const blocked = data.blocked || [];
      if (blocked.includes(domain)) {
        statusDiv.textContent = `ℹ️ ${domain} уже заблокирован`;
        statusDiv.className = 'status info';
        return;
      }
      blocked.push(domain);
      chrome.storage.local.set({ blocked }, () => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = `❌ Ошибка: ${chrome.runtime.lastError.message}`;
          statusDiv.className = 'status error';
        } else {
          statusDiv.textContent = `✅ ${domain} добавлен в список блокировки!\n\nТеперь попробуйте перейти на http://${domain} или https://${domain}`;
          statusDiv.className = 'status success';
        }
      });
    });
  }

  function testBlockedPage() {
    const domain = $('testDomain').value.trim();
    const statusDiv = $('blockingStatus');
    if (!domain) {
      statusDiv.textContent = '❌ Введите домен для тестирования';
      statusDiv.className = 'status error';
      return;
    }
    statusDiv.textContent = `Открываем страницу блокировки для ${domain}...`;
    statusDiv.className = 'status info';

    const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
    window.open(blockedUrl, '_blank');

    statusDiv.textContent = `✅ Страница блокировки открыта для ${domain}\n\nURL: ${blockedUrl}`;
    statusDiv.className = 'status success';
  }

  function getBlockedSites() {
    const blockedDiv = $('blockedSites');
    blockedDiv.textContent = 'Получаем список заблокированных сайтов...';
    blockedDiv.className = 'status info';

    chrome.storage.local.get({ blocked: [] }, (data) => {
      if (chrome.runtime.lastError) {
        blockedDiv.textContent = `❌ Ошибка: ${chrome.runtime.lastError.message}`;
        blockedDiv.className = 'status error';
      } else {
        const blocked = data.blocked || [];
        if (blocked.length === 0) {
          blockedDiv.textContent = '🔓 Нет заблокированных сайтов';
          blockedDiv.className = 'status info';
        } else {
          let blockedText = `🚫 Заблокировано ${blocked.length} сайтов:\n\n`;
          blocked.forEach(domain => { blockedText += `• ${domain}\n`; });
          blockedDiv.textContent = blockedText;
          blockedDiv.className = 'status success';
        }
      }
    });
  }

  function clearAllBlocks() {
    if (!confirm('Вы уверены, что хотите очистить все блокировки?')) return;
    const blockedDiv = $('blockedSites');
    blockedDiv.textContent = 'Очищаем все блокировки...';
    blockedDiv.className = 'status info';

    chrome.storage.local.set({ blocked: [] }, () => {
      if (chrome.runtime.lastError) {
        blockedDiv.textContent = `❌ Ошибка: ${chrome.runtime.lastError.message}`;
        blockedDiv.className = 'status error';
      } else {
        blockedDiv.textContent = '✅ Все блокировки очищены!';
        blockedDiv.className = 'status success';
      }
    });
  }

  function quickTest() {
    const resultDiv = $('quickTestResult');
    resultDiv.textContent = 'Запускаем быстрый тест...';
    resultDiv.className = 'status info';

    let testResults = [];
    if (typeof chrome !== 'undefined' && chrome.runtime) testResults.push('✅ Chrome extension API доступен');
    else testResults.push('❌ Chrome extension API недоступен');

    if (typeof chrome !== 'undefined' && chrome.storage) testResults.push('✅ Chrome storage доступен');
    else testResults.push('❌ Chrome storage недоступен');

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) testResults.push('✅ Chrome runtime доступен');
    else testResults.push('❌ Chrome runtime недоступен');

    if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) testResults.push('✅ Chrome declarativeNetRequest доступен');
    else testResults.push('❌ Chrome declarativeNetRequest недоступен');

    resultDiv.textContent = `🚀 Результаты быстрого теста:\n\n${testResults.join('\n')}`;
    resultDiv.className = 'status success';
  }

  function openBlockedPageDirect() {
    const domain = $('testDomain').value.trim();
    const resultDiv = $('extensionContextResult');
    if (!domain) {
      resultDiv.textContent = '❌ Введите домен для тестирования';
      resultDiv.className = 'status error';
      return;
    }
    resultDiv.textContent = `Открываем страницу блокировки для ${domain} напрямую...`;
    resultDiv.className = 'status info';

    const blockedUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);
    window.open(blockedUrl, '_blank');

    resultDiv.textContent = `✅ Страница блокировки открыта для ${domain}\n\nURL: ${blockedUrl}`;
    resultDiv.className = 'status success';
  }

  function testExtensionContext() {
    const resultDiv = $('extensionContextResult');
    resultDiv.textContent = 'Проверяем контекст расширения...';
    resultDiv.className = 'status info';

    let results = [];
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      results.push('✅ chrome.runtime доступен');
      if (chrome.runtime.id) results.push(`✅ ID расширения: ${chrome.runtime.id}`);
      else results.push('❌ ID расширения недоступен');

      if (chrome.runtime.getURL) {
        const testUrl = chrome.runtime.getURL('blocked.html');
        results.push(`✅ getURL работает: ${testUrl}`);
      } else {
        results.push('❌ getURL недоступен');
      }
    } else {
      results.push('❌ chrome.runtime недоступен');
    }

    if (typeof chrome !== 'undefined' && chrome.storage) {
      results.push('✅ chrome.storage доступен');
      if (chrome.storage.local) results.push('✅ chrome.storage.local доступен');
      else results.push('❌ chrome.storage.local недоступен');
    } else {
      results.push('❌ chrome.storage недоступен');
    }

    if (typeof chrome !== 'undefined' && chrome.declarativeNetRequest) results.push('✅ chrome.declarativeNetRequest доступен');
    else results.push('❌ chrome.declarativeNetRequest недоступен');

    resultDiv.textContent = `🔧 Результаты проверки контекста:\n\n${results.join('\n')}`;
    resultDiv.className = 'status success';
  }

  // Bind events after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Test page loaded');
    const mapping = [
      ['btnCheckExtensionStatus', checkExtensionStatus],
      ['btnGetSitesStats', getSitesStats],
      ['btnTestBlocking', testBlocking],
      ['btnTestBlockedPage', testBlockedPage],
      ['btnGetBlockedSites', getBlockedSites],
      ['btnClearAllBlocks', clearAllBlocks],
      ['btnQuickTest', quickTest],
      ['btnOpenBlockedPageDirect', openBlockedPageDirect],
      ['btnTestExtensionContext', testExtensionContext],
    ];
    mapping.forEach(([id, handler]) => {
      const el = $(id);
      if (el) el.addEventListener('click', handler);
    });

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      console.log('Chrome extension API available');
    } else {
      console.error('Chrome extension API not available');
    }
  });
})(); 