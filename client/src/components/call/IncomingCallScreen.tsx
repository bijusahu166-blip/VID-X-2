import { Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useCall } from "@/contexts/CallContext";

export function IncomingCallScreen() {
  const { incomingCall, acceptCall, rejectCall } = useCall();
  if (!incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center pb-12 px-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(145deg, #1a0d2e, #0d1a2e)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 0 60px rgba(168,85,247,0.3)" }}>

        {/* Header */}
        <div className="pt-8 pb-6 px-6 text-center">
          <p className="text-purple-300 text-sm font-medium mb-4">
            Incoming {incomingCall.audioOnly ? "Voice" : "Video"} Call
          </p>

          {/* Avatar */}
          <div className="relative inline-block mb-4">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-purple-500/40 mx-auto"
              style={{ boxShadow: "0 0 40px rgba(168,85,247,0.5)" }}>
              {incomingCall.callerAvatar ? (
                <img src={incomingCall.callerAvatar} className="w-full h-full object-cover" alt={incomingCall.callerName} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-3xl font-black text-white">
                  {incomingCall.callerName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {/* Pulse rings */}
            {[1, 2].map(i => (
              <div key={i} className="absolute inset-0 rounded-full border-2 border-purple-500/20"
                style={{ animation: `ping 1.5s ease-out ${i * 0.5}s infinite`, transform: `scale(${1 + i * 0.3})` }} />
            ))}
          </div>

          <h2 className="text-white text-2xl font-bold">{incomingCall.callerName}</h2>
          <p className="text-zinc-400 text-sm mt-1">
            {incomingCall.audioOnly ? "Voice call..." : "Video call..."}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-around pb-8 px-8">
          {/* Reject */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={rejectCall}
              data-testid="button-reject-call"
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 active:scale-95 flex items-center justify-center transition-all duration-150"
              style={{ boxShadow: "0 0 20px rgba(239,68,68,0.5)" }}
            >
              <PhoneOff className="w-7 h-7 text-white" />
            </button>
            <span className="text-zinc-400 text-xs">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={acceptCall}
              data-testid="button-accept-call"
              className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 active:scale-95 flex items-center justify-center transition-all duration-150"
              style={{ boxShadow: "0 0 20px rgba(34,197,94,0.5)" }}
            >
              {incomingCall.audioOnly
                ? <Phone className="w-7 h-7 text-white" />
                : <Video className="w-7 h-7 text-white" />
              }
            </button>
            <span className="text-zinc-400 text-xs">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
