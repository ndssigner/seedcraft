// Seedcraft Sequences by hand: guide, tables, worksheet and templates.
//     docs/manual/build.sh        (both languages, reproducible)
// The data (templates, tables, worked example) comes from
// tools/gen_manual_data.py, i.e. from the reference implementation.

#import "common.typ": *
#show: doc.with(
  title: tr[Seedcraft Sequences by hand][Seedcraft Sequences a mano],
  footer: [Seedcraft Sequences v0 #tr[(draft)][(borrador)] — #tr[by hand][a mano]])

// the example QR, with the template's data cells marked
#let example-rows = {
  let tpl = T21.masks.at(EX.mask)
  range(EX.size).map(r => {
    let out = ""
    let t = tpl.at(r).clusters()
    let m = EX.modules.at(r).clusters()
    for c in range(EX.size) {
      out += if t.at(c) == "." { if m.at(c) == "1" { "#" } else { "_" } } else { t.at(c) }
    }
    out
  })
}
// four tints that tell neighbouring things apart (dark cell, light cell)
#let tints = ((rgb("#1f5fbf"), rgb("#cfe0fb")), (rgb("#c2410c"), rgb("#fde0cc")), (rgb("#15803d"), rgb("#d3f2dc")), (rgb("#7e22ce"), rgb("#ead9fb")))
#let tint(i) = tints.at(calc.rem(i, 4))
#let bead(v, fill: white) = box(baseline: 30%, circle(radius: 7pt, stroke: 0.6pt, fill: fill, align(center + horizon, text(7.5pt, str(v)))))
// the example QR, every data cell in the colour of the thing it belongs to
#let example-qr(cell) = {
  let tpl = T21.masks.at(EX.mask)
  let k = EX.k
  let d = 0
  let cells = ()
  let small(s) = text(calc.min(6.5pt, cell * 0.95), fill: luma(90), s)
  cells += ([], [])
  for c in range(EX.size) { cells.push(align(center + bottom, small(str(c + 1)))) }
  cells += ([], align(center + bottom, small("#")))
  cells += ([],) * (EX.size + 4)
  for r in range(EX.size) {
    cells += (align(right + horizon, small(str(r + 1))), [])
    let t = tpl.at(r).clusters()
    let m = EX.modules.at(r).clusters()
    for c in range(EX.size) {
      if t.at(c) == "." {
        let (dark, light) = tint(calc.quo(d, k))
        cells.push(rect(width: cell, height: cell, fill: if m.at(c) == "1" { dark } else { light }, stroke: 0.3pt + white))
        d += 1
      } else { cells.push(module(t.at(c), cell)) }
    }
    let n = T21.row_counts.at(r)
    cells += ([], align(center + horizon, small(if n == 0 { "–" } else { str(n) })))
  }
  grid(columns: (cell * 1.3, cell) + (cell,) * EX.size + (cell, cell * 1.4), rows: (auto, cell) + (cell,) * EX.size, ..cells)
}
#let bits-strip(from, to) = {
  // bits from..to-1 of the example, each in its thing's colour
  for i in range(from, to) {
    let (dark, light) = tint(calc.quo(i, EX.k))
    let b = EX.bits.at(i)
    box(width: 3.2mm, height: 4.2mm, fill: if b == "1" { dark } else { light }, inset: 0pt, align(center + horizon, text(7pt, fill: if b == "1" { white } else { black }, font: "DejaVu Sans Mono", b)))
    if calc.rem(i + 1, EX.k) == 0 { h(1.2mm) }
  }
}

// ---- cover and guide --------------------------------------------------------
#align(center)[
  #v(4mm)
  #text(24pt, weight: "bold")[Seedcraft Sequences]
  #v(-2mm)
  #text(15pt)[#tr[by hand][a mano]]
  #v(1mm)
  #text(10pt, fill: luma(90))[#tr[Draft v0 · test seeds only · github.com/ndssigner/seedcraft][Borrador v0 · solo semillas de prueba · github.com/ndssigner/seedcraft]]
]
#v(3mm)

#tr[
  A *Seedcraft sequence* stores a BIP-39 seed as a row of objects — beads, charms, bricks… — in a fixed order. Behind it there is a *CompactSeedQR*, the QR code of the seed that SeedSigner and NDS-Signer scan. This booklet lets you go from the sequence to that QR code, and from the QR code to a sequence, *with a pencil and nothing else*: no computer, no arithmetic. Then scan the QR code you drew with an air-gapped signer.
][
  Una *secuencia de Seedcraft* guarda una semilla BIP-39 como una fila de objetos —cuentas, abalorios, piezas…— en un orden fijo. Detrás hay un *CompactSeedQR*, el código QR de la semilla que leen SeedSigner y NDS-Signer. Este cuadernillo permite pasar de la secuencia a ese código QR, y del código QR a una secuencia, *con un lápiz y nada más*: sin ordenador y sin hacer cuentas. Después, escanea el QR que has dibujado con un firmador sin conexión.
]

#note[
  #tr[
    *Before you start.* Whoever has the sequence, or the QR code you draw, has the seed — even without your dictionary, if they know this method. Work alone, and burn or shred the worksheets afterwards. The format is a *draft*: practise with test seeds, not with real funds.
  ][
    *Antes de empezar.* Quien tenga la secuencia, o el QR que dibujes, tiene la semilla, incluso sin tu diccionario si conoce este método. Trabaja a solas y quema o tritura las hojas de trabajo al terminar. El formato es un *borrador*: practica con semillas de prueba, no con fondos reales.
  ]
]

== #tr[What is in the sequence][Qué hay en la secuencia]

+ #tr[*The dictionary*, kept apart (a little string, a list, photos): N objects, all different. The first one means 0, the second 1, and so on up to N − 1. N is 2, 4, 8, 16 or 32.][*El diccionario*, guardado aparte (una ristra corta, una lista, fotos): N objetos, todos distintos. El primero vale 0, el segundo 1, y así hasta N − 1. N es 2, 4, 8, 16 o 32.]
+ #tr[*The sequence*, from its start (the clasp or a knot, or one end of an open carrier): one object per symbol. Each one stands for k bits (0s and 1s):][*La secuencia*, desde su principio (el cierre o un nudo, o un extremo si está abierta): un objeto por símbolo. Cada uno vale k bits (ceros y unos):]

