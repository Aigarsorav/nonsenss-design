// One page per language. Content files in /content hold every locale
// (`{ "en": {...}, "et": {...}, "ru": {...} }`, Decap's single_file i18n layout);
// `t` exposes the current language's copy, falling back to English per field.

const SECTIONS = ["settings", "header", "hero", "specs", "marquee", "work", "services", "process", "studio", "quote", "footer"];

// Lists that are deliberately shared across languages (edited in the EN column of the CMS,
// with per-language sub-fields inside). Always read from `en`, even if the CMS has left a
// copy under another locale.
const SHARED = {
  settings: ["siteUrl"],
  header: ["logoImage", "logoDisplay", "logoInFooter", "favicon"],
  hero: ["showSpecs"],
  marquee: ["showSection"],
  work: ["categories", "projects", "showSection"],
  services: ["showSection"],
  process: ["showSection"],
  studio: ["showSection"],
  quote: ["showSection", "directEmail"],
  footer: ["showElsewhere"],
};

// Sections with a "Show this section" toggle (shared across languages, on unless switched off).
// `show` says which are visible; `hiddenAnchors` lists the #links that must not be rendered.
const TOGGLED = ["marquee", "work", "services", "process", "studio", "quote"];
const isOn = (data, key, field) => (data[key]?.en || {})[field] !== false;

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
    show: (data) => {
      const out = { elsewhere: isOn(data, "footer", "showElsewhere") };
      for (const key of TOGGLED) out[key] = isOn(data, key, "showSection");
      return out;
    },
    hiddenAnchors: (data) => TOGGLED.filter((key) => !isOn(data, key, "showSection")).map((key) => `#${key}`),
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
      // Used for canonical, hreflang and Open Graph URLs; an editor may type a trailing slash.
      out.settings.siteUrl = String(out.settings.siteUrl || "").replace(/\/+$/, "");
      return out;
    },
  },
};
