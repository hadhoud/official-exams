/* Official Exams Library – plain JavaScript, no dependencies. Data: window.EXAMS (data/exams.js). */
(function () {
  "use strict";
  const DATA = (window.EXAMS || []).slice();
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const store = {
    get(k, d) { try { const v = localStorage.getItem("oel:" + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("oel:" + k, JSON.stringify(v)); } catch (e) { /* private browsing */ } },
  };

  // ------------------------------------------------------------------ catalogue
  const ICONS = {
    digital: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    power: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    practical: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M6 12l3-4 3 6 3-5 3 3M8 21h8"/></svg>',
    os: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M7 9l3 2-3 2M12 14h5"/></svg>',
    all: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
  };
  const iconFor = (c) => c === "digital" ? ICONS.digital : c === "power" ? ICONS.power : c === "practical" ? ICONS.practical : c.startsWith("os") ? ICONS.os : ICONS.all;
  const TYPES = [
    { id: "Exam", cls: "t-exam", short: "Exam", help: "the official paper" },
    { id: "Exam + key", cls: "t-key", short: "Exam + key", help: "with the official answer key" },
    { id: "Solved", cls: "t-solved", short: "Solved", help: "answers written by a teacher or student" },
    { id: "Practice", cls: "t-practice", short: "Practice", help: "question banks and samples" },
    { id: "Notes", cls: "t-notes", short: "Notes", help: "students' memory of an exam" },
  ].filter((t) => DATA.some((d) => d.type === t.id));
  const T = Object.fromEntries(TYPES.map((t) => [t.id, t]));

  const MAJORS = [], COURSES = [];
  DATA.forEach((d) => {
    if (!MAJORS.find((m) => m.id === d.major)) MAJORS.push({ id: d.major, name: d.majorName, ar: d.majorAr });
    if (!COURSES.find((c) => c.id === d.course)) COURSES.push({ id: d.course, major: d.major, name: d.courseName, ar: d.courseAr, code: d.courseCode || d.code });
  });
  const course = (id) => COURSES.find((c) => c.id === id);
  const major = (id) => MAJORS.find((m) => m.id === id);

  // ------------------------------------------------------------------ state
  const state = { q: "", major: "", course: "", year: "", session: "", types: [], sort: "new", view: store.get("view", "table"), fav: false, hideDone: false };
  const favs = new Set(store.get("favs", []));
  const done = new Set(store.get("done", []));
  let recent = store.get("recent", []);
  let visible = [];          // documents in display order (for prev / next in the viewer)
  let current = null;        // id open in the viewer

  // ------------------------------------------------------------------ helpers
  const norm = (s) => String(s || "").toLowerCase()
    .replace(/[ً-ْـ]/g, "").replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const yearLabel = (d) => (d.year ? String(d.year) : "Practice");
  const sessName = (s) => (s === 1 ? "1st session" : s === 2 ? "2nd session" : "");
  const sizeTxt = (kb) => (kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");
  const variantTxt = (d) => [d.variant ? d.variant.replace(/^power-v/, "Power v").replace(/^digital-v/, "Digital v").replace(/^tp/, "TP ").replace(/-/g, " ") : "", d.lang].filter(Boolean).join(" · ");
  const fullTitle = (d) => `${d.courseName} – ${yearLabel(d)}${d.year && d.session ? ", " + sessName(d.session) : ""}`;
  DATA.forEach((d) => {
    d._h = norm([d.courseName, d.courseAr, d.majorName, d.majorAr, d.code, d.courseCode, d.year || "practice", d.type, d.note, d.variant, d.lang,
      d.session ? `s${d.session} session${d.session} ${d.session === 1 ? "first 1st" : "second 2nd"}` : "", (d.tags || []).join(" ")].join(" "));
  });
  const terms = () => norm(state.q).split(/\s+/).filter(Boolean);
  function hl(text, ts) {
    let out = esc(text);
    ts.filter((t) => t.length > 1).forEach((t) => {
      out = out.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>");
    });
    return out;
  }
  function toast(msg) {
    const el = $("#toast"); el.textContent = msg; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 1800);
  }

  // ------------------------------------------------------------------ URL <-> state
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.q = p.get("q") || ""; state.major = p.get("major") || ""; state.course = p.get("course") || "";
    state.year = p.get("year") || ""; state.session = p.get("session") || ""; state.sort = p.get("sort") || "new";
    state.types = (p.get("type") || "").split(",").filter((t) => T[t]);
    state.fav = p.get("fav") === "1"; state.hideDone = p.get("hidedone") === "1";
    if (p.get("view") === "grid" || p.get("view") === "table") state.view = p.get("view");
    if (state.course && course(state.course)) state.major = course(state.course).major;
  }
  function writeHash() {
    const p = new URLSearchParams();
    ["q", "major", "course", "year", "session"].forEach((k) => { if (state[k]) p.set(k, state[k]); });
    if (state.types.length) p.set("type", state.types.join(","));
    if (state.sort !== "new") p.set("sort", state.sort);
    if (state.fav) p.set("fav", "1");
    if (state.hideDone) p.set("hidedone", "1");
    const h = p.toString();
    history.replaceState(null, "", h ? "#" + h : location.pathname + location.search);
  }

  // ------------------------------------------------------------------ filtering
  function match(d, ignore) {
    ignore = ignore || {};
    return (!state.major || d.major === state.major) &&
      (ignore.course || !state.course || d.course === state.course) &&
      (ignore.year || !state.year || String(d.year) === state.year) &&
      (!state.session || String(d.session) === state.session) &&
      (ignore.type || !state.types.length || state.types.includes(d.type)) &&
      (!state.fav || favs.has(d.id)) &&
      (!state.hideDone || !done.has(d.id)) &&
      terms().every((t) => d._h.includes(t));
  }
  const order = (a, b) => (!a.year) - (!b.year) || (state.sort === "old" ? 1 : -1) * (a.year - b.year) || a.session - b.session || a.id - b.id;
  const list = () => DATA.filter((d) => match(d)).sort(order);
  const isHome = () => !state.q && !state.course && !state.year && !state.session && !state.types.length && !state.fav && !state.hideDone;

  // ------------------------------------------------------------------ sidebar
  function renderSidebar() {
    const cnt = (f) => DATA.filter(f).length;
    $("#majorList").innerHTML = [{ id: "", name: "All majors" }, ...MAJORS].map((m) =>
      `<button class="opt ${state.major === m.id ? "on" : ""}" data-major="${m.id}" aria-pressed="${state.major === m.id}">
        <span class="txt">${esc(m.name)}${m.ar ? `<span class="ar" lang="ar" dir="rtl">${esc(m.ar)}</span>` : ""}</span>
        <span class="n">${cnt((d) => !m.id || d.major === m.id)}</span></button>`).join("");
    const cs = COURSES.filter((c) => !state.major || c.major === state.major);
    $("#courseList").innerHTML = [`<button class="opt ${!state.course ? "on" : ""}" data-course=""><span class="txt">All courses</span></button>`,
      ...cs.map((c) => `<button class="opt ${state.course === c.id ? "on" : ""}" data-course="${c.id}" aria-pressed="${state.course === c.id}">
        <span class="txt">${esc(c.name)}${state.major ? "" : `<span class="ar">${esc(major(c.major).name)}</span>`}</span>
        <span class="n">${cnt((d) => d.course === c.id)}</span></button>`)].join("");
    const years = [...new Set(DATA.filter((d) => match(d, { year: true })).map((d) => d.year))].sort((a, b) => (!a) - (!b) || b - a);
    $("#yearSel").innerHTML = `<option value="">All years</option>` + years.map((y) => `<option value="${y}" ${String(y) === state.year ? "selected" : ""}>${y || "Practice (no year)"}</option>`).join("");
    const tys = years.slice().sort((a, b) => (!a) - (!b) || a - b);
    const base = DATA.filter((d) => match(d, { year: true }));
    const max = Math.max(1, ...tys.map((y) => base.filter((d) => d.year === y).length));
    $("#timeline").innerHTML = tys.map((y) => {
      const n = base.filter((d) => d.year === y).length;
      return `<button class="tl ${state.year === String(y) ? "on" : ""}" data-tl="${y}" title="${y || "Practice"}: ${n} document(s)" aria-label="${y || "Practice"}, ${n} documents"><i style="height:${Math.round(6 + 34 * n / max)}px"></i></button>`;
    }).join("");
    $$("#sessSeg button").forEach((b) => { b.classList.toggle("on", b.dataset.sess === state.session); b.setAttribute("aria-checked", b.dataset.sess === state.session); });
    $("#typeList").innerHTML = TYPES.map((t) => `<label title="${esc(t.help)}"><input type="checkbox" data-type="${esc(t.id)}" ${state.types.includes(t.id) ? "checked" : ""}>
      <span class="dot ${t.cls}" style="background:var(--tc)"></span><span class="tn">${esc(t.id)}<span class="d">${esc(t.help)}</span></span></label>`).join("");
    $("#favOnly").checked = state.fav; $("#hideDone").checked = state.hideDone;
    const active = [state.major, state.course, state.year, state.session, state.fav, state.hideDone].filter(Boolean).length + state.types.length;
    $("#filterCount").hidden = !active; $("#filterCount").textContent = active;
  }

  // ------------------------------------------------------------------ pieces
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>';
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
  const DL = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  function tile(d, label, sub) {
    const t = T[d.type];
    return `<div class="tile ${t.cls} ${done.has(d.id) ? "is-done" : ""}">
      <button class="tile-main" data-open="${d.id}" title="Preview ${esc(fullTitle(d))}">
        <span class="pdf" aria-hidden="true">${done.has(d.id) ? CHECK : "PDF"}</span>
        <span><span class="t1">${esc(label)}</span><span class="t2">${esc(sub)}</span></span>
      </button>
      <span class="tside">
        <button class="mini ${favs.has(d.id) ? "fav-on" : ""}" data-fav="${d.id}" title="Favourite" aria-label="Favourite" aria-pressed="${favs.has(d.id)}">${STAR}</button>
        <a class="mini" href="${encodeURI(d.file)}" download title="Download (${sizeTxt(d.sizeKB)})" aria-label="Download">${DL}</a>
      </span></div>`;
  }
  const tileLabel = (d) => (d.type === "Exam" ? (variantTxt(d) || "Exam") : d.type);
  const tileSub = (d) => [d.type !== "Exam" ? variantTxt(d) : "", `${d.pages} p · ${sizeTxt(d.sizeKB)}`].filter(Boolean).join(" · ");
  function progress(ids) {
    const n = ids.length, k = ids.filter((id) => done.has(id)).length;
    return { n, k, pct: n ? Math.round(100 * k / n) : 0 };
  }

  // ------------------------------------------------------------------ views
  function renderHome() {
    $("#pageTitle").innerHTML = "Choose your course";
    $("#pageLead").textContent = "Pick a course to see all its official exams by year and session – or search above.";
    $("#headTools").hidden = true;
    const majors = MAJORS.filter((m) => !state.major || m.id === state.major);
    $("#results").innerHTML = majors.map((m) => {
      const cs = COURSES.filter((c) => c.major === m.id);
      const total = DATA.filter((d) => d.major === m.id).length;
      return `<section class="major-block"><h2 class="major-title">${esc(m.name)}<span class="ar" lang="ar" dir="rtl">${esc(m.ar)}</span><span class="n">${total} documents</span></h2>
        <div class="courses">${cs.map((c) => {
          const docs = DATA.filter((d) => d.course === c.id), ys = docs.map((d) => d.year).filter(Boolean);
          const pr = progress(docs.filter((d) => d.type !== "Practice" && d.type !== "Notes").map((d) => d.id));
          return `<button class="ccard" data-course="${c.id}">
            <span class="ico">${iconFor(c.id)}</span>
            <span><span class="h3">${esc(c.name)}</span><span class="ar" lang="ar" dir="rtl">${esc(c.ar)}</span></span>
            <span class="facts">${c.code ? `<span class="code">${c.code}</span>` : ""}<span>${ys.length ? (Math.min(...ys) === Math.max(...ys) ? Math.min(...ys) : Math.min(...ys) + "–" + Math.max(...ys)) : ""}</span><span>${docs.length} document${docs.length > 1 ? "s" : ""}</span></span>
            ${pr.n ? `<span class="prog"><span class="progress"><i style="width:${pr.pct}%"></i></span><span class="prog-txt"><span>Revised ${pr.k}/${pr.n}</span><span>${pr.pct}%</span></span></span>` : ""}
            <span class="go">See the exams <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></button>`;
        }).join("")}</div></section>`;
    }).join("");
    visible = [];
  }

  function renderMatrix(docs) {
    const c = course(state.course);
    $("#pageTitle").innerHTML = `${esc(c.name)}<span class="ar" lang="ar" dir="rtl">${esc(c.ar)}</span>`;
    const pr = progress(docs.filter((d) => d.type !== "Practice" && d.type !== "Notes").map((d) => d.id));
    $("#pageLead").textContent = `${major(c.major).name}${c.code ? " · code " + c.code : ""} · ${docs.length} document(s) shown${pr.n ? ` · revised ${pr.k}/${pr.n}` : ""}. Click a document to open it.`;
    $("#headTools").hidden = false;
    if (state.view === "grid") return renderCards(docs, false);
    const dated = docs.filter((d) => d.year), prac = docs.filter((d) => !d.year);
    const years = [...new Set(dated.map((d) => d.year))];
    const sessions = [1, 2].filter((s) => !state.session || String(s) === state.session);
    let h = "";
    if (years.length) {
      h += `<div class="matrix" style="--cols:${sessions.length}"><div class="mrow mhead"><div>Year</div>${sessions.map((s) => `<div>${sessName(s)}</div>`).join("")}</div>`;
      h += years.map((y) => {
        const yd = dated.filter((d) => d.year === y);
        const cells = sessions.map((s) => {
          const cd = yd.filter((d) => d.session === s);
          return `<div class="mcell ${cd.length ? "" : "nodoc"}"><span class="sess-lab">${sessName(s)}</span>${cd.map((d) => tile(d, tileLabel(d), tileSub(d))).join("")}</div>`;
        }).join("");
        return `<div class="mrow"><div class="myear">${y}<small>${yd.length} doc${yd.length > 1 ? "s" : ""}</small></div>${cells}</div>`;
      }).join("") + "</div>";
    }
    if (prac.length) h += `<section class="practice"><h2>Practice material</h2><div class="tiles">${prac.map((d) => tile(d, d.note || "Practice", tileSub(d))).join("")}</div></section>`;
    $("#results").innerHTML = h || empty();
    visible = [...dated, ...prac];
  }

  function renderCards(docs, grouped) {
    const ts = terms();
    const card = (d) => {
      const t = T[d.type];
      return `<article class="dcard ${t.cls} ${done.has(d.id) ? "is-done" : ""}">
        <div class="yr">${yearLabel(d)}${d.year && d.session ? `<small>${sessName(d.session)}</small>` : ""}<span style="margin-left:auto"><span class="badge">${esc(d.type)}</span></span></div>
        <div class="course">${hl(d.courseName, ts)}</div>
        <div class="meta">${[variantTxt(d), d.note].filter(Boolean).map((x) => hl(x, ts)).join(" – ")}${variantTxt(d) || d.note ? "<br>" : ""}${esc(d.majorName)}${d.code ? ` · <span class="code">${d.code}</span>` : ""} · ${d.pages} p · ${sizeTxt(d.sizeKB)}</div>
        ${(d.tags || []).length ? `<div class="tags">${d.tags.slice(0, 6).map((x) => `<button class="tag" data-tag="${esc(x)}">${hl(x, ts)}</button>`).join("")}</div>` : ""}
        <div class="row"><button class="btn" data-open="${d.id}">${done.has(d.id) ? CHECK + " Open again" : "Open"}</button>
          <button class="icon-btn ${favs.has(d.id) ? "fav-on" : ""}" data-fav="${d.id}" aria-label="Favourite" aria-pressed="${favs.has(d.id)}">${STAR}</button>
          <a class="icon-btn" href="${encodeURI(d.file)}" download aria-label="Download">${DL}</a></div></article>`;
    };
    if (!grouped) { $("#results").innerHTML = docs.length ? `<div class="dgrid">${docs.map(card).join("")}</div>` : empty(); visible = docs; return; }
    const groups = [];
    docs.forEach((d) => { let g = groups.find((x) => x.c === d.course); if (!g) groups.push(g = { c: d.course, docs: [] }); g.docs.push(d); });
    $("#results").innerHTML = groups.length ? groups.map((g) => {
      const c = course(g.c);
      return `<section class="rgroup"><h2>${esc(c.name)}<span class="ar" lang="ar" dir="rtl">${esc(c.ar)}</span><button data-course="${c.id}">All ${esc(c.name.split(" – ")[0])} exams →</button></h2>
        <div class="dgrid">${g.docs.map(card).join("")}</div></section>`;
    }).join("") : empty();
    visible = groups.flatMap((g) => g.docs);
  }

  function empty() {
    return `<div class="empty"><h2>No exam matches</h2><p>Try fewer words, another year, or clear the filters.</p>
      <div class="sugg"><button class="btn ghost" data-reset>Clear all filters</button>${state.q ? `<button class="btn ghost" data-clearq>Clear the search “${esc(state.q)}”</button>` : ""}</div></div>`;
  }

  function renderCrumbs() {
    const parts = [`<button data-home>All exams</button>`];
    if (state.major) parts.push(`<button data-major="${state.major}">${esc(major(state.major).name)}</button>`);
    if (state.course) parts.push(`<button data-course="${state.course}">${esc(course(state.course).name.split(" – ")[0])}</button>`);
    if (state.year) parts.push(`<span>${state.year === "0" ? "Practice" : state.year}</span>`);
    if (state.q) parts.push(`<span>Search “${esc(state.q)}”</span>`);
    $("#crumbs").innerHTML = parts.join('<span class="sep">›</span>');
  }

  function renderContinue() {
    const items = recent.map((id) => DATA.find((d) => d.id === id)).filter(Boolean).slice(0, 6);
    const el = $("#continue");
    el.hidden = !items.length || !isHome();
    if (el.hidden) return;
    el.innerHTML = `<h2>Continue where you left off</h2><div class="cont-list">${items.map((d) =>
      `<button class="cont-item" data-open="${d.id}"><b>${esc(d.courseName.split(" – ")[0])}</b><span>${yearLabel(d)}${d.year && d.session ? " · " + sessName(d.session) : ""}${done.has(d.id) ? " · ✓ revised" : ""}</span></button>`).join("")}</div>`;
  }

  function render() {
    renderSidebar(); renderCrumbs(); renderContinue(); writeHash();
    $$("#viewSeg button").forEach((b) => { b.classList.toggle("on", b.dataset.view === state.view); b.setAttribute("aria-checked", b.dataset.view === state.view); });
    $("#sortSel").value = state.sort;
    if (isHome()) return renderHome();
    const docs = list();
    if (state.course && !state.q) return renderMatrix(docs);
    $("#pageTitle").textContent = state.q ? `Results for “${state.q}”` : "Filtered exams";
    $("#pageLead").textContent = `${docs.length} of ${DATA.length} documents`;
    $("#headTools").hidden = false;
    renderCards(docs, true);
  }

  // ------------------------------------------------------------------ viewer
  function openDoc(id) {
    const d = DATA.find((x) => x.id === id); if (!d) return;
    current = id;
    const href = encodeURI(d.file);
    $("#viewerTitle").textContent = fullTitle(d);
    $("#viewerMeta").textContent = [d.type, variantTxt(d), d.note, d.code ? "code " + d.code : "", `${d.pages} pages`].filter(Boolean).join(" · ");
    $("#vOpen").href = href; $("#vDl").href = href;
    if ($("#viewerFrame").getAttribute("src") !== href) $("#viewerFrame").src = href;
    syncViewerButtons();
    const i = visible.findIndex((x) => x.id === id);
    $("#vPrev").disabled = i <= 0; $("#vNext").disabled = i < 0 || i >= visible.length - 1;
    const dlg = $("#viewer");
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else window.open(href, "_blank"); }
    recent = [id, ...recent.filter((x) => x !== id)].slice(0, 8); store.set("recent", recent);
  }
  function syncViewerButtons() {
    if (current == null) return;
    const isD = done.has(current), isF = favs.has(current);
    $("#vDone").classList.toggle("on", isD);
    $("#vDone").innerHTML = CHECK + (isD ? " Revised" : " Mark as revised");
    $("#vFav").innerHTML = STAR; $("#vFav").classList.toggle("fav-on", isF); $("#vFav").setAttribute("aria-pressed", isF);
  }
  function step(dir) {
    const i = visible.findIndex((x) => x.id === current);
    const n = visible[i + dir]; if (n) openDoc(n.id);
  }
  function closeViewer() { const dlg = $("#viewer"); if (dlg.open) dlg.close(); }
  function toggle(set, key, id, on, off) {
    if (set.has(id)) { set.delete(id); toast(off); } else { set.add(id); toast(on); }
    store.set(key, [...set]);
  }

  // ------------------------------------------------------------------ events
  let tq;
  $("#q").addEventListener("input", (e) => { clearTimeout(tq); tq = setTimeout(() => { state.q = e.target.value.trim(); render(); }, 140); });
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Escape") { e.target.value = ""; state.q = ""; render(); } });
  document.addEventListener("keydown", (e) => {
    const dlg = $("#viewer");
    if (dlg.open) {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key.toLowerCase() === "d") { toggle(done, "done", current, "Marked as revised ✓", "Unmarked"); syncViewerButtons(); render(); }
      else if (e.key.toLowerCase() === "f") { toggle(favs, "favs", current, "Added to favourites ★", "Removed from favourites"); syncViewerButtons(); render(); }
      return;
    }
    if (e.key === "/" && document.activeElement !== $("#q")) { e.preventDefault(); $("#q").focus(); }
  });
  $("#yearSel").onchange = (e) => { state.year = e.target.value; render(); };
  $("#sortSel").onchange = (e) => { state.sort = e.target.value; render(); };
  $("#favOnly").onchange = (e) => { state.fav = e.target.checked; render(); };
  $("#hideDone").onchange = (e) => { state.hideDone = e.target.checked; render(); };
  $("#typeList").addEventListener("change", (e) => {
    const t = e.target.dataset.type; if (!t) return;
    state.types = e.target.checked ? [...state.types, t] : state.types.filter((x) => x !== t); render();
  });
  function reset() { Object.assign(state, { q: "", major: "", course: "", year: "", session: "", types: [], sort: "new", fav: false, hideDone: false }); $("#q").value = ""; render(); }
  $("#resetBtn").onclick = reset;

  const side = $("#sidebar"), scrim = $("#scrim");
  const openSide = (o) => { side.classList.toggle("open", o); scrim.hidden = !o; $("#filtersBtn").setAttribute("aria-expanded", o); };
  $("#filtersBtn").onclick = () => openSide(true);
  $("#sideClose").onclick = () => openSide(false);
  scrim.onclick = () => openSide(false);

  document.addEventListener("click", (e) => {
    const b = e.target.closest("button, a"); if (!b) return;
    const ds = b.dataset;
    if (ds.open) { e.preventDefault(); openDoc(+ds.open); }
    else if (ds.fav) { toggle(favs, "favs", +ds.fav, "Added to favourites ★", "Removed from favourites"); render(); }
    else if (ds.major !== undefined) { state.major = ds.major; state.course = ""; state.year = ""; render(); }
    else if (ds.course !== undefined) { state.course = ds.course; if (ds.course) state.major = course(ds.course).major; state.q = ""; $("#q").value = ""; state.year = ""; render(); window.scrollTo({ top: 0 }); if (side.classList.contains("open") && ds.course) openSide(false); }
    else if (ds.tl !== undefined) { state.year = state.year === ds.tl ? "" : ds.tl; render(); }
    else if (ds.sess !== undefined) { state.session = ds.sess; render(); }
    else if (ds.view) { state.view = ds.view; store.set("view", state.view); render(); }
    else if (ds.tag) { state.q = ds.tag; $("#q").value = ds.tag; render(); }
    else if (ds.home !== undefined) { reset(); }
    else if (ds.reset !== undefined) { reset(); }
    else if (ds.clearq !== undefined) { state.q = ""; $("#q").value = ""; render(); }
  });
  $("#homeLink").onclick = (e) => { e.preventDefault(); reset(); };
  $("#vPrev").onclick = () => step(-1);
  $("#vNext").onclick = () => step(1);
  $("#vClose").onclick = closeViewer;
  $("#vDone").onclick = () => { toggle(done, "done", current, "Marked as revised ✓", "Unmarked"); syncViewerButtons(); render(); };
  $("#vFav").onclick = () => { toggle(favs, "favs", current, "Added to favourites ★", "Removed from favourites"); syncViewerButtons(); render(); };
  $("#viewer").addEventListener("close", () => { $("#viewerFrame").src = "about:blank"; current = null; renderContinue(); });
  $("#viewer").addEventListener("click", (e) => { if (e.target === $("#viewer")) closeViewer(); });
  $("#randomBtn").onclick = () => {
    const pool = (isHome() ? DATA : list()).filter((d) => d.type !== "Practice" && d.type !== "Notes" && !done.has(d.id));
    if (!pool.length) return toast("Nothing left to revise here – well done!");
    if (!visible.length) visible = pool;
    openDoc(pool[Math.floor(Math.random() * pool.length)].id);
  };

  // theme
  const applyTheme = (t) => { if (t) document.documentElement.setAttribute("data-theme", t); else document.documentElement.removeAttribute("data-theme"); };
  applyTheme(store.get("theme", ""));
  $("#themeBtn").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const dark = cur === "dark" || (!cur && matchMedia("(prefers-color-scheme: dark)").matches);
    const t = dark ? "light" : "dark"; store.set("theme", t); applyTheme(t);
  };

  // header stats
  const yrs = DATA.map((d) => d.year).filter(Boolean);
  $("#stats").innerHTML = [[DATA.filter((d) => d.type !== "Practice" && d.type !== "Notes").length, "exams"], [COURSES.filter((c) => !c.id.startsWith("all")).length, "courses"], [`${Math.min(...yrs)}–${Math.max(...yrs)}`, "years"]]
    .map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");

  window.addEventListener("hashchange", () => { readHash(); $("#q").value = state.q; render(); });
  readHash(); $("#q").value = state.q; render();
})();