#align(center, table(columns: 6, align: center, stroke: 0.4pt + luma(170), inset: 5pt,
  [N #tr[(kinds of objects)][(tipos de objeto)]], [2], [4], [8], [16], [32],
  [k #tr[(bits per object)][(bits por objeto)]], [1], [2], [3], [4], [5],
  [#tr[symbols, 12 words][símbolos, 12 palabras]], ..T21.symbols.map(s => str(s)),
  [#tr[symbols, 24 words][símbolos, 24 palabras]], ..T25.symbols.map(s => str(s)),
))

#tr[
  The bits, in order, are the QR code's *data cells* read row by row, left to right, like writing: #T21.data_modules cells for 12 words (21 × 21 squares) or #T25.data_modules for 24 words (25 × 25). Then come 5 header bits (next section). The bits left over at the end mean nothing.
][
  Los bits, en orden, son las *casillas de datos* del código QR leídas fila a fila, de izquierda a derecha, como al escribir: #T21.data_modules casillas para 12 palabras (21 × 21 cuadros) o #T25.data_modules para 24 palabras (25 × 25). Después vienen 5 bits de cabecera (siguiente apartado). Los bits que sobran al final no significan nada.
]

#tr[
  The templates at the end of this booklet have every fixed part of the QR code already drawn — the three big squares, the dotted lines, and the 15 *format cells* that depend on the mask — so there is one template per size and mask. You only fill in the white squares: *1 = dark, 0 = leave it white*.
][
  Las plantillas del final del cuadernillo traen ya dibujadas todas las partes fijas del QR —los tres cuadrados grandes, las líneas punteadas y las 15 *casillas de formato*, que dependen de la máscara—, así que hay una plantilla por tamaño y máscara. Solo se rellenan los cuadros blancos: *1 = oscuro, 0 = se deja en blanco*.
]

== #tr[The header and the mask][La cabecera y la máscara]

#align(center, box(stroke: 0.5pt + luma(150), inset: 5pt, radius: 3pt)[
  #set text(8.5pt)
  #box(fill: luma(235), inset: 4pt)[#tr[data cells][casillas de datos] · #T21.data_modules / #T25.data_modules bits]
  #box(fill: rgb("#ffe08a"), inset: 4pt)[`0 0` · #tr[version][versión]]
  #box(fill: rgb("#ffc04d"), inset: 4pt)[`M M M` · #tr[mask][máscara]]
  #box(fill: luma(250), stroke: (dash: "dashed", paint: luma(150), thickness: 0.5pt), inset: 4pt)[#tr[padding][relleno]]
])

#tr[
  A QR code is not drawn with its bits as they are: the standard flips some of them with one of 8 checkerboard-like patterns, the *mask*, so that the code has no large blank areas. Which one was used is written in the code's 15 *format cells*, next to its big squares. *You never apply a mask by hand*: the 3 mask bits of the header (0 to 7, see the mask table) just tell you which template page to use — its format cells are already drawn — and you fill in the data cells exactly as the bits say. The `00` before them is the format version; the padding after them (to complete the last object) is random and is ignored.
][
  Un código QR no se dibuja con sus bits tal cual: el estándar invierte algunos con uno de 8 patrones parecidos a un tablero de ajedrez, la *máscara*, para que el código no tenga zonas grandes en blanco. Cuál se usó está escrito en sus 15 *casillas de formato*, junto a los cuadrados grandes. *Nunca aplicas una máscara a mano*: los 3 bits de máscara de la cabecera (del 0 al 7, mira la tabla de máscaras) solo dicen qué página de plantilla usar —sus casillas de formato ya están dibujadas— y rellenas las casillas de datos tal como dicen los bits. El `00` que va delante es la versión del formato; el relleno de detrás (para completar el último objeto) es aleatorio y se ignora.
]

== #tr[A. From a sequence to the QR code][A. De una secuencia al código QR]

#step(1) #tr[*Take your dictionary* and find where the sequence starts (its clasp or knot). If you cannot tell, start at either end: if the QR code does not scan, read it again from the other end.][*Coge tu diccionario* y busca dónde empieza la secuencia (su cierre o nudo). Si no lo sabes, empieza por cualquier extremo: si el QR no se lee, vuelve a leerla desde el otro.]

#step(2) #tr[*Copy the dictionary* onto the worksheet: draw or name each object next to its number (0, 1, 2…).][*Copia el diccionario* en la hoja de trabajo: dibuja o nombra cada objeto junto a su número (0, 1, 2…).]

#step(3) #tr[*Write the numbers.* For each object of the sequence, write its number in the next box of the worksheet. Count the boxes: with the table above, that tells 12 words (21 × 21) or 24 words (25 × 25).][*Escribe los números.* Para cada objeto de la secuencia, escribe su número en la siguiente casilla de la hoja de trabajo. Cuenta las casillas: con la tabla de arriba sabrás si son 12 palabras (21 × 21) o 24 (25 × 25).]

#step(4) #tr[*Turn each number into bits* with the conversion table (column k), and write them under it.][*Convierte cada número en bits* con la tabla de conversión (columna k) y escríbelos debajo.]

#step(5) #tr[*Read the header.* Count #T21.data_modules bits (12 words) or #T25.data_modules bits (24 words) from the start; the next five should be `00` followed by the mask's three bits (0–7). Take the template page for that size and mask.][*Lee la cabecera.* Cuenta #T21.data_modules bits (12 palabras) o #T25.data_modules (24 palabras) desde el principio; los cinco siguientes deben ser `00` seguido de los tres bits de la máscara (0–7). Coge la página de plantilla de ese tamaño y máscara.]

