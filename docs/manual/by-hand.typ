// Seedcraft Sequences by hand: guide, tables, worksheet and templates.
//     docs/manual/build.sh        (both languages, reproducible)
// The data (templates, tables, worked example) comes from
// tools/gen_manual_data.py, i.e. from the reference implementation.

#let lang = sys.inputs.at("lang", default: "en")
#let tr(en, es) = if lang == "es" { es } else { en }
#let D = json("data.json")
#let T21 = D.templates.at("21")
#let T25 = D.templates.at("25")
#let EX = D.example

// 210 × 279 mm: A4 width, US Letter height, so it prints unscaled on both.
#set page(width: 210mm, height: 279mm, margin: (x: 18mm, top: 16mm, bottom: 18mm),
  footer: context [
    #set text(8pt, fill: luma(110))
    Seedcraft Sequences v0 #tr[(draft)][(borrador)] — #tr[by hand][a mano] #h(1fr) #counter(page).display()
  ])
#set document(title: tr[Seedcraft Sequences by hand][Seedcraft Sequences a mano], author: "NDS-Signer")
#set text(font: "Libertinus Serif", size: 10.5pt, lang: lang)
#set par(justify: true, leading: 0.6em)
#set heading(numbering: none)
#show heading.where(level: 1): set text(17pt)
#show heading.where(level: 2): set text(12.5pt)
#show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)
#let mono(s) = text(font: "DejaVu Sans Mono", size: 0.9em, s)
#let note(body) = block(fill: luma(240), inset: 9pt, radius: 4pt, width: 100%, body)
#let step(n) = box(circle(radius: 6.5pt, fill: black, align(center + horizon, text(8pt, fill: white, weight: "bold", str(n)))))
#let bits(v, k) = { let s = ""; for i in range(k) { s = str(calc.rem(v, 2)) + s; v = calc.quo(v, 2) }; s }

// ---- QR drawing -------------------------------------------------------------
// rows: strings of "1" (fixed dark), "0" (fixed light), "." (data, empty),
// "#" (data, dark) and "_" (data, light).
#let module(ch, cell) = {
  if ch == "1" { rect(width: cell, height: cell, fill: black, stroke: none) }
  else if ch == "0" { rect(width: cell, height: cell, fill: luma(232), stroke: none) }
  else if ch == "#" { rect(width: cell, height: cell, fill: black, stroke: 0.3pt + luma(160)) }
  else { rect(width: cell, height: cell, fill: white, stroke: 0.3pt + luma(160)) }
}
#let qr(rows, cell, labels: true, counts: none, gap: none) = {
  // gap: white space between the labels and the code (its quiet zone)
  let gap = if gap == none { cell } else { gap }
  let n = rows.len()
  let cols = if labels { (cell * 1.3, gap) } else { () }
  cols += (cell,) * n
  if counts != none { cols += (gap, cell * 1.4) }
  let heights = if labels { (auto, gap) } else { () }
  heights += (cell,) * n
  let cells = ()
  let small(s) = text(calc.min(6.5pt, cell * 0.95), fill: luma(90), s)
  if labels {
    cells += ([], [])
    for c in range(n) { cells.push(align(center + bottom, small(str(c + 1)))) }
    if counts != none { cells += ([], align(center + bottom, small("#"))) }
    cells += ([],) * cols.len()
  }
  for r in range(n) {
    if labels { cells += (align(right + horizon, small(str(r + 1))), []) }
    for ch in rows.at(r).clusters() { cells.push(module(ch, cell)) }
    if counts != none {
      let k = counts.at(r)
      cells += ([], align(center + horizon, small(if k == 0 { "–" } else { str(k) })))
    }
  }
  grid(columns: cols, rows: heights, ..cells)
}
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
#let bead(v) = box(baseline: 30%, circle(radius: 7pt, stroke: 0.6pt, align(center + horizon, text(7.5pt, str(v)))))

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
    *Before you start.* Whoever has the sequence, or the QR code you draw, has the seed. Work alone, and burn or shred the worksheets afterwards. The format is a *draft*: practise with test seeds, not with real funds.
  ][
    *Antes de empezar.* Quien tenga la secuencia, o el QR que dibujes, tiene la semilla. Trabaja a solas y quema o tritura las hojas de trabajo al terminar. El formato es un *borrador*: practica con semillas de prueba, no con fondos reales.
  ]
]

== #tr[What is in the sequence][Qué hay en la secuencia]

