// clyx — soft gate + hero logo ink threshold entrance
// The logo is blurred once, then a hard alpha threshold sweeps from high to
// low. High threshold keeps only the densest stroke cores (broken, sparse);
// lowering it pulls in more of the blur ramp, so the mark thickens and
// neighbouring letters bleed together.

const UNLOCK_KEY = "clyx-unlocked";
// SHA-256 of the site password (soft lock only — not real security)
const PASS_HASH =
  "1f0201bae0ce0fee121f4ce1588905304337d5fb8e40ec3174c925c0d6b5bee7";

async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function unlockSite() {
  const input = document.getElementById("gate-password");
  if (input) input.blur();

  document.documentElement.classList.remove("is-locked");
  const gate = document.getElementById("gate");
  if (gate) gate.setAttribute("aria-hidden", "true");

  // iOS Safari often leaves a scroll offset after the keyboard closes from
  // the password field — that clips the logo and peeks the slides underneath.
  const resetScroll = () => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  };
  resetScroll();
  requestAnimationFrame(() => {
    resetScroll();
    requestAnimationFrame(resetScroll);
  });
  setTimeout(resetScroll, 50);
  setTimeout(resetScroll, 300);
}

async function initGate() {
  if (!document.documentElement.classList.contains("is-locked")) {
    return;
  }

  const form = document.getElementById("gate-form");
  const input = document.getElementById("gate-password");
  const error = document.getElementById("gate-error");
  if (!form || !input) {
    unlockSite();
    return;
  }

  requestAnimationFrame(() => input.focus());

  await new Promise((resolve) => {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      error.hidden = true;
      form.classList.remove("is-wrong");

      const hash = await sha256Hex(input.value.trim());
      if (hash !== PASS_HASH) {
        error.hidden = false;
        form.classList.add("is-wrong");
        input.select();
        return;
      }

      try {
        localStorage.setItem(UNLOCK_KEY, "1");
      } catch (_) {
        /* private mode — still unlock this session */
      }
      unlockSite();
      resolve();
    });
  });
}

async function initHeroLogoInk() {
  const wrap = document.getElementById("hero-logo");
  if (!wrap) return;

  let svgText;
  try {
    const res = await fetch("assets/clyxlogo.svg");
    if (!res.ok) throw new Error("logo fetch failed");
    svgText = await res.text();
  } catch (err) {
    console.error(err);
    document.body.classList.remove("is-booting");
    return;
  }

  wrap.innerHTML = svgText;
  const svg = wrap.querySelector("svg");
  if (!svg) {
    document.body.classList.remove("is-booting");
    return;
  }

  const NS = "http://www.w3.org/2000/svg";
  const vbWidth = svg.viewBox.baseVal?.width || 1130;

  // Blur radius is in viewBox units, so scale it off the artwork's own width —
  // ~1.2% is enough for adjacent letters to bleed into each other at the fat end.
  const BLUR = vbWidth * 0.012;

  // alpha_out = SLOPE * alpha_in + offset, visible above ~0.5.
  // So the cutoff is threshold = (0.5 - offset) / SLOPE. A steep slope means the
  // blur ramp snaps to a hard edge instead of fading out.
  const SLOPE = 50;
  const T_START = 1.0;      // above peak alpha — nothing renders yet
  const T_END = 0.26;       // fat, letters merging
  const T_LOOP_THIN = 0.72; // sparse/broken end of the boomerang
  const ENTER_MS = 3200;    // first sweep, invisible -> fat
  const LOOP_MS = 2800;     // one leg of the boomerang

  const offsetFor = (t) => 0.5 - SLOPE * t;
  const matrixFor = (t) =>
    `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${SLOPE} ${offsetFor(t)}`;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(NS, "defs");
    svg.insertBefore(defs, svg.firstChild);
  }

  const filter = document.createElementNS(NS, "filter");
  filter.setAttribute("id", "clyx-ink");
  // Default filter region clips at +10%, which would shear off the fattened
  // margin as the threshold drops.
  filter.setAttribute("x", "-25%");
  filter.setAttribute("y", "-50%");
  filter.setAttribute("width", "150%");
  filter.setAttribute("height", "200%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const blur = document.createElementNS(NS, "feGaussianBlur");
  blur.setAttribute("in", "SourceAlpha");
  blur.setAttribute("stdDeviation", String(BLUR));
  blur.setAttribute("result", "blur");

  const threshold = document.createElementNS(NS, "feColorMatrix");
  threshold.setAttribute("in", "blur");
  threshold.setAttribute("type", "matrix");
  threshold.setAttribute("values", matrixFor(T_START));
  threshold.setAttribute("result", "goo");

  // Paint the thresholded silhouette a flat colour so blurred RGB can't
  // grey-fringe the edges.
  const flood = document.createElementNS(NS, "feFlood");
  flood.setAttribute("flood-color", "#ffffff");
  flood.setAttribute("result", "flood");

  const comp = document.createElementNS(NS, "feComposite");
  comp.setAttribute("in", "flood");
  comp.setAttribute("in2", "goo");
  comp.setAttribute("operator", "in");

  filter.append(blur, threshold, flood, comp);
  defs.appendChild(filter);

  // Everything that isn't defs goes under one filtered group.
  const group = document.createElementNS(NS, "g");
  group.setAttribute("filter", "url(#clyx-ink)");
  Array.from(svg.childNodes).forEach((node) => {
    if (node !== defs) group.appendChild(node);
  });
  svg.appendChild(group);

  svg.querySelectorAll("path").forEach((p) => {
    p.removeAttribute("class");
    p.setAttribute("fill", "#ffffff");
    p.setAttribute("stroke", "none");
  });

  wrap.classList.add("is-ready");

  const easeOutCubic = (p) => 1 - Math.pow(1 - p, 3);
  const easeInOutCubic = (p) =>
    p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const lerp = (a, b, p) => a + (b - a) * p;

  // Reduced motion: land on the final weight and never animate.
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduced.matches) {
    threshold.setAttribute("values", matrixFor(T_END));
    document.body.classList.remove("is-booting");
    return;
  }

  let phase = "enter";
  let phaseStart = null;
  let elapsedAtStop = 0;
  let rafId = null;
  let paused = false;

  function step(now) {
    if (phaseStart === null) phaseStart = now - elapsedAtStop;
    const elapsed = now - phaseStart;

    let t;
    if (phase === "enter") {
      const p = Math.min(1, elapsed / ENTER_MS);
      t = lerp(T_START, T_END, easeOutCubic(p));
      if (p === 1) {
        phase = "loop";
        phaseStart = now;
        elapsedAtStop = 0;
        document.body.classList.remove("is-booting");
      }
    } else {
      // Boomerang: fat -> thin -> fat, easing through both turnarounds so the
      // direction change reads as a breath rather than a bounce.
      const cycle = LOOP_MS * 2;
      const u = (elapsed % cycle) / cycle;
      const tri = u < 0.5 ? u * 2 : 2 - u * 2;
      t = lerp(T_END, T_LOOP_THIN, easeInOutCubic(tri));
    }

    threshold.setAttribute("values", matrixFor(t));
    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (rafId !== null) return;
    paused = false;
    // phaseStart is rebuilt from elapsedAtStop on the next frame, so the sweep
    // resumes mid-cycle instead of snapping back to the start.
    phaseStart = null;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    if (rafId === null) return;
    cancelAnimationFrame(rafId);
    rafId = null;
    paused = true;
    if (phaseStart !== null) elapsedAtStop = performance.now() - phaseStart;
  }

  // A blur re-runs every frame at hero size, so don't burn GPU on a logo that
  // has been scrolled past or a tab in the background.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 }
    ).observe(wrap);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else if (paused) start();
  });

  wrap.classList.add("is-inking");
  start();
}

