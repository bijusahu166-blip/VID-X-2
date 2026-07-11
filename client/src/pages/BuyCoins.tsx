import { useState } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { ArrowLeft, Coins, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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

export default function BuyCoins() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [purchasingId, setPurchasingId] = useState<number | null>(null);

  const { data: packages = [] } = useQuery<CoinPackage[]>({
    queryKey: ["/api/coins/packages"],
    queryFn: async () => {
      const res = await fetch("/api/coins/packages", { credentials: "include" });
      return res.json();
    },
  });

  const { data: coinData } = useQuery<{ balance: number }>({
    queryKey: ["/api/coins/balance"],
    queryFn: async () => {
      const res = await fetch("/api/coins/balance", { credentials: "include" });
      return res.json();
    },
  });

  const handleBuy = async (pkg: CoinPackage) => {
    setPurchasingId(pkg.id);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Could not load payment gateway");

      const orderRes: any = await apiRequest("POST", "/api/coins/purchase/create-order", { packageId: pkg.id });
      const orderData = orderRes.json ? await orderRes.json() : orderRes;

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "VAMPIRE",
        description: `${pkg.coins} Coins`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes: any = await apiRequest("POST", "/api/coins/purchase/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const verifyData = verifyRes.json ? await verifyRes.json() : verifyRes;
            qc.invalidateQueries({ queryKey: ["/api/coins/balance"] });
            toast({ title: `+${verifyData.coinsAdded} coins added!` });
          } catch (err: any) {
            toast({ title: "Payment verification failed", description: err.message, variant: "destructive" });
          } finally {
            setPurchasingId(null);
          }
        },
        modal: {
          ondismiss: () => setPurchasingId(null),
        },
        theme: { color: "#ec4899" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Could not start payment", description: err.message, variant: "destructive" });
      setPurchasingId(null);
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
          <h1 className="text-white font-bold text-lg">Buy Coins</h1>
        </div>

        <div className="flex flex-col items-center py-6">
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl px-6 py-4">
            <Coins className="w-6 h-6 text-yellow-400" />
            <span className="text-white text-2xl font-bold">{coinData?.balance ?? 0}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {packages.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => handleBuy(pkg)}
              disabled={purchasingId === pkg.id}
              className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-white/6 border border-white/10 hover:border-pink-500/50 transition-colors disabled:opacity-50"
            >
              <Coins className="w-8 h-8 text-yellow-400" />
              <span className="text-white font-bold text-lg">{pkg.coins}</span>
              <span className="text-zinc-400 text-xs">coins</span>
              <div className="w-full py-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-600 text-white text-sm font-bold flex items-center justify-center gap-1.5">
                {purchasingId === pkg.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : `₹${pkg.amount_inr}`}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}