const locales = {
  en: {
    // Popup
    title: "Website Time Tracker",
    viewAllSites: "View all sites",
    viewBlockedSites: "View blocked sites only",
    sitesPerPage: "Sites per page:",
    resetAllData: "Reset All Data",
    noData: "No data yet",
    noBlockedSites: "No blocked sites",
    
    // Site card
    blockSite: "Block site",
    unblockSite: "Unblock site",
    
    // Notifications
    siteBlocked: "Site {domain} blocked",
    siteUnblocked: "Site {domain} unblocked",
    
    // Blocked page
    siteBlockedTitle: "Site is blocked",
    siteBlockedMessage: "You have blocked this site for time control. If you changed your mind, you can unblock it.",
    timeSpent: "Time spent:",
    timeSpentLoading: "Loading...",
    timeSpentNoData: "Information unavailable",
    timeSpentError: "Error: Chrome Extension API unavailable",
    timeSpentStorageError: "Error: Chrome storage unavailable",
    timeSpentLoadError: "Error loading data",
    timeSpentNotFound: "Data not found",
    timeNotTracked: "Time not tracked",
    lessThanMinute: "Less than a minute",
    hoursMinutes: "{hours}h {minutes}m",
    minutes: "{minutes} minutes",
    unblockButton: "🔓 Unblock site",
    unblocking: "⏳ Unblocking...",
    unblocked: "✅ Unblocked!",
    footer: "Website Time Tracker",
    
    // Confirmations
    confirmUnblock: "Are you sure you want to unblock site \"{domain}\"?",
    confirmUnblockGeneric: "Are you sure you want to unblock this site?",
    confirmReset: "Reset all tracking data?",
    
    // Language switching
    switchToRussian: "Switch to Russian",
    switchToEnglish: "Switch to English"
  },
  
  ru: {
    // Popup
    title: "Website Time Tracker",
    viewAllSites: "Просмотр всех сайтов",
    viewBlockedSites: "Просмотр только заблокированных сайтов",
    sitesPerPage: "Сайтов на странице:",
    resetAllData: "Сбросить все данные",
    noData: "Данных пока нет",
    noBlockedSites: "Нет заблокированных сайтов",
    
    // Site card
    blockSite: "Заблокировать сайт",
    unblockSite: "Разблокировать сайт",
    
    // Notifications
    siteBlocked: "Сайт {domain} заблокирован",
    siteUnblocked: "Сайт {domain} разблокирован",
    
    // Blocked page
    siteBlockedTitle: "Сайт заблокирован",
    siteBlockedMessage: "Вы заблокировали этот сайт для контроля времени. Если передумали, можете разблокировать его.",
    timeSpent: "Проведено времени:",
    timeSpentLoading: "Загрузка...",
    timeSpentNoData: "Информация недоступна",
    timeSpentError: "Ошибка: Chrome Extension API недоступен",
    timeSpentStorageError: "Ошибка: Chrome storage недоступен",
    timeSpentLoadError: "Ошибка загрузки данных",
    timeSpentNotFound: "Данные не найдены",
    timeNotTracked: "Время не отслеживалось",
    lessThanMinute: "Менее минуты",
    hoursMinutes: "{hours}ч {minutes}м",
    minutes: "{minutes} минут",
    unblockButton: "🔓 Разблокировать сайт",
    unblocking: "⏳ Разблокировка...",
    unblocked: "✅ Разблокировано!",
    footer: "Website Time Tracker",
    
    // Confirmations
    confirmUnblock: "Вы уверены, что хотите разблокировать сайт \"{domain}\"?",
    confirmUnblockGeneric: "Вы уверены, что хотите разблокировать этот сайт?",
    confirmReset: "Сбросить все данные отслеживания?",
    
    // Language switching
    switchToRussian: "Переключиться на русский",
    switchToEnglish: "Переключиться на английский"
  }
};

// Функция для получения перевода
function t(key, params = {}) {
  const currentLocale = getCurrentLocale();
  let text = locales[currentLocale][key] || locales.en[key] || key;
  
  // Заменяем параметры в тексте
  Object.keys(params).forEach(param => {
    text = text.replace(`{${param}}`, params[param]);
  });
  
  return text;
}

// Функция для получения текущего языка
function getCurrentLocale() {
  return localStorage.getItem('locale') || 'en';
}

// Функция для установки языка
function setLocale(locale) {
  localStorage.setItem('locale', locale);
  // Применяем локализацию без перезагрузки страницы
  if (typeof applyLocalization === 'function') {
    applyLocalization();
  }
  // Перерендериваем таблицу для обновления динамических элементов
  if (typeof renderTable === 'function') {
    renderTable();
  }
}

// Экспортируем функции для использования в других файлах
window.localeUtils = {
  t,
  getCurrentLocale,
  setLocale,
  locales
};
