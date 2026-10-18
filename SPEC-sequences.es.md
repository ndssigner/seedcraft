[English](SPEC-sequences.md) · Español

*Esta es una traducción; si difiere de la versión inglesa, manda la inglesa.*

# Secuencias SeedCraft

**Estado: versión 0 del formato** (§3.4), tal como la implementan la
implementación de referencia, sus vectores de prueba y la herramienta web. Un
cambio futuro del formato llevaría un número de versión nuevo en la cabecera
(§3.4). Nadie independiente lo ha auditado todavía: `RISK-AUDIT.es.md` expone
las afirmaciones y sus pruebas para que cualquiera pueda comprobarlas.

**Aviso.** SeedCraft es un ejercicio de matemáticas con espíritu creativo y
artístico, y se ofrece tal cual, sin ninguna garantía. Nadie independiente lo
ha auditado todavía. Si lo usas con una semilla real, hazlo en un ordenador
desconectado y bajo tu propia responsabilidad. No respondemos de pérdidas de
fondos ni de ningún otro daño, ni del uso que cada cual haga de esta
herramienta o de este método. Mientras lo usas, que nadie vea tu pantalla:
muestra semillas y códigos QR que una cámara puede captar desde lejos.

En un ordenador conectado, usa solo semillas de prueba: la herramienta web no
puede conectarse a nada, pero el resto del ordenador sí puede ver lo que se
escribe en ella.

Una forma de guardar una semilla BIP-39 como una **secuencia de cosas
físicas** que se pueden hacer con material de manualidades, que un programa
puede volver a leer y que se pueden **reconstruir a mano** con lápiz, papel y
las plantillas de esta especificación.

- **Las cosas** pueden ser cualquier cosa, mezcladas libremente, siempre que
  haya N tipos que se distingan a simple vista y que sigan distinguiéndose:
  cuentas de colores, colgantes, ladrillos de Lego, pegatinas, sellos, marcas
  troqueladas en metal… Un tipo también puede ser una *categoría* en vez de un
  objeto concreto:
  - N = 4: los cuatro palos de una baraja (española: oros, copas, espadas,
    bastos; francesa: corazones, tréboles, picas, diamantes), o cuatro
    materiales (metal, plástico, vidrio, madera);
  - N = 8: los tipos de vía en una agenda de contactos inventados (calle,
    avenida, plaza, camino, carretera, callejón, paseo, bulevar), los colores
    de cosas de cualquier naturaleza, las figuras de una colección, los
    autores de los libros de una estantería.

  Así, una secuencia puede estar a la vista de todos, con aspecto de
  colección.
- **El soporte** es cualquier cosa que mantenga las cosas en un orden fijo
  **para siempre**, sin que ninguna se pueda soltar: un collar, una pulsera,
  un llavero, una pila de ladrillos pegados, una tira de pegatinas sobre una
  superficie, una placa grabada, cartas guardadas en orden… Los soportes
  abiertos (una pila, una tira) tienen dos extremos; los cerrados (un collar)
  marcan el principio con su cierre o con un nudo.
- **El diccionario** —los N tipos, uno de cada, en el orden de sus símbolos—
  se **guarda aparte** de la secuencia (§3.6): otra ristra pequeña (una
  pulsera a juego con el collar), una lista escrita, fotos. Sin él, la
  secuencia parece cualquier cosa menos una semilla. Pero no es una
  cerradura: ver §9.

Hay **dos modos**, para dos tipos de riesgo:

- **Sin llave** (§1–§9): la secuencia sola es la semilla. Parece cualquier
  cosa menos una semilla, así que esconde mejor que unas palabras en papel o
  en metal, pero quien conozca este método la lee en una fracción de segundo
  (§9). Para una copia guardada en un sitio que controlas, tan segura como
  las propias palabras; añade una frase de contraseña BIP-39 para una
  protección de verdad.
- **Con llave** (§10): la secuencia sin llave más una **llave (pad)** al
  azar, símbolo a símbolo. La secuencia sola, o la llave sola, **no dice
  nada** de la semilla, tenga quien la tenga el poder de cálculo y los
  conocimientos que tenga; solo las dos juntas la dan. Para sitios que no
  controlas: viajes, hoteles, inspecciones. El precio: dos cosas que guardar
  por separado, y perder cualquiera de ellas es perder la semilla. La
  versión inglesa de esta especificación lo llama *pad mode*, y a la llave
  *pad*; la herramienta web y el manual, *modo con llave* y *llave*: lo mismo
  con un nombre más llano.

Qué modo y qué forma convienen en cada situación: §11. `RISK-AUDIT.es.md`
expone de qué protege cada modo y de qué no, con las pruebas, para que
cualquiera pueda comprobarlo.

La implementación de referencia es `reference/python/seedcraft_sequences.py`,
y `seedcraft_pad.py` para el modo con llave; `vectors/sequences-v0.json` y
`vectors/sequences-pad.json` tienen vectores de prueba (solo semillas y
llaves de prueba públicas). La herramienta web (`web/`) se comprueba con los
mismos vectores (`web/test.mjs`).

## 1. La idea en un párrafo

