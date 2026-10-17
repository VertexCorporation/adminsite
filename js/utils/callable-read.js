/**
 * Bound a read-only callable without replaying mutations or hiding late failures.
 * The underlying transport may still complete; callers must ignore stale views.
 */
export function withReadTimeout(promise, milliseconds = 28000) {
    let timer;
    return Promise.race([
        Promise.resolve(promise),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const error = new Error('Read request timeout');
                error.code = 'functions/deadline-exceeded';
                reject(error);
            }, milliseconds);
        })
    ]).finally(() => clearTimeout(timer));
}
