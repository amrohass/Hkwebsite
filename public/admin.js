/* ============================================================
   HK Technologies CMS — admin panel logic
   Schema-driven editor for all website content.
   ============================================================ */

const $ = (id) => document.getElementById(id);
let TOKEN = localStorage.getItem("hk_token") || "";

// ---------- API helper ----------
async function api(method, url, body, isForm) {
  const opts = { method, headers: {} };
  if (TOKEN) opts.headers.Authorization = "Bearer " + TOKEN;
  if (body && !isForm) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (isForm) {
    opts.body = body;
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    logout();
    throw new Error("Session expired — please sign in again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ---------- Toast ----------
let toastTimer;
function toast(msg, kind = "ok") {
  const t = $("toast");
  t.textContent = msg;
  t.className = "toast show " + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = "toast"), 2600);
}

// ============================================================
//  Field helpers
// ============================================================
function uploadImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  return api("POST", "/api/upload", fd, true).then((r) => r.url);
}

// Builds inputs for a schema into `container`, bound to `data`.
function buildFields(container, schema, data) {
  container.innerHTML = "";
  schema.forEach((field) => container.appendChild(buildField(field, data)));
}

function buildField(field, data) {
  const wrap = document.createElement("div");
  wrap.className = "field";

  if (field.type !== "group" && field.type !== "list" && field.type !== "stringlist") {
    const label = document.createElement("label");
    label.textContent = field.label;
    wrap.appendChild(label);
  }

  if (field.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.value = data[field.name] ?? "";
    input.oninput = () => (data[field.name] = input.value);
    wrap.appendChild(input);
  } else if (field.type === "textarea") {
    const ta = document.createElement("textarea");
    ta.value = data[field.name] ?? "";
    ta.oninput = () => (data[field.name] = ta.value);
    wrap.appendChild(ta);
  } else if (field.type === "image") {
    wrap.appendChild(buildImagePicker(field, data));
  } else if (field.type === "group") {
    data[field.name] = data[field.name] || {};
    const grp = document.createElement("div");
    grp.className = "list-item";
    const head = document.createElement("div");
    head.className = "li-head";
    head.innerHTML = `<span>${field.label}</span>`;
    grp.appendChild(head);
    buildFields(grp.appendChild(document.createElement("div")), field.fields, data[field.name]);
    wrap.appendChild(grp);
  } else if (field.type === "list") {
    wrap.appendChild(buildList(field, data));
  } else if (field.type === "stringlist") {
    wrap.appendChild(buildStringList(field, data));
  }

  if (field.hint) {
    const hint = document.createElement("div");
    hint.className = "hint";
    hint.textContent = field.hint;
    wrap.appendChild(hint);
  }
  return wrap;
}

function buildImagePicker(field, data) {
  const box = document.createElement("div");
  box.className = "image-picker";

  const preview = document.createElement("div");
  preview.className = "preview";
  const img = document.createElement("img");
  img.src = data[field.name] || "";
  img.alt = "";
  preview.appendChild(img);

  const controls = document.createElement("div");
  controls.className = "controls";

  const input = document.createElement("input");
  input.type = "text";
  input.value = data[field.name] ?? "";
  input.placeholder = "/assets/your-image.jpg";
  input.oninput = () => {
    data[field.name] = input.value;
    img.src = input.value;
  };

  const fileBtn = document.createElement("button");
  fileBtn.type = "button";
  fileBtn.className = "btn btn-ghost btn-sm";
  fileBtn.style.marginTop = "0.5rem";
  fileBtn.textContent = "⬆ Upload image";

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.style.display = "none";
  file.onchange = async () => {
    if (!file.files[0]) return;
    fileBtn.textContent = "Uploading…";
    try {
      const url = await uploadImage(file.files[0]);
      data[field.name] = url;
      input.value = url;
      img.src = url;
      toast("Image uploaded");
    } catch (e) {
      toast(e.message, "err");
    }
    fileBtn.textContent = "⬆ Upload image";
  };
  fileBtn.onclick = () => file.click();

  controls.append(input, fileBtn, file);
  box.append(preview, controls);
  return box;
}

