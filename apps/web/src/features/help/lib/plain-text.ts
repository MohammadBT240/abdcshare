interface DocNode {
  type?: string;
  text?: string;
  content?: DocNode[];
}

export function extractPlainText(doc: unknown): string {
  const parts: string[] = [];
  walk(doc as DocNode, parts);
  return parts.join(' ').trim().replace(/\s+/g, ' ');
}

function walk(node: DocNode | undefined, parts: string[]): void {
  if (!node) return;
  if (node.type === 'text' && node.text) parts.push(node.text);
  if (node.content) node.content.forEach((child) => walk(child, parts));
}
