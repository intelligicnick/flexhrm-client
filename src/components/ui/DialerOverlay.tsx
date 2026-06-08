import React, { useState, useEffect } from "react";

const DialerOverlay = ({ contact, status, setStatus, onClose }: { 
  contact: { name: string; phone: string; role?: string }; 
  status: "ringing" | "connected" | "ended"; 
  setStatus: React.Dispatch<React.SetStateAction<"ringing" | "connected" | "ended">>; 
  onClose: () => void;
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // Ring for 2 seconds, then automatically connect
    if (status === "ringing") {
      const ringTimer = setTimeout(() => {
        setStatus("connected");
      }, 2000);
      return () => clearTimeout(ringTimer);
    }
  }, [status, setStatus]);

  useEffect(() => {
    // Call duration timer
    if (status === "connected") {
      const interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in" id="voice-dialer-overlay-simulator">
      {/* Dialer UI card */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-white rounded-2xl w-full max-w-sm p-8 shadow-2xl relative flex flex-col items-center justify-between min-h-[480px] overflow-hidden">
        {/* Glowing glass accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-[#ff791a]/10 blur-3xl pointer-events-none" />
        
        {/* Upper card header: Simulation Indicator */}
        <div className="w-full flex justify-between items-center opacity-60">
          <span className="text-[9px] font-black uppercase tracking-widest text-[#ff791a] border border-[#ff791a]/30 px-2 py-0.5 rounded-full bg-orange-500/5">Simulated Call</span>
          <span className="text-[10px] font-mono tracking-wider font-bold">HD Voice • Secure</span>
        </div>

        {/* Contact info, avatar and ringing state */}
        <div className="flex flex-col items-center space-y-5 my-auto">
          {/* Pulsing visual waves for dialing */}
          <div className="relative flex items-center justify-center">
            {status === "ringing" && (
              <>
                <div className="absolute w-24 h-24 rounded-full bg-orange-500/10 animate-ping" />
                <div className="absolute w-32 h-32 rounded-full bg-orange-500/5 animate-pulse" />
              </>
            )}
            {status === "connected" && (
              <>
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 animate-pulse" />
              </>
            )}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black shadow-lg ${
              status === "ringing" ? "bg-orange-500 text-white" :
              status === "connected" ? "bg-emerald-500 text-white" :
              "bg-rose-500 text-white"
            }`}>
              {contact.name.charAt(0)}
            </div>
          </div>

          <div className="text-center space-y-1.5 flex flex-col items-center">
            <h3 className="text-lg font-black tracking-tight">{contact.name}</h3>
            {contact.role && <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{contact.role}</p>}
            <p className="text-xs font-mono text-slate-400">{contact.phone}</p>
          </div>

          {/* Call Status Text and Timer */}
          <div className="text-center space-y-1">
            <span className={`text-[11px] font-bold tracking-widest uppercase block ${
              status === "ringing" ? "text-orange-400 animate-pulse" :
              status === "connected" ? "text-emerald-400" :
              "text-rose-500"
            }`}>
              {status === "ringing" ? "Ringing..." :
               status === "connected" ? "Connected • Call Active" :
               "Call Ended"}
            </span>
            {status === "connected" && (
              <span className="text-lg font-mono font-bold tracking-widest text-slate-300 block">{formatTime(seconds)}</span>
            )}
          </div>
        </div>

        {/* Buttons grid for controls */}
        <div className="w-full grid grid-cols-3 gap-6 pt-4 border-t border-slate-800 text-slate-400 text-[10px] font-bold">
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔇</span>
            <span>Mute</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔢</span>
            <span>Keypad</span>
          </button>
          <button className="flex flex-col items-center gap-1.5 hover:text-white cursor-not-allowed">
            <span className="w-9 h-9 rounded-full bg-slate-800/40 border border-slate-800 flex items-center justify-center text-lg">🔊</span>
            <span>Speaker</span>
          </button>
        </div>

        {/* Red End Call Button */}
        <div className="pt-6 w-full">
          <button
            onClick={() => {
              setStatus("ended");
              setTimeout(() => {
                onClose();
              }, 800);
            }}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:scale-98 text-white font-extrabold text-xs tracking-wider rounded-xl shadow-lg transition duration-150 uppercase flex items-center justify-center gap-2 cursor-pointer"
          >
            ❌ End Call
          </button>
        </div>
      </div>
    </div>
  );
};

export default DialerOverlay;
