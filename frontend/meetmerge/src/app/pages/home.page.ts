import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfigService } from '../lib/config.service';
import { ApiService } from '../lib/api.service';
import { DemoStoreService } from '../lib/demo-store.service';
import { Poll } from '../lib/models';
import { toBase64Url, uid } from '../lib/utils';

type TemplateKey = 'dinner' | 'workout' | 'boardgames' | 'custom';

@Component({
  selector: 'mm-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
  <main class="shell">
    <header class="top">
      <div class="brand">
        <div class="logo" aria-hidden="true">MM</div>
        <div>
          <div class="title">MeetMerge</div>
          <div class="tagline">Stop the “when are you free?” spiral.</div>
        </div>
      </div>
      <div class="pill" [class.pill-warn]="!cfg.hasBackend">
        {{ cfg.hasBackend ? 'Live mode' : 'Demo mode (no server)' }}
      </div>
    </header>

    <section class="card">
      <h1>Create a voting link</h1>
      <p class="muted">Pick 3–7 candidate times. Guests tap <b>Yes / Maybe / No</b>. You lock a winner.</p>

      <label class="field">
        <span>Template</span>
        <select [(ngModel)]="template" (ngModelChange)="applyTemplate()">
          <option value="dinner">Dinner</option>
          <option value="workout">Workout</option>
          <option value="boardgames">Board games</option>
          <option value="custom">Custom</option>
        </select>
      </label>

      <label class="field">
        <span>Title</span>
        <input [(ngModel)]="title" placeholder="e.g., Friday dinner" />
      </label>

      <label class="field">
        <span>Optional note</span>
        <input [(ngModel)]="description" placeholder="e.g., 90 minutes, near downtown" />
      </label>

      <div class="row">
        <label class="field">
          <span>Date</span>
          <input type="date" [(ngModel)]="date" />
        </label>
        <label class="field">
          <span>Time</span>
          <input type="time" [(ngModel)]="time" />
        </label>
        <button class="btn" (click)="addSlot()" [disabled]="!date || !time">Add slot</button>
      </div>

      <div class="slots">
        <div class="slot" *ngFor="let s of slots; let i = index">
          <div>
            <div class="slot-main">{{ s }}</div>
          </div>
          <button class="btn btn-ghost" (click)="removeSlot(i)" aria-label="Remove slot">Remove</button>
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-primary" (click)="create()" [disabled]="slots.length < 3 || slots.length > 7 || saving">
          {{ saving ? 'Creating…' : 'Create link' }}
        </button>
        <div class="muted" *ngIf="slots.length < 3">Add at least 3 slots.</div>
        <div class="muted" *ngIf="slots.length > 7">Keep it to 7 slots max (faster consensus).</div>
      </div>

      <details class="details">
        <summary>About demo mode</summary>
        <p>Without a backend, the link contains the poll definition. Votes are stored per-device (so it’s great for trying the UX, but not true multi-user aggregation).</p>
      </details>
    </section>

    <section class="footer">
      <div class="muted">Share moment: the link itself. Results are screenshot-worthy.</div>
    </section>
  </main>
  `,
})
export class HomePage {
  template: TemplateKey = 'dinner';
  title = 'Dinner';
  description = '';
  date = '';
  time = '19:00';
  slots: string[] = [];
  saving = false;

  constructor(
    public cfg: ConfigService,
    private api: ApiService,
    private demo: DemoStoreService,
    private router: Router,
  ) {
    this.applyTemplate();
  }

  applyTemplate(): void {
    if (this.template === 'dinner') {
      this.title = 'Dinner';
      this.time = '19:00';
    } else if (this.template === 'workout') {
      this.title = 'Workout';
      this.time = '07:30';
    } else if (this.template === 'boardgames') {
      this.title = 'Board games';
      this.time = '20:00';
    }
    if (this.slots.length === 0) {
      // seed 3 slots for today
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      this.date = `${yyyy}-${mm}-${dd}`;
      this.slots = [];
      this.addSlot();
      this.time = this.bumpTime(this.time, 30);
      this.addSlot();
      this.time = this.bumpTime(this.time, 30);
      this.addSlot();
    }
  }

  bumpTime(hhmm: string, mins: number): string {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    d.setMinutes(d.getMinutes() + mins);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  addSlot(): void {
    if (!this.date || !this.time) return;
    const dt = new Date(`${this.date}T${this.time}:00`);
    const iso = dt.toISOString();
    const display = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(dt);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const label = `${display} (${tz}) — ${iso}`;
    if (!this.slots.includes(label)) this.slots.push(label);
  }

  removeSlot(i: number): void {
    this.slots.splice(i, 1);
  }

  async create(): Promise<void> {
    if (this.slots.length < 3 || this.slots.length > 7) return;
    this.saving = true;
    try {
      const slotIsos = this.slots.map(s => s.split(' — ').slice(-1)[0]);

      if (this.cfg.hasBackend) {
        const resp = await this.api.createPoll({
          title: this.title.trim(),
          description: this.description.trim() || undefined,
          slots: slotIsos.map(startIso => ({ startIso })),
        });
        await this.router.navigate(['/p', resp.pollId], { queryParams: { hostKey: resp.hostKey } });
        return;
      }

      const pollId = uid('demo');
      const poll: Poll = {
        id: pollId,
        title: this.title.trim(),
        description: this.description.trim() || undefined,
        createdAtIso: new Date().toISOString(),
        slots: slotIsos.map(startIso => ({ id: uid('s'), startIso })),
      };
      this.demo.savePoll(poll);
      const payload = { poll };
      const d = toBase64Url(payload);
      await this.router.navigate(['/d'], { queryParams: { d } });
    } finally {
      this.saving = false;
    }
  }
}
