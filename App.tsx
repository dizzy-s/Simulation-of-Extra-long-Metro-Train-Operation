import React, { useState, useEffect, useRef } from 'react';
import { Train } from './components/Train';
import { StationPlatform } from './components/StationPlatform';
import { Controls } from './components/Controls';
import { 
  TRAIN_BLOCKS, 
  STATIONS, 
  TRACK_LENGTH, 
  getTrainEffectiveLength,
  STATION_PIXEL_WIDTH,
  STATION_PADDING,
  PASSENGER_DEMAND,
  getBlockIndices
} from './constants';
import { WaitingGroup, OnboardPassenger } from './types';

// Helper to deep clone to avoid mutation bugs
const cloneJSON = <T,>(data: T): T => JSON.parse(JSON.stringify(data));

const App: React.FC = () => {
  // ---- React State (For Rendering Only) ----
  // These are updated from the simulation loop to trigger re-renders
  const [trainX, setTrainX] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [message, setMessage] = useState("Ready to start simulation.");
  const [activeStationId, setActiveStationId] = useState<number | null>(null);
  const [doorsOpen, setDoorsOpen] = useState(false);
  const [activeBlockIds, setActiveBlockIds] = useState<number[]>([]);
  const [waitingLoads, setWaitingLoads] = useState<Record<number, WaitingGroup[]>>({});
  const [carOccupancy, setCarOccupancy] = useState<(OnboardPassenger | null)[]>(Array(10).fill(null));

  // ---- Simulation State (Mutable Ref) ----
  // This holds the "source of truth" for the animation loop to avoid stale closures
  const simRef = useRef({
    trainX: 0,
    isPlaying: false,
    speedMultiplier: 1,
    isWaiting: false,
    waitStartTime: 0,
    lastStationId: null as number | null,
    boardingProcessed: false,
    alightingProcessed: false,
    
    // Data structures mirrored in Ref for synchronous access
    waitingLoads: {} as Record<number, WaitingGroup[]>,
    carOccupancy: Array(10).fill(null) as (OnboardPassenger | null)[],
    
    // UI State mirrored in Ref
    activeStationId: null as number | null,
    doorsOpen: false,
    activeBlockIds: [] as number[],
    message: "Ready to start simulation."
  });

  // ---- Refs for Animation Loop ----
  const requestRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number | undefined>(undefined);

  // ---- Initialization Logic ----
  const initializePassengers = () => {
    const initialWaiting: Record<number, WaitingGroup[]> = {};
    
    PASSENGER_DEMAND.forEach(demand => {
      const block = TRAIN_BLOCKS.find(b => b.id === demand.assignedBlockId);
      const color = block ? block.color : 'bg-gray-500';
      
      if (!initialWaiting[demand.originId]) {
        initialWaiting[demand.originId] = [];
      }
      initialWaiting[demand.originId].push({
        destId: demand.destId,
        blockId: demand.assignedBlockId,
        count: demand.carloads,
        color: color
      });
    });

    const initialOccupancy = Array(10).fill(null);

    // Update Ref
    simRef.current.waitingLoads = cloneJSON(initialWaiting);
    simRef.current.carOccupancy = initialOccupancy;
    simRef.current.trainX = 0;
    simRef.current.lastStationId = null;
    simRef.current.isWaiting = false;
    simRef.current.activeStationId = null;
    simRef.current.doorsOpen = false;
    simRef.current.activeBlockIds = [];
    simRef.current.message = "Ready to start simulation.";

    // Sync to State
    setWaitingLoads(initialWaiting);
    setCarOccupancy(initialOccupancy);
    setTrainX(0);
    setActiveStationId(null);
    setDoorsOpen(false);
    setActiveBlockIds([]);
    setMessage("Ready to start simulation.");
  };

  useEffect(() => {
    initializePassengers();
  }, []);

  // Update Ref when user controls change state
  useEffect(() => {
    simRef.current.isPlaying = isPlaying;
    simRef.current.speedMultiplier = speedMultiplier;
  }, [isPlaying, speedMultiplier]);

  // ---- Physics Logic ----
  const trainEffectiveLen = getTrainEffectiveLength();

  const getStopPosition = (station: typeof STATIONS[0]) => {
    if (station.alignment === 'rear') {
      // Align Start of Train to Start of Station + Padding (Centering)
      return station.positionX + STATION_PADDING;
    } else {
      // Align End of Train to End of Station - Padding (Centering)
      // trainX + len = stationX + width - padding
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
           if (station.alignment === 'rear') {
             sim.activeBlockIds = [1, 3];
             sim.message = `${station.name}: Rear Align. Blocks 1 & 3 Open.`;
           } else {
             sim.activeBlockIds = [2, 3];
             sim.message = `${station.name}: Front Align. Blocks 2 & 3 Open.`;
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
            // Check occupant destination
            if (occupant && occupant.destId === currentStationId) {
              
              // Only allow alighting if the block door is open!
              // Determine block ID for this car index manually or via helper
              let blockId = 0;
              if (i < 3) blockId = 1;      // Cars 0-2: Block 1
              else if (i < 7) blockId = 3; // Cars 3-6: Block 3
              else blockId = 2;            // Cars 7-9: Block 2

              // Check if this block is active
              if (sim.activeBlockIds.includes(blockId)) {
                nextOccupancy[i] = null; // Passenger leaves
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

        // Clone groups to modify counts safely
        const groupsToProcess = stationGroups.map(g => ({...g}));

        groupsToProcess.forEach(group => {
            // STRICT CHECK: Can this group board at this station?
            // Only if their assigned block is currently active
            if (!sim.activeBlockIds.includes(group.blockId)) {
                remainingGroups.push(group); // Keep waiting
                return;
            }

            const blockIndices = getBlockIndices(group.blockId);
            
            // Try to fill empty spots in the assigned block
            for (const idx of blockIndices) {
               if (group.count > 0 && nextOccupancy[idx] === null) {
                 // Assign passenger
                 nextOccupancy[idx] = { 
                    destId: group.destId, 
                    color: group.color 
                 };
                 group.count--;
                 boardedTotal++;
               }
            }
            
            if (group.count > 0) {
              remainingGroups.push(group);
            }
        });

        // Update data
        sim.waitingLoads = { ...sim.waitingLoads, [currentStationId]: remainingGroups };
        sim.carOccupancy = nextOccupancy;
        
        // Sync UI
        setWaitingLoads(sim.waitingLoads);
        setCarOccupancy(nextOccupancy);

        if (boardedTotal > 0) {
            sim.message = `Boarding: ${boardedTotal} carloads boarded.`;
            setMessage(sim.message);
        }
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
        nextX = 0;
        sim.lastStationId = null;
        sim.message = "Route Complete. Resetting...";
        setMessage("Route Complete. Resetting...");
        initializePassengers(); // Resets refs and state
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
    initializePassengers(); // Fully resets refs and state
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden relative">
      
      <div className="absolute top-0 left-0 w-full p-6 z-40 pointer-events-none">
        <h1 className="text-xl font-black tracking-tighter text-white drop-shadow-lg">METRO OPS <span className="text-blue-500">SIM</span></h1>
        <p className="text-slate-400 text-xs mt-1 font-medium bg-slate-900/50 inline-block px-2 py-1 rounded backdrop-blur-sm border border-slate-700/50">
          10-car Train vs 7-car Platforms. 
          <span className="ml-2 text-rose-400">Rear Align (Stn 1,3)</span>
          <span className="ml-2 text-emerald-400">Front Align (Stn 2,4)</span>
        </p>
      </div>

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
                  />
                ))}

                <Train 
                  x={trainX} 
                  doorsOpen={doorsOpen} 
                  activeBlockIds={activeBlockIds}
                  carOccupancy={carOccupancy}
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
      />
    </div>
  );
};

export default App;