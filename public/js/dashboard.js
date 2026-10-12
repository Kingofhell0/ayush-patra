// Session lives only in this tab. Closed the tab / reopened the browser?
// The flag is gone, so clear the cookie and go back to the login page.
if (!sessionStorage.getItem("adminSession")) {
  fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.replace("/admin"));
  throw new Error("Not logged in");
}

// Back/forward cache could show a stale dashboard after logout; re-check on restore.
window.addEventListener("pageshow", (event) => {
  if (event.persisted && !sessionStorage.getItem("adminSession")) window.location.replace("/admin");
});

let portfolio = null;

const labels = {
  dashboard: "Dashboard",
  profile: "Profile",
  skills: "Skills",
  experience: "Experience",
  projects: "Projects",
  education: "Education",
  achievements: "Achievements",
  certifications: "Certifications",
  sections: "Sections",
  settings: "Settings",
  about: "About",
  contact: "Contact"
};

// Describes each list section: form fields + how a card is displayed.
const entities = {
  experience: {
    singular: "Experience",
    empty: "Add your first work experience.",
    title: (i) => i.role,
    subtitle: (i) => [i.company, i.location].filter(Boolean).join(" · "),
    meta: (i) => i.period,
    body: (i) => i.description,
    fields: [
      { key: "role", label: "Role / Title", required: true },
      { key: "company", label: "Company", required: true },
      { key: "period", label: "Period (e.g. Jan 2026 – Present)" },
      { key: "location", label: "Location" },
      { key: "description", label: "Description", type: "textarea" }
    ]
  },
  projects: {
    singular: "Project",
    empty: "Add your first project.",
    title: (i) => i.name,
    subtitle: (i) => i.stack,
    meta: () => "",
    body: (i) => i.description,
    links: (i) => [["Live", i.liveUrl], ["GitHub", i.githubUrl]],
    fields: [
      { key: "name", label: "Project name", required: true },
      { key: "stack", label: "Tech stack (comma separated)" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "liveUrl", label: "Live URL", type: "url" },
      { key: "githubUrl", label: "GitHub URL", type: "url" }
    ]
  },
  education: {
    singular: "Education",
    empty: "Add your first education record.",
    title: (i) => i.degree,
    subtitle: (i) => i.institution,
    meta: (i) => [i.year, i.result].filter(Boolean).join(" · "),
    body: () => "",
    fields: [
      { key: "degree", label: "Degree / Course", required: true },
      { key: "institution", label: "Institution", required: true },
      { key: "year", label: "Year" },
      { key: "result", label: "Result (CGPA / %)" }
    ]
  },
  achievements: {
    singular: "Achievement",
    empty: "No achievements yet. Add one, then turn the section on under Sections.",
    title: (i) => i.title,
    subtitle: () => "",
    meta: (i) => i.year,
    body: (i) => i.description,
    fields: [
      { key: "title", label: "Title", required: true },
      { key: "year", label: "Year" },
      { key: "description", label: "Description", type: "textarea" }
    ]
  },
  certifications: {
    singular: "Certification",
    empty: "No certifications yet. Add one, then turn the section on under Sections.",
    title: (i) => i.name,
    subtitle: (i) => i.issuer,
    meta: (i) => i.year,
    body: () => "",
    links: (i) => [["Credential", i.credentialUrl]],
    fields: [
      { key: "name", label: "Certification name", required: true },
      { key: "issuer", label: "Issued by" },
      { key: "year", label: "Year" },
      { key: "credentialUrl", label: "Credential URL", type: "url" }
    ]
  }
};

/* ---------- helpers ---------- */

const $ = (id) => document.getElementById(id);

async function api(url, method = "GET", body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });

  if (response.status === 401) {
    sessionStorage.removeItem("adminSession");
    window.location.href = "/admin";
    throw new Error("Session expired");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong");
  return data;
}

