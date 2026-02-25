/**
 * Markdownテキストをチャンクに分割する
 * H1またはH2見出しで分割し、RAGのベクトル化に適した単位にする
 */

const MIN_CHUNK_LENGTH = 20;

export function splitIntoChunks(markdown) {
    if (!markdown || markdown.trim().length === 0) return [];

    // H1またはH2見出しで分割
    const lines = markdown.split('\n');
    const chunks = [];
    let currentChunk = { title: '', content: '' };

    for (const line of lines) {
        // H1またはH2の見出しを検出
        const headingMatch = line.match(/^(#{1,2})\s+(.+)/);

        if (headingMatch) {
            // 現在のチャンクを保存（コンテンツがある場合）
            if (currentChunk.content.trim().length > 0) {
                chunks.push({ ...currentChunk });
            }
            // 新しいチャンクを開始
            currentChunk = {
                title: headingMatch[2].trim(),
                content: line + '\n',
            };
        } else {
            currentChunk.content += line + '\n';
        }
    }

    // 最後のチャンクを保存
    if (currentChunk.content.trim().length > 0) {
        chunks.push(currentChunk);
    }

    // 短すぎるチャンクを除外
    const filtered = chunks
        .map((chunk, index) => ({
            ...chunk,
            id: index,
            content: chunk.content.trim(),
            charCount: chunk.content.trim().length,
        }))
        .filter(chunk => chunk.charCount >= MIN_CHUNK_LENGTH);

    return filtered;
}
