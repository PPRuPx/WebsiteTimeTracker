// --- Глобальные переменные ---
let sitesData = {};
let activeDomain = null;
let currentPage = 1;
let sitesPerPage = 5;
let viewMode = 'all'; // 'all' или 'blocked'

window.blockedSites = [];
chrome.storage.local.get({ blocked: [] }, data => {
  window.blockedSites = data.blocked;
});

// --- Загрузка настроек ---
function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ sitesPerPage: 5 }, (data) => {
      sitesPerPage = data.sitesPerPage;
      // Обновляем селектор, если он уже существует
      const select = document.getElementById('sitesPerPageSelect');
      if (select) {
        if (sitesPerPage === 'all') {
          select.value = 'all';
        } else {
          select.value = sitesPerPage.toString();
        }
      }
      resolve();
    });
  });
}

// --- Сохранение настроек ---
function saveSettings() {
  chrome.storage.local.set({ sitesPerPage: sitesPerPage });
}

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
  return new Promise((resolve) => {
    chrome.storage.local.get({ sites: {}, blocked: [] }, (data) => {
      sitesData = data.sites;
      window.blockedSites = data.blocked;
      resolve();
    });
  });
}

// --- Обновление данных из storage без пересоздания карточек ---
function updateDataFromStorage() {
  chrome.storage.local.get({ sites: {}, blocked: [] }, (data) => {
    // Обновляем только данные в памяти, не пересоздаем карточки
    sitesData = data.sites;
    window.blockedSites = data.blocked;
    
    // Получаем отфильтрованные сайты для корректного расчета прогресс-баров
    let filteredSites = Object.entries(sitesData);
    if (viewMode === 'blocked') {
      filteredSites = filteredSites.filter(([domain]) => 
        (window.blockedSites || []).includes(domain)
      );
    }
    
    const maxTime = filteredSites.length > 0 ? Math.max(...filteredSites.map(([, data]) => data.time)) : 0;
    
    // Обновляем время и прогресс-бар для всех видимых карточек
    Object.entries(sitesData).forEach(([domain, siteData]) => {
      const timeElement = document.getElementById(`time-${domain}`);
      if (timeElement) {
        timeElement.textContent = formatTime(siteData.time);
      }
      
      // Обновляем прогресс-бар
      const progressBar = document.querySelector(`[data-domain="${domain}"] .site-progress-bar`);
      if (progressBar) {
        const progressPercentage = maxTime > 0 ? (siteData.time / maxTime) * 100 : 0;
        progressBar.style.width = `${progressPercentage}%`;
      }
    });
  });
}

// --- Получение активного домена и обновление времени ---
function updateActiveDomain() {
  chrome.runtime.sendMessage({ action: "getCurrentTime" }, (response) => {
    if (chrome.runtime.lastError) {
      return;
    }
    if (response && response.domain) {
      const newActiveDomain = response.domain;
      
      // Если активный домен изменился, обновляем подсветку
      if (activeDomain !== newActiveDomain) {
        // Убираем подсветку с предыдущего активного домена
        if (activeDomain) {
          const prevActiveCard = document.querySelector(`[data-domain="${activeDomain}"]`);
          if (prevActiveCard) {
            prevActiveCard.classList.remove('active');
          }
        }
        
        // Добавляем подсветку новому активному домену
        const newActiveCard = document.querySelector(`[data-domain="${newActiveDomain}"]`);
        if (newActiveCard) {
          newActiveCard.classList.add('active');
        }
        
        activeDomain = newActiveDomain;
      }
      
      // Обновляем время для активного домена
      if (activeDomain && sitesData[activeDomain]) {
        const totalTime = sitesData[activeDomain].time + response.currentTime;
        updateSiteTime(activeDomain, totalTime);
        
        // Также обновляем прогресс-бар для активного домена с учетом текущего времени
        const progressBar = document.querySelector(`[data-domain="${activeDomain}"] .site-progress-bar`);
        if (progressBar) {
          // Получаем отфильтрованные сайты для корректного расчета прогресс-баров
          let filteredSites = Object.entries(sitesData);
          if (viewMode === 'blocked') {
            filteredSites = filteredSites.filter(([d]) => 
              (window.blockedSites || []).includes(d)
            );
          }
          
          const maxTime = filteredSites.length > 0 ? Math.max(...filteredSites.map(([, data]) => data.time)) : 0;
          const progressPercentage = maxTime > 0 ? (totalTime / maxTime) * 100 : 0;
          progressBar.style.width = `${progressPercentage}%`;
        }
      }
    }
  });
}