let toastTimer;
function toast(text, isError = false) {
  const el = $("toast");
  el.textContent = text;
  el.className = `toast show${isError ? " error" : ""}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = "toast"), 2600);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text; // textContent keeps user data from being run as HTML
  return node;
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? url : "";
}

/* ---------- load + render ---------- */

async function loadDashboard() {
  try {
    const result = await api("/api/admin/dashboard");
    portfolio = result.data;

    $("adminName").textContent = result.admin.name;
    $("welcomeName").textContent = result.admin.name;

    updateCounts();
    populateProfile();
    populateSkills();
    populateSections();
    Object.keys(entities).forEach(renderList);
  } catch (error) {
    if (error.message !== "Session expired") toast(error.message, true);
  }
}

function updateCounts() {
  ["skills", ...Object.keys(entities)].forEach((key) => {
    $(`${key}Count`).textContent = portfolio[key].length;
  });

  $("previewName").textContent = portfolio.profile.name || "—";
  $("previewLocation").textContent = portfolio.profile.location || "—";
  $("previewEmail").textContent = portfolio.profile.email || "—";
}

function populateProfile() {
  $("profileName").value = portfolio.profile.name || "";
  $("profileHeadline").value = portfolio.profile.headline || "";
  $("profileLocation").value = portfolio.profile.location || "";
  $("profileEmail").value = portfolio.profile.email || "";
  $("profilePhone").value = portfolio.profile.phone || "";
  $("profileObjective").value = portfolio.profile.objective || "";
}

function populateSkills() {
  $("skillsInput").value = portfolio.skills.join("\n");
}

function populateSections() {
  const container = $("sectionToggles");
  container.innerHTML = "";

  Object.entries(portfolio.sections).forEach(([key, enabled]) => {
    const row = el("label", "toggle-row");
    const name = el("span", "", labels[key] || key);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = enabled;

    input.addEventListener("change", async () => {
      const wanted = input.checked;
      try {
        const data = await api("/api/admin/sections", "PUT", { ...portfolio.sections, [key]: wanted });
        portfolio.sections = data.sections;
        toast(`${labels[key] || key} ${wanted ? "shown" : "hidden"}`);
      } catch (error) {
        input.checked = !wanted;
        toast(error.message, true);
      }
    });

    row.append(name, input);
    container.appendChild(row);
  });
}

function renderList(key) {
  const config = entities[key];
  const list = $(`${key}List`);
  const items = portfolio[key];
  list.innerHTML = "";

  if (!items.length) {
    const empty = el("div", "empty-state");
    empty.append(el("h3", "", `No ${labels[key]}`), el("p", "", config.empty));
    list.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const card = el("article", "item-card");
    const info = el("div", "item-info");

    info.appendChild(el("h3", "", config.title(item) || "Untitled"));
    const subtitle = config.subtitle(item);
    if (subtitle) info.appendChild(el("p", "item-sub", subtitle));
    const meta = config.meta(item);
    if (meta) info.appendChild(el("p", "item-meta", meta));
    const body = config.body(item);
    if (body) info.appendChild(el("p", "item-body", body));

    if (config.links) {
      const links = config.links(item).filter(([, url]) => safeUrl(url));
      if (links.length) {
        const row = el("p", "item-links");
        links.forEach(([text, url]) => {
          const a = el("a", "", `${text} ↗`);
          a.href = safeUrl(url);
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          row.appendChild(a);
        });
        info.appendChild(row);
      }
    }

    const actions = el("div", "item-actions");
    const up = el("button", "icon-btn", "↑");
    const down = el("button", "icon-btn", "↓");
    const edit = el("button", "icon-btn", "Edit");
    const del = el("button", "icon-btn danger", "Delete");
    up.title = "Move up";
    down.title = "Move down";
    up.disabled = index === 0;
    down.disabled = index === items.length - 1;

    up.addEventListener("click", () => move(key, index, -1));
    down.addEventListener("click", () => move(key, index, 1));
    edit.addEventListener("click", () => openDialog(key, item));
    del.addEventListener("click", () => remove(key, item));

    actions.append(up, down, edit, del);
    card.append(info, actions);
    list.appendChild(card);
  });
}

function setItems(key, items) {
  portfolio[key] = items;
  renderList(key);
  updateCounts();
}

async function move(key, index, direction) {
  const order = portfolio[key].map((item) => item._id);
  const target = index + direction;
  [order[index], order[target]] = [order[target], order[index]];

  try {
    const data = await api(`/api/admin/${key}/reorder`, "PUT", { order });
    setItems(key, data.items);
  } catch (error) {
    toast(error.message, true);
  }
}

async function remove(key, item) {
  const name = entities[key].title(item) || "this item";
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

  try {
    const data = await api(`/api/admin/${key}/${item._id}`, "DELETE");
    setItems(key, data.items);
    toast("Deleted");
  } catch (error) {
    toast(error.message, true);
  }
}

/* ---------- add / edit dialog ---------- */

const dialog = $("itemDialog");
let dialogState = null;

function openDialog(key, item) {
  const config = entities[key];
  dialogState = { key, id: item ? item._id : null };

  $("dialogTitle").textContent = `${item ? "Edit" : "Add"} ${config.singular}`;
  $("dialogMessage").textContent = "";

  const fields = $("dialogFields");
  fields.innerHTML = "";

  config.fields.forEach((field) => {
    const label = el("label", "", field.label + (field.required ? " *" : ""));
    label.htmlFor = `field_${field.key}`;

    const input = field.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    input.id = `field_${field.key}`;
    input.name = field.key;
    if (field.type === "textarea") input.rows = 4;
    else input.type = field.type || "text";
    if (field.required) input.required = true;
    input.value = item ? item[field.key] || "" : "";

    fields.append(label, input);
  });

  dialog.showModal();
  fields.querySelector("input, textarea").focus();
}

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => openDialog(button.dataset.add));
});

$("dialogCancel").addEventListener("click", () => dialog.close());

// Clicking the dimmed backdrop closes the dialog too.
dialog.addEventListener("mousedown", (event) => {
  if (event.target === dialog) dialog.close();
});

$("itemForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!dialogState) return;

  const { key, id } = dialogState;
  const payload = {};
  entities[key].fields.forEach((field) => {
    payload[field.key] = $(`field_${field.key}`).value;
  });

  const save = $("dialogSave");
  save.disabled = true;

  try {
    const data = id
      ? await api(`/api/admin/${key}/${id}`, "PUT", payload)
      : await api(`/api/admin/${key}`, "POST", payload);

    setItems(key, data.items);
    dialog.close();
    toast(id ? "Saved" : "Added");
  } catch (error) {
    $("dialogMessage").textContent = error.message;
  } finally {
    save.disabled = false;
  }
});

/* ---------- navigation ---------- */

function showSection(key) {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.section === key);
  });
  document.querySelectorAll(".page-section").forEach((section) => {
    section.classList.toggle("active-section", section.id === `${key}Section`);
  });
  $("pageTitle").textContent = labels[key] || "Dashboard";
  history.replaceState(null, "", `#${key}`);
  window.scrollTo({ top: 0 });
}

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => showSection(button.dataset.section));
});

