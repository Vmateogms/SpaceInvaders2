import { Component, inject } from '@angular/core';

@Component({
  selector: 'app-panel-control',
  imports: [],
  templateUrl: './panel-control.component.html',
  styleUrl: './panel-control.component.css'
})
export class PanelControlComponent {
private gameService = inject(GameService);
  
  get resources() {
    return this.gameService.state().resources;
  }
  
  get shipTypes() {
    return Object.values(ShipType);
  }
  
  buildShip(shipType: ShipType) {
    this.gameService.buildShip(shipType);
  }
  
  canAffordShip(shipType: ShipType): boolean {
    const shipCost = this.gameService.getShipCost(shipType);
    
    return (
      this.resources.credits >= shipCost.credits &&
      this.resources.materials >= shipCost.materials &&
      this.resources.energy >= shipCost.energy
    );
  }
  
  getShipCost(shipType: ShipType) {
    return this.gameService.getShipCost(shipType);
  }
}
