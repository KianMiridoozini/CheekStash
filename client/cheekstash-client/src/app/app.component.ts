import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SharedModule } from './shared/shared.module';

@Component({
  selector: 'app-root',
  standalone: true,  // mark it as standalone if not already done
  imports: [RouterOutlet, SharedModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']  // note: should be plural 'styleUrls'
})
export class AppComponent {
  title = 'cheekstash-client';
}
