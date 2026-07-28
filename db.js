/* ============================================================
   HK Technologies CMS — database layer (Supabase / Postgres)
   Talks to Supabase over HTTPS using the service-role key.
   On first run it seeds the tables with the original website
   content so the site looks identical out of the box.
   ============================================================ */

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("\n  ⚠  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.");
  console.error("     Local:  copy .env.example to .env and fill in your Supabase keys.");
  console.error("     cPanel: add them as Environment Variables in 'Setup Node.js App'.\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Settings helpers (key/value JSON) ----------
async function getSetting(key) {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}

async function setSetting(key, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

async function getAllSettings() {
  const { data, error } = await supabase.from("settings").select("key,value");
  if (error) throw error;
  const out = {};
  for (const r of data) out[r.key] = r.value;
  return out;
}

// ============================================================
//  One-time seed (runs only if the settings table is empty)
// ============================================================
async function seed() {
  const { count, error } = await supabase
    .from("settings")
    .select("key", { count: "exact", head: true });

  if (error) {
    console.error("  ⚠  Could not reach Supabase. Did you run supabase-setup.sql?");
    console.error("     " + error.message + "\n");
    return;
  }
  if (count && count > 0) return; // already seeded

  console.log("  Seeding Supabase with the original HK Technologies content…");

  const settings = {
    admin: { password: "admin123" }, // CHANGE THIS in the CMS!
    brand: {
      name: "HK Technologies",
      tagline: "Build · Ship · Scale",
      logo: "/assets/hk-logo.jpg",
    },
    nav: {
      links: [
        { label: "Products", href: "#products" },
        { label: "Services", href: "#services" },
        { label: "About", href: "#about" },
        { label: "Testimonials", href: "#testimonials" },
        { label: "Contact", href: "#contact" },
      ],
      ctaLabel: "Start a project",
      ctaHref: "#contact",
    },
    hero: {
      badge: "Palestinian software studio · Est. 2025",
      titleHtml:
        'We engineer <span class="text-gradient">products</span><br />that move industries.',
      subtitle:
        "From AI-powered legal tools to restaurant platforms and developer education — HK Technologies builds modern web and mobile experiences from Ramallah to the world.",
      primaryCta: { label: "Explore our work →", href: "#products" },
      secondaryCta: { label: "Start a project", href: "#contact" },
      stats: [
        { k: "100+", v: "Downloads in 24h" },
        { k: "4", v: "Live products" },
        { k: "2025", v: "Founded" },
      ],
      heroBg: "/assets/hero-bg.jpg",
      heroImage: "/assets/hk-tech-hero.jpg",
    },
    products_intro: {
      eyebrow: "Our Work",
      titleHtml: 'Products shaping <span class="text-gradient">real industries</span>',
      subtitle:
        "Every project we ship solves a real operational problem — for lawyers, restaurants, and the next generation of developers.",
    },
    services_intro: {
      eyebrow: "What we do",
      titleHtml: 'A full-stack <span class="text-gradient">studio</span>, not an agency.',
      subtitle:
        "We design, build, ship and maintain. One team, one accountability — from the first sketch to the App Store badge.",
    },
    about: {
      eyebrow: "About HK Technologies",
      titleHtml:
        'Built in <span class="text-gradient">Ramallah</span>.<br />Engineered for the world.',
      p1: "HK Technologies is a young Palestinian software studio founded in 2025. We've already shipped a published legal AI app, a multi-tenant restaurant SaaS, hospitality websites, and trained the next wave of mobile developers — all from our office on Al Irsal St.",
      p2: "Our promise is simple: every product we touch should look like it was made by a team that genuinely cares about the craft.",
      stats: [
        { k: "2025", v: "Founded" },
        { k: "4+", v: "Products" },
        { k: "100+", v: "Day-one users" },
        { k: "1", v: "Mission" },
      ],
      stepsTitle: "How we work",
      steps: [
        { n: "01", t: "Discover", d: "We sit down with you to map the actual problem — not just the feature list." },
        { n: "02", t: "Design", d: "Wireframes, design systems, and prototypes you can click through before a line of code." },
        { n: "03", t: "Build", d: "Modern stacks: React, TanStack, Flutter, Node, Postgres, AI gateways." },
        { n: "04", t: "Ship & support", d: "We launch, monitor, and iterate. We're around long after release day." },
      ],
    },
    testimonials_intro: {
      eyebrow: "Voices",
      titleHtml: 'What people <span class="text-gradient">say</span>',
    },
    contact: {
      eyebrow: "Let's build",
      titleHtml: "Have an idea?<br /><span class=\"text-gradient\">Let's ship it.</span>",
      subtitle:
        "Tell us about your product, your timeline, or just say hi. We answer every message personally.",
      name: "HK Technologies",
      cityLine: "Ramallah · Palestine",
      office: "Al Irsal St, Ramallah",
      email: "info@hktechnologie.com",
      phone: "+970 593 223 693",
      web: "hktechnologie.com",
      founded: "2025",
    },
    footer: {
      copyright: "© {year} HK Technologies. Crafted in Ramallah.",
      links: [
        { label: "Products", href: "#products" },
        { label: "Services", href: "#services" },
        { label: "Contact", href: "#contact" },
      ],
      handle: "@hktechnologies.ps",
    },
  };

  const settingsRows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  await supabase.from("settings").insert(settingsRows);

  await supabase.from("products").insert([
    {
      name: "Al Mohami · المحامي",
      tag: "Legal · AI",
      descr:
        "A smart agenda for lawyers — case management, hearing reminders and an AI chatbot trained for legal workflows. Crossed 100+ subscriptions in the first 24 hours.",
      features: ["AI legal chatbot", "Smart case agenda", "Hearing reminders", "iOS · Android"],
      href: "https://apps.apple.com/il/app/al-mohami/id6752120788",
      cta: "View on App Store",
      image: "/assets/al-mohami.jpg",
      sort: 1,
    },
    {
      name: "Jim Blue",
      tag: "Restaurant · SaaS",
      descr:
        "Multi-role restaurant management platform with waiter & cashier accounts, POS integration, kitchen display and per-branch analytics.",
      features: ["Waiter & cashier roles", "POS integration", "Live analytics", "Multi-branch"],
      href: "https://staging.menu-hk.com/",
      cta: "Visit platform",
      image: "/assets/jim-blue.jpg",
      sort: 2,
    },
    {
      name: "Aleppo Restaurant",
      tag: "Web · Hospitality",
      descr:
        "A warm, story-driven website for the local Aleppo restaurant-café — menu, reservations and brand identity online.",
      features: ["Brand identity", "Menu system", "Responsive web", "SEO optimized"],
      href: "https://aleppo.ps",
      cta: "Visit website",
      image: "/assets/aleppo.jpg",
      sort: 3,
    },
    {
      name: "Mobile Dev Bootcamp",
      tag: "Education",
      descr:
        "From-zero-to-pro mobile development course covering Android & iOS. Hands-on, interactive sessions led by HK engineers.",
      features: ["Android & iOS", "Live sessions", "Project-based", "Mentorship"],
      href: "#contact",
      cta: "Join the next cohort",
      image: "/assets/course.jpg",
      sort: 4,
    },
  ]);

  await supabase.from("services").insert([
    { title: "Mobile Applications", descr: "Native iOS & Android apps and cross-platform Flutter builds — production-ready, store-published.", icon: "📱", sort: 1 },
    { title: "Web & SaaS Platforms", descr: "Multi-tenant dashboards, role-based systems and customer-facing web apps engineered for scale.", icon: "🌐", sort: 2 },
    { title: "AI Integrations", descr: "Domain-tuned chatbots, retrieval-augmented assistants and AI workflows embedded into your product.", icon: "🤖", sort: 3 },
    { title: "POS & Restaurant Tech", descr: "Cashier, waiter and kitchen display systems with hardware POS integrations and live analytics.", icon: "🍽️", sort: 4 },
    { title: "Brand & UI/UX Design", descr: "Identity, design systems and interfaces that look like they were crafted by someone who cares.", icon: "🎨", sort: 5 },
    { title: "Developer Education", descr: "Hands-on bootcamps and corporate training that turn beginners into shippable engineers.", icon: "🎓", sort: 6 },
  ]);

  await supabase.from("testimonials").insert([
    {
      quote:
        "The course was extremely useful — by the end we became fully capable in web development. Engineer Amir is exceptionally skilled, truly deserves the title 'engineer', and works tirelessly with us. Many thanks.",
      author: "Course Student",
      role: "Web Development Bootcamp",
      sort: 1,
    },
    {
      quote:
        "Honestly — if I saw any flaw in Amir, I'd say it about myself. The explanations are clear, the teaching style is professional. Online courses are harder than in-person, and you can really tell who's in command of the material. He is.",
      author: "Bootcamp Graduate",
      role: "Mobile Development Track",
      sort: 2,
    },
    {
      quote:
        "Over 100 downloads and subscriptions in the first 24 hours of launch. Thank you for trusting us.",
      author: "Al Mohami launch",
      role: "Day 1 metric",
      sort: 3,
    },
  ]);

  console.log("  ✓ Supabase seeded.");
}

module.exports = { supabase, getSetting, setSetting, getAllSettings, seed };
