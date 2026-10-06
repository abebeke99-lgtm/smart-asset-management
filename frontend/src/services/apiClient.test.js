import { isCurrentAuthRequest } from './apiClient';

describe('isCurrentAuthRequest', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('does not treat a response for an older token as the current session', () => {
    localStorage.setItem('token', 'new-token');

    expect(isCurrentAuthRequest({
      config: { headers: { Authorization: 'Bearer old-token' } },
    })).toBe(false);
  });

  it('recognizes an unauthorized response for the token currently stored', () => {
    localStorage.setItem('token', 'current-token');

    expect(isCurrentAuthRequest({
      config: { headers: { Authorization: 'Bearer current-token' } },
    })).toBe(true);
  });
});
