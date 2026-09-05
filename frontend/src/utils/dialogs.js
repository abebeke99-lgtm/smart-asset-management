// Lightweight dialog helpers to satisfy ESLint no-restricted-globals rule
export function safeConfirm(message) {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
  } catch (e) {
    // ignore
  }
  return false;
}

export function safeAlert(message) {
  try {
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      window.alert(message);
      return true;
    }
  } catch (e) {}
  return false;
}
