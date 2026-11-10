/* Visit Irad trip tools: the trip builder, the entry checker and the Hotel Talas room request.
   Everything is worked out in your browser. Nothing you type is sent anywhere or kept.
   Roads and driving times: the Kartalar road graph (maps.attelkom.net). Passes: this week's road report and today's
   season report. Prices and the dollar rate: today's numbers (iradone.com/data/today.json). */
(function () {
  "use strict";
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var getJ = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
  var TODAY = null;
  var todayP = getJ("https://iradone.com/data/today.json").catch(function () { return getJ("https://iradgov.org/data/today.json"); })
    .then(function (d) { TODAY = d; return d; }).catch(function () { return null; });

  /* ---------- shared ---------- */
  var FALLBACK = { "petrol-92": 5.4, "bus-nurzhan": 32, "marshrutka-nurzhan": 38, "bus-iyik-janyl": 45, "marshrutka-kyzyl-adyr": 30, plov: 28, taxi: 15 };
  function price(id) {
    var p = TODAY && (TODAY.prices || []).filter(function (x) { return x.id === id; })[0];
    return p && p.som ? p.som : FALLBACK[id];
  }
  function usd() { var r = TODAY && TODAY.rates && (TODAY.rates.official || []).filter(function (x) { return x.code === "USD"; })[0]; return r ? r.som : 8.4; }
  function iradToday() { return new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }
  var MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function fmtDate(s, wd) { var d = new Date(s + "T00:00:00Z"); return (wd ? DAY[d.getUTCDay()] + " " : "") + d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function som2(n) { return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " som"; }
  function som(n) { return (Math.round(n * 2) / 2).toLocaleString("en-GB", { maximumFractionDigits: 1 }) + " som"; }
  function hm(mins) { var h = Math.floor(mins / 60), m = Math.round(mins % 60); return h ? h + " h " + (m < 10 ? "0" : "") + m : m + " min"; }
  function md(s) { return +s.slice(5, 7) * 100 + +s.slice(8, 10); }
  var EXT = ' target="_blank" rel="noopener"';
  function a(url, text) { return '<a href="' + esc(url) + '"' + (/^https?:/.test(url) ? EXT : "") + ">" + esc(text) + "</a>"; }
  var BUSPARK = "https://transport.talas.iradgov.org/";
  var RAIL = "https://railways.iradgov.org/timetable.html";
  var AVIA = "https://avia.iradgov.org/schedule.html";
  var CUSTOMS = "https://customs.iradgov.org/bring.html";
  var ENTRY = "https://e-irad.org/services/entry/";
  var HOTEL = "https://wwv.attelkom.net/users/hoteltalas/";
  var KARTALAR = "https://maps.attelkom.net/";

  /* =====================================================================
     1. Trip builder
     ===================================================================== */
  var tb = $("#trip-builder");
  if (tb) getJ(tb.getAttribute("data-src")).then(function (D) { tripBuilder(tb, D); }).catch(function () {
    tb.innerHTML = '<p class="notice">The trip builder could not load its road data. Try again in a minute, or plan the drive on ' + a(KARTALAR, "Kartalar") + ".</p>";
  });

  function tripBuilder(box, D) {
    var P = {}; D.places.forEach(function (p) { P[p.key] = p; });
    var ENTRIES = [["talas", "Iradiya flight to Talas"], ["talas-north-terminal", "Talas North Terminal, by road from Shymkent"], ["chu-gate", "Chu Gate, by road from Almaty"], ["kum-shagyl", "Kum-Shagyl (seasonal)"]];
    var VISIT = D.places.filter(function (p) { return !/^(talas-north-terminal|chu-gate|kum-shagyl)$/.test(p.key); });
    var ROADS = null; try { ROADS = JSON.parse($("#trip-roads").textContent); } catch (e) { ROADS = null; }
    var st = { arrive: iradToday(), entry: "talas", exit: "talas", how: "bus", people: 2, hotel: true, stops: [["talas", 2], ["iyik-janyl", 2]] };
    if (md(st.arrive) >= 1101 || md(st.arrive) <= 331) st.stops = [["talas", 2], ["nurzhan", 2]];
    st.arrive = addDays(st.arrive, 14);

    var opts = function (list, sel) { return list.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === sel ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); };
    var visitOpts = function (sel) { return opts(VISIT.map(function (p) { return [p.key, p.name]; }), sel); };

    function form() {
      return '<form class="conv-form trip-form" onsubmit="return false">' +
        '<label>Arriving on<input type="date" id="tbArrive" value="' + st.arrive + '" required></label>' +
        '<label>Coming in by<select id="tbEntry">' + opts(ENTRIES, st.entry) + "</select></label>" +
        '<label>Leaving by<select id="tbExit">' + opts(ENTRIES.map(function (e) { return [e[0], e[1].replace(/^Iradiya flight to Talas$/, "Iradiya flight from Talas").replace(/, by road from /, ", by road to ")]; }), st.exit) + "</select></label>" +
        '<label>Getting about<select id="tbHow">' + opts([["bus", "Buses, trains and the flight"], ["car", "A car (hired with a driver, or your own)"]], st.how) + "</select></label>" +
        '<label>Travellers<input type="number" id="tbPeople" min="1" max="12" value="' + st.people + '"></label>' +
        "</form>" +
        '<h3 class="trip-h">Where you\'ll stay, in order</h3><ol class="trip-stops">' +
        st.stops.map(function (s, i) {
          return '<li><select data-i="' + i + '" class="tbPlace" aria-label="Place ' + (i + 1) + '">' + visitOpts(s[0]) + "</select>" +
            '<label><input type="number" class="tbNights" data-i="' + i + '" min="1" max="30" value="' + s[1] + '" aria-label="Nights in place ' + (i + 1) + '"> nights</label>' +
            '<span class="trip-row-btns"><button type="button" class="btn-outline tbUp" data-i="' + i + '"' + (i ? "" : " disabled") + ' aria-label="Move up">&uarr;</button>' +
            '<button type="button" class="btn-outline tbDel" data-i="' + i + '"' + (st.stops.length > 1 ? "" : " disabled") + ' aria-label="Remove">&times;</button></span></li>';
        }).join("") + "</ol>" +
        '<p class="trip-actions"><button type="button" class="btn-outline" id="tbAdd">Add a place</button> <button type="button" class="btn-outline" id="tbOrder">Put them in the shortest order</button> ' +
        '<label class="trip-check"><input type="checkbox" id="tbHotel"' + (st.hotel ? " checked" : "") + "> Count Talas nights at Hotel Talas</label></p>";
    }
    box.innerHTML = form() + '<div id="tbOut" aria-live="polite"></div>';
    function wire() {
      var on = function (id, ev, fn) { var el = $(id, box); if (el) el.addEventListener(ev, fn); };
      on("#tbArrive", "change", function (e) { if (e.target.value) { st.arrive = e.target.value; go(); } });
      on("#tbEntry", "change", function (e) { var was = st.entry; st.entry = e.target.value; if (st.exit === was) { st.exit = st.entry; $("#tbExit", box).value = st.exit; } go(); });
      on("#tbExit", "change", function (e) { st.exit = e.target.value; go(); });
      on("#tbHow", "change", function (e) { st.how = e.target.value; go(); });
      on("#tbPeople", "change", function (e) { st.people = Math.max(1, Math.min(12, +e.target.value || 1)); go(); });
      on("#tbHotel", "change", function (e) { st.hotel = e.target.checked; go(); });
      Array.prototype.forEach.call(box.querySelectorAll(".tbPlace"), function (el) { el.addEventListener("change", function () { st.stops[+el.dataset.i][0] = el.value; go(); }); });
      Array.prototype.forEach.call(box.querySelectorAll(".tbNights"), function (el) { el.addEventListener("change", function () { st.stops[+el.dataset.i][1] = Math.max(1, Math.min(30, +el.value || 1)); go(); }); });
      Array.prototype.forEach.call(box.querySelectorAll(".tbUp"), function (el) { el.addEventListener("click", function () { var i = +el.dataset.i, t = st.stops[i]; st.stops[i] = st.stops[i - 1]; st.stops[i - 1] = t; redraw(); }); });
      Array.prototype.forEach.call(box.querySelectorAll(".tbDel"), function (el) { el.addEventListener("click", function () { st.stops.splice(+el.dataset.i, 1); redraw(); }); });
      on("#tbAdd", "click", function () {
        var used = st.stops.map(function (s) { return s[0]; }), next = VISIT.filter(function (p) { return used.indexOf(p.key) < 0; })[0];
        st.stops.push([next ? next.key : "talas", 1]); redraw();
      });
      on("#tbOrder", "click", function () { shortest(); redraw(); });
    }
    function redraw() { var out = $("#tbOut", box).innerHTML; box.innerHTML = form() + '<div id="tbOut" aria-live="polite">' + out + "</div>"; wire(); go(); }
    wire();

    /* road state on a date: live this week, the usual season rules after that */
    var PASS = { otmek: "Otmek tunnel", alabel: "Fergana Gateway (Ala-Bel pass, 3,184 m)", kokbel: "Kök-Bel road", suusamyr: "Suusamyr crossing", karasuu: "Kara-Suu Canyon mouth" };
    var LBL = { open: "Open", chains: "Chains required", closed: "Closed", winter: "Closed for the winter", convoy: "Convoys behind the ploughs", ice: "Ice" };
    function roadsOn(date) {
      var m = md(date), winter = m >= 1101 || m <= 331, tbShut = m >= 1025 || m <= 430, live = null, src = "season";
      if (TODAY && TODAY.season && TODAY.season.roads && date === iradToday()) { live = {}; TODAY.season.roads.forEach(function (r) { live[r.id] = r.status; }); src = "today"; }
      else if (ROADS && date >= ROADS.updated && date < ROADS.next) { live = {}; ROADS.routes.forEach(function (r) { live[r.id] = r.status; }); src = "week"; }
      var s = {
        otmek: live && live.otmek || "open",
        alabel: live && live.alabel || (winter ? "chains" : "open"),
        kokbel: live && live.kokbel || (winter ? "chains" : "open"),
        suusamyr: tbShut ? "winter" : (live && live.suusamyr || "open"),
        karasuu: live && live.karasuu || "open"
      };
      return { s: s, src: src, winter: winter, key: s.alabel === "closed" ? "f" : tbShut ? "w" : "s" };
    }
    function legOf(x, y, key) {
      var o = D.legs[x + "~" + y], rev = false;
      if (!o) { o = D.legs[y + "~" + x]; rev = true; }
      if (!o) return null;
      var v = o[key];
      if (v === 2) v = o.w;
      if (v === 1) v = o.s;
      if (!v) return { none: true };
      return { km: v[0], mins: v[1], mtn: v[2], roads: v[3], stops: rev ? v[4].slice().reverse() : v[4], passes: v[5] };
    }
    function shortest() {
      var left = st.stops.slice(), out = [], at = st.entry;
      while (left.length) {
        var best = 0, bm = Infinity;
        left.forEach(function (s, i) { var l = s[0] === at ? { mins: 0 } : legOf(at, s[0], "s"); var mm = l && !l.none ? l.mins : 1e6; if (mm < bm) { bm = mm; best = i; } });
        at = left[best][0]; out.push(left.splice(best, 1)[0]);
      }
      st.stops = out;
    }

    /* buses, trains and the flight between two places */
    var BUS = {
      "talas~semiz": [["City bus 14, or marshrutka 3 or 52", "every 10 to 20 minutes", 25, 2, BUSPARK + "r/b14.html", "Talas City Bus Park: bus 14"]],
      "talas~kyzyl-adyr": [["Marshrutka from Talas Central Bus Station", "hourly, 07:00 to 19:00", 80, "marshrutka-kyzyl-adyr"]],
      "talas~nurzhan": [["Bus from Talas Central Bus Station", "5 a day, 06:30 to 18:00", 260, "bus-nurzhan"], ["Marshrutka from Talas Central Bus Station", "every 40 minutes, 06:00 to 20:00", 235, "marshrutka-nurzhan"]],
      "talas~iyik-janyl": [["Bus from Talas Central Bus Station, via Toktogul", "06:30 and 12:00", 410, "bus-iyik-janyl"]],
      "talas~toktogul": [["The Iyık Janyl bus from Talas Central Bus Station; ask the driver to let you off at Toktogul", "06:30 and 12:00", null, null]],
      "talas~tash-komur": [["Bus from Talas Central Bus Station", "06:30 and 12:00", 420, 40]],
      "iyik-janyl~tash-komur": [["Taxi, 8 km", "any time", 15, "taxi"]]
    };
    var FLY = { "talas~iyik-janyl": "Iradiya's scheduled hop from Talas to Tash-Kömür, then a taxi for the 8 km to Iyık Janyl", "talas~tash-komur": "Iradiya's scheduled hop from Talas to Tash-Kömür", "talas~toktogul": null };
    function trains(x, y) {
      var px = P[x].rail, py = P[y].rail; if (!px || !py) return [];
      var T = D.train, km = Math.abs(T.km[px] - T.km[py]), F = T.fares;
      var f = function (full) { return Math.max(F.min, Math.round(full * km / F.km * 2) / 2); };
      return T.trains.map(function (t) {
        var ix = -1, iy = -1; t.stops.forEach(function (s, i) { if (s[0] === px) ix = i; if (s[0] === py) iy = i; });
        if (ix < 0 || iy < 0 || ix > iy) return null;
        var dep = t.stops[ix][2], arr = t.stops[iy][1];
        var mins = (+arr.slice(0, 2) * 60 + +arr.slice(3)) - (+dep.slice(0, 2) * 60 + +dep.slice(3));
        return ["Train No. " + t.no + " (Irad Temir Jolu)", "daily, leaves " + dep + ", arrives " + arr, mins, f(F.platskart), RAIL, "Irad Temir Jolu timetable", f(F.kupe)];
      }).filter(Boolean);
    }
    function publicOptions(x, y) {
      var k1 = x + "~" + y, k2 = y + "~" + x, list = (BUS[k1] || BUS[k2] || []).slice();
      list = list.concat(trains(x, y));
      return list.map(function (b) { var fare = typeof b[3] === "string" ? price(b[3]) : b[3]; return { name: b[0], when: b[1], mins: b[2], fare: fare, link: b[4], linkText: b[5], kupe: b[6] }; });
    }

    function go() {
      var out = $("#tbOut", box);
      todayP.then(function () { out.innerHTML = render(); });
    }
    function render() {
      var plan = [], date = st.arrive, at = st.entry, warn = [], papers = {}, costs = [], total = 0, people = st.people;
      var paper = function (k, html) { papers[k] = html; };
      paper("passport", "Your passport, on you and not in the luggage hold. Gendarmerie posts inside the Zone check identity documents, and hotels and guesthouses note your passport details when you arrive.");
      paper("entry", "A visa-free stay or an entry permit, depending on your passport. Use our " + a("/plan/entry-checker/", "entry checker") + ", which ends at the " + a(ENTRY, "e-Irad entry guide") + ".");
      paper("customs", "Customs at " + (st.entry === "talas" ? "the Talas terminal" : esc(P[st.entry].name.replace(/ \(.*/, ""))) + ": check your bag on the Customs Service's " + a(CUSTOMS, "What can I bring in?") + " page before you pack.");
      if (st.entry !== "talas" || st.exit !== "talas") paper("slip", "Leaving for Kazakhstan by road: ask the border officer to stamp a separate slip instead of your passport. Kazakhstan doesn't recognise ISEZ stamps.");
      var route = [[st.entry, 0]].concat(st.stops).concat([[st.exit, 0]]);
      var nightsTalas = 0;
      st.stops.forEach(function (s) { if (s[0] === "talas") nightsTalas += s[1]; });
      var days = st.stops.reduce(function (n, s) { return n + s[1]; }, 0);
      for (var i = 0; i < route.length - 1; i++) {
        if (i > 0) date = addDays(date, route[i][1]);
        var x = route[i][0], y = route[i + 1][0];
        if (x !== y) leg(x, y, date);
        stayAt(i, y, date);
      }
      function leg(x, y, date) {
        var R = roadsOn(date), L = legOf(x, y, R.key), rows = [];
        var head = "<b>" + esc(fmtDate(date, true)) + "</b>: " + esc(P[x].name) + " to " + esc(P[y].name);
        var kart = KARTALAR + "?route=" + encodeURIComponent(P[x].k) + "~" + encodeURIComponent(P[y].k) + "&v=" + (st.how === "car" ? "car" : "bus");
        var legCost = 0, legCostText = "";
        if (!L || L.none) {
          rows.push('<p class="notice">No road is open between these places on this date: the Fergana Gateway is closed by snow. The way south is ' + a(AVIA, "Iradiya's flight from Talas to Tash-Kömür") + ", or wait a day for the ploughs.</p>");
        } else {
          rows.push("<p>" + Math.round(L.km) + " km, about " + hm(L.mins) + " at the wheel in good weather, by " + L.roads.slice(0, 3).map(function (r) { return esc(D.roads[r] || r); }).join(", ") + ". " + a(kart, "See the route on Kartalar") + ".</p>");
          if (L.stops.length) rows.push("<p>Checkpoints: " + L.stops.map(function (s) { var f = D.stops[s]; return esc(f[0]) + (f[1] === "line" || f[1] === "line-main" ? " (Qara-Chik line crossing)" : ""); }).join(", ") + ".</p>");
          var ps = L.passes.filter(function (p) { return PASS[p]; }).map(function (p) {
            var s = R.s[p] || "open";
            return '<span class="road-status road-' + (s === "open" ? "open" : s === "chains" ? "chains" : "closed") + '">' + esc(PASS[p]) + ": " + esc(LBL[s] || s) + "</span>";
          });
          if (ps.length) rows.push("<p>On the passes " + (R.src === "today" ? "today" : R.src === "week" ? "this week" : "in a usual " + (R.winter ? "winter" : "season")) + ": " + ps.join(" ") + "</p>");
          if (L.passes.indexOf("alabel") >= 0) {
            paper("alabel", "Identity documents are checked at the Fergana Gateway summit, bus passengers' included.");
            if (R.src === "season" && R.winter) rows.push('<p class="trip-warn">The Fergana Gateway closes for snow on about 20 days a winter. Check our ' + a("/roads/", "roads and passes") + " page the week before; when it's shut, the way south is " + a(AVIA, "Iradiya's flight to Tash-Kömür") + ".</p>");
            if (R.winter) paper("chains", "Driving in winter: chains on board for the Fergana Gateway and the Kök-Bel road, fuel from Talas, water and food for a day.");
          }
          if (L.stops.some(function (s) { return /^line/.test(D.stops[s][1]); })) paper("line", "Crossing the Qara-Chik line: an ISEZ exit registration, a line crossing pass (Form RG-9) and an invitation from the clan council of the area you're visiting. See " + a("https://e-irad.org/services/crossing/", "Crossing the Qara-Chik line") + " on e-Irad. Crossings keep set hours, and vehicles and loads are inspected.");
          // getting there
          if (st.how === "car") {
            var litres = (L.km + L.mtn * 0.35) * 8.5 / 100, fuel = litres * price("petrol-92");
            legCost = fuel; legCostText = "Petrol, about " + Math.round(litres) + " litres of AI-92 at " + som2(price("petrol-92"));
            rows.push("<p>By car: about " + Math.round(litres) + " litres of AI-92, " + som(fuel) + " at today's price. Fill up before the mountains.</p>");
          } else {
            var opt = publicOptions(x, y);
            if (opt.length) {
              rows.push('<ul class="trip-opts">' + opt.map(function (o) {
                return "<li><b>" + esc(o.name) + "</b>: " + esc(o.when) + (o.mins ? ", " + hm(o.mins) : "") + (o.fare ? ", " + som(o.fare) + (o.kupe ? " in platskart, " + som(o.kupe) + " in kupe" : "") : ", pay the driver") + (o.link ? ". " + a(o.link, o.linkText) : "") + "</li>";
              }).join("") + "</ul>");
              var cheap = opt.filter(function (o) { return o.fare; }).sort(function (p, q) { return p.fare - q.fare; })[0];
              if (cheap) { legCost = cheap.fare * people; legCostText = esc(cheap.name.replace(/ from .*| \(.*/, "")) + ", " + people + " × " + som(cheap.fare); }
            } else if (P[y].z === "ATR" || P[x].z === "ATR") {
              rows.push("<p>No buses cross the line. Your hosts on the tribal side arrange the car and the crossing.</p>");
            } else {
              rows.push("<p>No bus or train on our timetables for this leg. Guesthouses will find you a car with a driver, or go by way of Talas. Ask at " + a(BUSPARK, "Talas Central Bus Station") + " about shared taxis.</p>");
            }
            var fk = FLY[x + "~" + y] || FLY[y + "~" + x];
            if (fk) rows.push("<p>Or fly: " + esc(fk) + ". " + a(AVIA, "Talas Civil Air Terminal schedule") + ".</p>");
            if ((x === "talas" || y === "talas") && /bus station/i.test(rows.join(""))) rows.push("<p class=\"trip-small\">To the bus station in Talas: city buses 1, 4 and 11 stop at Central Bus Station; bus 11 also runs to the railway station. " + a(BUSPARK + "routes.html", "Talas City Bus Park routes") + ".</p>");
          }
        }
        if (legCost) { costs.push([fmtDate(date) + ": " + P[x].name + " to " + P[y].name, legCostText, legCost]); total += legCost; }
        plan.push("<li>" + head + rows.join("") + "</li>");
      }
      function stayAt(i, y, date) {
        var py = P[y];
        if (i + 1 < route.length - 1) {
          var n = route[i + 1][1];
          var stay = "<li class=\"trip-stay\">" + n + " night" + (n > 1 ? "s" : "") + " in " + a(py.url, py.name);
          if (y === "talas") stay += ". " + a(HOTEL, "Hotel Talas") + " on Central Square, or ask us for a guesthouse. " + a("/stay/hotel-talas-request/", "Request a room at Hotel Talas");
          stay += "</li>";
          plan.push(stay);
          if (py.z === "ATR") paper("atr-" + y, esc(py.name) + " is on tribal land, outside the Zone: your visa or entry permit doesn't cover it. Guesthouses there can arrange the clan invitation. No Zone services, and Kartalar's map data is thin.");
          if (py.rwz) paper("rwz-" + y, esc(py.name) + " lies inside the restricted zone, 12 km either side of the Qara-Chik line: entry, staying and photography follow the rules of the Border Demarcation Brigade. Ask your hosts before you take pictures.");
          if (y === "besh-tash") paper("besh-tash", "Besh-Tash National Park: trekking and riding permits from the Ranger Headquarters at the park entrance. The Upper Lake is on the tribal side; ask the rangers several days ahead.");
          if (y === "iyik-janyl") {
            var stayFrom = addDays(date, 0), stayTo = addDays(date, n);
            var y0 = stayFrom.slice(0, 4), f0 = y0 + "-08-24";
            if (f0 >= stayFrom && f0 < stayTo) warn.push("You're in Iyık Janyl for the " + a("/whats-on/feast-of-st-janyl/", "Feast of St. Janyl") + " on 24 August. The guesthouses fill months ahead, and the buses are full all week.");
          }
        }
      }
      if (st.how === "car") paper("car", "A car registered abroad pays the road-use charge at the frontier crossing; a car registered in the Zone needs this year's " + a("https://e-irad.org/services/roadcharge/", "road-use sticker") + ". Carry the licence and the car's papers.");
      if (st.entry === "kum-shagyl" || st.exit === "kum-shagyl") warn.push("Kum-Shagyl opens only in the grazing and harvest months and is mostly for local farm traffic. Chu Gate, 12 km south, is the sure crossing.");
      if (!st.stops.some(function (s) { return s[0] === "talas"; }) && st.entry === "talas") warn.push("You fly in to Talas but don't stay there. The Old City is worth a night at least.");
      var endDate = addDays(st.arrive, days);
      if (st.hotel && nightsTalas) { var rm = people === 1 ? 360 : Math.ceil(people / 2) * 520; costs.push(["Hotel Talas, " + nightsTalas + " night" + (nightsTalas > 1 ? "s" : ""), (people === 1 ? "a standard single, 360 som a night" : Math.ceil(people / 2) + " standard twin room" + (people > 2 ? "s" : "") + ", 520 som a night each"), rm * nightsTalas]); total += rm * nightsTalas; }
      var food = price("plov") * 2 * people * (days + 1);
      costs.push(["Food", "two plates of plov a day each, at " + som(price("plov")), food]); total += food;
      var rate = usd();
      var html = '<div class="conv-out trip-sum"><div><span>Trip</span><b>' + days + " night" + (days > 1 ? "s" : "") + "</b><small>" + esc(fmtDate(st.arrive)) + " to " + esc(fmtDate(endDate)) + "</small></div>" +
        "<div><span>Rough cost</span><b>" + som(total) + "</b><small>about $" + Math.round(total / rate) + " at the official rate of " + rate.toFixed(2) + " som</small></div></div>";
      if (warn.length) html += warn.map(function (w) { return '<p class="notice">' + w + "</p>"; }).join("");
      html += '<h3 class="trip-h">Day by day</h3><ol class="trip-plan">' + plan.join("") + "</ol>";
      html += '<h3 class="trip-h">Papers and permits</h3><ul class="trip-papers">' + Object.keys(papers).map(function (k) { return "<li>" + papers[k] + "</li>"; }).join("") + "</ul>";
      html += '<h3 class="trip-h">Rough cost at today\'s prices</h3><div class="table-wrap"><table class="trip-costs"><thead><tr><th scope="col">What</th><th scope="col">How we counted it</th><th scope="col">Som</th></tr></thead><tbody>' +
        costs.map(function (c) { return "<tr><td>" + esc(c[0]) + "</td><td>" + c[1] + "</td><td>" + som(c[2]) + "</td></tr>"; }).join("") +
        "<tr><th scope=\"row\" colspan=\"2\">Total</th><td><b>" + som(total) + "</b></td></tr></tbody></table></div>" +
        '<p class="trip-small">Not counted: guesthouse rooms (well under half a central-avenue hotel, breakfast included), ' + (st.how === "car" ? "your driver's day rate, " : "") + "taxis, tickets and souvenirs. " +
        (TODAY ? "Prices from today's numbers, " + esc(fmtDate(TODAY.date || iradToday())) + "." : "Today's prices didn't load, so these are last month's.") +
        " Driving times are for good weather and leave out rests. Roads: Kartalar.</p>";
      return html;
    }
    go();
  }

  /* =====================================================================
     2. Entry checker
     ===================================================================== */
  var ec = $("#entry-checker");
  if (ec) entryChecker(ec);
  function entryChecker(box) {
    var EU = ["Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden"];
    var C = [["us", "United States"], ["uk", "United Kingdom"], ["ca", "Canada"], ["jp", "Japan"], ["kr", "South Korea"]]
      .concat(EU.map(function (n) { return ["eu:" + n, n]; }))
      .concat([["kz", "Kazakhstan"], ["kg", "Kyrgyzstan"], ["uz", "Uzbekistan"], ["ru", "Russia"], ["cn", "China"], ["tr", "Turkey"], ["in", "India"], ["other", "Another country"], ["ir", "Irad (ISEZ passport or ID card)"]]);
    C.sort(function (p, q) { return /^(other|ir)$/.test(p[0]) - /^(other|ir)$/.test(q[0]) || p[1].localeCompare(q[1]); });
    var PUR = [["tour", "A holiday"], ["pilgrim", "Pilgrimage (Iyık Janyl, the Feast of St. Janyl)"], ["family", "Visiting family, or tracing my roots"], ["business", "Business meetings or a conference"], ["work", "Work, or a contract of more than a few weeks"], ["tribal", "A trip that crosses into the tribal regions"]];
    var WAY = [["air", "An Iradiya flight to Talas"], ["chu", "By road, through Chu Gate"], ["tnt", "By road or rail freight, through the Talas North Terminal"], ["kum", "Kum-Shagyl (seasonal)"]];
    var opts = function (l) { return l.map(function (x) { return '<option value="' + esc(x[0]) + '">' + esc(x[1]) + "</option>"; }).join(""); };
    box.innerHTML = '<form class="conv-form" onsubmit="return false">' +
      '<label>My passport<select id="ecNat"><option value="">Choose a country</option>' + opts(C) + "</select></label>" +
      '<label>The trip is for<select id="ecPur">' + opts(PUR) + "</select></label>" +
      '<label>Days in Irad<input type="number" id="ecDays" min="1" max="400" value="10"></label>' +
      '<label>Coming in by<select id="ecWay">' + opts(WAY) + "</select></label>" +
      '<label class="trip-check"><input type="checkbox" id="ecOn"> I\'m going on to Kazakhstan, Uzbekistan or Kyrgyzstan</label></form><div id="ecOut" aria-live="polite"></div>';
    ["#ecNat", "#ecPur", "#ecDays", "#ecWay", "#ecOn"].forEach(function (id) { $(id, box).addEventListener("change", check); });
    function check() {
      var nat = $("#ecNat", box).value, pur = $("#ecPur", box).value, days = +$("#ecDays", box).value || 1, way = $("#ecWay", box).value, on = $("#ecOn", box).checked;
      var out = $("#ecOut", box);
      if (!nat) { out.innerHTML = ""; return; }
      var name = C.filter(function (c) { return c[0] === nat; })[0][1], steps = [], verdict, sub;
      var free = nat === "us" ? 90 : /^(uk|ca|jp|kr|eu:)/.test(nat) ? 30 : 0;
      var where = { air: "at the entry counter in the Talas terminal", chu: "at Chu Gate", tnt: "at the Talas North Terminal", kum: "at Kum-Shagyl" }[way];
      if (nat === "ir") {
        verdict = "No visa needed"; sub = "Bring your PRS-1 passport or identity card.";
        steps.push("You're coming home: show your passport or ID card " + where + ".");
      } else if (free && days <= free && pur !== "work") {
        verdict = "No visa needed"; sub = "You can stay up to " + free + " days.";
        steps.push("Show a passport valid for your whole stay " + where + ". You get " + free + " days from the day you arrive.");
        if (nat === "us") steps.push("The 90 days for US passports go back to the territorial period.");
      } else if (free && pur !== "work") {
        verdict = "You need an entry permit"; sub = days + " days is more than the " + free + " days you get without a visa.";
        steps.push("Get an entry permit before you travel from an ISEZ trade office (Almaty, Bishkek, Istanbul, Dubai or Washington), or on arrival at Talas. Entry permits aren't issued online.");
      } else if (pur === "work") {
        verdict = "You need more than a visit";
        sub = "Visa-free stays and entry permits are for visits.";
        steps.push((free ? "You can come in without a visa for up to " + free + " days to look around and meet people, but to" : "Get an entry permit to come in, from an ISEZ trade office or on arrival at Talas. To") + " work or stay on, you need a residence card from the Passport and Residence Service. Book a queue number on " + a("https://e-irad.org/", "e-Irad") + " once you're here, and ask your employer for the letter.");
      } else {
        verdict = "You need an entry permit"; sub = nat === "other" ? "Unless your country is on the 30-day list; the e-Irad guide has it." : "Before you travel, or on arrival at Talas.";
        steps.push("Get an entry permit from an ISEZ trade office in Almaty, Bishkek, Istanbul, Dubai or Washington before you travel, or ask for one on arrival at Talas. Entry permits are issued by the Passport and Residence Service of the Ministry of Internal Security, and not online.");
        if (way !== "air") steps.push("Coming by road, get the permit from a trade office first: the Talas counters are the sure place to be issued one on arrival.");
      }
      if (pur === "pilgrim") steps.push("The Feast of St. Janyl is on 24 August. Book a bed in Iyık Janyl months ahead, and see our " + a("/itineraries/pilgrim-road/", "pilgrim road") + ".");
      if (pur === "family") steps.push("Tracing family? Our " + a("/roots/", "roots page") + " explains the records and the archives.");
      if (pur === "tribal") steps.push("A visa or entry permit covers the Zone only. To cross into the tribal regions you need an ISEZ exit registration and an invitation from the clan council of the area, and you cross only at a designated crossing of the Qara-Chik line, chiefly Qara-Chik south of Kyzyl-Adyr. See " + a("https://e-irad.org/services/crossing/", "Crossing the Qara-Chik line") + ". Western governments advise against travel there.");
      if (way === "kum") steps.push("Kum-Shagyl opens only in the grazing and harvest months and is mostly for local traffic. Chu Gate is the sure crossing.");
      if (on || way !== "air" || /^(kz|kg|uz)$/.test(nat)) steps.push("Ask the officer to stamp a separate slip instead of your passport. Kazakhstan, Uzbekistan and Kyrgyzstan don't recognise ISEZ entry stamps, and travellers have been questioned at their borders. Keep the slip with your passport while you're in the Zone.");
      steps.push("Check what you can bring in on the Customs Service's " + a(CUSTOMS, "What can I bring in?") + " page. Allowances depend on the crossing and on how long you were away.");
      steps.push("Carry your passport everywhere: the Gendarmerie checks identity documents at the Otmek valley, on the Fergana Gateway and at the Naryn bridge, and hotels note it when you arrive.");
      out.innerHTML = '<div class="conv-out"><div><span>' + esc(name) + "</span><b>" + esc(verdict) + "</b><small>" + sub + "</small></div></div>" +
        '<ol class="trip-papers">' + steps.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ol>" +
        '<p class="trip-end"><a class="btn-outline" href="' + ENTRY + '"' + EXT + ">Read the official rules on e-Irad</a></p>" +
        '<p class="trip-small">This checker follows the e-Irad guide for visitors, which the Passport and Residence Service keeps up to date. If the two ever disagree, the guide is right.</p>';
    }
  }

  /* =====================================================================
     3. Room request, Hotel Talas
     ===================================================================== */
  var hr = $("#room-request");
  if (hr) roomRequest(hr);
  function roomRequest(box) {
    var ROOMS = [["Standard single", 360], ["Standard twin / double", 520], ["Improved single (breakfast included)", 560], ["Improved double (breakfast included)", 760], ["Junior suite (breakfast included)", 1150], ["Suite «Lyuks», 2 rooms (breakfast included)", 1680]];
    var d0 = addDays(iradToday(), 7);
    box.innerHTML = '<form class="conv-form" id="hrForm" novalidate>' +
      '<label>Arrival<input type="date" id="hrArr" value="' + d0 + '" required></label>' +
      '<label>Departure<input type="date" id="hrDep" value="' + addDays(d0, 3) + '" required></label>' +
      '<label>Room<select id="hrRoom">' + ROOMS.map(function (r, i) { return '<option value="' + i + '"' + (i === 1 ? " selected" : "") + ">" + esc(r[0]) + "</option>"; }).join("") + "</select></label>" +
      '<label>Rooms<input type="number" id="hrN" min="1" max="4" value="1"></label>' +
      '<label>Guests<input type="number" id="hrP" min="1" max="8" value="2"></label>' +
      '<label>Your name<input type="text" id="hrName" autocomplete="off" required></label>' +
      '<label class="trip-check"><input type="checkbox" id="hrTr"> Transfer from the air terminal (150 som)</label>' +
      '<p class="trip-end"><button type="submit" class="btn-outline">Get a request number</button></p></form><div id="hrOut" aria-live="polite"></div>';
    $("#hrForm", box).addEventListener("submit", function (e) {
      e.preventDefault();
      var arr = $("#hrArr", box).value, dep = $("#hrDep", box).value, ri = +$("#hrRoom", box).value, n = Math.max(1, Math.min(4, +$("#hrN", box).value || 1));
      var name = $("#hrName", box).value.trim(), out = $("#hrOut", box), nights = arr && dep ? daysBetween(arr, dep) : 0;
      var err = !arr || !dep ? "Choose your arrival and departure dates." : arr < iradToday() ? "Your arrival date has already passed." : nights < 1 ? "The departure date must be after the arrival date." : nights > 30 ? "For more than 30 nights, call the sales department on +996-39-2-21-00-72: long stays get a discount." : !name ? "Write the name the booking should be under." : "";
      if (err) { out.innerHTML = '<p class="notice">' + esc(err) + "</p>"; return; }
      // Feast week: 20 to 26 August, the week of the Feast of St. Janyl
      var clash = null;
      for (var d = arr; d < dep; d = addDays(d, 1)) { var m = md(d); if (m >= 820 && m <= 826) { clash = d.slice(0, 4); break; } }
      if (clash) {
        out.innerHTML = '<div class="notice"><b>Hotel Talas: no rooms on these dates.</b> The hotel is fully booked for Feast week, 20 to 26 August ' + clash +
          ", when the pilgrim groups and church delegations for the " + a("/whats-on/feast-of-st-janyl/", "Feast of St. Janyl") + " pass through Talas. The hotel doesn't keep a waiting list for Feast week. Try dates before the 20th or after the 26th, or look at our " + a("/stay/", "guesthouses") + ".</div>";
        return;
      }
      var r = ROOMS[ri], cost = r[1] * n * nights + ($("#hrTr", box).checked ? 150 : 0);
      todayP.then(function () {
        var rate = usd(), t = new Date(Date.now() + 6 * 3600e3);
        var ref = "HT-" + t.toISOString().slice(2, 10).replace(/-/g, "") + "-" + String(Date.now()).slice(-4);
        out.innerHTML = '<div class="conv-out"><div><span>Request number</span><b>' + esc(ref) + "</b><small>Quote it when you call or write</small></div>" +
          "<div><span>" + nights + " night" + (nights > 1 ? "s" : "") + ", " + n + " room" + (n > 1 ? "s" : "") + "</span><b>" + som(cost) + "</b><small>about $" + Math.round(cost / rate) + " at " + rate.toFixed(2) + " som; pay at the desk in som or dollars</small></div></div>" +
          "<p>Thank you, " + esc(name) + ". Your request for a " + esc(r[0].toLowerCase()) + " from " + esc(fmtDate(arr, true)) + " to " + esc(fmtDate(dep, true)) + " is ready. Call the hotel's reservation department on <b>+996-39-2-21-00-70</b> (9:00 to 18:00) or reception, 24 hours, on <b>+996-39-2-21-00-77</b>, or write to hoteltalas@attelkom.net, and quote the number. The booking is valid only once the hotel confirms it, and a no-show can be charged one night.</p>" +
          '<p class="trip-small">Nothing you type here is sent or kept: the number is made in your browser, so you pass it on yourself. Check-in from 14:00, check-out by 12:00. Bring your passport; reception notes it. Only Talasbank cards are taken. Prices from the ' + a(HOTEL + "prices.html", "hotel's 2026 price list") + ".</p>";
      });
    });
  }
})();
