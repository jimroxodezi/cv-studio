# Vendored LaTeX packages

Debian ships these in `texlive-latex-recommended` and `texlive-latex-extra`,
which together are hundreds of megabytes. The app needs only these files, so
they are copied into `TEXMFHOME` instead of installing the bundles.

- `titlesec.sty` — CTAN, `macros/latex/contrib/titlesec`, MIT licence.
- `enumitem.sty` — CTAN, `macros/latex/contrib/enumitem`, LPPL 1.3.
- `microtype.sty`, `microtype-pdftex.def`, `microtype.cfg`, `mt-cmr.cfg` —
  CTAN, `macros/latex/contrib/microtype`, LPPL 1.3. Only the Computer Modern
  config is kept: with T1 and Latin Modern, `microtype.cfg` aliases `lmr` to
  `cmr`, so no other `mt-*.cfg` is ever loaded.
- `ragged2e.sty` — CTAN, `macros/latex/contrib/ragged2e`, LPPL 1.3.
- `etoolbox.sty` — CTAN, `macros/latex/contrib/etoolbox`, LPPL 1.3.

titlesec and enumitem were downloaded from CTAN. The rest came from Debian
bookworm's TeX Live 2022 packages, so they match `texlive-latex-base` in the
image. Keep the copyright headers intact when updating.
