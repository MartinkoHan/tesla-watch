#!/usr/bin/env node
// Builds the page (index.html) and the e-mail (out/email.html, out/email.txt, out/subject.txt)
// from data/cars.json. All design lives in templates/page.html and in the e-mail functions below.
// Usage:  node build.js            (yesterday's state = data/cars.json at git HEAD)
//         node build.js --prev f   (yesterday's state = file f; used for testing)
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = __dirname;
const rd = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const wr = (f, s) => { fs.mkdirSync(path.dirname(path.join(ROOT, f)), { recursive: true }); fs.writeFileSync(path.join(ROOT, f), s); };

const SITE = "https://tesla.han.sk";
const CAP = 55000, KM_CAP = 70000, SK_NEAR_MISS = 57000;
const COUNTRY = { SK: "Slovakia", CZ: "Czechia", AT: "Austria", DE: "Germany" };
const VAT_HOME = { DE: 1.19, AT: 1.20, CZ: 1.21 };
const HW4 = {
  juniper: ["HW4 (every Juniper has it)", "good"],
  confirmed: ["HW4 confirmed", "good"],
  seller: ["HW4 according to the seller", "good"],
  likely: ["HW4 likely", "good"],
  unconfirmed: ["HW4 not confirmed", "warn"],
};
const AUTOPILOT = { basic: ["Basic Autopilot", "warn"], enhanced: ["Enhanced Autopilot", "good"], fsd: ["FSD included", "good"] };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const eur = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " €";
const num = n => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const day = (iso, year = true) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]}${year ? " " + y : ""}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + "s"}`;

function transport(c) {
  const d = c.distanceKm;
  if (c.country === "SK") return 0;
  if (c.country === "CZ") return d <= 200 ? 300 : 350;
  if (c.country === "AT") return d <= 150 ? 200 : d <= 300 ? 300 : 350;
  return d <= 700 ? 550 : d <= 1000 ? 700 : 850; // DE
}

// Adds every computed field the page and the e-mail show. Input fields are documented in GUIDE.md.
function derive(c, updated) {
  const o = { ...c };
  const [rm, ry] = c.firstReg.split("/").map(Number);
  const [uy, um] = updated.split("-").map(Number);
  const ageMonths = (uy - ry) * 12 + (um - rm);
  o.countryName = COUNTRY[c.country];
  o.fees = c.country === "SK" ? 33 : 400;
  o.transport = transport(c);
  o.newForTax = c.country !== "SK" && (ageMonths < 6 || c.km < 6000);
  o.vat = 0; o.vatWorst = null; o.vatBest = null; o.vatNote = null;
  if (o.newForTax) {
    const r = VAT_HOME[c.country];
    const viaInvoice = Math.round(c.price / r * 0.23 - (c.price - c.price / r));
    const privately = Math.round(c.price * 0.23);
    const why = c.km < 6000 ? "under 6 000 km" : "under 6 months old";
    if (c.sellerType === "dealer") {
      o.vat = viaInvoice;
      o.vatNote = `Counts as a new vehicle for tax (${why}). The dealer invoices without ${o.countryName === "Germany" ? "German" : o.countryName === "Austria" ? "Austrian" : "Czech"} VAT and you pay 23 % Slovak VAT.`;
    } else if (c.vatInvoice) {
      o.vat = viaInvoice; o.vatWorst = privately;
      o.vatNote = `Counts as a new vehicle for tax (${why}). Assumes the seller invoices without local VAT. If it is a true private sale, Slovak VAT is 23 % of the full price.`;
    } else {
      o.vat = privately; o.vatBest = viaInvoice;
      o.vatNote = `Counts as a new vehicle for tax (${why}). Worst case shown: 23 % Slovak VAT on the full asking price. A private seller may reclaim the local VAT after selling abroad; if they take it off the price, the extra cost falls to about ${eur(viaInvoice)}. Agree this with the seller before buying.`;
    }
  }
  o.total = c.price + o.fees + o.transport + o.vat;
  o.totalWorst = o.vatWorst ? c.price + o.fees + o.transport + o.vatWorst : null;
  o.totalBest = o.vatBest != null ? c.price + o.fees + o.transport + o.vatBest : null;
  o.overCap = Math.max(0, c.price - CAP);
  [o.hw4Label, o.hw4Tone] = HW4[c.hw4];
  [o.apLabel, o.apTone] = AUTOPILOT[c.autopilot] || ["FSD not mentioned", "plain"];
  o.modelLabel = c.juniper ? "Juniper" : "2024 model, before Juniper";
  o.sellerLabel = c.sellerType === "dealer" ? "Dealer" : "Private seller";
  o.isNew = c.firstSeen === updated;
  return o;
}

function validate(data) {
  const errs = [], warn = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated || "")) errs.push(`"updated" must be a date like 2026-11-11`);
  if (!Array.isArray(data.cars)) { errs.push(`"cars" must be a list`); return { errs, warn }; }
  const ids = new Set(), urls = new Set();
  data.cars.forEach((c, i) => {
    const w = `cars[${i}] (${c.id || c.town || "?"})`;
    const need = (k, ok, msg) => { if (!ok(c[k])) errs.push(`${w}: "${k}" ${msg}`); };
    need("id", v => /^[a-z0-9-]+$/.test(v || ""), "must be lowercase letters, digits and dashes");
    need("url", v => /^https:\/\//.test(v || ""), "must be an https link to the ad");
    need("title", v => typeof v === "string" && v.length > 3, "is missing");
    need("version", v => ["Long Range", "Performance"].includes(v), `must be "Long Range" or "Performance"`);
    need("juniper", v => typeof v === "boolean", "must be true or false");
    need("price", v => Number.isInteger(v) && v > 20000 && v < 80000, "must be a whole number of euros");
    need("firstReg", v => /^(1[0-2]|[1-9])\/20\d\d$/.test(v || ""), `must look like "8/2024"`);
    need("km", v => Number.isInteger(v) && v >= 0, "must be a whole number");
    need("country", v => v in COUNTRY, "must be SK, CZ, AT or DE");
    need("town", v => typeof v === "string" && v.length > 1 && !/,/.test(v), "must be the town name only, without the country");
    need("plate", v => typeof v === "string" && v.length >= 1 && v.length <= 3, "must be the 1–3 letter district code");
    need("sellerType", v => ["private", "dealer"].includes(v), `must be "private" or "dealer"`);
    need("seller", v => typeof v === "string" && v.length > 1, "is missing");
    need("distanceKm", v => Number.isInteger(v) && v >= 0, "must be a whole number (0 for Slovak cars)");
    need("hw4", v => v in HW4, `must be one of: ${Object.keys(HW4).join(", ")}`);
    need("autopilot", v => v === null || v in AUTOPILOT, "must be null, basic, enhanced or fsd");
    need("photo", v => v === null || /^https:\/\//.test(v), "must be null or an https link");
    need("swPhoto", v => v === null || /^https:\/\//.test(v), "must be null or an https link");
    need("notes", v => Array.isArray(v) && v.length <= 4 && v.every(n => typeof n === "string" && n.length <= 160), "must be a list of at most 4 short lines");
    need("firstSeen", v => v === null || v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), "must be null or a date");
    if (ids.has(c.id)) errs.push(`${w}: id is used twice`); ids.add(c.id);
    if (urls.has(c.url)) errs.push(`${w}: url is used twice`); urls.add(c.url);
    if (c.km > KM_CAP) errs.push(`${w}: ${c.km} km is over the ${KM_CAP} km limit`);
    if (c.juniper === true && c.hw4 !== "juniper" && c.hw4 !== "confirmed") errs.push(`${w}: a Juniper has hw4 "juniper" (or "confirmed" with a screen photo)`);
    if (c.juniper === false && c.hw4 === "juniper") errs.push(`${w}: hw4 "juniper" is only for Juniper cars`);
    if (c.country === "SK" ? c.price > SK_NEAR_MISS : c.price > CAP) errs.push(`${w}: price is over the limit`);
    if (c.country !== "SK" && c.distanceKm === 0) errs.push(`${w}: distanceKm is missing`);
    if (!c.photo && !c.photoNote) warn.push(`${w}: no photo and no photoNote`);
  });
  if (data.removed !== undefined && !(Array.isArray(data.removed) && data.removed.every(r => r && typeof r.id === "string" && typeof r.reason === "string" && r.reason.length <= 160))) errs.push(`"removed" must be a list of {id, reason}`);
  for (const k of ["leftOut", "alsoChecked", "notChecked"]) if (!Array.isArray(data[k])) errs.push(`"${k}" must be a list (may be empty)`);
  const r = data.run || {};
  for (const k of ["toolCalls", "sources", "listingsOpened", "tokensLowK", "tokensHighK"]) if (!Number.isInteger(r[k])) errs.push(`run.${k} must be a whole number`);
  return { errs, warn };
}

function loadPrev() {
  const i = process.argv.indexOf("--prev");
  try {
    if (i > -1) return JSON.parse(fs.readFileSync(process.argv[i + 1], "utf8"));
    return JSON.parse(execSync("git show HEAD:data/cars.json", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString());
  } catch { return null; }
}

// ---------- e-mail ----------
const INK = "#14181c", MUTED = "#4b5563", BLUE = "#0b3aa4", RULE = "#d9ddd6";
const TONE = { new: ["#17734a", "#e6f4ec", "New"], price: ["#8a5a00", "#fdf3dc", "Price change"], sold: ["#a3261f", "#fbe9e7", "Sold"] };
const FONT = "font-family:Arial,Helvetica,sans-serif;";

function button(label, sub) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td bgcolor="${BLUE}" align="center" style="border-radius:10px;padding:18px 16px"><a href="${SITE}" style="${FONT}font-size:20px;line-height:26px;font-weight:bold;color:#ffffff;text-decoration:none;display:block">${label}</a>${sub ? `<a href="${SITE}" style="${FONT}font-size:16px;line-height:24px;color:#ffffff;text-decoration:underline;display:block;padding-top:4px">${sub}</a>` : ""}</td></tr></table>`;
}
function changeCard(kind, c, extra) {
  let [fg, bg, label] = TONE[kind];
  if (kind === "sold" && c.removedReason) label = "Removed";
  const status = [c.hw4Label, c.apLabel, c.overCap ? `${eur(c.overCap)} over budget` : null].filter(Boolean).join(", ");
  let money;
  if (kind === "sold") money = `<span style="font-size:18px;color:${MUTED};text-decoration:line-through">${eur(c.price)}</span>`;
  else money = `<span style="font-size:24px;line-height:30px;font-weight:bold;color:${INK}">${eur(c.total)}</span> <span style="font-size:15px;color:${MUTED}">total in Slovakia</span><br><span style="font-size:15px;color:${MUTED}">${kind === "price" ? `Ad price ${eur(extra.from)} → <b style="color:${INK}">${eur(c.price)}</b> (${c.price < extra.from ? "down" : "up"} ${eur(Math.abs(c.price - extra.from))})` : `Ad price ${eur(c.price)}`}</span>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr><td width="6" bgcolor="${fg}" style="border-radius:6px 0 0 6px;font-size:0">&nbsp;</td><td bgcolor="${bg}" style="border-radius:0 6px 6px 0;padding:14px 16px;${FONT}color:${INK}"><div style="font-size:13px;line-height:18px;font-weight:bold;color:${fg}">${label}</div><div style="font-size:19px;line-height:26px;font-weight:bold">${esc(c.town)}, ${c.countryName}</div><div style="font-size:15px;line-height:22px;color:${MUTED};padding-bottom:8px">${c.version} AWD, ${c.modelLabel}<br>First registered ${c.firstReg}, ${num(c.km)}\u00a0km, ${c.sellerLabel.toLowerCase()}</div><div style="line-height:24px">${money}</div>${kind === "sold" ? (c.removedReason ? `<div style="font-size:15px;line-height:22px;padding-top:6px">${esc(c.removedReason)}</div>` : "") : `<div style="font-size:15px;line-height:22px;padding-top:8px">${esc(status)}</div>${c.vatNote ? `<div style="font-size:14px;line-height:20px;color:#8a5a00;padding-top:4px">Includes ${eur(c.vat)} Slovak VAT: ${esc(c.vatNote)}</div>` : ""}<div style="padding-top:10px"><a href="${esc(c.url)}" style="font-size:16px;font-weight:bold;color:${BLUE}">View the ad</a></div>`}</td></tr></table>`;
}
function heading(t) { return `<div style="${FONT}font-size:17px;line-height:24px;font-weight:bold;color:${INK};padding:8px 0 10px">${t}</div>`; }

