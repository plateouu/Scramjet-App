self.__uv$config = {
    prefix: '/api/v1/net/',
    bare: '/bare/',
    encodeUrl: (str) => {
        if (!str) return str;
        return encodeURIComponent(str.split('').map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt() ^ 2) : char).join(''));
    },
    decodeUrl: (str) => {
        if (!str) return str;
        let [input, ...search] = str.split('?');
        let decoded = decodeURIComponent(input);
        let result = decoded.split('').map((char, ind) => ind % 2 ? String.fromCharCode(decoded.charCodeAt() ^ 2) : char).join('');
        return result + (search.length ? '?' + search.join('?') : '');
    },
    handler: '/api/v1/assets/handler.js',
    bundle: '/api/v1/assets/assets.js',
    config: '/api/v1/assets/config.js',
    sw: '/api/v1/sw.js',
};
