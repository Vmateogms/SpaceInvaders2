import { Component, inject } from '@angular/core';

@Component({
  selector: 'app-recursos',
  imports: [],
  templateUrl: './recursos.component.html',
  styleUrl: './recursos.component.css'
})
export class RecursosComponent {
 private gameService = inject(GameService);
  
  get resources() {
    return this.gameService.state.resources;
  }
}
