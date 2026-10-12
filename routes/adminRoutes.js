const express = require("express");
const mongoose = require("mongoose");
const PortfolioData = require("../models/PortfolioData");
const requireAuth = require("../middleware/authMiddleware");

const router = express.Router();
const OWNER = "Ayush Bhajman Patra";

router.use(requireAuth);

// Which fields each list collection accepts, and which are mandatory.
const COLLECTIONS = {
  experience: { fields: ["role", "company", "period", "location", "description"], required: ["role", "company"] },
  projects: { fields: ["name", "stack", "description", "liveUrl", "githubUrl"], required: ["name"] },
  education: { fields: ["degree", "institution", "year", "result"], required: ["degree", "institution"] },
  achievements: { fields: ["title", "year", "description"], required: ["title"] },
  certifications: { fields: ["name", "issuer", "year", "credentialUrl"], required: ["name"] }
};

const PROFILE_FIELDS = ["name", "headline", "location", "email", "phone", "objective"];
const SECTION_KEYS = ["about", "skills", "experience", "projects", "education", "achievements", "certifications", "contact"];

function pick(body, fields) {
  const out = {};
  for (const field of fields) {
    if (body[field] !== undefined) out[field] = String(body[field]).trim();
  }
  return out;
}

// Loads (or creates) the portfolio document. Items saved by the older version of
// the app have no _id, so give them one once so they can be edited individually.
async function getPortfolio() {
  let raw = await PortfolioData.findOne({ owner: OWNER }).lean();

  if (!raw) {
    await PortfolioData.create({ owner: OWNER });
    raw = await PortfolioData.findOne({ owner: OWNER }).lean();
  }

  const fixes = {};
  for (const key of Object.keys(COLLECTIONS)) {
    const items = raw[key] || [];
    if (items.some((item) => !item._id)) {
      fixes[key] = items.map((item) => ({ ...item, _id: item._id || new mongoose.Types.ObjectId() }));
    }
  }

  if (Object.keys(fixes).length) {
    await PortfolioData.collection.updateOne({ owner: OWNER }, { $set: fixes });
  }

  return PortfolioData.findOne({ owner: OWNER });
}

router.get("/dashboard", async (req, res) => {
  try {
    const data = await getPortfolio();
    res.json({ admin: { name: req.admin.name, email: req.admin.email }, data });
  } catch {
    res.status(500).json({ message: "Could not load dashboard" });
  }
});

router.put("/profile", async (req, res) => {
  try {
    const profile = pick(req.body, PROFILE_FIELDS);

    if (!profile.name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const $set = {};
    for (const [key, value] of Object.entries(profile)) $set[`profile.${key}`] = value;

    await getPortfolio();
    const data = await PortfolioData.findOneAndUpdate({ owner: OWNER }, { $set }, { new: true });

    res.json({ message: "Profile updated", profile: data.profile });
  } catch {
    res.status(500).json({ message: "Could not update profile" });
  }
});

router.put("/sections", async (req, res) => {
  try {
    const $set = {};
    for (const key of SECTION_KEYS) {
      if (typeof req.body[key] === "boolean") $set[`sections.${key}`] = req.body[key];
    }

    await getPortfolio();
    const data = await PortfolioData.findOneAndUpdate({ owner: OWNER }, { $set }, { new: true });

    res.json({ message: "Sections updated", sections: data.sections });
  } catch {
    res.status(500).json({ message: "Could not update sections" });
  }
});

router.put("/skills", async (req, res) => {
  try {
    const list = Array.isArray(req.body.skills) ? req.body.skills : [];
    const skills = [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];

    await getPortfolio();
    const data = await PortfolioData.findOneAndUpdate({ owner: OWNER }, { $set: { skills } }, { new: true });

    res.json({ message: "Skills updated", skills: data.skills });
  } catch {
    res.status(500).json({ message: "Could not update skills" });
  }
});

// ---------- Generic CRUD for experience / projects / education / achievements / certifications ----------

router.param("collection", (req, res, next, name) => {
  if (!COLLECTIONS[name]) return res.status(404).json({ message: "Unknown collection" });
  req.config = COLLECTIONS[name];
  next();
});

function validate(config, item) {
  const missing = config.required.filter((field) => !item[field]);
  return missing.length ? `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required` : null;
}

router.post("/:collection", async (req, res) => {
  try {
    const collection = req.params.collection;
    const config = req.config;
    const item = pick(req.body, config.fields);
    const error = validate(config, item);
    if (error) return res.status(400).json({ message: error });

    await getPortfolio();
    const data = await PortfolioData.findOneAndUpdate(
      { owner: OWNER },
      { $push: { [collection]: item } },
      { new: true }
    );

    res.status(201).json({ message: "Added", items: data[collection] });
  } catch {
    res.status(500).json({ message: "Could not add item" });
  }
});

// Reorder: body { order: [id, id, ...] }. Declared before "/:collection/:id".
router.put("/:collection/reorder", async (req, res) => {
  try {
    const collection = req.params.collection;
    const order = Array.isArray(req.body.order) ? req.body.order.map(String) : [];

    const data = await getPortfolio();
    const current = data[collection];
    const byId = new Map(current.map((item) => [item._id.toString(), item]));

    if (order.length !== current.length || !order.every((id) => byId.has(id))) {
      return res.status(400).json({ message: "Invalid order" });
    }

    data[collection] = order.map((id) => byId.get(id));
    await data.save();

    res.json({ message: "Order saved", items: data[collection] });
  } catch {
    res.status(500).json({ message: "Could not reorder" });
  }
});

router.put("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    const item = pick(req.body, req.config.fields);
    const blank = req.config.required.filter((field) => item[field] !== undefined && !item[field]);
    if (blank.length) return res.status(400).json({ message: `${blank.join(", ")} cannot be empty` });

    await getPortfolio();

    const $set = {};
    for (const [key, value] of Object.entries(item)) $set[`${collection}.$.${key}`] = value;

    const data = await PortfolioData.findOneAndUpdate(
      { owner: OWNER, [`${collection}._id`]: id },
      { $set },
      { new: true }
    );

    if (!data) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Saved", items: data[collection] });
  } catch {
    res.status(500).json({ message: "Could not save item" });
  }
});

router.delete("/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid id" });

    await getPortfolio();
    const data = await PortfolioData.findOneAndUpdate(
      { owner: OWNER },
      { $pull: { [collection]: { _id: id } } },
      { new: true }
    );

    res.json({ message: "Deleted", items: data[collection] });
  } catch {
    res.status(500).json({ message: "Could not delete item" });
  }
});

module.exports = router;
