const express = require("express");
const PortfolioData = require("../models/PortfolioData");

const router = express.Router();

// Public, read-only data for the portfolio frontend.
// Hidden sections are left out so the frontend never has to decide what to show.
router.get("/", async (req, res) => {
  try {
    const data = await PortfolioData.findOne({ owner: "Ayush Bhajman Patra" }).lean();
    if (!data) return res.status(404).json({ message: "Portfolio not set up yet" });

    const { sections } = data;
    const result = { profile: data.profile, sections };

    for (const key of ["skills", "experience", "projects", "education", "achievements", "certifications"]) {
      result[key] = sections[key] ? data[key] || [] : [];
    }
    if (!sections.about) result.profile = { ...result.profile, objective: "" };
    if (!sections.contact) result.profile = { ...result.profile, email: "", phone: "" };

    res.json(result);
  } catch {
    res.status(500).json({ message: "Could not load portfolio" });
  }
});

module.exports = router;
