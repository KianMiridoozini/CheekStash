import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-message',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './message.component.html',
    styleUrls: ['./message.component.css']
})
export class MessageComponent {
    @Input() message: string | null = null;
    @Input() type: 'success' | 'error' | 'info' | 'warning' = 'info';

    get alertClass(): string {
        switch (this.type) {
            case 'success':
                return 'alert-success';
            case 'error':
                return 'alert-error';
            case 'warning':
                return 'alert-warning';
            case 'info':
            default:
                return 'alert-info';
        }
    }
}
