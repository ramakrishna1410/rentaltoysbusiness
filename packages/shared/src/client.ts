// Tiny fetch wrapper used by the customer and admin apps (and later the website).

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
  text(path: string): Promise<string>;
  url(path: string): string;
}

export function createApiClient(baseUrl: string, getToken: () => string | null): ApiClient {
  const base = baseUrl.replace(/\/$/, '');
  async function call(method: string, path: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(res.status, err.error ?? 'Request failed', err.details);
    }
    return res;
  }
  const json = async <T>(res: Response): Promise<T> => (res.status === 204 ? (undefined as T) : ((await res.json()) as T));
  return {
    get: async (p) => json(await call('GET', p)),
    post: async (p, b) => json(await call('POST', p, b ?? {})),
    patch: async (p, b) => json(await call('PATCH', p, b ?? {})),
    del: async (p) => json(await call('DELETE', p)),
    text: async (p) => (await call('GET', p)).text(),
    url: (p) => `${base}${p}`,
  };
}
