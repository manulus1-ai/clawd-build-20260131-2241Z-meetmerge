import { Routes } from '@angular/router';
import { HomePage } from './pages/home.page';
import { PollPage } from './pages/poll.page';
import { DemoPollPage } from './pages/demo-poll.page';

export const routes: Routes = [
  { path: '', component: HomePage },
  { path: 'p/:id', component: PollPage },
  { path: 'd', component: DemoPollPage },
  { path: '**', redirectTo: '' },
];
