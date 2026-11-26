// Source paragraphs are separated by blank lines. In a single stanza the
// source's line breaks provide shorter passages for practising on either page.
export function splitPoemParts(text) {
  const paragraphs = text.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean);
  return paragraphs.length > 1 ? paragraphs : text.split(/\n/u).map(part => part.trim()).filter(Boolean);
}