#tr[
  The mask comes after the data, so it is in the *last objects* of the sequence — the last two with 8, 16 or 32 kinds of object, up to five with fewer. To draw while you read, read those last objects first, take the right page, then start from the beginning. A wrong page is not lost work: the data squares are in the same places on all eight pages of a size; only the format squares change.
][
  La máscara va detrás de los datos, así que está en los *últimos objetos* de la secuencia: los dos últimos con 8, 16 o 32 clases de objeto, hasta cinco con menos. Para dibujar mientras lees, lee primero esos últimos objetos, coge la página buena y empieza luego desde el principio. Una página equivocada no es trabajo perdido: las casillas de datos están en el mismo sitio en las ocho páginas de un tamaño; solo cambian las de formato.
]

#step(6) #tr[*Fill the white squares* row by row, left to right: 1 = colour it dark (a black felt-tip works best), 0 = leave it. The number at the right of each row says how many white squares it has: tick each row off as you finish it.][*Rellena los cuadros blancos* fila a fila, de izquierda a derecha: 1 = píntalo oscuro (mejor con rotulador negro), 0 = déjalo. El número a la derecha de cada fila dice cuántos cuadros blancos tiene: márcala al terminarla.]

#step(7) #tr[*Scan it* with SeedSigner or NDS-Signer (“Scan a SeedQR”). One misread object is repaired by the QR code itself.][*Escanéalo* con SeedSigner o NDS-Signer («Escanear SeedQR»). El propio QR corrige un objeto mal leído.]

#tr[
  Instead of drawing, you can lay the QR code out on a fusible-bead pegboard (usually 29 × 29 pegs) or a Lego baseplate, with dark and light pieces.
][
  En vez de dibujarlo, puedes montar el QR en un tablero de cuentas Hama (suelen tener 29 × 29 pinchos) o en una base de Lego, con piezas oscuras y claras.
]

== #tr[B. From a SeedQR to a sequence][B. De un SeedQR a una secuencia]

#step(1) #tr[*Show the CompactSeedQR* on your signer: in SeedSigner, Backup Seed → Export as SeedQR → Compact: 21x21 or 25x25 (it shows it zone by zone so you can copy it); NDS-Signer has a SeedQR map. It must be the *Compact* kind: 21 × 21 for 12 words, 25 × 25 for 24.][*Muestra el CompactSeedQR* en tu firmador: en SeedSigner, Backup Seed → Export as SeedQR → Compact: 21x21 o 25x25 (lo enseña por zonas para copiarlo); NDS-Signer tiene un mapa del SeedQR. Debe ser del tipo *compacto*: 21 × 21 para 12 palabras, 25 × 25 para 24.]

#step(2) #tr[*Find its mask.* Compare row 9 and column 9 next to its top-left big square with the drawings of the mask table: one matches. Take the template for that size and mask: its grey and black squares match the code too.][*Averigua su máscara.* Compara la fila 9 y la columna 9 junto a su cuadrado grande de arriba a la izquierda con los dibujos de la tabla de máscaras: uno coincide. Coge la plantilla de ese tamaño y máscara: sus cuadros grises y negros también coinciden con el código.]

#step(3) #tr[*Read the data cells* — the squares that are white on the template — row by row, left to right: dark = 1, light = 0. Write the bits in groups of k in the worksheet boxes.][*Lee las casillas de datos* —los cuadros que en la plantilla están en blanco— fila a fila, de izquierda a derecha: oscuro = 1, claro = 0. Escribe los bits en grupos de k en las casillas de la hoja de trabajo.]

#step(4) #tr[*Add the header*: `00` and the mask's three bits. Complete the last group with any bits (flip a coin: zeros would make the last object easier to guess).][*Añade la cabecera*: `00` y los tres bits de la máscara. Completa el último grupo con bits cualesquiera (tira una moneda: con ceros, el último objeto sería más fácil de adivinar).]

#step(5) #tr[*Turn each group into its number* with the conversion table, and string one object per number, as your dictionary says (made beforehand, kept apart).][*Convierte cada grupo en su número* con la tabla de conversión y ensarta un objeto por número, según tu diccionario (hecho antes y guardado aparte).]

#tr[
  If your signer chose a different mask from the one Seedcraft's software would pick, your sequence is still valid: readers try every mask.
][
  Si tu firmador eligió una máscara distinta de la que elegiría el programa de Seedcraft, tu secuencia sigue siendo válida: los lectores prueban todas las máscaras.
]

// ---- worked example ---------------------------------------------------------
#pagebreak()
= #tr[Worked example][Ejemplo resuelto]

#tr[
  The NDS-Signer *test seed* (public, never use it for real funds), 12 words, with N = 16 kinds of objects (k = 4: 4 bits each):
][
  La *semilla de prueba* de NDS-Signer (pública, nunca la uses con fondos reales), 12 palabras, con N = 16 tipos de objeto (k = 4: 4 bits cada uno):
]
#align(center, mono(EX.mnemonic))

#grid(columns: (auto, 1fr), column-gutter: 6mm,
  example-qr(3.5mm),
  [
    #tr[
      Every colour is one object: its #EX.k data cells, read row by row, are its #EX.k bits — dark = 1, pale = 0. Grey and black are the template. Its CompactSeedQR uses *mask #EX.mask*, so the header is #mono("00" + bits(EX.mask, 3)) and the template page is "21 × 21 · mask #EX.mask".

      The first data cells are rows 1–3, with 4 each:
    ][
      Cada color es un objeto: sus #EX.k casillas de datos, leídas fila a fila, son sus #EX.k bits —oscuro = 1, claro = 0—. El gris y el negro son la plantilla. Su CompactSeedQR usa la *máscara #EX.mask*, así que la cabecera es #mono("00" + bits(EX.mask, 3)) y la página de plantilla es «21 × 21 · máscara #EX.mask».

      Las primeras casillas de datos están en las filas 1–3, con 4 cada una:
    ]
    #table(columns: 4, align: center + horizon, stroke: 0.4pt + luma(170), inset: 4pt,
      [#tr[row][fila]], [bits], [#tr[number][número]], [#tr[object][objeto]],
      ..range(3).map(i => (str(i + 1), bits-strip(4 * i, 4 * i + 4), str(EX.symbols.at(i)), bead(EX.symbols.at(i), fill: tint(i).at(1)))).flatten())
    #tr[
      The end of the sequence: the last data bits, then the header and the padding.
    ][
      El final de la secuencia: los últimos bits de datos, después la cabecera y el relleno.
    ]
    #v(-1mm)
    #bits-strip(EX.data_modules - 4, EX.bits.len())
    #v(-1mm)
    #text(8pt)[#tr[bits][bits] #(EX.data_modules - 3)–#EX.data_modules · #tr[header][cabecera] #mono(EX.bits.slice(EX.data_modules, EX.data_modules + 5)) · #tr[padding][relleno] #mono(EX.bits.slice(EX.data_modules + 5))]
  ])

