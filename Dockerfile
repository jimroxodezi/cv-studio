# syntax=docker/dockerfile:1

# ---- dependencies -------------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- build --------------------------------------------------------------
FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# next/image is unused, so sharp and its platform binaries are dead weight.
# Next also ships font-metric data for next/font, which this app never uses.
RUN rm -rf .next/standalone/node_modules/@img \
           .next/standalone/node_modules/sharp \
           .next/standalone/node_modules/next/dist/server/capsize-font-metrics.json \
           .next/standalone/node_modules/next/dist/server/font-utils.js

# ---- tex toolchain ------------------------------------------------------
# The pruned tree is copied into an empty image, so the Debian layer itself
# (about 30 MB compressed) is not shipped. Only pdflatex and Latin Modern are
# installed. The style files that Debian puts in texlive-latex-recommended/-extra
# are vendored in latex/vendor, so those bundles never enter the image.
FROM debian:bookworm-slim AS tex

# Brought in early so the strip below happens in this stage; the prune at the
# end of the RUN removes binutils again.
COPY --from=deps /usr/local/bin/node /usr/local/bin/node

# Install and prune in one layer: files removed here never reach the image.
# TeX goes from about 80 MB to about 35 MB: no other engines, no docs, and no
# package indexes.
RUN <<'EOF'
set -eu
export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y --no-install-recommends \
    texlive-latex-base \
    lmodern \
    libstdc++6 \
    binutils
rm -rf /var/lib/apt/lists/* /var/cache/apt /var/lib/apt /var/lib/dpkg

# Node ships an ELF symbol table that nothing here symbolicates: drop it.
strip --strip-unneeded /usr/local/bin/node

tex=/usr/share/texlive/texmf-dist

# LaTeX packages loaded by latex/preamble.tex and hyperref. titlesec,
# enumitem, microtype, ragged2e and etoolbox are vendored.
find "$tex/tex/latex" -mindepth 1 -maxdepth 1 -type d \
  ! -name base ! -name geometry ! -name graphics ! -name graphics-cfg \
  ! -name graphics-def ! -name hyperref ! -name url ! -name kvoptions \
  ! -name kvsetkeys ! -name refcount ! -name rerunfilecheck \
  ! -name letltxmacro ! -name auxhook ! -name atveryend ! -name hycolor \
  ! -name bookmark ! -name oberdiek ! -name firstaid ! -name latexconfig \
  ! -name l3backend ! -name l3kernel ! -name l3packages \
  -exec rm -rf {} +

# Generic helpers hyperref loads, plus glyphtounicode.
find "$tex/tex/generic" -mindepth 1 -maxdepth 1 -type d \
  ! -name atbegshi ! -name bigintcalc ! -name bitset ! -name etexcmds \
  ! -name gettitlestring ! -name iftex ! -name infwarerr ! -name intcalc \
  ! -name kvdefinekeys ! -name ltxcmds ! -name pdfescape ! -name pdftex \
  ! -name pdftexcmds ! -name uniquecounter ! -name oberdiek \
  -exec rm -rf {} +

# Latin Modern lives in /usr/share/texmf and is kept whole. The one font
# needed from texmf-dist is the EC metric fontenc uses as a fallback.
find "$tex/fonts" -type f ! -path '*/jknappen/ec/ecrm1000.tfm' -delete
find "$tex/fonts" -type d -empty -delete

rm -rf "$tex/tex/plain" "$tex/tex/context" "$tex/tex/luatex" \
       "$tex/bibtex" "$tex/makeindex" "$tex/dvips" "$tex/dvipdfmx" \
       "$tex/xdvi" "$tex/metafont" "$tex/mft" \
       "$tex/source" "$tex/doc" "$tex/texdoc" "$tex/texdoctk" "$tex/scripts"

# Package docs and tlmgr metadata: nothing at runtime reads them.
rm -rf /usr/share/texlive/tlpkg /usr/share/texlive/doc.html \
       /usr/share/texlive/readme-html.dir /usr/share/texlive/readme-txt.dir

