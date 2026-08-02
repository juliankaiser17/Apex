import React from 'react';
import { X, Crown, Sparkles, Flame, Shield, Map } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';

export const EnthusiastModal: React.FC = () => {
  const { enthusiastModalOpen, toggleEnthusiastModal } = useApexStore();

  if (!enthusiastModalOpen) return null;

  const features = [
    { title: 'Full Rare Car Heatmap', desc: 'Real-time thermal map of rare car hotspots in your city', icon: <Map className="w-5 h-5 text-[#FFA500]" /> },
    { title: '1.1× XP Boost (Always On)', desc: 'Accelerate level progression on every spot & quest', icon: <Flame className="w-5 h-5 text-[#FF4500]" /> },
    { title: 'Unlimited Garage Capacity', desc: 'Collect infinitely without the 500 card limit', icon: <Crown className="w-5 h-5 text-[#FFA500]" /> },
    { title: 'Holographic Card Skins', desc: 'Unlock 3 exclusive animated 3D card finishes', icon: <Sparkles className="w-5 h-5 text-[#FF6A00]" /> },
    { title: 'Early Hunt Notifications', desc: 'Receive hunt broadcasts 30s before standard spotters', icon: <Shield className="w-5 h-5 text-[#2ECC71]" /> }
  ];

  const handleSubscribe = () => {
    sounds.playXpPop();
    alert('🎉 Enthusiast Mode Activated! 7-Day Free Trial Started.');
    toggleEnthusiastModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-md flex flex-col justify-between p-4 overflow-y-auto select-none" style={{ fontFamily: 'DM Sans' }}>
      <div className="max-w-md mx-auto w-full my-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#FFA500] font-data text-xs font-semibold uppercase">
            <Crown className="w-5 h-5" /> ENTHUSIAST MODE
          </div>
          <button
            onClick={() => toggleEnthusiastModal(false)}
            className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:bg-[#2C2C2C] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Hero Title */}
        <div className="text-center space-y-2">
          <h2 className="font-display text-5xl text-[#F0EBE3] tracking-wide leading-none">
            UNLEASH FULL <span className="text-[#FF4500]">APEX POWER.</span>
          </h2>
          <p className="text-sm text-[#9A9088]">
            Designed for serious spotters, collectors, and automotive purists.
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-3 bg-[#111111] border border-[#FFA500]/40 rounded-xl p-5 shadow-2xl">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-[#1A1A1A] border border-[#2C2C2C]">
              <div className="p-2 rounded-lg bg-[#080808]">
                {f.icon}
              </div>
              <div>
                <h4 className="font-semibold text-[#F0EBE3] text-sm">{f.title}</h4>
                <p className="text-xs text-[#9A9088] mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Price & Subscribe Button */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleSubscribe}
            className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-2xl tracking-wider flex items-center justify-center gap-2 glow-orange"
          >
            <Sparkles className="w-6 h-6 text-[#F0EBE3]" /> START 7-DAY FREE TRIAL
          </button>

          <p className="text-center text-xs font-data text-[#9A9088]">
            Then $4.99/month · Cancel anytime in App Store settings
          </p>
        </div>
      </div>
    </div>
  );
};
