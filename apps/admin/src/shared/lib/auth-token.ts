const tokenKey = 'enot-tea-owner-token';

export function readOwnerToken() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(tokenKey);
}

export function saveOwnerToken(token: string) {
  window.localStorage.setItem(tokenKey, token);
}

export function clearOwnerToken() {
  window.localStorage.removeItem(tokenKey);
}
