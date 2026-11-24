# Working on CueMark

CueMark is a screenwriting app that ships as one file, `index.html`.

- Edit the pieces in `src/`, then run `./build.sh`. Do not edit `index.html` by hand.
- `CHANGELOG.md` is the single source for versions. Its first `## x.y.z (date)` heading is the current version. The build stamps it into the page and embeds the file for the in-app Version history window.
- A new top-level element in `src/body.html` must also be added to the `mine` list in `src/a_core.js`, or the copy saved by Download software will be missing it.

## Every change to `main`

1. Add an entry at the top of `CHANGELOG.md` with a new version number and plain-language notes.
2. Run `./build.sh` and test.
3. Commit and push `main`.
4. Push the same commit to `gh-pages` (`git push origin main:gh-pages`). The live page, https://cassaphim.github.io/CueMark/, is served from that branch.
5. Post an update summary to the owner: version, what changed, the commit, and the links.

The changelog entry and the commit message are the summary on GitHub. Releases and tags cannot be created from a Claude session; the owner can publish a release from the repo page if they want one.
A change that leaves the app untouched (README, this file) needs no new version, but still gets a summary.
