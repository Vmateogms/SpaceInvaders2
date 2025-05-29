import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JuegoService } from '../../services/juego.service';
import { GalaxiaComponent } from '../galaxia/galaxia.component';
import { InfoSistemaComponent } from '../info-sistema/info-sistema.component';

@Component({
  selector: 'app-juego',
  standalone: true,
  imports: [
    CommonModule,
    GalaxiaComponent,
    InfoSistemaComponent
  ],
  templateUrl: './juego.component.html',
  styleUrls: ['./juego.component.css'] // Corregido styleUrl a styleUrls
})
export class JuegoComponent implements OnInit {
  juegoService = inject(JuegoService);
  controlPanelVisible = false; // Propiedad para controlar la visibilidad del panel
  
  ngOnInit(): void {
    // El juego ya se inicializa en el constructor del servicio
  }

  // Métodos del componente para interactuar con el servicio
  construirNave(tipo: string): void {
    if (!this.juegoService.construirNave(tipo)) {
      console.log('No se pudo construir la nave');
    }
  }

  siguienteTurno(): void {
    this.juegoService.siguienteTurno();
  }

  construirMultiples(tipo: string, cantidad: number): void {
    let construidas = 0;
    for (let i = 0; i < cantidad; i++) {
      if (this.juegoService.construirNave(tipo)) {
        construidas++;
      } else {
        break;
      }
    }

    if (construidas > 0) {
      this.juegoService.agregarLog(`🚀 ${construidas} ${tipo}(s) construidos!`);
    }
  }

  cambiarTab(tab: string): void {
    // Lógica para cambiar de pestaña
    console.log('Cambiando a tab:', tab);
  }

  // Gestión de autoplay
  toggleAutoPlay(): void {
    const estado = this.juegoService.estadoJuego();
    estado.autoPlay = !estado.autoPlay;
    this.juegoService.estadoJuego.set({...estado});

    if (estado.autoPlay) {
      this.juegoService.agregarLog('🤖 Auto-juego activado');
      this.iniciarAutoPlay();
    } else {
      this.juegoService.agregarLog('🤖 Auto-juego desactivado');
    }
  }

  // Métodos para estaciones
  construirEstacion(tipo: string): void {
    console.log('Construyendo estación:', tipo);
    // Implementación pendiente
  }

  // Métodos para héroes
  reclutarHeroe(tipo: string): void {
    console.log('Reclutando héroe:', tipo);
    // Implementación pendiente
  }
  
  // Manejo del panel de control desplegable
  toggleControlPanel(): void {
    this.controlPanelVisible = !this.controlPanelVisible;
  }

  // Métodos para modales
  mostrarEstadisticas(): void {
    console.log('Mostrando estadísticas');
    // Implementación pendiente
  }

  cerrarModal(): void {
    const modal = document.getElementById('fleet-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  contarSistemasJugador(): number {
    const sistemas = this.juegoService.estadoJuego().systems;
    return sistemas.filter(s => s.owner === 'player').length;
  }

  private iniciarAutoPlay(): void {
    const estado = this.juegoService.estadoJuego();
    if (!estado.autoPlay) return;

    setTimeout(() => {
      if (this.juegoService.estadoJuego().autoPlay) {
        // Construir naves si hay recursos
        if (Math.random() < 0.3) {
          this.construirNave('scout');
        }
        
        // Investigar ocasionalmente
        if (Math.random() < 0.2 && this.juegoService.estadoJuego().resources.crystals >= 30) {
          const techs = ['propulsion', 'weapons', 'shields'];
          this.juegoService.investigar(techs[Math.floor(Math.random() * techs.length)]);
        }
        
        // Siguiente turno
        if (Math.random() < 0.6) {
          this.siguienteTurno();
        }
        
        this.iniciarAutoPlay(); // Continuar ciclo
      }
    }, 1500);
  }
}
