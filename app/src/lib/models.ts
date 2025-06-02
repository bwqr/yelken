export interface Pagination<T> {
  perPage: number,
  currentPage: number,
  totalPages: number,
  totalItems: number,
  items: T[],
}

export function emptyPagination<T>(): Pagination<T> {
  return {
    perPage: 0,
    currentPage: 0,
    totalPages: 0,
    totalItems: 0,
    items: [],
  }
}
