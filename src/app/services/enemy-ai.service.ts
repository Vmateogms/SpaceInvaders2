import { Injectable } from '@angular/core';
import { JuegoService } from './juego.service';
import { Observable, interval } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { NaveAtaque } from '../models/nave-ataque';
import { SistemaEstelar } from '../models/sistema-estelar';

// Interfaz para enemigos
export interface EnemigoNave {
  id: string;
  tipo: 'pirata' | 'defensor';
  posX: number;
  posY: number;
  hp: number;
  maxHp: number;
  velocidad: number;
  rango: number;
  dano: number;
  objetivo?: {
    posX: number;
    posY: number;
    id?: number; // Cambiado a number para compatibilidad con NaveAtaque
  };
  estado: 'patrullando' | 'persiguiendo' | 'atacando' | 'regresando';
  baseX?: number; // Para los defensores, centro de órbita
  baseY?: number; // Para los defensores, centro de órbita
  direccion: number; // Ángulo de movimiento para piratas
  orbitaAngulo?: number; // Para defensores orbitando planetas
  radioOrbita?: number; // Radio de la órbita para defensores
  ultimoAtaque: number; // Timestamp del último ataque
}

@Injectable({
  providedIn: 'root'
})
export class EnemyAiService {
  private _enemigos: EnemigoNave[] = [];
  private tick$: Observable<number>;
  
  // Constantes para configuración de la IA
  private readonly MAX_PIRATAS = 15;
  private readonly MAX_DEFENSORES_POR_PLANETA = 3;
  private readonly RANGO_DETECCION_BASE = 200;
  private readonly VELOCIDAD_BASE_PIRATA = 0.5;
  private readonly VELOCIDAD_BASE_DEFENSOR = 0.3;
  private readonly INTERVALO_CAMBIO_DIRECCION = 5000; // ms
  private readonly PROBABILIDAD_CAMBIO_DIRECCION = 0.1;
  private readonly RADIO_ORBITA_MIN = 80;
  private readonly RADIO_ORBITA_MAX = 120;
  private readonly VELOCIDAD_ORBITA = 0.001;
  private readonly INTERVALO_TICK = 50; // ms
  private readonly TIEMPO_ENTRE_ATAQUES = 2000; // ms
  
  constructor(private juegoService: JuegoService) {
    // Observable para actualización de movimiento y comportamiento
    this.tick$ = interval(this.INTERVALO_TICK).pipe(
      shareReplay(1)
    );
    
    // Iniciar el sistema de IA
    this.iniciarSistemaIA();
  }
  
  // Obtener la lista de enemigos para renderizado
  getEnemigos(): EnemigoNave[] {
    return this._enemigos;
  }
  
  // Iniciar todo el sistema de IA
  private iniciarSistemaIA(): void {
    // Generar enemigos iniciales
    this.generarPiratas();
    this.generarDefensores();
    
    // Suscribirse al tick para actualizar la IA
    this.tick$.subscribe(() => {
      this.actualizarIA();
    });
    
    // Regenerar piratas periódicamente
    interval(10000).subscribe(() => {
      if (this._enemigos.filter(e => e.tipo === 'pirata').length < this.MAX_PIRATAS) {
        this.generarPiratas(1);
      }
    });
  }
  
  // Generar piratas que se mueven aleatoriamente
  private generarPiratas(cantidad: number = this.MAX_PIRATAS): void {
    const mapSize = this.juegoService.getMapSize();
    
    for (let i = 0; i < cantidad; i++) {
      const id = 'pirata-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
      
      const enemigo: EnemigoNave = {
        id,
        tipo: 'pirata',
        posX: Math.random() * mapSize.width,
        posY: Math.random() * mapSize.height,
        hp: 50 + Math.floor(Math.random() * 50),
        maxHp: 100,
        velocidad: this.VELOCIDAD_BASE_PIRATA + (Math.random() * 0.2),
        rango: this.RANGO_DETECCION_BASE + (Math.random() * 50),
        dano: 5 + Math.floor(Math.random() * 10),
        estado: 'patrullando',
        direccion: Math.random() * Math.PI * 2,
        ultimoAtaque: 0
      };
      
      this._enemigos.push(enemigo);
    }
  }
  
