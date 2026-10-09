# Laboratorio DES de peticiones

Simulador de eventos discretos de una petición web (Llegadas → Gateway → Verificación → Servicio → Respuesta).

## Archivos

| Archivo | Qué es | Cuándo se edita |
|---|---|---|
| `engine.js` | Motor DES sin interfaz: generador con semilla, distribuciones, lista de eventos, estaciones, teoría de colas | Al cambiar la lógica de simulación |
| `test.js` | Pruebas del motor contra resultados conocidos | Cada vez que se agrega lógica al motor |
| `page.src.html` | Interfaz: estilos, diagrama, paneles, controles | Al cambiar lo que se ve |
| `build.js` | Une motor e interfaz en un solo archivo | Casi nunca |
| `laboratorio-des.html` | Resultado: la página lista para abrir o publicar | Nunca a mano; lo genera `build.js` |

## Ciclo de trabajo

1. Editar `engine.js` o `page.src.html`.
2. `node test.js` — debe terminar en "Todas las pruebas pasaron".
3. `node build.js` — regenera `laboratorio-des.html`.
4. Abrir `laboratorio-des.html` con doble clic y probar en el navegador (F12 para la consola).

Node.js solo se necesita para los pasos 2 y 3. La página final no requiere instalar nada.

## Pruebas incluidas

- Media, varianza e integral de la densidad de cada distribución.
- M/M/1 con λ = 8/s y μ = 10/s: W = 500 ms, Lq = 3.2.
- D/D/1 calculado a mano.
- Tres estaciones M/M/c en serie contra Erlang C.
- M/M/1/K: probabilidad de rechazo.
- M/G/1 contra Pollaczek-Khinchine.
- Misma semilla, misma traza; el reloj nunca retrocede; conservación de peticiones.

## Plan de iteraciones

- [x] 1. Motor sin interfaz
- [x] 2. Red en serie, c servidores, cola finita con rechazo
- [x] 3. Paneles por bloque con vista previa de la densidad
- [x] 4. Animación, reloj, lista de eventos futuros, traza
- [ ] 5. Resultados: calentamiento, réplicas con intervalos de confianza, p95, histogramas
- [ ] 6. Lógica real: enrutador probabilístico, timeouts, reintentos
- [ ] 7. Editor de bloques, exportar modelo (JSON) y resultados (CSV)
