import fs from "node:fs";
import path from "node:path";
import Image from "@11ty/eleventy-img";
import nunjucks from "nunjucks";

const safe = (html) => new nunjucks.runtime.SafeString(html);

const CONTENT_DIR = "content";
const IMAGE_WIDTHS = [480, 800, 1200, 1600, 2400];
const IMAGE_FORMATS = ["webp", "jpeg"];
const IMAGE_PATTERN = /^\/?images\/.+\.(jpe?g|png|webp|avif|gif|tiff?)$/i;

// Metadata for every image referenced in /content, keyed by its content path.
const imageMeta = new Map();

// Logo and favicon (content/header.json). They keep their transparency and vector format,
// so they skip the photo pipeline above and get their own small one below.
const BRAND_KEYS = new Set(["logoImage", "favicon"]);
const BRAND_PATTERN = /^\/?images\/.+\.(svg|png|webp)$/i;
const BRAND_OUTPUT = {
  logoImage: { width: 640, format: "webp" }, // shown at most ~40px tall; 640px wide covers retina for any sane logo
  favicon: { width: 192, format: "png" },
};
const brandMeta = new Map();

function collectImagePaths(value, found = new Set()) {
  if (typeof value === "string") {
    if (IMAGE_PATTERN.test(value)) found.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => collectImagePaths(v, found));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (!BRAND_KEYS.has(k)) collectImagePaths(v, found);
    }
  }
  return found;
}

