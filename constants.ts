import { TrainBlock, Station, PassengerDemand } from './types';

// Visual configuration - SCALED UP for Full Screen Experience
export const PIXELS_PER_CAR = 34; 
export const CAR_GAP = 3; 
export const STATION_LENGTH_CARS = 7; 
export const TRAIN_COUPLER_GAP = 8; 
export const TRAIN_CAB_WIDTH = 42; 

// Helper to calculate pixel width of a block of cars
export const getBlockWidth = (capacity: number) => 
  (capacity * PIXELS_PER_CAR) + ((capacity - 1) * CAR_GAP);

// Pre-calculated widths for the specific blocks we use
export const BLOCK_WIDTH_3 = getBlockWidth(3); // ~108px
export const BLOCK_WIDTH_4 = getBlockWidth(4); // ~145px
export const BLOCK_WIDTH_7 = getBlockWidth(7); // ~260px (approx)

// The width of the active train segment (3+4 or 4+3 cars + coupler)
// Block(3) + Gap + Block(4) = 108 + 8 + 145 = 261px
export const TRAIN_ACTIVE_SEGMENT_WIDTH = BLOCK_WIDTH_3 + TRAIN_COUPLER_GAP + BLOCK_WIDTH_4;

// Padding on each side of the train when centered in station
export const STATION_PADDING = 1;

// Total Station Width
export const STATION_PIXEL_WIDTH = TRAIN_ACTIVE_SEGMENT_WIDTH + (STATION_PADDING * 2);

// Defined based on prompt: 
// Order Rear -> Front: [Block 1 (3)] - [Block 3 (4)] - [Block 2 (3)]
export const TRAIN_BLOCKS: TrainBlock[] = [
  { id: 1, capacity: 3, color: 'bg-rose-500', name: 'Block 1' },
  { id: 3, capacity: 4, color: 'bg-amber-500', name: 'Block 3' },
  { id: 2, capacity: 3, color: 'bg-blue-500', name: 'Block 2' },
];

export const REGULAR_TRAIN_BLOCKS: TrainBlock[] = [
  { id: 99, capacity: 7, color: 'bg-amber-500', name: 'Standard Train' }
];

// Helper to find car index range for a block
export const getBlockIndices = (blockId: number): number[] => {
  if (blockId === 1) return [0, 1, 2];
  if (blockId === 3) return [3, 4, 5, 6];
  if (blockId === 2) return [7, 8, 9];
  // Regular Train
  if (blockId === 99) return [0, 1, 2, 3, 4, 5, 6]; 
  return [];
};

// Track Layout
// Widened to 1800px for larger scale
export const TRACK_LENGTH = 1800;

// New Evenly Distributed Positions for 1800px Track
// Spacing logic: Start 150, Interval 450
export const STATIONS: Station[] = [
  { id: 1, name: "Station 1", alignment: 'rear', positionX: 150 },
  { id: 2, name: "Station 2", alignment: 'all', positionX: 600 },
  { id: 3, name: "Station 3", alignment: 'rear', positionX: 1050 },
  { id: 4, name: "Station 4", alignment: 'all', positionX: 1500 },
];

// Helper to calculate total train length (excluding Cab, used for alignment logic)
export const getTrainEffectiveLength = (mode: 'long' | 'regular' = 'long') => {
  if (mode === 'regular') {
    return BLOCK_WIDTH_7;
  }
  return BLOCK_WIDTH_3 + TRAIN_COUPLER_GAP + BLOCK_WIDTH_4 + TRAIN_COUPLER_GAP + BLOCK_WIDTH_3;
};

// Passenger Demand Configuration
export const PASSENGER_DEMAND: PassengerDemand[] = [
  // 1-2 (Rear -> Front/All): Cross type -> Block 3
  { originId: 1, destId: 2, carloads: 2, assignedBlockId: 3 },
  // 1-3 (Rear -> Rear): Same type -> Block 1 preferred
  { originId: 1, destId: 3, carloads: 3, assignedBlockId: 1 },
  // 1-4 (Rear -> Front/All): Cross type -> Block 3
  { originId: 1, destId: 4, carloads: 2, assignedBlockId: 3 },
  // 2-3 (Front/All -> Rear): Cross type -> Block 3
  { originId: 2, destId: 3, carloads: 2, assignedBlockId: 3 },
  // 2-4 (Front/All -> Front/All): Same type -> Block 2 preferred (Assumed for 'all' to mimic front access if possible, or just Block 3)
  // Since 'all' stations behave like Rear for SDO in our logic, this might need adjustment, but keeping Block 2 implies user intent for Front.
  { originId: 2, destId: 4, carloads: 3, assignedBlockId: 2 },
  // 3-4 (Rear -> Front/All): Cross type -> Block 3
  { originId: 3, destId: 4, carloads: 2, assignedBlockId: 3 },
];