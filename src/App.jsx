import { useState, useCallback, useRef } from 'react';
import {
    Globe, FileText, Scissors, Download, Copy, Check,
    AlertCircle, Sparkles,
    ChevronDown, ChevronUp, Hash, ArrowRight,
    ClipboardCopy, FileDown, Zap, Loader2, ExternalLink,
    FolderDown, Layers, FileSearch, X, CircleCheck, CircleX,
    Settings2, StopCircle
} from 'lucide-react';

// ─── 共通ユーティリティ ─────────────────────────────────

const parseNodeToMarkdown = (node) => {
    if (node.nodeType === 3) {
        const text = node.textContent.replace(/\s+/g, ' ');
        return text === ' ' ? '' : text;
    }
    if (node.nodeType !== 1) return '';

    const tag = node.tagName.toLowerCase();

    if (['script', 'style', 'nav', 'footer', 'header', 'aside', 'svg', 'noscript', 'button'].includes(tag)) {
        return '';
    }

    if (tag === 'pre') {
        const extractCodeText = (n) => {
            if (n.nodeType === 3) return n.textContent;
            if (n.nodeName.toLowerCase() === 'br') return '\n';
            let text = '';
            n.childNodes.forEach((child) => { text += extractCodeText(child); });
            const isLineElement = n.classList && (
                n.classList.contains('token-line') || n.classList.contains('line') || n.classList.contains('view-line')
            );
            const isBlockElement = ['div', 'p', 'tr', 'li'].includes(n.nodeName.toLowerCase());
            if ((isLineElement || isBlockElement) && text.length > 0 && !text.endsWith('\n')) {
                text += '\n';
            }
            return text;
        };
        const codeText = extractCodeText(node).trim();
        return `\n\n\`\`\`\n${codeText}\n\`\`\`\n\n`;
    }

    if (tag === 'table') {
        const isCodeTable = node.classList.contains('highlighttable') ||
            node.classList.contains('codehilitetable') ||
            (node.querySelector('pre') && !node.querySelector('th'));
        if (isCodeTable) {
            const codeNode = node.querySelector('.code pre, td > pre, pre');
            if (codeNode) return parseNodeToMarkdown(codeNode);
        }
        let mdTable = '\n\n';
        const rows = Array.from(node.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            const rowContent = cells.map((cell) => {
                let cellMd = Array.from(cell.childNodes).map(parseNodeToMarkdown).join('');
                cellMd = cellMd.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                cellMd = cellMd.replace(/\|/g, '\\|');
                return cellMd || ' ';
            }).join(' | ');
            mdTable += `| ${rowContent} |\n`;
            if (rowIndex === 0) {
                mdTable += `| ${cells.map(() => '---').join(' | ')} |\n`;
            }
        });
        return mdTable + '\n';
    }

    let content = Array.from(node.childNodes).map(parseNodeToMarkdown).join('');

    switch (tag) {
        case 'h1': return `\n\n# ${content.trim()}\n\n`;
        case 'h2': return `\n\n## ${content.trim()}\n\n`;
        case 'h3': return `\n\n### ${content.trim()}\n\n`;
        case 'h4': return `\n\n#### ${content.trim()}\n\n`;
        case 'h5': return `\n\n##### ${content.trim()}\n\n`;
        case 'h6': return `\n\n###### ${content.trim()}\n\n`;
        case 'p': return `\n${content.trim()}\n`;
        case 'code': return `\`${content.trim()}\``;
        case 'ul': case 'ol': return `\n${content}\n`;
        case 'li': return `- ${content.trim()}\n`;
        case 'br': return '\n';
        case 'strong': case 'b': return `**${content.trim()}**`;
        case 'em': case 'i': return `*${content.trim()}*`;
        case 'a': {
            const href = node.getAttribute('href');
            const text = content.trim();
            if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) return `[${text}](${href})`;
            return text;
        }
        case 'img': {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            return src ? `![${alt}](${src})` : '';
        }
        case 'blockquote': {
            const quoted = content.trim().split('\n').map((l) => `> ${l}`).join('\n');
            return `\n\n${quoted}\n\n`;
        }
        case 'hr': return '\n\n---\n\n';
        default: return content;
    }
};

