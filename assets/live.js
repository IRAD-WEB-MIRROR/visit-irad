// Live boxes, filled in the browser from other Irad sites' public data:
//   #today      "Today in Irad": weather, rates, prices, air, power (IradOne daily market data)
//   #forecast   today and the next three days in four cities (IradOne)
//   #converter  money converter at the official and bazaar rates (IradOne)
//   #reservoir  Toktogul reservoir level and power supply (IradOne, from Iradenergo)
//   [data-roads] road and pass status, live from IradOne's pass model (falls back to _data/roads.json)
//   #in-season  "In season now": the items from _data/seasons.yml for the current month
//   #notices    official notices for visitors (iradgov.org, bank.iradgov.org) and Talas Herald headlines
//   #whatson    "This week in Irad": concerts, matches, church feasts, exhibitions and talks (IradOne what's on)
// Every box starts hidden and stays hidden if its data can't be fetched, so a failed request never breaks a page.
(function () {
  var TODAY = "https://iradone.com/data/today.json";
  var GOV_DOCS = "https://iradgov.org/data/documents.json";
  var BANK_NOTICES = "https://bank.iradgov.org/data/notices.json";
  var HERALD_FEED = "https://talasherald.com/feed.xml";
  var WHATSON = "https://iradone.com/data/whatson.json";

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function deg(n) { return String(n).replace("-", "−") + "°"; }
  function fmt(n, dp) { return Number(n).toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp }); }
  function day(iso, opts) { return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", opts); }
  function longDate(iso) { return day(iso, { day: "numeric", month: "long", year: "numeric" }); }
  function getJSON(url) {
    return fetch(url, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
  }
  function show(box, html) { box.innerHTML = html; box.hidden = false; }
  function find(list, key, val) { return (list || []).filter(function (x) { return x[key] === val; })[0]; }

  // ---- IradOne daily data: one request shared by every box that needs it ----
  var needsToday = ["today", "forecast", "converter", "reservoir"].some(function (id) { return $(id); });
  if (needsToday) {
    getJSON(TODAY).then(function (d) {
      [renderToday, renderForecast, renderConverter, renderReservoir].forEach(function (f) {
        try { f(d); } catch (e) { /* one bad box must not stop the others */ }
      });
    }).catch(function () {});
  }

  function renderToday(d) {
    var box = $("today");
    if (!box) return;
    var cities = ((d.weather && d.weather.places) || []).map(function (p) {
      return '<li><b>' + esc(p.name.en) + '</b><span class="t-temp">' + esc(p.high) + '° / ' + esc(p.low) + '°</span>' +
        '<span class="t-sky">' + esc(p.label.en) + '</span></li>';
    }).join("");
    var off = d.rates && d.rates.official && d.rates.official.usd;
    var bz = find(d.rates && d.rates.bazaar && d.rates.bazaar.rows, "code", "USD");
    var plov = find(d.prices && d.prices.food, "id", "plov");
    var bread = find(d.prices && d.prices.food, "id", "bread");
    var money = "";
    if (off) money += '<li><b>Official rate</b><span>$1 = ' + fmt(off, 2) + ' som</span></li>';
    if (bz) money += '<li><b>Bazaar changers</b><span>$1 = ' + fmt(bz.buy, 2) + ' to ' + fmt(bz.sell, 2) + ' som</span></li>';
    if (plov) money += '<li><b>Plate of plov</b><span>' + esc(plov.text) + ' som</span></li>';
    if (bread) money += '<li><b>Loaf of bread</b><span>' + esc(bread.text) + ' som</span></li>';
    var air = ((d.air && d.air.places) || []).map(function (p) {
      return '<li><b>' + esc(p.name.en) + '</b><span>AQI ' + esc(p.aqi) + ', ' + esc(p.label.en.toLowerCase()) + '</span></li>';
    }).join("");
    var power = d.power && d.power.supply && d.power.supply.en;
    if (!cities && !money) return;
    show(box,
      '<div class="today-head"><h2>Today in Irad</h2><p>' + esc(longDate(d.date)) + '</p></div>' +
      '<div class="today-cols">' +
      (cities ? '<div><h3>Weather</h3><ul class="today-weather">' + cities + '</ul>' +
        (power ? '<h3 class="today-air">Electricity</h3><p class="today-power">' + esc(power) + '</p>' : "") + '</div>' : "") +
      (money ? '<div><h3>Money and prices</h3><ul class="today-money">' + money + '</ul>' +
        (air ? '<h3 class="today-air">Air quality</h3><ul>' + air + '</ul>' : "") + '</div>' : "") +
      '</div>' +
      '<p class="today-src">Rates from the Bank of Irad and the money changers of Bazar-i Kalan; weather from the national stations; air quality from the Talas State University monitoring posts; electricity from Iradenergo. Daily market data from <a href="https://iradone.com/">IradOne</a>.</p>');
  }

  function renderForecast(d) {
    var box = $("forecast");
    if (!box) return;
    var places = (d.weather && d.weather.places) || [];
    if (!places.length) return;
    var days = (places[0].forecast || []).map(function (f) { return f.date; });
    var head = '<tr><th scope="col">City</th><th scope="col">Today</th>' + days.map(function (iso) {
      return '<th scope="col">' + esc(day(iso, { weekday: "short", day: "numeric", month: "short" })) + '</th>';
    }).join("") + '</tr>';
    function cell(high, low, label) {
      return '<td><span class="f-temp">' + esc(deg(high)) + ' / ' + esc(deg(low)) + '</span><span class="f-sky">' + esc(label) + '</span></td>';
    }
    var rows = places.map(function (p) {
      var extra = [];
      if (p.precip_mm > 0) extra.push(fmt(p.precip_mm, 1) + ' mm');
      if (p.inversion) extra.push('smoggy inversion');
      return '<tr><th scope="row">' + esc(p.name.en) + (p.elevation_m ? ' <small>' + fmt(p.elevation_m, 0) + ' m</small>' : '') + '</th>' +
        cell(p.high, p.low, p.label.en + (extra.length ? ', ' + extra.join(', ') : '')) +
        (p.forecast || []).map(function (f) { return cell(f.high, f.low, f.label.en); }).join("") + '</tr>';
    }).join("");
    show(box,
      '<h2>Now and the next three days</h2>' +
      '<div class="table-wrap"><table class="forecast"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="today-src">Highs and lows in °C from the stations at Talas, Nurzhan, Iyık Janyl and Tash-Kömür, updated ' +
      esc(longDate(d.date)) + '. Daily data from <a href="https://iradone.com/">IradOne</a>. For the passes, check the roads on <a href="https://maps.attelkom.net/">Kartalar</a> before you set off.</p>');
  }

  function renderConverter(d) {
    var box = $("converter");
    if (!box) return;
    var official = (d.rates && d.rates.official && d.rates.official.rows) || [];
    var bazaar = (d.rates && d.rates.bazaar && d.rates.bazaar.rows) || [];
    if (!official.length) return;
    var NAMES = { USD: "US dollars", EUR: "Euros", RUB: "Russian roubles", KZT: "Kazakh tenge", KGS: "Kyrgyz som", CNY: "Chinese yuan", UZS: "Uzbek sum" };
    var START = { USD: 100, EUR: 100, RUB: 5000, KZT: 25000, KGS: 5000, CNY: 500, UZS: 500000 };
    var opts = official.map(function (r) {
      return '<option value="' + esc(r.code) + '">' + esc(r.code) + ' · ' + esc(NAMES[r.code] || r.code) + '</option>';
    }).join("");
    var plov = find(d.prices && d.prices.food, "id", "plov");
    show(box,
      '<h2>Money converter</h2>' +
      '<form class="conv-form" onsubmit="return false">' +
      '<label>Amount<input id="conv-amt" type="number" inputmode="decimal" min="0" step="any" value="100"></label>' +
      '<label>Currency<select id="conv-cur">' + opts + '</select></label>' +
      '</form>' +
      '<div class="conv-out" aria-live="polite"></div>' +
      '<p class="today-src">Official rates from the Bank of Irad; bazaar rates are what the changers at Bazar-i Kalan paid this morning. The Bank of Irad <a href="https://bank.iradgov.org/notice.html?id=2026-10-09-money-changers">warns</a> that only licensed exchange offices may change money; look for a <em>valyuta almashuu</em> sign. Rates of ' +
      esc(longDate(d.date)) + ', from <a href="https://iradone.com/">IradOne</a>.</p>');
    var amt = $("conv-amt"), cur = $("conv-cur"), out = box.querySelector(".conv-out");
    function update() {
      var code = cur.value, a = parseFloat(amt.value);
      var o = find(official, "code", code), b = find(bazaar, "code", code);
      if (!o || !(a >= 0)) { out.innerHTML = ""; return; }
      var som = a / o.units * o.som;
      var html = '<div><span>At the official rate</span><b>' + fmt(som, 2) + ' som</b><small>' + fmt(o.units, 0) + ' ' + esc(code) + ' = ' + fmt(o.som, o.som < 1 ? 4 : 2) + ' som</small></div>';
      if (b) {
        var bs = a / b.units * b.buy;
        html += '<div><span>At a bazaar changer</span><b>' + fmt(bs, 2) + ' som</b><small>they buy ' + fmt(b.units, 0) + ' ' + esc(code) + ' at ' + fmt(b.buy, 2) + ', sell at ' + fmt(b.sell, 2) + '</small></div>';
      } else {
        html += '<div><span>At a bazaar changer</span><b>not quoted</b><small>the morning list has dollars, euros and roubles only</small></div>';
      }
      if (plov && plov.som) html += '<div><span>That buys</span><b>' + fmt(Math.floor(som / plov.som), 0) + ' plates of plov</b><small>at ' + esc(plov.text) + ' som a plate</small></div>';
      out.innerHTML = html;
    }
    cur.addEventListener("change", function () { amt.value = START[cur.value] || 100; update(); });
    amt.addEventListener("input", update);
    update();
  }

  function renderReservoir(d) {
    var box = $("reservoir");
    if (!box) return;
    var t = d.water && d.water.toktogul;
    if (!t) return;
    var change = t.change_mcm ? (t.change_mcm > 0 ? '+' : '−') + fmt(Math.abs(t.change_mcm), 0) + ' million m³ since yesterday' : 'no change since yesterday';
    var power = d.power && d.power.supply && d.power.supply.en;
    show(box,
      '<div class="today-head"><h2>The reservoir today</h2><p>' + esc(longDate(d.date)) + '</p></div>' +
      '<div class="res-gauge" role="img" aria-label="Toktogul reservoir ' + esc(fmt(t.fill_pct, 1)) + ' percent full"><span style="width:' + Math.max(0, Math.min(100, t.fill_pct)) + '%"></span></div>' +
      '<ul class="res-facts">' +
      '<li><b>' + fmt(t.fill_pct, 1) + '%</b><span>full</span></li>' +
      '<li><b>' + fmt(t.storage_km3, 2) + ' km³</b><span>of ' + fmt(t.total_km3, 1) + ' km³</span></li>' +
      '<li><b>' + esc((t.trend_label && t.trend_label.en) || "") + '</b><span>' + esc(change) + '</span></li>' +
      '</ul>' +
      (power ? '<p><b>Electricity:</b> ' + esc(power) + '</p>' : '') +
      '<p class="today-src">From the Iradenergo daily reservoir report, via <a href="https://iradone.com/">IradOne</a>.</p>');
  }

  // ---- "In season now": every item is in the page; show the ones for this month in Irad Time ----
  var season = $("in-season");
  if (season) {
    var now = new Date(Date.now() + 6 * 3600 * 1000);   // Irad Time is UTC+6 all year
    var month = now.getUTCMonth() + 1, shown = 0;
    Array.prototype.forEach.call(season.querySelectorAll("li[data-months]"), function (li) {
      if (li.getAttribute("data-months").indexOf(" " + month + " ") !== -1) { li.hidden = false; shown++; }
    });
    var label = season.querySelector(".season-month");
    if (label) label.textContent = now.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
    if (shown) season.hidden = false;
    // the visitor season, from the same season report as the passes and the railway (iradone.com/data/today.json)
    var line = season.querySelector(".season-line");
    if (line) getJSON(TODAY).then(function (d) {
      var se = d.season; if (!se) return;
      var L = {
        off: se.winter ? "Winter, and the off season. The high pastures are empty and the yurts are down; the Otmek old road and the Chatkal passes are shut until summer, and the Fergana Gateway " + (se.fergana_gateway === "closed" ? "is closed by snow today" : "needs chains") + ". Talas has rooms to spare, the bathhouses are warm and the bazaars sell coal by the sack."
          : "The off season. The herds are down from the mountains and the high passes are closing one by one; guesthouses in the valleys have rooms to spare and cut their prices.",
        shoulder: "The shoulder season: quiet roads, cool nights and the passes opening (or closing) with the weather. Check the road report before you go up.",
        high: "The high season: the pastures are full, the yurt camps are open and every pass is open. Book the guesthouses on the Suusamyr road ahead."
      }[se.visitor_season];
      if (L) { line.textContent = L; line.hidden = false; season.hidden = false; }
    }).catch(function () {});
  }

  // ---- Roads and passes: the season report in IradOne's today.json, live (the same as iradone.com's notices.js).
  // The page already shows the weekly report from _data/roads.json; this only replaces it when the live data arrives.
  var roadBoxes = document.querySelectorAll("[data-roads]");
  if (roadBoxes.length) {
    var IRT_MS = 6 * 3600000;
    var irt = new Date(Date.now() + IRT_MS);
    var todayIso = irt.toISOString().slice(0, 10);
    var inRange = function (from, to) {
      var md = todayIso.slice(5);
      if (from.length > 5 || to.length > 5) {
        var f = from.length > 5 ? from : todayIso.slice(0, 4) + "-" + from, t = to.length > 5 ? to : todayIso.slice(0, 4) + "-" + to;
        return todayIso >= f && todayIso <= t;
      }
      return from <= to ? md >= from && md <= to : md >= from || md <= to;
    };
    // the season section of today's numbers: the same road report as Gidromet, the Gendarmerie and IradOne
    var passStatus = function (r) {
      if (!r) return null;
      var lowTxt = ("low " + r.low + "°C").replace("-", "\u2212");
      if (r.status === "winter") return { level: "closed", label: "Closed for the season", note: "Reopens in spring." };
      if (r.status === "closed") return { level: "closed", label: "Closed", note: "snow on the pass, " + lowTxt + "." };
      if (r.status === "chains") return { level: "chains", label: "Chains required", note: (r.snow ? "snow, " : "") + lowTxt + "." };
      if (r.low <= -8 || (r.low <= -1 && r.snow)) return { level: "ice", label: "Ice: drive with care", note: lowTxt + "." };
      return { level: "open", label: "Open", note: lowTxt + "." };
    };
    getJSON(TODAY).then(function (d) {
      if (!d.season || !d.season.roads) throw new Error("no season");
      return d.season.roads;
    }).then(function (r) {
      var of = function (id) { return passStatus(r.filter(function (x) { return x.id === id; })[0]); };
      var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
      var otmek = of("otmekpass"), a = of("alabel"), k = of("kokbel"), c = of("karabuura");
      if (!a || !k) return;   // keep the weekly report
      var A = { closed: " Iradiya's flight from Talas to Tash-Kömür is the way south until it reopens.", chains: " After snowfall, traffic may go over in convoys behind the ploughs from the summit maintenance station.", ice: " Cross after 10:00 if you can.", open: " Bus passengers' IDs are checked at the summit post." };
      var K = { closed: " Use the lowland road by Kyzyl-Adyr (335 km), or the daily train.", chains: " Most drivers take the lowland road by Kyzyl-Adyr (335 km) instead.", ice: " About 28 km cross tribal pasture: give way to herds.", open: " About 28 km cross tribal pasture: give way to herds." };
      var routes = {
        otmek: { level: "open", label: "Open", note: "Open all year. Dangerous goods only from 22:00 to 05:00. The old pass road above the tunnel: " + (otmek ? otmek.label : "No report").toLowerCase() + "." },
        alabel: { level: a.level, label: a.label, note: cap(a.note) + (A[a.level] || "") },
        kokbel: { level: k.level, label: k.label, note: cap(k.note) + (K[k.level] || "") },
        qarachik: { level: "open", label: "Open", note: "Open to travellers with an ISEZ exit registration and an invitation from the clan council. The pass road beyond it to the Chatkal valley: " + (c ? c.label : "No report").toLowerCase() + "." }
      };
      var bad = [["alabel", "Fergana Gateway"], ["kokbel", "Kök-Bel road"]].filter(function (x) { return routes[x[0]].level === "closed" || routes[x[0]].level === "chains"; });
      var sky = bad.length ? "Winter conditions on the high passes: " + bad.map(function (x) { return x[1] + " " + routes[x[0]].label.toLowerCase(); }).join(", ") + "."
        : (routes.alabel.level === "ice" || routes.kokbel.level === "ice") ? "Frost and ice on the passes in the mornings. No heavy snow forecast." : "No snow or ice forecast on the passes.";
      Array.prototype.forEach.call(roadBoxes, function (box) {
        Array.prototype.forEach.call(box.querySelectorAll("[data-road]"), function (el) {
          var x = routes[el.getAttribute("data-road")];
          if (x) { el.textContent = x.label; el.className = "road-status road-" + x.level; }
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-road-note]"), function (el) {
          var x = routes[el.getAttribute("data-road-note")];
          if (x) el.textContent = x.note;
        });
        Array.prototype.forEach.call(box.querySelectorAll("[data-road-weather]"), function (el) { el.textContent = sky; });
        Array.prototype.forEach.call(box.querySelectorAll("[data-road-updated]"), function (el) {
          el.textContent = "Live: " + irt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
        });
      });
    }).catch(function () { /* keep the weekly report */ });
  }

  // ---- Official notices and Herald headlines ----
  var notices = $("notices");
  if (notices) {
    // Only notices a visitor needs: money, payments, entry and travel, holidays, elections.
    var RELEVANT = /dollar|currenc|money|cash|exchange|rate of the som|payment|visa|entry|border|crossing|holiday|election|road|travel|touris|photograph/i;
    var docs = getJSON(GOV_DOCS).then(function (j) {
      return (j.documents || []).map(function (x) { return { x: x, url: "https://iradgov.org/decrees.html#" + encodeURIComponent(x.id) }; });
    }).catch(function () { return []; });
    var bank = getJSON(BANK_NOTICES).then(function (j) {
      return (j.notices || []).map(function (x) { return { x: x, url: "https://bank.iradgov.org/notice.html?id=" + encodeURIComponent(x.id) }; });
    }).catch(function () { return []; });
    var herald = fetch(HERALD_FEED, { cache: "no-cache" }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        var xml = new DOMParser().parseFromString(txt, "application/xml");
        return Array.prototype.slice.call(xml.querySelectorAll("item"), 0, 4).map(function (it) {
          var g = function (tag) { var n = it.querySelector(tag); return n ? n.textContent.trim() : ""; };
          return { title: g("title"), link: g("link"), date: g("pubDate"), cat: g("category") };
        }).filter(function (i) { return i.title && /^https:\/\/talasherald\.com\//.test(i.link); });
      }).catch(function () { return []; });

    Promise.all([bank, docs, herald]).then(function (res) {
      var seen = {}, list = [];
      res[0].concat(res[1]).forEach(function (o) {
        var x = o.x, title = x.title && x.title.en;
        if (!title || x.kind === "draft") return;
        if (!RELEVANT.test(title) || /tulparcoin/i.test(title)) return;
        var key = title.toLowerCase();
        if (seen[key]) return;
        seen[key] = 1;
        list.push({ date: x.date, title: title, url: o.url, issuer: (x.issuer && x.issuer.en) || (/bank\./.test(o.url) ? "Bank of Irad" : "Office of the Governor"), status: x.status && x.status.en });
      });
      list.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
      list = list.slice(0, 5);
      var news = res[2];
      if (!list.length && !news.length) return;
      var left = list.length ? '<div><h3>Official notices for visitors</h3><ul class="notice-list">' + list.map(function (n) {
        return '<li><small>' + esc(day(n.date, { day: "numeric", month: "short", year: "numeric" })) + ' · ' + esc(n.issuer) + (n.status ? ' · ' + esc(n.status) : '') + '</small>' +
          '<a href="' + esc(n.url) + '">' + esc(n.title) + '</a></li>';
      }).join("") + '</ul></div>' : "";
      var right = news.length ? '<div><h3>Latest from The Talas Herald</h3><ul class="notice-list">' + news.map(function (n) {
        var dm = /^\w+, (\d+ \w+)/.exec(n.date);   // the feed's own date, in Irad Time
        return '<li><small>' + (dm ? esc(dm[1]) : "") + (n.cat ? ' · ' + esc(n.cat) : '') + '</small>' +
          '<a href="' + esc(n.link) + '">' + esc(n.title) + '</a></li>';
      }).join("") + '</ul></div>' : "";
      show(notices,
        '<div class="today-head"><h2>Before you travel</h2><p>Updated automatically</p></div>' +
        '<div class="today-cols">' + left + right + '</div>' +
        '<p class="today-src">Notices from the <a href="https://iradgov.org/decrees.html">Office of the Governor</a> and the <a href="https://bank.iradgov.org/notices.html">Bank of Irad</a>; news from <a href="https://talasherald.com/">The Talas Herald</a>.</p>');
    });
  }

  // ---- This week in Irad: one list of coming events from every venue (IradOne what's on) ----
  var whatson = $("whatson");
  if (whatson) {
    getJSON(WHATSON).then(function (d) {
      var KIND = { concert: "Music", exhibition: "Exhibition", feast: "Church", match: "Football", lecture: "Talk", other: "Event" };
      var en = function (v) { return v && typeof v === "object" ? (v.en || "") : (v || ""); };
      var iso = function (t) { return new Date(t).toISOString().slice(0, 10); };
      var today = iso(Date.now() + 6 * 3600e3);   // Irad Time, UTC+6
      var days = +whatson.getAttribute("data-days") || 7, limit = +whatson.getAttribute("data-limit") || 8;
      var upto = function (n) { return iso(Date.parse(today + "T12:00:00Z") + n * 864e5); };
      var all = (d.events || []).filter(function (e) { return e.date && en(e.title); });
      var dated = function (until) {
        return all.filter(function (e) { return !e.end && e.date >= today && e.date <= until; });
      };
      var soon = dated(upto(days));
      if (soon.length < 3) soon = dated(upto(days * 2));   // a quiet week: look a little further ahead
      soon.sort(function (a, b) { return (a.date + (a.time || "")) < (b.date + (b.time || "")) ? -1 : 1; });
      // A mix, not a fixture list: at most three matches, then everything else in date order.
      var per = { match: 3 }, seen = {};
      soon = soon.filter(function (e) { seen[e.kind] = (seen[e.kind] || 0) + 1; return seen[e.kind] <= (per[e.kind] || 4); }).slice(0, limit);
      var running = all.filter(function (e) { return e.end && e.date <= today && e.end >= today; }).slice(0, 3);
      if (!soon.length && !running.length) return;
      var item = function (e, when) {
        var where = [e.venue, e.city].filter(Boolean).join(", ");
        var title = e.url ? '<a href="' + esc(e.url) + '">' + esc(en(e.title)) + '</a>' : esc(en(e.title));
        return '<li><small>' + esc(when) + ' · ' + esc(KIND[e.kind] || "Event") + '</small>' + title +
          (where ? '<span class="whatson-where">' + esc(where) + (e.price ? ' · ' + esc(en(e.price)) : '') + '</span>' : '') + '</li>';
      };
      var list = soon.map(function (e) {
        return item(e, (e.date === today ? "Today" : day(e.date, { weekday: "short", day: "numeric", month: "short" })) + (e.time ? ", " + e.time : ""));
      }).join("");
      var now = running.map(function (e) { return item(e, "Until " + day(e.end, { day: "numeric", month: "long" })); }).join("");
      show(whatson,
        '<div class="today-head"><h2>This week in Irad</h2><p>' + esc(longDate(today)) + '</p></div>' +
        '<div class="today-cols">' +
        (list ? '<div><h3>Coming up</h3><ul class="notice-list">' + list + '</ul></div>' : "") +
        (now ? '<div><h3>On now</h3><ul class="notice-list">' + now + '</ul></div>' : "") +
        '</div>' +
        '<p class="today-src">Concerts, matches, church feasts, exhibitions and talks from the venues themselves, gathered daily by <a href="https://iradone.com/">IradOne</a>. Times are Irad Time; check with the venue before you travel.</p>');
    }).catch(function () {});
  }
})();