Toma el **CompactSeedQR** de la semilla (el formato binario de SeedQR de
SeedSigner). Lee sus módulos de datos como bits, fila a fila, y añade al final
una cabecera corta. Agrupa los bits en símbolos de *k* bits, de modo que hay
N = 2ᵏ tipos de cosas. El **diccionario** dice qué cosa es qué símbolo: 0, 1,
…, N − 1. La secuencia es una cosa por símbolo. Al leerla de vuelta con el
diccionario se obtienen los módulos del código QR: se rellenan en una
plantilla en blanco, fila a fila, y se escanea, o lo hace un programa. La
propia corrección de errores del código QR repara una cosa mal leída. En el
modo con llave (§10), a cada símbolo de esa misma secuencia se le suma un
número al azar (mod N), y la persona lo vuelve a restar antes de nada.

## 2. Parámetros

| | 12 palabras | 24 palabras |
| :--- | :--- | :--- |
| Entropía | 16 bytes | 32 bytes |
| CompactSeedQR | versión 1, 21×21 | versión 2, 25×25 |
| Módulos de datos del QR (datos + corrección de errores + resto) | 208 | 359 |
| Cabecera | 5 bits | 5 bits |
| **Bits guardados** | **213** | **364** |

Cosas de la secuencia (el diccionario, guardado aparte, tiene N más):

| k | N | 12 palabras | 24 palabras |
| :---: | :---: | :---: | :---: |
| 1 | 2 | 213 | 364 |
| 2 | 4 | 107 | 182 |
| 3 | 8 | 71 | 122 |
| 4 | 16 | **54** | **91** |
| 5 | 32 | 43 | 73 |

Solo se admiten potencias de dos: cada cosa es un número entero de bits, así
que la conversión se puede hacer a mano con una tabla pequeña, sin
aritmética. N = 16 es el tamaño recomendado: secuencias cortas y un
diccionario lo bastante pequeño para hacerlo y comprobarlo con facilidad.

## 3. Codificación

1. **Entropía.** La entropía BIP-39 E (16 o 32 bytes) de la semilla.
2. **Código QR.** Codifica E como un CompactSeedQR: modo byte, nivel de
   corrección de errores L, versión 1 (16 bytes) o 2 (32 bytes), como en
   SeedSigner. El patrón de máscara M (0–7) es el que eligen las reglas de
   penalización del estándar QR (como hace el generador de códigos QR de
   Project Nayuki, que usan las implementaciones de referencia).
3. **Bits de datos, fila a fila.** Lee los módulos del código QR fila a fila,
   de arriba abajo, cada fila de izquierda a derecha, como escribe una
   persona. **Sáltate los patrones de función**: los tres patrones de
   localización con sus separadores (8×8 cada uno), las dos líneas de
   sincronización, las zonas de información de formato, el módulo oscuro y,
   en la versión 2, el patrón de alineación. Oscuro = 1, claro = 0, tal como
   están dibujados (con la máscara aplicada), para que se puedan dibujar o
   colocar de vuelta directamente.
4. **Cabecera**, después de los bits de datos, el bit más significativo
   primero:
   - versión del formato V (2 bits): 0 para esta especificación. 1 y 2 quedan
     reservados para versiones futuras; 3 significa que sigue una cabecera
     extendida (que definirá una versión futura), así que el campo nunca se
     agota;
   - patrón de máscara del QR M (3 bits): la máscara con que se dibujó el
     código QR, para que quien rellene una plantilla sepa cuál coger (su
     información de formato ya viene dibujada en ella).
5. **Símbolos.** Divide los bits de datos + la cabecera en grupos de k bits,
   el más significativo primero. Los bits que completan el último grupo son
   **al azar** (con ceros, la última cosa sería más fácil de adivinar); un
   lector los ignora.
6. **Diccionario.** N cosas distintas, en el orden de sus símbolos: la
   primera es 0, la siguiente 1, … la última N − 1. Hazlo primero, aparte de
   la semilla (§7), y guárdalo aparte. Un diccionario sirve para cualquier
   número de secuencias; secuencias distintas pueden tener diccionarios
   distintos.
7. **Secuencia física.** Una cosa por símbolo, en orden, desde el principio:
   el cierre o un nudo en un soporte cerrado, o un extremo en uno abierto.

## 4. Descodificación

1. Con el diccionario, convierte cada cosa en su símbolo, y después cada
   símbolo en k bits.
2. El número de cosas dice el tamaño (§2: por ejemplo, 54 cosas con N = 16
   son 12 palabras, 91 son 24 palabras). Los bits que siguen a los módulos de
   datos son la cabecera; los últimos, el relleno.