function bestBuys(cars) {
  const inBudget = cars.filter(c => !c.overCap);
  const min = l => l.slice().sort((a, b) => a.total - b.total)[0];
  const rows = [
    ["Cheapest overall", min(inBudget)],
    ["Cheapest Juniper", min(inBudget.filter(c => c.juniper))],
    ["Cheapest Juniper under 50 000 km", min(inBudget.filter(c => c.juniper && c.km <= 50000))],
  ].filter(r => r[1]);
  const sk = cars.filter(c => c.country === "SK").sort((a, b) => a.price - b.price);
  const skIn = sk.filter(c => !c.overCap);
  const skLine = skIn.length ? `${plural(skIn.length, "car")} within budget, from ${eur(skIn[0].price)} (${skIn[0].town})`
    : sk.length ? `nothing under ${eur(CAP)}; the closest is ${eur(sk[0].price)} in ${sk[0].town}` : `nothing close to ${eur(CAP)} today`;
  return { rows, skLine };
}

function headline(ch) {
  const parts = [];
  if (ch.new.length) parts.push(plural(ch.new.length, "new car"));
  const sold = ch.sold.filter(c => !c.removedReason).length, removed = ch.sold.length - sold;
  if (sold) parts.push(`${sold} sold`);
  if (removed) parts.push(`${removed} removed`);
  if (ch.price.length) parts.push(plural(ch.price.length, "price change"));
  return parts;
}

