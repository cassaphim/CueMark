# CueMark
This is a movie writing software based on Celtx

**Open it:** https://cassaphim.github.io/CueMark/

## What it does

- Film screenplay and stage play formats, with a right-click menu for every script element
- A Cast of Characters page that gives each character a color and marks them through the script
- A scene index that builds itself as you write
- Clean export in standard Courier, with no colors or notes
- **Download software** saves the app as one HTML file that runs offline; **Download script** saves the script as a PDF
- **Open** reads Word (.docx), Apple Pages (.pages) and plain text files and formats them into script elements

## Versions

The current version shows in the app's top bar. [CHANGELOG.md](CHANGELOG.md) lists what changed in each one.

## Files

- `index.html` is the whole app.
- `src/` holds the pieces it is built from. Run `./build.sh` to put `index.html` back together after a change.
- `CHANGELOG.md` sets the version number. The build reads its first heading.
