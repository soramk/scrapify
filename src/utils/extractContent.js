/**
 * HTMLからメインコンテンツを抽出する
 * nav, footer, header, aside, script, style, svg, button等を除外
 */

const REMOVE_SELECTORS = [
    'nav', 'footer', 'header', 'aside',
    'script', 'style', 'noscript', 'svg',
    'button', 'iframe', 'form',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[aria-hidden="true"]',
    '.sidebar', '.nav', '.menu', '.toc',
    '.breadcrumb', '.pagination', '.footer',
    '.header', '.cookie-banner', '.ad',
    '.advertisement', '.social-share',
];

const MAIN_CONTENT_SELECTORS = [
    'main',
    'article',
    '.md-content',
    '.theme-doc-markdown',
    '.markdown-body',
    '.post-content',
    '.entry-content',
    '.article-content',
    '.content-body',
    '[role="main"]',
    '#content',
    '#main-content',
    '.prose',
];

export function extractMainContent(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // 不要な要素を除去
    for (const selector of REMOVE_SELECTORS) {
        try {
            doc.querySelectorAll(selector).forEach((el) => el.remove());
        } catch (e) {
            // セレクタが無効な場合はスキップ
        }
    }

    // メインコンテンツ領域を探す
    for (const selector of MAIN_CONTENT_SELECTORS) {
        try {
            const el = doc.querySelector(selector);
            if (el && el.textContent.trim().length > 50) {
                return el;
            }
        } catch (e) {
            // skip
        }
    }

    // フォールバック: body全体を使用
    return doc.body;
}
