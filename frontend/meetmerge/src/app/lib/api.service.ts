import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { Poll, PollWithTallies, VoteChoice } from './models';

export interface CreatePollRequest {
  title: string;
  description?: string;
  slots: { startIso: string }[];
}

export interface CreatePollResponse {
  pollId: string;
  hostKey: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private cfg: ConfigService) {}

  async createPoll(req: CreatePollRequest): Promise<CreatePollResponse> {
    const base = this.mustBase();
    const res = await fetch(`${base}/api/polls`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new Error(`Create failed (${res.status})`);
    return res.json();
  }

  async getPoll(pollId: string, hostKey?: string): Promise<PollWithTallies> {
    const base = this.mustBase();
    const url = new URL(`${base}/api/polls/${encodeURIComponent(pollId)}`);
    if (hostKey) url.searchParams.set('hostKey', hostKey);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Load failed (${res.status})`);
    return res.json();
  }

  async vote(pollId: string, slotId: string, choice: VoteChoice): Promise<void> {
    const base = this.mustBase();
    const res = await fetch(`${base}/api/polls/${encodeURIComponent(pollId)}/votes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slotId, choice }),
    });
    if (!res.ok) throw new Error(`Vote failed (${res.status})`);
  }

  async lock(pollId: string, slotId: string, hostKey: string): Promise<void> {
    const base = this.mustBase();
    const res = await fetch(`${base}/api/polls/${encodeURIComponent(pollId)}/lock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slotId, hostKey }),
    });
    if (!res.ok) throw new Error(`Lock failed (${res.status})`);
  }

  private mustBase(): string {
    const b = this.cfg.apiBaseUrl;
    if (!b) throw new Error('Backend not configured (demo mode).');
    return b;
  }
}
