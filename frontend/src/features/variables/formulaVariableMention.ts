export interface ActiveFormulaMention {
  start: number;
  end: number;
  query: string;
}

const MENTION_PATTERN = /(^|[\s([{,:+\-*/=<>!&|%?])@([A-Za-z0-9_.]*)$/;

export function activeFormulaMention(
  text: string,
  cursor: number
): ActiveFormulaMention | null {
  const prefix = text.slice(0, cursor);
  const match = MENTION_PATTERN.exec(prefix);
  if (!match) {
    return null;
  }
  const prefixQuery = match[2] ?? "";
  const suffixQuery = /^[A-Za-z0-9_.]*/.exec(text.slice(cursor))?.[0] ?? "";
  return {
    start: cursor - prefixQuery.length - 1,
    end: cursor + suffixQuery.length,
    query: `${prefixQuery}${suffixQuery}`
  };
}

export function replaceFormulaMention(
  text: string,
  mention: Pick<ActiveFormulaMention, "start" | "end">,
  token: string
): { text: string; cursor: number } {
  const nextText = `${text.slice(0, mention.start)}${token}${text.slice(mention.end)}`;
  return { text: nextText, cursor: mention.start + token.length };
}
