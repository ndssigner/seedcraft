[English](RISK-AUDIT.md) · Español

*Esta es una traducción; si difiere de la versión inglesa, manda la inglesa.*

# Secuencias SeedCraft: auditoría de riesgos

De qué protege cada modo de [SPEC-sequences.es.md](SPEC-sequences.es.md), de
qué no, y las pruebas de cada afirmación, para que cualquiera pueda
comprobarlo en vez de fiarse. Cubre la versión 0 del formato de la
especificación. **Nadie independiente lo ha auditado todavía**: este
documento está escrito para que alguien pueda hacerlo.

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

**Estado de las pruebas.** Cada afirmación de abajo remite a su prueba (§6),
en el repositorio: tests y herramientas que cualquiera puede ejecutar, y que
se ejecutan en la CI. El modo con llave (la versión inglesa de la
especificación lo llama *pad mode*, y a la llave *pad*) está en la
implementación de referencia (`seedcraft_pad.py`), sus vectores de prueba y
la herramienta web (`web/test.mjs` la comprueba con los mismos vectores), y a
mano en `docs/seedcraft-by-hand-es.pdf` (y `-en`).

## 1. Alcance y supuestos

- **El método es público.** Esta especificación, su código y este documento
  están publicados. Nada aquí depende de que un atacante no sepa cómo
  funciona SeedCraft.
- **Lo que se protege**: una semilla BIP-39 de 12 o 24 palabras, guardada
  como una secuencia de cosas (SPEC §1–§9, el *modo sin llave*) o como una
  secuencia de cosas más una llave al azar (SPEC §10, el *modo con llave*).
- **La semilla se codifica en un aparato de confianza y desconectado**: un
  aparato aislado, o la herramienta web en un ordenador con la red
  desconectada. Un aparato que ve la semilla mientras la codifica puede
  filtrarla: ningún modo puede ayudar contra eso (§3, A5). La herramienta web
  no puede conectarse a nada, pero el resto de un ordenador conectado
  (malware, extensiones del navegador, la sincronización, las copias de
  seguridad) puede ver lo que se escribe en ella: en un ordenador conectado,
  solo semillas de prueba.
- **«No dice nada»** en este documento se entiende en el sentido de la teoría
  de la información: quien tenga ese objeto, sean cuales sean su poder de
  cálculo y sus conocimientos, ve todas las semillas igual de probables que
  antes (§4.1).

## 2. Activos

| Activo | Modo sin llave | Modo con llave |
| :--- | :--- | :--- |
| La secuencia | **es la semilla**, para quien conozca el método | no dice nada por sí sola |
| La llave (una ristra o un archivo de texto) | — | no dice nada por sí sola |
| El diccionario | no es un secreto; esconde qué es la secuencia | no es un secreto; hace falta para leer cualquiera de las dos ristras (un archivo de llave tiene su propio diccionario fijo, número → carácter) |
| Una frase de contraseña BIP-39, si se usa | la única protección de verdad de los fondos | un tercer factor, frente a quien consiga las dos mitades |
| El aparato que codifica | ve la semilla | ve la semilla y la llave |

## 3. Adversarios y resultados

