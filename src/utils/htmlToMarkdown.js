/**
 * HTMLノードをMarkdown形式に変換するカスタムパーサー
 * 
 * - 見出し: h1-h6 → # ~ ######
 * - テキスト/リスト: p, ul, ol, li
 * - テーブル: Markdownテーブル形式
 * - コードブロック: バッククォート3つで囲む
 * - 太字: strong, b → **text**
 * - リンク: a → [text](url)
 * - 画像: img → ![alt](src)
 */

export function htmlToMarkdown(element) {
    if (!element) return '';
    const lines = processNode(element, { listDepth: 0, ordered: false, itemIndex: 0 });
    return cleanupMarkdown(lines.join(''));
}

function processNode(node, context) {
    const parts = [];

    if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        // テキストノードの処理（空白のみの場合でもスペースを維持）
        if (text.trim().length > 0) {
            parts.push(text.replace(/\s+/g, ' '));
        }
        return parts;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
        return parts;
    }

    const tag = node.tagName.toLowerCase();

    // コードハイライト用テーブルの検出（行番号付きのコードブロック）
    if (tag === 'table' && isCodeTable(node)) {
        parts.push(processCodeTable(node));
        return parts;
    }

    switch (tag) {
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
            const level = parseInt(tag[1]);
            const prefix = '#'.repeat(level);
            const text = getTextContent(node).trim();
            if (text) {
                parts.push(`\n\n${prefix} ${text}\n\n`);
            }
            break;
        }

        case 'p': {
            const inner = processChildren(node, context);
            const text = inner.join('').trim();
            if (text) {
                parts.push(`\n\n${text}\n\n`);
            }
            break;
        }

        case 'br': {
            parts.push('\n');
            break;
        }

        case 'strong':
        case 'b': {
            const text = processChildren(node, context).join('').trim();
            if (text) {
                parts.push(`**${text}**`);
            }
            break;
        }

        case 'em':
        case 'i': {
            const text = processChildren(node, context).join('').trim();
            if (text) {
                parts.push(`*${text}*`);
            }
            break;
        }

        case 'code': {
            // インラインコード（preの中でない場合）
            if (!isInsidePre(node)) {
                const text = node.textContent;
                if (text) {
                    parts.push(`\`${text}\``);
                }
            } else {
                // pre内のcodeはpreで処理される
                parts.push(extractCodeContent(node));
            }
            break;
        }

        case 'pre': {
            const codeEl = node.querySelector('code');
            const lang = detectLanguage(codeEl || node);
            let codeText;
            if (codeEl) {
                codeText = extractCodeContent(codeEl);
            } else {
                codeText = extractCodeContent(node);
            }
            if (codeText.trim()) {
                parts.push(`\n\n\`\`\`${lang}\n${codeText}\n\`\`\`\n\n`);
            }
            break;
        }

        case 'ul': {
            parts.push('\n');
            const children = Array.from(node.children);
            children.forEach((child) => {
                if (child.tagName?.toLowerCase() === 'li') {
                    const inner = processChildren(child, { ...context, listDepth: context.listDepth + 1, ordered: false }).join('').trim();
                    if (inner) {
                        const indent = '  '.repeat(context.listDepth);
                        parts.push(`${indent}- ${inner}\n`);
                    }
                }
            });
            parts.push('\n');
            break;
        }

        case 'ol': {
            parts.push('\n');
            const children = Array.from(node.children);
            let itemIdx = 1;
            children.forEach((child) => {
                if (child.tagName?.toLowerCase() === 'li') {
                    const inner = processChildren(child, { ...context, listDepth: context.listDepth + 1, ordered: true, itemIndex: itemIdx }).join('').trim();
                    if (inner) {
                        const indent = '  '.repeat(context.listDepth);
                        parts.push(`${indent}${itemIdx}. ${inner}\n`);
                        itemIdx++;
                    }
                }
            });
            parts.push('\n');
            break;
        }

        case 'a': {
            const href = node.getAttribute('href');
            const text = processChildren(node, context).join('').trim();
            if (text && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                parts.push(`[${text}](${href})`);
            } else if (text) {
                parts.push(text);
            }
            break;
        }

        case 'img': {
            const alt = node.getAttribute('alt') || '';
            const src = node.getAttribute('src') || '';
            if (src) {
                parts.push(`![${alt}](${src})`);
            }
            break;
        }

        case 'table': {
            parts.push(processTable(node));
            break;
        }

        case 'blockquote': {
            const inner = processChildren(node, context).join('').trim();
            if (inner) {
                const quoted = inner.split('\n').map(line => `> ${line}`).join('\n');
                parts.push(`\n\n${quoted}\n\n`);
            }
            break;
        }

        case 'hr': {
            parts.push('\n\n---\n\n');
            break;
        }

        case 'dl': {
            const children = Array.from(node.children);
            children.forEach(child => {
                const childTag = child.tagName?.toLowerCase();
                if (childTag === 'dt') {
                    const text = getTextContent(child).trim();
                    if (text) parts.push(`\n\n**${text}**\n`);
                } else if (childTag === 'dd') {
                    const text = processChildren(child, context).join('').trim();
                    if (text) parts.push(`  ${text}\n`);
                }
            });
            break;
        }

        default: {
            // 其他要素は子要素を再帰的に処理
            const inner = processChildren(node, context);
            parts.push(...inner);
            break;
        }
    }

    return parts;
}