#tr[
  From the start (the clasp or a knot, or one end of an open carrier):
][
  Desde el principio (el cierre o un nudo, o un extremo si está abierta):
]
+ #tr[*The dictionary:* N objects, all different. The first one means 0, the second 1, and so on up to N − 1. N is 2, 4, 8, 16 or 32.][*El diccionario:* N objetos, todos distintos. El primero vale 0, el segundo 1, y así hasta N − 1. N es 2, 4, 8, 16 o 32.]
+ #tr[*The symbols:* one object per symbol. Each one stands for k bits (0s and 1s):][*Los símbolos:* un objeto por símbolo. Cada uno vale k bits (ceros y unos):]

#align(center, table(columns: 6, align: center, stroke: 0.4pt + luma(170), inset: 5pt,
  [N #tr[(kinds of objects)][(tipos de objeto)]], [2], [4], [8], [16], [32],
  [k #tr[(bits per object)][(bits por objeto)]], [1], [2], [3], [4], [5],
  [#tr[symbols, 12 words][símbolos, 12 palabras]], ..T21.symbols.map(s => str(s)),
  [#tr[symbols, 24 words][símbolos, 24 palabras]], ..T25.symbols.map(s => str(s)),
))

#tr[
  The bits, in order, are the QR code's *data cells* read row by row, left to right, like writing: #T21.data_modules cells for 12 words (21 × 21 squares) or #T25.data_modules for 24 words (25 × 25). Then come 5 header bits: `00` (the format version) and 3 bits with the QR code's *mask* number. The bits left over at the end are zeros and mean nothing.
][
  Los bits, en orden, son las *casillas de datos* del código QR leídas fila a fila, de izquierda a derecha, como al escribir: #T21.data_modules casillas para 12 palabras (21 × 21 cuadros) o #T25.data_modules para 24 palabras (25 × 25). Después vienen 5 bits de cabecera: `00` (la versión del formato) y 3 bits con el número de *máscara* del QR. Los bits que sobran al final son ceros y no significan nada.
]

#tr[
  The templates at the end of this booklet have every fixed part of the QR code already drawn — the three big squares, the dotted lines, and the 15 *format cells* that depend on the mask — so there is one template per size and mask. You only fill in the white squares: *1 = dark, 0 = leave it white*.
][
  Las plantillas del final del cuadernillo traen ya dibujadas todas las partes fijas del QR —los tres cuadrados grandes, las líneas punteadas y las 15 *casillas de formato*, que dependen de la máscara—, así que hay una plantilla por tamaño y máscara. Solo se rellenan los cuadros blancos: *1 = oscuro, 0 = se deja en blanco*.
]

== #tr[A. From a sequence to the QR code][A. De una secuencia al código QR]

#step(1) #tr[*Find the start.* At one end, the first objects are all different from each other: that is the dictionary. Count them: that is N. If both ends look like that, try one; if the QR code does not scan, try from the other end.][*Busca el principio.* En uno de los extremos, los primeros objetos son todos distintos entre sí: es el diccionario. Cuéntalos: eso es N. Si los dos extremos lo parecen, prueba uno; si el QR no se lee, empieza por el otro.]

#step(2) #tr[*Copy the dictionary* onto the worksheet: draw or name each object next to its number (0, 1, 2…).][*Copia el diccionario* en la hoja de trabajo: dibuja o nombra cada objeto junto a su número (0, 1, 2…).]

#step(3) #tr[*Write the numbers.* For each object after the dictionary, write its number in the next box of the worksheet. Count the boxes: with the table above, that tells 12 words (21 × 21) or 24 words (25 × 25).][*Escribe los números.* Para cada objeto después del diccionario, escribe su número en la siguiente casilla de la hoja de trabajo. Cuenta las casillas: con la tabla de arriba sabrás si son 12 palabras (21 × 21) o 24 (25 × 25).]

#step(4) #tr[*Turn each number into bits* with the conversion table (column k), and write them under it.][*Convierte cada número en bits* con la tabla de conversión (columna k) y escríbelos debajo.]

#step(5) #tr[*Read the header.* Count #T21.data_modules bits (12 words) or #T25.data_modules bits (24 words) from the start; the next five should be `00` followed by the mask's three bits. Take the template for that size and mask.][*Lee la cabecera.* Cuenta #T21.data_modules bits (12 palabras) o #T25.data_modules (24 palabras) desde el principio; los cinco siguientes deben ser `00` seguido de los tres bits de la máscara. Coge la plantilla de ese tamaño y máscara.]

#step(6) #tr[*Fill the white squares* row by row, left to right: 1 = colour it dark (a black felt-tip works best), 0 = leave it. The number at the right of each row says how many white squares it has: tick each row off as you finish it.][*Rellena los cuadros blancos* fila a fila, de izquierda a derecha: 1 = píntalo oscuro (mejor con rotulador negro), 0 = déjalo. El número a la derecha de cada fila dice cuántos cuadros blancos tiene: márcala al terminarla.]

