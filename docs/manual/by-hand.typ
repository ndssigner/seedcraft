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

// ---- templates --------------------------------------------------------------
#for m in range(8) { template(T21, m, [#tr[12 words · header][12 palabras · cabecera] #mono("00" + bits(m, 3))]) }
#for m in range(8) { template(T25, m, [#tr[24 words · header][24 palabras · cabecera] #mono("00" + bits(m, 3))]) }