// list of objects with sub-fields
function buildList(field, data) {
  data[field.name] = Array.isArray(data[field.name]) ? data[field.name] : [];
  const arr = data[field.name];

  const container = document.createElement("div");

  const header = document.createElement("label");
  header.textContent = field.label;
  container.appendChild(header);

  const itemsBox = document.createElement("div");
  container.appendChild(itemsBox);

  function renderItems() {
    itemsBox.innerHTML = "";
    arr.forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "list-item";
      const head = document.createElement("div");
      head.className = "li-head";
      head.innerHTML = `<span>${field.itemLabel || "Item"} ${i + 1}</span>`;
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger btn-sm";
      del.textContent = "Remove";
      del.onclick = () => {
        arr.splice(i, 1);
        renderItems();
      };
      head.appendChild(del);
      card.appendChild(head);

      const grid = document.createElement("div");
      grid.className = field.fields.length > 1 ? "grid2" : "";
      field.fields.forEach((sf) => grid.appendChild(buildField(sf, item)));
      card.appendChild(grid);
      itemsBox.appendChild(card);
    });
  }
  renderItems();

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn btn-ghost btn-sm";
  add.textContent = "+ Add " + (field.itemLabel || "item");
  add.onclick = () => {
    arr.push({});
    renderItems();
  };
  container.appendChild(add);
  return container;
}

// list of plain strings
function buildStringList(field, data) {
  data[field.name] = Array.isArray(data[field.name]) ? data[field.name] : [];
  const arr = data[field.name];

  const container = document.createElement("div");
  const header = document.createElement("label");
  header.textContent = field.label;
  container.appendChild(header);

  const itemsBox = document.createElement("div");
  container.appendChild(itemsBox);

  function render() {
    itemsBox.innerHTML = "";
    arr.forEach((val, i) => {
      const rowEl = document.createElement("div");
      rowEl.style.display = "flex";
      rowEl.style.gap = "0.5rem";
      rowEl.style.marginBottom = "0.5rem";
      const input = document.createElement("input");
      input.type = "text";
      input.value = val;
      input.oninput = () => (arr[i] = input.value);
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger btn-sm";
      del.textContent = "✕";
      del.onclick = () => {
        arr.splice(i, 1);
        render();
      };
      rowEl.append(input, del);
      itemsBox.appendChild(rowEl);
    });
  }
  render();

  const add = document.createElement("button");
  add.type = "button";
  add.className = "btn btn-ghost btn-sm";
  add.textContent = "+ Add";
  add.onclick = () => {
    arr.push("");
    render();
  };
  container.appendChild(add);
  return container;
}

// ============================================================
//  SCHEMAS
// ============================================================
const GRADIENT_HINT =
  'Wrap a highlighted phrase in <span class="text-gradient">…</span>. Use <br /> for a line break.';

