import { Injectable } from '@angular/core';
import { Poll, PollWithTallies, SlotTally, VoteChoice } from './models';

interface DemoVote {
  pollKey: string;
  slotId: string;
  choice: VoteChoice;
  votedAtIso: string;
}

@Injectable({ providedIn: 'root' })
export class DemoStoreService {
  private pollsKey = 'mm_demo_polls_v1';
  private votesKey = 'mm_demo_votes_v1';

  savePoll(poll: Poll): void {
    const all = this.getAllPolls();
    all[poll.id] = poll;
    localStorage.setItem(this.pollsKey, JSON.stringify(all));
  }

  getPoll(pollId: string): Poll | undefined {
    return this.getAllPolls()[pollId];
  }

  vote(pollKey: string, slotId: string, choice: VoteChoice): void {
    const votes = this.getAllVotes().filter(v => !(v.pollKey === pollKey && v.slotId === slotId));
    votes.push({ pollKey, slotId, choice, votedAtIso: new Date().toISOString() });
    localStorage.setItem(this.votesKey, JSON.stringify(votes));
  }

  getPollWithTallies(poll: Poll, pollKey: string): PollWithTallies {
    const votes = this.getAllVotes().filter(v => v.pollKey === pollKey);
    const tallies: SlotTally[] = poll.slots.map(s => {
      const vs = votes.filter(v => v.slotId === s.id);
      return {
        slotId: s.id,
        yes: vs.filter(v => v.choice === 'yes').length,
        maybe: vs.filter(v => v.choice === 'maybe').length,
        no: vs.filter(v => v.choice === 'no').length,
      };
    });
    return { poll, tallies };
  }

  private getAllPolls(): Record<string, Poll> {
    try {
      return JSON.parse(localStorage.getItem(this.pollsKey) ?? '{}');
    } catch {
      return {};
    }
  }

  private getAllVotes(): DemoVote[] {
    try {
      return JSON.parse(localStorage.getItem(this.votesKey) ?? '[]');
    } catch {
      return [];
    }
  }
}