#v(2mm)
#tr[
  The whole sequence, #EX.symbols.len() objects, each in the colour of its cells. The dictionary (here, objects named 0–15) is kept apart. Check your own reading against it, five at a time:
][
  La secuencia completa, #EX.symbols.len() objetos, cada uno del color de sus casillas. El diccionario (aquí, objetos llamados 0–15) se guarda aparte. Comprueba tu lectura con ella, de cinco en cinco:
]

#block(width: 100%, inset: (y: 2mm))[
  #for (i, s) in EX.symbols.enumerate() {
    if calc.rem(i, 5) == 0 and i > 0 { h(3mm) }
    bead(s, fill: tint(i).at(1)); h(0.9mm)
  }
]
#text(9pt)[#tr[Dictionary, kept apart][Diccionario, guardado aparte]:] #h(2mm) #for i in range(16) { bead(i); h(1.2mm) }

// ---- tables -----------------------------------------------------------------
#pagebreak()
= #tr[Tables][Tablas]

== #tr[Number → bits][Número → bits]
#tr[Use the column for your k. Each bit string reads left to right.][Usa la columna de tu k. Cada grupo de bits se lee de izquierda a derecha.]

#let conv-rows(lo, hi) = range(lo, hi).map(v => (
  text(weight: "bold", str(v)),
  ..range(1, 6).map(k => if v < calc.pow(2, k) { mono(bits(v, k)) } else { [] }),
)).flatten()
#let conv(lo, hi) = table(columns: 6, align: center, stroke: 0.4pt + luma(170), inset: (x: 6pt, y: 3.2pt),
  fill: (_, y) => if y > 0 and calc.even(y) { luma(244) },
  [#tr[number][número]], [k = 1], [k = 2], [k = 3], [k = 4], [k = 5], ..conv-rows(lo, hi))
#grid(columns: (1fr, 1fr), column-gutter: 5mm, conv(0, 16), conv(16, 32))

== #tr[Masks][Máscaras]
#tr[
  The top-left corner of a QR code (rows and columns 1–9). The 15 format cells — row 9 and column 9 — tell its mask; they are the same for 21 × 21 and 25 × 25. The header carries the mask as 3 bits.
][
  La esquina superior izquierda de un código QR (filas y columnas 1–9). Las 15 casillas de formato —la fila 9 y la columna 9— dicen su máscara; son iguales en 21 × 21 y en 25 × 25. La cabecera lleva la máscara en 3 bits.
]
#v(1mm)
#mask-table()

// ---- worksheet --------------------------------------------------------------
#pagebreak()
= #tr[Worksheet][Hoja de trabajo]
#text(9.5pt)[#tr[Destroy it when you finish. Dictionary: draw or name each object. Then one box per object of the sequence: its number above, its bits below.][Destrúyela al terminar. Diccionario: dibuja o nombra cada objeto. Después, una casilla por objeto de la secuencia: su número arriba y sus bits debajo.]]

#let dict-box(i) = box(width: 100%, height: 9mm, stroke: 0.5pt + luma(150), inset: 2pt, text(7pt, fill: luma(110), str(i)))
#grid(columns: (1fr,) * 16, column-gutter: 1mm, row-gutter: 1mm, ..range(32).map(dict-box))
#v(2mm)
#let sym-box(i) = box(width: 100%, height: 12.2mm, stroke: 0.5pt + luma(150), inset: 2pt)[
  #text(6.5pt, fill: luma(110), str(i + 1))
  #place(bottom + left, dy: -4.6mm, line(length: 100%, stroke: 0.3pt + luma(200)))
]
#grid(columns: (1fr,) * 10, column-gutter: 1mm, row-gutter: 1mm, ..range(130).map(sym-box))

// ---- with a key -------------------------------------------------------------
// SPEC §10 (pad mode); the reader text says "key", as the web tool does.
#let num(v) = text(weight: "bold", str(v))
// the table of addition mod n: row + column = cell
#let add-table(n, w: 6mm, h: 5mm, size: 8pt, hl: none) = {
  let A = KY.add.at(str(n))
  let line(i) = if calc.rem(i, 4) == 0 { 0.7pt + luma(90) } else { 0.3pt + luma(185) }
  set text(size)
  table(columns: (w,) * (n + 1), rows: (h,) * (n + 1), align: center + horizon, inset: 0pt,
    stroke: (x, y) => (
      left: if x == 0 { none } else { line(x - 1) },
      top: if y == 0 { none } else { line(y - 1) },
      right: if x == n { 0.7pt + luma(90) } else { none },
      bottom: if y == n { 0.7pt + luma(90) } else { none }),
    fill: (x, y) => if x == 0 or y == 0 { luma(225) } else if hl != none and x - 1 == hl.at(1) and y - 1 == hl.at(0) { rgb("#ffe08a") } else if hl != none and (x - 1 == hl.at(1) or y - 1 == hl.at(0)) { rgb("#fff5d6") } else if calc.odd(y) { luma(247) },
    [*+*], ..range(n).map(num),
    ..range(n).map(r => (num(r), ..A.at(r).map(v => str(v)))).flatten())
}
#let die-name(s) = if s == 2 { tr[coin][moneda] } else { [d#s] }
#let die-card(d) = block(breakable: false, width: 100%, stroke: 0.5pt + luma(150), radius: 3pt, inset: 6pt)[
  #text(12pt, weight: "bold", die-name(d.faces)) #h(1fr) #text(8.5pt)[#d.b #tr[bit][bit]#if d.b > 1 [s] #tr[per throw][por tiro]]
  #v(-1mm)
  #set text(8.5pt)
  #if d.faces == 2 [#tr[heads 1, tails 0][cara 1, cruz 0]] else [#tr[keep][vale] 0–#(calc.pow(2, d.b) - 1)]
  #h(1fr)
  #if d.faces == 2 [] else if d.rethrown.len() == 0 [#tr[none thrown again][ninguna se repite]] else [#tr[again][repite]: #if d.rethrown.len() <= 2 { d.rethrown.map(str).join(", ") } else [#d.rethrown.first()–#d.rethrown.last()]]
  #v(-1mm)
  #table(columns: (auto,) + (1fr,) * 5, align: center, inset: 2.5pt, stroke: 0.3pt + luma(185),
    [N], ..(2, 4, 8, 16, 32).map(str),
    [#tr[throws][tiros]], ..d.throws.map(t => text(weight: "bold", str(t))))
]
#let KT = KY.turns
#let turn-cells(t) = t.cells.filter(c => c != none).map(c => [#c.at(0)·#c.at(1)]).join(", ")
#let KC = KY.check