| | Adversario | Modo sin llave | Modo con llave |
| :--- | :--- | :--- | :--- |
| A1 | **La encuentra por casualidad**, no conoce el método | Ve una joya, una colección | Lo mismo |
| A2 | **Conoce el método y tiene la secuencia** (una inspección, el personal de un hotel, un ladrón) | **Lee la semilla** en menos de un segundo, sin el diccionario (§4.2) | **No se entera de nada**, y ni siquiera puede saber que es una semilla (§4.1, §5) |
| A3 | **Coacciona a quien la lleva** | No necesita a quien la lleva: ver A2. Con una frase de contraseña, quien la lleva puede dar una de señuelo | Quien la lleva **no puede** abrirla sin la llave, que está en otro sitio. La coacción se traslada a donde está la llave; no impide que retengan a quien lleva la secuencia |
| A4 | **Llega a copias digitales** (la nube, el correo, un móvil registrado) | Una foto de la secuencia es la semilla | El archivo de la llave solo no dice nada. **El archivo de la llave y la secuencia al alcance del mismo adversario son la semilla**, p. ej. el archivo en el móvil de quien lleva la pulsera en una frontera (§4.4) |
| A5 | **Controla el aparato que codifica** | Tiene la semilla | Tiene la semilla. Fuera de alcance: usa un aparato desconectado |
| A6 | **El tiempo y los accidentes** (pérdida, incendio, deterioro, un hilo roto) | Una cosa que guardar (y el diccionario) | Dos cosas que guardar por separado, y el diccionario; **perder cualquiera de las dos mitades es perder la semilla** (§4.5) |
| A7 | **Consigue las dos mitades** (un sitio donde acaban las dos, o dos robos) | — | Tiene la semilla. Solo una frase de contraseña protege aún los fondos |
| A8 | **Te hace la secuencia** a partir de una hoja impresa (SPEC §7) | Tiene la semilla | Solo ve C: no se entera de nada, mientras nunca vea la llave |
| A9 | **Ve la pantalla mientras se hace o se lee la copia** (alguien cerca, una cámara desde lejos) | Tiene la semilla: la pantalla muestra las palabras y el código QR | Tiene la semilla: al hacer o leer una copia, la pantalla muestra las palabras y el código QR también en este modo. Que nadie vea la pantalla |

## 4. Afirmaciones

### 4.1 Modo con llave: una mitad no dice nada

Sea $P \in \mathbb{Z}_N^L$ la secuencia sin llave de la semilla ($L$
símbolos, cada uno de $0$ a $N - 1$), con cualquier distribución: tiene una
estructura conocida (las partes fijas del código QR, su paridad
Reed-Solomon), y eso no importa. Sea $K$ uniforme en $\mathbb{Z}_N^L$ e
independiente de $P$, y sea $C = P + K$, símbolo a símbolo, mod $N$.
Entonces, para todo $c$ y $p$:

$$\Pr[C = c \mid P = p] = \Pr[K = c - p] = N^{-L}$$

que no depende de $p$. Así que $\Pr[C = c] = N^{-L}$ y

$$\Pr[P = p \mid C = c] = \frac{\Pr[C = c \mid P = p]\,\Pr[P = p]}{\Pr[C = c]} = \Pr[P = p]$$

es decir, $C$ y $P$ son independientes: $I(P; C) = 0$. Cualquier función
$f(C)$ (las cosas, leídas con cualquier diccionario) es también
independiente de $P$. $K$ sola es independiente de $P$ por construcción.

Esto vale **solo si**:

1. $K$ es uniforme: cada símbolo igual de probable, independiente de los
   demás;
2. $K$ es independiente de la semilla y de cualquier cosa que tenga el
   adversario;
3. $K$ se usa para una sola semilla (§4.3);
4. el adversario no tiene, ni consigue más tarde, a la vez $C$ y $K$ (o
   bastante de cada una, §4.4).

No depende del poder de cálculo del adversario, de que el diccionario sea
secreto ni de que el método sea desconocido.

Pruebas: E2, E4 (§6).

### 4.2 Modo sin llave: basta con conocer el método

El diccionario de una secuencia sin llave no es una llave. Para 12 palabras,
el CompactSeedQR tiene 24 bits que se saben de antemano (modo byte,
longitud, terminador, byte de relleno 0xEC), su paridad Reed-Solomon da 56
ecuaciones lineales sobre $\mathrm{GF}(2)$ en esos mismos bits, y la
cabecera 5 más. Con $N = 16$ eso son $24 + 56 + 5 = 85$ ecuaciones con
$16 \times 4 = 64$ incógnitas (4 bits por tipo). Para 24 palabras no hay
byte de relleno, pero sí más paridad: $16 + 80 + 5 = 101$ ecuaciones con
las mismas 64 incógnitas. Resolverlas da el diccionario, y probar las 8
máscaras hace el resto. `tools/dictionary_attack.py` lo hace en centésimas
de segundo, para 12 y 24 palabras y todo $N \le 16$.