// --- Точечное обновление времени сайта ---
function updateSiteTime(domain, totalTime) {
  const timeElement = document.getElementById(`time-${domain}`);
  if (timeElement) {
    timeElement.textContent = formatTime(totalTime);
  }
  
  // Обновляем прогресс-бар
  const progressBar = document.querySelector(`[data-domain="${domain}"] .site-progress-bar`);
  if (progressBar) {
    // Получаем отфильтрованные сайты для корректного расчета прогресс-баров
    let filteredSites = Object.entries(sitesData);
    if (viewMode === 'blocked') {
      filteredSites = filteredSites.filter(([d]) => 
        (window.blockedSites || []).includes(d)
      );
    }
    
    const maxTime = filteredSites.length > 0 ? Math.max(...filteredSites.map(([, data]) => data.time)) : 0;
    const progressPercentage = maxTime > 0 ? (totalTime / maxTime) * 100 : 0;
    progressBar.style.width = `${progressPercentage}%`;
  }
}

// --- Функция переключения режима просмотра ---
function toggleViewMode() {
  viewMode = viewMode === 'all' ? 'blocked' : 'all';
  
  // Обновляем иконку индикатора
  const viewModeIcon = document.getElementById('viewModeIcon');
  if (viewModeIcon) {
    viewModeIcon.textContent = viewMode === 'all' ? '👁️' : '🚫';
  }
  
  // Сбрасываем на первую страницу при смене режима
  currentPage = 1;
  
  // Перерендериваем таблицу
  renderTable();
}

