import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../lib/api.service';
import { PollWithTallies, VoteChoice } from '../lib/models';
import { formatLocalWithTz } from '../lib/utils';

@Component({
  selector: 'mm-poll-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <main class="shell">
    <a class="back" routerLink="/">← New poll</a>

    <section class="card" *ngIf="data; else loading">
      <div class="invite">
        <div class="invite-title">{{ data.poll.title }}</div>
        <div class="invite-sub" *ngIf="data.poll.description">{{ data.poll.description }}</div>
        <div class="invite-sub muted">Tap to vote. Host can lock a winner.</div>
      </div>

      <div class="locked" *ngIf="data.poll.lockedSlotId">
        <div class="locked-badge">Locked</div>
        <div class="locked-time">{{ fmt(slotIso(data.poll.lockedSlotId)) }}</div>
        <div class="locked-actions">
          <button class="btn" (click)="downloadIcs()">Download .ics</button>
          <a class="btn btn-ghost" [href]="googleCalUrl()" target="_blank" rel="noopener">Add to Google Calendar</a>
        </div>
      </div>

      <div class="slots" [class.slots-disabled]="!!data.poll.lockedSlotId">
        <div class="slot" *ngFor="let s of data.poll.slots">
          <div class="slot-main">{{ fmt(s.startIso) }}</div>
          <div class="vote-row" role="group" [attr.aria-label]="'Vote for ' + fmt(s.startIso)">
            <button class="vote yes" (click)="vote(s.id, 'yes')" [disabled]="!!data.poll.lockedSlotId">Yes</button>
            <button class="vote maybe" (click)="vote(s.id, 'maybe')" [disabled]="!!data.poll.lockedSlotId">Maybe</button>
            <button class="vote no" (click)="vote(s.id, 'no')" [disabled]="!!data.poll.lockedSlotId">No</button>
          </div>

          <div class="host" *ngIf="isHost">
            <div class="tally-line">Yes {{ tally(s.id).yes }} • Maybe {{ tally(s.id).maybe }} • No {{ tally(s.id).no }}</div>
            <button class="btn btn-primary" (click)="lock(s.id)" [disabled]="!!data.poll.lockedSlotId || working">Lock this</button>
          </div>
        </div>
      </div>

      <details class="details" *ngIf="isHost">
        <summary>Share</summary>
        <div class="share">
          <div class="muted">Guest link:</div>
          <input class="share-input" [value]="guestUrl" readonly />
          <div class="muted" style="margin-top:8px;">Host link (keep private):</div>
          <input class="share-input" [value]="hostUrl" readonly />
        </div>
      </details>

      <div class="error" *ngIf="error">{{ error }}</div>
    </section>

    <ng-template #loading>
      <section class="card">
        <div class="muted">Loading poll…</div>
      </section>
    </ng-template>
  </main>
  `,
})
export class PollPage {
  data?: PollWithTallies;
  error = '';
  working = false;
  pollId = '';
  hostKey?: string;

  guestUrl = '';
  hostUrl = '';

  constructor(private route: ActivatedRoute, private api: ApiService) {
    this.pollId = this.route.snapshot.paramMap.get('id') ?? '';
    this.hostKey = this.route.snapshot.queryParamMap.get('hostKey') ?? undefined;
    this.guestUrl = `${window.location.origin}${window.location.pathname}#/p/${this.pollId}`;
    this.hostUrl = this.hostKey
      ? `${window.location.origin}${window.location.pathname}#/p/${this.pollId}?hostKey=${encodeURIComponent(this.hostKey)}`
      : '';

    this.refresh();
    // basic polling so host sees votes arriving
    setInterval(() => this.refresh(true), 4000);
  }

  get isHost(): boolean {
    return !!this.hostKey;
  }

  fmt(iso: string): string {
    return formatLocalWithTz(iso);
  }

  slotIso(slotId: string): string {
    return this.data?.poll.slots.find(s => s.id === slotId)?.startIso ?? '';
  }

  tally(slotId: string) {
    return this.data?.tallies.find(t => t.slotId === slotId) ?? { yes: 0, maybe: 0, no: 0 };
  }

  async refresh(silent = false): Promise<void> {
    try {
      const d = await this.api.getPoll(this.pollId, this.hostKey);
      this.data = d;
      if (!silent) this.error = '';
    } catch (e: any) {
      this.error = e?.message ?? 'Failed to load.';
    }
  }

  async vote(slotId: string, choice: VoteChoice): Promise<void> {
    this.working = true;
    try {
      await this.api.vote(this.pollId, slotId, choice);
      await this.refresh(true);
    } catch (e: any) {
      this.error = e?.message ?? 'Vote failed.';
    } finally {
      this.working = false;
    }
  }

  async lock(slotId: string): Promise<void> {
    if (!this.hostKey) return;
    this.working = true;
    try {
      await this.api.lock(this.pollId, slotId, this.hostKey);
      await this.refresh(true);
    } catch (e: any) {
      this.error = e?.message ?? 'Lock failed.';
    } finally {
      this.working = false;
    }
  }

  downloadIcs(): void {
    if (!this.data?.poll.lockedSlotId) return;
    const iso = this.slotIso(this.data.poll.lockedSlotId);
    const start = new Date(iso);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const dt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const uid = `${this.data.poll.id}@meetmerge`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//MeetMerge//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dt(new Date())}`,
      `DTSTART:${dt(start)}`,
      `DTEND:${dt(end)}`,
      `SUMMARY:${escapeText(this.data.poll.title)}`,
      this.data.poll.description ? `DESCRIPTION:${escapeText(this.data.poll.description)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.data.poll.title || 'meetmerge'}.ics`;
    a.click();
  }

  googleCalUrl(): string {
    if (!this.data?.poll.lockedSlotId) return '#';
    const iso = this.slotIso(this.data.poll.lockedSlotId);
    const start = new Date(iso);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const text = encodeURIComponent(this.data.poll.title);
    const details = encodeURIComponent(this.data.poll.description ?? '');
    const dates = `${fmt(start)}/${fmt(end)}`;
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&dates=${dates}`;
  }
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}