#pagebreak()
= #tr[With a key][Con llave]

#tr[
  Without a key, the sequence *is* the seed: whoever finds it and knows this method can read it. With a key it is not. The *key* is a second row of random numbers, one for each object (the specification calls it the _pad_, SPEC §10). What you make as a sequence is no longer the seed, but *the seed plus the key*, number by number, on the clock of N. The key is kept somewhere else: as a second string of objects, or written in a file.
][
  Sin llave, la secuencia *es* la semilla: quien la encuentre y conozca este método puede leerla. Con llave, no. La *llave* es una segunda fila de números al azar, uno por objeto (la especificación la llama _pad_, SPEC §10). Lo que montas como secuencia ya no es la semilla, sino *la semilla más la llave*, número a número, en el reloj de N. La llave se guarda en otro sitio: como una segunda ristra de objetos o escrita en un archivo.
]

#tr[
  *The sequence alone says nothing* about the seed, not even to someone who knows this method; *the key alone says nothing either*. Together they give the seed. That holds while the key is pure chance, secret, and used for one seed only.
][
  *La secuencia sola no dice nada* de la semilla, ni siquiera a quien conozca este método; *la llave sola tampoco*. Juntas dan la semilla. Eso vale mientras la llave sea puro azar, secreta y de una sola semilla.
]

#align(center, box(stroke: 0.5pt + luma(150), inset: 6pt, radius: 3pt)[
  #set text(9pt)
  *#tr[Making][Al hacer]:* #tr[QR bits][bits del QR] → #tr[number][número] #h(1mm) *+ #tr[key][llave]* #h(1mm) → #tr[number][número] → #tr[object][objeto] \
  *#tr[Reading back][Al recuperar]:* #tr[object][objeto] → #tr[number][número] #h(1mm) *− #tr[key][llave]* #h(1mm) → #tr[number][número] → #tr[QR bits][bits del QR]
])

#note[
  #tr[
    *The rules.* *One key, one seed*: a key used for two seeds gives both away as soon as one is known (copies of the same sequence can share its key). *Never together*: not in the same place, on the same device or the same journey. *Losing either loses the seed*: keep copies of each, each copy as far from the other half as the original. *Mark the start of each, and which is which* (a clasp, a pendant on the sequence and none on the key, a label). *Read both back together before you store them apart.*
  ][
    *Las reglas.* *Una llave, una semilla*: una llave usada en dos semillas delata las dos en cuanto se conoce una (las copias de una misma secuencia sí pueden compartir su llave). *Nunca juntas*: ni en el mismo sitio, ni en el mismo aparato, ni en el mismo viaje. *Perder cualquiera de las dos es perder la semilla*: guarda copias de cada una, cada copia tan lejos de la otra mitad como el original. *Marca el principio de cada una y cuál es cuál* (un cierre, un colgante en la secuencia y ninguno en la llave, una etiqueta). *Recupéralas juntas antes de guardarlas por separado.*
  ]
]

== #tr[1. Making the key by chance][1. Sacar la llave al azar]

#tr[
  The key has one number for each object of the sequence — as many as the table at the start says — each from 0 to N − 1. Its safety rests on one thing: *every number must be pure chance*, every value just as likely. Your signer or the web tool can draw it, or you can make it by hand, number by number:
][
  La llave tiene un número por cada objeto de la secuencia —tantos como dice la tabla del principio—, cada uno del 0 al N − 1. Su seguridad depende de una sola cosa: *cada número tiene que ser puro azar*, con todos los valores igual de probables. Puede sacarla tu firmador o la herramienta web, o puedes hacerla a mano, número a número:
]

- #tr[*A bag* with one object of each kind: take one without looking, note its number, *put it back* and shake the bag. If it is not put back, it is not chance.][*Una bolsa* con un objeto de cada tipo: saca uno sin mirar, apunta su número, *devuélvelo* y agita la bolsa. Si no se devuelve, no es azar.]
- #tr[*A coin*: one toss per bit, heads 1 and tails 0; k tosses per number, read with the number → bits table.][*Una moneda*: un lanzamiento por bit, cara 1 y cruz 0; k lanzamientos por número, que se leen con la tabla de número → bits.]
- #tr[*A die*, of any common kind. Number its faces from 0: on a die marked 1 to s, subtract 1 (a d10 marked 0–9 already is). Each throw gives the bits of its card below: keep a face in the range, written as bits with the number → bits table, and *throw again* on any other. Join the bits, first throw first, until there are k. If the last throw gives more than needed, keep its first ones.][*Un dado*, de cualquier tipo común. Numera sus caras desde 0: en un dado marcado del 1 al s, resta 1 (un d10 marcado 0–9 ya lo está). Cada tiro da los bits de su tarjeta de abajo: quédate con una cara del rango, escrita en bits con la tabla de número → bits, y *vuelve a tirar* con cualquier otra. Junta los bits, el primer tiro primero, hasta tener k. Si el último tiro da más de los que hacen falta, quédate con los primeros.]

