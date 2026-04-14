self.__uv$config = {
    prefix: '/api/v1/net/',
    bare: '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/api/v1/assets/handler.js',
    bundle: '/api/v1/assets/assets.js',
    config: '/api/v1/assets/config.js',
    sw: '/api/v1/assets/worker.js',
};
