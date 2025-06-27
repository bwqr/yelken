import * as config from "./config";

export class HttpError extends Error {
    constructor(public code: number, public error: string, public context: string | undefined) {
        super(error);
    }

    static fromString(str: string): HttpError | undefined {
        let json;
        try {
            json = JSON.parse(str);
        } catch {
            return undefined;
        }

        if (
            typeof json.code !== 'number' ||
            typeof json.error !== 'string' ||
            ('context' in json && typeof json.context !== 'string')
        ) {
            return undefined;
        }

        return new HttpError(json.code, json.error, json.context);
    }
}

export class ValidationErrors<K extends string> extends Error {
    constructor(public fieldMessages: Map<K, string[]>, public messages: string[]) {
        super('validation_errors');
    }

    static fromString(str: string): ValidationErrors<string> | undefined {
        let json: { fieldMessages: Record<string, unknown>, messages: unknown[] };
        try {
            json = JSON.parse(str);
        } catch {
            return undefined;
        }

        if (typeof json.fieldMessages !== 'object' || !Array.isArray(json.messages)) {
            return undefined;
        }

        const fieldMessages = new Map(
            Object
                .entries(json.fieldMessages)
                .filter(([_, value]) => Array.isArray(value))
                .map(([key, value]) => ([
                    key,
                    (value as unknown[]).filter((v) => typeof v === 'string') as string[]
                ]))
        );

        return new ValidationErrors(fieldMessages, json.messages.filter((m) => typeof m === 'string'));
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

            const httpError = HttpError.fromString(text);

            if (httpError) {
                if (httpError.error === 'validation_errors' && httpError.context) {
                    const validationErrors = ValidationErrors.fromString(httpError.context);

                    if (validationErrors) {
                        throw validationErrors;
                    }
                }

                throw httpError;
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