# Only pdftex survives: its format, map, and the Latin Modern fonts.
find /var/lib/texmf/web2c -mindepth 1 -maxdepth 1 ! -name pdftex -exec rm -rf {} +
find /var/lib/texmf/web2c/pdftex -type f ! -name pdflatex.fmt -delete
find /var/lib/texmf/fonts -type f ! -name 'pdftex_dl14.map' -delete
find /var/lib/texmf/fonts -type d -empty -delete
# ls-R must stay: without it kpathsea cannot find pdflatex.fmt.
rm -rf /var/lib/texmf/tex /var/lib/texmf/dvipdfmx /var/lib/texmf/dvips \
       /var/lib/texmf/xdvi /var/lib/texmf/fmtutil.cnf-* \
       /var/lib/texmf/updmap.cfg-*

# Latin Modern only needs its Type1, TFM, encoding and map files. Perl is
# used solely by TeX helper scripts, which never run at request time.
rm -rf /usr/share/texmf/fonts/afm /usr/share/texmf/fonts/opentype \
       /usr/share/texmf/doc /usr/share/fonts /usr/share/doc \
       /usr/share/man /usr/share/info
rm -rf /usr/share/perl /usr/share/perl5 /usr/lib/x86_64-linux-gnu/perl \
       /usr/lib/x86_64-linux-gnu/perl-base /usr/lib/apt

# Debian runtime files the app never touches.
rm -rf /usr/sbin /usr/share/zoneinfo /usr/share/X11 /etc/X11 \
       /usr/share/fontconfig /etc/fonts /usr/share/bash-completion \
       /usr/share/gcc /usr/share/gdb /usr/share/bug /usr/share/dpkg \
       /usr/share/keyrings /usr/share/ca-certificates /usr/lib/locale \
       /usr/share/locale /usr/lib/x86_64-linux-gnu/security
rm -rf /var/cache/debconf /usr/share/debconf /var/lib/ucf /var/lib/systemd \
       /var/lib/pam /usr/share/pam

# Keep only the libraries node and pdftex link, plus glibc's NSS/DNS modules.
# libselinux/libpcre2 stay because /usr/bin/rm and /usr/bin/find link them and
# still run in the next step; that is cheaper than a shell-only delete.
cd /usr/lib/x86_64-linux-gnu
find . -mindepth 1 -maxdepth 1 \
  ! -name 'libc.so*' ! -name 'libm.so*' ! -name 'libmvec.so*' \
  ! -name 'libdl.so*' ! -name 'libpthread.so*' ! -name 'librt.so*' \
  ! -name 'libresolv.so*' ! -name 'libnss_dns.so*' ! -name 'libnss_files.so*' \
  ! -name 'libstdc++.so*' ! -name 'libgcc_s.so*' ! -name 'libz.so*' \
  ! -name 'libpng16.so*' ! -name 'libkpathsea.so*' ! -name 'ld-linux*' \
  ! -name 'libselinux.so*' ! -name 'libpcre2-8.so*' \
  -exec rm -rf {} +

# The runtime needs a shell, pdflatex, and nothing else from /usr/bin.
find /usr/bin -mindepth 1 -maxdepth 1 -depth \
  ! -name dash ! -name sh ! -name pdftex ! -name pdflatex ! -name env \
  -delete
EOF

# ---- runtime ------------------------------------------------------------
FROM scratch

# The pruned tree becomes the whole image: no package manager, no base layer.
COPY --from=tex / /

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MALLOC_ARENA_MAX=2 \
    NODE_OPTIONS=--max-old-space-size=384 \
    TEXMFHOME=/usr/local/share/texmf

COPY latex/vendor/*.sty latex/vendor/*.cfg latex/vendor/*.def /usr/local/share/texmf/tex/latex/cv-studio/

WORKDIR /app

# Next's standalone output already contains the traced production modules.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/latex/preamble.tex ./latex/preamble.tex
COPY --from=builder /app/package.json ./package.json

COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
