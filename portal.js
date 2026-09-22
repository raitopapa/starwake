if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    document.getElementById('offline-status').textContent = 'BOTH GAMES / OFFLINE READY';
  }).catch(() => {});
}
