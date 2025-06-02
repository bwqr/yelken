export function dropdownClickListener(id: string, onClose: () => void, preCondition?: () => boolean): (event: Event) => void {
    return function(event: Event) {
        if (preCondition?.()) {
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
    }
}
