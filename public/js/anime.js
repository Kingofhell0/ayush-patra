/* Anime-streaming portfolio. Everything shown comes from /api/portfolio,
   i.e. whatever is saved in the admin dashboard. */

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- static config ---------- */

const BASE_ORDER = ["about", "skills", "experience", "projects", "education", "achievements", "certifications", "contact"];

const META = {
  about:          { title: "Origin Story",      label: "About",          kana: "私" },
  skills:         { title: "Skill Tree",        label: "Skills",         kana: "技" },
  experience:     { title: "The Story So Far",  label: "Experience",     kana: "経験" },
  projects:       { title: "Featured Episodes", label: "Projects",       kana: "作品" },
  education:      { title: "Academy Arc",       label: "Education",      kana: "学" },
  achievements:   { title: "Top Moments",       label: "Achievements",   kana: "功績" },
  certifications: { title: "Certified",         label: "Certifications", kana: "証" },
  contact:        { title: "To Be Continued…",  label: "Contact",        kana: "続" }
};

// Trusted constant icons (never built from user data).
const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 3H7v2H3v3a4 4 0 0 0 4 4h.4A5 5 0 0 0 11 14.9V17H8v2h8v-2h-3v-2.1A5 5 0 0 0 16.6 12H17a4 4 0 0 0 4-4V5h-4V3zM5 8V7h2v3a2 2 0 0 1-2-2zm14 0a2 2 0 0 1-2 2V7h2v1z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 3h6V6H9v1z"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.7 16.3 4.4 12l4.3-4.3-1.4-1.4L1.6 12l5.7 5.7 1.4-1.4zm6.6 0 4.3-4.3-4.3-4.3 1.4-1.4L22.4 12l-5.7 5.7-1.4-1.4z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>'
};

// Profiles ("Who's watching?"): each one re-orders the page and changes the main button.
const MODES = {
  owner: {
    sub: "The full series, in order",
    order: BASE_ORDER,
    cta: { label: "Start Watching", target: "first" },
    c: ["#f47521", "#b9490a"]
  },
  recruiter: {
    name: "Recruiter", sub: "Experience, education & credentials", icon: "briefcase",
    order: ["experience", "education", "certifications", "projects", "skills", "achievements", "about", "contact"],
    cta: { label: "View Experience", target: "experience" },
    c: ["#8b6cff", "#2a1b78"]
  },
  developer: {
    name: "Developer", sub: "Stack, projects & source code", icon: "code",
    order: ["projects", "skills", "experience", "achievements", "certifications", "education", "about", "contact"],
    cta: { label: "Browse Projects", target: "projects" },
    c: ["#35d6c4", "#0f5c55"]
  },
  fan: {
    name: "Anime Fan", sub: "The story behind the dev", icon: "star",
    order: ["about", "projects", "skills", "achievements", "experience", "education", "certifications", "contact"],
    cta: { label: "Meet the Dev", target: "about" },
    c: ["#ff5c8a", "#7f1740"]
  }
};

const SKILL_CATS = [
  ["Frontend", "#f47521"], ["Backend", "#8b6cff"], ["Databases", "#35d6c4"], ["Languages", "#ff5c8a"],
  ["Tools & Cloud", "#3da9ff"], ["Security & Networking", "#ffc23d"], ["Other", "#a7a7b2"]
];

const THUMBS = [["#ff5c8a", "#7f1740"], ["#8b6cff", "#2a1b78"], ["#35d6c4", "#0f5c55"], ["#f47521", "#6b2700"], ["#3da9ff", "#0f3a70"], ["#ffc23d", "#8c5a00"]];

/* ---------- state ---------- */

const state = {
  data: null,
  visible: {},
  mode: MODES[sessionStorage.getItem("mode")] ? sessionStorage.getItem("mode") : "",
  skillCat: "All",
  firstRender: true
};
let lastSnapshot = "";

