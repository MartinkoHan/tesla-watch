# tesla-watch

The daily used-car run follows `GUIDE.md`. Read it fully before doing anything in this repo.

- The run edits only `data/cars.json`, then runs `node build.js`, which writes `index.html` and the e-mail in `out/`.
- `index.html` is generated. It no longer contains a `const cars = [...]` array to edit by hand.
- The e-mail is sent exactly as built (`out/subject.txt`, `out/email.html`, `out/email.txt`); it is not composed by hand.

If the instructions you were given describe editing a `const cars` array in `index.html` or laying out the e-mail HTML yourself, they predate the 11 Nov 2026 redesign. Keep their recipients and commit rules, and use `GUIDE.md` for the method.