#step(7) #tr[*Scan it* with SeedSigner or NDS-Signer (“Scan a SeedQR”). One misread object is repaired by the QR code itself.][*Escanéalo* con SeedSigner o NDS-Signer («Escanear SeedQR»). El propio QR corrige un objeto mal leído.]

#tr[
  Instead of drawing, you can lay the QR code out on a fusible-bead pegboard (usually 29 × 29 pegs) or a Lego baseplate, with dark and light pieces.
][
  En vez de dibujarlo, puedes montar el QR en un tablero de cuentas Hama (suelen tener 29 × 29 pinchos) o en una base de Lego, con piezas oscuras y claras.
]

#note[
  #tr[
    *If the sequence was made with a PIN,* the QR code you draw is the *scrambled* one: a signer reads it as a different, empty wallet. Undoing the PIN needs a computation that cannot be done by hand: read the sequence with the Seedcraft web tool, offline, and type the PIN there.
  ][
    *Si la secuencia se hizo con un PIN,* el QR que dibujes es el *revuelto*: un firmador lo lee como otra cartera, vacía. Deshacer el PIN necesita un cálculo que no se puede hacer a mano: lee la secuencia con la herramienta web de Seedcraft, sin conexión, y escribe ahí el PIN.
  ]
]

== #tr[B. From a SeedQR to a sequence][B. De un SeedQR a una secuencia]

#step(1) #tr[*Show the CompactSeedQR* on your signer: in SeedSigner, Backup Seed → Export as SeedQR → Compact (it shows it zone by zone so you can copy it); NDS-Signer has a SeedQR map. It must be the *Compact* kind: 21 × 21 for 12 words, 25 × 25 for 24.][*Muestra el CompactSeedQR* en tu firmador: en SeedSigner, Backup Seed → Export as SeedQR → Compact (lo enseña por zonas para copiarlo); NDS-Signer tiene un mapa del SeedQR. Debe ser del tipo *compacto*: 21 × 21 para 12 palabras, 25 × 25 para 24.]

#step(2) #tr[*Find its mask.* Compare row 9 and column 9 next to its top-left big square with the drawings of the mask table: one matches. Take the template for that size and mask: its grey and black squares match the code too.][*Averigua su máscara.* Compara la fila 9 y la columna 9 junto a su cuadrado grande de arriba a la izquierda con los dibujos de la tabla de máscaras: uno coincide. Coge la plantilla de ese tamaño y máscara: sus cuadros grises y negros también coinciden con el código.]

#step(3) #tr[*Read the data cells* — the squares that are white on the template — row by row, left to right: dark = 1, light = 0. Write the bits in groups of k in the worksheet boxes.][*Lee las casillas de datos* —los cuadros que en la plantilla están en blanco— fila a fila, de izquierda a derecha: oscuro = 1, claro = 0. Escribe los bits en grupos de k en las casillas de la hoja de trabajo.]

#step(4) #tr[*Add the header*: `00` and the mask's three bits. Complete the last group with zeros.][*Añade la cabecera*: `00` y los tres bits de la máscara. Completa el último grupo con ceros.]

#step(5) #tr[*Turn each group into its number* with the conversion table, and string the objects: first the dictionary (the objects for 0, 1, … N − 1), then one object per number.][*Convierte cada grupo en su número* con la tabla de conversión y ensarta los objetos: primero el diccionario (los objetos del 0, 1, … N − 1) y después un objeto por número.]

#tr[
  A PIN cannot be added by hand. If your signer chose a different mask from the one Seedcraft's software would pick, your sequence is still valid: readers try every mask.
][
  Un PIN no se puede añadir a mano. Si tu firmador eligió una máscara distinta de la que elegiría el programa de Seedcraft, tu secuencia sigue siendo válida: los lectores prueban todas las máscaras.
]

// ---- worked example ---------------------------------------------------------
#pagebreak()
= #tr[Worked example][Ejemplo resuelto]

#tr[
  The NDS-Signer *test seed* (public, never use it for real funds), 12 words, with N = 16 kinds of objects (k = 4), without a PIN:
][
  La *semilla de prueba* de NDS-Signer (pública, nunca la uses con fondos reales), 12 palabras, con N = 16 tipos de objeto (k = 4), sin PIN:
]
#align(center, mono(EX.mnemonic))

