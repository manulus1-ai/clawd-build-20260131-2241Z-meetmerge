import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DemoStoreService } from '../lib/demo-store.service';
import { Poll, VoteChoice } from '../lib/models';
import { formatLocalWithTz, fromBase64Url } from '../lib/utils';

@Component({
  selector: 'mm-demo-poll-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
  <main class="shell">
    <a class="back" routerLink="/">← New poll</a>

    <section class="card" *ngIf="poll; else missing">
      <div class="invite">
        <div class="invite-title">{{ poll.title }}</div>
        <div class="invite-sub" *ngIf="poll.description">{{ poll.description }}</div>
        <div class="invite-sub muted">Demo link • votes stay on your device</div>
      </div>

      <div class="slots">
        <div class="slot" *ngFor="let s of poll.slots">
          <div class="slot-main">{{ fmt(s.startIso) }}</div>
          <div class="vote-row" role="group" [attr.aria-label]="'Vote for ' + fmt(s.startIso)">
            <button class="vote yes" (click)="vote(s.id, 'yes')">Yes</button>
            <button class="vote maybe" (click)="vote(s.id, 'maybe')">Maybe</button>
            <button class="vote no" (click)="vote(s.id, 'no')">No</button>
          </div>
        </div>
      </div>

      <details class="details">
        <summary>Results (on this device)</summary>
        <div class="results" *ngIf="pollWithTallies">
          <div class="tally" *ngFor="let t of pollWithTallies.tallies">
            <div class="tally-time">{{ fmt(slotIso(t.slotId)) }}</div>
            <div class="tally-bars" aria-label="Vote tallies">
              <span class="bar yes">Yes {{ t.yes }}</span>
              <span class="bar maybe">Maybe {{ t.maybe }}</span>
              <span class="bar no">No {{ t.no }}</span>
            </div>
          </div>
        </div>
      </details>

      <div class="share">
        <div class="muted">Share link:</div>
        <input class="share-input" [value]="shareUrl" readonly />
      </div>
    </section>

    <ng-template #missing>
      <section class="card">
        <h2>Invalid demo link</h2>
        <p class="muted">This demo link is missing or malformed.</p>
      </section>
    </ng-template>
  </main>
  `,
})
export class DemoPollPage {
  poll?: Poll;
  pollKey = '';
  shareUrl = '';
  pollWithTallies?: { poll: Poll; tallies: any[] };

  constructor(private route: ActivatedRoute, private demo: DemoStoreService) {
    const d = this.route.snapshot.queryParamMap.get('d') ?? '';
    this.pollKey = d;
    this.shareUrl = window.location.href;
    try {
      const payload = fromBase64Url<{ poll: Poll }>(d);
      this.poll = payload.poll;
      this.refreshTallies();
    } catch {
      this.poll = undefined;
    }
  }

  fmt(iso: string): string {
    return formatLocalWithTz(iso);
  }

  slotIso(slotId: string): string {
    return this.poll?.slots.find(s => s.id === slotId)?.startIso ?? '';
  }

  vote(slotId: string, choice: VoteChoice): void {
    if (!this.poll) return;
    this.demo.vote(this.pollKey, slotId, choice);
    this.refreshTallies();
  }

  refreshTallies(): void {
    if (!this.poll) return;
    this.pollWithTallies = this.demo.getPollWithTallies(this.poll, this.pollKey);
  }
}