// Keep the current page after a refresh.
const startSection = location.hash.slice(1);
if (labels[startSection] && $(`${startSection}Section`)) showSection(startSection);

/* ---------- forms ---------- */

$("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const data = await api("/api/admin/profile", "PUT", {
      name: $("profileName").value,
      headline: $("profileHeadline").value,
      location: $("profileLocation").value,
      email: $("profileEmail").value,
      phone: $("profilePhone").value,
      objective: $("profileObjective").value
    });

    portfolio.profile = data.profile;
    updateCounts();
    $("profileMessage").textContent = "";
    toast(data.message);
  } catch (error) {
    $("profileMessage").textContent = error.message;
  }
});

$("skillsForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const skills = $("skillsInput").value
    .split("\n")
    .map((skill) => skill.trim())
    .filter(Boolean);

  try {
    const data = await api("/api/admin/skills", "PUT", { skills });
    portfolio.skills = data.skills;
    populateSkills();
    updateCounts();
    $("skillsMessage").textContent = "";
    toast(data.message);
  } catch (error) {
    $("skillsMessage").textContent = error.message;
  }
});

/* ---------- security settings ---------- */

async function loadSecurity() {
  try {
    const sec = await api("/api/admin/account/security");
    $("secEmail").textContent = sec.email;
    $("secTotp").textContent = sec.totpEnabled ? "ON ✔" : "OFF";
    $("secPrev").textContent = sec.previousLogin
      ? `${new Date(sec.previousLogin.at).toLocaleString()} · ${sec.previousLogin.ip}`
      : "No earlier login recorded";

    // Don't hide the setup key while the user is in the middle of enabling 2FA.
    const settingUp = !sec.totpEnabled && !$("totpEnableForm").hidden;
    $("totpSetupForm").hidden = sec.totpEnabled || settingUp;
    $("totpEnableForm").hidden = sec.totpEnabled || !settingUp;
    $("totpDisableForm").hidden = !sec.totpEnabled;
  } catch (error) {
    if (error.message !== "Session expired") toast(error.message, true);
  }
}

// Runs a security action, shows the message under the form and clears the password boxes.
function secureForm(formId, messageId, url, getBody, after) {
  $(formId).addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = $(messageId);
    note.textContent = "";

    try {
      const data = await api(url, "POST", getBody());
      $(formId).reset();
      toast(data.message || "Done");
      if (after) await after(data);
      await loadSecurity();
    } catch (error) {
      note.textContent = error.message;
    }
  });
}

secureForm("emailForm", "emailMessage", "/api/admin/account/email",
  () => ({ newEmail: $("newEmail").value, currentPassword: $("emailPassword").value }));

secureForm("passwordForm", "passwordMessage", "/api/admin/account/password",
  () => ({ currentPassword: $("currentPassword").value, newPassword: $("newPassword").value }));

secureForm("revokeForm", "revokeMessage", "/api/admin/account/sessions/revoke",
  () => ({ currentPassword: $("revokePassword").value }));

secureForm("totpSetupForm", "totpMessage", "/api/admin/account/2fa/setup",
  () => ({ currentPassword: $("totpSetupPassword").value }),
  (data) => {
    $("totpSecret").textContent = data.secret.match(/.{1,4}/g).join(" ");
    $("totpSecret").dataset.raw = data.secret;
    $("totpLink").href = data.otpauth;
    $("totpSetupForm").hidden = true;
    $("totpEnableForm").hidden = false;
    $("totpEnableCode").focus();
  });

secureForm("totpEnableForm", "totpMessage", "/api/admin/account/2fa/enable",
  () => ({ code: $("totpEnableCode").value }));

secureForm("totpDisableForm", "totpMessage", "/api/admin/account/2fa/disable",
  () => ({ currentPassword: $("totpDisablePassword").value, code: $("totpDisableCode").value }));

$("copySecret").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("totpSecret").dataset.raw);
    toast("Key copied");
  } catch {
    toast("Select the key and copy it manually", true);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  sessionStorage.removeItem("adminSession");
  window.location.replace("/admin");
});

loadDashboard();
loadSecurity();
