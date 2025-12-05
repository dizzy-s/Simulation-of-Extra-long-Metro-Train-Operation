
export interface TrainBlock {
  id: number;
  capacity: number; // Number of railcars
  color: string;
  name: string;
}

export interface Station {
  id: number;
  name: string;
  alignment: 'rear' | 'front'; // Rear align uses Blocks 1&3, Front uses 2&3
  positionX: number; // Relative position on the track (0-1000 scale)
}

// New interface for a passenger on board
export interface OnboardPassenger {
  destId: number;
  color: string; // The color of the passenger group (based on their block assignment)
}

export interface SimulationState {
  trainX: number; // Current position (0-1000 scale)
  isPlaying: boolean;
  speed: number;
  currentStationId: number | null;
  doorsOpen: boolean;
  message: string;
}

export interface PassengerDemand {
  originId: number;
  destId: number;
  carloads: number;
  assignedBlockId: number; // 1, 2, or 3
}

export interface WaitingGroup {
  destId: number;
  blockId: number;
  count: number; // remaining carloads to board
  color: string; // Visual color for the group
}
