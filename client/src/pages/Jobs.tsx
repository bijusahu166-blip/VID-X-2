import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import "./Jobs.css";

interface Job {
  id: number;
  title: string;
  company: string;
  email: string;
  pin: string;
  location: string;
  salary: string;
  type: string;
  emoji: string;
  desc: string;
  tags: string[];
  ejsPubkey: string;
  ejsService: string;
  ejsTemplate: string;
  postedAt: string;
  active?: boolean;
}

interface Applicant {
  name: string;
  email: string;
  phone: string;
  exp: string;
  portfolio: string;
  skills: string;
  note: string;
}

interface Application {
  jobId: number;
  applicant: Applicant;
  appliedAt: string;
}

const SKILLS = [
  "Video Editing",
  "Reels",
  "Music Production",
  "Gaming",
  "Vlogging",
  "Animation",
  "Live Streaming",
  "Thumbnail Design",
  "Scriptwriting",
  "Photography",
];

declare global {
  interface Window {
    emailjs?: any;
  }
}

export default function Jobs() {
  const [location_state, setLocationState] = useLocation();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentScreen, setCurrentScreen] = useState<"browse" | "post" | "myjobs">("browse");
  const [currentJob, setCurrentJob] = useState<Job | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [loggedInEmail, setLoggedInEmail] = useState<string | null>(null);
  const [loggedInPin, setLoggedInPin] = useState<string | null>(null);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState("#4afa8a");

  // Form data
  const [postForm, setPostForm] = useState({
    pin: "",
    title: "",
    company: "",
    email: "",
    location: "",
    salary: "",
    type: "Full-time",
    emoji: "💼",
    desc: "",
    tags: "",
    ejsPubkey: "",
    ejsService: "",
    ejsTemplate: "",
  });

  const [applyForm, setApplyForm] = useState({
    name: "",
    email: "",
    phone: "",
    exp: "",
    portfolio: "",
    customSkills: "",
    note: "",
  });

  const [loginPin, setLoginPin] = useState(["", "", "", ""]);
  const [loginError, setLoginError] = useState("");

  // Load jobs from localStorage on mount
  useEffect(() => {
    try {
      const savedJobs = JSON.parse(localStorage.getItem("vidx_jobs") || "[]") as Job[];
      setJobs(savedJobs.filter((job) => job.active !== false));
    } catch {
      setJobs([]);
    }
    try {
      const savedApplications = JSON.parse(localStorage.getItem("vidx_job_applications") || "[]") as Application[];
      setApplications(savedApplications);
    } catch {
      setApplications([]);
    }
    // Load EmailJS from CDN
    if (!window.emailjs) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      document.body.appendChild(script);
    }
  }, []);

  // Check for post query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("post") === "1") {
      setCurrentScreen("post");
      // Clear the query param
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Save jobs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("vidx_jobs", JSON.stringify(jobs));
  }, [jobs]);

  // Save applications to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("vidx_job_applications", JSON.stringify(applications));
  }, [applications]);

  const showToast = (msg: string, color = "#4afa8a") => {
    setToastMsg(msg);
    setToastColor(color);
    setTimeout(() => setToastMsg(""), 3000);
  };

  // ── POST JOB ──
  const handlePostJob = () => {
    if (!postForm.title.trim() || !postForm.company.trim() || !postForm.email.trim()) {
      showToast("⚠️ Title, Company & Email are required!", "#ff9900");
      return;
    }
    if (!postForm.pin || postForm.pin.length < 4 || !/^\d{4}$/.test(postForm.pin)) {
      showToast("⚠️ Set a 4-digit numeric PIN!", "#ff9900");
      return;
    }

    const newJob: Job = {
      id: Date.now(),
      title: postForm.title,
      company: postForm.company,
      email: postForm.email,
      pin: postForm.pin,
      location: postForm.location || "Remote",
      salary: postForm.salary || "Negotiable",
      type: postForm.type,
      emoji: postForm.emoji || "💼",
      desc: postForm.desc,
      tags: postForm.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      ejsPubkey: postForm.ejsPubkey,
      ejsService: postForm.ejsService,
      ejsTemplate: postForm.ejsTemplate,
      postedAt: new Date().toLocaleDateString("en-IN"),
      active: true,
    };

    setJobs([newJob, ...jobs]);
    showToast("✅ Job posted successfully!");
    setPostForm({
      pin: "",
      title: "",
      company: "",
      email: "",
      location: "",
      salary: "",
      type: "Full-time",
      emoji: "💼",
      desc: "",
      tags: "",
      ejsPubkey: "",
      ejsService: "",
      ejsTemplate: "",
    });
    setCurrentScreen("browse");
  };

  // ── OPEN APPLY MODAL ──
  const handleOpenApply = (jobId: number) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setCurrentJob(job);
    setSelectedSkills([]);
    setCurrentStep(1);
    setApplyForm({ name: "", email: "", phone: "", exp: "", portfolio: "", note: "" });
    setShowModal(true);
  };

  // ── APPLY NEXT/BACK ──
  const handleApplyNext = () => {
    if (currentStep === 1) {
      if (!applyForm.name.trim() || !applyForm.email.trim() || !applyForm.phone.trim()) {
        showToast("⚠️ Name, Email & Phone are required!", "#ff9900");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleApplyBack = () => {
    setCurrentStep(currentStep - 1);
  };

  // ── SUBMIT APPLICATION ──
  const handleSubmitApplication = async () => {
    if (!currentJob) return;

    const applicant: Applicant = {
      name: applyForm.name.trim(),
      email: applyForm.email.trim(),
      phone: applyForm.phone.trim(),
      exp: applyForm.exp || "Not mentioned",
      portfolio: applyForm.portfolio.trim() || "Not provided",
      skills: [...selectedSkills, ...applyForm.customSkills.split(",").map(s => s.trim()).filter(s => s)].join(", ") || "Not mentioned",
      note: applyForm.note.trim() || "No cover note",
    };

    // Store application locally
    const newApplication: Application = {
      jobId: currentJob.id,
      applicant,
      appliedAt: new Date().toLocaleString("en-IN"),
    };
    setApplications([...applications, newApplication]);

    // Send email if EmailJS is configured
    const hasCreds =
      currentJob.ejsPubkey && currentJob.ejsService && currentJob.ejsTemplate;
    if (hasCreds && window.emailjs) {
      try {
        window.emailjs.init(currentJob.ejsPubkey);
        await window.emailjs.send(currentJob.ejsService, currentJob.ejsTemplate, {
          to_email: currentJob.email,
          to_name: currentJob.company,
          job_title: currentJob.title,
          applicant_name: applicant.name,
          applicant_email: applicant.email,
          applicant_phone: applicant.phone,
          applicant_experience: applicant.exp,
          applicant_skills: applicant.skills,
          applicant_portfolio: applicant.portfolio,
          cover_note: applicant.note,
          applied_on: new Date().toLocaleString("en-IN"),
        });
      } catch (err) {
        console.error("EmailJS error:", err);
      }
    }

    setShowModal(false);
    if (!hasCreds) {
      showToast("📧 EmailJS config missing - setup for real emails", "#ff9900");
    } else {
      showToast("✅ Application submitted successfully!");
    }
  };

  // ── LOGIN PIN ──
  const handlePinChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newPin = [...loginPin];
    newPin[index] = value;
    setLoginPin(newPin);
    if (value && index < 3) {
      document.getElementById(`pin-${index + 1}`)?.focus();
    }
  };

  const handleVerifyPin = () => {
    const enteredPin = loginPin.join("");
    if (enteredPin.length < 4) {
      setLoginError("⚠️ Please enter complete 4-digit PIN");
      return;
    }

    const userJobs = jobs.filter((j) => j.pin === enteredPin && j.active !== false);
    if (userJobs.length === 0) {
      setLoginError("❌ Incorrect PIN! Try again.");
      setLoginPin(["", "", "", ""]);
      document.getElementById("pin-0")?.focus();
      return;
    }

    setLoggedInEmail(userJobs[0].email);
    setLoggedInPin(enteredPin);
    setMyJobs(userJobs);
    setShowLoginModal(false);
    setCurrentScreen("myjobs");
  };

  // ── DELETE JOB ──
  const handleAskDelete = (jobId: number) => {
    setDeleteTargetId(jobId);
    setShowConfirmModal(true);
  };

  const handleConfirmDelete = () => {
    if (!deleteTargetId) return;
    setJobs(jobs.map((job) => job.id === deleteTargetId ? { ...job, active: false } : job));
    setMyJobs(myJobs.filter((j) => j.id !== deleteTargetId));
    setShowConfirmModal(false);
    setDeleteTargetId(null);
    showToast("🗑️ Job removed successfully!", "#ff6060");
  };

  // ── RENDER BROWSE JOBS ──
  const renderBrowseJobs = () => {
    const activeJobs = jobs.filter((job) => job.active !== false);
    if (activeJobs.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-text">
            Abhi koi job nahi hai.
            <br />
            Upar "Post Job" karke job daalo!
          </div>
        </div>
      );
    }

    return activeJobs.map((job) => (
      <div key={job.id} className="card">
        <div className="job-card-header">
          <div className="job-emoji">{job.emoji}</div>
          <div className="job-meta">
            <div className="job-title">{job.title}</div>
            <div className="job-company">{job.company}</div>
            <div className="job-loc">
              📍 {job.location} · 🗓️ {job.postedAt}
            </div>
          </div>
        </div>
        <div className="job-badges">
          <span className="badge badge-hot">🔥 {job.type}</span>
          <span className="badge badge-salary">💰 {job.salary}</span>
          {job.tags.map((tag) => (
            <span key={tag} className="badge badge-tag">
              {tag}
            </span>
          ))}
        </div>
        {job.desc && (
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: "1.5", marginBottom: "14px" }}>
            {job.desc}
          </p>
        )}
        <button className="apply-btn" onClick={() => handleOpenApply(job.id)}>
          Apply Now →
        </button>
      </div>
    ));
  };

  // ── RENDER MY JOBS ──
  const renderMyJobs = () => {
    if (myJobs.length === 0) {
      return (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-text">You haven't posted any jobs yet.</div>
        </div>
      );
    }

    return myJobs.map((job) => {
      const jobApplications = applications.filter(app => app.jobId === job.id);
      return (
        <div key={job.id} className="card">
          <div className="job-card-header">
            <div className="job-emoji">{job.emoji}</div>
            <div className="job-meta">
              <div className="job-title">
                {job.title} <span className="owner-badge">👑 Mine</span>
              </div>
              <div className="job-company">{job.company}</div>
              <div className="job-loc">
                📍 {job.location} · 🗓️ {job.postedAt}
              </div>
            </div>
          </div>
          <div className="job-badges">
            <span className="badge badge-hot">🔥 {job.type}</span>
            <span className="badge badge-salary">💰 {job.salary}</span>
            {job.tags.map((tag) => (
              <span key={tag} className="badge badge-tag">
                {tag}
              </span>
            ))}
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
            📧 Applications → <strong style={{ color: "rgba(255,255,255,0.7)" }}>{job.email}</strong>
          </div>
          {jobApplications.length > 0 && (
            <div style={{ marginTop: "16px", padding: "12px", background: "var(--card2)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "14px", fontWeight: "bold", color: "var(--text)", marginBottom: "8px" }}>
                📋 Applicants ({jobApplications.length})
              </div>
              {jobApplications.map((app, idx) => (
                <div key={idx} style={{ marginBottom: "12px", padding: "8px", background: "var(--card)", borderRadius: "6px" }}>
                  <div style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text)" }}>{app.applicant.name}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>📧 {app.applicant.email} · 📞 {app.applicant.phone}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>💼 {app.applicant.exp} · 🔗 {app.applicant.portfolio}</div>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>🛠️ {app.applicant.skills}</div>
                  {app.applicant.note && <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>📝 {app.applicant.note}</div>}
                  <div style={{ fontSize: "10px", color: "var(--cyan)", marginTop: "4px" }}>Applied on: {app.appliedAt}</div>
                </div>
              ))}
            </div>
          )}
          <button className="delete-btn" onClick={() => handleAskDelete(job.id)}>
            🗑️ Remove This Job
          </button>
        </div>
      );
    });
  };

  return (
    <div className="jobs-container">
      <style>
        {`
          :root {
            --pink: #ff2d78;
            --purple: #a855f7;
            --cyan: #00d4ff;
            --bg: #08080f;
            --card: #111120;
            --card2: #16162a;
            --border: rgba(255,255,255,0.08);
            --text: #ffffff;
            --muted: rgba(255,255,255,0.45);
          }

          .jobs-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
          }

          .back-btn {
            background: none;
            border: none;
            color: var(--text);
            font-size: 14px;
            cursor: pointer;
            padding: 8px 12px;
            border-radius: 6px;
            transition: background 0.2s;
          }

          .back-btn:hover {
            background: var(--card2);
          }

          .nav-logo {
            font-size: 18px;
            font-weight: bold;
          }

          .nav-tabs {
            display: flex;
            gap: 8px;
          }
        `}
      </style>

      {/* Header */}
      <div className="jobs-nav">
        <button className="back-btn" onClick={() => setLocationState("/")}>
          ← Back
        </button>
        <div className="nav-logo">🎬 IQPartner Jobs</div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${currentScreen === "browse" ? "active" : ""}`}
            onClick={() => setCurrentScreen("browse")}
          >
            Browse
          </button>
          <button
            className={`nav-tab ${currentScreen === "post" ? "active" : ""}`}
            onClick={() => setCurrentScreen("post")}
          >
            Post Job
          </button>
          <button
            className={`nav-tab ${currentScreen === "myjobs" ? "active" : ""}`}
            onClick={() => {
              setLoginPin(["", "", "", ""]);
              setLoginError("");
              setShowLoginModal(true);
            }}
          >
            My Jobs
          </button>
        </div>
      </div>

      {/* SCREEN: BROWSE JOBS */}
      {currentScreen === "browse" && (
        <div className="screen">
          <p className="screen-title">
            Find Your <span>Dream Job</span>
          </p>
          <div id="jobs-list">{renderBrowseJobs()}</div>
        </div>
      )}

      {/* SCREEN: POST JOB */}
      {currentScreen === "post" && (
        <div className="screen">
          <p className="screen-title">
            Post a <span>Job</span>
          </p>

          <div className="notice">
            ⚙️ <strong>Setup:</strong> EmailJS se real email bhejne ke liye apna{" "}
            <strong>Service ID</strong>, <strong>Template ID</strong> aur <strong>Public Key</strong> niche daalo.
            Free account: emailjs.com
          </div>

          <div className="card">
            <div className="form-section-title">📧 Email Config (EmailJS)</div>
            <div className="field">
              <label>EmailJS Public Key</label>
              <input
                placeholder="user_xxxxxxxxxxxxxxxx"
                value={postForm.ejsPubkey}
                onChange={(e) => setPostForm({ ...postForm, ejsPubkey: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Service ID</label>
              <input
                placeholder="service_xxxxxxx"
                value={postForm.ejsService}
                onChange={(e) => setPostForm({ ...postForm, ejsService: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Template ID</label>
              <input
                placeholder="template_xxxxxxx"
                value={postForm.ejsTemplate}
                onChange={(e) => setPostForm({ ...postForm, ejsTemplate: e.target.value })}
              />
            </div>

            <div className="form-section-title">🔐 Security PIN (sirf aap hi delete kar sako)</div>
            <div className="field">
              <label>4-Digit PIN (yaad rakhna!) *</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="e.g. 1234"
                style={{ letterSpacing: "6px", fontSize: "18px", fontWeight: "700" }}
                value={postForm.pin}
                onChange={(e) => setPostForm({ ...postForm, pin: e.target.value })}
              />
            </div>

            <div className="form-section-title">🏢 Job Details</div>
            <div className="field">
              <label>Job Title *</label>
              <input
                placeholder="e.g. Video Content Creator"
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Company Name *</label>
              <input
                placeholder="e.g. IQPartner Studios"
                value={postForm.company}
                onChange={(e) => setPostForm({ ...postForm, company: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Your Gmail (applications jayenge yahan) *</label>
              <input
                type="email"
                placeholder="recruiter@gmail.com"
                value={postForm.email}
                onChange={(e) => setPostForm({ ...postForm, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Location</label>
              <input
                placeholder="Remote · India"
                value={postForm.location}
                onChange={(e) => setPostForm({ ...postForm, location: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Salary Range</label>
              <input
                placeholder="₹25K – ₹60K/mo"
                value={postForm.salary}
                onChange={(e) => setPostForm({ ...postForm, salary: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Job Type</label>
              <select value={postForm.type} onChange={(e) => setPostForm({ ...postForm, type: e.target.value })}>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Freelance</option>
                <option>Internship</option>
              </select>
            </div>
            <div className="field">
              <label>Job Emoji / Icon</label>
              <input
                placeholder="🎬"
                maxLength={4}
                value={postForm.emoji}
                onChange={(e) => setPostForm({ ...postForm, emoji: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                rows={3}
                placeholder="Job ke baare mein likho..."
                value={postForm.desc}
                onChange={(e) => setPostForm({ ...postForm, desc: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Tags (comma separated)</label>
              <input
                placeholder="Reels, Music, Editing"
                value={postForm.tags}
                onChange={(e) => setPostForm({ ...postForm, tags: e.target.value })}
              />
            </div>

            <button className="post-btn" onClick={handlePostJob}>
              🚀 Post Job Now
            </button>
          </div>
        </div>
      )}

      {/* SCREEN: MY JOBS */}
      {currentScreen === "myjobs" && (
        <div className="screen">
          <p className="screen-title">
            My <span>Posted Jobs</span>
          </p>
          <div id="my-jobs-list">{renderMyJobs()}</div>
        </div>
      )}

      {/* APPLY MODAL */}
      {showModal && currentJob && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle"></div>
            <div className="modal-header">
              <button className="close-btn" onClick={() => setShowModal(false)}>
                ✕
              </button>
              <div
                style={{
                  fontFamily: "'Syne',sans-serif",
                  fontSize: "13px",
                  fontWeight: "700",
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Apply Now
              </div>
              <div className="modal-job-info">
                <div className="modal-emoji">{currentJob.emoji}</div>
                <div>
                  <div className="modal-job-title">{currentJob.title}</div>
                  <div className="modal-job-co">{currentJob.company}</div>
                </div>
              </div>
            </div>

            <div className="modal-body" id="apply-form">
              {/* Step dots */}
              <div className="steps">
                <div>
                  <div className={`step-dot ${currentStep >= 1 ? "done" : ""}`}>{currentStep > 1 ? "✓" : "1"}</div>
                  <div className="step-name">Profile</div>
                </div>
                <div className={`step-line ${currentStep > 1 ? "done" : ""}`}></div>
                <div>
                  <div className={`step-dot ${currentStep >= 2 ? "done" : ""}`}>{currentStep > 2 ? "✓" : "2"}</div>
                  <div className="step-name">Skills</div>
                </div>
                <div className={`step-line ${currentStep > 2 ? "done" : ""}`}></div>
                <div>
                  <div className={`step-dot ${currentStep >= 3 ? "done" : ""}`}>3</div>
                  <div className="step-name">Submit</div>
                </div>
              </div>

              {/* Step 1 */}
              {currentStep === 1 && (
                <div>
                  <div className="field">
                    <label>Full Name *</label>
                    <input
                      placeholder="Rahul Sharma"
                      value={applyForm.name}
                      onChange={(e) => setApplyForm({ ...applyForm, name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Email *</label>
                    <input
                      type="email"
                      placeholder="rahul@gmail.com"
                      value={applyForm.email}
                      onChange={(e) => setApplyForm({ ...applyForm, email: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={applyForm.phone}
                      onChange={(e) => setApplyForm({ ...applyForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Experience</label>
                    <select value={applyForm.exp} onChange={(e) => setApplyForm({ ...applyForm, exp: e.target.value })}>
                      <option value="">Select...</option>
                      <option>Fresher (0–1 yr)</option>
                      <option>Junior (1–3 yrs)</option>
                      <option>Mid-level (3–5 yrs)</option>
                      <option>Senior (5+ yrs)</option>
                    </select>
                  </div>
                  <div className="btn-row">
                    <button className="btn-next" style={{ flex: 3 }} onClick={handleApplyNext}>
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {currentStep === 2 && (
                <div>
                  <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>Select your skills</p>
                  <div className="chip-grid">
                    {SKILLS.map((skill) => (
                      <div
                        key={skill}
                        className={`chip ${selectedSkills.includes(skill) ? "on" : ""}`}
                        onClick={() => {
                          if (selectedSkills.includes(skill)) {
                            setSelectedSkills(selectedSkills.filter((s) => s !== skill));
                          } else {
                            setSelectedSkills([...selectedSkills, skill]);
                          }
                        }}
                      >
                        {skill}
                      </div>
                    ))}
                  </div>
                  <div className="field">
                    <label>Additional Skills (comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g., React, Node.js, Python"
                      value={applyForm.customSkills}
                      onChange={(e) => setApplyForm({ ...applyForm, customSkills: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label>Portfolio / Channel Link</label>
                    <input
                      placeholder="https://youtube.com/@channel"
                      value={applyForm.portfolio}
                      onChange={(e) => setApplyForm({ ...applyForm, portfolio: e.target.value })}
                    />
                  </div>
                  <div className="btn-row">
                    <button className="btn-back" onClick={handleApplyBack}>
                      ← Back
                    </button>
                    <button className="btn-next" onClick={handleApplyNext}>
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {currentStep === 3 && (
                <div>
                  <div className="field">
                    <label>Cover Note</label>
                    <textarea
                      rows={4}
                      placeholder="IQPartner ko kyun hire karna chahiye aapko? 2-3 lines mein likho..."
                      value={applyForm.note}
                      onChange={(e) => setApplyForm({ ...applyForm, note: e.target.value })}
                    />
                  </div>
                  <div className="summary">
                    <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>
                      📋 Summary
                    </p>
                    <div className="summary-row">
                      <span className="sk">Name</span>
                      <span className="sv">{applyForm.name}</span>
                    </div>
                    <div className="summary-row">
                      <span className="sk">Email</span>
                      <span className="sv">{applyForm.email}</span>
                    </div>
                    <div className="summary-row">
                      <span className="sk">Phone</span>
                      <span className="sv">{applyForm.phone}</span>
                    </div>
                    <div className="summary-row">
                      <span className="sk">Experience</span>
                      <span className="sv">{applyForm.exp || "—"}</span>
                    </div>
                    <div className="summary-row">
                      <span className="sk">Skills</span>
                      <span className="sv">{selectedSkills.length ? selectedSkills.join(", ") : "—"}</span>
                    </div>
                    <div className="summary-row">
                      <span className="sk">Portfolio</span>
                      <span className="sv">{applyForm.portfolio || "—"}</span>
                    </div>
                  </div>
                  <div className="btn-row">
                    <button className="btn-back" onClick={handleApplyBack}>
                      ← Back
                    </button>
                    <button className="btn-submit" onClick={handleSubmitApplication}>
                      🚀 Apply Now
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="login-modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <div className="login-icon">🔐</div>
            <div className="login-title">Recruiter Login</div>
            <p className="login-sub">Apna 4-digit PIN daalo jo aapne job post karte waqt set kiya tha</p>
            <div className="pin-row">
              {loginPin.map((_, idx) => (
                <input
                  key={idx}
                  id={`pin-${idx}`}
                  className="pin-box"
                  maxLength={1}
                  type="password"
                  inputMode="numeric"
                  value={loginPin[idx]}
                  onChange={(e) => handlePinChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !loginPin[idx] && idx > 0) {
                      document.getElementById(`pin-${idx - 1}`)?.focus();
                    }
                  }}
                />
              ))}
            </div>
            <div className="login-error">{loginError}</div>
            <button className="login-btn" onClick={handleVerifyPin}>
              🔓 Login
            </button>
            <button className="login-cancel" onClick={() => setShowLoginModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {showConfirmModal && deleteTargetId && (
        <div className="confirm-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <div className="confirm-title">Job Delete Karein?</div>
            <p className="confirm-sub">Kya aap sure hain? Yeh action undo nahi ho sakta.</p>
            <button className="confirm-yes" onClick={handleConfirmDelete}>
              Haan, Delete Karo
            </button>
            <button className="confirm-no" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toastMsg && (
        <div
          id="toast"
          className="show"
          style={{
            position: "fixed",
            bottom: "90px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #1a2a1a, #1a3a1a)",
            border: `1px solid ${toastColor}50`,
            color: toastColor,
            padding: "10px 20px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: "600",
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
        >
          {toastMsg}
        </div>
      )}

      {/* Bottom padding for BottomNav */}
      <div style={{ height: "100px" }}></div>
    </div>
  );
}

