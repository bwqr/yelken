export interface PaginationRequest {
    perPage?: number,
    page?: number,
}

export namespace PaginationRequest {
    export function fromParams(page: string | string[] | undefined, perPage: string | string[] | undefined): PaginationRequest {
        return {
            page: (typeof page === 'string' ? parseInt(page) : undefined) || undefined,
            perPage: (typeof perPage === 'string' ? parseInt(perPage) : undefined) || undefined,
        };
    }

    export function toSearchParams(pagination: PaginationRequest): URLSearchParams {
        const searchParams = new URLSearchParams();

        if (pagination.page !== undefined) {
            searchParams.append('page', pagination.page.toString());
        }

        if (pagination.perPage !== undefined) {
            searchParams.append('perPage', pagination.perPage.toString());
        }

        return searchParams;
    }
}


export interface Pagination<T> {
    perPage: number,
    currentPage: number,
    totalPages: number,
    totalItems: number,
    items: T[],
}
