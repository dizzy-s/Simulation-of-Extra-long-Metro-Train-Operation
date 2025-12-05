import React from 'react';
import { 
  STATION_PIXEL_WIDTH, 
  STATION_PADDING, 
  BLOCK_WIDTH_3, 
  BLOCK_WIDTH_4, 
  TRAIN_COUPLER_GAP,
  TRAIN_BLOCKS,
  STATIONS
} from '../constants';
import { WaitingGroup } from '../types';

interface StationPlatformProps {
  name: string;
  id: number;
  alignment: 'rear' | 'front';
  positionX: number;
  isActive: boolean;
  waitingGroups: WaitingGroup[]; 
}

// Person Icon for Platform (Standing) - Scaled Up
const StandingPerson: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 24 24" className={`w-5 h-5 ${color.replace('bg-', 'text-')} fill-current`} style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.6))' }}>
    <circle cx="12" cy="5" r="4" />
    <path d="M12 10 L12 22 M7 22 L7 14 Q7 10 12 10 Q17 10 17 14 L17 22" stroke="currentColor" strokeWidth="3" fill="none" />
  </svg>
);

export const StationPlatform: React.FC<StationPlatformProps> = ({ name, id, alignment, positionX, isActive, waitingGroups }) => {
  
  // Define spatial zones using ABSOLUTE PIXEL positioning to align perfectly with train doors
  const getBlockZones = () => {
    // Both Rear and Front alignments use the same 'centered' train segment logic
    // We just need to know which block is on the left and which is on the right
    // The Active Train Segment starts at `STATION_PADDING` px from left edge.
    
    if (alignment === 'rear') {
      // Rear Alignment: [Block 1 (3 cars)] -- [Block 3 (4 cars)]
      // Block 1 is first.
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
      // Front Alignment: [Block 3 (4 cars)] -- [Block 2 (3 cars)]
      // Block 3 is first (Leftmost in the active segment).
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

  const zones = getBlockZones();

  return (
    <div
      // Anchored top-1/2 with mt-10. Train bottom is at ~center-24px. Platform top at ~center+40px.
      className="absolute top-1/2 mt-10 flex flex-col items-center z-10"
      style={{ left: `${positionX}px`, width: `${STATION_PIXEL_WIDTH}px` }}
    >
      {/* Platform Surface */}
      <div 
        className="h-8 bg-slate-800 rounded-sm border-t-4 border-yellow-400 relative flex overflow-hidden shadow-xl"
        style={{ width: '100%' }}
      >
        {/* Color Coded Zones on Platform Floor with Labels */}
        {zones.map((zone) => {
           const block = TRAIN_BLOCKS.find(b => b.id === zone.blockId);
           const colorClass = block ? block.color : 'bg-slate-600';
           
           // Calculate destinations for this block from this station
           const futureStations = STATIONS.filter(s => s.id > id);
           const reachable = futureStations.filter(s => {
             // Logic: Is this block active at station s?
             const activeBlocks = s.alignment === 'rear' ? [1, 3] : [2, 3];
             return activeBlocks.includes(zone.blockId);
           });

           const destText = reachable.length > 0
             ? `To Stn ${reachable.map(s => s.id).join(',')}`
             : "No Service";

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