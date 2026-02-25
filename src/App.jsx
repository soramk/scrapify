import { useState, useCallback, useRef } from 'react';
import {
    Globe, FileText, Scissors, Download, Copy, Check,
    Loader2, AlertCircle, ExternalLink, Sparkles,
    ChevronDown, ChevronUp, Hash, ArrowRight,
    ClipboardCopy, FileDown, Zap
} from 'lucide-react';
import { fetchHTML } from './utils/fetchHTML';
import { extractMainContent } from './utils/extractContent';
import { htmlToMarkdown } from './utils/htmlToMarkdown';
import { splitIntoChunks } from './utils/chunkSplitter';

function App() {
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

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const handleExtract = useCallback(async () => {
        if (!url.trim()) {
            setError('URLを入力してください');
            return;
        }

        try {
            new URL(url);
        } catch {
            setError('有効なURLを入力してください');
            return;
        }

        setLoading(true);
        setError(null);
        setMarkdown('');
        setChunks([]);
        setSourceTitle('');

        try {
            // 1. HTML取得
            const html = await fetchHTML(url);

            // タイトル取得
            const parser = new DOMParser();
            const tempDoc = parser.parseFromString(html, 'text/html');
            const title = tempDoc.querySelector('title')?.textContent || '';
            setSourceTitle(title);

            // 2. メインコンテンツ抽出
            const contentElement = extractMainContent(html);

            // 3. Markdown変換
            const md = htmlToMarkdown(contentElement);

            if (!md || md.trim().length === 0) {
                throw new Error('コンテンツを抽出できませんでした。ページに有効なコンテンツがない可能性があります。');
            }

            setMarkdown(md);

            // 4. チャンク分割
            const chunkList = splitIntoChunks(md);
            setChunks(chunkList);

            // 結果表示領域までスクロール
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

        } catch (err) {
            setError(err.message || '予期しないエラーが発生しました');
        } finally {
            setLoading(false);
        }
    }, [url]);

    const handleCopyMarkdown = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(markdown);
            showToast('Markdownをクリップボードにコピーしました');
        } catch {
            showToast('コピーに失敗しました', 'error');
        }
    }, [markdown, showToast]);

    const handleCopyChunks = useCallback(async () => {
        try {
            const text = chunks.map((c, i) => `--- Chunk ${i + 1} ---\n${c.content}`).join('\n\n');
            await navigator.clipboard.writeText(text);
            showToast('チャンクデータをクリップボードにコピーしました');
        } catch {
            showToast('コピーに失敗しました', 'error');
        }
    }, [chunks, showToast]);

    const handleDownloadMarkdown = useCallback(() => {
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'extracted_data.md';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('extracted_data.md をダウンロードしました');
    }, [markdown, showToast]);

    const handleDownloadChunks = useCallback(() => {
        const text = chunks.map((c, i) => `--- Chunk ${i + 1}: ${c.title || 'Untitled'} ---\n${c.content}`).join('\n\n');
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'rag_chunks.txt';
        a.click();
        URL.revokeObjectURL(a.href);
        showToast('rag_chunks.txt をダウンロードしました');
    }, [chunks, showToast]);

    const toggleChunk = useCallback((id) => {
        setExpandedChunks(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !loading) {
            handleExtract();
        }
    }, [handleExtract, loading]);

    const hasResult = markdown.length > 0;
    const totalChunkChars = chunks.reduce((sum, c) => sum + c.charCount, 0);

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
                            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                                Web2RAG
                            </h1>
                            <p className="text-xs text-[var(--color-text-muted)] hidden sm:block">
                                by Scrapify
                            </p>
                        </div>
                    </div>
                    <a
                        href="https://github.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                    >
                        <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* ===== Hero Section ===== */}
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

                {/* ===== URL Input Section ===== */}
                <section className="glass-card p-6 sm:p-8 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <div className="flex items-center gap-2 mb-4">
                        <Globe className="w-5 h-5 text-[var(--color-accent)]" />
                        <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                            Target URL
                        </h3>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                            <input
                                id="url-input"
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="https://example.com/docs/getting-started"
                                className="input-field pr-10"
                                disabled={loading}
                            />
                            {url && (
                                <button
                                    onClick={() => setUrl('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                                    aria-label="Clear URL"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                        <button
                            id="extract-button"
                            onClick={handleExtract}
                            disabled={loading || !url.trim()}
                            className="btn-primary whitespace-nowrap"
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" />
                                    <span>処理中...</span>
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="w-4 h-4" />
                                    <span>抽出開始</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mt-4 flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 animate-fade-in">
                            <AlertCircle className="w-5 h-5 text-[var(--color-error)] flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-400">{error}</p>
                        </div>
                    )}
                </section>

                {/* ===== Results Section ===== */}
                {hasResult && (
                    <section ref={resultRef} className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        {/* Source Info */}
                        {sourceTitle && (
                            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
                                <FileText className="w-4 h-4" />
                                <span>ソース: {sourceTitle}</span>
                            </div>
                        )}

                        {/* Stats Bar */}
                        <div className="flex flex-wrap gap-3 mb-6">
                            <div className="badge badge-accent">
                                <FileText className="w-3 h-3" />
                                {markdown.length.toLocaleString()} 文字
                            </div>
                            <div className="badge badge-success">
                                <Scissors className="w-3 h-3" />
                                {chunks.length} チャンク
                            </div>
                            {totalChunkChars > 0 && (
                                <div className="badge badge-accent">
                                    <Hash className="w-3 h-3" />
                                    平均 {Math.round(totalChunkChars / chunks.length).toLocaleString()} 文字/チャンク
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="glass-card overflow-hidden">
                            <div className="flex border-b border-[var(--color-border-custom)]">
                                <button
                                    id="tab-markdown"
                                    className={`tab-button ${activeTab === 'markdown' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('markdown')}
                                >
                                    <FileText className="w-4 h-4" />
                                    Markdown
                                </button>
                                <button
                                    id="tab-chunks"
                                    className={`tab-button ${activeTab === 'chunks' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('chunks')}
                                >
                                    <Scissors className="w-4 h-4" />
                                    チャンク ({chunks.length})
                                </button>

                                {/* Action Buttons */}
                                <div className="ml-auto flex items-center gap-2 px-4">
                                    {activeTab === 'markdown' ? (
                                        <>
                                            <button
                                                id="copy-markdown"
                                                onClick={handleCopyMarkdown}
                                                className="btn-secondary text-xs"
                                                title="Markdownをコピー"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">コピー</span>
                                            </button>
                                            <button
                                                id="download-markdown"
                                                onClick={handleDownloadMarkdown}
                                                className="btn-secondary text-xs"
                                                title="Markdownをダウンロード"
                                            >
                                                <Download className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">.md</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                id="copy-chunks"
                                                onClick={handleCopyChunks}
                                                className="btn-secondary text-xs"
                                                title="チャンクデータをコピー"
                                            >
                                                <ClipboardCopy className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">コピー</span>
                                            </button>
                                            <button
                                                id="download-chunks"
                                                onClick={handleDownloadChunks}
                                                className="btn-secondary text-xs"
                                                title="チャンクデータをダウンロード"
                                            >
                                                <FileDown className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">.txt</span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Tab Content */}
                            <div className="p-5 sm:p-6">
                                {activeTab === 'markdown' ? (
                                    <div className="markdown-preview" id="markdown-output">
                                        {markdown}
                                    </div>
                                ) : (
                                    <div className="space-y-4" id="chunks-output">
                                        {chunks.length === 0 ? (
                                            <p className="text-[var(--color-text-muted)] text-sm text-center py-8">
                                                チャンクが生成されませんでした。見出し（H1/H2）が含まれていない可能性があります。
                                            </p>
                                        ) : (
                                            chunks.map((chunk) => (
                                                <div key={chunk.id} className="chunk-card">
                                                    <div
                                                        className="flex items-center justify-between cursor-pointer"
                                                        onClick={() => toggleChunk(chunk.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-accent-glow)] text-[var(--color-accent)] text-xs font-bold">
                                                                {chunk.id + 1}
                                                            </span>
                                                            <div>
                                                                <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
                                                                    {chunk.title || `Chunk ${chunk.id + 1}`}
                                                                </h4>
                                                                <span className="text-xs text-[var(--color-text-muted)]">
                                                                    {chunk.charCount.toLocaleString()} 文字
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {expandedChunks[chunk.id] ? (
                                                            <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
                                                        )}
                                                    </div>

                                                    {expandedChunks[chunk.id] && (
                                                        <div className="mt-3 pt-3 border-t border-[var(--color-border-custom)]">
                                                            <div className="chunk-content">
                                                                {chunk.content}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {/* ===== Empty State ===== */}
                {!hasResult && !loading && !error && (
                    <section className="text-center py-16 sm:py-24 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border-custom)] flex items-center justify-center">
                            <Globe className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">
                            URLを入力して抽出を開始
                        </h3>
                        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
                            WebページのURLを入力すると、メインコンテンツを自動的に抽出し、
                            RAGに最適化されたMarkdownとチャンクデータに変換します。
                        </p>
                    </section>
                )}
            </main>

            {/* ===== Footer ===== */}
            <footer className="border-t border-[var(--color-border-custom)] mt-16">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Web2RAG by Scrapify — WebページをRAG用データに変換するツール
                    </p>
                </div>
            </footer>

            {/* ===== Toast ===== */}
            {toast && (
                <div className={`toast ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
                    {toast.type === 'error' ? (
                        <AlertCircle className="w-4 h-4" />
                    ) : (
                        <Check className="w-4 h-4" />
                    )}
                    {toast.message}
                </div>
            )}
        </div>
    );
}

export default App;
