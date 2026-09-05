export const normalizeListResponse = (payload, key) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload[key];
  if (Array.isArray(candidate)) return candidate;

  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.result)) return payload.result;
  if (Array.isArray(payload.items)) return payload.items;

  return [];
};
