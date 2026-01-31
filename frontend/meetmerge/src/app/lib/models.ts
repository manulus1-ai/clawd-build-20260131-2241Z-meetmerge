export type VoteChoice = 'yes' | 'maybe' | 'no';

export interface Slot {
  id: string;
  startIso: string; // ISO datetime in UTC or local; display uses Intl.
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  createdAtIso: string;
  slots: Slot[];
  lockedSlotId?: string;
}

export interface SlotTally {
  slotId: string;
  yes: number;
  maybe: number;
  no: number;
}

export interface PollWithTallies {
  poll: Poll;
  tallies: SlotTally[];
}
