import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Coins, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, apiUrl} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoinPackage {
  id: number;
  amount_inr: number;
  coins: number;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

function getSafeReturnTo(): string {
  const params = new URLSearchParams(window.location.search);
  const returnTo = params.get("returnTo");

  // Internal app paths only; never redirect to an external URL.
  if (
    returnTo &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//")
  ) {
    return returnTo;
  }

  return "/profile";
}

async function readJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export default function BuyCoins() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [purchasingId, setPurchasingId] = useState<number | null>(null);
  const returnTo = useMemo(() => getSafeReturnTo(), []);

  const {
    data: packages = [],
    isLoading: packagesLoading,
  } = useQuery<CoinPackage[]>({
    queryKey: ["/api/coins/packages"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/coins/packages"), {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data?.message || "Could not load coin packages");
      }

      return Array.isArray(data) ? data : [];
    },
  });

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins/balance"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/coins/balance"), {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data?.message || "Could not load coin balance");
      }

      return {
        balance: Number(data?.balance ?? 0),
      };
    },
  });

  const handleBuy = async (pkg: CoinPackage) => {
    if (purchasingId !== null) return;

    setPurchasingId(pkg.id);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        throw new Error("Could not load payment gateway");
      }

      const orderRes: any = await apiRequest(
        "POST",
        "/api/coins/purchase/create-order",
        { packageId: pkg.id }
      );
      const orderData = orderRes?.json
        ? await orderRes.json()
        : orderRes;

      if (!orderData?.orderId || !orderData?.keyId) {
        throw new Error(orderData?.message || "Invalid payment order");
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "IQPartner",
        description: `${pkg.coins} Coins`,
        order_id: orderData.orderId,

        handler: async (response: any) => {
          try {
            const verifyRes: any = await apiRequest(
              "POST",
              "/api/coins/purchase/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }
            );

            const verifyData = verifyRes?.json
              ? await verifyRes.json()
              : verifyRes;

            await qc.invalidateQueries({
              queryKey: ["/api/coins/balance"],
            });

            toast({
              title: `+${Number(verifyData?.coinsAdded ?? pkg.coins)} coins added!`,
            });

            setPurchasingId(null);

            // If user came from Voice Room, return directly there after payment.
            navigate(returnTo);
          } catch (err: any) {
            toast({
              title: "Payment verification failed",
              description: err?.message || "Please try again",
              variant: "destructive",
            });
            setPurchasingId(null);
          }
        },

        modal: {
          ondismiss: () => setPurchasingId(null),
        },

        theme: {
          color: "#ec4899",
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on?.("payment.failed", (response: any) => {
        setPurchasingId(null);
        toast({
          title: "Payment failed",
          description:
            response?.error?.description || "Please try another payment method",
          variant: "destructive",
        });
      });

      rzp.open();
    } catch (err: any) {
      toast({
        title: "Could not start payment",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
      setPurchasingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-10">
      <Header />

      <main
        className="mx-auto max-w-[480px] px-4"
        style={{ paddingTop: "var(--header-total)" }}
      >
        <div className="flex items-center gap-3 py-4">
          <button
            onClick={() => navigate(returnTo)}
            className="w-8 h-8 rounded-full bg-white/6 flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>

          <h1 className="text-white font-bold text-lg">Buy Coins</h1>
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl px-6 py-4">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span className="text-white text-2xl font-bold">
              {coinData?.balance ?? 0}
            </span>
          </div>
        </div>

        {packagesLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        ) : packages.length === 0 ? (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-center">
            <p className="text-zinc-400 text-sm">
              Coin packages are unavailable right now.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {packages.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => handleBuy(pkg)}
                disabled={purchasingId !== null}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/6 border border-white/10 hover:border-pink-500/50 transition-colors disabled:opacity-50"
              >
                <Coins className="w-8 h-8 text-yellow-400" />
                <span className="text-white font-bold text-lg">
                  {pkg.coins}
                </span>
                <span className="text-zinc-400 text-xs">coins</span>

                <div className="w-full py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center gap-1.5">
                  {purchasingId === pkg.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    `₹${pkg.amount_inr}`
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}