3. **A mano:** coge la plantilla de ese tamaño y máscara (`docs/`, §8): sus
   patrones fijos y su información de formato ya vienen dibujados; rellena
   los módulos de datos fila a fila. En vez de dibujar, los módulos se
   pueden colocar en un tablero de clavijas (los tableros de cuentas
   termoadhesivas suelen tener 29×29 clavijas) o en una base de Lego con
   piezas oscuras y claras. Escanea el resultado.
   La cabecera va después de los datos, así que la máscara solo se sabe por
   las últimas cosas de la secuencia: la cabecera (versión y máscara) está en
   las 2 últimas para N = 16 y 32, y para N = 8 con 12 palabras; en las 3
   últimas para N = 8 con 24 palabras y para N = 4; en las 5 últimas para
   N = 2 (la máscara sola está en menos: en la última para N = 32, para N = 8
   con 12 palabras y para N = 16 con 24 palabras). Para elegir la plantilla
   antes de dibujar, lee esas primero. Los
   módulos de datos están en los mismos sitios en las ocho plantillas de un
   tamaño; la máscara solo cambia la información de formato.
4. **Por software:** quita la máscara M, lee las palabras de código, corrige
   los errores y comprueba que el resultado es un CompactSeedQR (modo byte,
   16 o 32 bytes). **La cabecera no tiene corrección de errores, así que el
   programa no se fía de ella:** prueba primero la máscara que lee, después
   las otras siete (solo la buena descodifica), y trata cualquier valor de
   versión como 0 mientras no exista otra versión.

Si no está claro qué extremo es el principio (un soporte abierto, o uno
cerrado leído sin su cierre), prueba los dos sentidos: solo uno da un código
QR que descodifica.

## 5. Errores

La corrección de errores no es un objetivo del diseño: una secuencia no se
desgasta como algo impreso, y un fallo viene de hacerla o de leerla, cosa que
la persona puede comprobar y repetir. Lo que el código QR trae gratis basta:
su código Reed-Solomon (nivel L) repara hasta 3 palabras de código erróneas
en la versión 1 y 5 en la versión 2. Una cosa toca como mucho 3 (versión 1)
o 5 (versión 2) palabras de código para cualquier k, así que **una cosa mal
leída siempre se repara**. (El estándar QR permite a los lectores quedarse en
2 y 4 palabras de código, así que un móvil que escanee un código hecho a mano
puede tener menos margen.)

Una cosa de menos o de más desplaza todo lo que viene detrás: la lectura
falla, y la persona compara la secuencia con la lista, fila a fila.

## 6. Cuántas comprar de cada tipo

Las cuentas y cosas parecidas vienen en paquetes (a menudo de 5 o de 10).
Compra **el mismo número de cada tipo**, antes de elegir la semilla; una
lista con la cantidad exacta de cada tipo diría algo de la semilla, y su
orden no debería seguir el del diccionario.

La cantidad que importa es la del **tipo más usado**: una secuencia usa unos
tipos más que otros, y hay que tener cada tipo a mano en ese número. La
herramienta web da una **estimación** antes de saber la semilla: suficientes
de cada tipo para 9 semillas de cada 10 (el percentil 90 del tipo más usado,
por simulación):

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 palabras: unas, de cada tipo | 119 | 36 | 16 | **8** | 5 |
| 24 palabras: unas, de cada tipo | 198 | 57 | 24 | **12** | 7 |

Una vez sabida la semilla, da la **cantidad exacta**: lo más que se usa
cualquier tipo en esa secuencia (solo ese máximo, no tipo a tipo). Hasta una
semilla de cada diez necesita más que la estimación.

Para ir sobre seguro antes de elegir la semilla, compra suficientes para el
99,9 % de las semillas, con una de repuesto (simulado con la implementación
de referencia, `tools/pieces_tables.py`), en paquetes de 5:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 palabras: de cada tipo | 130 | 45 | 25 | **15** | 10 |
| 24 palabras: de cada tipo | 215 | 70 | 35 | **20** | 15 |

Más una de cada tipo por cada copia del diccionario (la herramienta web las
suma a sus cuentas). Con la semilla sabida, basta lo más que se usa cualquier
tipo, más uno, redondeado a un paquete (`pieces_to_buy()`; la hoja impresa de
la herramienta web lo usa). Para el modo con llave, ver §10.6.

## 7. Cómo hacer una

1. **Consigue las piezas** (§6): N tipos que se distingan a simple vista.
2. **Haz primero el diccionario**: una de cada tipo, todas distintas, en
   cualquier orden, fijas en su propio soporte. Es un trabajo sencillo que
   cualquiera puede hacer, y no es la semilla. Antes de seguir, comprueba:
   - ¿se distingue cada pieza de las demás, incluso con poca luz?
   - ¿durará lo que las distingue? La pintura se borra: el color solo puede
     no bastar; la forma, el tamaño y el material duran más;
   - ¿el orden queda fijo para siempre? Ninguna pieza puede caerse, romperse
     ni cambiar de sitio, y el soporte no puede romperse.
3. **Ponle nombre** en el programa, pieza a pieza y en orden (con fotos si
   se puede), y compáralo con el de verdad pieza a pieza. Se puede guardar
   como un archivo (nombres, o nombres y fotos) y guardarlo aparte.
4. **Haz la secuencia**, pieza a pieza, y después **vuelve a leerla** para
   comprobar que da la semilla. La herramienta web solo acepta una copia si
   al leerla de vuelta da la semilla **sin** ninguna ayuda de la corrección
   de errores del código QR (§5), y cada pieza leída coincide con la hecha,
   salvo las piezas que no guardan más que los bits de relleno al azar del
   §3.5 (una copia hecha de nuevo de la misma semilla puede diferir ahí, y
   eso no cambia la semilla). Si la secuencia se leyó desde su otro extremo,
   lo dice y ofrece dar la vuelta a la lectura. También muestra la huella de
   la semilla, para compararla con la que muestra la cartera.

