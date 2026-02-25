/**
 * CORSプロキシ経由でHTMLを取得する
 */

const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

export async function fetchHTML(url) {
    let lastError = null;

    for (const proxyFn of CORS_PROXIES) {
        const proxyUrl = proxyFn(url);
        try {
            const response = await fetch(proxyUrl, {
                signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const html = await response.text();
            if (!html || html.trim().length === 0) {
                throw new Error('空のレスポンスを受信しました');
            }
            return html;
        } catch (error) {
            lastError = error;
            console.warn(`Proxy failed: ${proxyUrl}`, error.message);
            continue;
        }
    }

    throw new Error(
        `すべてのプロキシでの取得に失敗しました。最後のエラー: ${lastError?.message || '不明なエラー'}`
    );
}
