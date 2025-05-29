import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JuegoService } from '../../services/juego.service';
import { SistemaEstelar } from '../../models/sistema-estelar';

@Component({
  selector: 'app-info-sistema',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './info-sistema.component.html',
  styleUrls: ['./info-sistema.component.css']
})
export class InfoSistemaComponent {
  juegoService = inject(JuegoService);
  
  // Obtener el sistema actualmente seleccionado
  get sistemaSeleccionado(): SistemaEstelar | null {
    const estado = this.juegoService.estadoJuego();
    if (estado.selectedSystem !== null) {
      return estado.systems[estado.selectedSystem];
    }
    return null;
  }
  
  // Obtener las naves en el sistema seleccionado
  get navesEnSistema(): any[] {
    const estado = this.juegoService.estadoJuego();
    if (estado.selectedSystem === null) return [];
    
    return estado.ships.filter(nave => nave.location === estado.selectedSystem);
  }
  
  // Acciones en el sistema
  atacarSistema(): void {
    if (this.juegoService.atacarSistema()) {
      console.log('Ataque exitoso');
    } else {
      console.log('No se pudo atacar');
    }
  }
  
  colonizarSistema(): void {
    if (this.juegoService.colonizarSistema()) {
      console.log('Colonización exitosa');
    } else {
      console.log('No se pudo colonizar');
    }
  }
  
  mejorarSistema(): void {
    if (this.juegoService.mejorarSistema()) {
      console.log('Mejora exitosa');
    } else {
      console.log('No se pudo mejorar');
    }
  }
  
  mostrarGestionFlota(): void {
    // Lógica para mostrar modal de gestión de flota
    const modal = document.getElementById('fleet-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }
}
