// Quick smoke test for memberships API: POST a template plan and then GET premium plans
// Usage: node scripts/smoke-memberships.js

(async () => {
    const base = process.env.API_BASE_URL || 'http://localhost:5050';
    const postBody = { category: 'premium', label: `Agent Test Plan ${Date.now()}`, price: 9999 };

    const out = (...args) => console.log(...args);

    try {
        // POST
        const postRes = await fetch(`${base}/api/memberships`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(postBody)
        });
        const postText = await postRes.text();
        out('POST status:', postRes.status);
        out('POST body:', postText);

        // GET
        const getRes = await fetch(`${base}/api/memberships?category=premium`);
        const getText = await getRes.text();
        out('GET status:', getRes.status);
        out('GET body:', getText);

        process.exitCode = postRes.ok && getRes.ok ? 0 : 1;
    } catch (e) {
        console.error('Smoke test failed:', e && e.stack ? e.stack : e);
        process.exitCode = 1;
    }
})();
