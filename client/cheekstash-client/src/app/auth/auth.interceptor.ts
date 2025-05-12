import { Injectable } from '@angular/core';
import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service'; 

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(private authService: AuthService) {
        // console.log('AuthInterceptor constructed');
    }

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
        // console.log('AuthInterceptor: Intercepting request to:', request.url);
        const authToken = this.authService.getToken();
        // console.log('AuthInterceptor: Token from AuthService:', authToken);

        // If a token exists, clone the request to add the new header.
        if (authToken) {
            // console.log('AuthInterceptor: Token found, cloning request and adding Authorization header.');
            const authReq = request.clone({
                headers: request.headers.set('Authorization', `Bearer ${authToken}`)
            });
            // Log the headers of the cloned request to be sure
            // console.log('AuthInterceptor: Headers on cloned request:', authReq.headers.keys());
            if (authReq.headers.has('Authorization')) {
                // console.log('AuthInterceptor: Authorization header value on cloned request:', authReq.headers.get('Authorization'));
            }
            return next.handle(authReq);
        }

        // console.log('AuthInterceptor: No token found, passing original request.');
        // If no token, pass the original request along.
        return next.handle(request);
    }
}
