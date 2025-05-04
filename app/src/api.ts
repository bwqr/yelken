import * as config from "./config";

export class HttpError extends Error {
    constructor(public code: number, public error: string, public context: string | undefined) {
        super(error);
    }
}

export class Api {
    static async post<Req, Resp>(path: string, body: Req): Promise<Resp> {
        return Api.request(path, 'POST', body);
    }

    static async get<Resp>(path: string): Promise<Resp> {
        return Api.request(path);
    }

    static async request<Req, Resp>(path: string, method: 'GET' | 'POST' | 'PUT' = 'GET', body?: Req): Promise<Resp> {
        const token = localStorage.getItem('token');

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
        };

        if (method === 'POST' || method === 'PUT') {
            headers['Content-Type'] = 'application/json';
        }

        const resp = await fetch(config.resolveURL(config.API_URL, path), {
            body: body ? JSON.stringify(body) : null,
            headers,
            method,
        });

        if (!resp.ok) {
            if (resp.status === 401) {
                window.location.assign(config.resolveURL(config.BASE_URL, '/auth/login'));
            }

            const text = await resp.text();

            let json;

            try {
                json = JSON.parse(text);
            } catch {
                throw new Error(text);
            }

            if (
                typeof json.code === 'number' &&
                typeof json.error === 'string' &&
                !('context' in json && typeof json.context !== 'string')
            ) {
                throw new HttpError(json.code, json.error, json.context);
            }

            throw new Error(text);
        }

        return await resp.json();
    }
}
