// home.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  welcomeMessage = '';

  ngOnInit(): void {
    const username = localStorage.getItem('username');
    if (username) {
      this.welcomeMessage = `Welcome, ${username}!`;
    } else {
      this.welcomeMessage = 'Welcome!';
    }
  }
}