import React from 'react';
import { TRAIN_COUPLER_GAP, TRAIN_CAB_WIDTH, CAR_GAP } from '../constants';
import { RailCar } from './RailCar';
import { OnboardPassenger, TrainBlock } from '../types';

interface TrainProps {
  x: number; 
  doorsOpen: boolean;
  activeBlockIds: number[]; 
  carOccupancy: (OnboardPassenger | null)[];
  blocks: TrainBlock[];
}

export const Train: React.FC<TrainProps> = ({ x, doorsOpen, activeBlockIds, carOccupancy, blocks }) => {
  // We need to map linear car indices (0-9) to blocks
  let carIndexCounter = 0;

  return (
    <div
      // Anchored to bottom-1/2 (center line) with margin-bottom (mb-6) to sit ABOVE the track
      // Adjusted margin for taller train
      className="absolute bottom-1/2 mb-6 flex items-center z-20 pointer-events-none"
      style={{
        transform: `translate3d(${x}px, 0, 0)`, 
      }}
    >
      {/* Render blocks in order */}
      {blocks.map((block, index) => {
        const isLastBlock = index === blocks.length - 1;
        
        return (
          <div key={block.id} className="flex items-center relative group">
            
            {/* Block Label */}
            <div className="absolute -top-7 left-0 w-full text-center opacity-0 group-hover:opacity-100 transition-opacity">
               <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${activeBlockIds.includes(block.id) ? 'bg-white text-black' : 'bg-slate-700 text-slate-400'}`}>
                 {block.name}
               </span>
            </div>

            {/* Cars in Block */}
            {Array.from({ length: block.capacity }).map((_, i) => {
              const globalCarIndex = carIndexCounter++;
              const occupant = carOccupancy[globalCarIndex];
              const isLastInBlock = i === block.capacity - 1;

              return (
                <RailCar 
                  key={i} 
                  color={block.color} 
                  isDoorOpen={doorsOpen} 
                  isActive={activeBlockIds.includes(block.id)}
                  indexInBlock={i}
                  occupant={occupant}
                  // Remove margin for the last car in the block to match geometry width exactly
                  marginRight={isLastInBlock ? 0 : CAR_GAP}
                />
              );
            })}
            
            {/* Coupling Link */}
            {!isLastBlock && (
              <div 
                className="h-1 bg-slate-600 rounded-full self-center relative"
                style={{ width: `${TRAIN_COUPLER_GAP}px`, margin: 0 }} 
              >
              </div>
            )}
          </div>
        );
      })}
      
      {/* Locomotive / Cab Front - Modern Metro Design - Scaled Height to h-14 */}
      <div 
        className="flex items-center"
        // Add marginLeft to separate from the last car which now has 0 margin
        style={{ width: `${TRAIN_CAB_WIDTH + 6}px`, marginLeft: `${CAR_GAP}px`, zIndex: 30 }}
      >
        <svg viewBox="0 0 32 48" className="w-full h-14" style={{ filter: 'drop-shadow(3px 3px 3px rgba(0,0,0,0.5))' }}>
            <defs>
              <linearGradient id="cabGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#94a3b8" />
              </linearGradient>
            </defs>
            
            {/* Main Cab Body */}
            <path 
                d="M-2 4 H14 L28 12 C30 14, 32 20, 32 30 V38 L22 44 H-2 V4 Z" 
                fill="url(#cabGradient)"
                className="stroke-slate-600 stroke-[1]"
            />
            
            {/* Windshield - Dark Glass */}
            <path 
                d="M14 6 L28 14 V24 L14 22 Z" 
                className="fill-slate-800"
            />
             {/* Side Window */}
            <path 
                d="M2 8 H10 V20 H2 Z" 
                className="fill-slate-800"
            />

            {/* Red Stripe for Visibility */}
            <rect x="-2" y="28" width="34" height="4" className="fill-rose-600" />
            
            {/* Headlight Cluster */}
            <g transform="translate(24, 36)">
               <circle cx="0" cy="0" r="3" className="fill-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
               <circle cx="0" cy="0" r="1.5" className="fill-yellow-200" />
            </g>
            
            {/* Lower Bumper */}
            <path d="M18 44 L32 44 L30 46 H16 L18 44 Z" className="fill-slate-700" />
        </svg>
      </div>
    </div>
  );
};