const settingsSchemas = {
  brand: {
    title: "Brand",
    desc: "Logo and name shown in the navbar and footer.",
    fields: [
      { name: "name", label: "Company name", type: "text" },
      { name: "tagline", label: "Tagline (small caps under the name)", type: "text" },
      { name: "logo", label: "Logo image", type: "image" },
    ],
  },
  nav: {
    title: "Navigation",
    desc: "Menu links and the top-right button.",
    fields: [
      {
        name: "links",
        label: "Menu links",
        type: "list",
        itemLabel: "Link",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "Link (e.g. #products)", type: "text" },
        ],
      },
      { name: "ctaLabel", label: "Button text", type: "text" },
      { name: "ctaHref", label: "Button link", type: "text" },
    ],
  },
  hero: {
    title: "Hero (top section)",
    desc: "The big headline area at the top of the page.",
    fields: [
      { name: "badge", label: "Small badge text", type: "text" },
      { name: "titleHtml", label: "Headline", type: "textarea", hint: GRADIENT_HINT },
      { name: "subtitle", label: "Sub-text", type: "textarea" },
      {
        name: "primaryCta",
        label: "Primary button",
        type: "group",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "Link", type: "text" },
        ],
      },
      {
        name: "secondaryCta",
        label: "Secondary button",
        type: "group",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "Link", type: "text" },
        ],
      },
      {
        name: "stats",
        label: "Stats (the 3 numbers)",
        type: "list",
        itemLabel: "Stat",
        fields: [
          { name: "k", label: "Number", type: "text" },
          { name: "v", label: "Caption", type: "text" },
        ],
      },
      { name: "heroBg", label: "Background image", type: "image" },
      { name: "heroImage", label: "Foreground image", type: "image" },
    ],
  },
  products_intro: {
    title: "Products — heading",
    desc: "The intro text above the product cards.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label)", type: "text" },
      { name: "titleHtml", label: "Heading", type: "textarea", hint: GRADIENT_HINT },
      { name: "subtitle", label: "Sub-text", type: "textarea" },
    ],
  },
  services_intro: {
    title: "Services — heading",
    desc: "The intro text beside the service cards.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label)", type: "text" },
      { name: "titleHtml", label: "Heading", type: "textarea", hint: GRADIENT_HINT },
      { name: "subtitle", label: "Sub-text", type: "textarea" },
    ],
  },
  about: {
    title: "About",
    desc: "The story, stats and the “How we work” steps.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label)", type: "text" },
      { name: "titleHtml", label: "Heading", type: "textarea", hint: GRADIENT_HINT },
      { name: "p1", label: "Paragraph 1", type: "textarea" },
      { name: "p2", label: "Paragraph 2", type: "textarea" },
      {
        name: "stats",
        label: "Stats (the 4 numbers)",
        type: "list",
        itemLabel: "Stat",
        fields: [
          { name: "k", label: "Number", type: "text" },
          { name: "v", label: "Caption", type: "text" },
        ],
      },
      { name: "stepsTitle", label: "Steps box title", type: "text" },
      {
        name: "steps",
        label: "How we work — steps",
        type: "list",
        itemLabel: "Step",
        fields: [
          { name: "n", label: "Number", type: "text" },
          { name: "t", label: "Title", type: "text" },
          { name: "d", label: "Description", type: "textarea" },
        ],
      },
    ],
  },
  testimonials_intro: {
    title: "Testimonials — heading",
    desc: "The intro text above the quotes.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label)", type: "text" },
      { name: "titleHtml", label: "Heading", type: "textarea", hint: GRADIENT_HINT },
    ],
  },
  contact: {
    title: "Contact",
    desc: "Contact heading and the info card details.",
    fields: [
      { name: "eyebrow", label: "Eyebrow (small label)", type: "text" },
      { name: "titleHtml", label: "Heading", type: "textarea", hint: GRADIENT_HINT },
      { name: "subtitle", label: "Sub-text", type: "textarea" },
      { name: "name", label: "Card — company name", type: "text" },
      { name: "cityLine", label: "Card — city line", type: "text" },
      { name: "office", label: "Office address", type: "text" },
      { name: "email", label: "Email", type: "text" },
      { name: "phone", label: "Phone", type: "text" },
      { name: "web", label: "Website", type: "text" },
      { name: "founded", label: "Founded", type: "text" },
    ],
  },
  footer: {
    title: "Footer",
    desc: "Copyright line and footer links.",
    fields: [
      { name: "copyright", label: "Copyright text", type: "text", hint: "Use {year} to insert the current year automatically." },
      {
        name: "links",
        label: "Footer links",
        type: "list",
        itemLabel: "Link",
        fields: [
          { name: "label", label: "Label", type: "text" },
          { name: "href", label: "Link", type: "text" },
        ],
      },
      { name: "handle", label: "Social handle", type: "text" },
    ],
  },
};

const collectionSchemas = {
  products: {
    title: "Products",
    desc: "Your portfolio cards. Add, edit, reorder or remove.",
    titleField: "name",
    subField: "tag",
    imageField: "image",
    fields: [
      { name: "name", label: "Name", type: "text" },
      { name: "tag", label: "Tag (e.g. Legal · AI)", type: "text" },
      { name: "descr", label: "Description", type: "textarea" },
      { name: "features", label: "Feature chips", type: "stringlist" },
      { name: "href", label: "Link", type: "text" },
      { name: "cta", label: "Button text", type: "text" },
      { name: "image", label: "Image", type: "image" },
      { name: "sort", label: "Sort order (lower = first)", type: "text" },
    ],
  },
  services: {
    title: "Services",
    desc: "The cards in the “What we do” section.",
    titleField: "title",
    subField: "descr",
    iconField: "icon",
    fields: [
      { name: "icon", label: "Icon (emoji)", type: "text" },
      { name: "title", label: "Title", type: "text" },
      { name: "descr", label: "Description", type: "textarea" },
      { name: "sort", label: "Sort order (lower = first)", type: "text" },
    ],
  },
  testimonials: {
    title: "Testimonials",
    desc: "Customer and student quotes.",
    titleField: "author",
    subField: "role",
    fields: [
      { name: "quote", label: "Quote", type: "textarea" },
      { name: "author", label: "Author", type: "text" },
      { name: "role", label: "Role / context", type: "text" },
      { name: "sort", label: "Sort order (lower = first)", type: "text" },
    ],
  },
};