/* ---------- helpers (textContent only: admin data is never run as HTML) ---------- */

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== "") node.textContent = text;
  return node;
}

function svgNode(markup) {
  const wrap = document.createElement("span");
  wrap.innerHTML = markup; // constant icon strings only
  return wrap.firstElementChild;
}

const safeUrl = (url) => (/^https?:\/\//i.test(url || "") ? url : "");
const pad2 = (n) => String(n).padStart(2, "0");
const firstWord = (name) => (name || "").trim().split(/\s+/)[0] || "";
const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function link(text, url, className) {
  const a = el("a", className, text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function categorize(raw) {
  const base = raw.replace(/\(.*?\)/g, "").trim().toLowerCase();
  const has = (...words) => words.some((w) => base.includes(w));
  if (has("cyber", "hack", "security", "pentest", "kali", "wireshark", "network", "owasp", "burp", "nmap", "crypto")) return "Security & Networking";
  if (has("mongo", "sql", "postgres", "sqlite", "firebase", "redis", "database", "oracle")) return "Databases";
  if (has("node", "express", "asp", "django", "flask", "spring", "laravel", "fastapi", "php")) return "Backend";
  if (has("html", "css", "javascript", "react", "vue", "angular", "tailwind", "bootstrap", "typescript", "sass", "jquery", "svelte", "figma")) return "Frontend";
  if (["c", "c++", "c#", "java", "python", "go", "rust", "kotlin", "swift", "ruby", "dart", "bash"].includes(base)) return "Languages";
  if (has("git", "render", "docker", "vscode", "linux", "aws", "vercel", "netlify", "postman", "jira", "npm", "heroku", "azure")) return "Tools & Cloud";
  return "Other";
}

/* ---------- data ---------- */

async function loadData() {
  const response = await fetch("/api/portfolio", { cache: "no-store" });
  if (!response.ok) throw new Error("API " + response.status);
  return response.json();
}

async function refresh() {
  try {
    const data = await loadData();
    const snapshot = JSON.stringify(data);
    if (snapshot === lastSnapshot) return;
    lastSnapshot = snapshot;
    render(data);
  } catch { /* keep showing what we have */ }
}

/* ---------- render: content ---------- */

function render(data) {
  state.data = data;
  const profile = data.profile || {};
  const sec = data.sections || {};
  const name = profile.name || "Portfolio";
  const first = firstWord(name);

  const v = {
    about: Boolean(sec.about && profile.objective),
    skills: Boolean(sec.skills && data.skills.length),
    experience: Boolean(sec.experience && data.experience.length),
    projects: Boolean(sec.projects && data.projects.length),
    education: Boolean(sec.education && data.education.length),
    achievements: Boolean(sec.achievements && data.achievements.length),
    certifications: Boolean(sec.certifications && data.certifications.length),
    contact: Boolean(sec.contact && (profile.email || profile.phone || profile.location))
  };
  state.visible = v;

  document.title = `${name} | Portfolio`;
  $("logoWord").textContent = first.toUpperCase() || "PORTFOLIO";
  $("heroImg").alt = `Anime-style illustration of ${name}`;
  $("footText").textContent = `© ${new Date().getFullYear()} ${name}`;

  renderHero(data, profile, v);
  renderAbout(data, profile);
  renderSkills(data.skills);
  renderExperience(data.experience);
  renderProjects(data.projects);
  renderEducation(data.education);
  renderAchievements(data.achievements);
  renderCertifications(data.certifications);
  renderContact(profile, name);

  document.querySelectorAll("[data-head]").forEach((head) => {
    const key = head.dataset.head;
    const m = META[key];
    const kana = el("span", "block-kana", m.kana);
    kana.dataset.k = key;
    const text = el("div");
    text.append(el("p", "block-label", m.label.toUpperCase()), el("h2", "", m.title));
    head.replaceChildren(kana, text);
  });

  BASE_ORDER.forEach((key) => { $(key).hidden = !v[key]; });
  layout();
  fitTitle();

  if (state.firstRender) {
    state.firstRender = false;
    setupReveal();
  }
  observeSections();
}

function renderHero(data, profile, v) {
  const words = (profile.name || "").trim().split(/\s+/).filter(Boolean);
  $("nameFirst").textContent = words[0] || "Portfolio";
  $("nameRest").textContent = words.slice(1).join(" ");
  $("nameRest").hidden = words.length < 2;

  $("heroHeadline").textContent = profile.headline || "";
  $("heroHeadline").hidden = !profile.headline;

  const meta = $("heroMeta");
  const items = [];
  if (profile.location) items.push(profile.location);
  if (v.education) {
    const e = data.education[0];
    items.push([e.year, e.degree].filter(Boolean).join(" · "));
  }
  meta.replaceChildren(...items.filter(Boolean).map((t) => el("li", "", t)));

  const genres = $("heroGenres");
  const top = v.skills ? data.skills.slice(0, 3) : [];
  genres.replaceChildren(...top.map((s) => el("span", "", s)));
  genres.hidden = !top.length;

  const synopsis = $("heroSynopsis");
  synopsis.textContent = profile.objective || "";
  synopsis.hidden = !profile.objective;

  renderCodeCard(data, profile, v);
}

function renderCodeCard(data, profile, v) {
  const lines = [];
  const S = (cls, text) => { const s = el("span", cls, text); return s; };
  lines.push([S("kw", "const "), S("var", "dev"), S("pun", " = {")]);
  lines.push([S("pun", "  "), S("key", "name"), S("pun", ": "), S("str", JSON.stringify(firstWord(profile.name))), S("pun", ",")]);
  if (v.skills) {
    const stack = data.skills.slice(0, 3);
    const parts = [];
    stack.forEach((s, i) => { if (i) parts.push(S("pun", ", ")); parts.push(S("str", JSON.stringify(s))); });
    lines.push([S("pun", "  "), S("key", "stack"), S("pun", ": ["), ...parts, S("pun", "],")]);
  }
  if (v.projects) lines.push([S("pun", "  "), S("key", "projects"), S("pun", ": "), S("num", String(data.projects.length)), S("pun", ",")]);
  if (profile.location) lines.push([S("pun", "  "), S("key", "base"), S("pun", ": "), S("str", JSON.stringify(profile.location.split(",")[0])), S("pun", ",")]);
  lines.push([S("pun", "};")]);

  const body = $("codeBody");
  body.replaceChildren();
  lines.forEach((parts, i) => {
    parts.forEach((p) => body.appendChild(p));
    if (i < lines.length - 1) body.appendChild(document.createTextNode("\n"));
  });
}

// Keep the giant name inside its column whatever font actually loaded (or fails to).
function fitTitle() {
  const box = document.querySelector(".hero-copy");
  ["nameFirst", "nameRest"].forEach((id) => {
    const node = $(id);
    if (node.hidden) return;
    node.style.fontSize = "";
    const avail = box.clientWidth;
    const need = node.scrollWidth;
    if (need > avail) node.style.fontSize = (parseFloat(getComputedStyle(node).fontSize) * (avail / need) * 0.98).toFixed(1) + "px";
  });
}
addEventListener("resize", fitTitle);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTitle);

function renderAbout(data, profile) {
  $("aboutText").textContent = profile.objective || "";

  const facts = [];
  if (profile.location) facts.push(["Location", profile.location]);
  if (state.visible.education) {
    const e = data.education[0];
    facts.push(["Education", [e.degree, e.year].filter(Boolean).join(" · ")]);
  }
  if (state.visible.experience) {
    const e = data.experience[0];
    facts.push(["Currently", [e.role, e.company].filter(Boolean).join(" @ ")]);
  }
  if (state.visible.contact && profile.email) facts.push(["Email", profile.email]);

  const dl = $("aboutFacts");
  dl.replaceChildren();
  facts.forEach(([k, val]) => { dl.append(el("dt", "", k), el("dd", "", val)); });
  dl.hidden = !facts.length;

  const genres = $("aboutGenres");
  const top = state.visible.skills ? data.skills.slice(0, 6) : [];
  genres.replaceChildren(...top.map((s) => el("li", "", s)));
}

function renderSkills(skills) {
  const groups = new Map();
  skills.forEach((raw) => {
    const cat = categorize(raw);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(raw);
  });

  const cats = SKILL_CATS.filter(([name]) => groups.has(name));
  const names = ["All", ...cats.map(([n]) => n)];
  if (!names.includes(state.skillCat)) state.skillCat = "All";
  const color = Object.fromEntries(SKILL_CATS);

  const tabs = $("skillTabs");
  tabs.replaceChildren(
    ...names.map((n) => {
      const b = el("button", "stab");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(n === state.skillCat));
      b.append(el("span", "", n), el("span", "n", String(n === "All" ? skills.length : groups.get(n).length)));
      b.addEventListener("click", () => { state.skillCat = n; renderSkills(skills); });
      return b;
    })
  );

  const shown = state.skillCat === "All" ? skills : groups.get(state.skillCat) || [];
  $("skillGrid").replaceChildren(
    ...shown.map((raw) => {
      const tile = el("div", "skill");
      tile.style.setProperty("--cat", color[categorize(raw)]);
      const level = (raw.match(/\(([^)]+)\)/) || [])[1];
      tile.appendChild(el("b", "", raw.replace(/\s*\(.*?\)\s*/g, "").trim() || raw));
      if (level) tile.appendChild(el("em", "", level));
      return tile;
    })
  );
}