// --- Функция блокировки/разблокировки сайта ---
function toggleSiteBlock(domain) {
  chrome.storage.local.get({ blocked: [] }, data => {
    let blocked = data.blocked;
    const isCurrentlyBlocked = blocked.includes(domain);
    
    if (isCurrentlyBlocked) {
      // Разблокируем сайт
      blocked = blocked.filter(d => d !== domain);
    } else {
      // Блокируем сайт
      blocked.push(domain);
    }
    
    chrome.storage.local.set({ blocked }, () => {
      if (chrome.runtime.lastError) {
        return;
      }
      
      window.blockedSites = blocked;
      
      // Показываем уведомление
      const message = isCurrentlyBlocked ? `Site ${domain} unblocked` : `Site ${domain} blocked`;
      showNotification(message, isCurrentlyBlocked ? 'success' : 'warning');
      
      // Обновляем класс blocked у карточки и кнопки
      const siteCard = document.querySelector(`[data-domain="${domain}"]`);
      if (siteCard) {
        if (isCurrentlyBlocked) {
          siteCard.classList.remove('blocked');
        } else {
          siteCard.classList.add('blocked');
        }
        
        // Обновляем кнопку блокировки
        const blockBtn = siteCard.querySelector('.block-btn');
        if (blockBtn) {
          if (isCurrentlyBlocked) {
            blockBtn.className = 'block-btn unblocked';
            blockBtn.textContent = '🔒';
            blockBtn.title = 'Заблокировать сайт';
          } else {
            blockBtn.className = 'block-btn blocked';
            blockBtn.textContent = '🔓';
            blockBtn.title = 'Разблокировать сайт';
          }
        }
      }
      
      // Дополнительная проверка через background.js для разблокировки
      if (isCurrentlyBlocked) {
        chrome.runtime.sendMessage({
          action: 'checkAllTabs'
        });
      }
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
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#d4edda' : '#f8d7da'};
    color: ${type === 'success' ? '#155724' : '#721c24'};
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  // Автоматически скрываем через 3 секунды
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, 3000);
}

// --- Рендеринг таблицы ---
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
  
  // Фильтруем сайты в зависимости от режима просмотра
  let filteredSites = sortedSites;
  if (viewMode === 'blocked') {
    filteredSites = sortedSites.filter(([domain]) => 
      (window.blockedSites || []).includes(domain)
    );
  }
  
  // Проверяем, есть ли сайты после фильтрации
  if (filteredSites.length === 0) {
    if (viewMode === 'blocked') {
      sitesContainer.innerHTML = '<div class="no-data">Нет заблокированных сайтов</div>';
    } else {
      sitesContainer.innerHTML = '<div class="no-data">No data yet</div>';
    }
    pagination.innerHTML = '';
    return;
  }

  let pageSites;
  let totalPages = 1;
  
  if (sitesPerPage === 'all') {
    // Показываем все сайты на одной странице
    pageSites = filteredSites;
    currentPage = 1;
  } else {
    // Обычная пагинация
    totalPages = Math.ceil(filteredSites.length / sitesPerPage);
    if (currentPage > totalPages) currentPage = totalPages || 1;
    const startIdx = (currentPage - 1) * sitesPerPage;
    pageSites = filteredSites.slice(startIdx, startIdx + sitesPerPage);
  }

  // Обновляем индикатор режима просмотра с количеством сайтов
  const viewModeIndicatorText = document.getElementById('viewModeIndicatorText');
  if (viewModeIndicatorText) {
    const totalSites = filteredSites.length;
    
    if (viewMode === 'all') {
      viewModeIndicatorText.innerHTML = `<span id="viewModeIcon">👁️</span>Просмотр всех сайтов (${totalSites})`;
    } else {
      viewModeIndicatorText.innerHTML = `<span id="viewModeIcon">🚫</span>Просмотр только заблокированных сайтов (${totalSites})`;
    }
  }

  // Находим максимальное время среди отфильтрованных сайтов
  const maxTime = filteredSites.length > 0 ? Math.max(...filteredSites.map(([, data]) => data.time)) : 0;

  pageSites.forEach(([domain, data]) => {
    const progressPercentage = maxTime > 0 ? (data.time / maxTime) * 100 : 0;
    const isActive = domain === activeDomain;

    // Проверяем, заблокирован ли сайт
    const isBlocked = (window.blockedSites || []).includes(domain);
    const blockBtnClass = isBlocked ? 'block-btn blocked' : 'block-btn unblocked';
    const blockBtnEmoji = isBlocked ? '🔓' : '🔒';
    const blockBtnTitle = isBlocked ? 'Разблокировать сайт' : 'Заблокировать сайт';

    const siteCard = document.createElement('div');
    siteCard.className = `site-card${isActive ? ' active' : ''}${isBlocked ? ' blocked' : ''}`;
    siteCard.setAttribute('data-domain', domain);
    
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
    
    // Добавляем обработчик клика на карточку для перехода на сайт
    siteCard.addEventListener('click', (e) => {
      // Не переходим на сайт, если кликнули на кнопку блокировки
      if (e.target.closest('.block-btn')) {
        return;
      }
      
      // Формируем URL и открываем сайт в новой вкладке
      const url = `https://${domain}`;
      chrome.tabs.create({ url: url });
    });
    
    // Добавляем обработчик события для кнопки блокировки
    const blockBtn = siteCard.querySelector('.block-btn');
    if (blockBtn) {
      blockBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Предотвращаем всплытие события на карточку
        toggleSiteBlock(domain);
      });
    }
  });

  // Пагинация
  if (sitesPerPage !== 'all' && totalPages > 1) {
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

// --- Обработчик изменения количества сайтов на странице ---
function handleSitesPerPageChange() {
  const select = document.getElementById('sitesPerPageSelect');
  if (select) {
    const value = select.value;
    if (value === 'all') {
      sitesPerPage = 'all';
    } else {
      sitesPerPage = parseInt(value);
    }
    currentPage = 1; // Сбрасываем на первую страницу
    renderTable();
    saveSettings(); // Сохраняем настройки
  }
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', async () => {
  const resetBtn = document.getElementById('resetBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');
  const sitesPerPageSelect = document.getElementById('sitesPerPageSelect');
  const viewModeText = document.getElementById('viewModeText'); // Добавляем элемент для текста режима

  // Устанавливаем начальное значение селектора
  if (sitesPerPageSelect) {
    sitesPerPageSelect.value = sitesPerPage.toString();
    sitesPerPageSelect.addEventListener('change', handleSitesPerPageChange);
  }

  // Устанавливаем начальный текст кнопки режима
  if (viewModeText) {
    viewModeText.textContent = viewMode === 'all' ? 'Все сайты' : 'Только заблокированные';
  }

  // Устанавливаем начальную иконку индикатора режима
  const viewModeIcon = document.getElementById('viewModeIcon');
  if (viewModeIcon) {
    viewModeIcon.textContent = viewMode === 'all' ? '👁️' : '🚫';
  }

  // Добавляем обработчик для индикатора режима просмотра
  const viewModeIndicator = document.getElementById('viewModeIndicator');
  if (viewModeIndicator) {
    viewModeIndicator.addEventListener('click', toggleViewMode);
  }

  // Уведомляем background.js, что попап открыт
  chrome.runtime.connect({ name: "popup" });
  
  // Слушаем изменения в storage для обновления данных в реальном времени
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.sites || changes.blocked)) {
      updateDataFromStorage();
    }
  });

  // Кнопка открытия страницы настроек/тестов
  if (openOptionsBtn) {
    openOptionsBtn.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      }
    });
  }

  // Сначала загружаем настройки, затем данные
  await loadSettings();
  await loadData(); // Ждем загрузки данных
  updateActiveDomain();
  
  // Рендерим таблицу после загрузки всех данных
  renderTable();

  // Сброс данных
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all tracking data?')) {
      chrome.storage.local.set({ sites: {} }, () => {
        sitesData = {};
        renderTable();
      });
    }
  });

  // Обновление только активного домена каждую секунду (без пересоздания карточек)
  setInterval(() => {
    updateActiveDomain();
    updateDataFromStorage(); // Обновляем данные из storage
  }, 1000);
});