// ============================================================
//  Build the navigation + views
// ============================================================
const SECTIONS = [
  { id: "brand", kind: "settings", label: "Brand" },
  { id: "nav", kind: "settings", label: "Navigation" },
  { id: "hero", kind: "settings", label: "Hero" },
  { id: "products_intro", kind: "settings", label: "Products heading" },
  { id: "products", kind: "collection", label: "Products" },
  { id: "services_intro", kind: "settings", label: "Services heading" },
  { id: "services", kind: "collection", label: "Services" },
  { id: "about", kind: "settings", label: "About" },
  { id: "testimonials_intro", kind: "settings", label: "Testimonials heading" },
  { id: "testimonials", kind: "collection", label: "Testimonials" },
  { id: "contact", kind: "settings", label: "Contact" },
  { id: "footer", kind: "settings", label: "Footer" },
];

let SETTINGS = {};

function buildNav() {
  const nav = $("nav");
  nav.innerHTML = "";
  SECTIONS.forEach((sec) => {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.textContent = sec.label;
    btn.onclick = () => showView(sec.id);
    btn.dataset.sec = sec.id;
    nav.appendChild(btn);
  });
}

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.querySelectorAll(".nav-item[data-sec]").forEach((b) =>
    b.classList.toggle("active", b.dataset.sec === id)
  );
  const view = $("view-" + id);
  if (view) view.classList.add("active");
  $("sidebar").classList.remove("open");
}

// ----- Settings view -----
function buildSettingsView(sec) {
  const schema = settingsSchemas[sec.id];
  const view = document.createElement("section");
  view.className = "view";
  view.id = "view-" + sec.id;

  view.innerHTML = `
    <div class="view-head">
      <h2>${schema.title}</h2>
      <p>${schema.desc}</p>
    </div>`;

  const card = document.createElement("div");
  card.className = "card";
  const formData = JSON.parse(JSON.stringify(SETTINGS[sec.id] || {}));
  const fieldsWrap = document.createElement("div");
  buildFields(fieldsWrap, schema.fields, formData);
  card.appendChild(fieldsWrap);

  const save = document.createElement("button");
  save.className = "btn btn-primary inline";
  save.style.marginTop = "1.25rem";
  save.textContent = "Save changes";
  save.onclick = async () => {
    save.textContent = "Saving…";
    try {
      await api("PUT", "/api/settings/" + sec.id, formData);
      SETTINGS[sec.id] = JSON.parse(JSON.stringify(formData));
      toast("Saved");
    } catch (e) {
      toast(e.message, "err");
    }
    save.textContent = "Save changes";
  };
  card.appendChild(save);
  view.appendChild(card);
  return view;
}

// ----- Collection view -----
function buildCollectionView(sec) {
  const schema = collectionSchemas[sec.id];
  const view = document.createElement("section");
  view.className = "view";
  view.id = "view-" + sec.id;

  view.innerHTML = `
    <div class="view-head">
      <h2>${schema.title}</h2>
      <p>${schema.desc}</p>
    </div>`;

  const addBtn = document.createElement("button");
  addBtn.className = "btn btn-primary inline";
  addBtn.style.marginBottom = "1.25rem";
  addBtn.textContent = "+ Add new";
  addBtn.onclick = () => openItemModal(sec.id, null);
  view.appendChild(addBtn);

  const listBox = document.createElement("div");
  listBox.id = "list-" + sec.id;
  view.appendChild(listBox);
  return view;
}