Para $N = 32$ hay hasta $32 \times 5 = 160$ incógnitas, más que ecuaciones,
y cuántos candidatos quedan depende de la semilla (de cuántos de los 32
tipos use). Sobre 300 semillas al azar, la mediana es $2^{38}$ para 12
palabras y $2^{47}$ para 24; una semilla de cada cien deja más de $2^{58}$ y
$2^{62}$. Cada candidato se comprueba en microsegundos, sin PBKDF2 (§4.6):
la mitad de las semillas está al alcance de unas pocas GPU, y $N = 32$
tampoco es una cerradura.

Así que **una secuencia sin llave es la semilla** para quien la tenga y
conozca este método, como lo son unas palabras en papel. Es un escondite
mejor, no una cerradura. Su protección es una frase de contraseña BIP-39:

| Frase de contraseña | Bits | Todo el espacio, 1 GPU | Todo el espacio, 1 000 GPU |
| :--- | ---: | ---: | ---: |
| 8 caracteres al azar (a–z, A–Z, 0–9) | 47.6 | ~7 años | ~2.5 días |
| 4 palabras Diceware | 51.7 | ~116 años | ~42 días |
| 12 caracteres al azar | 71.5 | $\sim 10^8$ años | $\sim 10^5$ años |
| 6 palabras Diceware | 77.5 | $\sim 7 \times 10^9$ años | $\sim 7 \times 10^6$ años |

Bits: $b = n \log_2 62$ para $n$ caracteres al azar, $b = n \log_2 7776$
para $n$ palabras Diceware. Tiempo para probarlas todas, con $G$ GPU a $r$
candidatos por segundo cada una:

$$t = \frac{2^{b}}{r \, G}$$

y la mitad de eso de media. **Velocidad supuesta: $r = 10^6$ candidatos por
segundo por GPU**, una estimación por lo alto: cada candidato cuesta un
PBKDF2-HMAC-SHA512 con 2048 iteraciones ($\approx 4096$ compresiones de
SHA-512), y una GPU de gama alta hace del orden de $10^9$ a $10^{10}$ de
esas por segundo; la derivación de claves y la comprobación de direcciones
que vienen después se ignoran, a favor del atacante. Pon tu propia
velocidad.

Pruebas: E1.

### 4.3 Modo con llave: una llave usada dos veces

Dos semillas con la misma llave dan

$$C_1 - C_2 \equiv (P_1 + K) - (P_2 + K) \equiv P_1 - P_2 \pmod{N}$$

símbolo a símbolo. Si alguna vez se sabe
una semilla, la otra sale al momento. Si no se sabe ninguna, la diferencia
de dos secuencias con estructura sigue filtrando mucho, y **no** hemos
cuantificado cuánto: da las dos por perdidas. Las copias de una semilla
pueden compartir llave (sus secuencias son entonces idénticas) o tener cada
una la suya; esto es seguro.

Pruebas: E5.

### 4.4 Modo con llave: copias parciales y digitales

- **Una copia parcial cuenta como una completa.** Parte de $C$ con toda $K$
  da esa parte de $P$; la corrección de errores del código QR puede
  completar entonces hasta 7 palabras de código que falten (12 palabras; 10
  para 24 palabras), y sus partes fijas ayudan más aún. Trata una foto de
  parte de la secuencia, o un archivo de llave al que le falten unas filas,
  como el todo.
- **Una llave digital es inofensiva sola, pero dura.** El correo, la
  sincronización en la nube, las copias de seguridad y los servidores de
  mensajería guardan copias durante años, fuera del control del usuario,
  mientras los fondos sigan en esa semilla. Un adversario que consiga ahora
  una de esas copias solo necesita ver la secuencia una vez, más adelante.
  Cómo se guarda, se envía y se cifra el archivo es cosa del usuario (SPEC
  §10.7); las reglas seguras son: nunca al alcance de ningún aparato que
  viaje con la secuencia; mejor enviado a otra persona, o a un
  almacenamiento en el destino, que a uno mismo; cifrado con una contraseña;
  y, después de un viaje, una llave nueva hecha en el destino.

### 4.5 Modo con llave: perder una mitad

