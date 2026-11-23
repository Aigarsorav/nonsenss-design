// One page per language. Content files in /content hold every locale
// (`{ "en": {...}, "et": {...}, "ru": {...} }`, Decap's single_file i18n layout);
// `t` exposes the current language's copy, falling back to English per field.

const SECTIONS = ["settings", "header", "hero", "specs", "marquee", "work", "services", "process", "studio", "quote", "footer"];

// Lists that are deliberately shared across languages (edited in the EN column of the CMS,
// with per-language sub-fields inside). Always read from `en`, even if the CMS has left a
// copy under another locale.
const SHARED = {
  work: ["categories", "projects"],
  header: ["logoImage", "logoDisplay", "logoInFooter", "favicon"],
  hero: ["showSpecs"],
};

const locales = [
  { code: "en", label: "EN", name: "English", url: "/" },
  { code: "et", label: "ET", name: "Eesti", url: "/et/" },
  { code: "ru", label: "RU", name: "Русский", url: "/ru/" },
];

const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

function merge(base, over) {
  if (over === undefined || over === null || over === "") return base;
  if (Array.isArray(over)) {
    if (!Array.isArray(base)) return over;
    return over.map((item, i) => merge(base[i], item));
  }
  if (isObject(over)) {
    const out = { ...(isObject(base) ? base : {}) };
    for (const [k, v] of Object.entries(over)) out[k] = merge(out[k], v);
    return out;
  }
  return over;
}

export default {
  locales,
  pagination: { data: "locales", size: 1, alias: "locale" },
  eleventyComputed: {
    lang: (data) => data.locale.code,
    permalink: (data) => data.locale.url,
    t: (data) => {
      const code = data.locale.code;
      const out = {};
      for (const key of SECTIONS) {
        const file = data[key] || {};
        const en = file.en || {};
        out[key] = merge(en, file[code]);
        for (const shared of SHARED[key] || []) out[key][shared] = en[shared];
      }
      return out;
    },
  },
};