#tr[
  Why throw again? A d6 has 6 faces, and 6 does not split into bits evenly: if faces 4 and 5 counted, some numbers would come out more often than others. *Example*, d6 and N = 8 (3 bits): the die shows #KY.dice_example.faces.at(0) → #mono("10")\; then #KY.dice_example.faces.at(1), which is thrown again; then #KY.dice_example.faces.at(2) → #mono("01"). That is #mono(KY.dice_example.bits)\; the first three, #mono(KY.dice_example.bits.slice(0, 3)), are the number *#KY.dice_example.value*.
][
  ¿Por qué volver a tirar? Un d6 tiene 6 caras, y 6 no se reparte en bits por igual: si contaran las caras 4 y 5, unos números saldrían más que otros. *Ejemplo*, d6 y N = 8 (3 bits): el dado saca #KY.dice_example.faces.at(0) → #mono("10")\; luego #KY.dice_example.faces.at(1), que se repite; luego #KY.dice_example.faces.at(2) → #mono("01"). Eso es #mono(KY.dice_example.bits)\; los tres primeros, #mono(KY.dice_example.bits.slice(0, 3)), son el número *#KY.dice_example.value*.
]

#grid(columns: (1fr,) * 4, column-gutter: 3mm, row-gutter: 3mm, ..KY.dice.map(die-card))

#tr[
  *Never* numbers you choose yourself, nor taken from the seed, a password or a date. A key made by hand can also be added, on the clock, to one drawn by your signer: the result is safe as long as either of the two is.
][
  *Nunca* números elegidos por ti, ni sacados de la semilla, de una contraseña o de una fecha. Una llave hecha a mano también se puede sumar, en el reloj, a una sacada por tu firmador: el resultado es seguro mientras lo sea cualquiera de las dos.
]

#pagebreak()
#grid(columns: (1fr, auto), column-gutter: 7mm, align: top,
  [
    == #tr[2. Adding on the clock (making)][2. Sumar en el reloj (al hacer)]

    #tr[
      The numbers add up on a *clock of N*: after N − 1 comes 0 again. For each object, the number from the QR code plus the number of the key; if the result is N or more, subtract N. The addition table does it for you: *the row of the QR's number, the column of the key's number*; where they cross is the number of the object you make.
    ][
      Los números se suman en un *reloj de N*: después del N − 1 vuelve el 0. Para cada objeto, el número del código QR más el número de la llave; si sale N o más, resta N. La tabla de sumar lo hace por ti: *la fila del número del QR, la columna del número de la llave*; donde se cruzan está el número del objeto que montas.
    ]

    #tr[
      *Example*, N = 8: the QR gives #KT.at(3).p and the key says #KT.at(3).k. #KT.at(3).p + #KT.at(3).k = #KT.at(3).sum, which is 8 or more: #KT.at(3).sum − 8 = *#KT.at(3).c*. In the table for 8, row #KT.at(3).p, column #KT.at(3).k: *#KT.at(3).c* (shaded).
    ][
      *Ejemplo*, N = 8: el QR da #KT.at(3).p y la llave dice #KT.at(3).k. #KT.at(3).p + #KT.at(3).k = #KT.at(3).sum, que es 8 o más: #KT.at(3).sum − 8 = *#KT.at(3).c*. En la tabla del 8, fila #KT.at(3).p, columna #KT.at(3).k: *#KT.at(3).c* (sombreado).
    ]

    == #tr[3. Subtracting on the clock (reading back)][3. Restar en el reloj (al recuperar)]

    #tr[
      To read it back, the number of the object minus the number of the key; if the result is below 0, add N. With the same table, the other way round: *go to the key's column, look down it for the object's number*; its row is the number from the QR.
    ][
      Para recuperarla, el número del objeto menos el número de la llave; si sale menos de 0, suma N. Con la misma tabla, al revés: *ve a la columna de la llave y baja por ella hasta el número del objeto*; su fila es el número del QR.
    ]

    #tr[
      *Example*, N = 8: the object is #KT.at(3).c and the key #KT.at(3).k. #KT.at(3).c − #KT.at(3).k = #KT.at(3).diff, below 0: #KT.at(3).diff + 8 = *#KT.at(3).back*. In the table for 8, column #KT.at(3).k, the #KT.at(3).c is in row *#KT.at(3).back*.
    ][
      *Ejemplo*, N = 8: el objeto es #KT.at(3).c y la llave #KT.at(3).k. #KT.at(3).c − #KT.at(3).k = #KT.at(3).diff, menos de 0: #KT.at(3).diff + 8 = *#KT.at(3).back*. En la tabla del 8, columna #KT.at(3).k, el #KT.at(3).c está en la fila *#KT.at(3).back*.
    ]
  ],
  [
    #set text(9pt)
    #v(3mm)
    *N = 8* #v(-1mm) #add-table(8, w: 6.6mm, h: 5.8mm, size: 9pt, hl: (KT.at(3).p, KT.at(3).k))
    #v(1mm)
    #grid(columns: 2, column-gutter: 5mm,
      [*N = 2* #v(-1mm) #add-table(2, w: 6.6mm, h: 5.8mm, size: 9pt)],
      [*N = 4* #v(-1mm) #add-table(4, w: 6.6mm, h: 5.8mm, size: 9pt)])
  ])
#v(1mm)
#text(9.5pt)[#tr[*Addition tables.* Making: row = number from the QR, column = key, cell = object. Reading back: in the key's column, find the object; its row is the number from the QR. The table for 32 is on the next page.][*Tablas de sumar.* Al hacer: fila = número del QR, columna = llave, casilla = objeto. Al recuperar: en la columna de la llave, busca el objeto; su fila es el número del QR. La tabla del 32 está en la página siguiente.]]
#v(1mm)
*N = 16*
#v(-1mm)
#add-table(16, w: 9.6mm, h: 6.2mm, size: 9.5pt)

#pagebreak()
#tr[*Addition on the clock of 32.* Row = number from the QR, column = key, cell = object. Reading back: in the key's column, find the object; its row is the number from the QR.][*Sumas en el reloj de 32.* Fila = número del QR, columna = llave, casilla = objeto. Al recuperar: en la columna de la llave, busca el objeto; su fila es el número del QR.]
#v(1mm)
#align(center, add-table(32, w: 5.25mm, h: 6.7mm, size: 8.5pt))

#pagebreak()
== #tr[4. The key as a file][4. La llave como archivo]

#tr[
  Instead of a second string, the key can be a text file that a person can read and the web tool can open:
][
  En vez de una segunda ristra, la llave puede ser un archivo de texto que una persona puede leer y la herramienta web puede abrir:
]