Perder la secuencia o la llave es perder la semilla, sin vuelta atrás.
Perder todas las copias del diccionario, con las dos mitades aún ahí, no es
del todo definitivo: los $N!$ órdenes ($16! \approx 2^{44}$) se pueden probar
con un ordenador, con el código QR como comprobación instantánea de cada uno,
lo que está al alcance de una GPU. Pero eso es
un rescate, no un plan. Las copias reducen estos riesgos; cada copia tiene
que estar tan lejos de la otra mitad como el original.
Un esquema 2 de 3 (dos partes cualesquiera de tres dan la semilla) es
posible solo con sumas, al doble de longitud, y no está en la
especificación (§8).

### 4.6 Modo con llave: una llave débil

Una llave que no es uniforme (elegida por una persona, de una fuente
predecible, de un dado trucado o leído sin cuidado, o sacada de una bolsa
sin devolver las piezas) rompe el §4.1. Y lo rompe a lo grande: **la
secuencia sin llave que hay debajo es su propia comprobación perfecta** (un
intento equivocado de llave da un código QR que no descodifica, en
microsegundos, sin PBKDF2), así que un adversario que pueda adivinar la
llave con probabilidad $q$ consigue la semilla con probabilidad $q$, casi
sin coste por intento. De ahí las reglas de la SPEC §10.2: una llave sale de
un generador criptográfico, o de una fuente física justa leída según su
regla (una bolsa en la que cada pieza se devuelve, monedas, un dado en el que
se vuelve a tirar con las caras por encima de la mayor potencia de dos), o
de la suma de las dos. La regla del dado se queda con $2^b$ caras igual de
probables y vuelve a tirar con las demás, así que con un dado justo de
cualquier tipo común todos los números del 0 al $N - 1$ son igual de
probables. La suma de dos llaves es uniforme si lo es cualquiera de las dos
partes, siempre que se hagan de forma independiente: si $K_d$ es uniforme y $K_h$ independiente de ella, con cualquier
distribución, entonces para todo $x \in \mathbb{Z}_N^L$

$$\Pr[K_d + K_h = x] = \sum_{y} \Pr[K_h = y] \, \Pr[K_d = x - y] = N^{-L} \sum_{y} \Pr[K_h = y] = N^{-L}$$

### 4.7 Errores

- **Modo sin llave y con llave**: una cosa mal leída, o un símbolo de la
  llave equivocado, cambia un símbolo de P, y el código Reed-Solomon del
  código QR siempre lo repara (SPEC §5). Pruebas: tests en la CI (sin
  llave), E3 (con llave).
- **Comprobar una copia nueva no se apoya en esa reparación.** La
  herramienta web solo acepta una copia recién hecha si al leerla de vuelta
  da la misma semilla **sin** corregir ninguna palabra de código, y cada
  pieza leída coincide con la hecha, salvo las piezas que no guardan más que
  bits de relleno al azar (SPEC §3.5, §7). Una pieza de datos mal leída en
  las dos ristras, con los dos errores anulándose, sigue bloqueando. Pruebas:
  `web/test.mjs` (`checkVerdict`, `paddingOnlyRead`).
- **Archivo de la llave**: el carácter de control de cada fila es
  $\left(N - \left(\sum_i w_i(d_i) \bmod N\right)\right) \bmod N$, donde,
  desde el último símbolo de la fila hacia la izquierda, $w_i$ dobla un
  símbolo sí y otro no ($d \mapsto 2d$ si $2d < N$, y si no $2d - N + 1$) y
  deja el otro como está (Luhn mod $N$). Detecta todo símbolo equivocado, y
  todo intercambio de dos vecinos salvo $0 \leftrightarrow N - 1$, y dice en
  qué fila (para $N = 2$ es un bit de paridad y no detecta intercambios).
  Esto vale para todo $N$ par, así que para todo $N$ del formato; para $N$
  impar el doble no es biyectivo y no valdría. Es una función solo de la
  llave. Pruebas: E6.
- **Sentido y papeles**: el programa prueba los dos sentidos y los dos
  papeles (SPEC §10.5, §10.9); solo el bueno descodifica. Al comprobar una
  copia nueva, la herramienta web dice además si una ristra se leyó desde su
  otro extremo, o si las dos ristras se cambiaron, y ofrece dar la vuelta a
  la lectura.

## 5. Qué puede delatar una secuencia

La primera defensa de SeedCraft en los dos modos es que una secuencia no
parece una copia de seguridad. Lo que aún puede delatarla:

