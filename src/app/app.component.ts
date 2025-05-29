import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JuegoComponent } from './features/juego/juego.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JuegoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'SpaceInvaders2';
}
