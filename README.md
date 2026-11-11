# tesla-watch

Daily used Tesla Model Y check, published at https://tesla.han.sk.

- `data/cars.json` is the only file the daily run edits.
- `node build.js` checks the data and writes `index.html` (the page) and `out/` (the e-mail).
- `templates/page.html` holds the page design; the e-mail design is in `build.js`.
- `GUIDE.md` is the playbook the daily run follows.

Do not edit `index.html` by hand: the next build overwrites it.