function initContents() {
  const toggle = document.getElementById("contents-toggle");
  const panel = document.getElementById("contents-panel");
  const backdrop = document.getElementById("contents-backdrop");
  const nav = document.getElementById("contents-nav");
  const slides = Array.from(document.querySelectorAll(".slide[id]"));

  if (!toggle || !panel || !backdrop || !nav || slides.length === 0) return;

  const frag = document.createDocumentFragment();
  slides.forEach((slide, index) => {
    const titleEl = slide.querySelector(".slide__title");
    const title = titleEl ? titleEl.textContent.trim() : `Slide ${index + 1}`;
    const num = String(index + 1).padStart(2, "0");

    const link = document.createElement("a");
    link.className = "contents-link";
    link.href = `#${slide.id}`;
    link.innerHTML =
      `<span class="contents-link__num">${num}</span>` +
      `<span class="contents-link__label">${title}</span>`;

    link.addEventListener("click", (e) => {
      e.preventDefault();
      closeContents();
      requestAnimationFrame(() => {
        slide.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    frag.appendChild(link);
  });
  nav.appendChild(frag);

  function openContents() {
    backdrop.hidden = false;
    void backdrop.offsetWidth;
    document.body.classList.add("contents-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close contents");
    panel.setAttribute("aria-hidden", "false");
  }

  function closeContents() {
    document.body.classList.remove("contents-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open contents");
    panel.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (!document.body.classList.contains("contents-open")) {
        backdrop.hidden = true;
      }
    }, 450);
  }

  function toggleContents() {
    if (document.body.classList.contains("contents-open")) closeContents();
    else openContents();
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleContents();
  });

  backdrop.addEventListener("click", closeContents);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.body.classList.contains("contents-open")) {
      closeContents();
    }
  });
}

function initSlideReveal() {
  const slides = Array.from(document.querySelectorAll(".slide"));
  if (slides.length === 0) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    slides.forEach((slide) => slide.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      rootMargin: "0px 0px -8% 0px",
      threshold: 0.12,
    }
  );

  slides.forEach((slide) => observer.observe(slide));
}

(async function boot() {
  await initGate();
  initContents();
  initSlideReveal();
  await initHeroLogoInk();
})();