  // Generar defensores orbitando planetas enemigos
  private generarDefensores(): void {
    const sistemasEnemigos = this.juegoService.estadoJuego().systems.filter(
      sistema => sistema.owner === 'enemy'
    );
    
    sistemasEnemigos.forEach(sistema => {
      const defensoresPorPlaneta = Math.ceil(Math.random() * this.MAX_DEFENSORES_POR_PLANETA);
      
      for (let i = 0; i < defensoresPorPlaneta; i++) {
        const id = 'defensor-' + sistema.id + '-' + i;
        const radioOrbita = this.RADIO_ORBITA_MIN + (Math.random() * (this.RADIO_ORBITA_MAX - this.RADIO_ORBITA_MIN));
        const anguloInicial = Math.random() * Math.PI * 2;
        
        // Usar x, y en lugar de posX, posY para el sistema
        const enemigo: EnemigoNave = {
          id,
          tipo: 'defensor',
          posX: sistema.x + Math.cos(anguloInicial) * radioOrbita,
          posY: sistema.y + Math.sin(anguloInicial) * radioOrbita,
          hp: 80 + Math.floor(Math.random() * 40),
          maxHp: 120,
          velocidad: this.VELOCIDAD_BASE_DEFENSOR,
          rango: this.RANGO_DETECCION_BASE * 1.5,
          dano: 8 + Math.floor(Math.random() * 7),
          estado: 'patrullando',
          baseX: sistema.x,
          baseY: sistema.y,
          orbitaAngulo: anguloInicial,
          radioOrbita: radioOrbita,
          direccion: 0, // No se usa para defensores
          ultimoAtaque: 0
        };
        
        this._enemigos.push(enemigo);
      }
    });
  }
  
  // Actualizar la IA en cada tick
  private actualizarIA(): void {
    const ahora = Date.now();
    const navesJugador = this.juegoService.getNavesJugador();
    
    // Actualizar cada enemigo
    this._enemigos.forEach(enemigo => {
      // 1. Verificar si hay naves del jugador cerca
      const navesCercanas = this.detectarNavesCercanas(enemigo, navesJugador);
      
      // 2. Decidir estado según proximidad
      if (navesCercanas.length > 0 && enemigo.estado !== 'atacando') {
        // Hay naves cercanas, perseguir la más cercana
        const naveMasCercana = navesCercanas[0];
        
        // Obtener el sistema donde está la nave
        const sistema = this.juegoService.estadoJuego().systems.find(s => s.id === naveMasCercana.location);
        if (!sistema) return;
        
        enemigo.objetivo = {
          posX: sistema.x,
          posY: sistema.y,
          id: naveMasCercana.id
        };
        enemigo.estado = 'persiguiendo';
        
        // Si está en rango de ataque
        const distancia = this.calcularDistancia(
          enemigo.posX, enemigo.posY, 
          sistema.x, sistema.y
        );
        
        if (distancia < enemigo.rango * 0.5) {
          enemigo.estado = 'atacando';
          
          // Atacar si ha pasado suficiente tiempo desde el último ataque
          if (ahora - enemigo.ultimoAtaque > this.TIEMPO_ENTRE_ATAQUES) {
            this.atacar(enemigo, naveMasCercana);
            enemigo.ultimoAtaque = ahora;
          }
        }
      } else if (enemigo.estado === 'atacando') {
        // Verificar si el objetivo sigue existiendo y en rango
        const objetivoExiste = navesJugador.some(nave => nave.id === enemigo.objetivo?.id);
        
        if (!objetivoExiste) {
          enemigo.estado = enemigo.tipo === 'defensor' ? 'regresando' : 'patrullando';
          enemigo.objetivo = undefined;
        } else {
          // El objetivo existe, actualizar su posición
          const objetivo = navesJugador.find(nave => nave.id === enemigo.objetivo?.id);
          if (objetivo) {
            // Obtener el sistema donde está la nave objetivo
            const sistema = this.juegoService.estadoJuego().systems.find(s => s.id === objetivo.location);
            if (!sistema) return;
            
            enemigo.objetivo = {
              posX: sistema.x,
              posY: sistema.y,
              id: objetivo.id
            };
            
            // Verificar si sigue en rango de ataque
            const distancia = this.calcularDistancia(
              enemigo.posX, enemigo.posY, 
              sistema.x, sistema.y
            );
            
            if (distancia < enemigo.rango * 0.5) {
              // Atacar si ha pasado suficiente tiempo
              if (ahora - enemigo.ultimoAtaque > this.TIEMPO_ENTRE_ATAQUES) {
                this.atacar(enemigo, objetivo);
                enemigo.ultimoAtaque = ahora;
              }
            } else {
              // Fuera de rango, perseguir
              enemigo.estado = 'persiguiendo';
            }
          }
        }
      }
      
      // 3. Mover según el estado actual
      switch (enemigo.estado) {
        case 'patrullando':
          this.moverPatrullando(enemigo, ahora);
          break;
        case 'persiguiendo':
          this.moverPersiguiendo(enemigo);
          break;
        case 'regresando':
          this.moverRegresando(enemigo);
          break;
        // Cuando está atacando, no se mueve
      }
    });
  }
  
