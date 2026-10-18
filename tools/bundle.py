"""The release bundle: dist/seedcraft-<version>.zip and dist/SHA256SUMS (its
hash; the files inside have their own SHA256SUMS).

    node web/build.mjs && docs/manual/build.sh
    python3 tools/bundle.py v0.1.0

Reproducible: fixed order, dates and permissions, and stored (not
compressed) so the bytes do not depend on the zlib version. The PDFs are
already compressed. Anyone can rebuild it and compare its SHA-256.
"""
import hashlib
import pathlib
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = [  # (path in the repository, name in the bundle)
    ("dist/seedcraft.html", "seedcraft.html"),
    ("docs/seedcraft-by-hand-en.pdf", "seedcraft-by-hand-en.pdf"),
    ("docs/seedcraft-by-hand-es.pdf", "seedcraft-by-hand-es.pdf"),
    ("docs/seedqr-templates-en.pdf", "seedqr-templates-en.pdf"),
    ("docs/seedqr-templates-es.pdf", "seedqr-templates-es.pdf"),
    ("SPEC.md", "SPEC.md"),
    ("RISK-AUDIT.md", "RISK-AUDIT.md"),
    ("README.es.md", "README.es.md"),
    ("SPEC.es.md", "SPEC.es.md"),
    ("RISK-AUDIT.es.md", "RISK-AUDIT.es.md"),
    ("LICENSE", "LICENSE"),
]

README = """SeedCraft {version}
https://github.com/ndssigner/seedcraft

Notice: SeedCraft is a mathematics exercise with a creative and artistic
spirit, offered as is, without any warranty. No one independent has audited
it yet. With a real seed, use it only on an offline computer and at your own
risk; online, test seeds only. Let no one see your screen: it shows seeds
and QR codes that a camera can capture from afar.

seedcraft.html      Web tool. Open it in a browser, offline: make a
                              sequence of things from a test seed, print a
                              sheet for whoever makes it, read one back. It
                              cannot connect anywhere.
seedcraft-by-hand-*.pdf       From a sequence to its QR code and back, with a
                              pencil: guide, example, tables, templates.
seedqr-templates-*.pdf        Templates to copy a SeedQR (Standard or Compact)
                              from SeedSigner or a compatible signer, like
                              NDS-Signer, with the fixed parts already drawn.
SPEC.md             The specification (…es.md: in Spanish).
RISK-AUDIT.md                 What each mode protects against, and the
                              evidence.
SHA256SUMS                    Check the files: sha256sum -c SHA256SUMS

Aviso: SeedCraft es un ejercicio de matemáticas con espíritu creativo y
artístico, y se ofrece tal cual, sin ninguna garantía. Nadie independiente
lo ha auditado todavía. Con una semilla real, úsalo solo en un ordenador
desconectado y bajo tu propia responsabilidad; en línea, solo semillas de
prueba. Que nadie vea tu pantalla: muestra semillas y códigos QR que una
cámara puede captar desde lejos.

seedcraft.html      Herramienta web. Ábrela en un navegador, sin
                              conexión: haz una secuencia de cosas con una
                              semilla de prueba, imprime una hoja para quien
                              la monte, léela. No puede conectarse a nada.
seedcraft-by-hand-*.pdf       De una secuencia a su QR y al revés, con un
                              lápiz: guía, ejemplo, tablas, plantillas.
seedqr-templates-*.pdf        Plantillas para copiar un SeedQR (estándar o
                              compacto) de SeedSigner o un firmador
                              compatible, como NDS-Signer, con las partes
                              fijas ya dibujadas.
SPEC.md             La especificación.
RISK-AUDIT.md                 De qué protege cada modo y de qué no, con las
                              pruebas.
SHA256SUMS                    Comprueba los ficheros: sha256sum -c SHA256SUMS
"""


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def add(z, name, data):
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.external_attr = 0o644 << 16
    info.create_system = 3  # Unix, whatever the host
    z.writestr(info, data, compress_type=zipfile.ZIP_STORED)


def main():
    version = sys.argv[1]
    top = "seedcraft-%s/" % version
    contents = [(name, (ROOT / path).read_bytes()) for path, name in FILES]
    contents.append(("README.txt", README.format(version=version).encode()))
    sums = "".join("%s  %s\n" % (sha256(data), name) for name, data in contents)
    contents.append(("SHA256SUMS", sums.encode()))
    out = ROOT / "dist" / ("seedcraft-%s.zip" % version)
    out.parent.mkdir(exist_ok=True)
    with zipfile.ZipFile(out, "w") as z:
        for name, data in contents:
            add(z, top + name, data)
    data = out.read_bytes()
    line = "%s  %s\n" % (sha256(data), out.name)
    (ROOT / "dist" / "SHA256SUMS").write_text(line)
    sys.stdout.write(line)


if __name__ == "__main__":
    main()
