import { For, useContext } from "solid-js";
import { LocaleContext } from "../lib/i18n";

interface Links {
    previous?: number
    pages: number[],
    next?: number,
}

export const Pagination = (props: { totalPages: number, page: number, perPage?: number, pageChange: (page: number) => void, }) => {
    const i18n = useContext(LocaleContext)!.i18n.pagination;

    const links: () => Links = () => {
        if (props.totalPages === 0) {
            return { pages: [1] };
        }

        const minPage = Math.max(1, props.page - 3);
        const maxPage = Math.max(minPage, Math.min(props.totalPages, props.page + 3));

        const links = new Array(maxPage - minPage + 1).keys().map((page) => page + minPage);

        return {
            previous: minPage !== props.page ? props.page - 1 : undefined,
            pages: Array.from(links),
            next: maxPage !== props.page ? props.page + 1 : undefined,
        };
    };

    return (
        <nav aria-label="Page navigation example">
            <ul class="pagination justify-content-center">
                <li class="page-item" classList={{ 'disabled': !links().previous }}>
                    <button class="page-link" onClick={() => {
                        const page = links().previous;

                        if (page !== undefined) {
                            props.pageChange(page);
                        }
                    }}>{i18n.previous()}</button>
                </li>
                <For each={links().pages}>
                    {(page) => (
                        <li class="page-item" classList={{ 'active': page === props.page }}>
                            <button class="page-link" onClick={() => {
                                if (props.page !== page) {
                                    props.pageChange(page)
                                }
                            }}>{page}</button>
                        </li>
                    )}
                </For>
                <li class="page-item" classList={{ 'disabled': !links().next }}>
                    <button class="page-link" onClick={() => {
                        const page = links().next;

                        if (page !== undefined) {
                            props.pageChange(page);
                        }
                    }}>{i18n.next()}</button>
                </li>
            </ul>
        </nav>
    );
}