function renderExperience(items) {
  $("experienceList").replaceChildren(
    ...items.map((item, i) => {
      const row = el("article", "arc");
      const rail = el("div", "arc-rail");
      rail.append(el("div", "n", pad2(i + 1)), el("small", "", "ARC"));

      const card = el("div", "arc-card");
      card.appendChild(el("h3", "", item.role));
      const org = [item.company, item.location].filter(Boolean).join(" · ");
      if (org) card.appendChild(el("p", "arc-org", org));
      if (item.period) card.appendChild(el("span", "arc-per", item.period));
      if (item.description) card.appendChild(el("p", "arc-desc", item.description));

      row.append(rail, card);
      return row;
    })
  );
}

function renderProjects(items) {
  $("projectsList").replaceChildren(
    ...items.map((item, i) => {
      const card = el("article", "ep-card");
      const [c1, c2] = THUMBS[hash(item.name || String(i)) % THUMBS.length];

      const thumb = el("div", "thumb");
      thumb.style.setProperty("--c1", c1);
      thumb.style.setProperty("--c2", c2);
      thumb.append(el("span", "big", (item.name || "?").trim().charAt(0).toUpperCase()), el("span", "epn", `EP ${pad2(i + 1)}`));

      const live = safeUrl(item.liveUrl);
      const repo = safeUrl(item.githubUrl);
      const target = live || repo;
      if (target) {
        const play = el("a", "play");
        play.href = target;
        play.target = "_blank";
        play.rel = "noopener noreferrer";
        play.setAttribute("aria-label", live ? `Open ${item.name} live` : `View ${item.name} source`);
        play.appendChild(svgNode(ICON.play));
        thumb.appendChild(play);
      }

      const stack = (item.stack || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (stack.length) thumb.appendChild(el("span", "stackbadge", stack[0]));

      const body = el("div", "ep-body");
      body.appendChild(el("h3", "", item.name));
      if (stack.length) {
        const chips = el("ul", "chips");
        stack.slice(0, 6).forEach((s) => chips.appendChild(el("li", "", s)));
        if (stack.length > 6) chips.appendChild(el("li", "", `+${stack.length - 6}`));
        body.appendChild(chips);
      }
      if (item.description) body.appendChild(el("p", "", item.description));

      const links = el("div", "ep-links");
      if (live) links.appendChild(link("Live", live));
      if (repo) links.appendChild(link("Source", repo));
      if (links.children.length) body.appendChild(links);

      card.append(thumb, body);
      return card;
    })
  );
}

function renderEducation(items) {
  $("educationList").replaceChildren(
    ...items.map((item) => {
      const card = el("article", "season");
      card.appendChild(el("h3", "", item.degree));
      if (item.institution) card.appendChild(el("p", "", item.institution));
      const tags = el("div", "tags");
      if (item.year) tags.appendChild(el("span", "tag hot", item.year));
      if (item.result) tags.appendChild(el("span", "tag", item.result));
      if (tags.children.length) card.appendChild(tags);
      return card;
    })
  );
}

function renderAchievements(items) {
  $("achievementsList").replaceChildren(
    ...items.map((item) => {
      const card = el("article", "moment");
      card.appendChild(svgNode(ICON.trophy));
      card.appendChild(el("h3", "", item.title));
      if (item.year) card.appendChild(el("span", "tag hot", item.year));
      if (item.description) card.appendChild(el("p", "", item.description));
      return card;
    })
  );
}

function renderCertifications(items) {
  $("certificationsList").replaceChildren(
    ...items.map((item) => {
      const card = el("article", "cert");
      card.appendChild(el("h3", "", item.name));
      const sub = [item.issuer, item.year].filter(Boolean).join(" · ");
      if (sub) card.appendChild(el("span", "iss", sub));
      if (safeUrl(item.credentialUrl)) card.appendChild(link("Verify credential ↗", safeUrl(item.credentialUrl), "verify"));
      return card;
    })
  );
}

async function copyText(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = "Copied";
  } catch {
    button.textContent = "Ctrl+C";
  }
  setTimeout(() => (button.textContent = "Copy"), 1600);
}