function email(data, cars, ch) {
  const byId = new Map(cars.map(c => [c.id, c]));
  const parts = headline(ch);
  const subject = `Tesla Model Y hunt: ${parts.join(", ")} (${day(data.updated)})`;
  const { rows, skLine } = bestBuys(cars);
  const cheapest = rows[0] && rows[0][1];
  const lead = `${plural(cars.length, "car")} on the page now.${cheapest ? ` The cheapest would cost about ${eur(cheapest.total)} registered in Slovakia (${cheapest.town}, ${cheapest.countryName}).` : ""}`;
  const r = data.run;
  const notChecked = data.notChecked.length ? ` Not read today: ${data.notChecked.join(", ")}.` : "";
  const runLines = [`Run: ${r.toolCalls} tool calls, ${r.sources} sources read, ${r.listingsOpened} listings opened.`,
    `Approx. tokens: ~${r.tokensLowK}–${r.tokensHighK} k (rough estimate from the amount of text read and written, not an exact figure or cost).`];
  const estimates = "Totals are estimates: about 400 € in Slovak fees, carrier transport to Bratislava, and 23 % Slovak VAT for cars under 6 months old or under 6 000 km. Not tax advice.";

  let body = "";
  if (ch.new.length) body += heading("New today") + ch.new.map(id => changeCard("new", byId.get(id))).join("");
  if (ch.price.length) body += heading("Price changes") + ch.price.map(p => changeCard("price", byId.get(p.id), p)).join("");
  if (ch.sold.length) body += heading("Sold or removed") + ch.sold.map(c => changeCard("sold", c)).join("");
  const best = rows.map(([label, c]) => `<tr><td style="${FONT}font-size:15px;line-height:22px;color:${MUTED};padding:8px 0;border-top:1px solid ${RULE}">${label}<br><span style="font-size:17px;color:${INK}"><b>${eur(c.total)}</b> &nbsp;${esc(c.town)}, ${c.countryName}</span></td><td align="right" valign="bottom" style="${FONT}font-size:15px;padding:8px 0;border-top:1px solid ${RULE}"><a href="${esc(c.url)}" style="color:${BLUE};font-weight:bold">Ad</a></td></tr>`).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:#ffffff"><div style="display:none;max-height:0;overflow:hidden">${esc(lead)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 14px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px"><tr><td style="${FONT}color:${INK}"><div style="font-size:14px;line-height:20px;font-weight:bold;color:${BLUE}">Tesla Model Y hunt, ${day(data.updated)}</div><h1 style="${FONT}font-size:28px;line-height:34px;margin:6px 0 10px;color:${INK}">${parts.join(", ").replace(/^./, m => m.toUpperCase())}</h1><p style="font-size:17px;line-height:25px;margin:0 0 20px;color:${INK}">${lead}</p>${button("Open the page with photos", "tesla.han.sk")}${body}${heading("Best buys right now")}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px">${best}<tr><td colspan="2" style="${FONT}font-size:15px;line-height:22px;color:${MUTED};padding:8px 0 0;border-top:1px solid ${RULE}">In Slovakia<br><span style="font-size:16px;color:${INK}">${esc(skLine.replace(/^./, m => m.toUpperCase()))}.</span></td></tr></table><div style="height:22px;font-size:0">&nbsp;</div>${button(`See all ${cars.length} cars`)}<p style="font-size:13px;line-height:19px;color:${MUTED};margin:0 0 10px">${estimates}${esc(notChecked)}</p><p style="font-size:13px;line-height:19px;color:${MUTED};margin:0">${runLines[0]}<br>${runLines[1]}</p></td></tr></table></td></tr></table></body></html>`;

  const t = [];
  t.push(`OPEN THE FULL PAGE WITH PHOTOS: ${SITE}`, "", `Tesla Model Y hunt, ${day(data.updated)}: ${parts.join(", ")}`, lead, "");
  const line = c => `${c.town}, ${c.countryName}: ${c.version} AWD, ${c.firstReg}, ${num(c.km)}\u00a0km`;
  ch.new.forEach(id => { const c = byId.get(id); t.push(`NEW   ${line(c)}. About ${eur(c.total)} in Slovakia (ad price ${eur(c.price)}). ${c.hw4Label}. ${c.url}`); });
  ch.price.forEach(p => { const c = byId.get(p.id); t.push(`PRICE ${line(c)}. ${eur(p.from)} -> ${eur(c.price)}, about ${eur(c.total)} in Slovakia. ${c.url}`); });
  ch.sold.forEach(c => t.push(c.removedReason ? `REMOVED ${line(c)}, was ${eur(c.price)}. ${c.removedReason}` : `SOLD  ${line(c)}, was ${eur(c.price)}.`));
  t.push("", "Best buys right now:", ...rows.map(([l, c]) => `- ${l}: ${eur(c.total)}, ${c.town}, ${c.countryName}`), `- In Slovakia: ${skLine}.`, "", estimates + notChecked, ...runLines, "", `Full page: ${SITE}`);
  return { subject, html, text: t.join("\n").replace(/ /g, " ") + "\n" };
}

