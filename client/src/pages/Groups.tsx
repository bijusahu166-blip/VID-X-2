import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { BottomNav } from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import {
  Users, Plus, Lock, Globe, ChevronRight, BookOpen,
  X, ArrowLeft, ClipboardList, Send, Trophy, CheckCircle2,
  XCircle, Clock, Star, TrendingUp, Medal, Bell, MessageCircle, FileText, BarChart3,
  Shield, UserMinus, UserCheck, VolumeX, Volume2, Gavel, Settings, Flame, Target, Wallet, Activity, Download, Mic, Image as ImageIcon, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Group {
  id: number; name: string; description?: string; image_url?: string;
  is_public: boolean; creator_id: string; member_count: number; created_at: string;
  can_send_messages: boolean; can_send_media: boolean; can_share_links: boolean; can_create_polls: boolean;
  first_name?: string; last_name?: string; username?: string; profile_image_url?: string;
  is_member: boolean; my_join_request_status?: "pending" | "approved" | "rejected" | null;
}
interface GroupPost {
  id: number; group_id: number; user_id: string; content?: string;
  image_url?: string; type: string; test_id?: number; created_at: string;
  first_name?: string; last_name?: string; username?: string; profile_image_url?: string;
  test_data?: any;
}
interface TestQuestion {
  id: number; question: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: string; explanation?: string;
}
interface TestWithQuestions {
  id: number; group_id: number; title: string; description?: string;
  timer_minutes: number; marks_per_question: number; total_questions: number;
  questions: TestQuestion[];
}
interface LeaderboardEntry {
  rank: number; user_id: string; score: number; total_marks: number;
  time_taken: number; first_name?: string; last_name?: string;
  username?: string; profile_image_url?: string;
}

interface GroupMemberEntry {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  profile_image_url?: string;
  role: "admin" | "member";
  is_muted: boolean;
  is_banned: boolean;
  joined_at: string;
}

interface JoinRequestEntry {
  id: number;
  user_id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  profile_image_url?: string;
  requested_at: string;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
function Avatar({ url, name, size = 10 }: { url?: string | null; name?: string; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (url) return <img src={url} className={`${s} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0`}>
      <span className="text-white font-bold text-xs">{(name || "?")[0].toUpperCase()}</span>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function safeJsonParse<T>(value?: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function detectSubject(title?: string) {
  const text = (title || "general").toLowerCase();
  if (/(math|quant|aptitude|algebra|geometry)/.test(text)) return "Math";
  if (/(english|grammar|vocab|reading)/.test(text)) return "English";
  if (/(reason|logic|puzzle)/.test(text)) return "Reasoning";
  if (/(history|polity|geography|science|gk|current)/.test(text)) return "GK";
  return "General";
}

function calculateStreak(dateStrings: string[]) {
  const uniqueDays = [...new Set(dateStrings.map((d) => new Date(d).toISOString().slice(0, 10)))].sort().reverse();
  if (uniqueDays.length === 0) return 0;
  let streak = 1;
  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
    if (diffDays === 1) streak += 1;
    else break;
  }
  return streak;
}

// ─── Create Group Modal ───────────────────────────────────────────────────────
function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMsg("");
      const r = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: desc, isPublic }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.message || "Group create failed");
      }
      return r.json();
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || "Group create failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/groups"] }); onClose(); },
  });

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-end justify-center p-3 pb-[max(env(safe-area-inset-bottom,0px),20px)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-zinc-900 rounded-2xl border border-zinc-800/80 p-5 pb-5 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-bold text-lg">Create Group</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
        </div>

        <Input
          placeholder="Group name *"
          value={name} onChange={e => setName(e.target.value)}
          className="mb-3 bg-zinc-800 border-zinc-700 text-white"
        />
        <Textarea
          placeholder="Description (optional)"
          value={desc} onChange={e => setDesc(e.target.value)}
          className="mb-3 bg-zinc-800 border-zinc-700 text-white min-h-[80px]"
        />

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setIsPublic(true)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all",
              isPublic ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400")}
          >
            <Globe className="w-4 h-4" /> Public
          </button>
          <button
            onClick={() => setIsPublic(false)}
            className={cn("flex-1 flex items-center justify-center gap-2 py-2 rounded-xl border text-sm font-medium transition-all",
              !isPublic ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400")}
          >
            <Lock className="w-4 h-4" /> Private
          </button>
        </div>

        <Button
          className="w-full bg-violet-600 hover:bg-violet-700 text-white"
          disabled={!name.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Creating..." : "Create Group"}
        </Button>
        {errorMsg && <p className="text-red-400 text-xs mt-2">{errorMsg}</p>}
      </div>
    </div>
  );
}

// ─── Create Test Modal ────────────────────────────────────────────────────────
interface QForm { question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctOption: string; explanation: string; }
const emptyQ = (): QForm => ({ question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctOption: "A", explanation: "" });

function CreateTestModal({ groupId, onClose }: { groupId: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"info" | "questions" | "settings" | "review" | "success">("info");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [classLevel, setClassLevel] = useState("Class 10");
  const [difficulty, setDifficulty] = useState("Medium");
  const [desc, setDesc] = useState("");
  const [timer, setTimer] = useState(10);
  const [marks, setMarks] = useState(1);
  const [negativeMarking, setNegativeMarking] = useState(0);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [isScheduled, setIsScheduled] = useState(false);
  const [oneAttemptOnly, setOneAttemptOnly] = useState(true);
  const [questions, setQuestions] = useState<QForm[]>([emptyQ()]);
  const [activeQ, setActiveQ] = useState(0);
  const [publishedTitle, setPublishedTitle] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const extra = [
        subject ? `Subject: ${subject}` : "",
        classLevel ? `Class: ${classLevel}` : "",
        difficulty ? `Difficulty: ${difficulty}` : "",
        negativeMarking > 0 ? `Negative: ${negativeMarking}` : "",
      ].filter(Boolean).join(" | ");

      const r = await fetch(`/api/groups/${groupId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: [desc, extra].filter(Boolean).join("\n"),
          timerMinutes: timer,
          marksPerQuestion: marks,
          questions,
          settings: {
            negativeMarking,
            shuffleQuestions,
            showResult,
            showLeaderboard,
            isScheduled,
            oneAttemptOnly,
          },
        }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/tests`] });
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
      setPublishedTitle(title);
      setStep("success");
    },
  });

  const q = questions[activeQ];
  const updateQ = (field: keyof QForm, val: string) => {
    setQuestions(prev => prev.map((item, i) => i === activeQ ? { ...item, [field]: val } : item));
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, emptyQ()]);
    setActiveQ(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setActiveQ(Math.min(activeQ, questions.length - 2));
  };

  const isQuestionStepValid = !questions.some(q =>
    !q.question.trim() || !q.optionA.trim() || !q.optionB.trim() || !q.optionC.trim() || !q.optionD.trim()
  );

  const stepTitles = ["Info", "Questions", "Settings", "Review"];
  const currentStepIndex = step === "info" ? 0 : step === "questions" ? 1 : step === "settings" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <button
          onClick={() => {
            if (step === "questions") setStep("info");
            else if (step === "settings") setStep("questions");
            else if (step === "review") setStep("settings");
            else if (step === "success") onClose();
            else onClose();
          }}
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <h1 className="text-white font-bold flex-1">Create MCQ Test</h1>
        <span className="text-xs text-zinc-500">{questions.length} Q</span>
      </div>

      {step !== "success" && (
        <div className="px-4 py-3 border-b border-zinc-800">
          <div className="grid grid-cols-4 gap-2">
            {stepTitles.map((label, idx) => (
              <div key={label} className="text-center">
                <div
                  className={cn(
                    "h-1.5 rounded-full mb-1",
                    idx <= currentStepIndex ? "bg-violet-500" : "bg-zinc-800"
                  )}
                />
                <p className={cn("text-[10px]", idx === currentStepIndex ? "text-violet-300" : "text-zinc-500")}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === "info" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Input placeholder="Test Title *" value={title} onChange={e => setTitle(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white" />
          <Input placeholder="Subject (Math, Science...)" value={subject} onChange={e => setSubject(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white" />

          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Class</label>
            <div className="flex gap-2 flex-wrap">
              {["Class 8", "Class 9", "Class 10", "Class 11", "Class 12"].map(c => (
                <button
                  key={c}
                  onClick={() => setClassLevel(c)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs border",
                    classLevel === c ? "bg-violet-500/20 border-violet-500 text-violet-300" : "border-zinc-700 text-zinc-400"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Difficulty</label>
            <div className="flex gap-2">
              {["Easy", "Medium", "Hard"].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs border",
                    difficulty === d ? "bg-violet-500/20 border-violet-500 text-violet-300" : "border-zinc-700 text-zinc-400"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <Textarea placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-white min-h-[80px]" />
          <Button className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={!title.trim()}
            onClick={() => setStep("questions")}>
            Next: Add Questions →
          </Button>
        </div>
      ) : step === "questions" ? (
        <>
          {/* Question tabs */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-zinc-800">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setActiveQ(i)}
                className={cn("min-w-[32px] h-8 rounded-lg text-xs font-bold transition-all",
                  activeQ === i ? "bg-violet-600 text-white" :
                    (i < questions.length && q ? "bg-zinc-800 text-zinc-300" : "bg-zinc-900 text-zinc-500"))}>
                {i + 1}
              </button>
            ))}
            <button onClick={addQuestion}
              className="min-w-[32px] h-8 rounded-lg text-xs font-bold bg-zinc-800 text-violet-400 transition-all">
              <Plus className="w-4 h-4 mx-auto" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">Question {activeQ + 1}</span>
              {questions.length > 1 && (
                <button onClick={() => removeQuestion(activeQ)} className="text-red-400 text-xs">Remove</button>
              )}
            </div>

            <Textarea placeholder="Enter question *" value={q.question} onChange={e => updateQ("question", e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white min-h-[80px]" />

            {(["A", "B", "C", "D"] as const).map(opt => (
              <div key={opt} className="flex gap-2 items-center">
                <button
                  onClick={() => updateQ("correctOption", opt)}
                  className={cn("w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-all",
                    q.correctOption === opt ? "bg-green-500 text-white" : "bg-zinc-800 text-zinc-400")}
                >
                  {opt}
                </button>
                <Input
                  placeholder={`Option ${opt} *`}
                  value={q[`option${opt}` as keyof QForm]}
                  onChange={e => updateQ(`option${opt}` as keyof QForm, e.target.value)}
                  className={cn("bg-zinc-900 border-zinc-700 text-white",
                    q.correctOption === opt && "border-green-600")}
                />
              </div>
            ))}

            <Input placeholder="Explanation (optional)" value={q.explanation}
              onChange={e => updateQ("explanation", e.target.value)}
              className="bg-zinc-900 border-zinc-700 text-white" />
          </div>

          <div className="p-4 border-t border-zinc-800">
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700"
              disabled={!isQuestionStepValid}
              onClick={() => setStep("settings")}
            >
              Next: Settings →
            </Button>
          </div>
        </>
      ) : step === "settings" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-2 block">Time Limit</label>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 15, 20, 30, 45, 60].map(min => (
                <button
                  key={min}
                  onClick={() => setTimer(min)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs border",
                    timer === min ? "bg-violet-500/20 border-violet-500 text-violet-300" : "border-zinc-700 text-zinc-400"
                  )}
                >
                  {min} min
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Marks per question</label>
              <Input type="number" min={1} max={10} value={marks} onChange={e => setMarks(Number(e.target.value) || 1)}
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Negative marking</label>
              <Input type="number" min={0} max={5} step={0.25} value={negativeMarking}
                onChange={e => setNegativeMarking(Number(e.target.value) || 0)}
                className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
          </div>

          <div className="space-y-2">
            {[
              { label: "Shuffle Questions", value: shuffleQuestions, setter: setShuffleQuestions },
              { label: "Show Result After Submit", value: showResult, setter: setShowResult },
              { label: "Show Leaderboard", value: showLeaderboard, setter: setShowLeaderboard },
              { label: "Schedule Test", value: isScheduled, setter: setIsScheduled },
              { label: "One Attempt Only", value: oneAttemptOnly, setter: setOneAttemptOnly },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => item.setter(!item.value)}
                className="w-full flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2"
              >
                <span className="text-sm text-zinc-200">{item.label}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", item.value ? "bg-green-500/20 text-green-300" : "bg-zinc-700 text-zinc-300")}>{item.value ? "ON" : "OFF"}</span>
              </button>
            ))}
          </div>

          <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => setStep("review")}>Next: Review →</Button>
        </div>
      ) : step === "review" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-3 space-y-2">
            <p className="text-white font-semibold">{title}</p>
            <p className="text-xs text-zinc-400">{subject || "General"} • {classLevel} • {difficulty}</p>
            <p className="text-xs text-zinc-400">{questions.length} Questions • {timer} min • {marks} mark each</p>
            <p className="text-xs text-zinc-400">Negative: {negativeMarking} • Leaderboard: {showLeaderboard ? "Yes" : "No"}</p>
            {desc && <p className="text-xs text-zinc-500">{desc}</p>}
          </div>

          <div className="space-y-2">
            <p className="text-sm text-zinc-300 font-medium">Questions Preview</p>
            {questions.map((item, idx) => (
              <div key={idx} className="bg-zinc-900 rounded-xl border border-zinc-800 p-3">
                <p className="text-sm text-white mb-2">Q{idx + 1}. {item.question}</p>
                <p className="text-xs text-zinc-400">Correct: {item.correctOption}</p>
              </div>
            ))}
          </div>

          <Button
            className="w-full bg-gradient-to-r from-pink-500 to-violet-600 hover:opacity-95"
            disabled={mutation.isPending || !isQuestionStepValid || !title.trim()}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Publishing..." : "Publish Test 🚀"}
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-white font-semibold">Test Published Successfully</p>
            <p className="text-zinc-400 text-sm mt-1">{publishedTitle || title}</p>
            <Button className="w-full mt-4 bg-violet-600 hover:bg-violet-700" onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Take Test ────────────────────────────────────────────────────────────────
function TakeTest({ testId, onClose, onResult }: {
  testId: number; onClose: () => void;
  onResult: (r: { attemptId: number; score: number; totalMarks: number; percentage: number }) => void;
}) {
  const { data: test, isLoading } = useQuery<TestWithQuestions>({
    queryKey: [`/api/tests/${testId}`],
    queryFn: () => fetch(`/api/tests/${testId}`).then(r => r.json()),
  });

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<{ questionId: number; selectedOption: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [startTime, setStartTime] = useState(0);

  const qc = useQueryClient();
  const submitMutation = useMutation({
    mutationFn: async () => {
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const r = await fetch(`/api/tests/${testId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeTaken }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [`/api/tests/${testId}/leaderboard`] });
      onResult(data);
    },
  });

  // Timer
  useEffect(() => {
    if (!started || !test) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) { clearInterval(interval); submitMutation.mutate(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [started, test]);

  if (isLoading || !test) return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div className="text-white">Loading test...</div>
    </div>
  );

  if (!started) return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mb-4">
        <ClipboardList className="w-8 h-8 text-violet-400" />
      </div>
      <h1 className="text-white text-xl font-bold mb-2">{test.title}</h1>
      {test.description && <p className="text-zinc-400 text-sm mb-4">{test.description}</p>}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-6">
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{test.total_questions}</div>
          <div className="text-zinc-500 text-xs">Questions</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{test.timer_minutes}m</div>
          <div className="text-zinc-500 text-xs">Timer</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{test.total_questions * test.marks_per_question}</div>
          <div className="text-zinc-500 text-xs">Total Marks</div>
        </div>
      </div>
      <div className="flex gap-3 w-full max-w-xs">
        <Button variant="outline" className="flex-1 border-zinc-700 text-zinc-400" onClick={onClose}>Cancel</Button>
        <Button className="flex-1 bg-violet-600 hover:bg-violet-700" onClick={() => {
          setStarted(true);
          setStartTime(Date.now());
          setTimeLeft(test.timer_minutes * 60);
        }}>Start Test</Button>
      </div>
    </div>
  );

  const question = test.questions[currentQ];
  const selectedOption = answers.find(a => a.questionId === question.id)?.selectedOption;
  const timerPerc = timeLeft !== null ? (timeLeft / (test.timer_minutes * 60)) * 100 : 100;
  const timerColor = timerPerc > 50 ? "bg-green-500" : timerPerc > 20 ? "bg-yellow-500" : "bg-red-500";

  const selectOption = (opt: string) => {
    setAnswers(prev => {
      const existing = prev.findIndex(a => a.questionId === question.id);
      if (existing >= 0) return prev.map((a, i) => i === existing ? { ...a, selectedOption: opt } : a);
      return [...prev, { questionId: question.id, selectedOption: opt }];
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-white font-medium text-sm">{currentQ + 1} / {test.questions.length}</span>
          <div className="flex items-center gap-1 text-sm">
            <Clock className="w-4 h-4 text-zinc-400" />
            <span className={timeLeft !== null && timeLeft < 60 ? "text-red-400 font-bold" : "text-zinc-300"}>
              {timeLeft !== null ? formatTime(timeLeft) : "--:--"}
            </span>
          </div>
        </div>
        {/* Timer bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-1000", timerColor)}
            style={{ width: `${timerPerc}%` }} />
        </div>
        {/* Progress dots */}
        <div className="flex gap-1 mt-2 justify-center">
          {test.questions.map((_, i) => {
            const answered = answers.some(a => a.questionId === test.questions[i].id);
            return (
              <div key={i}
                className={cn("w-2 h-2 rounded-full transition-all",
                  i === currentQ ? "bg-violet-500 w-4" : answered ? "bg-green-500" : "bg-zinc-700")}
              />
            );
          })}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-white font-semibold text-base mb-5 leading-relaxed">{question.question}</p>

        <div className="space-y-3">
          {(["A", "B", "C", "D"] as const).map(opt => {
            const text = question[`option_${opt.toLowerCase()}` as keyof TestQuestion] as string;
            const isSelected = selectedOption === opt;
            return (
              <button key={opt}
                onClick={() => selectOption(opt)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all",
                  isSelected
                    ? "border-violet-500 bg-violet-500/20 text-white"
                    : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                )}
              >
                <span className={cn("w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  isSelected ? "bg-violet-500 text-white" : "bg-zinc-700 text-zinc-400")}>
                  {opt}
                </span>
                <span className="text-sm leading-snug">{text}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800 flex gap-3">
        {currentQ > 0 && (
          <Button variant="outline" className="border-zinc-700 text-zinc-400"
            onClick={() => setCurrentQ(prev => prev - 1)}>
            ← Prev
          </Button>
        )}
        {currentQ < test.questions.length - 1 ? (
          <Button className="flex-1 bg-violet-600 hover:bg-violet-700"
            onClick={() => setCurrentQ(prev => prev + 1)}>
            Next →
          </Button>
        ) : (
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? "Submitting..." : "Submit Test"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Test Result ──────────────────────────────────────────────────────────────
function TestResult({ result, testId, onClose, onLeaderboard }: {
  result: { attemptId: number; score: number; totalMarks: number; percentage: number };
  testId: number; onClose: () => void; onLeaderboard: () => void;
}) {
  const { data: attemptDetail } = useQuery({
    queryKey: [`/api/attempts/${result.attemptId}`],
    queryFn: () => fetch(`/api/attempts/${result.attemptId}`).then(r => r.json()),
  });

  const pct = result.percentage;
  const color = pct >= 80 ? "text-green-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  const emoji = pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "📚";

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <button onClick={onClose}><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>
        <h1 className="text-white font-bold">Test Result</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Score card */}
        <div className="bg-zinc-900 rounded-2xl p-5 text-center mb-4">
          <div className="text-4xl mb-2">{emoji}</div>
          <div className={cn("text-5xl font-black mb-1", color)}>{pct}%</div>
          <div className="text-zinc-400 text-sm">{result.score} / {result.totalMarks} marks</div>
          <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-1000",
              pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500")}
              style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Button className="w-full mb-4 bg-violet-600/20 border border-violet-500/40 text-violet-300 hover:bg-violet-600/30"
          onClick={onLeaderboard}>
          <Trophy className="w-4 h-4 mr-2" /> View Leaderboard
        </Button>

        {/* Answer review */}
        {attemptDetail?.answers && (
          <div className="space-y-3">
            <h3 className="text-white font-semibold text-sm">Answer Review</h3>
            {attemptDetail.answers.map((ans: any, i: number) => (
              <div key={ans.question_id}
                className={cn("bg-zinc-900 rounded-xl p-4 border",
                  ans.is_correct ? "border-green-600/40" : "border-red-600/40")}>
                <div className="flex gap-2 items-start mb-2">
                  {ans.is_correct
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                    : <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
                  <p className="text-white text-sm leading-snug">{ans.question}</p>
                </div>
                <div className="ml-6 space-y-1">
                  {(["a", "b", "c", "d"] as const).map(opt => {
                    const text = ans[`option_${opt}`];
                    const optUpper = opt.toUpperCase();
                    const isCorrect = optUpper === ans.correct_option;
                    const isSelected = optUpper === ans.selected_option;
                    return (
                      <div key={opt} className={cn("text-xs px-2 py-1 rounded flex items-center gap-1",
                        isCorrect ? "bg-green-500/20 text-green-300" :
                          isSelected ? "bg-red-500/20 text-red-300" : "text-zinc-500")}>
                        <span className="font-bold">{optUpper}.</span> {text}
                        {isCorrect && <span className="ml-auto">✓</span>}
                        {isSelected && !isCorrect && <span className="ml-auto">✗</span>}
                      </div>
                    );
                  })}
                  {ans.explanation && (
                    <p className="text-xs text-zinc-500 mt-1 italic">💡 {ans.explanation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
function Leaderboard({ testId, testTitle, onClose }: { testId: number; testTitle: string; onClose: () => void }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const { data: board = [] } = useQuery<LeaderboardEntry[]>({
    queryKey: [`/api/tests/${testId}/leaderboard`],
    queryFn: () => fetch(`/api/tests/${testId}/leaderboard`).then(r => r.json()),
  });

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
        <button onClick={onClose}><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>
        <div className="flex-1">
          <h1 className="text-white font-bold">Leaderboard</h1>
          <p className="text-zinc-500 text-xs">{testTitle}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex gap-2 mb-4">
          {[
            { key: "daily", label: "Daily" },
            { key: "weekly", label: "Weekly" },
            { key: "monthly", label: "Monthly" },
          ].map((item) => (
            <button key={item.key} onClick={() => setPeriod(item.key as any)} className={cn("rounded-full px-3 py-1.5 text-xs border", period === item.key ? "border-violet-500 bg-violet-500/10 text-white" : "border-zinc-700 text-zinc-400")}>
              {item.label}
            </button>
          ))}
        </div>
        {board.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-500">Top score</p>
              <p className="text-lg font-bold text-white">{board[0]?.score}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-500">Top 10</p>
              <p className="text-lg font-bold text-white">{Math.min(board.length, 10)}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <p className="text-[11px] text-zinc-500">Reward</p>
              <p className="text-lg font-bold text-amber-300">{period === "daily" ? "50" : period === "weekly" ? "250" : "1000"} coins</p>
            </div>
          </div>
        )}
        {board.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">No attempts yet</div>
        ) : (
          <div className="space-y-2">
            {board.slice(0, 10).map((entry, i) => {
              const isMe = entry.user_id === (user as any)?.id;
              const pct = entry.total_marks > 0 ? Math.round((entry.score / entry.total_marks) * 100) : 0;
              const badge = i === 0 ? "Champion" : i < 3 ? "Elite" : i < 10 ? "Top 10" : "Active";
              return (
                <div key={entry.user_id}
                  className={cn("flex items-center gap-3 p-3 rounded-xl",
                    isMe ? "bg-violet-500/20 border border-violet-500/40" : "bg-zinc-900")}>
                  <div className="w-8 text-center text-lg">
                    {i < 3 ? medals[i] : <span className="text-zinc-500 text-sm font-bold">#{entry.rank}</span>}
                  </div>
                  <Avatar url={entry.profile_image_url} name={entry.first_name} size={9} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {entry.first_name} {entry.last_name}
                      {isMe && <span className="ml-1 text-violet-400 text-xs">(You)</span>}
                    </div>
                    <div className="text-zinc-500 text-xs">{formatTime(entry.time_taken)} • {pct}%</div>
                    <div className="mt-1 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300">{badge}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-bold">{entry.score}</div>
                    <div className="text-zinc-500 text-xs">/{entry.total_marks}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Group Detail ─────────────────────────────────────────────────────────────
function GroupDetail({ groupId, onBack }: { groupId: number; onBack: () => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [activeTest, setActiveTest] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [viewLeaderboard, setViewLeaderboard] = useState<{ testId: number; title: string } | null>(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [postText, setPostText] = useState("");
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editPublic, setEditPublic] = useState(true);
  const [permMessages, setPermMessages] = useState(true);
  const [permMedia, setPermMedia] = useState(true);
  const [permLinks, setPermLinks] = useState(true);
  const [permPolls, setPermPolls] = useState(true);
  const [memberToAdd, setMemberToAdd] = useState("");
  const composerRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const noteFileInputRef = useRef<HTMLInputElement | null>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [noteKind, setNoteKind] = useState<"pdf" | "image" | "voice">("pdf");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDescription, setNoteDescription] = useState("");
  const [notePrice, setNotePrice] = useState("0");
  const [noteFileUrl, setNoteFileUrl] = useState("");
  const [noteFileName, setNoteFileName] = useState("");
  const [noteUploading, setNoteUploading] = useState(false);
  const [showDiscussionBoard, setShowDiscussionBoard] = useState(false);
  const [showAlertsPanel, setShowAlertsPanel] = useState(false);
  const [showGoalTracker, setShowGoalTracker] = useState(false);
  const [showEarnPanel, setShowEarnPanel] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalProgress, setGoalProgress] = useState(35);
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [discussionMeta, setDiscussionMeta] = useState<Record<number, { votes: number; solved: boolean; bestReplyId?: number; replies: Array<{ id: number; text: string; userName: string; votes: number; createdAt: string }> }>>({});
  const [downloadCounts, setDownloadCounts] = useState<Record<number, number>>({});

  const { data: group } = useQuery<Group & { my_role?: string }>({
    queryKey: [`/api/groups/${groupId}`],
    queryFn: () => fetch(`/api/groups/${groupId}`).then(r => r.json()),
  });
  const { data: feed = [] } = useQuery<GroupPost[]>({
    queryKey: [`/api/groups/${groupId}/posts`],
    queryFn: () => fetch(`/api/groups/${groupId}/posts`).then(r => r.json()),
  });
  const { data: groupTests = [] } = useQuery<any[]>({
    queryKey: [`/api/groups/${groupId}/tests`],
    queryFn: () => fetch(`/api/groups/${groupId}/tests`).then(r => r.json()),
  });
  const { data: myStats = [] } = useQuery<any[]>({
    queryKey: ["/api/me/test-stats"],
    queryFn: () => fetch("/api/me/test-stats").then(r => r.json()),
  });
  const { data: members = [] } = useQuery<GroupMemberEntry[]>({
    queryKey: [`/api/groups/${groupId}/members`],
    queryFn: () => fetch(`/api/groups/${groupId}/members`).then(r => r.json()),
  });
  const { data: joinRequests = [] } = useQuery<JoinRequestEntry[]>({
    queryKey: [`/api/groups/${groupId}/join-requests`],
    queryFn: () => fetch(`/api/groups/${groupId}/join-requests`).then(r => r.json()),
    enabled: group?.my_role === "admin",
  });

  const joinMutation = useMutation({
    mutationFn: () => fetch(`/api/groups/${groupId}/join`, { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/members`] });
      qc.invalidateQueries({ queryKey: ["/api/groups"] });
    },
  });
  const postMutation = useMutation({
    mutationFn: (payload?: { content?: string; imageUrl?: string | null; type?: string; testId?: number | null }) => fetch(`/api/groups/${groupId}/posts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: payload?.content ?? postText,
        imageUrl: payload?.imageUrl,
        type: payload?.type,
        testId: payload?.testId,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      setPostText("");
      setNoteTitle("");
      setNoteDescription("");
      setNotePrice("0");
      setNoteFileUrl("");
      setNoteFileName("");
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/posts`] });
    },
  });
  const groupBasicsMutation = useMutation({
    mutationFn: () => fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDesc,
        imageUrl: editImage || null,
        isPublic: editPublic,
      }),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
      qc.invalidateQueries({ queryKey: ["/api/groups"] });
    },
  });
  const permissionMutation = useMutation({
    mutationFn: () => fetch(`/api/groups/${groupId}/permissions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canSendMessages: permMessages,
        canSendMedia: permMedia,
        canShareLinks: permLinks,
        canCreatePolls: permPolls,
      }),
    }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] }),
  });
  const memberActionMutation = useMutation({
    mutationFn: async (payload: { endpoint: string; method?: "POST" | "DELETE"; body?: any }) => {
      const r = await fetch(payload.endpoint, {
        method: payload.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: payload.body ? JSON.stringify(payload.body) : undefined,
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/members`] });
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
    },
  });
  const joinRequestActionMutation = useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: "approve" | "reject" }) =>
      fetch(`/api/groups/${groupId}/join-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/join-requests`] });
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}/members`] });
      qc.invalidateQueries({ queryKey: [`/api/groups/${groupId}`] });
    },
  });

  useEffect(() => {
    if (!group) return;
    setEditName(group.name || "");
    setEditDesc(group.description || "");
    setEditImage(group.image_url || "");
    setEditPublic(group.is_public);
    setPermMessages(group.can_send_messages);
    setPermMedia(group.can_send_media);
    setPermLinks(group.can_share_links);
    setPermPolls(group.can_create_polls);
  }, [group]);

  useEffect(() => {
    const savedGoal = localStorage.getItem(`group-goal-${groupId}`);
    const savedDiscussion = localStorage.getItem(`group-discussion-meta-${groupId}`);
    const savedDownloads = localStorage.getItem(`group-note-downloads-${groupId}`);
    const savedFocus = localStorage.getItem(`group-focus-mode-${groupId}`);
    if (savedGoal) {
      const parsed = safeJsonParse<{ name: string; progress: number }>(savedGoal);
      if (parsed) {
        setGoalName(parsed.name || "");
        setGoalProgress(parsed.progress || 0);
      }
    }
    if (savedDiscussion) {
      const parsed = safeJsonParse<Record<number, { votes: number; solved: boolean; bestReplyId?: number; replies: Array<{ id: number; text: string; userName: string; votes: number; createdAt: string }> }>>(savedDiscussion);
      if (parsed) setDiscussionMeta(parsed);
    }
    if (savedDownloads) {
      const parsed = safeJsonParse<Record<number, number>>(savedDownloads);
      if (parsed) setDownloadCounts(parsed);
    }
    setFocusMode(savedFocus === "1");
  }, [groupId]);

  useEffect(() => {
    localStorage.setItem(`group-goal-${groupId}`, JSON.stringify({ name: goalName, progress: goalProgress }));
  }, [groupId, goalName, goalProgress]);

  useEffect(() => {
    localStorage.setItem(`group-discussion-meta-${groupId}`, JSON.stringify(discussionMeta));
  }, [groupId, discussionMeta]);

  useEffect(() => {
    localStorage.setItem(`group-note-downloads-${groupId}`, JSON.stringify(downloadCounts));
  }, [groupId, downloadCounts]);

  useEffect(() => {
    localStorage.setItem(`group-focus-mode-${groupId}`, focusMode ? "1" : "0");
  }, [groupId, focusMode]);

  if (!group) return <div className="fixed inset-0 bg-black flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full" /></div>;

  const isAdmin = group.my_role === "admin";
  const isMember = group.is_member;
  const joinPending = !isMember && group.my_join_request_status === "pending";
  const groupStats = myStats.filter((s: any) => Number(s.group_id) === groupId);
  const topScore = groupStats.reduce((max: number, s: any) => {
    const pct = s.total_marks ? Math.round((s.score / s.total_marks) * 100) : 0;
    return Math.max(max, pct);
  }, 0);
  const analyticsSeries = groupStats.slice(-6).map((s: any) => s.total_marks ? Math.round((s.score / s.total_marks) * 100) : 0);
  const latestAccuracy = analyticsSeries[analyticsSeries.length - 1] || 0;
  const previousAccuracy = analyticsSeries.length > 1 ? analyticsSeries[analyticsSeries.length - 2] : latestAccuracy;
  const rankTrendLabel = previousAccuracy ? `${previousAccuracy}% → ${latestAccuracy}%` : `${latestAccuracy}%`;
  const consistencyStreak = calculateStreak(groupStats.map((s: any) => s.completed_at || s.completedAt || new Date().toISOString()));
  const subjectMap = groupStats.reduce((acc: Record<string, { total: number; count: number }>, stat: any) => {
    const subject = detectSubject(stat.title);
    const pct = stat.total_marks ? Math.round((stat.score / stat.total_marks) * 100) : 0;
    acc[subject] = acc[subject] || { total: 0, count: 0 };
    acc[subject].total += pct;
    acc[subject].count += 1;
    return acc;
  }, {});
  const subjectPerformance = Object.entries(subjectMap).map(([subject, value]) => ({
    subject,
    accuracy: Math.round(value.total / Math.max(value.count, 1)),
  }));
  const discussionPosts = feed.filter((post) => post.type === "discussion" || post.content?.startsWith("❓"));
  const alertPosts = feed.filter((post) => post.type === "alert" || post.content?.startsWith("🔔"));
  const notePosts = feed.filter((post) => post.type.startsWith("note-"));
  const visibleFeed = focusMode
    ? feed.filter((post) => ["test", "discussion", "alert"].includes(post.type) || post.type.startsWith("note-"))
    : feed;
  const paidNoteCount = notePosts.filter((post) => {
    const meta = safeJsonParse<{ price?: number }>(post.content);
    return (meta?.price || 0) > 0;
  }).length;
  const estimatedEarnings = notePosts.reduce((sum, post) => {
    const meta = safeJsonParse<{ price?: number }>(post.content);
    return sum + (meta?.price || 0);
  }, 0) + groupTests.length * 5;

  const focusComposer = (presetText?: string) => {
    if (!isMember) {
      toast({ title: "Join this group first", description: "You need to join before posting or using group discussion tools." });
      return;
    }
    if (presetText !== undefined) {
      setPostText(presetText);
    }
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => composerInputRef.current?.focus(), 150);
  };

  const openCreateTest = () => {
    if (!isAdmin) {
      toast({ title: "Admin only", description: "Only group admins can create daily tests." });
      return;
    }
    setShowCreateTest(true);
  };

  const openLatestLeaderboard = () => {
    const latest = groupTests[0];
    if (!latest) {
      toast({ title: "No test found", description: "Create or attempt a test first to unlock the leaderboard." });
      return;
    }
    setViewLeaderboard({ testId: latest.id, title: latest.title });
  };

  const openPerformance = () => {
    if (!groupStats.length) {
      toast({ title: "No performance data yet", description: "Attempt a group test first to see score trends and weak areas." });
      return;
    }
    setShowPerformance(true);
  };

  const startDiscussion = () => focusComposer("❓ Doubt: ");
  const startNotesPost = () => focusComposer("📚 Notes: Title\n🔗 Topic: \n📝 Summary: ");
  const startSmartAlert = () => focusComposer("🔔 Smart Alert: Test at 8 PM\n✅ Topic: \n⏰ Reminder: ");

  const handleNoteFile = async (file?: File | null) => {
    if (!file) return;
    setNoteUploading(true);
    try {
      if (noteKind === "pdf") {
        const formData = new FormData();
        formData.append("pdf", file);
        const response = await fetch("/api/upload/book-pdf", { method: "POST", credentials: "include", body: formData });
        if (!response.ok) throw new Error("PDF upload failed");
        const body = await response.json();
        setNoteFileUrl(body.pdfUrl || "");
        setNoteFileName(file.name);
      } else {
        const dataUrl = await readFileAsDataUrl(file);
        setNoteFileUrl(dataUrl);
        setNoteFileName(file.name);
      }
    } catch (error: any) {
      toast({ title: "Upload failed", description: error?.message || "Could not upload note file" });
    } finally {
      setNoteUploading(false);
    }
  };

  const submitNote = () => {
    if (!noteTitle.trim() || !noteFileUrl) {
      toast({ title: "Incomplete note", description: "Add title and file before posting notes." });
      return;
    }
    const meta = JSON.stringify({
      title: noteTitle.trim(),
      description: noteDescription.trim(),
      price: Number(notePrice || 0),
      fileUrl: noteFileUrl,
      fileName: noteFileName,
      kind: noteKind,
      creator: `${(user as any)?.firstName || "Creator"}`,
    });
    postMutation.mutate({
      content: meta,
      imageUrl: noteKind === "image" ? noteFileUrl : null,
      type: `note-${noteKind}`,
    });
    setShowNotesModal(false);
  };

  const voteDiscussion = (postId: number, delta: number) => {
    setDiscussionMeta((prev) => ({
      ...prev,
      [postId]: {
        votes: (prev[postId]?.votes || 0) + delta,
        solved: prev[postId]?.solved || false,
        bestReplyId: prev[postId]?.bestReplyId,
        replies: prev[postId]?.replies || [],
      },
    }));
  };

  const addReply = () => {
    if (!selectedDiscussionId || !replyDraft.trim()) return;
    setDiscussionMeta((prev) => ({
      ...prev,
      [selectedDiscussionId]: {
        votes: prev[selectedDiscussionId]?.votes || 0,
        solved: prev[selectedDiscussionId]?.solved || false,
        bestReplyId: prev[selectedDiscussionId]?.bestReplyId,
        replies: [
          ...(prev[selectedDiscussionId]?.replies || []),
          {
            id: Date.now(),
            text: replyDraft.trim(),
            userName: `${(user as any)?.firstName || "You"}`,
            votes: 0,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }));
    setReplyDraft("");
  };

  const trackDownload = (postId: number) => {
    setDownloadCounts((prev) => ({ ...prev, [postId]: (prev[postId] || 0) + 1 }));
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-zinc-800">
          <button onClick={onBack}><ArrowLeft className="w-5 h-5 text-zinc-400" /></button>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
            {group.image_url ? <img src={group.image_url} className="w-full h-full object-cover" /> : <Users className="w-5 h-5 text-white" />}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold truncate">{group.name}</h1>
            <p className="text-zinc-500 text-xs">{group.member_count} members</p>
          </div>
          {!isMember ? (
            <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-xs"
              disabled={joinPending || joinMutation.isPending}
              onClick={() => joinMutation.mutate()}>
              {joinPending ? "Pending" : (group.is_public ? "Join" : "Request")}
            </Button>
          ) : isAdmin ? (
            <button onClick={() => setShowCreateTest(true)}
              className="flex items-center gap-1 bg-violet-600/20 border border-violet-500/40 text-violet-300 rounded-lg px-3 py-1.5 text-xs font-medium">
              <Plus className="w-3 h-3" /> Test
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Stats strip */}
          <div className="px-3 pt-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-violet-300 text-lg font-bold">{groupTests.length}</p>
                <p className="text-[10px] text-zinc-500">Tests</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-violet-300 text-lg font-bold">{group.member_count}</p>
                <p className="text-[10px] text-zinc-500">Members</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-violet-300 text-lg font-bold">{topScore}%</p>
                <p className="text-[10px] text-zinc-500">Top Score</p>
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="px-3 pt-3 space-y-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4 text-violet-300" />
                  <p className="text-white text-sm font-semibold">Basic Controls</p>
                </div>
                <div className="space-y-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Group Name" className="bg-zinc-950 border-zinc-700 text-white" />
                  <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Group Description" className="bg-zinc-950 border-zinc-700 text-white min-h-[70px]" />
                  <Input value={editImage} onChange={e => setEditImage(e.target.value)} placeholder="Group Profile Photo URL" className="bg-zinc-950 border-zinc-700 text-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setEditPublic(true)}
                      className={cn("rounded-lg border px-3 py-2 text-xs", editPublic ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400")}
                    >
                      Public 🌍
                    </button>
                    <button
                      onClick={() => setEditPublic(false)}
                      className={cn("rounded-lg border px-3 py-2 text-xs", !editPublic ? "border-violet-500 bg-violet-500/20 text-violet-300" : "border-zinc-700 text-zinc-400")}
                    >
                      Private 🔒
                    </button>
                  </div>
                  <Button
                    size="sm"
                    className="w-full bg-violet-600 hover:bg-violet-700"
                    disabled={groupBasicsMutation.isPending || !editName.trim()}
                    onClick={() => groupBasicsMutation.mutate()}
                  >
                    Save Group Settings
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-300" />
                  <p className="text-white text-sm font-semibold">Permission Settings</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPermMessages(v => !v)} className={cn("rounded-lg border px-3 py-2 text-xs text-left", permMessages ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}>Messages</button>
                  <button onClick={() => setPermMedia(v => !v)} className={cn("rounded-lg border px-3 py-2 text-xs text-left", permMedia ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}>Media</button>
                  <button onClick={() => setPermLinks(v => !v)} className={cn("rounded-lg border px-3 py-2 text-xs text-left", permLinks ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}>Link Share</button>
                  <button onClick={() => setPermPolls(v => !v)} className={cn("rounded-lg border px-3 py-2 text-xs text-left", permPolls ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 text-zinc-400")}>Poll / MCQ</button>
                </div>
                <Button
                  size="sm"
                  className="mt-2 w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={permissionMutation.isPending}
                  onClick={() => permissionMutation.mutate()}
                >
                  Save Permissions
                </Button>
              </div>

              {!group.is_public && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <p className="text-white text-sm font-semibold mb-2">Join Requests ({joinRequests.length})</p>
                  {joinRequests.length === 0 ? (
                    <p className="text-zinc-500 text-xs">No pending requests</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {joinRequests.map(reqItem => (
                        <div key={reqItem.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar url={reqItem.profile_image_url} name={reqItem.first_name} size={8} />
                            <div className="min-w-0 flex-1">
                              <p className="text-white text-xs truncate">{reqItem.first_name} {reqItem.last_name}</p>
                              <p className="text-zinc-500 text-[11px]">@{reqItem.username || "user"}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button className="rounded-md bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-xs py-1.5" onClick={() => joinRequestActionMutation.mutate({ requestId: reqItem.id, action: "approve" })}>Approve</button>
                            <button className="rounded-md bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs py-1.5" onClick={() => joinRequestActionMutation.mutate({ requestId: reqItem.id, action: "reject" })}>Reject</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <p className="text-white text-sm font-semibold mb-2">Member Management</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={memberToAdd}
                    onChange={e => setMemberToAdd(e.target.value)}
                    placeholder="Add by userId"
                    className="bg-zinc-950 border-zinc-700 text-white text-xs"
                  />
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-xs"
                    disabled={!memberToAdd.trim()}
                    onClick={() => {
                      memberActionMutation.mutate({ endpoint: `/api/groups/${groupId}/members`, body: { userId: memberToAdd.trim() } });
                      setMemberToAdd("");
                    }}
                  >
                    Add
                  </Button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {members.map(m => {
                    const isSelf = m.id === user?.id;
                    return (
                      <div key={m.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar url={m.profile_image_url} name={m.first_name} size={8} />
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-xs truncate">{m.first_name} {m.last_name}</p>
                            <p className="text-zinc-500 text-[11px]">@{m.username || "user"} • {m.role}{m.is_muted ? " • muted" : ""}{m.is_banned ? " • banned" : ""}</p>
                          </div>
                        </div>
                        {!isSelf && (
                          <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <button className="rounded-md border border-zinc-700 py-1 text-[11px] text-zinc-300 flex items-center justify-center gap-1" onClick={() => memberActionMutation.mutate({ endpoint: `/api/groups/${groupId}/members/${m.id}/role`, body: { role: m.role === "admin" ? "member" : "admin" } })}>{m.role === "admin" ? <UserMinus className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}{m.role === "admin" ? "Remove Admin" : "Make Admin"}</button>
                            <button className="rounded-md border border-zinc-700 py-1 text-[11px] text-zinc-300 flex items-center justify-center gap-1" onClick={() => memberActionMutation.mutate({ endpoint: `/api/groups/${groupId}/members/${m.id}/mute`, body: { muted: !m.is_muted } })}>{m.is_muted ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}{m.is_muted ? "Unmute" : "Mute"}</button>
                            <button className="rounded-md border border-zinc-700 py-1 text-[11px] text-zinc-300 flex items-center justify-center gap-1" onClick={() => memberActionMutation.mutate({ endpoint: `/api/groups/${groupId}/members/${m.id}/ban`, body: { banned: !m.is_banned } })}><Gavel className="w-3 h-3" />{m.is_banned ? "Unban" : "Ban"}</button>
                            <button className="rounded-md border border-rose-500/40 py-1 text-[11px] text-rose-300 flex items-center justify-center gap-1" onClick={() => memberActionMutation.mutate({ endpoint: `/api/groups/${groupId}/members/${m.id}`, method: "DELETE" })}><UserMinus className="w-3 h-3" />Remove</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Feature hub */}
          <div className="px-3 pt-3">
            <div className="bg-zinc-900 rounded-xl p-3 border border-zinc-800">
              <div className="flex items-center justify-between mb-2">
                <p className="text-white text-sm font-semibold">Feature Hub</p>
                <span className="text-[10px] text-zinc-500">Inside this group</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={openCreateTest}
                  className={cn(
                    "rounded-lg p-2 text-left border transition-all",
                    isAdmin ? "border-violet-500/30 bg-violet-500/10" : "border-zinc-700 bg-zinc-800/60"
                  )}
                >
                  <ClipboardList className="w-4 h-4 text-violet-400 mb-1" />
                  <p className="text-xs text-white font-medium">Daily Test</p>
                  <p className="text-[10px] text-zinc-400">Create & share MCQ</p>
                </button>

                <button
                  onClick={openLatestLeaderboard}
                  className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60"
                >
                  <Trophy className="w-4 h-4 text-amber-400 mb-1" />
                  <p className="text-xs text-white font-medium">Leaderboard</p>
                  <p className="text-[10px] text-zinc-400">Group rank by latest test</p>
                </button>

                <button
                  onClick={openPerformance}
                  className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60"
                >
                  <BarChart3 className="w-4 h-4 text-cyan-400 mb-1" />
                  <p className="text-xs text-white font-medium">Performance</p>
                  <p className="text-[10px] text-zinc-400">Track score & weak area</p>
                </button>

                <button
                  onClick={() => setShowDiscussionBoard(true)}
                  className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60"
                >
                  <MessageCircle className="w-4 h-4 text-pink-400 mb-1" />
                  <p className="text-xs text-white font-medium">Discussion</p>
                  <p className="text-[10px] text-zinc-400">Doubt solving thread</p>
                </button>

                <button onClick={() => setShowNotesModal(true)} className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60">
                  <FileText className="w-4 h-4 text-emerald-400 mb-1" />
                  <p className="text-xs text-white font-medium">Notes Upload</p>
                  <p className="text-[10px] text-zinc-400">Create a notes post template</p>
                </button>

                <button onClick={() => setShowAlertsPanel(true)} className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60">
                  <Bell className="w-4 h-4 text-blue-400 mb-1" />
                  <p className="text-xs text-white font-medium">Smart Alerts</p>
                  <p className="text-[10px] text-zinc-400">Post an alert template instantly</p>
                </button>

                <button
                  onClick={() => setFocusMode((prev) => !prev)}
                  className={cn("rounded-lg p-2 text-left border", focusMode ? "border-emerald-500/30 bg-emerald-500/10" : "border-zinc-700 bg-zinc-800/60")}
                >
                  <Shield className="w-4 h-4 text-emerald-400 mb-1" />
                  <p className="text-xs text-white font-medium">Focus Mode</p>
                  <p className="text-[10px] text-zinc-400">{focusMode ? "Study-only feed active" : "Hide distractions quickly"}</p>
                </button>

                <button onClick={() => setShowGoalTracker(true)} className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60">
                  <Target className="w-4 h-4 text-cyan-400 mb-1" />
                  <p className="text-xs text-white font-medium">Goal Tracker</p>
                  <p className="text-[10px] text-zinc-400">{goalName ? `${goalName} • ${goalProgress}%` : "Set IAS / skill target"}</p>
                </button>

                <button onClick={() => setShowEarnPanel(true)} className="rounded-lg p-2 text-left border border-zinc-700 bg-zinc-800/60">
                  <Wallet className="w-4 h-4 text-amber-400 mb-1" />
                  <p className="text-xs text-white font-medium">Earn</p>
                  <p className="text-[10px] text-zinc-400">Tests + paid notes earning</p>
                </button>
              </div>
            </div>
          </div>

          <div className="px-3 pt-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  <p className="text-white text-xs font-semibold">Quick Analytics</p>
                </div>
                <p className="text-[11px] text-zinc-400">Accuracy: <span className="text-zinc-100">{latestAccuracy}%</span></p>
                <p className="text-[11px] text-zinc-400">Trend: <span className="text-zinc-100">{rankTrendLabel}</span></p>
                <p className="text-[11px] text-zinc-400">Streak: <span className="text-zinc-100">{consistencyStreak} day</span></p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  <p className="text-white text-xs font-semibold">Activity Dashboard</p>
                </div>
                <p className="text-[11px] text-zinc-400">Tests: <span className="text-zinc-100">{groupTests.length}</span></p>
                <p className="text-[11px] text-zinc-400">Threads: <span className="text-zinc-100">{discussionPosts.length}</span></p>
                <p className="text-[11px] text-zinc-400">Alerts: <span className="text-zinc-100">{alertPosts.length}</span></p>
              </div>
            </div>
          </div>

          {/* Post composer (members only) */}
          {isMember && (
            <div ref={composerRef} className="p-3 border-b border-zinc-800/60">
              <div className="flex gap-2">
                <Input
                  ref={composerInputRef}
                  placeholder="Write something..."
                  value={postText}
                  onChange={e => setPostText(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white text-sm"
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && postText.trim() && postMutation.mutate({ content: postText.trim() })}
                />
                <Button size="sm" className="bg-violet-600 hover:bg-violet-700 px-3"
                  disabled={!postText.trim() || postMutation.isPending}
                  onClick={() => postMutation.mutate({ content: postText.trim() })}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Feed */}
          {visibleFeed.length === 0 ? (
            <div className="text-center py-16 text-zinc-500">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{focusMode ? "No study posts in focus mode" : "No posts yet"}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  onClick={openCreateTest}
                  className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold px-3 py-2"
                >
                  Create First Test →
                </button>
                <button
                  onClick={() => focusComposer("Let's start sharing in this group")}
                  className="rounded-lg border border-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2"
                >
                  Post / Share
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {visibleFeed.map(post => {
                const noteMeta = post.type.startsWith("note-") ? safeJsonParse<{ title: string; description?: string; price?: number; fileUrl?: string; fileName?: string; kind?: string; creator?: string }>(post.content) : null;
                const alertMeta = post.type === "alert" ? safeJsonParse<{ title?: string; detail?: string; cta?: string }>(post.content) : null;
                return (
                <div key={post.id} className="bg-zinc-900 rounded-xl p-4">
                  {/* Post author */}
                  <div className="flex items-center gap-2 mb-3">
                    <Avatar url={post.profile_image_url} name={post.first_name} size={8} />
                    <div>
                      <div className="text-white text-sm font-medium">{post.first_name} {post.last_name}</div>
                      <div className="text-zinc-500 text-xs">
                        {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {post.content && !post.type.startsWith("note-") && post.type !== "alert" && (
                    <p className="text-zinc-200 text-sm mb-3">{post.content}</p>
                  )}

                  {noteMeta && (
                    <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-white text-sm font-semibold">{noteMeta.title}</p>
                          {noteMeta.description && <p className="text-zinc-400 text-xs mt-1">{noteMeta.description}</p>}
                        </div>
                        <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
                          {Number(noteMeta.price || 0) > 0 ? `₹${noteMeta.price}` : "Free"}
                        </div>
                      </div>
                      {post.type === "note-image" && post.image_url && (
                        <img src={post.image_url} className="mb-3 max-h-56 w-full rounded-xl object-cover" />
                      )}
                      {post.type === "note-voice" && noteMeta.fileUrl && (
                        <audio controls className="mb-3 w-full">
                          <source src={noteMeta.fileUrl} />
                        </audio>
                      )}
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[11px] text-zinc-400">
                          {noteMeta.fileName || "Study note"} • Downloads {downloadCounts[post.id] || 0}
                        </div>
                        {noteMeta.fileUrl && (
                          <a
                            href={noteMeta.fileUrl}
                            download={noteMeta.fileName || noteMeta.title}
                            onClick={() => trackDownload(post.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {alertMeta && (
                    <div className="mb-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Bell className="w-4 h-4 text-blue-400" />
                        <p className="text-sm font-semibold text-white">{alertMeta.title || "Smart Alert"}</p>
                      </div>
                      <p className="text-xs text-zinc-300">{alertMeta.detail || "Study reminder from your group."}</p>
                      {alertMeta.cta && <p className="text-[11px] text-blue-300 mt-2">{alertMeta.cta}</p>}
                    </div>
                  )}

                  {/* Test card */}
                  {post.type === "test" && post.test_data && (
                    <div className="bg-zinc-800 rounded-xl p-4 border border-violet-500/20">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center shrink-0">
                          <ClipboardList className="w-5 h-5 text-violet-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-semibold text-sm">{post.test_data.title}</div>
                          {post.test_data.description && (
                            <div className="text-zinc-500 text-xs mt-0.5">{post.test_data.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-3 text-xs text-zinc-400 mb-3">
                        <span>{post.test_data.total_questions} Questions</span>
                        <span>•</span>
                        <span>{post.test_data.timer_minutes} Min</span>
                        <span>•</span>
                        <span>{post.test_data.total_questions * post.test_data.marks_per_question} Marks</span>
                      </div>
                      <div className="flex gap-2">
                        {isMember && (
                          <Button size="sm" className="flex-1 bg-violet-600 hover:bg-violet-700 text-xs"
                            onClick={() => setActiveTest(post.test_data.id)}>
                            Attempt Test
                          </Button>
                        )}
                        <Button size="sm" variant="outline"
                          className="border-zinc-700 text-zinc-400 text-xs"
                          onClick={() => setViewLeaderboard({ testId: post.test_data.id, title: post.test_data.title })}>
                          <Trophy className="w-3 h-3 mr-1" /> Rank
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isMember && (
        <div className="fixed bottom-24 right-4 z-[55] flex flex-col items-end gap-2">
          {showFabMenu && (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur">
              {[
                { label: "Discussion", action: () => { setShowFabMenu(false); focusComposer("❓ Discussion Topic: "); } },
                { label: "Announcement", action: () => { setShowFabMenu(false); focusComposer("📢 Announcement: "); } },
                { label: "Notes", action: () => { setShowFabMenu(false); setShowNotesModal(true); } },
                { label: "Alert", action: () => { setShowFabMenu(false); setShowAlertsPanel(true); } },
              ].map((item) => (
                <button key={item.label} onClick={item.action} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-zinc-200 hover:bg-white/5">
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowFabMenu((prev) => !prev)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 text-white shadow-[0_0_24px_rgba(168,85,247,0.45)]"
          >
            <Plus className={cn("w-6 h-6 transition-transform", showFabMenu && "rotate-45")} />
          </button>
        </div>
      )}

      {showCreateTest && <CreateTestModal groupId={groupId} onClose={() => setShowCreateTest(false)} />}
      {activeTest && !testResult && (
        <TakeTest testId={activeTest} onClose={() => setActiveTest(null)}
          onResult={(r) => { setActiveTest(null); setTestResult({ ...r, testId: activeTest }); }} />
      )}
      {testResult && !viewLeaderboard && (
        <TestResult result={testResult} testId={testResult.testId} onClose={() => setTestResult(null)}
          onLeaderboard={() => {
            const t = feed.find(p => p.test_data?.id === testResult.testId);
            setViewLeaderboard({ testId: testResult.testId, title: t?.test_data?.title || "Test" });
          }} />
      )}
      {viewLeaderboard && (
        <Leaderboard testId={viewLeaderboard.testId} testTitle={viewLeaderboard.title}
          onClose={() => setViewLeaderboard(null)} />
      )}
      {showNotesModal && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center p-3" onClick={() => setShowNotesModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold">Upload Notes</p>
              <button onClick={() => setShowNotesModal(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { key: "pdf", label: "PDF", icon: <FileText className="w-4 h-4" /> },
                { key: "image", label: "Image", icon: <ImageIcon className="w-4 h-4" /> },
                { key: "voice", label: "Voice", icon: <Mic className="w-4 h-4" /> },
              ].map((item) => (
                <button key={item.key} onClick={() => { setNoteKind(item.key as any); setNoteFileUrl(""); setNoteFileName(""); }} className={cn("rounded-xl border px-3 py-2 text-xs", noteKind === item.key ? "border-violet-500 bg-violet-500/10 text-white" : "border-zinc-700 text-zinc-400")}>
                  <div className="flex items-center justify-center gap-1">{item.icon}{item.label}</div>
                </button>
              ))}
            </div>
            <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Notes title" className="mb-3 bg-zinc-950 border-zinc-700 text-white" />
            <Textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} placeholder="Notes preview or summary" className="mb-3 bg-zinc-950 border-zinc-700 text-white min-h-[90px]" />
            <Input value={notePrice} onChange={(e) => setNotePrice(e.target.value.replace(/[^\d]/g, ""))} placeholder="Price in rupees (0 for free)" className="mb-3 bg-zinc-950 border-zinc-700 text-white" />
            <input ref={noteFileInputRef} type="file" className="hidden" accept={noteKind === "pdf" ? ".pdf" : noteKind === "image" ? "image/*" : "audio/*"} onChange={(e) => handleNoteFile(e.target.files?.[0] || null)} />
            <button onClick={() => noteFileInputRef.current?.click()} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-zinc-200 mb-3">
              {noteUploading ? "Uploading..." : noteFileName ? `Selected: ${noteFileName}` : `Choose ${noteKind.toUpperCase()} file`}
            </button>
            {noteKind === "image" && noteFileUrl && <img src={noteFileUrl} className="mb-3 max-h-48 w-full rounded-xl object-cover" />}
            {noteKind === "voice" && noteFileUrl && <audio controls className="mb-3 w-full"><source src={noteFileUrl} /></audio>}
            {noteKind === "pdf" && noteFileUrl && <div className="mb-3 rounded-xl bg-zinc-950 p-3 text-xs text-zinc-300">PDF ready for preview and download.</div>}
            <Button onClick={submitNote} className="w-full bg-emerald-600 hover:bg-emerald-700">Post Notes</Button>
          </div>
        </div>
      )}
      {showPerformance && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-3" onClick={() => setShowPerformance(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-semibold">Performance Tracking</p>
              <button onClick={() => setShowPerformance(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            {groupStats.length === 0 ? (
              <p className="text-zinc-400 text-sm">No test attempts yet.</p>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] text-zinc-500">Accuracy</p>
                    <p className="text-xl font-bold text-white">{latestAccuracy}%</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] text-zinc-500">Rank trend</p>
                    <p className="text-xl font-bold text-white">{rankTrendLabel}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] text-zinc-500">Best score</p>
                    <p className="text-xl font-bold text-white">{topScore}%</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <p className="text-[11px] text-zinc-500">Streak</p>
                    <p className="text-xl font-bold text-amber-300">{consistencyStreak} 🔥</p>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-white text-sm font-medium mb-3">Overall score graph</p>
                  <div className="flex items-end gap-2 h-28">
                    {analyticsSeries.map((value, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end gap-1">
                        <div className="w-full rounded-t-lg bg-gradient-to-t from-violet-600 to-cyan-400" style={{ height: `${Math.max(value, 8)}%` }} />
                        <span className="text-[10px] text-zinc-500">T{idx + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                  <p className="text-white text-sm font-medium mb-3">Subject-wise performance</p>
                  <div className="space-y-2">
                    {subjectPerformance.map((item) => (
                      <div key={item.subject}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-zinc-300">{item.subject}</span>
                          <span className="text-zinc-500">{item.accuracy}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400" style={{ width: `${item.accuracy}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {groupStats.slice(0, 12).map((s: any, idx: number) => {
                    const pct = s.total_marks ? Math.round((s.score / s.total_marks) * 100) : 0;
                    return (
                      <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                        <p className="text-zinc-200 text-xs font-medium">{s.title}</p>
                        <p className="text-zinc-500 text-[11px]">{s.score}/{s.total_marks} • {pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showDiscussionBoard && (
        <div className="fixed inset-0 z-[60] bg-black/85 flex items-end justify-center p-3" onClick={() => setShowDiscussionBoard(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-semibold">Discussion Board</p>
                <p className="text-zinc-500 text-xs">Topic threads with replies and solve tags</p>
              </div>
              <button onClick={() => setShowDiscussionBoard(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-3">
              {discussionPosts.length === 0 && <p className="text-sm text-zinc-500">No discussion threads yet.</p>}
              {discussionPosts.map((post) => {
                const meta = discussionMeta[post.id] || { votes: 0, solved: false, replies: [] };
                return (
                  <div key={post.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-sm text-white font-medium">{post.content}</p>
                        <p className="text-[11px] text-zinc-500">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</p>
                      </div>
                      {meta.solved && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300">Solved</span>}
                    </div>
                    <div className="flex items-center gap-2 mb-3 text-xs">
                      <button onClick={() => voteDiscussion(post.id, 1)} className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300">▲ {meta.votes}</button>
                      <button onClick={() => voteDiscussion(post.id, -1)} className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300">▼</button>
                      <button onClick={() => setDiscussionMeta((prev) => ({ ...prev, [post.id]: { votes: prev[post.id]?.votes || 0, replies: prev[post.id]?.replies || [], bestReplyId: prev[post.id]?.bestReplyId, solved: !prev[post.id]?.solved } }))} className="rounded-lg border border-zinc-700 px-2 py-1 text-zinc-300">Toggle solved</button>
                      <button onClick={() => setSelectedDiscussionId(post.id)} className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-violet-200">Reply</button>
                    </div>
                    <div className="space-y-2">
                      {meta.replies.map((reply) => (
                        <div key={reply.id} className={cn("rounded-lg border p-2", meta.bestReplyId === reply.id ? "border-amber-400/40 bg-amber-500/5" : "border-zinc-800 bg-black/20")}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-xs text-white">{reply.text}</p>
                              <p className="text-[10px] text-zinc-500">{reply.userName} • {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}</p>
                            </div>
                            <button onClick={() => setDiscussionMeta((prev) => ({ ...prev, [post.id]: { votes: prev[post.id]?.votes || 0, solved: prev[post.id]?.solved || false, replies: prev[post.id]?.replies || [], bestReplyId: reply.id } }))} className="text-[10px] text-amber-300">Best answer</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedDiscussionId && (
              <div className="mt-4 flex gap-2 border-t border-zinc-800 pt-3">
                <Input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Write a Reddit-style reply..." className="bg-zinc-950 border-zinc-700 text-white" />
                <Button onClick={addReply} className="bg-violet-600 hover:bg-violet-700">Reply</Button>
              </div>
            )}
          </div>
        </div>
      )}
      {showAlertsPanel && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center p-3" onClick={() => setShowAlertsPanel(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold">Smart Alerts</p>
              <button onClick={() => setShowAlertsPanel(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { title: "Test reminder", detail: "आज आपने पढ़ाई नहीं की, 10 min test complete करो", cta: "Post reminder to group" },
                { title: "Weak subject alert", detail: `Your ${subjectPerformance[0]?.subject || "General"} accuracy needs attention`, cta: "Push improvement alert" },
                { title: "Group activity alert", detail: `${discussionPosts.length} doubts and ${groupTests.length} tests active in this group`, cta: "Notify members" },
              ].map((alert) => (
                <button key={alert.title} onClick={() => { postMutation.mutate({ content: JSON.stringify(alert), type: "alert" }); setShowAlertsPanel(false); }} className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:bg-white/5">
                  <p className="text-sm font-medium text-white">{alert.title}</p>
                  <p className="text-xs text-zinc-400 mt-1">{alert.detail}</p>
                  <p className="text-[11px] text-blue-300 mt-2">{alert.cta}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">AI-style nudges are generated from test history, streak, and current group activity.</div>
          </div>
        </div>
      )}
      {showGoalTracker && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center p-3" onClick={() => setShowGoalTracker(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold">Goal Tracker</p>
              <button onClick={() => setShowGoalTracker(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="IAS 2027 / Skill milestone" className="mb-3 bg-zinc-950 border-zinc-700 text-white" />
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 mb-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span>Progress</span>
                <span>{goalProgress}%</span>
              </div>
              <input type="range" min="0" max="100" value={goalProgress} onChange={(e) => setGoalProgress(Number(e.target.value))} className="w-full" />
              <div className="mt-3 h-2 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500" style={{ width: `${goalProgress}%` }} /></div>
            </div>
            <div className="rounded-xl bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">Stay consistent. Your target stays visible for the whole group workflow.</div>
          </div>
        </div>
      )}
      {showEarnPanel && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end justify-center p-3" onClick={() => setShowEarnPanel(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-white font-semibold">Earn Section</p>
              <button onClick={() => setShowEarnPanel(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[11px] text-zinc-500">Tests created</p>
                <p className="text-lg font-bold text-white">{groupTests.length}</p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="text-[11px] text-zinc-500">Paid notes</p>
                <p className="text-lg font-bold text-white">{paidNoteCount}</p>
              </div>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 mb-3">
              <p className="text-[11px] text-zinc-500">Estimated earning potential</p>
              <p className="text-2xl font-bold text-amber-300">₹{estimatedEarnings}</p>
              <p className="text-[11px] text-zinc-400 mt-1">Tests + creator notes can become your monetization layer.</p>
            </div>
            <div className="text-xs text-zinc-400">Rank rewards and paid group options can build on this panel next.</div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Groups List Page ─────────────────────────────────────────────────────────
export default function Groups() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const { data: groupsList = [], isLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    queryFn: () => fetch("/api/groups").then(r => r.json()),
  });

  const qc = useQueryClient();

  const filtered = groupsList.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedGroup) {
    return <GroupDetail groupId={selectedGroup} onBack={() => setSelectedGroup(null)} />;
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/95 backdrop-blur border-b border-zinc-800/50 px-4 pt-4 pb-3">
        <div className="mb-3 text-center">
          <div>
            <h1 className="text-white font-bold text-xl">Groups</h1>
            <p className="text-zinc-500 text-xs">Study together, compete, grow</p>
          </div>
        </div>
        <div className="flex justify-center mb-3">
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-blue-500 hover:opacity-95 text-white rounded-2xl px-5 py-2.5 text-sm font-bold transition-all active:scale-95 shadow-[0_0_20px_rgba(236,72,153,0.35)]"
          >
            <Plus className="w-4 h-4" /> Create Group
          </button>
        </div>
        <div className="relative">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-4 pr-4 py-2 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Stats banner */}
      <div className="px-4 py-3 flex gap-3">
        <div className="flex-1 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{groupsList.length}</div>
          <div className="text-zinc-500 text-xs">Groups</div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{groupsList.filter(g => g.is_member).length}</div>
          <div className="text-zinc-500 text-xs">Joined</div>
        </div>
        <div className="flex-1 bg-gradient-to-br from-violet-600/20 to-indigo-600/20 border border-violet-500/20 rounded-xl p-3 text-center">
          <div className="text-violet-400 font-bold text-lg">{groupsList.filter(g => !g.is_public).length}</div>
          <div className="text-zinc-500 text-xs">Private</div>
        </div>
      </div>

      {/* Groups list */}
      <div className="px-4 space-y-3">
        {isLoading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-zinc-900 rounded-2xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
            <p className="text-zinc-500 text-sm">No groups found</p>
            <p className="text-zinc-600 text-xs mt-1">Create one to get started!</p>
          </div>
        ) : (
          filtered.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group.id)}
              className="w-full flex items-center gap-3 bg-zinc-900 hover:bg-zinc-800 rounded-2xl p-4 transition-all text-left"
            >
              {/* Group avatar */}
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shrink-0">
                {group.image_url
                  ? <img src={group.image_url} className="w-full h-full object-cover" />
                  : <Users className="w-6 h-6 text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm truncate">{group.name}</span>
                  {!group.is_public && <Lock className="w-3 h-3 text-zinc-500 shrink-0" />}
                  {group.is_member && (
                    <span className="text-[10px] bg-violet-600/30 text-violet-300 rounded-full px-1.5 py-0.5 shrink-0">Joined</span>
                  )}
                </div>
                {group.description && (
                  <p className="text-zinc-500 text-xs mt-0.5 truncate">{group.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-zinc-600 text-xs">{group.member_count} members</span>
                  <span className="text-zinc-700">•</span>
                  <span className="text-zinc-600 text-xs">
                    by {group.first_name} {group.last_name}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
            </button>
          ))
        )}
      </div>

      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
      <BottomNav />
    </div>
  );
}