/* ============================================================
   HK Technologies — public site renderer
   Pulls all content from the CMS database via /api/content
   and paints it into the page. Also handles navbar scroll
   behaviour and the mobile menu.
   ============================================================ */

// Small helpers ------------------------------------------------
const $ = (id) => document.getElementById(id);

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}

// allows the simple {gradient} highlight token in titles
function renderTitle(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html ?? "";
}

function isExternal(href) {
  return typeof href === "string" && href.startsWith("http");
}

// ------------------------------------------------------------
async function load() {
  let data;
  try {
    const res = await fetch("/api/content");
    data = await res.json();
  } catch (e) {
    console.error("Could not load site content", e);
    return;
  }
  render(data);
}

function render(data) {
  const s = data.settings || {};

  // ---------- Brand / Nav ----------
  const brand = s.brand || {};
  if (brand.logo) {
    $("nav-logo").src = brand.logo;
    $("contact-logo").src = brand.logo;
  }
  setText("nav-brand-name", brand.name || "HK Technologies");
  setText("nav-brand-tag", brand.tagline || "");

  const nav = s.nav || {};
  const links = nav.links || [];
  $("nav-links").innerHTML = links
    .map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`)
    .join("");

  const cta = $("nav-cta");
  cta.href = nav.ctaHref || "#contact";
  cta.innerHTML = `${esc(nav.ctaLabel || "Start a project")} <span aria-hidden>→</span>`;

  // mobile menu = links + cta
  $("mobile-menu").innerHTML =
    links.map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join("") +
    `<a class="btn btn-primary" href="${esc(nav.ctaHref || "#contact")}">${esc(nav.ctaLabel || "Start a project")} →</a>`;

  // ---------- Hero ----------
  const hero = s.hero || {};
  if (hero.heroBg) $("hero-bg").src = hero.heroBg;
  if (hero.heroImage) $("hero-image").src = hero.heroImage;
  setText("hero-badge", hero.badge || "");
  renderTitle("hero-title", hero.titleHtml || "");
  setText("hero-sub", hero.subtitle || "");

  const ha = [];
  if (hero.primaryCta)
    ha.push(`<a class="btn btn-primary" href="${esc(hero.primaryCta.href)}">${esc(hero.primaryCta.label)}</a>`);
  if (hero.secondaryCta)
    ha.push(`<a class="btn btn-outline" href="${esc(hero.secondaryCta.href)}">${esc(hero.secondaryCta.label)}</a>`);
  $("hero-actions").innerHTML = ha.join("");

  $("hero-stats").innerHTML = (hero.stats || [])
    .map((st) => `<div><dt class="text-gradient">${esc(st.k)}</dt><dd>${esc(st.v)}</dd></div>`)
    .join("");

  // ---------- Products ----------
  const pi = s.products_intro || {};
  setText("products-eyebrow", pi.eyebrow || "Our Work");
  renderTitle("products-title", pi.titleHtml || "");
  setText("products-sub", pi.subtitle || "");

  $("products-grid").innerHTML = (data.products || [])
    .map((p) => {
      const features = (p.features || [])
        .map((f) => `<li>${esc(f)}</li>`)
        .join("");
      const target = isExternal(p.href) ? ' target="_blank" rel="noreferrer"' : "";
      return `
      <article class="product-card">
        <div class="product-media">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" loading="lazy" />
          <div class="media-fade"></div>
          <span class="product-tag glass">${esc(p.tag)}</span>
        </div>
        <div class="product-body">
          <h3>${esc(p.name)}</h3>
          <p class="desc">${esc(p.descr)}</p>
          <ul class="feature-list">${features}</ul>
          <a class="product-link" href="${esc(p.href)}"${target}>${esc(p.cta)} <span aria-hidden>→</span></a>
        </div>
      </article>`;
    })
    .join("");

  // ---------- Services ----------
  const si = s.services_intro || {};
  setText("services-eyebrow", si.eyebrow || "What we do");
  renderTitle("services-title", si.titleHtml || "");
  setText("services-sub", si.subtitle || "");

  $("services-grid").innerHTML = (data.services || [])
    .map(
      (sv) => `
      <div class="service-card">
        <div class="icon">${esc(sv.icon)}</div>
        <h3>${esc(sv.title)}</h3>
        <p>${esc(sv.descr)}</p>
      </div>`
    )
    .join("");

  // ---------- About ----------
  const ab = s.about || {};
  setText("about-eyebrow", ab.eyebrow || "About HK Technologies");
  renderTitle("about-title", ab.titleHtml || "");
  setText("about-p1", ab.p1 || "");
  setText("about-p2", ab.p2 || "");
  setText("about-steps-title", ab.stepsTitle || "How we work");

  $("about-stats").innerHTML = (ab.stats || [])
    .map(
      (st) =>
        `<div class="about-stat"><div class="k">${esc(st.k)}</div><div class="v">${esc(st.v)}</div></div>`
    )
    .join("");

  $("about-steps").innerHTML = (ab.steps || [])
    .map(
      (step) => `
      <li class="step">
        <span class="num text-gradient">${esc(step.n)}</span>
        <div>
          <div class="t">${esc(step.t)}</div>
          <div class="d">${esc(step.d)}</div>
        </div>
      </li>`
    )
    .join("");

  // ---------- Testimonials ----------
  const ti = s.testimonials_intro || {};
  setText("testimonials-eyebrow", ti.eyebrow || "Voices");
  renderTitle("testimonials-title", ti.titleHtml || "");

  $("testimonials-grid").innerHTML = (data.testimonials || [])
    .map(
      (q) => `
      <figure class="testimonial">
        <div class="mark">&ldquo;</div>
        <blockquote>${esc(q.quote)}</blockquote>
        <figcaption>
          <div class="author">${esc(q.author)}</div>
          <div class="role">${esc(q.role)}</div>
        </figcaption>
      </figure>`
    )
    .join("");

  // ---------- Contact ----------
  const c = s.contact || {};
  setText("contact-eyebrow", c.eyebrow || "Let's build");
  renderTitle("contact-title", c.titleHtml || "");
  setText("contact-sub", c.subtitle || "");
  setText("contact-name", c.name || brand.name || "HK Technologies");
  setText("contact-city", c.cityLine || "");

  const ca = [];
  if (c.email)
    ca.push(`<a class="btn btn-primary" href="mailto:${esc(c.email)}">✉ ${esc(c.email)}</a>`);
  if (c.phone)
    ca.push(`<a class="btn btn-outline" href="tel:${esc((c.phone || "").replace(/\s+/g, ""))}">☏ ${esc(c.phone)}</a>`);
  $("contact-actions").innerHTML = ca.join("");

  const rows = [
    ["Office", c.office],
    ["Email", c.email],
    ["Phone", c.phone],
    ["Web", c.web],
    ["Founded", c.founded],
  ].filter(([, v]) => v);
  $("contact-rows").innerHTML = rows
    .map(([k, v]) => `<div class="row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join("");

  // ---------- Footer ----------
  const f = s.footer || {};
  const year = new Date().getFullYear();
  setText("footer-copy", (f.copyright || "© {year} HK Technologies. Crafted in Ramallah.").replace("{year}", year));
  $("footer-links").innerHTML =
    (f.links || [])
      .map((l) => `<a href="${esc(l.href)}">${esc(l.label)}</a>`)
      .join("") + (f.handle ? `<span class="handle">${esc(f.handle)}</span>` : "");

  // page title / meta
  if (brand.name) document.title = `${brand.name} — Palestinian Software Studio`;
}

// ---------- Navbar behaviour ----------
function initNavbar() {
  const navbar = $("navbar");
  const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = $("nav-toggle");
  toggle.addEventListener("click", () => navbar.classList.toggle("menu-open"));

  // close mobile menu when a link is tapped
  $("mobile-menu").addEventListener("click", (e) => {
    if (e.target.closest("a")) navbar.classList.remove("menu-open");
  });
}

initNavbar();
load();
