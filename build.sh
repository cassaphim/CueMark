#!/bin/sh
# Assemble the single-file app from src/.
cd "$(dirname "$0")"
{
  printf '%s\n' '<!DOCTYPE html>' '<html lang="en">' '<head>' '<meta charset="utf-8">' '<meta name="viewport" content="width=device-width, initial-scale=1">' '<title>CueMark Script Writer</title>'
  printf '%s\n' '<link rel="preconnect" href="https://fonts.googleapis.com">' '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  printf '%s\n' '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Condensed:wght@500;600&display=swap">'
  printf '%s\n' '<style id="appcss">'; cat src/style.css; printf '%s\n' '</style>' '<style id="tagcss"></style>' '</head>' '<body>'
  cat src/body.html
  printf '%s\n' '<script>' '(function () {' "'use strict';"
  cat src/a_core.js src/b_tags.js src/c_editor.js src/d_ui.js src/e_index.js src/f_export.js src/g_boot.js
  printf '%s\n' '})();' '</script>' '</body>' '</html>'
} > index.html
wc -c index.html