  // Mover enemigo en modo patrulla
  private moverPatrullando(enemigo: EnemigoNave, ahora: number): void {
    if (enemigo.tipo === 'pirata') {
      // Movimiento aleatorio para piratas
      // Cambiar dirección ocasionalmente
      if (Math.random() < this.PROBABILIDAD_CAMBIO_DIRECCION) {
        enemigo.direccion = Math.random() * Math.PI * 2;
      }
      
      // Rebote en los bordes del mapa
      const mapSize = this.juegoService.getMapSize();
      const margen = 50;
      
      if (enemigo.posX < margen || enemigo.posX > mapSize.width - margen ||
          enemigo.posY < margen || enemigo.posY > mapSize.height - margen) {
        // Invertir dirección hacia el centro del mapa
        const centroX = mapSize.width / 2;
        const centroY = mapSize.height / 2;
        
        enemigo.direccion = Math.atan2(centroY - enemigo.posY, centroX - enemigo.posX);
      }
      
      // Mover en la dirección actual
      enemigo.posX += Math.cos(enemigo.direccion) * enemigo.velocidad;
      enemigo.posY += Math.sin(enemigo.direccion) * enemigo.velocidad;
    } else {
      // Movimiento orbital para defensores
      if (enemigo.baseX !== undefined && enemigo.baseY !== undefined && enemigo.orbitaAngulo !== undefined) {
        // Actualizar ángulo orbital - velocidad constante
        enemigo.orbitaAngulo += this.VELOCIDAD_ORBITA;
        
        // Usar un radio orbital fijo para cada defensor
        if (!enemigo.radioOrbita) {
          // Si no tiene radio asignado, asignar uno fijo
          enemigo.radioOrbita = this.RADIO_ORBITA_MIN + 
            ((enemigo.id.charCodeAt(enemigo.id.length - 1) % 10) / 10) * 
            (this.RADIO_ORBITA_MAX - this.RADIO_ORBITA_MIN);
        }
        
        // Actualizar posición orbital con radio fijo
        enemigo.posX = enemigo.baseX + Math.cos(enemigo.orbitaAngulo) * enemigo.radioOrbita;
        enemigo.posY = enemigo.baseY + Math.sin(enemigo.orbitaAngulo) * enemigo.radioOrbita;
      }
    }
  }
  
  // Mover enemigo persiguiendo objetivo
  private moverPersiguiendo(enemigo: EnemigoNave): void {
    if (enemigo.objetivo) {
      // Calcular dirección hacia el objetivo
      const direccion = Math.atan2(
        enemigo.objetivo.posY - enemigo.posY,
        enemigo.objetivo.posX - enemigo.posX
      );
      
      // Actualizar dirección
      enemigo.direccion = direccion;
      
      // Mover hacia el objetivo
      enemigo.posX += Math.cos(direccion) * enemigo.velocidad;
      enemigo.posY += Math.sin(direccion) * enemigo.velocidad;
      
      // Verificar si llegó al objetivo
      const distancia = this.calcularDistancia(
        enemigo.posX, enemigo.posY,
        enemigo.objetivo.posX, enemigo.objetivo.posY
      );
      
      if (distancia < enemigo.rango * 0.5) {
        enemigo.estado = 'atacando';
      }
    }
  }
  
  // Mover enemigo regresando a su base
  private moverRegresando(enemigo: EnemigoNave): void {
    if (enemigo.tipo === 'defensor' && enemigo.baseX !== undefined && enemigo.baseY !== undefined) {
      // Calcular dirección hacia la base
      const direccion = Math.atan2(
        enemigo.baseY - enemigo.posY,
        enemigo.baseX - enemigo.posX
      );
      
      // Mover hacia la base
      enemigo.posX += Math.cos(direccion) * enemigo.velocidad;
      enemigo.posY += Math.sin(direccion) * enemigo.velocidad;
      
      // Verificar si llegó a la base
      const distancia = this.calcularDistancia(
        enemigo.posX, enemigo.posY,
        enemigo.baseX, enemigo.baseY
      );
      
      if (distancia < this.RADIO_ORBITA_MIN) {
        enemigo.estado = 'patrullando';
        
        // Reiniciar órbita
        if (enemigo.orbitaAngulo === undefined) {
          enemigo.orbitaAngulo = Math.random() * Math.PI * 2;
        }
      }
    } else {
      // Lógica para piratas regresando a su zona de patrulla
      // Simplemente volvemos a patrullar cuando están lejos del objetivo
      enemigo.estado = 'patrullando';
    }
  }
  