async function refreshCollection(type) {
  const schema = collectionSchemas[type];
  const box = $("list-" + type);
  if (!box) return;
  let items = [];
  try {
    items = await api("GET", "/api/" + type);
  } catch (e) {
    toast(e.message, "err");
    return;
  }
  box.innerHTML = "";
  if (!items.length) {
    box.innerHTML = `<p style="color:var(--muted)">No items yet. Click “Add new”.</p>`;
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "item-card";

    let thumb = "";
    if (schema.imageField && item[schema.imageField]) {
      thumb = `<div class="thumb"><img src="${item[schema.imageField]}" alt=""></div>`;
    } else if (schema.iconField && item[schema.iconField]) {
      thumb = `<div class="thumb" style="display:grid;place-items:center;font-size:1.6rem">${item[schema.iconField]}</div>`;
    }

    const title = item[schema.titleField] || "(untitled)";
    const sub = (item[schema.subField] || "").toString();

    card.innerHTML = `
      ${thumb}
      <div class="meta">
        <b>${escapeHtml(title)}</b>
        <small>${escapeHtml(sub)}</small>
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
        <button class="btn btn-danger btn-sm" data-act="del">Delete</button>
      </div>`;
    card.querySelector('[data-act="edit"]').onclick = () => openItemModal(type, item);
    card.querySelector('[data-act="del"]').onclick = async () => {
      if (!confirm("Delete this item?")) return;
      try {
        await api("DELETE", `/api/${type}/${item.id}`);
        toast("Deleted");
        refreshCollection(type);
      } catch (e) {
        toast(e.message, "err");
      }
    };
    box.appendChild(card);
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ----- Item modal (create / edit) -----
function openItemModal(type, item) {
  const schema = collectionSchemas[type];
  const isNew = !item;
  const data = item ? JSON.parse(JSON.stringify(item)) : {};

  $("modal-title").textContent = (isNew ? "Add " : "Edit ") + schema.title.replace(/s$/, "");
  $("modal-error").textContent = "";
  const body = $("modal-body");
  buildFields(body, schema.fields, data);

  $("modal-save").onclick = async () => {
    $("modal-save").textContent = "Saving…";
    try {
      if (isNew) await api("POST", "/api/" + type, data);
      else await api("PUT", `/api/${type}/${item.id}`, data);
      closeModal();
      toast("Saved");
      refreshCollection(type);
    } catch (e) {
      $("modal-error").textContent = e.message;
    }
    $("modal-save").textContent = "Save";
  };

  $("modal-backdrop").classList.add("show");
}

function closeModal() {
  $("modal-backdrop").classList.remove("show");
}

// ============================================================
//  Boot
// ============================================================
async function boot() {
  buildNav();
  const views = $("views");
  views.innerHTML = "";

  // load settings
  SETTINGS = await api("GET", "/api/settings");

  SECTIONS.forEach((sec) => {
    if (sec.kind === "settings") views.appendChild(buildSettingsView(sec));
    else views.appendChild(buildCollectionView(sec));
  });

  // populate collection lists
  SECTIONS.filter((s) => s.kind === "collection").forEach((s) => refreshCollection(s.id));

  showView(SECTIONS[0].id);
  $("login-wrap").style.display = "none";
  $("app").classList.add("active");
}

// ============================================================
//  Auth
// ============================================================
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  try {
    const { token } = await api("POST", "/api/login", { password: $("password").value });
    TOKEN = token;
    localStorage.setItem("hk_token", token);
    await boot();
  } catch (err) {
    $("login-error").textContent = err.message;
  }
});

function logout() {
  TOKEN = "";
  localStorage.removeItem("hk_token");
  $("app").classList.remove("active");
  $("login-wrap").style.display = "grid";
}

$("logout-btn").onclick = async () => {
  try {
    await api("POST", "/api/logout");
  } catch {}
  logout();
};

$("change-pw-btn").onclick = () => {
  $("modal-title").textContent = "Change password";
  $("modal-error").textContent = "";
  const body = $("modal-body");
  body.innerHTML = `
    <div class="field">
      <label>New password</label>
      <input type="password" id="new-pw" placeholder="At least 8 characters" />
    </div>`;
  $("modal-save").onclick = async () => {
    try {
      await api("POST", "/api/change-password", { password: $("new-pw").value });
      closeModal();
      toast("Password changed");
    } catch (e) {
      $("modal-error").textContent = e.message;
    }
  };
  $("modal-backdrop").classList.add("show");
};

// modal controls
$("modal-cancel").onclick = closeModal;
$("modal-backdrop").addEventListener("click", (e) => {
  if (e.target === $("modal-backdrop")) closeModal();
});

// mobile sidebar
$("menu-btn").onclick = () => $("sidebar").classList.toggle("open");

// auto-login if token present
if (TOKEN) {
  boot().catch(() => logout());
}
