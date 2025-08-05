// --- Глобальные переменные ---
let sitesData = {};
let activeDomain = null;
let currentPage = 1;
const sitesPerPage = 10;

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
  chrome.storage.local.get({ sites: {} }, (data) => {
    sitesData = data.sites;
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

// --- Отрисовка таблицы ---
function renderTable() {
  const sitesBody = document.getElementById('sitesBody');
  const pagination = document.getElementById('pagination');
  sitesBody.innerHTML = '';
  pagination.innerHTML = '';

  const siteEntries = Object.entries(sitesData);
  if (siteEntries.length === 0) {
    sitesBody.innerHTML = '<tr><td colspan="4" class="no-data">No data yet</td></tr>';
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
    const row = document.createElement('tr');
    const progressPercentage = maxTime > 0 ? (data.time / maxTime) * 100 : 0;
    if (domain === activeDomain) row.classList.add('active-row');
    row.innerHTML = `
      <td>
        <img src="${data.favicon}" width="16" height="16" onerror="this.src='data:image/svg+xml;base64,...'">
      </td>
      <td>${domain}</td>
      <td class="progress-cell">
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${progressPercentage}%;"></div>
        </div>
      </td>
      <td id="time-${domain}" class="time-cell">${formatTime(data.time)}</td>
    `;
    sitesBody.appendChild(row);
  });

  // Пагинация
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.textContent = i;
      btn.style.margin = '0 2px';
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

  // Уведомляем background.js, что попап открыт
  chrome.runtime.connect({ name: "popup" });

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