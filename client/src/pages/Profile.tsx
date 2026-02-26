import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { 
  Settings, 
  Play, 
  ShoppingBag, 
  CheckCircle2, 
  Bot,
  Zap,
  Star,
  ShieldCheck,
  Gamepad2
} from "lucide-react";
import { motion } from "framer-motion";

export default function Profile() {
  const { user } = useAuth();

  const tasks = [
    { id: 1, title: "Feed the Robot", desc: "Premium conditioning", icon: Zap, completed: true },
    { id: 2, title: "Clean Antennae", desc: "Premium conditioning", icon: Star, completed: true },
    { id: 3, title: "Mission Control", desc: "Remote satellite building", icon: ShieldCheck, completed: true },
    { id: 4, title: "Assemble Protocard", desc: "Standard status", icon: Bot, completed: true },
  ];

  return (
    <div className="min-h-screen pb-20 overflow-hidden bg-[#ffcc00] relative">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#ff3399] via-[#ffcc00] to-[#33ccff] opacity-80 blur-3xl animate-pulse" />
      
      <main className="relative z-10 px-6 pt-12 flex flex-col items-center text-white">
        {/* Robot Icon */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-6"
        >
          <div className="w-32 h-32 border-4 border-white rounded-[2rem] flex items-center justify-center relative bg-white/10 backdrop-blur-md shadow-2xl">
            <Bot className="w-20 h-20 text-white" strokeWidth={1.5} />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <Star className="w-10 h-10 fill-white text-white" />
            </div>
            <div className="absolute top-1/2 left-1/4 w-3 h-3 bg-white rounded-full animate-ping" />
            <div className="absolute top-1/2 right-1/4 w-3 h-3 bg-white rounded-full animate-ping" />
          </div>
        </motion.div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-black mb-1 drop-shadow-md">Welcome to RoboApp</h1>
          <p className="text-white/80 font-medium">Your friendly robot companion</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-4 w-full mb-8">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/20 backdrop-blur-xl p-4 rounded-3xl flex flex-col items-center gap-2 border border-white/30 shadow-xl"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-red-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Play className="w-6 h-6 fill-white text-white" />
            </div>
            <span className="text-sm font-bold">Play</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/20 backdrop-blur-xl p-4 rounded-3xl flex flex-col items-center gap-2 border border-white/30 shadow-xl"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-bold">Settings</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white/20 backdrop-blur-xl p-4 rounded-3xl flex flex-col items-center gap-2 border border-white/30 shadow-xl"
          >
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-bold">Shop</span>
          </motion.button>
        </div>

        {/* Daily Tasks */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full bg-white/20 backdrop-blur-2xl rounded-[2.5rem] p-6 border border-white/30 shadow-2xl mb-8"
        >
          <h2 className="text-xl font-black mb-6">Daily Tasks</h2>
          <div className="space-y-5">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/30 flex items-center justify-center shadow-inner">
                    <task.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{task.title}</h3>
                    <p className="text-[10px] text-white/60 font-semibold uppercase tracking-wider">{task.desc}</p>
                  </div>
                </div>
                <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center shadow-lg">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-white/20 pb-safe rounded-t-[2.5rem]">
        <div className="flex justify-around items-center h-20 max-w-md mx-auto px-6">
          <div className="flex flex-col items-center gap-1 text-purple-600">
            <div className="p-2 bg-purple-100 rounded-2xl">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <span className="text-[10px] font-black uppercase">Home</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Bot className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Chat</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Gamepad2 className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase">Games</span>
          </div>
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <div className="w-8 h-8 rounded-full border-2 border-gray-300 overflow-hidden">
              <img src={user?.profileImageUrl || ""} alt="" className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] font-bold uppercase">Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
