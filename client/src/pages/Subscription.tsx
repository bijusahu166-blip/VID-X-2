import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import {
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  PenTool,
  Ticket,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
}

const SIGNATURE_PLAN = {
  type: "signature",
  name: "Premium Signature",
  price: 99,
  duration: "3 Months",
  features: [
    "Premium Signature on your profile",
    "Choose from 10 attractive signature styles",
    "Show your signature with your name",
    "Signature appears with your uploaded posts",
    "Premium profile appearance",
  ],
};

export default function Subscription() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [subscribing, setSubscribing] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const { data, isLoading } = useQuery<{
    subscription: any;
  }>({
    queryKey: ["/api/subscription/mine"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/mine", {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Could not load subscription");
      }

      return res.json();
    },
  });

  const activePlan = data?.subscription?.plan_type;

  const isSignatureActive =
    activePlan === "signature";

  const handleSubscribe = async () => {
    if (subscribing || isSignatureActive) return;

    setSubscribing(true);

    try {
      const loaded = await loadRazorpayScript();

      if (!loaded) {
        throw new Error(
          "Could not load payment gateway"
        );
      }

      /*
       * Backend must create the Razorpay subscription
       * for the "signature" plan.
       */
      const res: any = await apiRequest(
        "POST",
        "/api/subscription/create",
        {
          planType: "signature",
        }
      );

      const orderData =
        res.json ? await res.json() : res;

      if (!orderData?.subscriptionId) {
        throw new Error(
          "Subscription could not be created"
        );
      }

      const options = {
        key: orderData.keyId,

        subscription_id:
          orderData.subscriptionId,

        name: "IQPartner",

        description:
          "Premium Signature · ₹99 · 3 Months",

        handler: async () => {
          /*
           * Refresh subscription/user data after
           * Razorpay checkout completes.
           */
          await qc.invalidateQueries({
            queryKey: ["/api/subscription/mine"],
          });

          await qc.invalidateQueries({
            queryKey: ["/api/auth/user"],
          });

          await qc.invalidateQueries({
            queryKey: ["/api/profile"],
          });

          toast({
            title:
              "Premium Signature activated! ✨",
            description:
              "Your ₹99 Premium Signature is active for 3 months.",
          });

          setSubscribing(false);

          /*
           * Go back to profile where the user can
           * complete/select their signature.
           */
          navigate("/profile");
        },

        modal: {
          ondismiss: () => {
            setSubscribing(false);
          },
        },

        theme: {
          color: "#ec4899",
        },
      };

      const rzp =
        new window.Razorpay(options);

      rzp.open();
    } catch (err: any) {
      toast({
        title:
          "Could not start subscription",
        description:
          err?.message ||
          "Please try again.",
        variant: "destructive",
      });

      setSubscribing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await apiRequest(
        "POST",
        "/api/subscription/cancel",
        {}
      );

      await qc.invalidateQueries({
        queryKey: ["/api/subscription/mine"],
      });

      await qc.invalidateQueries({
        queryKey: ["/api/auth/user"],
      });

      await qc.invalidateQueries({
        queryKey: ["/api/profile"],
      });

      toast({
        title: "Subscription cancelled",
      });
    } catch (err: any) {
      toast({
        title: "Could not cancel",
        description:
          err?.message ||
          "Please try again.",
        variant: "destructive",
      });
    }
  };

  // ── Promo code redemption ──
  // Server verifies the code and grants the "signature" plan directly
  // (see POST /api/subscription/redeem-code). The code is never checked
  // on the client — only the server knows which codes are valid, so it
  // can't be read out of the JS bundle or bypassed via dev tools.
  const handleRedeemCode = async () => {
    const code = promoCode.trim();
    if (!code || redeeming) return;

    setRedeeming(true);
    try {
      await apiRequest("POST", "/api/subscription/redeem-code", { code });

      await qc.invalidateQueries({ queryKey: ["/api/subscription/mine"] });
      await qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
      await qc.invalidateQueries({ queryKey: ["/api/profile"] });

      toast({
        title: "Code redeemed! ✨",
        description: "Premium Signature is now active for 3 months.",
      });

      setPromoCode("");
    } catch (err: any) {
      toast({
        title: "Could not redeem code",
        description: err?.message || "Please check the code and try again.",
        variant: "destructive",
      });
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-10">
      <Header />

      <main
        className="mx-auto max-w-[480px] px-4"
        style={{
          paddingTop: "var(--header-total)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate("/")}
            className="
              w-8 h-8
              rounded-full
              bg-white/10
              flex
              items-center
              justify-center
              hover:bg-white/15
              transition-colors
            "
            aria-label="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          <h1 className="text-white font-bold text-lg">
            Premium Signature
          </h1>
        </div>

        {/* Active subscription */}
        {isSignatureActive && (
          <div
            className="
              mb-5
              p-4
              rounded-2xl
              bg-green-500/10
              border
              border-green-500/30
            "
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-green-400 text-xs font-bold uppercase">
                  Premium Active
                </p>

                <p className="text-white font-bold mt-1">
                  Premium Signature ✨
                </p>

                <p className="text-zinc-400 text-xs mt-1">
                  ₹99 · 3 Months
                </p>
              </div>

              <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-green-400" />
              </div>
            </div>

            <button
              onClick={handleCancel}
              className="
                mt-4
                text-red-400
                text-xs
                font-semibold
                px-3
                py-1.5
                rounded-full
                border
                border-red-400/30
                hover:bg-red-500/10
              "
            >
              Cancel Subscription
            </button>
          </div>
        )}

        {/* Premium Signature Card */}
        <div
          className="
            relative
            overflow-hidden
            rounded-3xl
            border
            border-pink-500/30
            bg-gradient-to-br
            from-pink-500/15
            via-purple-500/10
            to-cyan-500/10
            p-6
          "
        >
          {/* Decorative glow */}
          <div
            className="
              absolute
              -top-20
              -right-20
              w-48
              h-48
              rounded-full
              bg-pink-500/10
              blur-3xl
              pointer-events-none
            "
          />

          <div
            className="
              absolute
              -bottom-20
              -left-20
              w-48
              h-48
              rounded-full
              bg-purple-500/10
              blur-3xl
              pointer-events-none
            "
          />

          <div className="relative">
            {/* Icon */}
            <div
              className="
                w-14
                h-14
                rounded-2xl
                bg-gradient-to-br
                from-pink-500
                to-violet-600
                flex
                items-center
                justify-center
                shadow-lg
                shadow-pink-500/20
                mb-5
              "
            >
              <PenTool className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black">
                Premium Signature
              </h2>

              <span className="text-lg">
                ✨
              </span>
            </div>

            <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
              Create your own premium signature and
              make your profile and posts stand out.
            </p>

            {/* Price */}
            <div className="mt-6 flex items-end gap-2">
              <span className="text-4xl font-black text-white">
                ₹99
              </span>

              <span className="text-zinc-400 text-sm pb-1">
                / 3 Months
              </span>
            </div>

            {/* Features */}
            <div className="mt-6 space-y-3">
              {SIGNATURE_PLAN.features.map(
                (feature) => (
                  <div
                    key={feature}
                    className="flex items-start gap-3"
                  >
                    <div
                      className="
                        w-5
                        h-5
                        shrink-0
                        rounded-full
                        bg-pink-500/15
                        flex
                        items-center
                        justify-center
                        mt-0.5
                      "
                    >
                      <Check className="w-3 h-3 text-pink-400" />
                    </div>

                    <span className="text-sm text-zinc-300">
                      {feature}
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Subscribe */}
            <button
              onClick={handleSubscribe}
              disabled={
                subscribing ||
                isSignatureActive ||
                isLoading
              }
              className="
                w-full
                mt-7
                py-3.5
                rounded-2xl
                bg-gradient-to-r
                from-pink-500
                via-purple-500
                to-violet-600
                text-white
                font-bold
                text-sm
                flex
                items-center
                justify-center
                gap-2
                shadow-lg
                shadow-pink-500/20
                hover:opacity-90
                active:scale-[0.99]
                transition-all
                disabled:opacity-50
              "
            >
              {subscribing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening Payment...
                </>
              ) : isSignatureActive ? (
                <>
                  <Check className="w-4 h-4" />
                  Premium Signature Active
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Get Premium Signature · ₹99
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-zinc-600 mt-3">
              Premium Signature access for 3 months
            </p>
          </div>
        </div>

        {/* Promo code redemption */}
        {!isSignatureActive && (
          <div
            className="
              mt-5
              rounded-2xl
              border
              border-white/10
              bg-white/[0.03]
              p-5
            "
          >
            <div className="flex items-center gap-2 mb-1">
              <Ticket className="w-4 h-4 text-pink-400" />
              <p className="text-white font-bold text-sm">
                Have a code?
              </p>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Redeem a promo code to unlock Premium Signature for free.
            </p>

            <div className="flex gap-2">
              <input
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleRedeemCode(); }}
                placeholder="Enter code"
                disabled={redeeming}
                className="
                  flex-1
                  bg-white/5
                  border
                  border-white/10
                  rounded-xl
                  px-4
                  py-2.5
                  text-sm
                  text-white
                  outline-none
                  focus:border-pink-500
                  transition-colors
                  placeholder:text-zinc-600
                  disabled:opacity-60
                "
              />
              <button
                onClick={handleRedeemCode}
                disabled={redeeming || !promoCode.trim()}
                className="
                  px-4
                  py-2.5
                  rounded-xl
                  bg-white/10
                  border
                  border-white/15
                  text-white
                  text-sm
                  font-bold
                  hover:bg-white/15
                  active:scale-95
                  transition-all
                  disabled:opacity-40
                  flex
                  items-center
                  gap-2
                  shrink-0
                "
              >
                {redeeming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Redeem"}
              </button>
            </div>
          </div>
        )}

        {/* Signature preview */}
        <div
          className="
            mt-5
            rounded-2xl
            border
            border-white/10
            bg-white/[0.03]
            p-5
          "
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
            Your Premium Signature
          </p>

          <div className="mt-4 text-center">
            <p className="text-zinc-500 text-xs mb-2">
              After purchase
            </p>

            <p
              className="
                text-3xl
                text-white
                font-semibold
                italic
              "
            >
              Your Name
            </p>

            <p className="text-[10px] text-pink-400 mt-2">
              ✦ Premium Signature ✦
            </p>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-white font-bold text-sm">
            How it works
          </p>

          <div className="mt-4 space-y-3">
            <div className="flex gap-3">
              <span className="text-pink-400 font-bold">
                01
              </span>
              <p className="text-xs text-zinc-400">
                Purchase Premium Signature for ₹99, or redeem a promo code.
              </p>
            </div>

            <div className="flex gap-3">
              <span className="text-pink-400 font-bold">
                02
              </span>
              <p className="text-xs text-zinc-400">
                Enter your name and choose one of
                10 signature styles.
              </p>
            </div>

            <div className="flex gap-3">
              <span className="text-pink-400 font-bold">
                03
              </span>
              <p className="text-xs text-zinc-400">
                Your signature appears on your
                profile and uploaded content.
              </p>
            </div>

            <div className="flex gap-3">
              <span className="text-pink-400 font-bold">
                04
              </span>
              <p className="text-xs text-zinc-400">
                Premium Signature remains active
                for 3 months.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}