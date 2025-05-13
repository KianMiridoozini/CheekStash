import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../auth.service';
import { CheeksService } from '../../cheeks/cheeks.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { User } from '../../models/user.model';

export const cheekOwnerGuard: CanActivateFn = (
    route: ActivatedRouteSnapshot,
): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree => {
    const authService = inject(AuthService);
    const cheeksService = inject(CheeksService);
    const router = inject(Router);
    
    const currentUser = authService.currentUserSignal(); 
    if (!currentUser || !currentUser.id) {
        return router.createUrlTree(['/login']);
    }
    const routeUsername = route.paramMap.get('username');
    const cheekSlug = route.paramMap.get('cheekSlug');
    
    if (!routeUsername || !cheekSlug) {
        return router.createUrlTree(['/cheeks']);
    }
    
    const detailPageRoute = router.createUrlTree(['/cheeks', routeUsername, cheekSlug]);
    

    return cheeksService.getCheekByUsernameAndSlug(routeUsername, cheekSlug).pipe(
        map(cheek => {
            if (cheek && cheek.owner) {
                const owner = cheek.owner;
                const ownerId = typeof owner === 'string' ? owner : ((owner as User)?.id || (owner as any)?._id);
                if (ownerId && currentUser.id === ownerId) {
                    return true; 
                }
            }
            return detailPageRoute;
        }),
        catchError(err => {
            console.error('Error in CheekOwnerGuard:', err);
            return of(detailPageRoute);
        })
    );
};