(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Header: solid on scroll + progress bar ---------- */
  const header = $("[data-header]");
  const progress = $("[data-progress]");
  const toggle = $("[data-menu-toggle]");
  const menu = $("[data-menu]");
  let menuOpen = false;

  const onScroll = () => {
    const y = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    header.classList.toggle("is-solid", y > 24 || menuOpen);
    progress.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + "%";
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ---------- Mobile menu ---------- */
  const setMenu = (open) => {
    if (open === menuOpen) return;
    menuOpen = open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? toggle.dataset.labelClose : toggle.dataset.labelOpen);
    document.body.classList.toggle("is-locked", open);
    if (open) {
      menu.hidden = false;
      requestAnimationFrame(() => menu.classList.add("is-open"));
      $("a", menu).focus({ preventScroll: true });
    } else {
      menu.classList.remove("is-open");
      setTimeout(() => { if (!menuOpen) menu.hidden = true; }, reduceMotion ? 0 : 250);
    }
    onScroll();
  };
  toggle.addEventListener("click", () => setMenu(!menuOpen));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && menuOpen) { setMenu(false); toggle.focus(); }
  });
  window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => { if (e.matches) setMenu(false); });

  /* ---------- Work filters (FLIP transition) ---------- */
  const grid = $("[data-grid]");
  const cards = $$(".card", grid);
  const filterButtons = $$("[data-filter]");
  let filterTimer;

  const applyFilter = (value) => {
    filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === value)));
    const matches = (card) => value === "all" || card.dataset.category === value;

    if (reduceMotion) {
      cards.forEach((card) => { card.hidden = !matches(card); });
      return;
    }
    clearTimeout(filterTimer);
    const leaving = cards.filter((c) => !c.hidden && !matches(c));
    leaving.forEach((c) => { c.classList.add("is-animating", "is-hiding"); });

    filterTimer = setTimeout(() => {
      const before = new Map(cards.filter((c) => !c.hidden).map((c) => [c, c.getBoundingClientRect()]));
      const entering = [];
      cards.forEach((card) => {
        const show = matches(card);
        if (show && card.hidden) entering.push(card);
        card.hidden = !show;
        card.classList.remove("is-animating", "is-hiding");
      });
      // Slide staying cards from their old position to the new one.
      cards.forEach((card) => {
        const old = before.get(card);
        if (!old || card.hidden) return;
        const now = card.getBoundingClientRect();
        const dx = old.left - now.left, dy = old.top - now.top;
        if (!dx && !dy) return;
        card.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      entering.forEach((card) => card.classList.add("is-entering"));
      grid.offsetWidth; // flush styles before animating
      requestAnimationFrame(() => {
        cards.forEach((card) => {
          if (card.hidden) return;
          card.classList.add("is-animating");
          card.classList.remove("is-entering");
          card.style.transform = "";
        });
        filterTimer = setTimeout(() => cards.forEach((c) => c.classList.remove("is-animating")), 480);
      });
    }, leaving.length ? 260 : 0);
  };
  filterButtons.forEach((b) => b.addEventListener("click", () => applyFilter(b.dataset.filter)));

  /* ---------- Lightbox ---------- */
  const lb = $("[data-lightbox]");
  const lbImg = $("[data-lb-img]", lb);
  const lbStage = $("[data-lb-stage]", lb);
  const lbCounter = $("[data-lb-counter]", lb);
  const lbCaption = $("[data-lb-caption]", lb);
  const lbPrev = $("[data-lb-prev]", lb);
  const lbNext = $("[data-lb-next]", lb);
  const lbClose = $("[data-lb-close]", lb);
  const preloaded = new Set();
  let gallery = [], index = 0, lastFocus = null, lbOpen = false;

  const preload = (item) => {
    if (!item || preloaded.has(item.src)) return;
    preloaded.add(item.src);
    const img = new Image();
    img.sizes = "100vw";
    img.srcset = item.srcset;
    img.src = item.src;
  };

  const show = (i) => {
    const n = gallery.length;
    index = (i + n) % n;
    const item = gallery[index];
    lbStage.classList.add("is-busy");
    lbImg.classList.add("is-loading");
    lbImg.onload = () => { lbImg.classList.remove("is-loading"); lbStage.classList.remove("is-busy"); };
    lbImg.removeAttribute("srcset");
    lbImg.alt = item.alt;
    lbImg.width = item.w;
    lbImg.height = item.h;
    lbImg.sizes = "100vw";
    lbImg.srcset = item.srcset;
    lbImg.src = item.src;
    if (lbImg.complete && lbImg.naturalWidth) lbImg.onload();
    lbCounter.textContent = `${index + 1} / ${n}`;
    const single = n < 2;
    lbPrev.hidden = single;
    lbNext.hidden = single;
    lbCounter.hidden = single;
    if (!single) { preload(gallery[(index + 1) % n]); preload(gallery[(index - 1 + n) % n]); }
  };

  const openLightbox = (card) => {
    gallery = JSON.parse(card.dataset.gallery || "[]");
    if (!gallery.length) return;
    lastFocus = document.activeElement;
    lbCaption.textContent = card.dataset.title || "";
    lb.hidden = false;
    lbOpen = true;
    document.body.classList.add("is-locked");
    show(0);
    requestAnimationFrame(() => lb.classList.add("is-open"));
    lbClose.focus({ preventScroll: true });
  };

  const closeLightbox = () => {
    if (!lbOpen) return;
    lbOpen = false;
    lb.classList.remove("is-open");
    document.body.classList.remove("is-locked");
    setTimeout(() => {
      if (lbOpen) return;
      lb.hidden = true;
      lbImg.removeAttribute("src");
      lbImg.removeAttribute("srcset");
      lbImg.style.transform = "";
    }, reduceMotion ? 0 : 250);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  };

  $$(".card__hit").forEach((btn) => btn.addEventListener("click", () => openLightbox(btn.closest(".card"))));
  lbPrev.addEventListener("click", () => show(index - 1));
  lbNext.addEventListener("click", () => show(index + 1));
  lbClose.addEventListener("click", closeLightbox);
  // Click outside the image closes.
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target === lbStage) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (!lbOpen) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft" && gallery.length > 1) show(index - 1);
    else if (e.key === "ArrowRight" && gallery.length > 1) show(index + 1);
    else if (e.key === "Tab") {
      const focusable = $$("button:not([hidden])", lb);
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Touch: swipe left/right to navigate, swipe down to close.
  let touch = null;
  lbStage.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { touch = null; return; }
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, dy: 0, axis: null };
  }, { passive: true });
  lbStage.addEventListener("touchmove", (e) => {
    if (!touch) return;
    touch.dx = e.touches[0].clientX - touch.x;
    touch.dy = e.touches[0].clientY - touch.y;
    if (!touch.axis && Math.hypot(touch.dx, touch.dy) > 8) touch.axis = Math.abs(touch.dx) > Math.abs(touch.dy) ? "x" : "y";
    lb.classList.add("is-dragging");
    if (touch.axis === "x" && gallery.length > 1) lbImg.style.transform = `translateX(${touch.dx}px)`;
    else if (touch.axis === "y" && touch.dy > 0) {
      lbImg.style.transform = `translateY(${touch.dy}px) scale(${1 - Math.min(touch.dy / 1500, 0.15)})`;
      lb.style.opacity = String(1 - Math.min(touch.dy / 600, 0.5));
    }
  }, { passive: true });
  const endTouch = () => {
    if (!touch) return;
    lb.classList.remove("is-dragging");
    lb.style.opacity = "";
    const { dx, dy, axis } = touch;
    touch = null;
    lbImg.style.transform = "";
    if (axis === "x" && Math.abs(dx) > 50 && gallery.length > 1) show(index + (dx < 0 ? 1 : -1));
    else if (axis === "y" && dy > 90) closeLightbox();
  };
  lbStage.addEventListener("touchend", endTouch);
  lbStage.addEventListener("touchcancel", endTouch);

  /* ---------- Quote form (Netlify Forms) ---------- */
  const form = $("[data-quote-form]");
  const success = $("[data-quote-success]");
  const fileInput = $("[data-upload-input]", form);
  const uploadText = $("[data-upload-text]", form);
  const errorBox = $("[data-form-error]", form);
  const submit = $("[data-submit]", form);
  const submitText = $("[data-submit-text]", form);
  const MAX_FILES = 5;
  const MAX_BYTES = 8 * 1024 * 1024; // Netlify Forms request limit

  const updateUploadText = () => {
    const n = fileInput.files.length;
    uploadText.textContent = !n ? form.dataset.msgDefault
      : n === 1 ? form.dataset.msgOne
      : form.dataset.msgMany.replace("{count}", n);
  };
  fileInput.addEventListener("change", updateUploadText);

  // Downscale large photos in the browser so uploads stay under the size limit.
  const shrink = (file) => new Promise((resolve) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 900 * 1024) return resolve(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob || blob.size >= file.size) return resolve(file);
        resolve(new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  const showSuccess = (name) => {
    const text = $("[data-success-text]", success);
    const first = (name || "").trim().split(/\s+/)[0];
    const template = text.dataset.template;
    // Without a name, drop "{name}" plus any comma/space before it: "Thanks {name}." → "Thanks."
    text.textContent = first ? template.replace("{name}", first) : template.replace(/[,\s]*\{name\}/, "").replace(/\s+([.!?,])/, "$1");
    form.hidden = true;
    success.hidden = false;
    success.focus({ preventScroll: true });
  };

  const setSending = (on) => {
    submit.disabled = on;
    submit.classList.toggle("is-sending", on);
    if (!submitText.dataset.idle) submitText.dataset.idle = submitText.textContent;
    submitText.textContent = on ? submitText.dataset.sending : submitText.dataset.idle;
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.hidden = true;
    // Plain-text summary of the multi-select so the notification email reads cleanly.
    $("[data-need-summary]", form).value = $$("[data-need-group] input:checked", form).map((i) => i.value).join(", ");
    const data = new FormData(form);
    const files = [...fileInput.files].slice(0, MAX_FILES);
    for (let i = 1; i <= MAX_FILES; i++) data.delete(`photo_${i}`);
    setSending(true);
    try {
      const prepared = await Promise.all(files.map(shrink));
      if (prepared.reduce((sum, f) => sum + f.size, 0) > MAX_BYTES) {
        throw new Error(form.dataset.msgTooLarge);
      }
      prepared.forEach((file, i) => data.append(`photo_${i + 1}`, file, file.name));
      const res = await fetch("/", { method: "POST", body: data });
      if (!res.ok) throw new Error();
      const name = data.get("name");
      form.reset();
      updateUploadText();
      showSuccess(name);
    } catch (err) {
      errorBox.textContent = (err && err.message) || errorBox.dataset.message;
      errorBox.hidden = false;
    } finally {
      setSending(false);
    }
  });
  errorBox.dataset.message = $("[data-quote]").dataset.error || "";

  $("[data-quote-again]").addEventListener("click", () => {
    success.hidden = true;
    form.hidden = false;
    $("input[name=name]", form).focus();
  });

  // Fallback when the form was submitted without JavaScript.
  if (new URLSearchParams(location.search).has("sent")) {
    showSuccess("");
    history.replaceState(null, "", location.pathname + "#quote");
  }
})();