#grid(columns: (auto, 1fr), column-gutter: 6mm,
  block(stroke: 0.5pt + luma(150), inset: 7pt, radius: 3pt, text(font: "DejaVu Sans Mono", size: 9.5pt, KY.file.join("\n"))),
  [
    #set text(9.5pt)
    #tr[
      The key of the worked example (N = 8). *An example only: never use a key taken from a document.*

      - *First line*: how many numbers there are, and N.
      - *Then the key*: 16 numbers per row, in groups of 4, one character each.
      - *The last character of each row is a check.* If a number is copied wrong, the check of its row no longer matches. It comes from the key alone and says nothing about the seed.
      - Lines that start with `#` are notes. The file does not say what it is: do not call it “seed”.
    ][
      La llave del ejemplo resuelto (N = 8). *Es solo un ejemplo: nunca uses una llave sacada de un documento.*

      - *Primera línea*: cuántos números hay, y N.
      - *Después, la llave*: 16 números por fila, en grupos de 4, un carácter cada uno.
      - *El último carácter de cada fila es un control.* Si un número se copia mal, el control de su fila deja de cuadrar. Sale solo de la llave y no dice nada de la semilla.
      - Las líneas que empiezan por `#` son notas. El archivo no dice qué es: no lo llames «semilla».
    ]
  ])

#tr[Each number is one character: `0` to `9`, then `A` for 10, `B` for 11, and so on up to `V` for 31:][Cada número es un carácter: del `0` al `9`, después `A` para 10, `B` para 11, y así hasta `V` para 31:]
#align(center, table(columns: (auto,) + (1fr,) * 16, align: center, inset: (x: 2pt, y: 3pt), stroke: 0.3pt + luma(170),
  fill: (_, y) => if calc.even(y) { luma(240) },
  ..range(2).map(h => (
    text(8pt)[#tr[number][número]], ..range(16).map(i => str(16 * h + i)),
    text(8pt)[#tr[character][carácter]], ..range(16).map(i => text(weight: "bold", mono(KY.digits.at(16 * h + i)))),
  )).flatten()))

=== #tr[The check character, by hand][El carácter de control, a mano]

#tr[
  Start at the row's *last* number (not counting the check) and go leftwards. *Double every other one*, starting with that last one; if a double is more than N − 1, subtract N − 1. Add everything up. The check is what is missing to reach the next multiple of N (0 if the sum already is one). It catches any single number copied wrong, and almost any two neighbours swapped (not 0 and N − 1; with N = 2 no swaps at all).
][
  Empieza por el *último* número de la fila (sin contar el control) y ve hacia la izquierda. *Dobla uno sí y uno no*, empezando por ese último; si un doble pasa de N − 1, réstale N − 1. Súmalo todo. El control es lo que falta hasta el siguiente múltiplo de N (0 si la suma ya lo es). Detecta cualquier número mal copiado, y casi cualquier par de vecinos cambiados de sitio (no 0 y N − 1; con N = 2, ninguno).
]

#tr[*The first row of the example*, N = 8 (doubles above 7 lose 7):][*La primera fila del ejemplo*, N = 8 (a los dobles de más de 7 se les resta 7):]
#let rsteps = KC.steps.rev()
#align(center, table(columns: (auto,) + (1fr,) * 16, align: center + horizon, inset: (x: 2pt, y: 3.5pt), stroke: 0.3pt + luma(170),
  fill: (x, y) => if x > 0 and rsteps.at(x - 1).doubled { rgb("#fff5d6") },
  [#tr[number][número]], ..rsteps.map(s => mono(KY.digits.at(s.d))),
  [#tr[double?][¿doble?]], ..rsteps.map(s => if s.doubled [×2] else [–]),
  [#tr[counts][cuenta]], ..rsteps.map(s => if s.doubled and 2 * s.d > KY.n - 1 { text(8.5pt)[#(2 * s.d) − #(KY.n - 1) \ = *#s.v*] } else [*#s.v*]),
))
#tr[
  Sum: #rsteps.map(s => str(s.v)).join(" + ") = *#KC.sum*. The next multiple of 8 is #(KC.sum + KC.check), so the check is #(KC.sum + KC.check) − #KC.sum = *#KC.check*, written #mono(KC.char) — the last character of the row.
][
  Suma: #rsteps.map(s => str(s.v)).join(" + ") = *#KC.sum*. El siguiente múltiplo de 8 es #(KC.sum + KC.check), así que el control es #(KC.sum + KC.check) − #KC.sum = *#KC.check*, que se escribe #mono(KC.char): el último carácter de la fila.
]

// ---- worked example with a key ----------------------------------------------
#pagebreak()
= #tr[Worked example with a key][Ejemplo resuelto con llave]

#tr[
  The same *test seed* (public, never use it for real funds), now with N = #KY.n kinds of objects (k = #KY.k: 3 bits each), so #KY.length objects. Its CompactSeedQR uses *mask #KY.mask*. The key is the one of the key file (section 4): *a public example key, never use it*.
][
  La misma *semilla de prueba* (pública, nunca la uses con fondos reales), ahora con N = #KY.n tipos de objeto (k = #KY.k: 3 bits cada uno), así que #KY.length objetos. Su CompactSeedQR usa la *máscara #KY.mask*. La llave es la del archivo de la llave (apartado 4): *una llave de ejemplo pública, nunca la uses*.
]

