const URL_PATTERN = /https?:\/\/[^\s<]+/gi;
const TRAILING_PUNCT = /[.,;:!?]+$/;

function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING_PUNCT, '');
  // Strip trailing ')' only when it isn't balanced by an earlier '('
  while (url.endsWith(')')) {
    const opens = (url.match(/\(/g) || []).length;
    const closes = (url.match(/\)/g) || []).length;
    if (closes > opens) {
      url = url.slice(0, -1).replace(TRAILING_PUNCT, '');
    } else {
      break;
    }
  }
  return url;
}

interface LinkifiedTextProps {
  text: string | null | undefined;
}

export default function LinkifiedText({ text }: LinkifiedTextProps) {
  if (!text) return null;
  const parts: Array<string | { url: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0]);
    if (!url) continue;
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(text.slice(lastIndex, index));
    parts.push({ url });
    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <a
            key={`${part.url}-${index}`}
            href={part.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 break-all hover:text-primary/80"
          >
            {part.url}
          </a>
        ),
      )}
    </>
  );
}