Otra persona puede hacer la secuencia a partir de una hoja impresa que
muestra las piezas en orden pero no el orden del diccionario. **Eso solo es
seguro con alguien de total confianza**: la secuencia sola es la semilla para
quien conozca este método (§9).

En el modo con llave, haz primero la llave, después la secuencia, y
compruébalas juntas antes de guardarlas por separado (§10.4).

## 8. Tablas y plantillas

`docs/seedcraft-by-hand-es.pdf` (y `-en`) las tiene, generadas a partir de la
implementación de referencia por `tools/gen_manual_data.py`:

- símbolo → bits para k = 1…5;
- la información de formato del nivel L para las máscaras 0–7, dibujada;
- una plantilla para cada tamaño (21×21, 25×25) y máscara, con todos los
  patrones de función, incluida la información de formato, ya dibujados, y
  el número de módulos de datos de cada fila (para comprobar cada fila al
  rellenarla);
- una hoja de trabajo y un ejemplo resuelto.

Para el modo con llave (§10), su capítulo «Con llave» tiene: la regla de los
dados del §10.2, tablas de sumar mod N para N = 2…32 (leídas al revés para
restar, §10.3), el archivo de la llave y cómo sacar su carácter de control
(§10.9), un ejemplo resuelto y una hoja de trabajo con una columna para la
llave.

## 9. Consideraciones de seguridad

Esta sección trata del modo sin llave; para el modo con llave, ver §10.
`RISK-AUDIT.es.md` trata los dos en detalle.

- **Quien tenga la secuencia y conozca este método tiene la semilla**, como
  con una copia en papel o un SeedQR, incluso sin el diccionario. Guárdala
  tan bien como una de esas. Para una protección de verdad, usa una **frase
  de contraseña BIP-39**, guardada en otro sitio.
- **El diccionario no es una llave.** Guardarlo aparte esconde que la
  secuencia sea siquiera una semilla: sin él, es un collar o una colección, y
  quien no conozca este método no ve nada en ella. Pero quien lo conozca
  puede reconstruir el diccionario. El CompactSeedQR tiene partes que se
  saben de antemano (el modo byte, la longitud, el terminador, el byte de
  relleno de los códigos de 12 palabras, la versión de la cabecera) y su
  paridad Reed-Solomon es un conjunto de ecuaciones lineales en los propios
  bits de las cosas desconocidas: resueltas juntas, dan el diccionario.
  `tools/dictionary_attack.py` lo hace:

  | N | Órdenes del diccionario (N!) | Intentos, conociendo este método |
  | :---: | :--- | :--- |
  | 2 | 2 | ≤ 8, al instante |
  | 4 | 24 | ≤ 8, al instante |
  | 8 | 40 320 ≈ 2¹⁵ | ≤ 8, al instante |
  | 16 | 2.1 × 10¹³ ≈ 2⁴⁴ | **≤ 8: unas centésimas de segundo** |
  | 32 | 2.6 × 10³⁵ ≈ 2¹¹⁸ | Depende de la semilla: la mitad de las semillas, por debajo de 2³⁸ (12 palabras) o 2⁴⁷ (24 palabras); una de cada cien, por encima de 2⁵⁸ o 2⁶². Cada intento lleva microsegundos: la mitad de las semillas está al alcance de unas pocas GPU |

  Para N ≤ 16 vale lo mismo para 12 y 24 palabras. N! es a lo que se
  enfrenta quien no sabe nada del código QR que hay dentro; la columna de la
  derecha, a lo que se enfrenta quien conoce esta especificación.
- **Codifica una semilla real solo en un aparato desconectado**: un aparato
  aislado (p. ej. NDS-Signer), o la herramienta web en un ordenador con la
  red desconectada (Wi-Fi apagado, modo avión, cable fuera), bajo tu
  responsabilidad (ver el aviso de arriba). La herramienta web no puede
  conectarse a nada, pero el resto de un ordenador conectado sí puede ver lo
  que se escribe en ella. En un ordenador conectado, usa solo semillas de
  prueba. **Cuidado con la pantalla**: muestra la semilla y el código QR, y
  una cámara puede captarlos desde lejos.
- **Duración**: los colores se borran y se confunden con poca luz; los hilos
  se rompen; el pegamento cede. Elige cosas que se diferencien en la forma, el
  tamaño o el material además del color, y un soporte que dure.


## 10. Modo con llave

### 10.1 La idea

En el modo sin llave, la secuencia misma es la semilla. En el modo con llave
no: a cada número de la secuencia sin llave se le suma un número al azar, y
lo que se hace como secuencia de cosas son los resultados. Esos números al
azar, uno por cosa, son la **llave**, y se guardan en otro sitio: como una
segunda ristra de cosas, o escritos en un archivo.

