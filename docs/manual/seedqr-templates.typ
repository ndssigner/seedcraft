// SeedQR templates: copy a SeedQR (Standard or Compact) from SeedSigner, or a
// compatible signer like NDS-Signer, onto paper with the fixed parts drawn.
//     docs/manual/build.sh        (both languages, reproducible)

#import "common.typ": *
#show: doc.with(
  title: tr[SeedQR templates][Plantillas para SeedQR],
  footer: [Seedcraft — #tr[SeedQR templates][plantillas para SeedQR]])

#align(center)[
  #v(4mm)
  #text(24pt, weight: "bold")[#tr[SeedQR templates][Plantillas para SeedQR]]
  #v(-2mm)
  #text(13pt)[#tr[for SeedSigner and compatible signers, like NDS-Signer][para SeedSigner y firmadores compatibles, como NDS-Signer]]
  #v(1mm)
  #text(10pt, fill: luma(90))[github.com/ndssigner/seedcraft]
]
#v(3mm)

#tr[
  A *SeedQR* is a QR code that holds a BIP-39 seed, to be copied by hand onto paper or metal and scanned instead of typing the words. Copying one square by square is slow. These templates already have every fixed part drawn — the three big squares, the dotted lines, the small square and the *format cells* — so you only copy the white squares. There is one template per size and *mask*.
][
  Un *SeedQR* es un código QR que guarda una semilla BIP-39, para copiarlo a mano en papel o metal y escanearlo en vez de teclear las palabras. Copiarlo cuadro a cuadro es lento. Estas plantillas traen ya dibujadas todas las partes fijas —los tres cuadrados grandes, las líneas punteadas, el cuadrado pequeño y las *casillas de formato*—, así que solo se copian los cuadros blancos. Hay una plantilla por tamaño y *máscara*.
]

#note[
  #tr[
    *A filled template is your seed.* Fill it in alone, offline, and keep it as safe as the words. Use a permanent black pen: pencil fades and smudges.
  ][
    *Una plantilla rellena es tu semilla.* Rellénala a solas, sin conexión, y guárdala tan bien como las palabras. Usa un bolígrafo negro permanente: el lápiz se borra y se emborrona.
  ]
]

== #tr[Which size][Qué tamaño]

#align(center, table(columns: 3, align: center, stroke: 0.4pt + luma(170), inset: 6pt,
  [], [*#tr[12 words][12 palabras]*], [*#tr[24 words][24 palabras]*],
  [*Standard SeedQR*], [25 × 25 · #T25.data_modules #tr[squares][cuadros]], [29 × 29 · #T29.data_modules #tr[squares][cuadros]],
  [*CompactSeedQR*], [21 × 21 · #T21.data_modules #tr[squares][cuadros]], [25 × 25 · #T25.data_modules #tr[squares][cuadros]],
))

#tr[
  The Compact kind is smaller, so quicker to copy; both kinds hold the same seed and every signer that reads one reads the other. A 25 × 25 template is the same for a 12-word Standard and a 24-word Compact SeedQR.
][
  El tipo compacto es más pequeño y se copia antes; los dos guardan la misma semilla y los firmadores que leen uno leen el otro. La plantilla de 25 × 25 sirve igual para un SeedQR estándar de 12 palabras que para uno compacto de 24.
]

== #tr[How][Cómo]

#step(1) #tr[*Show the SeedQR* on your signer. In SeedSigner: Backup Seed → Export as SeedQR, then pick a size (for example “Compact: 21x21”). It shows the code zone by zone, with a grid, so it can be copied.][*Muestra el SeedQR* en tu firmador. En SeedSigner: Backup Seed → Export as SeedQR, y elige un tamaño (por ejemplo «Compact: 21x21»). Enseña el código por zonas, con una cuadrícula, para poder copiarlo.]

#step(2) #tr[*Find its mask.* Look at row 9 and column 9 next to the top-left big square, and find the matching drawing in the mask table (next page).][*Averigua su máscara.* Mira la fila 9 y la columna 9 junto al cuadrado grande de arriba a la izquierda, y busca el dibujo que coincide en la tabla de máscaras (página siguiente).]

#step(3) #tr[*Take the template* for that size and mask. Its black and grey squares match the code; grey means light.][*Coge la plantilla* de ese tamaño y máscara. Sus cuadros negros y grises coinciden con el código; gris quiere decir claro.]

#step(4) #tr[*Copy the white squares* row by row, left to right: fill in the dark ones, leave the light ones. The number at the right of each row says how many white squares it has.][*Copia los cuadros blancos* fila a fila, de izquierda a derecha: rellena los oscuros y deja los claros. El número a la derecha de cada fila dice cuántos cuadros blancos tiene.]

#step(5) #tr[*Check it*: scan the copy with the signer (SeedSigner offers “Confirm SeedQR” after showing it). If it does not scan, compare row by row.][*Compruébalo*: escanea la copia con el firmador (SeedSigner ofrece «Confirm SeedQR» después de mostrarlo). Si no se lee, compara fila a fila.]

#pagebreak()
== #tr[Masks][Máscaras]
#tr[The top-left corner of a SeedQR (rows and columns 1–9). Its 15 format cells — row 9 and column 9 — tell the mask, the same in every size.][La esquina superior izquierda de un SeedQR (filas y columnas 1–9). Sus 15 casillas de formato —la fila 9 y la columna 9— dicen la máscara, igual en todos los tamaños.]
#v(2mm)
#align(center, mask-table())

#for m in range(8) { template(T21, m, [CompactSeedQR · #tr[12 words][12 palabras]]) }
#for m in range(8) { template(T25, m, [Standard SeedQR · #tr[12 words][12 palabras] · CompactSeedQR · #tr[24 words][24 palabras]]) }
#for m in range(8) { template(T29, m, [Standard SeedQR · #tr[24 words][24 palabras]]) }
