import * as config from "./config";

export class HttpError extends Error {
    constructor(public code: number, public error: string, public context: string | undefined) {
        super(error);
    }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export class Api {
    static async get<Resp>(path: string): Promise<Resp> {
        return Api.request(path);
    }

    static async post<Req, Resp>(path: string, data: Req): Promise<Resp> {
        return Api.request(path, 'POST', { data });
    }

    static async put<Req, Resp>(path: string, data: Req): Promise<Resp> {
        return Api.request(path, 'PUT', { data });
    }

    static async delete<Resp>(path: string): Promise<Resp> {
        return Api.request(path, 'DELETE');
    }

    static async request<Req, Resp>(path: string, method: Method = 'GET', body?: { data: Req } | { formdata: FormData }): Promise<Resp> {
        const token = localStorage.getItem('token');

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
        };

        if (body && 'data' in body) {
            headers['Content-Type'] = 'application/json';
        }

        const resp = await fetch(config.resolveURL(config.resolveURL(config.API_URL, 'api'), path), {
            body: body ? 'data' in body ? JSON.stringify(body.data) : body.formdata : null,
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

        if (resp.headers.get('Content-Type') === 'application/json') {
            return resp.json();
        }

        return resp.text() as Resp;
    }

    static handleNotFound(e: Error): undefined {
        if ((e instanceof HttpError) && e.error === 'item_not_found') {
            return undefined;
        }

        throw e;
    }
}