function processChildren(node, context) {
    const parts = [];
    for (const child of node.childNodes) {
        parts.push(...processNode(child, context));
    }
    return parts;
}

function getTextContent(node) {
    return node.textContent || '';
}

function isInsidePre(node) {
    let current = node.parentElement;
    while (current) {
        if (current.tagName?.toLowerCase() === 'pre') return true;
        current = current.parentElement;
    }
    return false;
}

/**
 * コードコンテンツを抽出（Docusaurus/Prism.js対応）
 * token-lineクラス等のspan分割を正しく改行に復元
 */
function extractCodeContent(node) {
    // token-line パターンをチェック
    const tokenLines = node.querySelectorAll('.token-line, [class*="token-line"]');
    if (tokenLines.length > 0) {
        return Array.from(tokenLines)
            .map(line => line.textContent)
            .join('\n');
    }

    // 行ごとのspanパターン（各spanが1行に対応）
    const lineSpans = node.querySelectorAll('[data-line], .line');
    if (lineSpans.length > 0) {
        return Array.from(lineSpans)
            .map(line => line.textContent)
            .join('\n');
    }

    // デフォルト: textContentを使用
    return node.textContent || '';
}

/**
 * コード用テーブルの検出（行番号付きのコード表示）
 */
function isCodeTable(table) {
    const text = table.textContent || '';
    const hasCodeClass = table.querySelector('code, pre, [class*="code"], [class*="highlight"]');
    const hasLineNumbers = table.querySelector('[class*="line-number"], [class*="linenumber"], .line-num');
    return !!(hasCodeClass || hasLineNumbers);
}

/**
 * コード用テーブルをコードブロックとして処理
 */
function processCodeTable(table) {
    // コード部分のセルを見つける
    const cells = table.querySelectorAll('td');
    let codeContent = '';

    for (const cell of cells) {
        // 行番号セルはスキップ
        const classes = cell.className || '';
        if (classes.includes('line-number') || classes.includes('linenumber') || classes.includes('line-num')) {
            continue;
        }
        // コード内容を持つセル
        const codeEl = cell.querySelector('code, pre');
        if (codeEl) {
            codeContent = extractCodeContent(codeEl);
            break;
        }
        // 最後のセルをコードとして扱う
        codeContent = extractCodeContent(cell);
    }

    if (codeContent.trim()) {
        return `\n\n\`\`\`\n${codeContent}\n\`\`\`\n\n`;
    }
    return '';
}

/**
 * 言語を検出
 */
function detectLanguage(element) {
    if (!element) return '';
    const className = element.className || '';

    // language-xxx パターン
    const langMatch = className.match(/(?:language|lang|highlight)-(\w+)/);
    if (langMatch) {
        const lang = langMatch[1].toLowerCase();
        // 一般的な言語名のみ
        const validLangs = [
            'javascript', 'js', 'typescript', 'ts', 'python', 'py', 'java', 'c', 'cpp',
            'csharp', 'cs', 'go', 'rust', 'ruby', 'rb', 'php', 'swift', 'kotlin',
            'html', 'css', 'scss', 'sass', 'less', 'json', 'yaml', 'yml', 'xml',
            'sql', 'bash', 'sh', 'shell', 'powershell', 'ps1',
            'markdown', 'md', 'text', 'txt', 'plain',
            'jsx', 'tsx', 'vue', 'svelte',
            'r', 'matlab', 'scala', 'perl', 'lua', 'haskell', 'elixir', 'clojure',
            'docker', 'dockerfile', 'nginx', 'graphql', 'toml', 'ini', 'makefile',
        ];
        if (validLangs.includes(lang)) return lang;
    }

    // data-language属性
    const dataLang = element.getAttribute('data-language') || element.getAttribute('data-lang');
    if (dataLang) return dataLang.toLowerCase();

    return '';
}

/**
 * テーブルをMarkdownテーブルに変換
 */
function processTable(table) {
    const rows = [];
    const tableRows = table.querySelectorAll('tr');

    for (const tr of tableRows) {
        const cells = tr.querySelectorAll('th, td');
        const row = Array.from(cells).map(cell => {
            let text = getTextContent(cell).trim();
            // セル内の改行をスペースに置換
            text = text.replace(/[\r\n]+/g, ' ');
            // パイプをエスケープ
            text = text.replace(/\|/g, '\\|');
            return text;
        });
        rows.push(row);
    }

    if (rows.length === 0) return '';

    // カラム数を統一
    const maxCols = Math.max(...rows.map(r => r.length));
    const normalized = rows.map(r => {
        while (r.length < maxCols) r.push('');
        return r;
    });

    const lines = [];
    // ヘッダー行
    lines.push(`| ${normalized[0].join(' | ')} |`);
    // セパレーター
    lines.push(`| ${normalized[0].map(() => '---').join(' | ')} |`);
    // データ行
    for (let i = 1; i < normalized.length; i++) {
        lines.push(`| ${normalized[i].join(' | ')} |`);
    }

    return `\n\n${lines.join('\n')}\n\n`;
}

/**
 * Markdownのクリーンアップ
 */
function cleanupMarkdown(text) {
    return text
        // 連続する空行を2行に制限
        .replace(/\n{3,}/g, '\n\n')
        // 先頭・末尾の空行を除去
        .trim()
        // 行末の空白を除去
        .split('\n')
        .map(line => line.trimEnd())
        .join('\n');
}