**La secuencia sola no sirve de nada**: sin la llave podría ser cualquier
semilla, incluso para quien conozca este método y tenga todos los ordenadores
del mundo. **La llave sola tampoco sirve de nada.** Juntas dan la semilla.

Para leerla de vuelta, resta la llave de la secuencia, número a número. Lo
que queda es una secuencia sin llave, que se lee como en el §4.

Esto vale mientras la llave sea puro azar, se mantenga en secreto y se use
para una sola semilla: `RISK-AUDIT.es.md` tiene la demostración, y lo que pasa
cuando falla alguna de esas condiciones.

(Esta llave no tiene nada que ver con los bytes de relleno del código QR del
§9.)

### 10.2 Cómo hacer la llave

La llave tiene tantos números como cosas tiene la secuencia (§2: 54 para 12
palabras con N = 16, 91 para 24 palabras), cada uno del 0 al N − 1. Su
seguridad descansa en una sola cosa: **cada número tiene que ser puro azar**,
con todos los valores igual de probables.

- O la saca el **aparato que codifica** (NDS-Signer, o la herramienta web con
  el generador criptográfico del navegador), o la haces **a mano**, número a
  número, con cualquiera de estos:
  - **una bolsa** con una pieza de cada tipo: saca una sin mirar, apúntala,
    **devuélvela** y agita la bolsa. Si las piezas no se devuelven, no es
    azar. Solo es justa si todas las piezas tienen la misma forma, tamaño y
    peso: si no, unas salen más que otras, y conviene usar dados. (La
    herramienta web solo ofrece la bolsa para una llave guardada como ristra
    de piezas.)
  - **monedas**: un lanzamiento por bit, cara 1 y cruz 0; k lanzamientos por
    número (4 para N = 16), que se leen como en la tabla del §8;
  - **un dado**, de cualquier tipo común (d4, d6, d8, d10, d12, d16, d20).
    Numera sus caras desde 0 (en un dado marcado del 1 al s, resta 1; un d10
    marcado 0–9 ya lo está). Cada tiro da b bits, con b el mayor tal que
    2^b ≤ s: quédate con una cara por debajo de 2^b, escrita como b bits, y
    **vuelve a tirar** con cualquier otra. Junta los bits, el primer tiro
    primero, hasta tener k; si el último tiro da más de los que hacen falta,
    quédate con sus primeros. Con N = 16 y un d6: las caras 0–3 dan 2 bits,
    con 4 y 5 se vuelve a tirar; dos tiros por número. Un dado de N caras da
    un número en un tiro. Con N = 16:

    | Dado | b | Se vuelve a tirar (caras 0…s − 1) | Tiros por número |
    | :--- | :---: | :--- | :--- |
    | moneda | 1 | — | 4 |
    | d4 | 2 | — | 2 |
    | d6 | 2 | 4, 5 | 2 |
    | d8 | 3 | — | 2 (1 bit del segundo) |
    | d10 | 3 | 8, 9 | 2 (1 bit del segundo) |
    | d12 | 3 | 8–11 | 2 (1 bit del segundo) |
    | d16 | 4 | — | 1 |
    | d20 | 4 | 16–19 | 1 |
- Se pueden juntar las dos: una llave hecha a mano sumada a la del aparato,
  número a número, como en el §10.3, es segura con que lo sea cualquiera de
  las dos.
- **Nunca** números elegidos por una persona, ni sacados de la semilla, de
  una contraseña, de una fecha o de cualquier otra cosa.
- **Una llave para una semilla** (§10.8).

### 10.3 Sumar y restar

- **Para hacer la secuencia**: para cada cosa, el número de la secuencia sin
  llave más el número de la llave. Si el resultado es N o más, resta N.
- **Para leerla de vuelta**: el número de la secuencia menos el número de la
  llave. Si el resultado es menor que 0, suma N.

Con N = 16: 9 + 12 = 21, que da 21 − 16 = **5**. De vuelta: 5 − 12 = −7,
que da −7 + 16 = **9**. Una tabla de sumar mod N lo hace sin aritmética
(§8). La herramienta web muestra la misma suma bajo su reloj:
(9 + 12) mod 16 = 5 al hacer, (5 − 12) mod 16 = 9 al recuperar.

### 10.4 Cómo hacer una

1. Consigue las piezas (§10.6) y haz el diccionario (§7).
2. Haz la llave (§10.2), como ristra o como archivo.
3. Haz la secuencia pieza a pieza, como diga el programa.
4. Vuelve a leer las dos con el programa y comprueba que dan la semilla
   (§7, paso 4: las mismas reglas, para las dos ristras). Lee cada una desde
   su primera pieza, para que cada cosa caiga con su número de la llave; la
   herramienta web aun así se da cuenta de una ristra leída desde su otro
   extremo, o de las dos ristras cambiadas.
5. Guárdalas por separado (§10.8), cada una con una copia del diccionario.

Otra persona puede hacerte la secuencia a partir de la hoja impresa (§7): en
este modo no se entera de nada, mientras nunca vea la llave.

### 10.5 Cómo leer una

1. Lee la secuencia con el diccionario, número a número, y la llave, desde su
   ristra o desde su archivo.