const extractContent = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const mainContent =
        doc.querySelector('main') || doc.querySelector('article') ||
        doc.querySelector('.md-content') || doc.querySelector('.theme-doc-markdown') ||
        doc.querySelector('.markdown-body') || doc.querySelector('.post-content') ||
        doc.querySelector('.entry-content') || doc.querySelector('[role="main"]') ||
        doc.querySelector('#content') || doc.querySelector('.prose') || doc.body;
    if (!mainContent) throw new Error('メインコンテンツが見つかりませんでした。');
    let raw = parseNodeToMarkdown(mainContent);
    raw = raw.replace(/\n{3,}/g, '\n\n').trim();
    return raw;
};

const extractTitle = (htmlString) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.querySelector('title')?.textContent?.trim() || '';
};

const generateChunks = (markdown) => {
    const splitRegex = /(?=\n##? )/;
    return markdown.split(splitRegex)
        .map((chunk, index) => {
            const trimmed = chunk.trim();
            const titleMatch = trimmed.match(/^#{1,2}\s+(.+)/);
            return { id: index, title: titleMatch ? titleMatch[1].trim() : '', content: trimmed, charCount: trimmed.length };
        })
        .filter((chunk) => chunk.charCount > 20);
};

const generateChunksText = (markdown) => {
    const chunks = generateChunks(markdown);
    return chunks.map((c, i) => `--- チャンク ${i + 1}: ${c.title || 'Untitled'} ---\n${c.content}`).join('\n\n');
};

const CORS_PROXIES = [
    (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const fetchHTML = async (url) => {
    let lastError = null;
    for (const proxyFn of CORS_PROXIES) {
        const proxyUrl = proxyFn(url);
        try {
            const response = await fetch(proxyUrl, { signal: AbortSignal.timeout(15000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            const html = await response.text();
            if (!html || html.trim().length === 0) throw new Error('空のレスポンス');
            return html;
        } catch (error) {
            lastError = error;
            continue;
        }
    }
    throw new Error(`取得失敗: ${lastError?.message || '不明'}`);
};

const normalizeUrl = (url) => {
    try {
        const u = new URL(url);
        u.hash = '';
        let path = u.pathname.replace(/\/+$/, '') || '/';
        return `${u.origin}${path}${u.search}`;
    } catch { return null; }
};

const sanitizeFileName = (name) => {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .substring(0, 100)
        || 'untitled';
};

const getFileNameFromUrl = (url) => {
    try {
        const u = new URL(url);
        const segments = u.pathname.split('/').filter(Boolean);
        return segments.length > 0 ? segments[segments.length - 1] : u.hostname;
    } catch { return 'page'; }
};

// ─── App コンポーネント ─────────────────────────────────

function App() {
    // モード切替
    const [mode, setMode] = useState('single'); // 'single' | 'batch'

    // ===== 単一ページモード =====
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [markdown, setMarkdown] = useState('');
    const [chunks, setChunks] = useState([]);
    const [activeTab, setActiveTab] = useState('markdown');
    const [toast, setToast] = useState(null);
    const [expandedChunks, setExpandedChunks] = useState({});
    const [sourceTitle, setSourceTitle] = useState('');
    const resultRef = useRef(null);

    // ===== バッチモード =====
    const [batchUrl, setBatchUrl] = useState('');
    const [batchFormat, setBatchFormat] = useState('markdown'); // 'markdown' | 'chunks'
    const [maxPages, setMaxPages] = useState(30);
    const [crawling, setCrawling] = useState(false);
    const [crawlProgress, setCrawlProgress] = useState({ processed: 0, total: 0 });
    const [crawlResults, setCrawlResults] = useState([]);
    const [crawlError, setCrawlError] = useState(null);
    const [crawlDone, setCrawlDone] = useState(false);
    const crawlAbortRef = useRef(false);
    const batchResultRef = useRef(null);

    // ===== Toast =====
    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 単一ページモード ハンドラ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const handleExtract = useCallback(async () => {
        if (!url.trim()) { setError('URLを入力してください'); return; }
        try { new URL(url); } catch { setError('有効なURLを入力してください'); return; }

        setLoading(true); setError(null); setMarkdown(''); setChunks([]); setSourceTitle('');
        try {
            const html = await fetchHTML(url);
            setSourceTitle(extractTitle(html));
            const md = extractContent(html);
            if (!md || md.trim().length === 0) throw new Error('コンテンツを抽出できませんでした。');
            setMarkdown(md);
            setChunks(generateChunks(md));
            setTimeout(() => { resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
        } catch (err) {
            setError(err.message || '予期しないエラーが発生しました');
        } finally { setLoading(false); }
    }, [url]);

    const handleCopyMarkdown = useCallback(async () => {
        try { await navigator.clipboard.writeText(markdown); showToast('Markdownをクリップボードにコピーしました'); }
        catch { showToast('コピーに失敗しました', 'error'); }
    }, [markdown, showToast]);

    const handleCopyChunks = useCallback(async () => {
        try {
            const text = chunks.map((c, i) => `--- チャンク ${i + 1} ---\n${c.content}`).join('\n\n');
            await navigator.clipboard.writeText(text);
            showToast('チャンクデータをクリップボードにコピーしました');
        } catch { showToast('コピーに失敗しました', 'error'); }
    }, [chunks, showToast]);

    const handleDownloadMarkdown = useCallback(() => {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'extracted_data.md'; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(a.href);
        showToast('extracted_data.md をダウンロードしました');
    }, [markdown, showToast]);

    const handleDownloadChunks = useCallback(() => {
        const text = chunks.map((c, i) => `--- チャンク ${i + 1}: ${c.title || 'Untitled'} ---\n${c.content}`).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'rag_chunks.txt'; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(a.href);
        showToast('rag_chunks.txt をダウンロードしました');
    }, [chunks, showToast]);

    const toggleChunk = useCallback((id) => {
        setExpandedChunks((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !loading) handleExtract();
    }, [handleExtract, loading]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // バッチモード ハンドラ
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const handleCrawl = useCallback(async () => {
        if (!batchUrl.trim()) { setCrawlError('URLを入力してください'); return; }
        try { new URL(batchUrl); } catch { setCrawlError('有効なURLを入力してください'); return; }

        setCrawling(true);
        setCrawlError(null);
        setCrawlResults([]);
        setCrawlProgress({ processed: 0, total: 1 });
        setCrawlDone(false);
        crawlAbortRef.current = false;

        const visited = new Set();
        const queue = [batchUrl];
        const results = [];
        const baseOrigin = new URL(batchUrl).origin;
        const basePath = new URL(batchUrl).pathname.replace(/\/+$/, '') || '/';

        const SKIP_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|tar|gz|css|js|ico|woff|woff2|ttf|eot|mp4|mp3|wav|avi|mov)$/i;

        try {
            while (queue.length > 0 && visited.size < maxPages) {
                if (crawlAbortRef.current) break;

                const currentUrl = queue.shift();
                const normalized = normalizeUrl(currentUrl);
                if (!normalized || visited.has(normalized)) continue;
                visited.add(normalized);

                // 進捗更新
                const progressEntry = { url: currentUrl, title: '', status: 'processing', charCount: 0 };
                setCrawlResults((prev) => [...prev, progressEntry]);
                setCrawlProgress({ processed: visited.size, total: visited.size + queue.length });

                try {
                    const html = await fetchHTML(currentUrl);
                    const title = extractTitle(html) || getFileNameFromUrl(currentUrl);
                    const md = extractContent(html);

                    // 結果を更新
                    const result = { url: currentUrl, title, markdown: md, status: 'done', charCount: md.length };
                    results.push(result);
                    setCrawlResults((prev) =>
                        prev.map((r) => r.url === currentUrl ? result : r)
                    );

                    // ページ内のリンクを抽出
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const links = doc.querySelectorAll('a[href]');

                    for (const link of links) {
                        const href = link.getAttribute('href');
                        if (!href) continue;
                        try {
                            const resolved = new URL(href, currentUrl).href;
                            const resolvedNorm = normalizeUrl(resolved);
                            if (
                                resolvedNorm &&
                                resolvedNorm.startsWith(baseOrigin) &&
                                new URL(resolvedNorm).pathname.startsWith(basePath) &&
                                !visited.has(resolvedNorm) &&
                                !queue.some((q) => normalizeUrl(q) === resolvedNorm) &&
                                !SKIP_EXTENSIONS.test(new URL(resolvedNorm).pathname)
                            ) {
                                queue.push(resolved);
                            }
                        } catch { /* 無効なURL */ }
                    }

                    setCrawlProgress({ processed: visited.size, total: visited.size + queue.length });
                } catch (err) {
                    setCrawlResults((prev) =>
                        prev.map((r) => r.url === currentUrl
                            ? { ...r, status: 'error', title: getFileNameFromUrl(currentUrl), error: err.message }
                            : r
                        )
                    );
                }

                // レート制限（500ms間隔）
                await new Promise((r) => setTimeout(r, 500));
            }
        } catch (err) {
            setCrawlError(err.message);
        } finally {
            setCrawling(false);
            setCrawlDone(true);
            setTimeout(() => {
                batchResultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [batchUrl, maxPages]);

    const handleStopCrawl = useCallback(() => {
        crawlAbortRef.current = true;
    }, []);

    const handleDownloadZip = useCallback(async () => {
        const successResults = crawlResults.filter((r) => r.status === 'done');
        if (successResults.length === 0) { showToast('ダウンロード可能なページがありません', 'error'); return; }

        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            // ベースURLのパスを取得（ZIP内のルートを決定）
            const baseUrlObj = new URL(batchUrl);
            const baseSegments = baseUrlObj.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

            // ファイルパスの重複を管理
            const usedPaths = new Map();

            for (const result of successResults) {
                const extension = batchFormat === 'markdown' ? '.md' : '.txt';
                const content = batchFormat === 'markdown' ? result.markdown : generateChunksText(result.markdown);

                // URLパスからZIPファイルパスを生成
                let urlObj;
                try { urlObj = new URL(result.url); } catch { continue; }

                // パスセグメントを取得し、ベースパスからの相対パスを計算
                let pathSegments = urlObj.pathname.replace(/\/+$/, '').split('/').filter(Boolean);

                // ベースパスを除去して相対パスにする
                if (baseSegments.length > 0) {
                    const baseStr = baseSegments.join('/');
                    const pathStr = pathSegments.join('/');
                    if (pathStr.startsWith(baseStr)) {
                        pathSegments = pathStr.slice(baseStr.length).split('/').filter(Boolean);
                    }
                }

                // 各セグメントをサニタイズ
                pathSegments = pathSegments.map((seg) => sanitizeFileName(seg));

                // パスが空の場合（ベースURL自体の場合）はindexとする
                if (pathSegments.length === 0) {
                    pathSegments = ['index'];
                }

                // 最後のセグメントに拡張子を付与
                const lastSeg = pathSegments[pathSegments.length - 1];
                // 既に拡張子がある場合は除去してから付け替え
                pathSegments[pathSegments.length - 1] = lastSeg.replace(/\.[^.]+$/, '');

                let filePath = pathSegments.join('/') + extension;

                // 重複チェック
                if (usedPaths.has(filePath)) {
                    const count = usedPaths.get(filePath) + 1;
                    usedPaths.set(filePath, count);
                    const base = pathSegments.join('/');
                    filePath = `${base}_${count}${extension}`;
                } else {
                    usedPaths.set(filePath, 1);
                }

                zip.file(filePath, content);
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'web2rag_export.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            showToast(`${successResults.length} ファイルをZIPでダウンロードしました`);
        } catch (err) {
            showToast('ZIPの作成に失敗しました: ' + err.message, 'error');
        }
    }, [crawlResults, batchFormat, showToast]);

    const handleBatchKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !crawling) handleCrawl();
    }, [handleCrawl, crawling]);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 描画
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    const hasResult = markdown.length > 0;
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.charCount, 0);
    const successCount = crawlResults.filter((r) => r.status === 'done').length;
    const errorCount = crawlResults.filter((r) => r.status === 'error').length;
    const progressPercent = crawlProgress.total > 0 ? Math.round((crawlProgress.processed / crawlProgress.total) * 100) : 0;

    return (
        <div className="min-h-screen hero-gradient">
            {/* ===== Header ===== */}
            <header className="border-b border-[var(--color-border-custom)] bg-[var(--color-bg-primary)]/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-purple-500 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">Web2RAG</h1>
                            <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">by Scrapify</p>
                        </div>
                    </div>
                    <a href="https://github.com" target="_blank" rel="noopener noreferrer"
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* ===== Hero ===== */}
                <section className="text-center mb-10 sm:mb-14 animate-fade-in">
                    <div className="inline-flex items-center gap-2 badge badge-accent mb-4">
                        <Sparkles className="w-3 h-3" />
                        <span>RAG-Optimized Extraction</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-[var(--color-text-primary)] via-[var(--color-accent-hover)] to-purple-400 bg-clip-text text-transparent">
                        WebページをRAG用データに変換
                    </h2>
                    <p className="text-[var(--color-text-secondary)] text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                        URLを入力するだけで、Webページのメインコンテンツを抽出し、
                        <br className="hidden sm:block" />
                        LLMのRAGシステムに最適なMarkdown＆チャンクデータに変換します。
                    </p>
                </section>

                {/* ===== Mode Selector ===== */}
                <div className="mode-selector max-w-md mx-auto mb-8 animate-slide-up">
                    <button
                        className={`mode-tab ${mode === 'single' ? 'active' : ''}`}
                        onClick={() => setMode('single')}
                    >
                        <FileText className="w-4 h-4" />
                        単一ページ
                    </button>
                    <button
                        className={`mode-tab ${mode === 'batch' ? 'active' : ''}`}
                        onClick={() => setMode('batch')}
                    >
                        <Layers className="w-4 h-4" />
                        サイト一括変換
                    </button>
                </div>

                {/* ━━━━━━━━━━━━━━━━━━━━━━ 単一ページモード ━━━━━━━━━━━━━━━━━━━━━━ */}
                {mode === 'single' && (
                    <>
                        {/* URL Input */}
                        <section className="glass-card p-6 sm:p-8 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="w-5 h-5 text-[var(--color-accent)]" />
                                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Target URL</h3>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 relative">
                                    <input id="url-input" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                                        onKeyDown={handleKeyDown} placeholder="https://example.com/docs/getting-started"
                                        className="input-field pr-10" disabled={loading} />
                                    {url && (
                                        <button onClick={() => setUrl('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                                            aria-label="Clear URL">×</button>
                                    )}
                                </div>
                                <button id="extract-button" onClick={handleExtract} disabled={loading || !url.trim()} className="btn-primary whitespace-nowrap">
                                    {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /><span>抽出中...</span></>) : (<><ArrowRight className="w-4 h-4" /><span>抽出開始</span></>)}
                                </button>
                            </div>
                            {error && (
                                <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                                    <AlertCircle className="w-5 h-5 text-[var(--color-error)] shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{error}</p>
                                </div>
                            )}
                        </section>

                        {/* Results */}
                        {hasResult && (
                            <section ref={resultRef} className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                {sourceTitle && (
                                    <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                        <FileText className="w-4 h-4" /><span>ソース: {sourceTitle}</span>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-3 mb-6">
                                    <div className="badge badge-accent"><FileText className="w-3 h-3" />{markdown.length.toLocaleString()} 文字</div>
                                    <div className="badge badge-success"><Scissors className="w-3 h-3" />{chunks.length} チャンク</div>
                                    {chunks.length > 0 && totalChunkChars > 0 && (
                                        <div className="badge badge-accent"><Hash className="w-3 h-3" />平均 {Math.round(totalChunkChars / chunks.length).toLocaleString()} 文字/チャンク</div>
                                    )}
                                </div>
                                <div className="glass-card overflow-hidden">
                                    <div className="flex border-b border-[var(--color-border-custom)]">
                                        <button id="tab-markdown" className={`tab-button ${activeTab === 'markdown' ? 'active' : ''}`} onClick={() => setActiveTab('markdown')}>
                                            <FileText className="w-4 h-4" />Markdown
                                        </button>
                                        <button id="tab-chunks" className={`tab-button ${activeTab === 'chunks' ? 'active' : ''}`} onClick={() => setActiveTab('chunks')}>
                                            <Scissors className="w-4 h-4" />チャンク ({chunks.length})
                                        </button>
                                        <div className="ml-auto flex items-center gap-2 px-4">
                                            {activeTab === 'markdown' ? (
                                                <>
                                                    <button id="copy-markdown" onClick={handleCopyMarkdown} className="btn-secondary text-xs" title="Markdownをコピー">
                                                        <Copy className="w-3.5 h-3.5" /><span className="hidden sm:inline">コピー</span>
                                                    </button>
                                                    <button id="download-markdown" onClick={handleDownloadMarkdown} className="btn-secondary text-xs" title="Markdownをダウンロード">
                                                        <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">.md</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button id="copy-chunks" onClick={handleCopyChunks} className="btn-secondary text-xs" title="チャンクデータをコピー">
                                                        <ClipboardCopy className="w-3.5 h-3.5" /><span className="hidden sm:inline">コピー</span>
                                                    </button>
                                                    <button id="download-chunks" onClick={handleDownloadChunks} className="btn-secondary text-xs" title="チャンクデータをダウンロード">
                                                        <FileDown className="w-3.5 h-3.5" /><span className="hidden sm:inline">.txt</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="p-5 sm:p-6">
                                        {activeTab === 'markdown' ? (
                                            <textarea readOnly value={markdown} id="markdown-output"
                                                className="markdown-preview w-full resize-none outline-none" style={{ minHeight: '500px' }} />
                                        ) : (
                                            <div className="space-y-4" id="chunks-output">
                                                {chunks.length === 0 ? (
                                                    <p className="text-[var(--color-text-muted)] text-sm text-center py-8">チャンクが生成されませんでした。</p>
                                                ) : chunks.map((chunk) => (
                                                    <div key={chunk.id} className="chunk-card">
                                                        <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleChunk(chunk.id)}>
                                                            <div className="flex items-center gap-3">
                                                                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent-glow)] text-[var(--color-accent)] text-xs font-bold">{chunk.id + 1}</span>
                                                                <div>
                                                                    <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{chunk.title || `Chunk ${chunk.id + 1}`}</h4>
                                                                    <span className="text-xs text-[var(--color-text-muted)]">{chunk.charCount.toLocaleString()} 文字</span>
                                                                </div>
                                                            </div>
                                                            {expandedChunks[chunk.id] ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
                                                        </div>
                                                        {expandedChunks[chunk.id] && (
                                                            <div className="mt-3 pt-3 border-t border-[var(--color-border-custom)]">
                                                                <pre className="chunk-content whitespace-pre-wrap">{chunk.content}</pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Empty State */}
                        {!hasResult && !loading && !error && (
                            <section className="text-center py-16 sm:py-24 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-custom)] flex items-center justify-center">
                                    <Globe className="w-8 h-8 text-[var(--color-text-muted)]" />
                                </div>
                                <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">URLを入力して抽出を開始</h3>
                                <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                                    WebページのURLを入力すると、メインコンテンツを自動的に抽出し、RAGに最適化されたMarkdownとチャンクデータに変換します。
                                </p>
                            </section>
                        )}
                    </>
                )}

                {/* ━━━━━━━━━━━━━━━━━━━━━━ バッチモード ━━━━━━━━━━━━━━━━━━━━━━ */}
                {mode === 'batch' && (
                    <>
                        {/* URL Input + Settings */}
                        <section className="glass-card p-6 sm:p-8 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                            <div className="flex items-center gap-2 mb-4">
                                <FileSearch className="w-5 h-5 text-[var(--color-accent)]" />
                                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                    サイトクロール設定
                                </h3>
                            </div>

                            {/* URL入力 */}
                            <div className="flex flex-col sm:flex-row gap-3 mb-5">
                                <div className="flex-1 relative">
                                    <input
                                        id="batch-url-input"
                                        type="url"
                                        value={batchUrl}
                                        onChange={(e) => setBatchUrl(e.target.value)}
                                        onKeyDown={handleBatchKeyDown}
                                        placeholder="https://example.com/docs/"
                                        className="input-field pr-10"
                                        disabled={crawling}
                                    />
                                    {batchUrl && !crawling && (
                                        <button onClick={() => setBatchUrl('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                                            aria-label="Clear URL">×</button>
                                    )}
                                </div>
                            </div>

                            {/* 設定行 */}
                            <div className="settings-row mb-5">
                                <div className="settings-group">
                                    <label className="settings-label">出力形式</label>
                                    <select
                                        className="select-field"
                                        value={batchFormat}
                                        onChange={(e) => setBatchFormat(e.target.value)}
                                        disabled={crawling}
                                    >
                                        <option value="markdown">Markdown (.md)</option>
                                        <option value="chunks">チャンクテキスト (.txt)</option>
                                    </select>
                                </div>
                                <div className="settings-group">
                                    <label className="settings-label">最大ページ数</label>
                                    <input
                                        type="number"
                                        className="number-input"
                                        value={maxPages}
                                        onChange={(e) => setMaxPages(Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)))}
                                        min={1}
                                        max={5000}
                                        disabled={crawling}
                                    />
                                </div>
                                <div className="settings-group" style={{ marginLeft: 'auto' }}>
                                    <label className="settings-label">&nbsp;</label>
                                    {crawling ? (
                                        <button onClick={handleStopCrawl} className="btn-primary whitespace-nowrap" style={{ background: 'linear-gradient(135deg, var(--color-error), #dc2626)' }}>
                                            <StopCircle className="w-4 h-4" /><span>停止</span>
                                        </button>
                                    ) : (
                                        <button id="crawl-button" onClick={handleCrawl} disabled={!batchUrl.trim()} className="btn-primary whitespace-nowrap">
                                            <ArrowRight className="w-4 h-4" /><span>クロール開始</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 説明テキスト */}
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                指定したURL配下のリンクを自動的に探索し、各ページを{batchFormat === 'markdown' ? 'Markdown' : 'チャンクテキスト'}形式に変換。
                                変換されたファイルはZIPにまとめてダウンロードできます。ファイル名は各ページのタイトルから自動生成されます。
                            </p>

                            {crawlError && (
                                <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                                    <AlertCircle className="w-5 h-5 text-[var(--color-error)] shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-400">{crawlError}</p>
                                </div>
                            )}
                        </section>

                        {/* Progress & Results */}
                        {(crawling || crawlResults.length > 0) && (
                            <section ref={batchResultRef} className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                                {/* Progress Bar */}
                                <div className="glass-card p-6 mb-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            {crawling ? (
                                                <Loader2 className="w-4 h-4 text-[var(--color-accent)] animate-spin" />
                                            ) : (
                                                <CircleCheck className="w-4 h-4 text-[var(--color-success)]" />
                                            )}
                                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                                                {crawling ? 'クロール中...' : 'クロール完了'}
                                            </span>
                                        </div>
                                        <span className="text-xs text-[var(--color-text-muted)]">
                                            {crawlProgress.processed} / {crawlProgress.total} ページ
                                        </span>
                                    </div>
                                    <div className="progress-container">
                                        <div
                                            className={`progress-bar ${crawlDone ? 'done' : ''}`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>

                                    {/* Stats */}
                                    <div className="flex flex-wrap gap-3 mt-4">
                                        <div className="badge badge-success">
                                            <CircleCheck className="w-3 h-3" />
                                            {successCount} 成功
                                        </div>
                                        {errorCount > 0 && (
                                            <div className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--color-error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                                <CircleX className="w-3 h-3" />
                                                {errorCount} エラー
                                            </div>
                                        )}
                                    </div>

                                    {/* ZIP Download */}
                                    {crawlDone && successCount > 0 && (
                                        <button
                                            id="download-zip"
                                            onClick={handleDownloadZip}
                                            className="btn-primary mt-5 w-full sm:w-auto"
                                        >
                                            <FolderDown className="w-4 h-4" />
                                            ZIPダウンロード ({successCount} ファイル)
                                        </button>
                                    )}
                                </div>

                                {/* Page List */}
                                <div className="glass-card p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Settings2 className="w-4 h-4 text-[var(--color-text-muted)]" />
                                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)]">
                                            検出ページ一覧 ({crawlResults.length})
                                        </h3>
                                    </div>
                                    <div className="space-y-2" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                                        {crawlResults.map((result, index) => (
                                            <div key={index} className="page-item">
                                                <div className={`status-icon ${result.status}`}>
                                                    {result.status === 'done' && <CircleCheck className="w-4 h-4" />}
                                                    {result.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    {result.status === 'error' && <CircleX className="w-4 h-4" />}
                                                </div>
                                                <div className="page-info">
                                                    <div className="page-title">{result.title || '読み込み中...'}</div>
                                                    <div className="page-url">{result.url}</div>
                                                </div>
                                                {result.status === 'done' && (
                                                    <div className="page-chars">{result.charCount.toLocaleString()} 文字</div>
                                                )}
                                                {result.status === 'error' && (
                                                    <div className="page-chars" style={{ color: 'var(--color-error)' }}>失敗</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Empty State */}
                        {!crawling && crawlResults.length === 0 && !crawlError && (
                            <section className="text-center py-16 sm:py-24 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                                <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-custom)] flex items-center justify-center">
                                    <Layers className="w-8 h-8 text-[var(--color-text-muted)]" />
                                </div>
                                <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">
                                    サイト全体を一括変換
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] max-w-lg mx-auto">
                                    ドキュメントサイトのルートURLを入力すると、配下のページを自動的に探索し、
                                    各ページをファイルに変換してZIPでまとめてダウンロードできます。
                                    ファイル名は各ページのタイトルから自動生成されます。
                                </p>
                            </section>
                        )}
                    </>
                )}
            </main>

            {/* ===== Footer ===== */}
            <footer className="border-t border-[var(--color-border-custom)] mt-16">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">Web2RAG by Scrapify — WebページをRAG用データに変換するツール</p>
                </div>
            </footer>

            {/* ===== Toast ===== */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default App;
