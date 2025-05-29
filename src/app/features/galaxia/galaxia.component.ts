import { Component, inject, ElementRef, AfterViewInit, ViewChild, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { JuegoService } from '../../services/juego.service';
import { SistemaEstelar, OutpostEspacial, NaveEnMovimiento, ConflictoBatalla } from '../../models/sistema-estelar';
import { NaveAtaque } from '../../models/nave-ataque';

@Component({
  selector: 'app-galaxia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galaxia.component.html',
  styleUrls: ['./galaxia.component.css']
})
export class GalaxiaComponent implements AfterViewInit {
  @ViewChild('galaxyCanvas') galaxyCanvas!: ElementRef<HTMLCanvasElement>;
  
  juegoService = inject(JuegoService);
  
  // Estado del mapa interactivo
  private mapWidth = 8000; // Mapa extremadamente grande
  private mapHeight = 6000; //este y el de arriba tienen que coincidir con la de juego.service.ts 
  private viewportWidth = 800;  
  private viewportHeight = 600; 
  private viewportX = 0; 
  private viewportY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private scale = 1.0;
  
  // Estrellas de fondo (generadas una sola vez)
  private estrellasFondo: {x: number, y: number, size: number}[] = [];
  
  // Estado de selección
  seleccionActual = signal<string | null>(null); // 'sistema', 'outpost', 'espacio', 'naveMovimiento'
  idSeleccionado = signal<number | null>(null);
  posicionSeleccionada = signal<{x: number, y: number} | null>(null);
  
  // Signals para las naves y la interacción
  private _navesDisponiblesEnSistema = signal<NaveAtaque[]>([]);
  navesDisponiblesEnSistema = this._navesDisponiblesEnSistema.asReadonly();
  
  private _navesSeleccionadas = signal<NaveAtaque[]>([]);
  navesSeleccionadas = this._navesSeleccionadas.asReadonly();
  
  private _mostrarConfirmacionMovimiento = signal<boolean>(false);
  mostrarConfirmacionMovimiento = this._mostrarConfirmacionMovimiento.asReadonly();
  
  // Colecciones
  navesEnMovimiento: NaveEnMovimiento[] = [];
  outposts: OutpostEspacial[] = [];
  conflictos: ConflictoBatalla[] = [];
  
  // Estado de interacción
  modoColocacion = signal<string | null>(null); // 'outpost', 'moverNave'
  naveSeleccionadaParaMover: NaveAtaque | null = null;
  mostrarControlesMapa = false;
  conflictoActivo: ConflictoBatalla | null = null;
  Math = Math; // Para usar Math en el template
  
  // Animación
  private animationFrameId: number | null = null;
  private lastTimestamp = 0;
  
  ngAfterViewInit(): void {
    if (!this.galaxyCanvas) return;
    
    const canvas = this.galaxyCanvas.nativeElement;
    const contenedor = canvas.parentElement;
    if (contenedor) {
      // Ajustar tamaño del canvas al contenedor
      this.viewportWidth = contenedor.clientWidth;
      this.viewportHeight = contenedor.clientHeight;
      canvas.width = this.viewportWidth;
      canvas.height = this.viewportHeight;
    }
    
    // Generar estrellas de fondo (una sola vez)
    this.generarEstrellasFondo();
    
    // Iniciar el bucle de animación
    this.iniciarAnimacion();
    
    // Añadir algunos outposts de ejemplo
    this.inicializarOutpostsEjemplo();
    
    // Centrar la vista en el sistema del jugador
    this.centrarEnSistemaJugador();
  }
  
  iniciarAnimacion(): void {
    const animar = (timestamp: number) => {
      // Calcular delta time para movimientos suaves
      const deltaTime = this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 0;
      this.lastTimestamp = timestamp;
      
      // Actualizar posiciones de naves en movimiento
      this.actualizarNavesEnMovimiento(deltaTime);
      
      // Comprobar colisiones y batallas
      this.comprobarConflictos();
      
      // Redibujar el mapa
      this.dibujarGalaxia();
      
      // Continuar la animación
      this.animationFrameId = requestAnimationFrame(animar);
    };
    
    this.animationFrameId = requestAnimationFrame(animar);
  }
  
  // Métodos para la navegación del mapa
  @HostListener('mousedown', ['$event'])
  onMouseDown(event: MouseEvent): void {
    if (event.button === 0) { // Botón izquierdo para selección
      this.handleMapClick(event);
    } else if (event.button === 1 || event.button === 2) { // Botón central o derecho para navegación
      this.isDragging = true;
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      event.preventDefault();
    }
  }
  
  @HostListener('mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      const deltaX = event.clientX - this.lastMouseX;
      const deltaY = event.clientY - this.lastMouseY;
      
      this.viewportX -= deltaX / this.scale;
      this.viewportY -= deltaY / this.scale;
      
      // Limitar el viewport al tamaño del mapa
      this.limitarViewport();
      
      this.lastMouseX = event.clientX;
      this.lastMouseY = event.clientY;
      
      // Redibujar el mapa con el nuevo viewport
      this.dibujarGalaxia();
    }
  }
  
  @HostListener('mouseup')
  onMouseUp(): void {
    this.isDragging = false;
  }
  
  @HostListener('wheel', ['$event'])
  onMouseWheel(event: WheelEvent): void {
    // Zoom in/out
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const oldScale = this.scale;
    
    this.scale *= zoomFactor;
    this.scale = Math.max(0.5, Math.min(this.scale, 2.0)); // Limitar el zoom
    
    // Ajustar el viewport para que el zoom sea centrado en la posición del mouse
    const rect = this.galaxyCanvas.nativeElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const worldX = this.viewportX + mouseX / oldScale;
    const worldY = this.viewportY + mouseY / oldScale;
    
    this.viewportX = worldX - mouseX / this.scale;
    this.viewportY = worldY - mouseY / this.scale;
    
    this.limitarViewport();
    this.dibujarGalaxia();
    
    event.preventDefault();
  }
  
  @HostListener('contextmenu', ['$event'])
  onRightClick(event: MouseEvent): void {
    // Prevenir el menú contextual predeterminado
    event.preventDefault();
    
    // Log para debug
    console.log('Clic derecho detectado');
    console.log('Naves seleccionadas:', this.navesSeleccionadas().length);
    
    // Obtener coordenadas en el mapa
    const worldPos = this.screenToWorldCoordinates(event.clientX, event.clientY);
    console.log('Coordenadas de destino:', worldPos);
    
    // Si hay naves seleccionadas, mostrar diálogo de confirmación de movimiento
    if (this.navesSeleccionadas().length > 0) {
      console.log('Mostrando diálogo de confirmación de movimiento');
      this.mostrarDialogoConfirmacion(worldPos);
    } else if (this.naveSeleccionadaParaMover) {
      // Compatibilidad con el modo anterior
      console.log('Moviendo nave seleccionada (modo anterior):', this.naveSeleccionadaParaMover);
      this.moverNaveADestino(this.naveSeleccionadaParaMover, worldPos);
    } else {
      console.log('No hay naves seleccionadas para mover');
    }
  }
  
  limitarViewport(): void {
    // Asegurar que el viewport no se salga de los límites del mapa
    const maxX = this.mapWidth - this.viewportWidth / this.scale;
    const maxY = this.mapHeight - this.viewportHeight / this.scale;
    
    this.viewportX = Math.max(0, Math.min(this.viewportX, maxX));
    this.viewportY = Math.max(0, Math.min(this.viewportY, maxY));
  }
  
  screenToWorldCoordinates(screenX: number, screenY: number): {x: number, y: number} {
    const rect = this.galaxyCanvas.nativeElement.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    return {
      x: this.viewportX + canvasX / this.scale,
      y: this.viewportY + canvasY / this.scale
    };
  }
  
  worldToScreenCoordinates(worldX: number, worldY: number): {x: number, y: number} {
    return {
      x: (worldX - this.viewportX) * this.scale,
      y: (worldY - this.viewportY) * this.scale
    };
  }
  
  inicializarOutpostsEjemplo(): void {
    // Añadir algunos outposts de ejemplo
    this.outposts = [
      {
        id: 1,
        x: 500,
        y: 300,
        owner: 'player',
        nivel: 1,
        health: 100,
        rangoDefensa: 150
      },
      {
        id: 2,
        x: 1200,
        y: 800,
        owner: 'enemy',
        nivel: 2,
        health: 100,
        rangoDefensa: 200
      }
    ];
  }
  
  dibujarGalaxia(): void {
    if (!this.galaxyCanvas) return;
    
    const canvas = this.galaxyCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Guardar el estado actual del contexto
    ctx.save();
    
    // Aplicar transformaciones de viewport y escala
    ctx.scale(this.scale, this.scale);
    ctx.translate(-this.viewportX, -this.viewportY);
    
    // Dibujar cuadrícula de fondo para orientación
    this.dibujarCuadricula(ctx);
    
    // Dibujar fondo de estrellas
    this.dibujarEstrellasFondo(ctx, this.mapWidth, this.mapHeight);
    
    // Dibujar los outposts
    this.outposts.forEach(outpost => this.dibujarOutpost(ctx, outpost));
    
    // Dibujar sistemas estelares
    const sistemas = this.juegoService.estadoJuego().systems;
    sistemas.forEach(sistema => this.dibujarSistema(ctx, sistema));
    
    // Dibujar naves estacionarias
    const naves = this.juegoService.estadoJuego().ships;
    naves.forEach(nave => {
      if (nave.location !== null) {
        const sistema = sistemas.find(s => s.id === nave.location);
        if (sistema) {
          this.dibujarNave(ctx, nave, sistema);
        }
      }
    });
    
    // Dibujar naves en movimiento
    this.navesEnMovimiento.forEach(nave => this.dibujarNaveEnMovimiento(ctx, nave));
    
    // Dibujar conflictos/batallas
    this.conflictos.forEach(conflicto => this.dibujarConflicto(ctx, conflicto));
    
    // Dibujar indicador de selección si hay algo seleccionado
    this.dibujarSeleccion(ctx);
    
    // Si estamos en modo colocación, mostrar indicadores
    if (this.modoColocacion() === 'outpost' && this.posicionSeleccionada()) {
      this.dibujarPreviewOutpost(ctx, this.posicionSeleccionada()!);
    }
    
    // Restaurar el estado original del contexto
    ctx.restore();
    
    // Dibujar información de UI sobre el canvas (no afectada por las transformaciones)
    this.dibujarUI(ctx);
  }
  
  dibujarCuadricula(ctx: CanvasRenderingContext2D): void {
    const gridSize = 100;
    ctx.strokeStyle = 'rgba(50, 50, 100, 0.2)';
    ctx.lineWidth = 1;
    
    // Dibujar líneas verticales
    for (let x = 0; x <= this.mapWidth; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.mapHeight);
      ctx.stroke();
    }
    
    // Dibujar líneas horizontales
    for (let y = 0; y <= this.mapHeight; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.mapWidth, y);
      ctx.stroke();
    }
  }
  
  // Generar estrellas una sola vez
  generarEstrellasFondo(): void {
    const numEstrellas = 500; // Más estrellas para un mapa más grande
    this.estrellasFondo = [];
    
    for (let i = 0; i < numEstrellas; i++) {
      this.estrellasFondo.push({
        x: Math.random() * this.mapWidth,
        y: Math.random() * this.mapHeight,
        size: Math.random() * 2
      });
    }
  }
  
  dibujarEstrellasFondo(ctx: CanvasRenderingContext2D, ancho: number, alto: number): void {
    // Usar las estrellas pre-generadas
    ctx.fillStyle = 'white';
    
    for (const estrella of this.estrellasFondo) {
      ctx.beginPath();
      ctx.arc(estrella.x, estrella.y, estrella.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  dibujarSistema(ctx: CanvasRenderingContext2D, sistema: SistemaEstelar): void {
    // Tamaño variable según el desarrollo
    const tamanioBase = 10 + (sistema.development || 1) * 2;
    
    // Dibujar el sistema estelar
    ctx.beginPath();
    ctx.arc(sistema.x, sistema.y, tamanioBase, 0, Math.PI * 2);
    ctx.fillStyle = this.juegoService.getColorEstrella(sistema.type);
    ctx.fill();
    
    // Añadir un resplandor según el propietario
    ctx.beginPath();
    ctx.arc(sistema.x, sistema.y, tamanioBase + 5, 0, Math.PI * 2);
    
    if (sistema.owner === 'player') {
      // Hacer el sistema del jugador más destacado
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      
      // Añadir un indicador extra para el sistema del jugador
      if (sistema.id === 0) { // Sistema inicial
        ctx.beginPath();
        ctx.arc(sistema.x, sistema.y, tamanioBase + 15, 0, Math.PI * 2);
        ctx.strokeStyle = '#00ffff';
        ctx.setLineDash([5, 3]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Texto "Base Principal"
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 12px Arial';
        ctx.fillText('Base Principal', sistema.x - 40, sistema.y - 25);
      }
    } else if (sistema.owner === 'enemy') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
    } else {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1.5;
    }
    
    ctx.stroke();
    
    // Si hay un outpost, dibujarlo
    if (sistema.hasOutpost) {
      ctx.beginPath();
      ctx.arc(sistema.x, sistema.y, tamanioBase + 10, 0, Math.PI * 2);
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = sistema.owner === 'player' ? '#00ff88' : '#ff5500';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    // Nombre del sistema
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(sistema.name, sistema.x - 25, sistema.y + 30);
    
    // Mostrar recursos y población de forma resumida
    if (sistema.owner === 'player') {
      ctx.font = '10px Arial';
      ctx.fillStyle = '#88ff88';
      ctx.fillText(`R:${sistema.resources} P:${sistema.population}`, sistema.x - 25, sistema.y + 45);
    }
  }
  
  dibujarOutpost(ctx: CanvasRenderingContext2D, outpost: OutpostEspacial): void {
    // Dibujar el outpost
    ctx.beginPath();
    ctx.arc(outpost.x, outpost.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = outpost.owner === 'player' ? '#00ff88' : '#ff5500';
    ctx.fill();
    
    // Dibujar el rango de defensa
    ctx.beginPath();
    ctx.arc(outpost.x, outpost.y, outpost.rangoDefensa, 0, Math.PI * 2);
    ctx.strokeStyle = outpost.owner === 'player' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 85, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Nombre del outpost
    ctx.fillStyle = 'white';
    ctx.font = '8px Arial';
    ctx.fillText(`Outpost Nivel ${outpost.nivel}`, outpost.x - 25, outpost.y - 10);
  }
  
  dibujarNaveEnMovimiento(ctx: CanvasRenderingContext2D, nave: NaveEnMovimiento): void {
    // Dibujar una línea de ruta
    ctx.beginPath();
    ctx.moveTo(nave.origen.x, nave.origen.y);
    ctx.lineTo(nave.destino.x, nave.destino.y);
    ctx.strokeStyle = nave.owner === 'player' ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Determinar el tamaño según el tipo de nave
    const size = nave.size || 1; // Si no tiene tamaño, usar 1 por defecto
    
    // Escalar el tamaño del triángulo según el tipo de nave
    const baseSize = 3 * size;
    const heightSize = 5 * size;
    
    // Dibujar la nave en movimiento
    ctx.fillStyle = nave.owner === 'player' ? '#00ff00' : '#ff0000';
    ctx.beginPath();
    ctx.moveTo(nave.posicionActual.x, nave.posicionActual.y - heightSize);
    ctx.lineTo(nave.posicionActual.x - baseSize, nave.posicionActual.y + baseSize);
    ctx.lineTo(nave.posicionActual.x + baseSize, nave.posicionActual.y + baseSize);
    ctx.closePath();
    ctx.fill();
    
    // Añadir un brillo/sombra según el tamaño
    if (size > 1) {
      ctx.shadowColor = nave.owner === 'player' ? 'rgba(0, 255, 0, 0.6)' : 'rgba(255, 0, 0, 0.6)';
      ctx.shadowBlur = 5 * size;
    }
    
    // Tipo de nave con tamaño de fuente proporcional
    ctx.fillStyle = 'white';
    ctx.font = `${6 + size}px Arial`;
    ctx.shadowBlur = 0; // Quitar sombra para el texto
    ctx.fillText(nave.tipoNave, nave.posicionActual.x - (10 * size / 2), nave.posicionActual.y + (12 * size / 2));
  }
  
  dibujarConflicto(ctx: CanvasRenderingContext2D, conflicto: ConflictoBatalla): void {
    // Dibujar un símbolo de batalla
    const x = conflicto.ubicacion.x;
    const y = conflicto.ubicacion.y;
    
    // Destello de batalla
    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(x, y, 20 + Math.sin(Date.now() / 200) * 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Símbolo de batalla ("!")
    ctx.fillStyle = 'red';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('!', x - 3, y + 5);
  }
  
  dibujarSeleccion(ctx: CanvasRenderingContext2D): void {
    if (!this.posicionSeleccionada()) return;
    
    const pos = this.posicionSeleccionada()!;
    
    // Dibujar un indicador de selección
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  dibujarPreviewOutpost(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}): void {
    // Dibujar un preview del outpost que se va a colocar
    ctx.fillStyle = 'rgba(0, 255, 136, 0.5)';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Dibujar el rango de defensa
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 150, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Texto de ayuda
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText('Clic para colocar outpost', pos.x - 50, pos.y - 15);
  }
  
  dibujarUI(ctx: CanvasRenderingContext2D): void {
    // Dibujar información sobre la selección actual
    ctx.fillStyle = 'rgba(0, 0, 20, 0.7)';
    ctx.fillRect(10, 10, 200, 60);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    
    if (this.seleccionActual() === 'sistema') {
      const sistema = this.juegoService.estadoJuego().systems.find(s => s.id === this.idSeleccionado());
      if (sistema) {
        ctx.fillText(`Sistema: ${sistema.name}`, 15, 30);
        ctx.fillText(`Propietario: ${sistema.owner}`, 15, 45);
        ctx.fillText(`Recursos: ${sistema.resources}`, 15, 60);
      }
    } else if (this.seleccionActual() === 'outpost') {
      const outpost = this.outposts.find(o => o.id === this.idSeleccionado());
      if (outpost) {
        ctx.fillText(`Outpost Nivel ${outpost.nivel}`, 15, 30);
        ctx.fillText(`Salud: ${outpost.health}`, 15, 45);
        ctx.fillText(`Rango: ${outpost.rangoDefensa}`, 15, 60);
      }
    } else if (this.seleccionActual() === 'espacio') {
      const pos = this.posicionSeleccionada();
      if (pos) {
        ctx.fillText(`Posición: (${Math.round(pos.x)}, ${Math.round(pos.y)})`, 15, 30);
        ctx.fillText('Clic derecho para mover naves', 15, 45);
      }
    }
    
    // Minimapá
    const minimapSize = 150;
    const minimapScale = minimapSize / this.mapWidth;
    
    ctx.fillStyle = 'rgba(0, 0, 20, 0.7)';
    ctx.fillRect(ctx.canvas.width - minimapSize - 10, ctx.canvas.height - minimapSize - 10, minimapSize, minimapSize);
    
    // Dibujar sistemas en el minimapá
    const sistemas = this.juegoService.estadoJuego().systems;
    sistemas.forEach(sistema => {
      ctx.beginPath();
      const minimapX = ctx.canvas.width - minimapSize - 10 + sistema.x * minimapScale;
      const minimapY = ctx.canvas.height - minimapSize - 10 + sistema.y * minimapScale;
      ctx.arc(minimapX, minimapY, 2, 0, Math.PI * 2);
      
      if (sistema.owner === 'player') {
        ctx.fillStyle = '#00ff00';
      } else if (sistema.owner === 'enemy') {
        ctx.fillStyle = '#ff0000';
      } else {
        ctx.fillStyle = '#ffff00';
      }
      
      ctx.fill();
    });
    
    // Dibujar outposts en el minimapá
    this.outposts.forEach(outpost => {
      ctx.beginPath();
      const minimapX = ctx.canvas.width - minimapSize - 10 + outpost.x * minimapScale;
      const minimapY = ctx.canvas.height - minimapSize - 10 + outpost.y * minimapScale;
      ctx.arc(minimapX, minimapY, 1, 0, Math.PI * 2);
      ctx.fillStyle = outpost.owner === 'player' ? '#00ff88' : '#ff5500';
      ctx.fill();
    });
    
    // Dibujar viewbox en el minimapá
    const viewX = ctx.canvas.width - minimapSize - 10 + this.viewportX * minimapScale;
    const viewY = ctx.canvas.height - minimapSize - 10 + this.viewportY * minimapScale;
    const viewW = (this.viewportWidth / this.scale) * minimapScale;
    const viewH = (this.viewportHeight / this.scale) * minimapScale;
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
  }
  
  dibujarNave(ctx: CanvasRenderingContext2D, nave: any, sistema: SistemaEstelar): void {
    // Dibujar una representación simple de la nave
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.arc(sistema.x + 5, sistema.y - 5, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  handleMapClick(event: MouseEvent): void {
    if (!this.galaxyCanvas) return;
    
    // Convertir las coordenadas del clic a coordenadas del mundo
    const worldPos = this.screenToWorldCoordinates(event.clientX, event.clientY);
    
    // Comprobar si estamos en modo colocación de outpost
    if (this.modoColocacion() === 'outpost') {
      this.colocarOutpost(worldPos);
      return;
    }
    
    // Intentar seleccionar algo en este orden: sistema, outpost, espacio vacío
    if (this.seleccionarObjetoEnPosicion(worldPos)) {
      return;
    }
    
    // Si llegamos aquí, seleccionamos el espacio vacío
    this.seleccionarEspacioVacio(worldPos);
  }
  
  seleccionarObjetoEnPosicion(worldPos: {x: number, y: number}): boolean {
    // PASO 1: Comprobar primero si hay una nave en movimiento en esa posición
    // Esto tiene prioridad porque las naves son más difíciles de seleccionar
    const naveMovimientoSeleccionada = this.comprobarClicEnNaveMovimiento(worldPos);
    if (naveMovimientoSeleccionada) {
      console.log('Nave en movimiento seleccionada por clic directo');
      this.seleccionarNaveEnMovimiento(naveMovimientoSeleccionada);
      return true;
    }
    
    // PASO 2: Comprobar si hay un sistema en esa posición
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistemaSeleccionado = sistemas.find(sistema => {
      const distancia = Math.sqrt(
        Math.pow(sistema.x - worldPos.x, 2) + Math.pow(sistema.y - worldPos.y, 2)
      );
      return distancia <= 15; // Radio de detección
    });
    
    if (sistemaSeleccionado) {
      this.seleccionarSistema(sistemaSeleccionado);
      return true;
    }
    
    // PASO 3: Comprobar si hay un outpost en esa posición
    const outpostSeleccionado = this.outposts.find(outpost => {
      const distancia = Math.sqrt(
        Math.pow(outpost.x - worldPos.x, 2) + Math.pow(outpost.y - worldPos.y, 2)
      );
      return distancia <= 10; // Radio de detección
    });
    
    if (outpostSeleccionado) {
      this.seleccionarOutpost(outpostSeleccionado);
      return true;
    }
    
    // PASO 4: Comprobar si hay un conflicto en esa posición
    const conflictoSeleccionado = this.conflictos.find(conflicto => {
      const distancia = Math.sqrt(
        Math.pow(conflicto.ubicacion.x - worldPos.x, 2) + 
        Math.pow(conflicto.ubicacion.y - worldPos.y, 2)
      );
      return distancia <= 20; // Radio de detección
    });
    
    if (conflictoSeleccionado) {
      this.mostrarModalBatalla(conflictoSeleccionado);
      return true;
    }
    
    return false;
  }
  
  // Método para seleccionar un sistema estelar
  seleccionarSistema(sistema: SistemaEstelar): void {
    this.seleccionActual.set('sistema');
    this.idSeleccionado.set(sistema.id);
    this.posicionSeleccionada.set({x: sistema.x, y: sistema.y});
    
    // Mostrar las naves disponibles en este sistema
    this.mostrarNavesEnSistema(sistema.id);
    
    // También notificar al servicio de juego
    this.juegoService.seleccionarSistema(sistema.id);
    
    console.log(`Sistema seleccionado: ${sistema.name} (${sistema.type})`);
  }
  
  // Método para seleccionar un outpost
  seleccionarOutpost(outpost: OutpostEspacial): void {
    this.seleccionActual.set('outpost');
    this.idSeleccionado.set(outpost.id);
    this.posicionSeleccionada.set({x: outpost.x, y: outpost.y});
  }
  
  seleccionarEspacioVacio(pos: {x: number, y: number}): void {
    this.seleccionActual.set('espacio');
    this.idSeleccionado.set(null);
    this.posicionSeleccionada.set(pos);
  }
  
  mostrarModalBatalla(conflicto: ConflictoBatalla): void {
    // Aquí iría la lógica para mostrar el modal de batalla
    console.log('Mostrando batalla:', conflicto);
    // Esto se implementaría completamente cuando tengamos el componente de modal
  }
  
  colocarOutpost(pos: {x: number, y: number}): void {
    // Crear un nuevo outpost en la posición seleccionada
    const nuevoOutpost: OutpostEspacial = {
      id: this.outposts.length + 1,
      x: pos.x,
      y: pos.y,
      owner: 'player',
      nivel: 1,
      health: 100,
      rangoDefensa: 150
    };
    
    this.outposts.push(nuevoOutpost);
    this.modoColocacion.set(null); // Salir del modo colocación
  }
  
  moverNaveADestino(nave: NaveAtaque, destino: {x: number, y: number}): void {
    // Obtener la posición actual de la nave
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistemaOrigen = sistemas.find(s => s.id === nave.location);
    
    if (!sistemaOrigen) return;
    
    // Determinar el tamaño según el tipo de nave
    let size = 1; // Tamaño por defecto (pequeño)
    
    switch(nave.type.toLowerCase()) {
      case 'fighter':
      case 'caza':
      case 'scout':
        size = 1; // Pequeño
        break;
      case 'cruiser':
      case 'crucero':
      case 'destroyer':
      case 'destructor':
        size = 2; // Mediano
        break;
      case 'battleship':
      case 'acorazado':
      case 'dreadnought':
      case 'capital':
        size = 3; // Grande
        break;
      default:
        size = 1;
    }
    
    // Crear una nueva nave en movimiento
    const nuevaNaveEnMovimiento: NaveEnMovimiento = {
      id: nave.id,
      tipoNave: nave.type,
      owner: 'player',
      origen: {x: sistemaOrigen.x, y: sistemaOrigen.y},
      destino: {x: destino.x, y: destino.y},
      progreso: 0,
      velocidad: 30, // Pixels por segundo
      posicionActual: {x: sistemaOrigen.x, y: sistemaOrigen.y},
      mision: 'patrullar',
      size: size // Asignar el tamaño según el tipo de nave
    };
    
    // Añadir la nave a la lista de naves en movimiento
    this.navesEnMovimiento.push(nuevaNaveEnMovimiento);
    
    // IMPORTANTE: Actualizar el estado de la nave en el juegoService para marcarla como en movimiento
    // Esto evita que la nave siga apareciendo como disponible en el sistema
    const estadoJuego = this.juegoService.estadoJuego();
    const naveEnEstado = estadoJuego.ships.find(n => n.id === nave.id);
    if (naveEnEstado) {
      naveEnEstado.moving = true; // Marcar la nave como en movimiento
      
      // Opcional: Si hay un método para actualizar el estado completo, usarlo
      // this.juegoService.actualizarEstado(estadoJuego);
    }
    
    // Eliminar la nave de las naves disponibles
    this._navesDisponiblesEnSistema.set(
      this.navesDisponiblesEnSistema().filter(n => n.id !== nave.id)
    );
    
    // Eliminar la nave de las naves seleccionadas
    this._navesSeleccionadas.set(
      this.navesSeleccionadas().filter(n => n.id !== nave.id)
    );
    
    // Reiniciar la selección
    this.naveSeleccionadaParaMover = null;
    
    // Mostrar un mensaje para el usuario
    this.agregarMensaje(`Nave ${nave.type} enviada a las coordenadas (${Math.round(destino.x)}, ${Math.round(destino.y)})`);
  }
  
  actualizarNavesEnMovimiento(deltaTime: number): void {
    // Actualizar la posición de las naves en movimiento
    this.navesEnMovimiento.forEach((nave, index) => {
      // Calcular la distancia total del viaje
      const distanciaTotal = Math.sqrt(
        Math.pow(nave.destino.x - nave.origen.x, 2) + 
        Math.pow(nave.destino.y - nave.origen.y, 2)
      );
      
      // Actualizar el progreso
      const distanciaRecorrida = nave.velocidad * deltaTime;
      nave.progreso += (distanciaRecorrida / distanciaTotal) * 100;
      
      if (nave.progreso >= 100) {
        // La nave ha llegado a su destino
        nave.progreso = 100;
        nave.posicionActual = {...nave.destino};
        
        // Comprobar si hay un sistema o outpost en el destino
        this.comprobarDestino(nave, index);
      } else {
        // Actualizar la posición actual en función del progreso
        const t = nave.progreso / 100;
        nave.posicionActual = {
          x: nave.origen.x + (nave.destino.x - nave.origen.x) * t,
          y: nave.origen.y + (nave.destino.y - nave.origen.y) * t
        };
      }
    });
  }
  
  comprobarDestino(nave: NaveEnMovimiento, index: number): void {
    // IMPORTANTE: Ya no comprobamos si hay sistemas cercanos al destino
    // Las naves deben ir EXACTAMENTE a donde el usuario hace clic
    // Así que removemos la comprobación de sistemas cercanos
    
    // Solo comprobamos si hay un sistema EXACTAMENTE en el destino (no cerca)
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistemaDestino = sistemas.find(sistema => {
      // Verificamos si las coordenadas son exactamente iguales (con un margen de error muy pequeño)
      return Math.abs(sistema.x - nave.destino.x) < 3 && Math.abs(sistema.y - nave.destino.y) < 3;
    });
    
    if (sistemaDestino) {
      // Si el sistema es enemigo, iniciar batalla
      if (sistemaDestino.owner === 'enemy') {
        this.iniciarConflicto(nave, sistemaDestino);
        // No eliminar la nave, sólo actualizar su estado de misión
        nave.mision = 'atacar';
        return;
      } else if (sistemaDestino.owner === 'neutral') {
        // Colonizar sistema neutral
        this.colonizarSistema(nave, sistemaDestino);
        // No eliminar la nave, sólo actualizar su estado de misión
        nave.mision = 'colonizar';
        return;
      } else {
        // La nave ha llegado a un sistema aliado
        nave.mision = 'defender';
        // No eliminar la nave, se quedará en el sistema aliado
        return;
      }
    }
    
    // Comprobar si hay un outpost enemigo en el destino
    const outpostDestino = this.outposts.find(outpost => {
      const distancia = Math.sqrt(
        Math.pow(outpost.x - nave.destino.x, 2) + 
        Math.pow(outpost.y - nave.destino.y, 2)
      );
      return distancia <= 10 && outpost.owner !== nave.owner;
    });
    
    if (outpostDestino) {
      // Iniciar batalla con el outpost
      this.iniciarConflictoOutpost(nave, outpostDestino);
      // No eliminar la nave, sólo actualizar su estado de misión
      nave.mision = 'atacar';
      return;
    }
    
    // Si no hay ni sistema ni outpost en el destino, la nave permanece en el espacio
    nave.mision = 'patrullar';
    // No eliminamos la nave, se quedará en su posición actual patrullando
  }
  
  comprobarConflictos(): void {
    // Comprobar si hay naves enemigas en sistemas del jugador
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistemasPropios = sistemas.filter(s => s.owner === 'player');
    
    sistemasPropios.forEach(sistema => {
      const navesEnemigas = this.navesEnMovimiento.filter(nave => 
        nave.owner === 'enemy' && 
        Math.sqrt(
          Math.pow(sistema.x - nave.posicionActual.x, 2) + 
          Math.pow(sistema.y - nave.posicionActual.y, 2)
        ) <= 20
      );
      
      if (navesEnemigas.length > 0) {
        // Crear un nuevo conflicto si no existe ya
        const conflictoExistente = this.conflictos.find(c => 
          c.ubicacion.x === sistema.x && c.ubicacion.y === sistema.y
        );
        
        if (!conflictoExistente) {
          this.conflictos.push({
            id: this.conflictos.length + 1,
            ubicacion: {x: sistema.x, y: sistema.y},
            atacantes: navesEnemigas,
            defensores: [{tipo: 'sistema', id: sistema.id}],
            estado: 'activo'
          });
        }
      }
    });
    
    // Comprobar outposts
    const outpostsPropios = this.outposts.filter(o => o.owner === 'player');
    
    outpostsPropios.forEach(outpost => {
      const navesEnemigas = this.navesEnMovimiento.filter(nave => 
        nave.owner === 'enemy' && 
        Math.sqrt(
          Math.pow(outpost.x - nave.posicionActual.x, 2) + 
          Math.pow(outpost.y - nave.posicionActual.y, 2)
        ) <= outpost.rangoDefensa
      );
      
      if (navesEnemigas.length > 0) {
        // Crear un nuevo conflicto si no existe ya
        const conflictoExistente = this.conflictos.find(c => 
          c.ubicacion.x === outpost.x && c.ubicacion.y === outpost.y
        );
        
        if (!conflictoExistente) {
          this.conflictos.push({
            id: this.conflictos.length + 1,
            ubicacion: {x: outpost.x, y: outpost.y},
            atacantes: navesEnemigas,
            defensores: [{tipo: 'outpost', id: outpost.id}],
            estado: 'activo'
          });
        }
      }
    });
  }
  
  iniciarConflicto(nave: NaveEnMovimiento, sistema: SistemaEstelar): void {
    // Crear un nuevo conflicto
    this.conflictos.push({
      id: this.conflictos.length + 1,
      ubicacion: {x: sistema.x, y: sistema.y},
      atacantes: [{tipo: nave.tipoNave, id: nave.id}],
      defensores: [{tipo: 'sistema', id: sistema.id}],
      estado: 'activo'
    });
  }
  
  iniciarConflictoOutpost(nave: NaveEnMovimiento, outpost: OutpostEspacial): void {
    // Crear un nuevo conflicto
    this.conflictos.push({
      id: this.conflictos.length + 1,
      ubicacion: {x: outpost.x, y: outpost.y},
      atacantes: [{tipo: nave.tipoNave, id: nave.id}],
      defensores: [{tipo: 'outpost', id: outpost.id}],
      estado: 'activo'
    });
  }
  
  colonizarSistema(nave: NaveEnMovimiento, sistema: SistemaEstelar): void {
    // Lógica para colonizar un sistema neutral
    console.log(`Colonizando sistema ${sistema.name}`);
    // Esta lógica se implementaría completamente en el servicio de juego
  }
  
  // Métodos para la interfaz de usuario
  getSistemaSeleccionado(): SistemaEstelar | null {
    if (this.seleccionActual() !== 'sistema' || this.idSeleccionado() === null) return null;
    
    const sistemas = this.juegoService.estadoJuego().systems;
    return sistemas.find(s => s.id === this.idSeleccionado()) || null;
  }
  
  getOutpostSeleccionado(): OutpostEspacial | null {
    if (this.seleccionActual() !== 'outpost' || this.idSeleccionado() === null) return null;
    
    return this.outposts.find(o => o.id === this.idSeleccionado()) || null;
  }
  
  // Este método ya está definido más abajo, eliminar la duplicación
  
  seleccionarNaveParaEnviar(sistemaId: number): void {
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistema = sistemas.find(s => s.id === sistemaId);
    if (!sistema) return;
    
    // Obtener todas las naves en este sistema
    const naves = this.juegoService.estadoJuego().ships;
    const naveEnSistema = naves.find(n => n.location === sistemaId);
    
    if (naveEnSistema) {
      this.naveSeleccionadaParaMover = naveEnSistema;
      console.log('Nave seleccionada para mover. Haz clic derecho en el destino.');
    } else {
      console.log('No hay naves disponibles en este sistema.');
    }
  }
  
  upgradeDefensa(sistemaId: number): void {
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistema = sistemas.find(s => s.id === sistemaId);
    if (!sistema) return;
    
    // Esta lógica se implementaría completamente en el servicio de juego
    console.log(`Mejorando defensa del sistema ${sistema.name}`);
  }
  
  construirOutpost(sistemaId: number): void {
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistema = sistemas.find(s => s.id === sistemaId);
    if (!sistema) return;
    
    // Marcar el sistema como que tiene un outpost
    sistema.hasOutpost = true;
    sistema.outpostLevel = 1;
    
    // Crear un nuevo outpost vinculado a este sistema
    this.outposts.push({
      id: this.outposts.length + 1,
      x: sistema.x,
      y: sistema.y,
      owner: 'player',
      nivel: 1,
      health: 100,
      rangoDefensa: 150,
      sistemaVinculado: sistema.id
    });
    
    console.log(`Outpost construido en ${sistema.name}`);
  }
  
  mejorarOutpost(outpostId: number): void {
    const outpost = this.outposts.find(o => o.id === outpostId);
    if (!outpost || outpost.nivel >= 3) return;
    
    outpost.nivel++;
    outpost.rangoDefensa += 50; // Aumentar el rango de defensa con cada nivel
    
    // Si está vinculado a un sistema, actualizar el nivel allí también
    if (outpost.sistemaVinculado) {
      const sistemas = this.juegoService.estadoJuego().systems;
      const sistema = sistemas.find(s => s.id === outpost.sistemaVinculado);
      if (sistema) {
        sistema.outpostLevel = outpost.nivel;
      }
    }
    
    console.log(`Outpost mejorado a nivel ${outpost.nivel}`);
  }
  
  repararOutpost(outpostId: number): void {
    const outpost = this.outposts.find(o => o.id === outpostId);
    if (!outpost) return;
    
    outpost.health = 100;
    console.log('Outpost reparado completamente');
  }
  
  destruirOutpost(outpostId: number): void {
    const outpost = this.outposts.find(o => o.id === outpostId);
    if (!outpost) return;
    
    // Si está vinculado a un sistema, actualizar el estado allí también
    if (outpost.sistemaVinculado) {
      const sistemas = this.juegoService.estadoJuego().systems;
      const sistema = sistemas.find(s => s.id === outpost.sistemaVinculado);
      if (sistema) {
        sistema.hasOutpost = false;
        sistema.outpostLevel = undefined;
      }
    }
    
    // Eliminar el outpost de la lista
    const index = this.outposts.findIndex(o => o.id === outpostId);
    if (index !== -1) {
      this.outposts.splice(index, 1);
    }
    
    console.log('Outpost destruido');
  }
  
  cerrarModalBatalla(): void {
    this.conflictoActivo = null;
  }
  
  // Método para centrar la vista en el sistema del jugador
  centrarEnSistemaJugador(): void {
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistemaJugador = sistemas.find(s => s.owner === 'player' && s.id === 0);
    
    if (sistemaJugador) {
      // Centrar la vista en las coordenadas del sistema del jugador
      this.viewportX = sistemaJugador.x - this.viewportWidth / (2 * this.scale);
      this.viewportY = sistemaJugador.y - this.viewportHeight / (2 * this.scale);
      this.limitarViewport();
    }
  }
  
  // Métodos para posición de naves
  getShipX(nave: any): number {
    // Obtener la posición del sistema donde está la nave
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistema = sistemas.find(s => s.id === nave.location);
    
    if (sistema) {
      return sistema.x + 5; // Un poco desplazado del centro del sistema
    }
    return 0;
  }
  
  getShipY(nave: any): number {
    // Obtener la posición del sistema donde está la nave
    const sistemas = this.juegoService.estadoJuego().systems;
    const sistema = sistemas.find(s => s.id === nave.location);
    
    if (sistema) {
      return sistema.y - 5; // Un poco desplazado del centro del sistema
    }
    return 0;
  }
  
  // Comprobar si hemos hecho clic en una nave en movimiento
  comprobarClicEnNaveMovimiento(pos: {x: number, y: number}): NaveEnMovimiento | null {
    for (const nave of this.navesEnMovimiento) {
      const distancia = Math.sqrt(
        Math.pow(nave.posicionActual.x - pos.x, 2) + 
        Math.pow(nave.posicionActual.y - pos.y, 2)
      );
      
      // Aumentar el radio de detección según el tamaño de la nave
      const radioDeteccion = nave.size ? 10 * nave.size : 15;
      
      if (distancia < radioDeteccion) { // Radio de detección del clic ajustado al tamaño
        return nave;
      }
    }
    
    return null;
  }
  
  // Seleccionar una nave en movimiento
  seleccionarNaveEnMovimiento(nave: NaveEnMovimiento): void {
    console.log('Seleccionando nave en movimiento:', nave);
    this.seleccionActual.set('naveMovimiento');
    
    // Crear un objeto nave temporal para poder moverla
    const naveTemp: NaveAtaque = {
      id: nave.id,
      type: nave.tipoNave,
      owner: nave.owner,
      location: -1, // No está en ningún sistema, está en el espacio
      moving: false, // Ya no está en movimiento (está seleccionada)
      hp: 100, // Valores por defecto
      maxHp: 100,
      attack: 10,
      speed: 30 // Velocidad estándar
    };
    
    // Asignar la nave temporal como la nave seleccionada para mover
    this.naveSeleccionadaParaMover = naveTemp;
    this._navesSeleccionadas.set([naveTemp]);
    
    // Mostrar información en el panel lateral
    this.agregarMensaje(`Nave ${nave.tipoNave} seleccionada. Haz clic derecho en el mapa para moverla.`);
    console.log('Nave en movimiento seleccionada para mover:', this.naveSeleccionadaParaMover);
  }
  
  // Mostrar las naves disponibles en un sistema para seleccionarlas
  mostrarNavesEnSistema(sistemaId: number): void {
    const naves = this.juegoService.estadoJuego().ships.filter(
      nave => nave.location === sistemaId && nave.owner === 'player' && !nave.moving
    );
    
    if (naves.length > 0) {
      // Actualizar la UI para mostrar las naves disponibles
      this._navesDisponiblesEnSistema.set(naves);
      // Deseleccionar todas las naves cuando cambiamos de sistema
      this._navesSeleccionadas.set([]);
      this.naveSeleccionadaParaMover = null;
    } else {
      this._navesDisponiblesEnSistema.set([]);
      this._navesSeleccionadas.set([]);
      this.naveSeleccionadaParaMover = null;
      this.agregarMensaje('No hay naves disponibles en este sistema');
    }
  }
  
  // Para mensajes en el panel
  agregarMensaje(mensaje: string): void {
    console.log(mensaje); // También podríamos mostrar esto en la UI
  }
  
  // Verificar si hay naves disponibles
  hayNavesDisponibles(): boolean {
    return this.navesDisponiblesEnSistema().length > 0;
  }
  
  // ==================== SISTEMA DE SELECCIÓN DE NAVES ====================
  
  // VERSIÓN SUPER-DIRECTA: Método completamente simplificado para selección
  // Este método es llamado directamente desde el HTML y es más simple que el anterior
  seleccionarNaveDirecto(nave: NaveAtaque): void {
    console.log('MÉTODO ULTRA DIRECTO - Seleccionando nave:', nave);
    
    // Variables para acceso rápido - sin usar window global
    // Esta línea la comentamos para evitar errores de TypeScript
    // window.selectedShip = nave;
    
    // 1. Asignación directa de la nave para mover
    this.naveSeleccionadaParaMover = nave;
    
    // 2. Actualización directa del array de naves seleccionadas
    this._navesSeleccionadas.set([nave]);
    
    // 3. Mensaje de confirmación claro
    const mensaje = `🔔 NAVE SELECCIONADA: ${nave.type} (ID: ${nave.id}). Ahora haz clic derecho donde quieras moverla.`;
    this.agregarMensaje(mensaje);
    console.log(mensaje);
    
    // 4. Verificación explícita y detallada
    console.log('SELECCIÓN COMPLETA', {
      nave_id: nave.id,
      nave_tipo: nave.type,
      total_seleccionadas: this.navesSeleccionadas().length,
      array_completo: this.navesSeleccionadas()
    });
  }
  
  // Método original - mantenido por compatibilidad con otras partes del código
  seleccionarNave(nave: NaveAtaque, event?: MouseEvent): void {
    console.log('SOLUCIÓN NUEVA - Iniciando selección de nave:', nave);
    
    try {
      // Almacenamos directamente la nave seleccionada en una variable de clase
      this.naveSeleccionadaParaMover = nave;
      
      // Creamos un array con solo esta nave - solución directa
      const navesSeleccionadas = [nave];
      
      // Actualizamos el estado - IMPORTANTE: Esto estaba fallando antes
      console.log('Actualizando el array de naves seleccionadas');
      this._navesSeleccionadas.update(() => navesSeleccionadas);
      
      // Mostramos la información del panel
      this.seleccionActual.set('sistema');
      
      // Feedback visual para el usuario
      this.agregarMensaje(`Nave ${nave.type} seleccionada. Haz clic derecho en el mapa para moverla.`);
      
      // Verificación final
      console.log('Estado final:', {
        naveSeleccionada: this.naveSeleccionadaParaMover,
        arrayNaves: this.navesSeleccionadas()
      });
    } catch (error) {
      console.error('Error al seleccionar nave:', error);
      alert('Error al seleccionar nave. Consulta la consola para más detalles.');
    }
  }
  
  // Método simplificado para seleccionar nave para mover
  seleccionarNaveParaMover(nave: NaveAtaque): void {
    console.log('Método directo - Seleccionando nave para mover:', nave);
    
    // Deseleccionar todas las naves primero
    this._navesSeleccionadas.set([]);
    
    // Seleccionar esta nave específica
    this._navesSeleccionadas.set([nave]);
    this.naveSeleccionadaParaMover = nave;
    
    // Importante: Asegurarse de que el panel de unidades esté visible
    this.seleccionActual.set('sistema');
    
    // Mostrar mensaje de confirmación para el usuario
    this.agregarMensaje(`Nave ${nave.type} seleccionada. Haz clic derecho en el mapa para moverla.`);
    
    // Log para verificar el estado de la selección
    console.log('Naves seleccionadas ahora:', this.navesSeleccionadas().length);
    console.log('Nave seleccionada para mover:', this.naveSeleccionadaParaMover);
  }
  
  seleccionarTodasLasNaves(): void {
    // SOLUCIÓN RADICAL: Usar el mismo enfoque directo
    try {
      console.log('Seleccionando todas las naves disponibles');
      
      // Obtener todas las naves disponibles
      const todasLasNaves = [...this.navesDisponiblesEnSistema()];
      
      // Actualizar el estado usando update() en lugar de set()
      this._navesSeleccionadas.update(() => todasLasNaves);
      
      // Log detallado para verificar
      console.log('Naves disponibles:', todasLasNaves.length);
      console.log('Naves seleccionadas ahora:', this.navesSeleccionadas().length);
      
      // Asignar la primera nave como referencia para mover
      if (todasLasNaves.length > 0) {
        this.naveSeleccionadaParaMover = todasLasNaves[0];
        this.agregarMensaje(`${todasLasNaves.length} naves seleccionadas. Haz clic derecho en el mapa para moverlas.`);
      } else {
        this.naveSeleccionadaParaMover = null;
        this.agregarMensaje('No hay naves disponibles en este sistema');
      }
      
      // Verificación final
      console.log('Estado final:', {
        naveSeleccionada: this.naveSeleccionadaParaMover,
        arrayNaves: this.navesSeleccionadas()
      });
    } catch (error) {
      console.error('Error al seleccionar todas las naves:', error);
      alert('Error al seleccionar todas las naves. Consulta la consola para más detalles.');
    }
  }
  
  deseleccionarTodasLasNaves(): void {
    this._navesSeleccionadas.set([]);
    this.naveSeleccionadaParaMover = null;
  }
  
  // Método totalmente simplificado para verificar si una nave está seleccionada
  esNaveSeleccionada(nave: NaveAtaque): boolean {
    // Si no hay nave para comparar, retornamos false directamente
    if (!nave) return false;
    
    // Si la nave seleccionada para mover es esta nave, retornamos true directamente
    // Esta es una comprobación rápida y directa que evita problemas con arrays
    if (this.naveSeleccionadaParaMover && this.naveSeleccionadaParaMover.id === nave.id) {
      return true;
    }
    
    // Verificamos si está en el array de naves seleccionadas (comprobación adicional)
    // Pero esta vez sin usar los métodos que están fallando
    try {
      // Convertimos a un array simple para evitar problemas con Signals
      const navesArray = [...this._navesSeleccionadas()];
      
      // Buscar la nave por su ID
      return navesArray.some(n => n && n.id === nave.id);
    } catch (error) {
      console.error('Error en esNaveSeleccionada:', error);
      // En caso de error, usar solo la verificación simple
      return this.naveSeleccionadaParaMover?.id === nave.id;
    }
  }
  
  // Métodos para la confirmación de movimiento
  mostrarDialogoConfirmacion(pos: {x: number, y: number}): void {
    if (this.navesSeleccionadas().length === 0) {
      console.log('No hay naves seleccionadas, no se muestra el diálogo');
      return;
    }
    
    console.log('Configurando posición seleccionada:', pos);
    this.posicionSeleccionada.set(pos);
    
    console.log('Mostrando diálogo de confirmación');
    this._mostrarConfirmacionMovimiento.set(true);
    
    // Forzar actualización de la UI
    setTimeout(() => {
      console.log('Estado del diálogo de confirmación:', this._mostrarConfirmacionMovimiento());
    }, 100);
  }
  
  // Método directo para mover unidades (mejorado para evitar problemas de clic)
  moverSeleccionDirectamente(event: MouseEvent): void {
    // Detener la propagación del evento para evitar que afecte las coordenadas
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Moviendo unidades directamente al punto seleccionado');
    if (this.posicionSeleccionada() && this.navesSeleccionadas().length > 0) {
      // Registrar claramente dónde estamos moviendo las unidades
      const destino = this.posicionSeleccionada()!;
      console.log('Destino exacto:', destino);
      
      // Mover cada nave seleccionada
      for (const nave of this.navesSeleccionadas()) {
        this.moverNaveADestino(nave, destino);
      }
    }
    
    // Ocultar el diálogo
    this._mostrarConfirmacionMovimiento.set(false);
  }
  
  // Método para cancelar el movimiento
  cancelarMovimiento(event: MouseEvent): void {
    // Detener la propagación del evento para evitar que afecte las coordenadas
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Movimiento cancelado por el usuario');
    // Simplemente ocultar el diálogo sin mover las unidades
    this._mostrarConfirmacionMovimiento.set(false);
  }
  
  // Método original (mantenido por compatibilidad)
  confirmarMovimiento(confirmado: boolean): void {
    if (confirmado && this.posicionSeleccionada()) {
      // Mover todas las naves seleccionadas
      for (const nave of this.navesSeleccionadas()) {
        this.moverNaveADestino(nave, this.posicionSeleccionada()!);
      }
    }
    
    // Ocultar el diálogo
    this._mostrarConfirmacionMovimiento.set(false);
  }
}
