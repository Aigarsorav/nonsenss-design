# Apexline Studio — website

Single-page static site built with [Eleventy](https://www.11ty.dev/) (vanilla CSS + vanilla JS, no frameworks), hosted on Netlify, edited through [Decap CMS](https://decapcms.org/) at `/admin`.

```
content/        ← every text and image on the site (edited by the CMS)
images/         ← source photos; images/uploads is where the CMS puts new ones
src/            ← templates (Nunjucks), CSS, JS, CMS config — layout is fixed here
  _includes/    ← base layout + one partial per section
  assets/       ← css/main.css, js/main.js, favicon
  admin/        ← Decap CMS (index.html + config.yml)
eleventy.config.js  ← build: content → HTML, image resizing/compression
netlify.toml    ← Netlify build settings + cache/security headers
_site/          ← build output (generated, not committed)
```

## Local development

Requires Node 20+.

```bash
npm install
npm run dev        # http://localhost:8080 with live reload
npm run build      # writes the production site to _site/
```

Everything a client can change lives in `content/*.json`. Templates never contain copy or image paths; if you need a new field, add it to the JSON, the template and `src/admin/config.yml`.

Images referenced from `content/` are resized and compressed at build time by `@11ty/eleventy-img` (WebP + JPEG, several widths, served from `/img/`). Upload the best-quality original; the build takes care of the rest.

## Deploy to Netlify

1. Push this repository to GitHub (`aigarsorav/nonsenss-design`, branch `main`).
2. In Netlify: **Add new site → Import an existing project → GitHub**, pick the repo.
   Build command `npm run build`, publish directory `_site` are already set in `netlify.toml`.
3. Deploy. Every push to `main` (including CMS edits) rebuilds the site.

### Quote form (Netlify Forms)

The quote form is a native HTML form with `data-netlify="true"`, so Netlify detects it at build time — no setup needed. Submissions from all three languages land in the same **Site → Forms → quote** list. Each one includes a `language` field (`en`, `et` or `ru`), the chosen "What do you need" options (multi-select; sent both as a readable `need` summary line and as individual `need[]` values), the single "Finish" choice, and up to five attached photos.

To get an email for each submission: **Site configuration → Notifications → Form submission → Add notification → Email**, pick the `quote` form.

Spam protection is the built-in honeypot field (`bot-field`). Netlify's free tier includes 100 submissions / month and an 8 MB limit per submission; the site downsizes very large photos in the browser before sending.

## Content editing (Decap CMS)

The editor lives at `https://<your-site>/admin/`. Editors log in with their GitHub account, and every save is a commit to `main`, which triggers a rebuild (live in ~1–2 minutes).

### 1. Enable the GitHub OAuth provider on Netlify

Decap uses Netlify as the OAuth broker for GitHub (not Netlify Identity).

1. On GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**
   - Application name: anything, e.g. `Apexline CMS`
   - Homepage URL: your site URL
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - Register, then generate a **client secret**.
2. On Netlify: **Site configuration → Access & security → OAuth → Install provider → GitHub**, paste the Client ID and Client Secret.
3. `src/admin/config.yml` already points at `aigarsorav/nonsenss-design`, branch `main`, with `base_url: https://api.netlify.com`. If the repo or branch ever changes, update it there.

### 2. Give the site owner access

Anyone who edits content needs **write access to the GitHub repository**:

1. GitHub repo → **Settings → Collaborators → Add people**, enter their GitHub username.
2. They accept the invitation by email.
3. They open `https://<your-site>/admin/`, click **Login with GitHub**, authorise the OAuth app once.

(If the repo is owned by an organisation, add them to a team with write access instead.)

### 3. What can be edited

Everything textual, every image, and every list (projects, categories, services, steps, keywords, form options). Layout, colours and typography are fixed. Each field in the CMS has a hint explaining where it appears.

Notes for editors:
- **Work → Filter categories** can be added, renamed, removed and reordered. "All work" is always the first filter. Each category has a short technical ID (e.g. `wraps`) that projects point to — keep IDs stable; rename the names freely.
- **Work → Projects**: the first gallery photo is the card cover. Drag the handle to reorder projects or gallery photos.
- Headline fields: press Enter to force a line break. The lime-coloured part of the hero headline is its own field.

### 4. Languages

The site exists in English (`/`), Estonian (`/et/`) and Russian (`/ru/`), with a language switcher in the header and the phone menu, `hreflang` tags, and `<html lang>` per page. Images and project galleries are shared; only texts differ.

In the CMS, every section is edited with Decap's built-in i18n: pick **EN** at the top of the editor and use the locale toggle to show **ET** and **RU** next to it. Nothing is translated automatically — each language is written by hand.

- Fields marked as the same for every language (photos, email, phone, links) are edited once, in the EN column.
- Lists of texts (services, process steps, keywords, form options, …) exist once per language. Keep them in the same order so the numbering lines up.
- **Projects and categories are one shared list** (Decap can't share photos inside a translated list), so they appear in the EN column only, with English / Estonian / Russian sub-fields for the texts.
- On the Russian page, headings use *Roboto Flex* instead of *Archivo*, because Archivo has no Cyrillic glyphs; the width/weight match the English design.

Under the hood each `content/*.json` file is `{ "en": {…}, "et": {…}, "ru": {…} }`. Any field missing from a language falls back to English at build time.

## Custom domain

1. Netlify: **Domain management → Add a domain**, enter e.g. `apexline.ee`.
2. Either move the domain's nameservers to Netlify DNS (shown in the wizard), or at your registrar add:
   - `A` record for the apex (`@`) → `75.2.60.5`
   - `CNAME` for `www` → `<your-site>.netlify.app`
3. Wait for DNS to propagate; Netlify provisions a Let's Encrypt certificate automatically (**Domain management → HTTPS**).
4. Update `siteUrl` in **Site settings (SEO)** in the CMS (or `content/settings.json`) so canonical and share links use the new domain.
5. On GitHub, update the OAuth app's Homepage URL (the callback URL stays `https://api.netlify.com/auth/done`).

## Checks

- `npm run build` must succeed with no warnings about missing images.
- The build output contains the `quote` form in static HTML (`grep 'name="quote"' _site/index.html`), which is what Netlify needs to register it.
