class RestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

class RestClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string, options?: { cache?: RequestCache; revalidate?: number }): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {};
    if (options?.revalidate !== undefined) {
      fetchOptions.next = { revalidate: options.revalidate };
    }
    if (options?.cache) {
      fetchOptions.cache = options.cache;
    }

    const res = await fetch(url, fetchOptions);
    if (!res.ok) {
      const message = await res.text().catch(() => res.statusText);
      throw new RestError(res.status, message);
    }
    return res.json();
  }
}

export const rest = new RestClient('https://rest.cosmos.directory/dungeon');