function renderContact(profile, name) {
  $("tbcSub").textContent = "Next episode: your idea, my code. Say hello.";
  $("creditsName").textContent = `${name} · thanks for watching`;

  const rows = [];
  if (profile.email) rows.push(["Email", profile.email, `mailto:${profile.email}`, true]);
  if (profile.phone) rows.push(["Phone", profile.phone, `tel:${profile.phone.replace(/[^\d+]/g, "")}`, true]);
  if (profile.location) rows.push(["Location", profile.location, "", false]);

  $("contactList").replaceChildren(
    ...rows.map(([label, value, href, copy]) => {
      const box = el("div", "channel");
      const text = el("div");
      text.appendChild(el("small", "", label));
      if (href) { const a = el("a", "", value); a.href = href; text.appendChild(a); }
      else text.appendChild(el("span", "", value));
      box.appendChild(text);
      if (copy) {
        const b = el("button", "", "Copy");
        b.type = "button";
        b.setAttribute("aria-label", `Copy ${label}`);
        b.addEventListener("click", () => copyText(value, b));
        box.appendChild(b);
      }
      return box;
    })
  );
}

/* ---------- layout: mode-dependent order, nav, shelf, hero button ---------- */

function currentOrder() {
  const mode = MODES[state.mode] || MODES.owner;
  return mode.order.filter((k) => state.visible[k]);
}

