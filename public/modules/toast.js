let hideTimer = null;

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}
