import "server-only";
import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "u", "s", "code", "pre",
  "ul", "ol", "li",
  "blockquote",
  "a", "img",
  "span", "div",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title", "class", "loading"];

const ALLOWED_CLASS_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALLOWED_CLASS_PREFIXES = ["text-", "bg-", "font-", "list-", "prose"];

function filterClassAttr(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const tokens = value.split(/\s+/).filter(Boolean).filter((tok) => {
    if (!ALLOWED_CLASS_PATTERN.test(tok)) return false;
    return ALLOWED_CLASS_PREFIXES.some((p) => tok === p || tok.startsWith(p));
  });
  return tokens.length ? tokens.join(" ") : undefined;
}

export function sanitizeRichText(html: string): string {
  const allowedAttributes: Record<string, string[]> = { "*": ALLOWED_ATTR };
  return sanitizeHtml(html || "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { a: ["http", "https", "mailto"] },
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ["href", "src"],
    transformTags: {
      a: (tagName, attribs) => {
        if (!attribs.href || !attribs.href.trim()) {
          return { tagName: "span", attribs: {} };
        }
        if (attribs.target && attribs.target !== "_self") {
          const existing = (attribs.rel || "").split(/\s+/).filter(Boolean);
          for (const required of ["noopener", "noreferrer"]) {
            if (!existing.includes(required)) existing.push(required);
          }
          attribs.rel = existing.join(" ");
        }
        const filtered = filterClassAttr(attribs.class);
        if (filtered) attribs.class = filtered;
        else delete attribs.class;
        return { tagName, attribs };
      },
      "*": (tagName, attribs) => {
        if (attribs.class) {
          const filtered = filterClassAttr(attribs.class);
          if (filtered) attribs.class = filtered;
          else delete attribs.class;
        }
        return { tagName, attribs };
      },
    },
  });
}