function layout() {
  if (!state.data) return;
  const order = currentOrder();
  const mode = MODES[state.mode] || MODES.owner;
  const first = firstWord(state.data.profile.name);

  // real page order
  $("top").style.order = 0;
  $("explore").style.order = 1;
  BASE_ORDER.forEach((k) => { $(k).style.order = 2 + (order.indexOf(k) < 0 ? 99 : order.indexOf(k)); });

  // profile chip in the nav
  renderAvatar($("pfAvatar"), state.mode || "owner");
  $("pfName").textContent = state.mode ? (state.mode === "owner" ? first : mode.name) : "Profile";

  // nav links
  const nav = $("navLinks");
  const home = el("a", "", "Home");
  home.href = "#top";
  home.dataset.target = "top";
  nav.replaceChildren(home, ...order.map((k) => {
    const a = el("a", "", META[k].label);
    a.href = `#${k}`;
    a.dataset.target = k;
    return a;
  }));
  nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));

  // shelf
  const counts = {
    about: "Meet the dev",
    skills: plural(state.data.skills.length, "skill"),
    experience: plural(state.data.experience.length, "role"),
    projects: plural(state.data.projects.length, "project"),
    education: plural(state.data.education.length, "record"),
    achievements: plural(state.data.achievements.length, "entry").replace("entrys", "entries"),
    certifications: plural(state.data.certifications.length, "certificate"),
    contact: "Say hello"
  };
  const shelf = $("shelf");
  shelf.replaceChildren(
    ...order.map((k, i) => {
      const tile = el("a", "tile");
      tile.href = `#${k}`;
      tile.dataset.k = k;
      tile.append(el("span", "k", META[k].kana), el("span", "ep", `EP ${pad2(i + 1)}`), el("h3", "", META[k].title), el("p", "", counts[k]));
      return tile;
    })
  );
  $("explore").hidden = order.length === 0;

  // hero buttons
  const target = mode.cta.target === "first" ? order.find((k) => k !== "contact") || order[0] : state.visible[mode.cta.target] ? mode.cta.target : order[0];
  const cta = $("heroCta");
  cta.replaceChildren();
  if (target) {
    const play = el("a", "btn btn-primary");
    play.href = `#${target}`;
    play.append(svgNode(ICON.play.replace("<svg", '<svg width="16" height="16" fill="currentColor"')), document.createTextNode(mode.cta.label));
    cta.appendChild(play);
  }
  if (state.visible.contact) {
    const c = el("a", "btn btn-ghost", "+ Contact");
    c.href = "#contact";
    cta.appendChild(c);
  }
}