2. Resta (§10.3).
3. Sigue como con una secuencia sin llave (§4). A mano, la máscara para la
   plantilla está en los últimos números (§4.3): resta esos primero.

El programa encuentra el principio de cada una, y se da cuenta de si las dos
ristras se han cambiado. A mano tienes que saberlo: **marca el principio de
cada una, y cuál es cuál** (un cierre, un colgante en la secuencia y ninguno
en la llave, una etiqueta).

Una cosa mal leída o un número equivocado en la llave se reparan, como en el
modo sin llave (§5).

### 10.6 La llave como ristra de cosas

La llave puede ser una segunda ristra, hecha como la primera, con el mismo
diccionario. Las dos se parecen: dos ristras de cuentas sin ningún orden
particular, y ninguna dice cuál es cuál.

El diccionario sigue sin ser un secreto, pero las dos ristras lo necesitan
para leerse: **guarda una copia con cada una**. Sin él, ninguna se puede leer
a mano. Puede ir al principio de la ristra de la llave (una de cada tipo, y
después la llave), lo que ahorra un tercer objeto; pero N piezas distintas
seguidas son un patrón poco habitual, que señala la ristra como algo (no la
semilla).

**Cuántas comprar.** Para las dos ristras con los mismos tipos de piezas, la
estimación de la herramienta web (§6) cuenta las dos ristras juntas:
suficientes para 9 llaves de cada 10, antes de saber la semilla y la llave,
y después la cantidad exacta:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 palabras: unas, de cada tipo, las dos ristras | 230 | 66 | 27 | **14** | 8 |
| 24 palabras: unas, de cada tipo, las dos ristras | 386 | 107 | 43 | **20** | 11 |

Para ir sobre seguro de antemano, suficientes para el 99,9 % de las llaves
con una de repuesto, en paquetes de 5:

| N | 2 | 4 | 8 | 16 | 32 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| 12 palabras: de cada tipo, las dos ristras | 250 | 80 | 35 | **20** | 15 |
| 24 palabras: de cada tipo, las dos ristras | 410 | 125 | 55 | **30** | 20 |

Más una de cada tipo por cada copia del diccionario. Para una ristra sola (una
llave guardada como archivo, o una llave en una colección propia, §11.4),
valen las tablas del §6 (salvo N = 2 y 12 palabras: 135 para ir sobre
seguro).

### 10.7 La llave como archivo

Un archivo de texto que una persona puede leer y que la herramienta web puede
abrir:

    54 16
    3A37 DFE7 0239 3E0F 6
    A6C8 BBC2 A299 E490 2
    BBED 2CF3 DFC8 DF07 2
    413D F4 5

(Solo un ejemplo. **No uses nunca una llave sacada de un documento.**)

- **Primera línea**: cuántos números hay, y N.
- **Después, la llave**: 16 números por fila, en grupos de 4, cada uno
  escrito como un carácter: del `0` al `9`, después `A` para 10, `B` para 11,
  y así sucesivamente (hasta `V` para 31).
- **El último carácter de cada fila es un control.** Si un número se copia
  mal, el control de su fila deja de cuadrar, y el programa dice qué fila es.
  Sale de la llave sola y no dice nada de la semilla.
- **El archivo no dice qué es.** Un archivo llamado «semilla» en un móvil que
  registran se delata solo (la herramienta web lo guarda como `numbers.txt`).
  Las líneas que empiezan por `#` son notas, si quieres poner alguna.
- **Su propio diccionario.** En el archivo, cada número es un carácter: ese
  es el diccionario del archivo (número → carácter), fijo e igual para todos,
  así que un archivo de llave no necesita diccionario de piezas.

**Cómo guardarlo, enviarlo o cifrarlo es cosa tuya.** Por sí solo es inofensivo;
pero una copia que acabe cerca de la secuencia, o al alcance de quien la
tenga, es la semilla. `RISK-AUDIT.es.md` repasa los casos.

### 10.8 Reglas

1. **Una llave, una semilla.** Una llave usada para dos semillas delata cada
   una en cuanto se sabe la otra. Las copias de una misma secuencia pueden
   compartir su llave.
2. **Nunca juntas**: ni en el mismo sitio, ni en el mismo aparato, ni en la
   misma cuenta en la nube, ni en el mismo viaje.
3. **Perder cualquiera es perder la semilla**, para siempre. Guarda copias de
   cada una si las necesitas, cada copia tan lejos de la otra mitad como el
   original.
4. **Cada una con su diccionario**: la secuencia con su diccionario, la llave
   con el suyo si lo tiene (§11.4). Si las dos usan el mismo, una copia con
   cada una.
5. **Comprueba las dos juntas antes de guardarlas por separado.**
6. Una llave para una semilla real se hace como la secuencia: en un aparato
   desconectado, o a mano, y sin que nadie vea la pantalla (§9).

### 10.9 Para implementadores

- **Codificación.** P: los símbolos de la secuencia sin llave (§3, todos:
  datos, cabecera con versión 0, bits de relleno). K: la llave, L símbolos de
  un generador criptográfico de números aleatorios, o hecha a mano (§10.2),
  o las dos sumadas mod N. C[i] = (P[i] + K[i]) mod N. Descodificación: P[i] = (C[i] −
  K[i]) mod N.