  // Detectar naves del jugador cercanas
  private detectarNavesCercanas(enemigo: EnemigoNave, navesJugador: NaveAtaque[]): NaveAtaque[] {
    // Necesitamos calcular la posición de las naves del jugador en base a su sistema actual
    return navesJugador
      .filter(nave => {
        // Obtenemos el sistema donde está la nave
        const sistema = this.juegoService.estadoJuego().systems.find(s => s.id === nave.location);
        if (!sistema) return false;
        
        const distancia = this.calcularDistancia(
          enemigo.posX, enemigo.posY,
          sistema.x, sistema.y
        );
        return distancia < enemigo.rango;
      })
      .sort((a, b) => {
        const sistemaA = this.juegoService.estadoJuego().systems.find(s => s.id === a.location);
        const sistemaB = this.juegoService.estadoJuego().systems.find(s => s.id === b.location);
        
        if (!sistemaA || !sistemaB) return 0;
        
        const distanciaA = this.calcularDistancia(
          enemigo.posX, enemigo.posY,
          sistemaA.x, sistemaA.y
        );
        const distanciaB = this.calcularDistancia(
          enemigo.posX, enemigo.posY,
          sistemaB.x, sistemaB.y
        );
        return distanciaA - distanciaB;
      });
  }
  
  // Atacar una nave
  private atacar(enemigo: EnemigoNave, objetivo: NaveAtaque): void {
    // Implementar lógica de ataque (daño, animación, etc.)
    console.log(`Enemigo ${enemigo.id} atacando a nave ${objetivo.id}`);
    
    // Obtener la posición del sistema donde está la nave
    const sistema = this.juegoService.estadoJuego().systems.find(s => s.id === objetivo.location);
    if (!sistema) return;
    
    // Crear evento de batalla
    this.juegoService.crearConflicto({
      atacantes: [{ id: enemigo.id, tipo: enemigo.tipo, hp: enemigo.hp }],
      defensores: [{ id: objetivo.id.toString(), tipo: objetivo.type || 'nave', hp: objetivo.hp }],
      posX: sistema.x,
      posY: sistema.y
    });
    
    // Aplicar daño
    this.juegoService.dañarNave(objetivo.id.toString(), enemigo.dano);
  }
  
  // Calcular distancia entre dos puntos
  private calcularDistancia(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  }
  
  // Método para llamar desde el componente para dibujar enemigos
  public dibujarEnemigos(ctx: CanvasRenderingContext2D): void {
    this._enemigos.forEach(enemigo => {
      // Color según tipo
      const color = enemigo.tipo === 'pirata' ? '#ff4444' : '#ff0000';
      
      // Radio según tipo
      const radio = enemigo.tipo === 'pirata' ? 8 : 10;
      
      // Dibujar cuerpo del enemigo
      ctx.beginPath();
      ctx.arc(enemigo.posX, enemigo.posY, radio, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Dibujar borde
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Dibujar indicador de estado
      let estadoColor = '#ffffff';
      switch (enemigo.estado) {
        case 'persiguiendo': estadoColor = '#ffff00'; break;
        case 'atacando': estadoColor = '#ff0000'; break;
        case 'regresando': estadoColor = '#00ffff'; break;
      }
      
      ctx.beginPath();
      ctx.arc(enemigo.posX, enemigo.posY, radio / 2, 0, Math.PI * 2);
      ctx.fillStyle = estadoColor;
      ctx.fill();
      
      // Dibujar barra de vida
      const barraAncho = radio * 2;
      const barraAlto = 2;
      const porcVida = enemigo.hp / enemigo.maxHp;
      
      // Fondo de la barra
      ctx.fillStyle = '#333333';
      ctx.fillRect(
        enemigo.posX - barraAncho / 2,
        enemigo.posY - radio - 5,
        barraAncho,
        barraAlto
      );
      
      // Barra de vida
      ctx.fillStyle = porcVida > 0.5 ? '#00ff00' : porcVida > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(
        enemigo.posX - barraAncho / 2,
        enemigo.posY - radio - 5,
        barraAncho * porcVida,
        barraAlto
      );
      
      // Dibujar rango de detección (solo para debug)
      if (false) { // Cambiar a true para ver los rangos
        ctx.beginPath();
        ctx.arc(enemigo.posX, enemigo.posY, enemigo.rango, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.stroke();
      }
    });
  }
}
