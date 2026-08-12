// clyx — soft gate + hero logo stroke draw-in + fill pour
// Stroke is clipped to each path so it draws *inside* the silhouette (no puff)

const UNLOCK_KEY = "clyx-unlocked";
// SHA-256 of the site password (soft lock only — not real security)
const PASS_HASH =
  "7c2c8a3069aeeb16f3133e249b8b1f62c4a38a713c2767808415841fe69206a3";

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

async function initHeroLogoDraw() {
  const wrap = document.getElementById("hero-logo");
  if (!wrap) return;

  let svgText;
  try {
    const res = await fetch("assets/title.svg");
    if (!res.ok) throw new Error("logo fetch failed");
    svgText = await res.text();
  } catch (err) {
    console.error(err);
    document.body.classList.remove("is-booting");
    return;
  }

  wrap.innerHTML = svgText;
  const strokeSvg = wrap.querySelector("svg");
  if (!strokeSvg) {
    document.body.classList.remove("is-booting");
    return;
  }

  // Top layer = strokes (draw in), bottom layer = fills (ink pour)
  strokeSvg.classList.add("stroke-layer");
  const fillSvg = strokeSvg.cloneNode(true);
  fillSvg.classList.remove("stroke-layer");
  fillSvg.classList.add("fill-layer");
  wrap.appendChild(fillSvg);

  // Left → right draw order
  const strokePaths = Array.from(strokeSvg.querySelectorAll("path"))
    .map((p) => ({ el: p, x: p.getBBox().x }))
    .sort((a, b) => a.x - b.x)
    .map((o) => o.el);

  // Clip each stroke to its own fill so only the *inner* half of the stroke shows.
  // Use ~2× the desired visible weight (outer half is clipped away).
  // Scaled off the viewBox so swapping in a logo drawn at a different size
  // keeps the same on-screen weight (0.00245 ≈ 1.8 units at the original 735 wide).
  const vbWidth = strokeSvg.viewBox.baseVal?.width || 735.2;
  const STROKE_WIDTH = vbWidth * 0.00245;
  const NS = "http://www.w3.org/2000/svg";

  let defs = strokeSvg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS(NS, "defs");
    strokeSvg.insertBefore(defs, strokeSvg.firstChild);
  }

  strokePaths.forEach((p, i) => {
    const clip = document.createElementNS(NS, "clipPath");
    clip.id = `logo-stroke-clip-${i}`;
    clip.setAttribute("clipPathUnits", "userSpaceOnUse");

    const clipShape = p.cloneNode(true);
    clipShape.removeAttribute("class");
    clipShape.removeAttribute("style");
    clipShape.setAttribute("fill", "#ffffff");
    clipShape.setAttribute("stroke", "none");
    clipShape.setAttribute("clip-rule", "evenodd");
    clip.appendChild(clipShape);
    defs.appendChild(clip);

    p.setAttribute("clip-path", `url(#logo-stroke-clip-${i})`);

    const len = p.getTotalLength();
    p.style.stroke = "#ffffff";
    p.style.strokeWidth = String(STROKE_WIDTH);
    p.style.strokeLinecap = "round";
    p.style.strokeLinejoin = "round";
    p.style.fill = "transparent";
    p.setAttribute("fill", "none");
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
  });

  fillSvg.querySelectorAll("path").forEach((p) => {
    p.style.stroke = "none";
    p.style.fill = "#ffffff";
    p.setAttribute("fill", "#ffffff");
    p.removeAttribute("class");
    p.removeAttribute("clip-path");
  });

  wrap.classList.add("is-ready");
  void strokeSvg.getBoundingClientRect();

  requestAnimationFrame(() => {
    const TOTAL_DRAW = 0.95;
    const STAGGER_SPAN = 0.6;

    strokePaths.forEach((p, i) => {
      const delay =
        (i / Math.max(1, strokePaths.length - 1)) * STAGGER_SPAN;
      p.style.transition = `stroke-dashoffset ${TOTAL_DRAW}s cubic-bezier(.4,.0,.2,1) ${delay}s`;
      p.style.strokeDashoffset = "0";
    });

    const pourAtMs = Math.max(0, (STAGGER_SPAN + TOTAL_DRAW - 0.1) * 1000);
    setTimeout(() => wrap.classList.add("is-poured"), pourAtMs);

    const doneAtMs = pourAtMs + 1600;
    setTimeout(() => document.body.classList.remove("is-booting"), doneAtMs);
  });
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
  await initHeroLogoDraw();
})();
