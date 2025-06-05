export function dropdownClickListener(id: string, onClose: () => void, preCondition?: () => boolean): () => void {
    const listener = function(event: Event) {
        if (preCondition && !preCondition()) {
            return;
        }

        let close = true;
        let target = event.target;

        while (target) {
            if (!(target instanceof HTMLElement)) {
                break;
            }

            if (target.id === id) {
                close = false;
                break;
            }

            target = target.parentElement;
        }

        if (close) {
            onClose();
        }
    };

    window.document.addEventListener('click', listener);

    return function() {
        window.document.removeEventListener('click', listener);
    }
}
