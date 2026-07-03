import { ArrowLeft, Lock } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20">
      <button onClick={() => window.history.back()}
        className="flex items-center gap-2 text-zinc-400 mb-6 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-black mb-1" style={{ color: "#8B0000" }}>
        🧛 Vampire
      </h1>
      <h2 className="text-lg font-bold text-white mb-2">Privacy Policy</h2>
      <p className="text-zinc-500 text-sm mb-8">Effective: July 1, 2025</p>

      <div className="space-y-6">
        {[
          { title: "1. Information We Collect", content: "We collect name, email, username, profile photo, videos, images, messages, and usage data when you use Vampire." },
          { title: "2. How We Use It", content: "To provide the app, enable social features, send OTP emails, personalize your feed using AI, and keep the platform safe." },
          { title: "3. Data Storage", content: "Your data is stored using Supabase, Neon (database), Cloudinary (media files), and Render (server hosting)." },
          { title: "4. AI Features", content: "We use Google Gemini API for smart replies and translation. Your messages may be processed by this service." },
          { title: "5. Data Sharing", content: "We do NOT sell your data. We only share with trusted service providers needed to operate the app." },
          { title: "6. User Content", content: "Videos, images, and posts you share may be visible to other users. Content violating our guidelines will be removed." },
          { title: "7. Your Rights", content: "You can request access, correction, or deletion of your data anytime by contacting us." },
          { title: "8. Children", content: "Vampire is for users 13 and above. We delete accounts of users found to be under 13." },
          { title: "9. Security", content: "Passwords are bcrypt hashed. All data transfers use HTTPS encryption." },
          { title: "10. Changes", content: "We may update this policy. You will be notified of major changes via the app or email." },
        ].map(({ title, content }) => (
          <div key={title} className="rounded-2xl p-4 border border-white/5"
            style={{ background: "rgba(139,0,0,0.08)" }}>
            <h3 className="font-bold text-sm mb-2" style={{ color: "#ff2d55" }}>
              {title}
            </h3>
            <p className="text-zinc-300 text-sm leading-relaxed">{content}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 rounded-2xl text-center border"
        style={{ background: "rgba(139,0,0,0.12)", borderColor: "rgba(139,0,0,0.3)" }}>
        <Lock className="w-5 h-5 mx-auto mb-2" style={{ color: "#ff2d55" }} />
        <p className="text-zinc-400 text-sm mb-2">Questions about your privacy?</p>
        <a href="mailto:vampireofficial00@gmail.com"
          className="font-bold text-sm" style={{ color: "#ff2d55" }}>
          vampireofficial00@gmail.com
        </a>
      </div>

      <p className="text-center text-zinc-600 text-xs mt-6">
        © 2025 Vampire App. All rights reserved.
      </p>
    </div>
  );
}