const mongoose = require("mongoose");

// Each list item gets its own _id so it can be edited / deleted individually.
const str = { type: String, default: "", trim: true };

const experienceSchema = new mongoose.Schema({
  role: str,
  company: str,
  period: str,
  location: str,
  description: str
});

const projectSchema = new mongoose.Schema({
  name: str,
  stack: str,
  description: str,
  liveUrl: str,
  githubUrl: str
});

const educationSchema = new mongoose.Schema({
  degree: str,
  institution: str,
  year: str,
  result: str
});

const achievementSchema = new mongoose.Schema({
  title: str,
  year: str,
  description: str
});

const certificationSchema = new mongoose.Schema({
  name: str,
  issuer: str,
  year: str,
  credentialUrl: str
});

const portfolioDataSchema = new mongoose.Schema(
  {
    owner: {
      type: String,
      default: "Ayush Bhajman Patra",
      unique: true
    },
    profile: {
      name: { type: String, default: "Ayush Bhajman Patra" },
      location: { type: String, default: "Mumbai, Maharashtra" },
      email: { type: String, default: "Ayushpatra0892@gmail.com" },
      phone: { type: String, default: "9619337010" },
      // Short title shown under your name on the homepage. Edit it in Dashboard → Profile.
      headline: { type: String, default: "IT Graduate · Web Developer" },
      objective: {
        type: String,
        default:
          "Motivated IT graduate with a strong foundation in web development, programming, databases, and computer networking."
      }
    },
    skills: {
      type: [String],
      default: [
        "HTML",
        "CSS",
        "JavaScript",
        "Node.js",
        "Express.js",
        "MongoDB",
        "C",
        "C++",
        "Java (Basic)",
        "C# (Basic)",
        "ASP.NET (Basic)",
        "GitHub",
        "Render",
        "Computer Networking",
        "Cybersecurity Fundamentals",
        "Ethical Hacking Basics"
      ]
    },
    experience: {
      type: [experienceSchema],
      default: [
        {
          role: "Shift In-Charge",
          company: "The Binge Town, Thane",
          period: "Jan 2026 – Present"
        }
      ]
    },
    projects: {
      type: [projectSchema],
      default: [
        { name: "VITTAVIDYA", stack: "HTML, CSS, JavaScript, Node.js, Express.js, MongoDB" },
        { name: "Petopia Care", stack: "HTML, CSS, JavaScript, Node.js, Express.js, MongoDB" }
      ]
    },
    education: {
      type: [educationSchema],
      default: [
        { degree: "BSc in Information Technology", institution: "SIES College of Arts, Commerce & Science, Sion", year: "2025", result: "CGPA: 8.2" },
        { degree: "HSC (Science with IT)", institution: "RJ Thakur College, Thane", year: "2022", result: "75%" },
        { degree: "SSC", institution: "St. Xavier’s English High School & Jr College, Thane", year: "2020", result: "77.60%" }
      ]
    },
    achievements: { type: [achievementSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    sections: {
      about: { type: Boolean, default: true },
      skills: { type: Boolean, default: true },
      experience: { type: Boolean, default: true },
      projects: { type: Boolean, default: true },
      education: { type: Boolean, default: true },
      achievements: { type: Boolean, default: false },
      certifications: { type: Boolean, default: false },
      contact: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("PortfolioData", portfolioDataSchema);
