const URL_PATTERN = /https?:\/\/[^\s<]+[^\s<).,;:!?]/gi;

interface LinkifiedTextProps {
  text: string;
}

export default function LinkifiedText({ text }: LinkifiedTextProps) {
  const parts: Array<string | { url: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
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