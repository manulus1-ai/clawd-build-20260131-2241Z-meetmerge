import { Injectable } from '@angular/core';

export interface AppConfig {
  apiBaseUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private cfg: AppConfig = {};

  async load(): Promise<void> {
    try {
      const res = await fetch('assets/config.json', { cache: 'no-store' });
      if (!res.ok) return;
      this.cfg = await res.json();
    } catch {
      // ignore; demo mode
    }
  }

  get apiBaseUrl(): string | undefined {
    const v = (this.cfg.apiBaseUrl ?? '').trim();
    return v.length ? v.replace(/\/$/, '') : undefined;
  }

  get hasBackend(): boolean {
    return !!this.apiBaseUrl;
  }
}
