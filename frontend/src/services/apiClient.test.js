import { isCurrentAuthRequest } from './apiClient';

describe('API base URL configuration', () => {
  it('normalizes a Render backend hostname into an HTTPS API base URL', () => {
    const previousApiUrl = process.env.REACT_APP_API_URL;
    const previousApiBaseUrl = process.env.API_BASE_URL;
    process.env.REACT_APP_API_URL = 'uams-backend.onrender.com/api';
    delete process.env.API_BASE_URL;

    try {
      jest.isolateModules(() => {
        const { API_BASE_URL: configuredBaseUrl } = require('./apiClient');
        expect(configuredBaseUrl).toBe('https://uams-backend.onrender.com');
      });
    } finally {
      if (previousApiUrl === undefined) delete process.env.REACT_APP_API_URL;
      else process.env.REACT_APP_API_URL = previousApiUrl;
      if (previousApiBaseUrl === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = previousApiBaseUrl;
    }

  });

  it.each([
    ['https://api.example.com', 'https://api.example.com'],
    ['https://api.example.com/', 'https://api.example.com'],
    ['https://api.example.com/api', 'https://api.example.com'],
    ['https://api.example.com/api/', 'https://api.example.com'],
    ['https://api.example.com/api/api/', 'https://api.example.com'],
  ])('builds one /api request for configured URL %s', async (configuredUrl, expectedBaseUrl) => {
    const previousApiUrl = process.env.REACT_APP_API_URL;
    const previousApiBaseUrl = process.env.API_BASE_URL;
    process.env.REACT_APP_API_URL = configuredUrl;
    delete process.env.API_BASE_URL;

    try {
      let isolatedClient;
      jest.isolateModules(() => {
        const { default: client, API_BASE_URL: baseUrl } = require('./apiClient');
        isolatedClient = client;
        expect(baseUrl).toBe(expectedBaseUrl);
      });

      const response = await isolatedClient.get('/users', {
        adapter: (config) => Promise.resolve({
          config,
          data: { url: config.url },
          headers: {},
          request: {},
          status: 200,
          statusText: 'OK',
        }),
      });

      expect(response.config.baseURL).toBe(expectedBaseUrl);
      expect(response.data.url).toBe('/api/users');
      expect(response.config.url).not.toContain('/api/api');
    } finally {
      if (previousApiUrl === undefined) delete process.env.REACT_APP_API_URL;
      else process.env.REACT_APP_API_URL = previousApiUrl;
      if (previousApiBaseUrl === undefined) delete process.env.API_BASE_URL;
      else process.env.API_BASE_URL = previousApiBaseUrl;
    }
  });
});

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