// ---------- main ----------
const data = JSON.parse(rd("data/cars.json"));
const { errs, warn } = validate(data);
warn.forEach(w => console.log("warning: " + w));
if (errs.length) { console.error("data/cars.json has problems. Fix them and run the build again:\n- " + errs.join("\n- ")); process.exit(1); }

const prev = loadPrev();
let changes;
if (prev && prev.updated !== data.updated) {
  const before = new Map(prev.cars.map(c => [c.id, c]));
  const now = new Map(data.cars.map(c => [c.id, c]));
  changes = { date: data.updated, since: prev.updated, new: [], price: [], sold: [] };
  for (const c of data.cars) {
    const o = before.get(c.id);
    if (!o) { c.firstSeen = data.updated; changes.new.push(c.id); }
    else {
      if (c.firstSeen === undefined) c.firstSeen = o.firstSeen ?? null;
      if (o.price !== c.price) { c.priceWas = { price: o.price, until: prev.updated }; changes.price.push({ id: c.id, from: o.price }); }
      else if (o.priceWas && !c.priceWas) c.priceWas = o.priceWas;
    }
  }
  const reasons = new Map((data.removed || []).map(r => [r.id, r.reason]));
  changes.sold = prev.cars.filter(c => !now.has(c.id)).map(c => ({ ...derive(c, prev.updated), removedReason: reasons.get(c.id) || null }));
  wr("data/cars.json", JSON.stringify(data, null, 2) + "\n");
  wr("data/changes.json", JSON.stringify(changes, null, 2) + "\n");
} else {
  try { changes = JSON.parse(rd("data/changes.json")); } catch { changes = null; }
  if (!changes || changes.date !== data.updated) changes = { date: data.updated, since: null, new: [], price: [], sold: [] };
}