| Rasgo | Modo sin llave | Modo con llave |
| :--- | :--- | :--- |
| El análisis de alguien que conoce el método | **Decisivo**: descodifica (§4.2) | $C$ es azar uniforme: estadísticamente igual que una ristra de cuentas elegidas al azar. Ejecutar el ataque solo muestra que no es una secuencia sin llave |
| Longitud | Fijada por la SPEC §2 (54 y 91 para $N = 16$) | Igual |
| Número de tipos | $N$, una potencia de dos | Igual |
| El diccionario | $N$ cosas distintas, una de cada. $N$ cosas distintas seguidas salen por casualidad con probabilidad $N!/N^N$ ($\approx 1.1 \times 10^{-6}$ para $N = 16$): **no lo lleves con la secuencia** | Igual, y lo mismo si va al principio de la ristra de la llave (SPEC §10.6) |
| Una segunda ristra | — | Dos ristras de la misma longitud y los mismos tipos, encontradas juntas, son una pareja, y juntas son la semilla |
| El archivo de la llave | — | Filas de 16 caracteres hexadecimales y un carácter de control parecen una clave. Ninguna cabecera la nombra por defecto (SPEC §10.7) |
| El objeto | Un collar hecho con cuidado y sin ningún patrón es menos habitual que una pulsera infantil de cuentas mezcladas: elige cosas en las que el desorden sea normal, de un tamaño normal (54 cuentas de 6 mm dan una gargantilla de 32 cm); la SPEC §11 compara formas | Igual |
| El comportamiento | Lo que dice y hace quien la lleva delata más que cualquier análisis | Igual |

Si SeedCraft se hace conocido, «una ristra de exactamente 54 cosas de 16
tipos» se convierte en una firma en cualquiera de los dos modos. En el modo
con llave eso solo señala la ristra como algo que merece la pena mirar; no
revela la semilla. Romper la firma (piezas decorativas libres fuera del
diccionario en los extremos) es una cuestión abierta (§8).

## 6. Pruebas

| | Afirmación | Prueba | Estado |
| :--- | :--- | :--- | :--- |
| E1 | Una secuencia sin llave entrega su diccionario en $\le 8$ intentos para $N \le 16$ | `tools/dictionary_attack.py`; `tests/test_sequences.py` | En el repositorio, se ejecuta en la CI |
| E2 | El mismo ataque no encuentra nada en una secuencia con llave: sus ecuaciones son incompatibles para las 8 máscaras | `tests/test_pad.py`, todos los vectores con llave con $N \le 16$ | En el repositorio, se ejecuta en la CI |
| E3 | Un símbolo de la llave equivocado se repara | `tests/test_pad.py`: cada posición de cada vector, en la llave y en la secuencia; `web/test.mjs`: una posición al azar de cada uno, en la herramienta web | En el repositorio, se ejecuta en la CI |
| E4 | $C$ es uniforme sea cual sea la semilla | Demostración en el §4.1; `tests/test_pad.py`: $\chi^2$ sobre muchas codificaciones de una semilla, cada posición, todas juntas y parejas vecinas, para todo $N$ (y una comprobación de que se detecta una llave un poco sesgada) | En el repositorio, se ejecuta en la CI |
| E5 | Una llave reutilizada delata la otra semilla en cuanto se sabe una | `tools/pad_reuse.py`; `tests/test_pad.py` para todo $N$, 12 y 24 palabras | En el repositorio, se ejecuta en la CI |
| E6 | Caracteres de control: todo error suelto, todo intercambio de vecinos salvo $0 \leftrightarrow N - 1$ | `tests/test_pad.py`: de forma exhaustiva sobre los valores de los símbolos para todo $N$ par de 2 a 32, sobre filas al azar, y cada símbolo equivocado en un archivo de llave; `web/test.mjs`: cada intercambio de vecinos para $N$ de 4 a 32, y un carácter equivocado en el archivo de llave de cada vector, en la herramienta web | En el repositorio, se ejecuta en la CI |
| E7 | Cada una de las 8 máscaras da un CompactSeedQR válido | `tests/test_pad.py`: cada semilla de prueba, todo $N$, los dos modos | En el repositorio, se ejecuta en la CI |
| E8 | Cuántas piezas comprar (SPEC §6, §10.6) | `tools/pieces_tables.py`, 100 000 semillas y llaves al azar por fila; la CI lo ejecuta en corto | En el repositorio; con 100 000 muestras da exactamente las tablas del 99,9 % de la SPEC §6 y §10.6. La CI lo ejecuta en corto, sin comprobar las cifras. Las estimaciones de percentil 90 de la herramienta web (las tablas de «unas») salen del mismo tipo de simulación; el script aún no las imprime |

