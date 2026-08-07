import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Check, Loader2, Crown, Sparkles, Briefcase } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const PLANS = [
  {
    type: "pro",
    name: "Pro",
    price: 50,
    icon: Sparkles,
    color: "#60a5fa",
    features: ["No ads", "Pro chat UI modes", "Premium themes", "Priority support"],
  },
  {
    type: "creator_pro",
    name: "Creator Pro",
    price: 299,
    icon: Crown,
    color: "#f472b6",
    features: ["Everything in Pro", "Advanced analytics", "Higher upload limits", "Creator tools", "Priority support"],
  },
  {
    type: "business",
    name: "Business",
    price: 999,
    icon: Briefcase,
    color: "#fbbf24",
    features: ["Everything in Creator Pro", "Business profile", "Verified business badge", "Advertising tools"],
  },
];

export default function Subscription() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subscribingType, setSubscribingType] = useState<string | null>(null);
  const { t } = useTranslation();

  const { data } = useQuery<{ subscription: any }>({
    queryKey: ["/api/subscription/mine"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/mine", { credentials: "include" });
      return res.json();
    },
  });

  const activePlan = data?.subscription?.plan_type;

  const handleSubscribe = async (planType: string) => {
    setSubscribingType(planType);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load payment gateway");

      const res: any = await apiRequest("POST", "/api/subscription/create", { planType });
      const orderData = res.json ? await res.json() : res;

      const options = {
        key: orderData.keyId,
        subscription_id: orderData.subscriptionId,
        name: "VAMPIRE",
        description: `${planType} subscription`,
        handler: async () => {
          qc.invalidateQueries({ queryKey: ["/api/subscription/mine"] });
          qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
          qc.invalidateQueries({ queryKey: ["/api/profile"] });
          toast({ title: "Subscription activated!" });
          setSubscribingType(null);
        },
        modal: {
          ondismiss: () => setSubscribingType(null),
        },
        theme: { color: "#ec4899" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Could not start subscription", description: err.message, variant: "destructive" });
      setSubscribingType(null);
    }
  };

  const handleCancel = async () => {
    try {
      await apiRequest("POST", "/api/subscription/cancel", {});
      qc.invalidateQueries({ queryKey: ["/api/subscription/mine"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      qc.invalidateQueries({ queryKey: ["/api/profile"] });
      toast({ title: "Subscription cancelled" });
    } catch (err: any) {
      toast({ title: "Could not cancel", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-black pb-10">
      <Header />
      <main className="mx-auto max-w-[480px] px-4" style={{ paddingTop: "var(--header-total)" }}>
        <div className="flex items-center gap-3 py-4">
          <button onClick={() => navigate("/")} className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <h1 className="text-white font-bold text-lg">{t("subscription.title")}</h1>
        </div>

        {activePlan && (
          <div className="mb-4 p-4 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-between">
            <div>
              <p className="text-green-400 text-xs font-bold uppercase">{t("subscription.active")}</p>
              <p className="text-white font-bold capitalize">{activePlan.replace("_", " ")}</p>
            </div>
            <button onClick={handleCancel} className="text-red-400 text-xs font-semibold px-3 py-1.5 rounded-full border border-red-400/30">
              {t("subscription.cancel")}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isActive = activePlan === plan.type;
            return (
              <div
                key={plan.type}
                className="rounded-2xl border p-5"
                style={{ borderColor: `${plan.color}40`, background: `${plan.color}0a` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${plan.color}22` }}>
                    <Icon className="w-5 h-5" style={{ color: plan.color }} />
                  </div>
                  <div>
                    <p className="text-white font-bold">{plan.name}</p>
                    <p className="text-zinc-400 text-sm">₹{plan.price}/month</p>
                  </div>
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-zinc-300">
                      <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: plan.color }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSubscribe(plan.type)}
                  disabled={subscribingType === plan.type || isActive || !!activePlan}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: isActive ? "#22c55e" : `linear-gradient(135deg, ${plan.color}, ${plan.color}aa)` }}
                >
                  {subscribingType === plan.type ? <Loader2 className="w-4 h-4 animate-spin" /> : isActive ? "Current Plan" : activePlan ? "Cancel current plan first" : `${t("subscription.cta")} · ₹${plan.price}`}
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
