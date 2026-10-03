// Shared by the printable PDFs: language, page style, QR templates, mask table.

#let lang = sys.inputs.at("lang", default: "en")
#let tr(en, es) = if lang == "es" { es } else { en }
#let D = json("data.json")
#let T21 = D.templates.at("21")
#let T25 = D.templates.at("25")
#let T29 = D.templates.at("29")
#let EX = D.example

// 210 × 279 mm: A4 width, US Letter height, so it prints unscaled on both.
#let doc(title: none, footer: none, body) = {
  set page(width: 210mm, height: 279mm, margin: (x: 18mm, top: 16mm, bottom: 18mm),
    footer: context [
      #set text(8pt, fill: luma(110))
      #footer #h(1fr) #counter(page).display()
    ])
  set document(title: title, author: "NDS-Signer")
  set text(font: "Libertinus Serif", size: 10.5pt, lang: lang)
  set par(justify: true, leading: 0.6em)
  set heading(numbering: none)
  show heading.where(level: 1): set text(17pt)
  show heading.where(level: 2): set text(12.5pt)
  show raw: set text(font: "DejaVu Sans Mono", size: 0.9em)
  body
}
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

// the top-left corner (rows and columns 1–9) of each mask: its 15 format cells
#let mask-table(cell: 3.4mm) = block(breakable: false, grid(columns: 4, column-gutter: 6mm, row-gutter: 4mm,
  ..range(8).map(m => align(center)[
    #qr(T21.masks.at(m).slice(0, 9).map(r => r.slice(0, 9)), cell, labels: false)
    #v(-1mm)
    *#tr[mask][máscara] #m* · #mono(bits(m, 3))
  ])))

// a full-page template; what: e.g. "12 words · header 00100"
#let template(T, m, what) = {
  pagebreak()
  [= #tr[Template][Plantilla] #T.size × #T.size · #tr[mask][máscara] #m]
  text(9.5pt)[#what · #tr[fill the white squares row by row, left to right: 1 = dark, 0 = leave white. Right column: white squares in that row.][rellena los cuadros blancos fila a fila, de izquierda a derecha: 1 = oscuro, 0 = en blanco. Columna derecha: cuadros blancos de esa fila.]]
  v(4mm)
  align(center, qr(T.masks.at(m), if T.size == 21 { 7mm } else if T.size == 25 { 6mm } else { 5.1mm }, counts: T.row_counts))
}
