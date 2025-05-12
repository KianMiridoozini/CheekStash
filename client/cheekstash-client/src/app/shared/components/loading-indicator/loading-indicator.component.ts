import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-loading-indicator',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './loading-indicator.component.html',
    styleUrls: ['./loading-indicator.component.css']
})
export class LoadingIndicatorComponent {
    @Input() message: string | null = 'Loading...';
    @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md';
    @Input() fullPageStyle: boolean = false; 
    @Input() textColorClass: string = 'text-base-content/70';

    get spinnerSizeClass(): string {
        return `loading-${this.size}`;
    }
}