- **El programa que descodifica** prueba C y C al revés frente a K, y los dos
  papeles (C − K y K − C), y descodifica cada resultado como en el §4, en los
  dos sentidos; solo el bueno descodifica.
- **Archivo de la llave.** ASCII, líneas acabadas en LF o CRLF. Se ignoran
  las líneas vacías y todo lo que va de `#` al final de una línea. Primera
  línea: L y N en decimal. Después, filas de 16 símbolos (la última con el
  resto), un carácter cada uno, `0`–`9` `A`–`V`, sin distinguir mayúsculas
  de minúsculas; se ignoran los espacios entre grupos. El último grupo de una
  fila es su carácter de control.
- **Carácter de control** (Luhn mod N): desde el último símbolo de la fila
  hacia la izquierda, pesos 2, 1, 2, 1… El doble de d da 2d si 2d < N, y si
  no 2d − N + 1. El control es (N − (suma mod N)) mod N. Detecta todo símbolo
  suelto equivocado y todo intercambio de dos vecinos salvo 0 y N − 1; para
  N = 2 es un bit de paridad y no detecta intercambios.
- **Piezas que comprar**: simuladas sobre 100 000 llaves al azar por
  entrada (`tools/pieces_tables.py`).

## 11. Elegir modo y forma

Lo deciden dos preguntas:

1. **¿Quién podría encontrarla, y sabría qué buscar?**
2. **¿Qué dolería más: que alguien la encontrara, o perderla tú?**

### 11.1 Qué modo

| Dónde está, quién puede llegar a ella | Modo |
| :--- | :--- |
| En casa o en un sitio que controlas, entre cosas que pintan algo allí: un libro en una estantería, una caja de pegatinas, un joyero | **Sin llave**. Como una copia en papel, pero mucho mejor escondida. Una frase de contraseña BIP-39 si los fondos importan |
| Contigo, o donde otros revisan tus cosas: viajes, hoteles, un piso compartido, una inspección | **Con llave**, con la otra mitad en otro sitio, nunca en el mismo viaje |
| Te preocupa más perderla que que te la roben: una sola copia, mucho tiempo, herederos | **Sin llave** con copias, y una frase de contraseña. El modo con llave duplica lo que se puede perder |
| Cantidades grandes | **Con llave**, o una frase de contraseña, o las dos. SeedCraft también puede guardar una de las claves de una cartera multifirma |

El modo sin llave basta **mientras nadie que conozca este método tenga un
motivo para mirar esa cosa**. Su fuerza es que nadie mira: cuanto mejor el
disfraz, más vale. En cuanto alguien sospecha, es la semilla (§9). El modo
con llave no depende de eso.

### 11.2 Qué forma

Una buena forma es la que **pinta algo donde se guarda**, **mantiene su orden
para siempre** y tiene tipos que **no se pueden confundir**. Longitudes para
12 palabras (24 palabras entre paréntesis), las mismas en los dos modos (§2):

| Forma | N | Cosas | Pasa desapercibida | Mantiene su orden | Notas |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **Agenda de direcciones**, el tipo de vía de cada entrada | 8 | 71 (122) | Muy bien, en una estantería o en un cajón | Sí, si está escrita a mano y nunca se reescribe | Ver §11.3 |
| **Álbum o tira de pegatinas** | 8–16 | 71–54 (122–91) | Muy bien, entre cosas de niños | Sí, si están pegadas | Se destiñe al sol |
| **Álbum de fotos**, el tema de cada foto | 8 | 71 (122) | Perfectamente, en una estantería | Sí, si están impresas y pegadas o en fundas fijas; **no** en un móvil o en la nube, donde las fotos se reordenan | Un tema evidente por foto, de tipos que nunca se solapen (un perro en un coche no es ni lo uno ni lo otro). Quien salga en las fotos queda implicado si alguna vez se examina el álbum (§11.3) |
| **Collar o pulsera** de cuentas | 16 | 54 (91) | Bien, y se puede llevar puesto | Sí, en alambre o cordón resistente, con un cierre que marque el principio | Los hilos se rompen: revísalo de vez en cuando |
| **Piedras preciosas**, en una pulsera de varias vueltas o en una caja con compartimentos | 8–16 | 71–54 | Bien, como colección o joya | Solo si están ensartadas o pegadas | Las piedras naturales varían de color: elige tipos que se diferencien en algo más que el color |
| **Ladrillos de Lego pegados** | 8–16 | 71–54 | Como juguete | Sí | Muy duradero |
| **Libros en una estantería**, por autor | 8 | 71 (122) | Perfectamente | **No**: cualquiera que ordene la estantería la destruye | No para la única copia |
| **Naipes**, por palo | 4 | 107 (182): cuatro barajas (seis), porque un palo puede salir muchas más veces que los otros (§6) | Perfectamente | **No**: una partida la destruye | No para la única copia |

### 11.3 La agenda de direcciones

Una agenda de direcciones es quizá el mejor disfraz: está hecha para estar
llena de entradas, para pasar años en una estantería y para no interesarle a
nadie.