async function processBrandImages() {
  brandMeta.clear();
  const headerFile = path.join(CONTENT_DIR, "header.json");
  if (!fs.existsSync(headerFile)) return;
  const header = JSON.parse(fs.readFileSync(headerFile, "utf8")).en || {};
  for (const key of BRAND_KEYS) {
    const src = header[key];
    if (!src) continue;
    const file = String(src).replace(/^\//, "");
    if (!BRAND_PATTERN.test(src) || !fs.existsSync(file)) {
      console.warn(`[images] ${key}: "${src}" is missing or not an SVG/PNG/WebP file — ignored.`);
      continue;
    }
    const isSvg = /\.svg$/i.test(file);
    try {
      const meta = await Image(file, {
        widths: [isSvg ? "auto" : BRAND_OUTPUT[key].width],
        formats: [isSvg ? "svg" : BRAND_OUTPUT[key].format],
        outputDir: "_site/img/",
        urlPath: "/img/",
        filenameFormat: (id, srcPath, width, format) =>
          `${path.basename(srcPath, path.extname(srcPath))}-${id.slice(0, 6)}${isSvg ? "" : "-" + width}.${format}`,
      });
      const out = Object.values(meta)[0][0];
      brandMeta.set(src, { url: out.url, width: out.width, height: out.height, type: out.sourceType });
    } catch (err) {
      console.warn(`[images] ${key}: could not read "${src}" (${err.message}) — ignored.`);
    }
  }
}

async function processContentImages() {
  const found = new Set();
  for (const file of fs.readdirSync(CONTENT_DIR)) {
    if (!file.endsWith(".json")) continue;
    collectImagePaths(JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8")), found);
  }
  await Promise.all(
    [...found].map(async (src) => {
      const file = src.replace(/^\//, "");
      if (!fs.existsSync(file)) {
        console.warn(`[images] Missing file referenced in content: ${src}`);
        return;
      }
      const meta = await Image(file, {
        widths: [...IMAGE_WIDTHS, "auto"],
        formats: IMAGE_FORMATS,
        outputDir: "_site/img/",
        urlPath: "/img/",
        sharpJpegOptions: { quality: 78, progressive: true, mozjpeg: true },
        sharpWebpOptions: { quality: 76 },
        filenameFormat: (id, srcPath, width, format) =>
          `${path.basename(srcPath, path.extname(srcPath))}-${id.slice(0, 6)}-${width}.${format}`,
      });
      // Drop the "auto" (original width) entry when a generated width already covers it.
      for (const format of Object.keys(meta)) {
        const seen = new Set();
        meta[format] = meta[format].filter((m) => !seen.has(m.width) && seen.add(m.width));
      }
      imageMeta.set(src, meta);
    })
  );
}

function getMeta(src) {
  const meta = imageMeta.get(src);
  if (!meta) console.error("[images] no processed image for", JSON.stringify(src), "known:", [...imageMeta.keys()]);
  if (!meta) throw new Error(`[images] No processed image for "${src}". Is the path correct?`);
  return meta;
}

const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export default function (eleventyConfig) {
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true });

  // Every JSON file in /content becomes a global data object named after the file.
  eleventyConfig.addGlobalData("images", async () => {
    await Promise.all([processContentImages(), processBrandImages()]);
    return true;
  });

  eleventyConfig.addPassthroughCopy({ images: "images" });
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // /admin/index.njk is a template (its <title> uses the brand-name setting); the CMS config is copied as is.
  eleventyConfig.addPassthroughCopy({ "src/admin/config.yml": "admin/config.yml" });
  eleventyConfig.addWatchTarget("./content/");
  eleventyConfig.addWatchTarget("./src/assets/");

  // Multi-line text from the CMS: escape, then turn line breaks into <br>.
  eleventyConfig.addFilter("lines", (str = "") =>
    safe(
      String(str)
        .trim()
        .split(/\r?\n/)
        .map((line) => escapeHtml(line.trim()))
        .join("<br>")
    )
  );

  eleventyConfig.addFilter("categorySlug", (str = "") =>
    String(str)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );

  // Per-language value from `{ en, et, ru }` objects (shared lists keep translations inline); plain strings pass through.
  eleventyConfig.addFilter("tr", (value, lang) =>
    value && typeof value === "object" ? value[lang] || value.en || "" : value
  );

  eleventyConfig.addFilter("pad2", (n) => String(n).padStart(2, "0"));

  eleventyConfig.addFilter("telHref", (str = "") => "tel:" + String(str).replace(/[^\d+]/g, ""));

  eleventyConfig.addFilter("json", (value) => JSON.stringify(value));

  // <picture> markup for an image from /content.
  eleventyConfig.addFilter("picture", (src, alt = "", sizes = "100vw", attrs = {}) => {
    const meta = getMeta(src);
    const fallback = meta.jpeg[meta.jpeg.length - 1];
    const sources = Object.entries(meta)
      .filter(([format]) => format !== "jpeg")
      .map(([, list]) => `<source type="${list[0].sourceType}" srcset="${list.map((m) => m.srcset).join(", ")}" sizes="${sizes}">`)
      .join("");
    const extra = Object.entries({ loading: "lazy", decoding: "async", ...attrs })
      .filter(([, v]) => v !== false && v != null)
      .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
      .join(" ");
    const img = `<img src="${fallback.url}" srcset="${meta.jpeg.map((m) => m.srcset).join(", ")}" sizes="${sizes}" width="${fallback.width}" height="${fallback.height}" alt="${escapeHtml(alt)}" ${extra}>`;
    return safe(`<picture>${sources}${img}</picture>`);
  });

  // Logo / favicon: `{ url, width, height, type }`, or nothing when no usable file is set
  // (templates then fall back to the text logo / default favicon).
  eleventyConfig.addFilter("brandImage", (src) => (src && brandMeta.get(src)) || null);

  // Data for the lightbox: one webp srcset + jpeg fallback per gallery image.
  eleventyConfig.addFilter("galleryData", (gallery = []) =>
    JSON.stringify(
      gallery
        .filter((item) => item && item.image)
        .map((item) => {
          const meta = getMeta(item.image);
          const best = meta.webp || meta.jpeg;
          const largest = meta.jpeg[meta.jpeg.length - 1];
          return {
            src: largest.url,
            srcset: best.map((m) => m.srcset).join(", "),
            type: best[0].sourceType,
            w: largest.width,
            h: largest.height,
            alt: item.alt || "",
          };
        })
    )
  );

  // Absolute URL of the largest jpeg, for Open Graph.
  eleventyConfig.addFilter("shareImage", (src) => {
    const meta = getMeta(src);
    const list = meta.jpeg.filter((m) => m.width <= 1600);
    return (list[list.length - 1] || meta.jpeg[0]).url;
  });

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "../content",
      output: "_site",
    },
    templateFormats: ["njk", "html"],
    htmlTemplateEngine: "njk",
  };
}
