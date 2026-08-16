import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";

type Language = "en" | "hi";

type LanguageContextType = {
  language: Language;
  setLanguage: (value: Language) => void;
  t: (key: string, fallback?: string) => string;
};

const translations: Record<string, { en: string; hi: string }> = {
  "subscription.title": { en: "Pro Subscription", hi: "प्रो सब्सक्रिप्शन" },
  "subscription.subtitle": { en: "Unlock premium features for just ₹50", hi: "सिर्फ ₹50 में प्रीमियम फीचर्स अनलॉक करें" },
  "subscription.cta": { en: "Subscribe for ₹50", hi: "₹50 में सब्सक्राइब करें" },
  "subscription.active": { en: "Active Plan", hi: "एक्टिव प्लान" },
  "subscription.cancel": { en: "Cancel", hi: "रद्द करें" },
  "subscription.features.noAds": { en: "No ads", hi: "कोई विज्ञापन नहीं" },
  "subscription.features.proChat": { en: "Pro chat UI modes", hi: "प्रो चैट UI मोड" },
  "subscription.features.premiumThemes": { en: "Premium themes", hi: "प्रीमियम थीम" },
  "subscription.features.support": { en: "Priority support", hi: "प्राथमिक समर्थन" },
  "settings.language": { en: "Language", hi: "भाषा" },
  "settings.language.desc": { en: "Choose your preferred language", hi: "अपनी पसंदीदा भाषा चुनें" },
  "chat.unlock": { en: "Unlock Pro for premium modes", hi: "प्रीमियम मोड के लिए प्रो अनलॉक करें" },
  "chat.placeholder": { en: "Ask anything in a premium workspace…", hi: "प्रीमियम वर्कस्पेस में कुछ भी पूछें…" },
  "chat.button": { en: "Send", hi: "भेजें" },
  "chat.mode": { en: "Mode", hi: "मोड" },
  "chat.welcome": { en: "Neural workspace ready. Switch to a premium mode to experience the pro UI.", hi: "न्यूरल वर्कस्पेस तैयार है। प्रो UI अनुभव के लिए कोई प्रीमियम मोड चुनें।" },
  "common.english": { en: "English", hi: "अंग्रेज़ी" },
  "common.hindi": { en: "Hindi", hi: "हिंदी" },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

function getStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem("app-language") as Language | null;
  return stored === "hi" ? "hi" : "en";
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    if (user?.languagePreference === "hi" || user?.languagePreference === "en") {
      setLanguageState(user.languagePreference);
    } else {
      setLanguageState(getStoredLanguage());
    }
  }, [user?.languagePreference]);

  const setLanguage = (value: Language) => {
    setLanguageState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("app-language", value);
    }
    fetch("/api/preferences", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ languagePreference: value }),
    }).catch(() => undefined);
  };

  const t = (key: string, fallback?: string) => {
    const entry = translations[key];
    if (!entry) return fallback ?? key;
    return language === "hi" ? entry.hi : entry.en;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useTranslation must be used within LanguageProvider");
  return context;
}