- **Los tipos** son los tipos de vía (con N = 8: avenida, bulevar, calle,
  camino, carretera, paseo, plaza, ronda; los de la herramienta web). Cada entrada tiene exactamente
  uno, escrito entero.
- **El diccionario** puede ser simplemente un **orden fijo y convencional**,
  como el orden alfabético de los tipos de vía de arriba. No es un secreto en
  ningún modo (§9, §10.6), así que no hace falta guardarlo en ningún sitio, y
  no se puede perder. Apunta qué orden usaste, donde guardes tus notas sobre
  la copia.
- **El orden de las entradas** es el orden de lectura. En una agenda escrita
  a mano con pestañas de la A a la Z, lee la pestaña A desde arriba, luego la
  B, y así sucesivamente: pon a cada entrada un nombre con la inicial adecuada
  para colocarla donde tiene que ir.
- **Nunca añadas, quites ni reescribas una entrada** en medio. Una agenda que
  nunca se actualiza ya es un poco rara de por sí: guárdala como una vieja,
  recogida.
- **Con apariencia de real, mejor que real.** Tiendas, restaurantes, oficinas
  y otros sitios públicos de una ciudad real dan entradas creíbles, que se
  pueden comprobar en un mapa y que ponen los tipos de vía que hacen falta
  donde hacen falta. Las direcciones particulares de personas reales las
  implicarían, si alguna vez se examinara la agenda.

### 11.4 Dos colecciones en el modo con llave

En el modo con llave, las dos mitades pueden ser **dos colecciones
distintas**, cada una en el sitio donde pinta algo: una agenda de direcciones
en una estantería de casa y un collar con el que viajas, por ejemplo.

- **El mismo N y el mismo número de cosas en las dos** (§2): una agenda con
  N = 8 va con un collar de 8 tipos de cuentas, 71 cosas cada una para 12
  palabras (71 cuentas de 6 mm dan unos 43 cm).
- **Cada mitad con su diccionario**: el orden convencional del §11.3 para la
  agenda, una ristra pequeña a juego o una lista para el collar. Ninguno es
  un secreto.
- **Decide una vez cuál es la llave**, y apúntalo con los diccionarios. Dos
  colecciones distintas son difíciles de cambiar por error, y el programa
  prueba los dos papeles de todos modos (§10.5).
- **Nunca juntas**: el collar no viaja con la agenda, ni con una foto de
  ella (§10.8).

### 11.5 Qué no hacer

Hay tantas formas como colecciones, y la imaginación es bienvenida. Pero
algunas ideas parecen ingeniosas y no lo son:

- **Una llave sacada de algo que ya existe.** Un libro, un poema, una
  canción, una fecha, un número de teléfono, un dibujo que te guste, una
  contraseña, un trozo de la semilla: cualquiera de estos se puede adivinar,
  y cada intento se comprueba en un instante (`RISK-AUDIT.es.md` §4.6). Una
  llave es puro azar, nada más (§10.2).
- **Mejoras de tu cosecha**: una mezcla extra, un orden secreto, un cifrado
  tuyo por encima. No añaden nada que la llave no dé ya, y son la razón más
  probable de que la semilla no se pueda volver a leer más adelante, ni por
  ti, ni por el programa, ni por tus herederos.
- **Contar con un diccionario secreto.** En el modo sin llave esconde qué es
  la secuencia, pero no es una cerradura (§9).
- **Cosas que pueden cambiar de orden**: cosas sueltas (libros, cartas,
  piedras en una bolsa), cosas que otros usan u ordenan, cosas que se
  mantienen al día. No para la única copia.
- **Tipos que se pueden confundir**, ahora o dentro de veinte años: tonos
  parecidos, colores que se borran, variación natural, cualquier cosa que
  dependa de la luz.
- **Añadir o quitar cosas para disfrazarla.** Una secuencia tiene
  exactamente el número de cosas del §2; una más o una menos y no se lee.
  (Las piezas decorativas que un lector se salta son una cuestión abierta:
  §12.)
- **Algo que solo tú sabes leer**: una forma inventada por ti, notas en un
  código tuyo, una app o un móvil que puede no estar mañana.
- **Algo raro donde se guarda**: un collar en una caja de herramientas, un
  álbum de pegatinas infantil en una casa sin niños.
- **Las dos mitades juntas**, aunque sea como fotos en el mismo móvil
  (§10.8).
- **No dejar rastro para tus herederos.** Necesitan saber que esa cosa es una
  copia de seguridad, dónde está la otra mitad y dónde encontrar esta
  especificación.

En caso de duda, tres preguntas: **¿mantendrá su orden para siempre? ¿Podría
otra persona distinguir cada tipo, con poca luz, dentro de veinte años? ¿Le
parecería raro a alguien donde está?**

## 12. Cuestiones abiertas

- Una auditoría independiente del método, la implementación de referencia y
  la herramienta web.
- Más vectores de prueba (otras máscaras).
- Piezas decorativas libres fuera del diccionario, para romper la firma de
  una longitud fija y N tipos (`RISK-AUDIT.es.md` §5).
- Instrucciones ilustradas con cuentas de verdad.