=== #tr[Making: the first four objects][Al hacer: los cuatro primeros objetos]
#tr[The QR's data cells, row by row, 3 bits per object; cells as row·column.][Las casillas de datos del QR, fila a fila, 3 bits por objeto; casillas como fila·columna.]
#let wrap(t) = if t.sum >= KY.n [#t.sum − #KY.n = *#t.c*] else [*#t.c*]
#let unwrap(t) = if t.diff < 0 [#t.diff + #KY.n = *#t.back*] else [*#t.back*]
#align(center, table(columns: 7, align: center + horizon, inset: 4.5pt, stroke: 0.4pt + luma(170),
  fill: (_, y) => if y == 0 { luma(230) },
  [#tr[object][objeto]], [#tr[QR cells][casillas del QR]], [bits], [#tr[number][número]], [\+ #tr[key][llave]], [#tr[sum][suma]], [#tr[object][objeto]],
  ..KT.slice(0, 4).map(t => (str(t.pos), text(8.5pt, turn-cells(t)), mono(t.bits), str(t.p), str(t.k), [#t.p + #t.k = #t.sum], wrap(t))).flatten()))

=== #tr[Reading back: the same four][Al recuperar: los mismos cuatro]
#align(center, table(columns: 6, align: center + horizon, inset: 4.5pt, stroke: 0.4pt + luma(170),
  fill: (_, y) => if y == 0 { luma(230) },
  [#tr[object][objeto]], [#tr[its number][su número]], [− #tr[key][llave]], [\= #tr[number][número]], [bits], [#tr[QR cells][casillas del QR]],
  ..KT.slice(0, 4).map(t => (str(t.pos), str(t.c), str(t.k), [#t.c − #t.k = #t.diff #h(1mm) → #unwrap(t)], mono(t.bits), text(8.5pt, turn-cells(t)))).flatten()))

=== #tr[The mask first][Primero la máscara]
#tr[
  By hand you need the template page before you draw, and the mask is in the last objects: subtract those first. Here the last two:
][
  A mano hace falta la página de plantilla antes de dibujar, y la máscara está en los últimos objetos: resta esos primero. Aquí, los dos últimos:
]
#align(center, table(columns: 5, align: center + horizon, inset: 4.5pt, stroke: 0.4pt + luma(170),
  fill: (_, y) => if y == 0 { luma(230) },
  [#tr[object][objeto]], [#tr[its number][su número]], [− #tr[key][llave]], [\= #tr[number][número]], [bits],
  ..KT.slice(4).map(t => (str(t.pos), str(t.c), str(t.k), [#t.c − #t.k = #t.diff #h(1mm) → #unwrap(t)], mono(t.bits))).flatten()))
#tr[
  Bits #(KY.length * KY.k - 5)–#(KY.length * KY.k - 3): the last data cell (#KT.at(4).cells.at(0).at(0)·#KT.at(4).cells.at(0).at(1)) and the version `00`; then the mask, #mono(KT.at(5).bits) = *#KY.mask*: the page “21 × 21 · mask #KY.mask”.
][
  Bits #(KY.length * KY.k - 5)–#(KY.length * KY.k - 3): la última casilla de datos (#KT.at(4).cells.at(0).at(0)·#KT.at(4).cells.at(0).at(1)) y la versión `00`; después la máscara, #mono(KT.at(5).bits) = *#KY.mask*: la página «21 × 21 · máscara #KY.mask».
]

=== #tr[All #KY.length, to check your work][Los #KY.length, para comprobar tu trabajo]
#let all-rows(lo, hi) = table(columns: (auto,) + (1fr,) * (hi - lo), align: center, inset: (x: 1pt, y: 2.6pt), stroke: 0.3pt + luma(185),
  fill: (x, y) => if y == 0 { luma(230) } else if y == 3 { rgb("#fff5d6") },
  text(7.5pt)[#tr[object][objeto]], ..range(lo, hi).map(i => text(7.5pt, fill: luma(90), str(i + 1))),
  text(7.5pt)[#tr[QR][QR]], ..range(lo, hi).map(i => text(8.5pt, str(KY.plain.at(i)))),
  text(7.5pt)[\+ #tr[key][llave]], ..range(lo, hi).map(i => text(8.5pt, str(KY.key.at(i)))),
  text(7.5pt)[\= #tr[sequence][secuencia]], ..range(lo, hi).map(i => text(8.5pt, weight: "bold", str(KY.sequence.at(i)))))
#[
#set text(9pt)
#all-rows(0, 24)
#v(-2mm)
#all-rows(24, 48)
#v(-2mm)
#all-rows(48, KY.length)
]

// ---- key worksheet ----------------------------------------------------------
#pagebreak()
= #tr[Worksheet with a key][Hoja de trabajo con llave]
#text(9.5pt)[#tr[Destroy it when you finish, and never keep it with the key or the sequence. One line per object. Making: QR number + key = result, then the object for the result. Reading back: object, its number (result) − key = QR number. Use a second sheet for more than 96.][Destrúyela al terminar y nunca la guardes con la llave ni con la secuencia. Una línea por objeto. Al hacer: número del QR + llave = resultado, y el objeto del resultado. Al recuperar: objeto, su número (resultado) − llave = número del QR. Usa otra hoja para más de 96.]]
#v(1mm)
#let ws-block(lo) = table(columns: (6mm, 1fr, 1fr, 1fr, 1.6fr), rows: (auto,) + (6.75mm,) * 32, align: center + horizon, inset: 2pt,
  stroke: 0.4pt + luma(160), fill: (_, y) => if y == 0 { luma(230) } else if calc.even(y) { luma(248) },
  ..([\#], [#tr[QR][QR]], [#tr[key][llave]], [#tr[result][resultado]], [#tr[object][objeto]]).map(h => text(7.5pt, weight: "bold", h)),
  ..range(lo, lo + 32).map(i => (text(7pt, fill: luma(110), str(i + 1)), [], [], [], [])).flatten())
#grid(columns: (1fr,) * 3, column-gutter: 3mm, ws-block(0), ws-block(32), ws-block(64))

// ---- templates --------------------------------------------------------------
#for m in range(8) { template(T21, m, [#tr[12 words · header][12 palabras · cabecera] #mono("00" + bits(m, 3))]) }
#for m in range(8) { template(T25, m, [#tr[24 words · header][24 palabras · cabecera] #mono("00" + bits(m, 3))]) }