function renderAvatar(node, key) {
  const mode = MODES[key] || MODES.owner;
  node.replaceChildren();
  node.style.setProperty("--c1", mode.c[0]);
  node.style.setProperty("--c2", mode.c[1]);
  if (key === "owner" || !mode.icon) {
    const img = document.createElement("img");
    img.src = "/img/hero.png";
    img.alt = "";
    node.appendChild(img);
  } else {
    node.appendChild(svgNode(ICON[mode.icon]));
  }
}

/* ---------- nav behaviour ---------- */

function closeMenu() {
  $("navLinks").classList.remove("open");
  $("menuBtn").setAttribute("aria-expanded", "false");
}
$("menuBtn").addEventListener("click", () => {
  const open = $("navLinks").classList.toggle("open");
  $("menuBtn").setAttribute("aria-expanded", String(open));
});

const nav = $("nav");
const onScroll = () => nav.classList.toggle("solid", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

let spy;
function observeSections() {
  if (spy) spy.disconnect();
  spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        document.querySelectorAll("#navLinks a").forEach((a) => a.classList.toggle("active", a.dataset.target === entry.target.id));
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  [$("top"), ...BASE_ORDER.map($)].forEach((s) => { if (!s.hidden) spy.observe(s); });
}

/* shelf arrows */
$("shelfPrev").addEventListener("click", () => $("shelf").scrollBy({ left: -$("shelf").clientWidth * 0.8, behavior: "smooth" }));
$("shelfNext").addEventListener("click", () => $("shelf").scrollBy({ left: $("shelf").clientWidth * 0.8, behavior: "smooth" }));

/* ---------- scroll reveal (first render only; later live updates appear instantly) ---------- */

function setupReveal() {
  if (reduceMotion) return;
  const targets = document.querySelectorAll(".block-head, .arc, .ep-card, .season, .moment, .cert, .about-grid, .skill-tree, .credits .wrap");
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
    { rootMargin: "0px 0px -8% 0px" }
  );
  targets.forEach((t) => { t.classList.add("reveal"); io.observe(t); });
}