#grid(columns: (auto, 1fr), column-gutter: 7mm,
  qr(example-rows, 3.6mm, counts: T21.row_counts),
  [
    #tr[
      Its CompactSeedQR uses *mask #EX.mask* (header #mono("00" + bits(EX.mask, 3))). Squares with a thin border are data cells; the rest is the template.

      The first rows with data cells are rows 1–3, with 4 cells each:
    ][
      Su CompactSeedQR usa la *máscara #EX.mask* (cabecera #mono("00" + bits(EX.mask, 3))). Los cuadros con borde fino son casillas de datos; el resto es la plantilla.

      Las primeras filas con casillas de datos son la 1, la 2 y la 3, con 4 casillas cada una:
    ]
    #table(columns: 4, align: center, stroke: 0.4pt + luma(170), inset: 5pt,
      [#tr[row][fila]], [bits], [#tr[number][número]], [#tr[object][objeto]],
      ..range(3).map(i => (str(i + 1), mono(EX.bits.slice(4 * i, 4 * i + 4)), str(EX.symbols.at(i)), bead(EX.symbols.at(i)))).flatten())
    #tr[
      Bits #(EX.data_modules + 1)–#(EX.data_modules + 5) are the header: #mono(EX.bits.slice(EX.data_modules, EX.data_modules + 5)). The last #(EX.bits.len() - EX.data_modules - 5) bits are padding zeros.
    ][
      Los bits #(EX.data_modules + 1)–#(EX.data_modules + 5) son la cabecera: #mono(EX.bits.slice(EX.data_modules, EX.data_modules + 5)). Los #(EX.bits.len() - EX.data_modules - 5) últimos son ceros de relleno.
    ]
  ])

#v(2mm)
#tr[
  The whole sequence: the dictionary (the 16 objects, here numbered 0–15), then the #EX.symbols.len() symbols — #(16 + EX.symbols.len()) objects. Check your own reading against it, five at a time:
][
  La secuencia completa: el diccionario (los 16 objetos, aquí numerados del 0 al 15) y después los #EX.symbols.len() símbolos: #(16 + EX.symbols.len()) objetos. Comprueba tu lectura con ella, de cinco en cinco:
]

#block(width: 100%, inset: (y: 2mm))[
  #text(9pt)[#tr[Dictionary][Diccionario]:] #h(2mm) #for i in range(16) { bead(i); h(1.2mm) }
]
#block(width: 100%)[
  #for (i, s) in EX.symbols.enumerate() {
    if calc.rem(i, 5) == 0 and i > 0 { h(3mm) }
    bead(s); h(0.9mm)
  }
]

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
#grid(columns: 4, column-gutter: 6mm, row-gutter: 5mm,
  ..range(8).map(m => align(center)[
    #qr(T21.masks.at(m).slice(0, 9).map(r => r.slice(0, 9)), 3.4mm, labels: false)
    #v(-1mm)
    *#tr[mask][máscara] #m* · #mono(bits(m, 3))
  ]))

// ---- worksheet --------------------------------------------------------------
#pagebreak()
= #tr[Worksheet][Hoja de trabajo]
#text(9.5pt)[#tr[Destroy it when you finish. Dictionary: draw or name each object. Then one box per object after the dictionary: its number above, its bits below.][Destrúyela al terminar. Diccionario: dibuja o nombra cada objeto. Después, una casilla por objeto tras el diccionario: su número arriba y sus bits debajo.]]

#let dict-box(i) = box(width: 100%, height: 9mm, stroke: 0.5pt + luma(150), inset: 2pt, text(7pt, fill: luma(110), str(i)))
#grid(columns: (1fr,) * 16, column-gutter: 1mm, row-gutter: 1mm, ..range(32).map(dict-box))
#v(2mm)
#let sym-box(i) = box(width: 100%, height: 12.2mm, stroke: 0.5pt + luma(150), inset: 2pt)[
  #text(6.5pt, fill: luma(110), str(i + 1))
  #place(bottom + left, dy: -4.6mm, line(length: 100%, stroke: 0.3pt + luma(200)))
]
#grid(columns: (1fr,) * 10, column-gutter: 1mm, row-gutter: 1mm, ..range(130).map(sym-box))

// ---- templates --------------------------------------------------------------
#let template(T, m) = {
  pagebreak()
  [= #tr[Template][Plantilla] #T.size × #T.size · #tr[mask][máscara] #m]
  text(9.5pt)[
    #tr[#T.words words · header][#T.words palabras · cabecera] #mono("00" + bits(m, 3)) ·
    #tr[fill the white squares row by row, left to right: 1 = dark, 0 = leave white. Right column: white squares in that row.][rellena los cuadros blancos fila a fila, de izquierda a derecha: 1 = oscuro, 0 = en blanco. Columna derecha: cuadros blancos de esa fila.]
  ]
  v(4mm)
  align(center, qr(T.masks.at(m), if T.size == 21 { 7mm } else { 6mm }, counts: T.row_counts))
}
#for m in range(8) { template(T21, m) }
#for m in range(8) { template(T25, m) }
