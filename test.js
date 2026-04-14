const https = require('https');

https.get('https://getscreen.me/login', (res) => {
    let body = "";
    res.on('data', d => body += d);
    res.on('end', () => {
        let absUrls = body.match(/https:\/\/getscreen\.me\/[^'"]+/g);
        if (absUrls) {
            console.log('Absolute URLs found:', Array.from(new Set(absUrls)));
        } else {
            console.log('No absolute URLs found!');
        }
    });
});