/* ---------- hero: gentle parallax on the portrait ---------- */

if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
  const hero = $("top");
  const art = $("heroArt");
  hero.addEventListener("pointermove", (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    art.style.transform = `translate3d(${(-x * 16).toFixed(1)}px, ${(-y * 8).toFixed(1)}px, 0)`;
  });
  hero.addEventListener("pointerleave", () => { art.style.transform = ""; });
}

/* ---------- intro: splash → "Who's watching?" ---------- */

async function runSplash(name) {
  const splash = $("splash");
  const word = (firstWord(name) || "Portfolio").toUpperCase();
  $("splashName").replaceChildren(
    ...[...word].map((ch, i) => {
      const s = el("span", "", ch);
      s.style.animationDelay = `${i * 70}ms`;
      return s;
    })
  );
  splash.hidden = false;

  await new Promise((resolve) => {
    const done = () => { removeEventListener("keydown", done); splash.removeEventListener("click", done); resolve(); };
    setTimeout(done, 2400);
    addEventListener("keydown", done, { once: true });
    splash.addEventListener("click", done, { once: true });
  });

  splash.classList.add("out");
  await sleep(600);
  splash.hidden = true;
}

function openPicker() {
  return new Promise((resolve) => {
    const picker = $("picker");
    const list = $("profiles");
    const first = firstWord(state.data ? state.data.profile.name : "") || "Me";

    const keys = Object.keys(MODES);
    list.replaceChildren(
      ...keys.map((key) => {
        const m = MODES[key];
        const b = el("button", "profile");
        b.type = "button";
        const art = el("span", "pf-art");
        art.style.setProperty("--c1", m.c[0]);
        art.style.setProperty("--c2", m.c[1]);
        if (key === "owner") {
          const img = document.createElement("img");
          img.src = "/img/hero.png";
          img.alt = "";
          art.appendChild(img);
        } else {
          art.appendChild(svgNode(ICON[m.icon]));
        }
        b.append(art, el("strong", "", key === "owner" ? first : m.name), el("small", "", m.sub));
        b.addEventListener("click", () => choose(key));
        return b;
      })
    );

    function onKey(e) { if (e.key === "Escape" && state.mode) choose(state.mode); }
    function choose(key) {
      removeEventListener("keydown", onKey);
      state.mode = key;
      sessionStorage.setItem("mode", key);
      layout();
      picker.classList.add("out");
      setTimeout(() => {
        picker.hidden = true;
        picker.classList.remove("out");
        document.body.classList.remove("locked");
        resolve();
      }, 340);
    }

    addEventListener("keydown", onKey);
    document.body.classList.add("locked");
    picker.hidden = false;
    const firstProfile = list.querySelector("button.profile");
    if (firstProfile) firstProfile.focus({ preventScroll: true });
  });
}

$("profileBtn").addEventListener("click", () => { closeMenu(); openPicker(); });

/* ---------- boot ---------- */

async function boot() {
  try {
    const data = await loadData();
    lastSnapshot = JSON.stringify(data);
    render(data);
  } catch {
    $("nameFirst").textContent = "Offline";
    $("heroSynopsis").textContent = "Could not load the portfolio. Check that the server and database are running, then reload.";
    $("heroSynopsis").hidden = false;
    $("heroGenres").hidden = true;
    $("nameRest").hidden = true;
  }

  const name = state.data ? state.data.profile.name : "Portfolio";
  if (!sessionStorage.getItem("splashSeen") && !reduceMotion) await runSplash(name);
  sessionStorage.setItem("splashSeen", "1");

  if (!state.mode && state.data) await openPicker();
  else layout();

  document.body.classList.remove("booting");
  setInterval(() => { if (!document.hidden) refresh(); }, 20000);
  addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
}

boot();