const cars = data.cars.map(c => derive(c, data.updated));
const payload = {
  updated: data.updated, updatedLabel: day(data.updated), sinceLabel: changes.since ? day(changes.since, false) : null,
  cap: CAP, cars, changes, leftOut: data.leftOut, alsoChecked: data.alsoChecked, notChecked: data.notChecked,
};
const page = rd("templates/page.html").replace("/*__DATA__*/null", () => JSON.stringify(payload).replace(/</g, "\\u003c"));
wr("index.html", page);

const changed = changes.new.length + changes.price.length + changes.sold.length;
fs.rmSync(path.join(ROOT, "out"), { recursive: true, force: true });
if (changed) {
  const m = email(data, cars, changes);
  wr("out/email.html", m.html); wr("out/email.txt", m.text); wr("out/subject.txt", m.subject + "\n");
}
const summary = `${changes.new.length} new, ${changes.sold.length} sold or removed, ${changes.price.length} price changes`;
wr("out/result.json", JSON.stringify({ changed: changed > 0, summary, commitMessage: `Daily update ${day(data.updated)}: ${summary}`, cars: cars.length }, null, 2) + "\n");
console.log(`Built index.html with ${cars.length} cars. Since ${changes.since || "the last run"}: ${summary}.`);
console.log(changed ? "E-mail written to out/email.html, out/email.txt and out/subject.txt." : "Nothing changed, so no e-mail was written. Do not send one.");
