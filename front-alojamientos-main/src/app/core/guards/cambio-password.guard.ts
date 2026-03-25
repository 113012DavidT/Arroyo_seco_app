import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const cambioPasswordGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const requiereCambio = auth.requiereCambioPassword();
  
  // Si el usuario requiere cambio de contraseña y NO está en la ruta de cambio
  if (requiereCambio && state.url !== '/cambiar-password') {
    router.navigate(['/cambiar-password']);
    return false;
  }

  return true;
};
