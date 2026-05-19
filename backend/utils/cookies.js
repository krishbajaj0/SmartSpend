export function parseCookies(cookieHeader = '') {
    return cookieHeader
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((cookies, part) => {
            const eq = part.indexOf('=');
            if (eq === -1) return cookies;
            const key = decodeURIComponent(part.slice(0, eq).trim());
            const value = decodeURIComponent(part.slice(eq + 1).trim());
            cookies[key] = value;
            return cookies;
        }, {});
}

