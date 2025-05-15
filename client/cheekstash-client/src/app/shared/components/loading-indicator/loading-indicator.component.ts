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

    get textDynamicClasses(): { [key: string]: boolean } {
        const classes: { [key: string]: boolean } = {};
        // Apply base text color class regardless of style
        if (this.textColorClass && this.textColorClass.trim() !== '') {
            classes[this.textColorClass.trim()] = true;
        }

        if (this.fullPageStyle) {
            classes['text-xl'] = true;
            classes['mt-4'] = true;
            classes['text-center'] = true; 
        } else {
            // For inline style, add left margin to space text from spinner
            classes['ml-2'] = true;
        }
        return classes;
    }
}
