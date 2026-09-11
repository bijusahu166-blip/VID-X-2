import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import "./Jobs.css";
import { apiUrl } from "@/lib/queryClient";

type JobScreen = "browse" | "post" | "myjobs";

interface Job {
  id: number;
  userId: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  type: string;
  emoji: string;
  desc: string;
  imageUrl: string;
  applyUrl: string;
  postedAt: string;
  active: boolean;
  username?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
}

const JOB_TYPES = ["Full-time", "Part-time", "Freelance", "Internship"];

function getEmoji(jobType: string): string {
  switch (jobType.toLowerCase()) {
    case "internship":
      return "🎓";
    case "freelance":
      return "🧑‍💻";
    case "part-time":
      return "⏰";
    default:
      return "💼";
  }
}

function formatPostedAt(value: unknown): string {
  if (!value) return "Today";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapRowToJob(row: any): Job {
  const type = String(row?.job_type ?? row?.jobType ?? row?.type ?? "Full-time");

  return {
    id: Number(row?.id ?? 0),
    userId: String(row?.user_id ?? row?.userId ?? ""),
    title: String(row?.title ?? ""),
    company: String(row?.company ?? ""),
    location: String(row?.location ?? "Remote"),
    salary: String(row?.salary ?? "Negotiable"),
    type,
    emoji: getEmoji(type),
    desc: String(row?.description ?? row?.desc ?? ""),
    imageUrl: String(row?.image_url ?? row?.imageUrl ?? ""),
    applyUrl: String(row?.apply_url ?? row?.applyUrl ?? ""),
    postedAt: formatPostedAt(row?.created_at ?? row?.createdAt),
    active: row?.active !== false,
    username: row?.username ? String(row.username) : undefined,
    firstName: row?.first_name ? String(row.first_name) : undefined,
    lastName: row?.last_name ? String(row.last_name) : undefined,
    profileImageUrl: row?.profile_image_url ? String(row.profile_image_url) : undefined,
  };
}

async function readJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function Jobs() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [currentScreen, setCurrentScreen] = useState<JobScreen>("browse");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [postingJob, setPostingJob] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [jobImageFile, setJobImageFile] = useState<File | null>(null);
  const [jobImagePreview, setJobImagePreview] = useState("");

  const [toastMsg, setToastMsg] = useState("");
  const [toastColor, setToastColor] = useState("#4afa8a");

  const [postForm, setPostForm] = useState({
    title: "",
    company: "",
    location: "",
    salary: "",
    type: "Full-time",
    desc: "",
    applyUrl: "",
  });

  const showToast = (msg: string, color = "#4afa8a") => {
    setToastMsg(msg);
    setToastColor(color);
    window.setTimeout(() => setToastMsg(""), 3200);
  };

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(apiUrl("/api/jobs?limit=50&page=1"), {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data?.message || `Jobs load failed (${res.status})`);
      }

      if (!Array.isArray(data)) {
        throw new Error("Jobs API returned an invalid response");
      }

      setJobs(data.map(mapRowToJob).filter((job) => job.id > 0 && job.active));
    } catch (error: any) {
      console.error("[jobs load]", error);
      showToast(`❌ Jobs load nahi hue: ${error?.message || "unknown error"}`, "#ff6060");
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("post") === "1") {
      setCurrentScreen("post");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (jobImagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(jobImagePreview);
      }
    };
  }, [jobImagePreview]);

  const myJobs = useMemo(() => {
    const myId = user?.id ? String(user.id) : "";
    if (!myId) return [];
    return jobs.filter((job) => job.userId === myId && job.active);
  }, [jobs, user?.id]);

  const resetPostForm = () => {
    if (jobImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(jobImagePreview);
    }
    setJobImageFile(null);
    setJobImagePreview("");
    setPostForm({
      title: "",
      company: "",
      location: "",
      salary: "",
      type: "Full-time",
      desc: "",
      applyUrl: "",
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      showToast("❌ Sirf JPG, PNG, WEBP ya GIF image allowed hai.", "#ff6060");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("❌ Job image 10 MB se chhoti honi chahiye.", "#ff6060");
      return;
    }

    if (jobImagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(jobImagePreview);
    }

    setJobImageFile(file);
    setJobImagePreview(URL.createObjectURL(file));
  };

  const uploadJobImage = async (): Promise<string> => {
    if (!jobImageFile) return "";

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", jobImageFile);

      const res = await fetch(apiUrl("/api/jobs/upload"), {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data?.message || `Image upload failed (${res.status})`);
      }

      const url = String(data?.imageUrl ?? data?.url ?? "");
      if (!url) throw new Error("R2 image URL nahi mila");
      return url;
    } finally {
      setUploadingImage(false);
    }
  };

  const handlePostJob = async () => {
    if (!user?.id) {
      showToast("❌ Job post karne ke liye login zaroori hai.", "#ff6060");
      return;
    }

    const title = postForm.title.trim();
    const company = postForm.company.trim();

    if (!title) {
      showToast("⚠️ Job title required hai.", "#ff9900");
      return;
    }

    if (!company) {
      showToast("⚠️ Company name required hai.", "#ff9900");
      return;
    }

    if (title.length > 180) {
      showToast("⚠️ Job title bahut lamba hai.", "#ff9900");
      return;
    }

    if (company.length > 180) {
      showToast("⚠️ Company name bahut lamba hai.", "#ff9900");
      return;
    }

    if (postForm.applyUrl.trim()) {
      const value = postForm.applyUrl.trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isUrl = /^https?:\/\//i.test(value);
      if (!isEmail && !isUrl) {
        showToast("⚠️ Apply field me valid email ya https:// link daalo.", "#ff9900");
        return;
      }
    }

    setPostingJob(true);
    try {
      let imageUrl = "";
      if (jobImageFile) {
        imageUrl = await uploadJobImage();
      }

      const applyValue = postForm.applyUrl.trim();
      const normalizedApplyUrl = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applyValue)
        ? `mailto:${applyValue}`
        : applyValue;

      const res = await fetch(apiUrl("/api/jobs"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          title,
          company,
          description: postForm.desc.trim(),
          location: postForm.location.trim() || "Remote",
          salary: postForm.salary.trim() || "Negotiable",
          jobType: postForm.type,
          imageUrl,
          applyUrl: normalizedApplyUrl || null,
        }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data?.message || `Job post failed (${res.status})`);
      }

      const newJob = mapRowToJob(data);
      setJobs((prev) => [newJob, ...prev.filter((job) => job.id !== newJob.id)]);
      resetPostForm();
      setCurrentScreen("browse");
      showToast("✅ Job posted successfully!");
    } catch (error: any) {
      console.error("[job create]", error);
      showToast(`❌ Job post nahi hua: ${error?.message || "unknown error"}`, "#ff6060");
    } finally {
      setPostingJob(false);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!user?.id) {
      showToast("❌ Please login first.", "#ff6060");
      return;
    }

    const confirmed = window.confirm("Kya aap is job ko remove karna chahte hain?");
    if (!confirmed) return;

    setDeletingId(jobId);
    try {
      const res = await fetch(apiUrl(`/api/jobs/${jobId}`), {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data?.message || `Delete failed (${res.status})`);
      }

      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      showToast("🗑️ Job removed successfully!", "#ff6060");
    } catch (error: any) {
      console.error("[job delete]", error);
      showToast(`❌ Delete nahi hua: ${error?.message || "unknown error"}`, "#ff6060");
    } finally {
      setDeletingId(null);
    }
  };

  const openApply = (job: Job) => {
    if (!job.applyUrl) {
      showToast("⚠️ Recruiter ne apply link/email nahi diya.", "#ff9900");
      return;
    }

    if (job.applyUrl.startsWith("mailto:")) {
      window.location.href = `${job.applyUrl}?subject=${encodeURIComponent(`Application for ${job.title}`)}`;
      return;
    }

    try {
      const url = new URL(job.applyUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Invalid apply link");
      }
      window.open(url.toString(), "_blank", "noopener,noreferrer");
    } catch {
      showToast("❌ Apply link invalid hai.", "#ff6060");
    }
  };

  const renderJobCard = (job: Job, mine = false) => (
    <div key={job.id} className="card">
      {job.imageUrl && (
        <img
          src={job.imageUrl}
          alt={job.title}
          loading="lazy"
          style={{
            width: "100%",
            maxHeight: "220px",
            objectFit: "cover",
            borderRadius: "14px",
            marginBottom: "14px",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}

      <div className="job-card-header">
        <div className="job-emoji">{job.emoji}</div>
        <div className="job-meta">
          <div className="job-title">
            {job.title} {mine && <span className="owner-badge">👑 Mine</span>}
          </div>
          <div className="job-company">{job.company}</div>
          <div className="job-loc">📍 {job.location} · 🗓️ {job.postedAt}</div>
        </div>
      </div>

      <div className="job-badges">
        <span className="badge badge-hot">🔥 {job.type}</span>
        <span className="badge badge-salary">💰 {job.salary}</span>
      </div>

      {job.desc && (
        <p
          style={{
            fontSize: "13px",
            color: "rgba(255,255,255,0.62)",
            lineHeight: 1.6,
            marginBottom: "14px",
            whiteSpace: "pre-wrap",
          }}
        >
          {job.desc}
        </p>
      )}

      {mine ? (
        <button
          className="delete-btn"
          disabled={deletingId === job.id}
          onClick={() => handleDeleteJob(job.id)}
        >
          {deletingId === job.id ? "Removing..." : "🗑️ Remove This Job"}
        </button>
      ) : (
        <button className="apply-btn" onClick={() => openApply(job)}>
          Apply Now →
        </button>
      )}
    </div>
  );

  return (
    <div className="jobs-container">
      <style>{`
        .jobs-top-actions { display:flex; align-items:center; gap:8px; }
        .jobs-refresh-btn { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#fff; border-radius:10px; padding:8px 11px; cursor:pointer; }
        .jobs-refresh-btn:disabled { opacity:.55; cursor:not-allowed; }
        .job-image-preview { width:100%; max-height:220px; object-fit:cover; border-radius:12px; margin-top:10px; border:1px solid rgba(255,255,255,.08); }
        .job-helper { font-size:11px; color:rgba(255,255,255,.45); margin-top:6px; line-height:1.45; }
        .jobs-loading { padding:28px 12px; text-align:center; color:rgba(255,255,255,.55); }
        .jobs-account-note { margin-bottom:14px; padding:10px 12px; border-radius:12px; background:rgba(0,212,255,.07); border:1px solid rgba(0,212,255,.15); color:rgba(255,255,255,.68); font-size:12px; line-height:1.5; }
      `}</style>

      <div className="jobs-nav">
        <button className="back-btn" onClick={() => setLocation("/")}>← Back</button>
        <div className="nav-logo">🎬 IQPartner Jobs</div>
        <div className="jobs-top-actions">
          <button className="jobs-refresh-btn" onClick={loadJobs} disabled={loadingJobs}>
            {loadingJobs ? "…" : "↻"}
          </button>
        </div>
      </div>

      <div className="nav-tabs" style={{ marginBottom: "20px" }}>
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
          onClick={() => setCurrentScreen("myjobs")}
        >
          My Jobs
        </button>
      </div>

      {currentScreen === "browse" && (
        <div className="screen">
          <p className="screen-title">Find Your <span>Dream Job</span></p>

          {loadingJobs ? (
            <div className="jobs-loading">Jobs loading...</div>
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-text">Abhi koi active job nahi hai.<br />“Post Job” se pehli job daalo.</div>
            </div>
          ) : (
            <div id="jobs-list">{jobs.map((job) => renderJobCard(job, false))}</div>
          )}
        </div>
      )}

      {currentScreen === "post" && (
        <div className="screen">
          <p className="screen-title">Post a <span>Job</span></p>

          {!user?.id && (
            <div className="jobs-account-note">
              Job post karne ke liye aapko login karna hoga. Jobs app ke existing account/session se owner ke naam par save hongi.
            </div>
          )}

          <div className="card">
            <div className="form-section-title">🏢 Job Details</div>

            <div className="field">
              <label>Job Title *</label>
              <input
                maxLength={180}
                placeholder="e.g. Video Content Creator"
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Company Name *</label>
              <input
                maxLength={180}
                placeholder="e.g. IQPartner Studios"
                value={postForm.company}
                onChange={(e) => setPostForm({ ...postForm, company: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Location</label>
              <input
                maxLength={180}
                placeholder="Remote · India"
                value={postForm.location}
                onChange={(e) => setPostForm({ ...postForm, location: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Salary Range</label>
              <input
                maxLength={120}
                placeholder="₹25K – ₹60K/mo"
                value={postForm.salary}
                onChange={(e) => setPostForm({ ...postForm, salary: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Job Type</label>
              <select
                value={postForm.type}
                onChange={(e) => setPostForm({ ...postForm, type: e.target.value })}
              >
                {JOB_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Description</label>
              <textarea
                rows={5}
                placeholder="Job ke baare mein likho..."
                value={postForm.desc}
                onChange={(e) => setPostForm({ ...postForm, desc: e.target.value })}
              />
            </div>

            <div className="field">
              <label>Apply Email or Link</label>
              <input
                placeholder="jobs@company.com or https://company.com/apply"
                value={postForm.applyUrl}
                onChange={(e) => setPostForm({ ...postForm, applyUrl: e.target.value })}
              />
              <div className="job-helper">
                Email dene par Apply button email app kholega; website link dene par browser me application page khulega.
              </div>
            </div>

            <div className="field">
              <label>Job Image (optional)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageChange} />
              <div className="job-helper">Maximum 10 MB. Image Cloudflare R2 ke jobs/images folder me save hogi.</div>
              {jobImagePreview && <img src={jobImagePreview} alt="Job preview" className="job-image-preview" />}
            </div>

            <button
              className="post-btn"
              disabled={postingJob || uploadingImage || !user?.id}
              onClick={handlePostJob}
            >
              {postingJob || uploadingImage ? "⏳ Posting..." : "🚀 Post Job Now"}
            </button>
          </div>
        </div>
      )}

      {currentScreen === "myjobs" && (
        <div className="screen">
          <p className="screen-title">My <span>Posted Jobs</span></p>

          {!user?.id ? (
            <div className="empty-state">
              <div className="empty-icon">🔐</div>
              <div className="empty-text">My Jobs dekhne ke liye login karo.</div>
            </div>
          ) : myJobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-text">Aapne abhi koi active job post nahi ki.</div>
            </div>
          ) : (
            <div id="my-jobs-list">{myJobs.map((job) => renderJobCard(job, true))}</div>
          )}
        </div>
      )}

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
            fontWeight: 600,
            zIndex: 9999,
            maxWidth: "90vw",
            textAlign: "center",
          }}
        >
          {toastMsg}
        </div>
      )}

      <div style={{ height: "100px" }} />
    </div>
  );
}