## 7. Diseños considerados y descartados

Para que los revisores no tengan que redescubrirlos.

1. **El diccionario como secreto** ($16! \approx 2^{44}$ órdenes). No es un
   secreto frente a quien conozca el método: $\le 8$ intentos (§4.2).
2. **Piezas de ruido** (cosas fuera del diccionario, que el lector descarta)
   en una secuencia sin llave. El adversario solo tiene que elegir cuáles de
   los $N + m$ tipos son ruido, y el ruido nunca está en el diccionario:
   $\binom{N+m}{m} \cdot 8$ intentos,
   $\binom{19}{3} \cdot 8 = 7752 \approx 2^{13}$ para $N = 16$, $m = 3$. Como
   disfraz aún pueden tener su sitio (§5); como protección, ninguno.
3. **Solo la entropía y una «máscara de 2 bits»** (130 bits, 33 piezas), con
   un diccionario secreto y ruido, como proponía un borrador anterior. El
   código QR tiene 8 máscaras, no 4, y cualquiera de ellas da un código
   válido, así que no hace falta guardar ninguna máscara; sin la paridad
   Reed-Solomon el código QR no se puede dibujar a mano; y la protección es
   como mucho de
   $16! \cdot \binom{19}{3} \approx 2^{54}$ candidatos.
   Cada uno cuesta un PBKDF2, pero a la velocidad del §4.2 todo el espacio
   son unos 640 años-GPU, unos ocho meses para 1 000 GPU (cuatro de media):
   no basta para unos fondos, y descansa en una velocidad que nadie ha
   medido.
4. **Ruido colocado por un generador con la semilla como clave.** Las
   posiciones son entonces una función de la semilla: una comprobación
   gratis de cada intento en el modo sin llave, y una filtración incluso con
   llave. El azar que forma parte de una secuencia tiene que venir de un
   generador independiente de la semilla.
5. **Una llave solo sobre la entropía y la suma de comprobación** (132 bits:
   33 cosas y una llave de 33 símbolos para 12 palabras, leídas de vuelta
   como palabras a mano). Más corta, pero no tiene corrección de errores (la
   suma de comprobación de 4 bits detecta 15 errores de cada 16 y no repara
   ninguno) y sería un segundo método que aprender a mano. Aplazada, no
   descartada (§8).
6. **Una llave derivada de una contraseña.** Trae de vuelta la fuerza bruta
   y no se puede calcular a mano.

## 8. Fuera de alcance y cuestiones abiertas

**Fuera de alcance**: un aparato que codifica comprometido, o uno que está
conectado mientras tiene una semilla real; la coacción de alguien que sabe
dónde están las dos mitades; lo que haga el usuario con un archivo de llave
una vez que sale del aparato (el §4.4 tiene los consejos).

**Cuestiones abiertas, también para los revisores:**

- Una auditoría independiente del método, la implementación de referencia y
  la herramienta web: todavía no se ha hecho ninguna.
- ¿Es el modelo del §4.1 fiel a cómo se hacen de verdad las llaves, con
  aparatos y a mano?
- ¿Es 2 de 2 el valor por defecto adecuado, o habría que especificar un
  esquema 2 de 3 solo con sumas para quien tema más la pérdida que el robo?
- Piezas decorativas libres para romper la firma de longitud y tipos (§5):
  cómo añadirlas sin hacer la secuencia más difícil de leer.
- El modo con llave más corto del §7.5.
- **Las tasas de error a mano** no se han medido: cuánto se tarda en leer y
  restar, y cuántos fallos cometen personas reales. Ninguna cifra de este
  documento es una afirmación de usabilidad.

Para informar de un error en esta auditoría o de una debilidad del método,
abre una incidencia (issue) en el repositorio.
