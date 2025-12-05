import React from 'react';
import { 
  STATION_PIXEL_WIDTH, 
  STATION_PADDING, 
  BLOCK_WIDTH_3, 
  BLOCK_WIDTH_4, 
  TRAIN_COUPLER_GAP, 
  TRAIN_BLOCKS,
  STATIONS,
  REGULAR_TRAIN_BLOCKS,
  BLOCK_WIDTH_7
} from '../constants';
import { WaitingGroup } from '../types';

interface StationPlatformProps {
  name: string;
  id: number;
  alignment: 'rear' | 'front' | 'all';
  positionX: number;
  isActive: boolean;
  waitingGroups: WaitingGroup[]; 
  trainMode: 'long' | 'regular';
}

// Person Icon for Platform (Standing) - Scaled Up
const StandingPerson: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 24 24" className={`w-5 h-5 ${color.replace('bg-', 'text-')} fill-current`} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.6))' }}>
    <circle cx="12" cy="5" r="4" />
    <path d="M12 10 L12 22 M7 22 L7 14 Q7 10 12 10 Q17 10 17 14 L17 22" stroke="currentColor" strokeWidth="3" fill="none" />
  </svg>
);

export const StationPlatform: React.FC<StationPlatformProps> = ({ name, id, alignment, positionX, isActive, waitingGroups, trainMode }) => {
  
  // --- Branch 1: Regular Logic (7-Car) ---
  const getRegularZones = () => {
    // The whole platform is one zone (Block 99)
    // It is always left-aligned relative to the station anchor
    return [
      {
        blockId: 99,
        left: STATION_PADDING,
        width: BLOCK_WIDTH_7
      }
    ];
  };

  // --- Branch 2: Long Logic (10-Car) ---
  const getLongZones = () => {
    // 10-Car Train SDO Logic:
    // Rear Align: [Block 1] -- [Block 3] (Aligned Left)
    // Front Align: [Block 3] -- [Block 2] (Aligned Right relative to train, so Left on platform is Block 3)
    // All Align: Treated as Front Align (Blocks 3 & 2) for 10-car SDO to allow Block 2 access
    
    if (alignment === 'rear') {
      // [Block 1 (3 cars)] -- [Block 3 (4 cars)]
      return [
        { 
          blockId: 1, 
          left: STATION_PADDING, 
          width: BLOCK_WIDTH_3 
        }, 
        { 
          blockId: 3, 
          left: STATION_PADDING + BLOCK_WIDTH_3 + TRAIN_COUPLER_GAP, 
          width: BLOCK_WIDTH_4 
        }  
      ];
    } else {
      // Front & All Alignment: [Block 3 (4 cars)] -- [Block 2 (3 cars)]
      return [
        { 
          blockId: 3, 
          left: STATION_PADDING, 
          width: BLOCK_WIDTH_4 
        }, 
        { 
          blockId: 2, 
          left: STATION_PADDING + BLOCK_WIDTH_4 + TRAIN_COUPLER_GAP, 
          width: BLOCK_WIDTH_3 
        }  
      ];
    }
  };

  // Select logic based on mode
  const zones = trainMode === 'regular' ? getRegularZones() : getLongZones();
  
  // Dynamic width calculation
  const currentPlatformWidth = trainMode === 'regular' 
    ? BLOCK_WIDTH_7 + (STATION_PADDING * 2) 
    : STATION_PIXEL_WIDTH;

  return (
    <div
      className="absolute top-1/2 mt-10 flex flex-col items-center z-10 transition-all duration-500"
      style={{ left: `${positionX}px`, width: `${currentPlatformWidth}px` }}
    >
      {/* Platform Surface */}
      <div 
        className="h-8 bg-slate-800 rounded-sm border-t-4 border-yellow-400 relative flex overflow-hidden shadow-xl transition-all duration-500"
        style={{ width: '100%' }}
      >
        {/* Color Coded Zones on Platform Floor with Labels */}
        {zones.map((zone) => {
           let block = TRAIN_BLOCKS.find(b => b.id === zone.blockId);
           if (!block) block = REGULAR_TRAIN_BLOCKS.find(b => b.id === zone.blockId);
           
           const colorClass = block ? block.color : 'bg-slate-600';
           
           // Calculate destinations for this block from this station
           const futureStations = STATIONS.filter(s => s.id > id);
           
           let destText = "";
           if (trainMode === 'regular') {
              destText = futureStations.length > 0 ? "All Destinations" : "Terminus";
           } else {
               const reachable = futureStations.filter(s => {
                 // Logic: Is this block active at station s?
                 // Rear -> 1 & 3
                 // Front/All -> 2 & 3
                 const activeBlocks = (s.alignment === 'rear') ? [1, 3] : [2, 3];
                 return activeBlocks.includes(zone.blockId);
               });
               destText = reachable.length > 0
                 ? `To Stn ${reachable.map(s => s.id).join(',')}`
                 : "";
           }

           return (
             <div 
               key={zone.blockId}
               className="absolute top-0 bottom-0 flex items-center justify-center border-x border-white/5"
               style={{ left: `${zone.left}px`, width: `${zone.width}px` }}
             >
                {/* Background Tint */}
                <div className={`absolute inset-0 ${colorClass} opacity-30`}></div>
                
                {/* Destination Label */}
                <div className="relative z-10 bg-slate-900/60 px-1 rounded-sm text-[8px] font-bold text-white/90 uppercase tracking-widest shadow-sm backdrop-blur-[1px] border border-white/10">
                   {destText}
                </div>
             </div>
           );
        })}
        
        {/* Subtle Texture/Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20 pointer-events-none"></div>
      </div>

      {/* Waiting Passenger Area - Spatially Aligned & Grouped */}
      <div className="absolute bottom-full mb-0.5 w-full h-20 pointer-events-none">
        {zones.map((zone) => {
          // Find all groups waiting for this block
          const groups = waitingGroups.filter(g => g.blockId === zone.blockId);
          if (groups.length === 0) return null;

          return (
            <div 
              key={zone.blockId}
              className="absolute bottom-0 flex gap-0.5 items-end justify-center pointer-events-auto"
              style={{ left: `${zone.left}px`, width: `${zone.width}px` }}
            >
              {groups.map((group, idx) => (
                 <div key={`${group.destId}-${idx}`} className="flex flex-col items-center min-w-max">
                    {/* Demand Info */}
                    <div className="mb-0.5 bg-black/70 px-1.5 py-0.5 rounded text-[10px] font-mono text-white whitespace-nowrap opacity-90 border border-white/10 shadow-sm z-50">
                      To Stn {group.destId}
                    </div>

                    {/* Crowd Icons */}
                    <div className="flex flex-nowrap justify-center gap-px">
                      {Array.from({length: group.count}).map((_, i) => (
                        <StandingPerson key={i} color={group.color} />
                      ))}
                    </div>
                 </div>
              ))}
            </div>
          );
        })}
      </div>
      
      {/* Pillars */}
      <div className="w-full flex justify-between px-3 opacity-50 mb-0.5 mt-[-2px]">
        <div className="w-1 h-5 bg-slate-700" />
        <div className="w-1 h-5 bg-slate-700" />
      </div>

      {/* Station Name Board */}
      <div className={`px-2 py-0.5 rounded border border-slate-600 transition-colors whitespace-nowrap ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'bg-slate-800 text-slate-400'}`}>
        <span className="text-xs font-bold uppercase tracking-wider">{name}</span>
      </div>
    </div>
  );
};