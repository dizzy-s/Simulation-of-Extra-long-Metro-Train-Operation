import React from 'react';
import { PIXELS_PER_CAR, CAR_GAP } from '../constants';
import { OnboardPassenger } from '../types';

interface RailCarProps {
  color: string;
  isDoorOpen: boolean;
  isActive: boolean;
  indexInBlock: number;
  occupant: OnboardPassenger | null; 
  marginRight?: number; // Optional prop to override default gap
}

// Simple Person Icon Component - Scaled Up
const PersonIcon = ({ color }: { color: string }) => (
  <svg viewBox="0 0 24 24" className={`w-5 h-5 ${color.replace('bg-', 'text-')} fill-current drop-shadow-sm`} style={{ filter: 'drop-shadow(0px 1px 1px rgba(0,0,0,0.5))' }}>
    <circle cx="12" cy="7" r="5" />
    <path d="M4 22 C4 17 7 13 12 13 C17 13 20 17 20 22" />
  </svg>
);

export const RailCar: React.FC<RailCarProps> = ({ color, isDoorOpen, isActive, indexInBlock, occupant, marginRight }) => {
  // Use provided marginRight if available, otherwise default to CAR_GAP
  const effectiveMargin = marginRight !== undefined ? marginRight : CAR_GAP;

  return (
    <div
      // Increased height to h-14 (56px) for larger scale
      className={`relative h-14 flex flex-col items-center justify-between py-1 border border-slate-800 rounded-sm transition-all duration-300 ${color} ${isActive ? 'opacity-100 shadow-[0_0_20px_rgba(255,255,255,0.3)] z-10' : 'opacity-40'}`}
      style={{
        width: `${PIXELS_PER_CAR}px`,
        marginRight: `${effectiveMargin}px`,
      }}
    >
      {/* Load Number Indicator - High Contrast - Scaled Up */}
      <div className={`flex items-center justify-center w-5 h-5 rounded-full mt-[-10px] border border-white/20 shadow-sm ${occupant ? 'bg-green-500 text-white' : 'bg-slate-900/80 text-slate-500'}`}>
        <span className="text-xs font-black leading-none">
            {occupant ? '1' : '0'}
        </span>
      </div>

      {/* Interior / Windows Area */}
      <div className="flex items-center justify-center w-full flex-1">
        {occupant ? (
          <div className="animate-in fade-in zoom-in duration-300">
             <PersonIcon color="bg-white" />
          </div>
        ) : (
          /* Empty Space */
          <div className="w-1.5 h-1.5 bg-slate-900/20 rounded-full" />
        )}
      </div>

      {/* Destination Indicator - Bottom (if occupied) */}
       <div className="text-[8px] font-mono font-bold text-white/90 leading-none h-3.5 bg-black/20 w-full text-center flex items-center justify-center overflow-hidden whitespace-nowrap px-[1px]">
        {occupant ? `Stn ${occupant.destId}` : ''}
      </div>


      {/* Door Indicator */}
      {isDoorOpen && isActive && (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-1.5 bg-green-400 animate-pulse rounded-full shadow-[0_0_8px_#4ade80]" />
      )}
      

    </div>
  );
};