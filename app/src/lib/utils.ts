/*
* Datetimes received from server is in UTC timezone however they do not contain any timezone identifier (such as 'Z' letter)
* This causes Date constructor to interpret datetime in local timezone which is not correct.
* This function performs necessary adjustment to parse a given datetime in UTC timezone if it does not contain timezone.
*/
export function fromUTC(datetime: string): Date {
    const date = new Date(datetime);

    if (datetime.includes('Z')) {
        return date;
    }

    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
}

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
