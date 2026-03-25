import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  // Redirect to a generic login selector or specific by url
  if (state.url.startsWith('/admin')) return router.parseUrl('/admin/login');
  if (state.url.startsWith('/oferente')) return router.parseUrl('/oferente/login');
  return router.parseUrl('/cliente/login');
};
