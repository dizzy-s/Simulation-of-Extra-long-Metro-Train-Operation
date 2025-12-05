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
  
  const [trainMode, setTrainMode] = useState<'long' | 'regular'>('long');

  // ---- Simulation State (Mutable Ref) ----
  // We keep all mutable state in a ref to ensure the loop runs smoothly without closure staleness
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
  const initializePassengers = (mode: 'long' | 'regular' = 'long', resetTrainOnly: boolean = false) => {
    let initialWaiting = simRef.current.waitingLoads;

    if (!resetTrainOnly) {
        initialWaiting = {};
        PASSENGER_DEMAND.forEach(demand => {
          // KEY: For regular, force assignedBlockId to 99
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

  useEffect(() => {
    simRef.current.isPlaying = isPlaying;
    simRef.current.speedMultiplier = speedMultiplier;
  }, [isPlaying, speedMultiplier]);


  // ==================================================================================
  // BRANCH 1: REGULAR (7-CAR) LOGIC
  // ==================================================================================
  const runRegularSimulation = (sim: typeof simRef.current, time: number, deltaTime: number) => {
    
    // 1. Station Ops
    if (sim.isWaiting) {
       const elapsed = time - sim.waitStartTime;
       const waitDuration = 3000 / sim.speedMultiplier;
       const currentStationId = sim.activeStationId!;
       const station = STATIONS.find(s => s.id === currentStationId);

       // Doors Open
       if (elapsed > 500 && elapsed < waitDuration && !sim.doorsOpen) {
          sim.doorsOpen = true;
          sim.activeBlockIds = [99]; // Always Block 99 for regular
          sim.message = `${station?.name}: Doors Open.`;
          setDoorsOpen(true);
          setActiveBlockIds([99]);
          setMessage(sim.message);
       }

       // Alighting
       if (elapsed > 1000 && !sim.alightingProcessed) {
           sim.alightingProcessed = true;
           let alightedCount = 0;
           const nextOccupancy = [...sim.carOccupancy];
           for (let i = 0; i < nextOccupancy.length; i++) {
               const occupant = nextOccupancy[i];
               if (occupant && occupant.destId === currentStationId) {
                   // For regular train, any door is Block 99. We are open.
                   nextOccupancy[i] = null;
                   alightedCount++;
               }
           }
           sim.carOccupancy = nextOccupancy;
           setCarOccupancy(nextOccupancy);
           if (alightedCount > 0) {
               sim.message = `Alighting: ${alightedCount} carloads.`;
               setMessage(sim.message);
           }
       }

       // Boarding
       if (elapsed > 1500 && !sim.boardingProcessed) {
           sim.boardingProcessed = true;
           const nextOccupancy = [...sim.carOccupancy];
           const stationGroups = sim.waitingLoads[currentStationId] || [];
           const remainingGroups: WaitingGroup[] = [];
           let boardedTotal = 0;
           let leftBehindTotal = 0;

           stationGroups.forEach(group => {
               // Only board if group is for block 99 (which they all should be in regular mode)
               if (group.blockId !== 99) {
                   remainingGroups.push(group);
                   return;
               }

               // Regular train has indices 0-6
               const blockIndices = [0,1,2,3,4,5,6];
               
               for (const idx of blockIndices) {
                   if (idx < nextOccupancy.length && group.count > 0 && nextOccupancy[idx] === null) {
                       nextOccupancy[idx] = { destId: group.destId, color: group.color };
                       group.count--;
                       boardedTotal++;
                   }
               }

               if (group.count > 0) {
                   leftBehindTotal += group.count;
                   remainingGroups.push(group);
               }
           });

           sim.waitingLoads = { ...sim.waitingLoads, [currentStationId]: remainingGroups };
           sim.carOccupancy = nextOccupancy;
           setWaitingLoads(sim.waitingLoads);
           setCarOccupancy(nextOccupancy);
           if (boardedTotal > 0) {
               sim.message = `Boarding: ${boardedTotal} carloads.`;
               setMessage(sim.message);
           }
       }

       // Departure
       if (elapsed > waitDuration) {
           sim.doorsOpen = false;
           sim.message = "Doors closing...";
           setDoorsOpen(false);
           setMessage(sim.message);
           if (elapsed > waitDuration + 1000) {
               sim.isWaiting = false;
               sim.lastStationId = sim.activeStationId;
               sim.activeStationId = null;
               sim.activeBlockIds = [];
               sim.message = "Departing...";
               setActiveStationId(null);
               setActiveBlockIds([]);
               setMessage(sim.message);
           }
       }
       return;
    }

    // 2. Movement Logic (Regular)
    const moveAmount = (0.1 * deltaTime) * sim.speedMultiplier;
    let nextX = sim.trainX + moveAmount;
    let shouldStop = false;
    let stopStation = null;
    let snapX = 0;

    for (const station of STATIONS) {
        if (station.id === sim.lastStationId) continue;
        
        // Regular Train ALWAYS stops at Left Padding
        const targetX = station.positionX + STATION_PADDING;
        
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
            // Loop Logic for Regular
            const hasWaiting = Object.values(sim.waitingLoads).some(groups => groups.length > 0);
            if (hasWaiting) {
                sim.message = "Looping Train...";
                setMessage(sim.message);
                initializePassengers('regular', true);
            } else {
                sim.message = "Resetting...";
                setMessage(sim.message);
                initializePassengers('regular');
            }
        } else {
            sim.trainX = nextX;
            setTrainX(nextX);
        }
    }
  };


  // ==================================================================================
  // BRANCH 2: LONG (10-CAR) LOGIC
  // ==================================================================================
  const runLongSimulation = (sim: typeof simRef.current, time: number, deltaTime: number) => {
     const trainEffectiveLen = getTrainEffectiveLength('long');

     // 1. Station Ops
     if (sim.isWaiting) {
       const elapsed = time - sim.waitStartTime;
       const waitDuration = 3000 / sim.speedMultiplier;
       const currentStationId = sim.activeStationId!;
       const station = STATIONS.find(s => s.id === currentStationId);

       // Doors
       if (elapsed > 500 && elapsed < waitDuration && !sim.doorsOpen) {
           sim.doorsOpen = true;
           if (station) {
               if (station.alignment === 'rear') {
                   sim.activeBlockIds = [1, 3];
                   sim.message = `${station.name}: Rear Align. Blocks 1 & 3 Open.`;
               } else {
                   // Front & All use Right Alignment (Blocks 2 & 3)
                   sim.activeBlockIds = [2, 3];
                   sim.message = `${station.name}: Front/Std Align. Blocks 2 & 3 Open.`;
               }
           }
           setDoorsOpen(true);
           setActiveBlockIds(sim.activeBlockIds);
           setMessage(sim.message);
       }

       // Alighting
       if (elapsed > 1000 && !sim.alightingProcessed) {
           sim.alightingProcessed = true;
           let alightedCount = 0;
           const nextOccupancy = [...sim.carOccupancy];
           for (let i = 0; i < nextOccupancy.length; i++) {
               const occupant = nextOccupancy[i];
               if (occupant && occupant.destId === currentStationId) {
                   // Map index to block
                   let blockId = 0;
                   if (i < 3) blockId = 1;
                   else if (i < 7) blockId = 3;
                   else blockId = 2;

                   if (sim.activeBlockIds.includes(blockId)) {
                       nextOccupancy[i] = null;
                       alightedCount++;
                   }
               }
           }
           sim.carOccupancy = nextOccupancy;
           setCarOccupancy(nextOccupancy);
           if (alightedCount > 0) setMessage(`Alighting: ${alightedCount} carloads.`);
       }

       // Boarding
       if (elapsed > 1500 && !sim.boardingProcessed) {
           sim.boardingProcessed = true;
           const nextOccupancy = [...sim.carOccupancy];
           const stationGroups = sim.waitingLoads[currentStationId] || [];
           const remainingGroups: WaitingGroup[] = [];
           let boardedTotal = 0;

           stationGroups.forEach(group => {
               if (!sim.activeBlockIds.includes(group.blockId)) {
                   remainingGroups.push(group);
                   return;
               }

               const blockIndices = getBlockIndices(group.blockId);
               for (const idx of blockIndices) {
                   if (idx < nextOccupancy.length && group.count > 0 && nextOccupancy[idx] === null) {
                       nextOccupancy[idx] = { destId: group.destId, color: group.color };
                       group.count--;
                       boardedTotal++;
                   }
               }
               
               if (group.count > 0) remainingGroups.push(group);
           });

           sim.waitingLoads = { ...sim.waitingLoads, [currentStationId]: remainingGroups };
           sim.carOccupancy = nextOccupancy;
           setWaitingLoads(sim.waitingLoads);
           setCarOccupancy(nextOccupancy);
           if (boardedTotal > 0) setMessage(`Boarding: ${boardedTotal} carloads.`);
       }

       // Departure
       if (elapsed > waitDuration) {
           sim.doorsOpen = false;
           setMessage("Doors closing...");
           setDoorsOpen(false);
           if (elapsed > waitDuration + 1000) {
               sim.isWaiting = false;
               sim.lastStationId = sim.activeStationId;
               sim.activeStationId = null;
               sim.activeBlockIds = [];
               setMessage("Departing...");
               setActiveStationId(null);
               setActiveBlockIds([]);
           }
       }
       return;
     }

     // 2. Movement (Long)
     const moveAmount = (0.1 * deltaTime) * sim.speedMultiplier;
     let nextX = sim.trainX + moveAmount;
     let shouldStop = false;
     let stopStation = null;
     let snapX = 0;

     for (const station of STATIONS) {
         if (station.id === sim.lastStationId) continue;

         let targetX = 0;
         if (station.alignment === 'rear') {
             targetX = station.positionX + STATION_PADDING;
         } else {
             // Front OR All: Right Align
             targetX = (station.positionX + STATION_PIXEL_WIDTH - STATION_PADDING) - trainEffectiveLen;
         }

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
             sim.message = "Route Complete. Resetting...";
             setMessage(sim.message);
             initializePassengers('long');
         } else {
             sim.trainX = nextX;
             setTrainX(nextX);
         }
     }
  };


  // ==================================================================================
  // MAIN LOOP
  // ==================================================================================
  const updateSimulation = (time: number, deltaTime: number) => {
    const sim = simRef.current;
    if (!sim.isPlaying) return;

    if (sim.trainMode === 'regular') {
        runRegularSimulation(sim, time, deltaTime);
    } else {
        runLongSimulation(sim, time, deltaTime);
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