import React, { useState, useEffect, useRef } from 'react';
import { Train } from './components/Train';
import { StationPlatform } from './components/StationPlatform';
import { Controls } from './components/Controls';
import { Header } from './components/Header';
import { 
  TRAIN_BLOCKS, 
  REGULAR_TRAIN_BLOCKS,
  STATIONS, 
  TRACK_LENGTH, 
  getTrainEffectiveLength,
  STATION_PIXEL_WIDTH,
  STATION_PADDING,
  PASSENGER_DEMAND,
  getBlockIndices,
  TRAIN_ACTIVE_SEGMENT_WIDTH,
  BLOCK_WIDTH_7
} from './constants';
import { WaitingGroup, OnboardPassenger } from './types';

// Helper to deep clone to avoid mutation bugs
const cloneJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data));

const App: React.FC = () => {
  // ---- React State (For Rendering Only) ----
  const [trainX, setTrainX] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [message, setMessage] = useState("Ready to start.");
  const [activeStationId, setActiveStationId] = useState<number | null>(null);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [activeBlockIds, setActiveBlockIds] = useState<number[]>([]);
  const [waitingLoads, setWaitingLoads] = useState<Record<number, WaitingGroup[]>>({});
  const [carOccupancy, setCarOccupancy] = useState<(OnboardPassenger | null)[]>(Array(10).fill(null));
  
  // New State for Mode
  const [trainMode, setTrainMode] = useState<'long' | 'regular'>('long');

  // ---- Simulation State (Mutable Ref) ----
  const simRef = useRef({
    trainX: 0,
    isPlaying: false,
    speedMultiplier: 1,
    isWaiting: false,
    waitStartTime: 0,
    lastStationId: null as number | null,
    boardingProcessed: false,
    alightingProcessed: false,
    trainMode: 'long' as 'long' | 'regular',
    
    // Data structures mirrored in Ref
    waitingLoads: {} as Record<number, WaitingGroup[]>,
    carOccupancy: Array(10).fill(null) as (OnboardPassenger | null)[],
    
    // UI State mirrored in Ref
    activeStationId: null as number | null,
    doorsOpen: false,
    activeBlockIds: [] as number[],
    message: "Ready to start."
  });

  // ---- Refs for Animation Loop ----
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  // ---- Initialization Logic ----
  // mode parameter allows forcing a mode initialization (e.g. on switch)
  const initializePassengers = (mode: 'long' | 'regular' = 'long', resetTrainOnly: boolean = false) => {
    
    // If we are just resetting the train loop (Regular mode loop 2), 
    // we DON'T reset waiting loads.
    let initialWaiting = simRef.current.waitingLoads;

    if (!resetTrainOnly) {
        initialWaiting = {};
        PASSENGER_DEMAND.forEach(demand => {
          // If Regular mode, everyone uses Block 99.
          // If Long mode, use assigned block.
          const effectiveBlockId = mode === 'regular' ? 99 : demand.assignedBlockId;
          
          let block = TRAIN_BLOCKS.find(b => b.id === effectiveBlockId);
          if (mode === 'regular') block = REGULAR_TRAIN_BLOCKS[0];

          const color = block ? block.color : 'bg-gray-500';
          
          if (!initialWaiting[demand.originId]) {
            initialWaiting[demand.originId] = [];
          }
          initialWaiting[demand.originId].push({
            destId: demand.destId,
            blockId: effectiveBlockId,
            count: demand.carloads,
            color: color
          });
        });
    }

    const trainCapacity = mode === 'regular' ? 7 : 10;
    const initialOccupancy = Array(trainCapacity).fill(null);

    // Update Ref
    if (!resetTrainOnly) {
      simRef.current.waitingLoads = cloneJSON(initialWaiting);
      setWaitingLoads(initialWaiting);
    }
    
    simRef.current.carOccupancy = initialOccupancy;
    simRef.current.trainX = 0;
    simRef.current.lastStationId = null;
    simRef.current.isWaiting = false;
    simRef.current.activeStationId = null;
    simRef.current.doorsOpen = false;
    simRef.current.activeBlockIds = [];
    simRef.current.message = resetTrainOnly ? "Train 2 Starting..." : "Ready to start.";
    simRef.current.trainMode = mode;

    // Sync to State
    setCarOccupancy(initialOccupancy);
    setTrainX(0);
    setActiveStationId(null);
    setDoorsOpen(false);
    setActiveBlockIds([]);
    setMessage(simRef.current.message);
  };

  useEffect(() => {
    initializePassengers(trainMode);
  }, [trainMode]);

  // Update Ref when user controls change state
  useEffect(() => {
    simRef.current.isPlaying = isPlaying;
    simRef.current.speedMultiplier = speedMultiplier;
  }, [isPlaying, speedMultiplier]);

  // ---- Physics Logic ----
  const trainEffectiveLen = getTrainEffectiveLength(trainMode);

  const getStopPosition = (station: typeof STATIONS[0]) => {
    if (trainMode === 'regular') {
        // Regular train platform is resized to BLOCK_WIDTH_7 in StationPlatform
        // So we just stop at the padding start
        return station.positionX + STATION_PADDING;
    }

    // Long Train SDO Logic:
    // Rear: Aligns Left
    // All: Aligns Left (Defaulting to same as Rear for simplicity & 7-car consistency)
    // Front: Aligns Right
    if (station.alignment === 'rear' || station.alignment === 'all') {
      return station.positionX + STATION_PADDING;
    } else {
      return (station.positionX + STATION_PIXEL_WIDTH - STATION_PADDING) - trainEffectiveLen;
    }
  };

  const updateSimulation = (time: number, deltaTime: number) => {
    const sim = simRef.current; // Access mutable ref
    if (!sim.isPlaying) return;

    // --- Waiting / Station Operations Logic ---
    if (sim.isWaiting) {
      const elapsed = time - sim.waitStartTime;
      const waitDuration = 3000 / sim.speedMultiplier;
      const currentStationId = sim.activeStationId!;
      const station = STATIONS.find(s => s.id === currentStationId);

      // 1. Doors Open (at 500ms)
      if (elapsed > 500 && elapsed < waitDuration && !sim.doorsOpen) {
        sim.doorsOpen = true;
        if (station) {
           if (sim.trainMode === 'regular') {
               sim.activeBlockIds = [99];
               sim.message = `${station.name}: Doors Open.`;
           } else {
               // Long Train Logic
               if (station.alignment === 'rear' || station.alignment === 'all') {
                 sim.activeBlockIds = [1, 3];
                 sim.message = `${station.name}: Rear Align. Blocks 1 & 3 Open.`;
               } else {
                 sim.activeBlockIds = [2, 3];
                 sim.message = `${station.name}: Front Align. Blocks 2 & 3 Open.`;
               }
           }
        }
        // Sync UI
        setDoorsOpen(true);
        setActiveBlockIds(sim.activeBlockIds);
        setMessage(sim.message);
      }

      // 2. Alighting (at 1000ms)
      if (elapsed > 1000 && !sim.alightingProcessed && currentStationId) {
        sim.alightingProcessed = true;
        
        let alightedCount = 0;
        const nextOccupancy = [...sim.carOccupancy];

        for (let i = 0; i < nextOccupancy.length; i++) {
            const occupant = nextOccupancy[i];
            if (occupant && occupant.destId === currentStationId) {
              
              let blockId = 0;
              if (sim.trainMode === 'regular') {
                  blockId = 99;
              } else {
                  if (i < 3) blockId = 1;      
                  else if (i < 7) blockId = 3; 
                  else blockId = 2;            
              }

              if (sim.activeBlockIds.includes(blockId)) {
                nextOccupancy[i] = null; 
                alightedCount++;
              }
            }
        }

        if (alightedCount > 0) {
            sim.message = `Alighting: ${alightedCount} carloads left.`;
            setMessage(sim.message);
        }
        sim.carOccupancy = nextOccupancy;
        setCarOccupancy(nextOccupancy);
      }

      // 3. Boarding (at 1500ms)
      if (elapsed > 1500 && !sim.boardingProcessed && currentStationId) {
        sim.boardingProcessed = true;

        const nextOccupancy = [...sim.carOccupancy];
        const stationGroups = sim.waitingLoads[currentStationId] || [];
        const remainingGroups: WaitingGroup[] = [];
        let boardedTotal = 0;
        let leftBehindTotal = 0;

        // Clone groups to modify counts safely
        const groupsToProcess = stationGroups.map(g => ({...g}));

        groupsToProcess.forEach(group => {
            // STRICT CHECK: Can this group board at this station?
            if (!sim.activeBlockIds.includes(group.blockId)) {
                remainingGroups.push(group); 
                return;
            }

            const blockIndices = getBlockIndices(group.blockId);
            
            // Try to fill empty spots in the assigned block
            for (const idx of blockIndices) {
               // Ensure we don't exceed train bounds (Regular train is smaller)
               if (idx < nextOccupancy.length && group.count > 0 && nextOccupancy[idx] === null) {
                 nextOccupancy[idx] = { 
                    destId: group.destId, 
                    color: group.color 
                 };
                 group.count--;
                 boardedTotal++;
               }
            }
            
            if (group.count > 0) {
              leftBehindTotal += group.count;
              remainingGroups.push(group);
            }
        });

        // Update data
        sim.waitingLoads = { ...sim.waitingLoads, [currentStationId]: remainingGroups };
        sim.carOccupancy = nextOccupancy;
        
        // Sync UI
        setWaitingLoads(sim.waitingLoads);
        setCarOccupancy(nextOccupancy);

        if (leftBehindTotal > 0 && sim.trainMode === 'regular') {
            sim.message = `Full! ${leftBehindTotal} carloads waiting for next train.`;
        } else if (boardedTotal > 0) {
            sim.message = `Boarding: ${boardedTotal} carloads boarded.`;
        }
        setMessage(sim.message);
      }

      // 4. Departure (at end)
      if (elapsed > waitDuration) {
        sim.doorsOpen = false;
        sim.message = "Doors closing...";
        setDoorsOpen(false);
        setMessage("Doors closing...");
        
        if (elapsed > waitDuration + 1000) {
           sim.isWaiting = false;
           sim.lastStationId = sim.activeStationId;
           sim.activeStationId = null;
           sim.activeBlockIds = [];
           sim.message = "Departing...";
           
           setActiveStationId(null);
           setActiveBlockIds([]);
           setMessage("Departing...");
        }
      }
      return;
    }

    // --- Moving Logic ---
    const moveAmount = (0.1 * deltaTime) * sim.speedMultiplier;
    let nextX = sim.trainX + moveAmount;
    let shouldStop = false;
    let stopStation = null;
    let snapX = 0;

    for (const station of STATIONS) {
      if (station.id === sim.lastStationId) continue;

      const targetX = getStopPosition(station);
      // Check if we passed the stop position in this frame
      if (sim.trainX < targetX && nextX >= targetX) {
        shouldStop = true;
        stopStation = station;
        snapX = targetX;
        break;
      }
    }

    if (shouldStop && stopStation) {
      sim.trainX = snapX;
      sim.isWaiting = true;
      sim.waitStartTime = time;
      sim.boardingProcessed = false;
      sim.alightingProcessed = false;
      sim.activeStationId = stopStation.id;
      
      setTrainX(snapX);
      setActiveStationId(stopStation.id);
      setMessage(`Arriving at ${stopStation.name}...`);
    } else {
      if (nextX > TRACK_LENGTH) {
        // Route Complete
        // If Regular mode and passengers are waiting, loop again without resetting demand
        const hasWaiting = Object.values(sim.waitingLoads).some(groups => groups.length > 0);
        
        if (sim.trainMode === 'regular' && hasWaiting) {
             sim.message = "Route Complete. Sending Train 2...";
             setMessage("Route Complete. Sending Train 2...");
             initializePassengers('regular', true); // resetTrainOnly = true
        } else {
             nextX = 0;
             sim.lastStationId = null;
             sim.message = "Route Complete. Resetting...";
             setMessage("Route Complete. Resetting...");
             initializePassengers(sim.trainMode); // Full reset
        }
      } else {
        sim.trainX = nextX;
        setTrainX(nextX);
      }
    }
  };

  const animate = (time: number) => {
    if (lastTimeRef.current !== undefined) {
      const deltaTime = time - lastTimeRef.current;
      updateSimulation(time, deltaTime);
    }
    lastTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const handleReset = () => {
    setIsPlaying(false);
    initializePassengers(trainMode);
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden relative">
      
      <Header />

      {/* Main Track Container - Full Screen Area */}
      <div className="flex-1 w-full relative bg-slate-900/30 overflow-hidden flex items-center justify-center">
        
        {/* Scrollable Container for Track if screen is narrow */}
        <div className="w-full h-full overflow-x-auto overflow-y-hidden flex items-center justify-center custom-scrollbar">
           
           {/* The Track Canvas - Increased Height (70vh) and Scaling */}
           <div 
             className="relative flex-shrink-0 bg-slate-800/20 border-y border-slate-700/30 backdrop-blur-sm shadow-2xl transition-all duration-500"
             style={{ width: `${TRACK_LENGTH + 100}px`, height: '70vh' }}
           >
              {/* Track Line - Centered Vertically */}
              <div className="absolute top-1/2 left-0 w-full h-1.5 bg-slate-700/50 rounded-full -mt-0.5"></div>
              
              {/* Content Wrapper */}
              <div className="absolute top-0 left-[50px] h-full" style={{ width: `${TRACK_LENGTH}px` }}>
                {STATIONS.map(station => (
                  <StationPlatform 
                    key={station.id}
                    {...station}
                    isActive={activeStationId === station.id}
                    waitingGroups={waitingLoads[station.id] || []}
                    trainMode={trainMode}
                  />
                ))}

                <Train 
                  x={trainX} 
                  doorsOpen={doorsOpen} 
                  activeBlockIds={activeBlockIds}
                  carOccupancy={carOccupancy}
                  blocks={trainMode === 'regular' ? REGULAR_TRAIN_BLOCKS : TRAIN_BLOCKS}
                />
              </div>
           </div>
        </div>
      </div>

      <Controls 
        isPlaying={isPlaying} 
        onPlayPause={() => setIsPlaying(p => !p)} 
        onReset={handleReset}
        speed={speedMultiplier}
        onSpeedChange={setSpeedMultiplier}
        statusMessage={message}
        trainMode={trainMode}
        onTrainModeChange={setTrainMode}
      />
    </div>
  );
};

export default App;