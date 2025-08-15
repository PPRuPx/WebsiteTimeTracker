// --- Глобальные переменные ---
let sitesData = {};
let activeDomain = null;
let currentPage = 1;
const sitesPerPage = 10;

window.blockedSites = [];
chrome.storage.local.get({ blocked: [] }, data => {
  window.blockedSites = data.blocked;
});

// --- Форматирование времени ---
function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// --- Загрузка данных из chrome.storage.local ---
function loadData() {
  chrome.storage.local.get({ sites: {}, blocked: [] }, (data) => {
    console.log('Loading data from storage:', data);
    sitesData = data.sites;
    window.blockedSites = data.blocked;
    console.log('Sites data loaded:', sitesData);
    console.log('Blocked sites loaded:', window.blockedSites);
    renderTable();
  });
}

// --- Получение активного домена и обновление времени ---
function updateActiveDomain() {
  chrome.runtime.sendMessage({ action: "getCurrentTime" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("Error communicating with background.js:", chrome.runtime.lastError.message);
      return;
    }
    if (response && response.domain) {
      activeDomain = response.domain;
      // Обновляем только время для активного домена
      const timeCell = document.getElementById(`time-${activeDomain}`);
      if (timeCell && sitesData[activeDomain]) {
        timeCell.textContent = formatTime(sitesData[activeDomain].time + response.currentTime);
      }
      // Перерисовать таблицу для подсветки активного домена
      renderTable();
    }
  });
}

// --- Функция блокировки/разблокировки сайта ---
function toggleSiteBlock(domain) {
  console.log(`Attempting to toggle block for domain: ${domain}`);
  
  chrome.storage.local.get({ blocked: [] }, data => {
    let blocked = data.blocked;
    const isCurrentlyBlocked = blocked.includes(domain);
    
    console.log(`Current blocked sites:`, blocked);
    console.log(`Domain ${domain} is currently blocked:`, isCurrentlyBlocked);
    
    if (isCurrentlyBlocked) {
      // Разблокируем сайт
      blocked = blocked.filter(d => d !== domain);
      console.log(`Site unblocked: ${domain}`);
    } else {
      // Блокируем сайт
      blocked.push(domain);
      console.log(`Site blocked: ${domain}`);
    }
    
    console.log(`New blocked sites list:`, blocked);
    
    chrome.storage.local.set({ blocked }, () => {
      if (chrome.runtime.lastError) {
        console.error('Error saving blocked sites:', chrome.runtime.lastError);
        return;
      }
      
      window.blockedSites = blocked;
      console.log(`Blocked sites updated in memory:`, window.blockedSites);
      
      // Показываем уведомление
      const message = isCurrentlyBlocked ? `Site ${domain} unblocked` : `Site ${domain} blocked`;
      showNotification(message, isCurrentlyBlocked ? 'success' : 'warning');
      
      // Перерисовываем таблицу
      renderTable();
    });
  });
}

// --- Показ уведомлений ---
function showNotification(message, type = 'info') {
  // Удаляем существующие уведомления
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4caf50' : type === 'warning' ? '#ff9800' : '#2196f3'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 1000;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  
  // Добавляем CSS анимацию
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // Автоматически скрываем через 3 секунды
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
}

// --- Отрисовка таблицы ---
function renderTable() {
  const sitesContainer = document.getElementById('sitesContainer');
  const pagination = document.getElementById('pagination');
  sitesContainer.innerHTML = '';
  pagination.innerHTML = '';

  const siteEntries = Object.entries(sitesData);
  if (siteEntries.length === 0) {
    sitesContainer.innerHTML = '<div class="no-data">No data yet</div>';
    return;
  }

  // Сортировка и пагинация
  const sortedSites = siteEntries.sort((a, b) => b[1].time - a[1].time);
  const totalPages = Math.ceil(sortedSites.length / sitesPerPage);
  if (currentPage > totalPages) currentPage = totalPages || 1;
  const startIdx = (currentPage - 1) * sitesPerPage;
  const pageSites = sortedSites.slice(startIdx, startIdx + sitesPerPage);

  // Находим максимальное время
  const maxTime = Math.max(...sortedSites.map(([, data]) => data.time));

  pageSites.forEach(([domain, data]) => {
    const progressPercentage = maxTime > 0 ? (data.time / maxTime) * 100 : 0;
    const isActive = domain === activeDomain;

    // Проверяем, заблокирован ли сайт
    const isBlocked = (window.blockedSites || []).includes(domain);
    const blockBtnClass = isBlocked ? 'block-btn blocked' : 'block-btn unblocked';
    const blockBtnEmoji = isBlocked ? '🔓' : '🔒';
    const blockBtnTitle = isBlocked ? 'Разблокировать сайт' : 'Заблокировать сайт';
    
    console.log(`Rendering card for ${domain}, blocked: ${isBlocked}, emoji: ${blockBtnEmoji}`);

    const siteCard = document.createElement('div');
    siteCard.className = `site-card${isActive ? ' active' : ''}`;
    
    siteCard.innerHTML = `
      <div class="site-favicon">
        <img src="${data.favicon}" width="20" height="20" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiBmaWxsPSIjNjY2NjY2Ii8+Cjx0ZXh0IHg9IjEwIiB5PSIxNSIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTIiPk88L3RleHQ+Cjwvc3ZnPgo='">
      </div>
      <div class="site-info">
        <div class="site-domain" title="${domain}">${domain}</div>
        <div class="site-progress">
          <div class="site-progress-bar" style="width: ${progressPercentage}%;"></div>
        </div>
        <div class="site-time" id="time-${domain}">${formatTime(data.time)}</div>
      </div>
      <div class="site-block">
        <button class="${blockBtnClass}" 
                data-domain="${domain}" 
                title="${blockBtnTitle}">
          ${blockBtnEmoji}
        </button>
      </div>
    `;
    
    sitesContainer.appendChild(siteCard);
    
    // Добавляем обработчик события для кнопки блокировки
    const blockBtn = siteCard.querySelector('.block-btn');
    if (blockBtn) {
      blockBtn.addEventListener('click', () => {
        console.log(`Button clicked for domain: ${domain}`);
        toggleSiteBlock(domain);
      });
      console.log(`Event listener added for ${domain}`);
    } else {
      console.error(`Button not found for domain: ${domain}`);
    }
  });

  // Пагинация
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.disabled = i === currentPage;
      btn.onclick = () => {
        currentPage = i;
        renderTable();
      };
      pagination.appendChild(btn);
    }
  }
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
  const resetBtn = document.getElementById('resetBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  // Уведомляем background.js, что попап открыт
  chrome.runtime.connect({ name: "popup" });

  // Кнопка открытия страницы настроек/тестов
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        const url = chrome.runtime.getURL('test.html');
        window.open(url);
      }
    });
  }

  // Загрузка данных при открытии попапа
  loadData();
  updateActiveDomain();

  // Сброс данных
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all tracking data?')) {
      chrome.storage.local.set({ sites: {} }, () => {
        sitesData = {};
        renderTable();
      });
    }
  });

  // Обновление таблицы каждую секунду
  setInterval(() => {
    loadData();
    updateActiveDomain();
  }, 1000);
});