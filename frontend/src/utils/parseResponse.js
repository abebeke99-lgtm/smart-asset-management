export async function parseResponse(res) {
  // Guard for network errors or unexpected values
  if (!res) {
    return { ok: false, message: 'Network error: no response from server', status: 0 };
  }

  // If an Error or non-Response object was passed accidentally
  if (res instanceof Error || (typeof res === 'object' && !res.headers && res.message)) {
    return { ok: false, message: res.message || String(res), status: res.status || 0 };
  }

  // Safe header read
  const getHeader = res.headers && typeof res.headers.get === 'function'
    ? (name) => res.headers.get(name)
    : () => '';

  const contentType = (getHeader('content-type') || '').toLowerCase();
  const status = typeof res.status === 'number' ? res.status : 0;
  if (contentType.includes('application/json')) {
    try {
      const data = await res.json();
      return { ok: !!res.ok, data, status };
    } catch (e) {
      const txt = await (res.text ? res.text().catch(() => '') : Promise.resolve(''));
      return { ok: false, message: `Invalid JSON response: ${txt || res.statusText || ''}`, status };
    }
  }

  // Non-JSON response: attempt to read body safely and produce clearer message for network-like failures
  const text = await (res.text ? res.text().catch(() => '') : Promise.resolve(''));
  if (status === 0 && text && text.toLowerCase().includes('failed to fetch')) {
    return { ok: false, message: 'Network error: Failed to fetch (check backend/CORS/network)', status: 0 };
  }
  return { ok: false, message: `Non-JSON response (${status}): ${text ? text.slice(0,200) : res.statusText || ''}`, status };
}
