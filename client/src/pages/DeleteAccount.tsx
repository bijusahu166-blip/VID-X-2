import { Trash2, Mail, ShieldCheck, Clock, ChevronRight } from "lucide-react";

export default function DeleteAccount() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-2xl mx-auto px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Delete Your Account</h1>
            <p className="text-sm text-zinc-500">iqpartner — Developer: IQ Partner</p>
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 mb-6">
          <h2 className="text-lg font-bold mb-4">How to delete your account</h2>
          <ol className="space-y-4">
            {[
              "Open the iqpartner app and log in to your account.",
              "Go to your Profile page.",
              "Tap the ☰ menu icon (top right of your profile) OR the ⚙ Settings icon.",
              "Select \"Delete Account\" from the menu.",
              "Confirm your password when prompted.",
              "Tap \"Permanently Delete My Account\" to confirm.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* What happens */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-lg font-bold">What gets deleted</h2>
          </div>
          <p className="text-sm text-zinc-400 mb-3">
            Account deletion is <span className="text-white font-semibold">instant</span>. As soon as you confirm, the following data is permanently removed:
          </p>
          <ul className="space-y-2">
            {[
              "Profile information (name, username, bio, profile photo)",
              "Posts, reels, stories, and books you uploaded",
              "Likes, comments, and saved posts",
              "Followers / following relationships",
              "Direct messages you have sent",
              "Notifications",
              "Your account credentials and login access",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-zinc-300">
                <ChevronRight className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Retention */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-lg font-bold">Data retention</h2>
          </div>
          <p className="text-sm text-zinc-400 leading-relaxed">
            While your account and content are deleted instantly and are no longer visible or accessible in the app,
            residual copies may remain in encrypted backups or system logs for up to{" "}
            <span className="text-white font-semibold">7 days</span> before being permanently purged from our servers.
            This data is not used for any purpose during this period and is not restorable to your account.
          </p>
        </div>

        {/* Contact */}
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-blue-400" />
            <h2 className="text-lg font-bold">Need help?</h2>
          </div>
          <p className="text-sm text-zinc-400 mb-2">
            If you have any questions about account deletion or data handling, contact us:
          </p>
          <a
            href="mailto:iqpartnerofficial00@gmail.com"
            className="text-sm font-semibold text-pink-400 hover:text-pink-300 transition-colors"
          >
            iqpartnerofficial00@gmail.com
          </a>
        </div>

        <p className="text-center text-[11px] text-zinc-600 mt-8">
          © {new Date().getFullYear()} iqpartner · IQ Partner
        </p>
      </div>
    </div>
  );
}