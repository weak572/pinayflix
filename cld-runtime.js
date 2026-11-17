/* cld-runtime.js: the one script a generated app screen carries. Written by
   the platform, never by the model; behaviour comes from data-* attributes:
     [data-table]          table: th[data-sort] sorts, input[data-filter] filters rows,
                           [data-status-filter] buttons filter by a row's status
     [data-tabs]           [data-tab="x"] buttons show [data-panel="x"]
     [data-segment]        a button group where one is selected (date ranges)
     [data-toggle="#id"]   toggles the target's hidden attribute (menus, drawers)
     [data-open="#id"]     opens a <dialog>; [data-close] closes it
     [data-sidebar-toggle] collapses the app sidebar
     [data-app-search]     top bar search: "/" focuses it, typing filters the screen's table
   AI-written custom blocks (src/sanitize.js lets these through, never script):
     [data-chat]           a demo chat: form[data-chat-form] sends to [data-chat-log]
                           (messages [data-from="user"|"assistant"], words in [data-chat-text]),
                           [data-chat-prompt] buttons send their text, [data-chat-empty]
                           hides after the first message, data-chat-reply is the streamed answer
     [data-select]         a list where one child is current (aria-current)
     input[data-filter-target="#id"]  typing hides that list's children that do not match
   The current page's nav link gets aria-current="page". No network, no storage. */
(function () {
  "use strict";
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  // Selectors from attributes may be malformed: one bad one must not stop the rest.
  var one = function (sel) { try { return document.querySelector(sel); } catch (e) { return null; } };
  var text = function (el) { return (el && el.textContent || "").trim(); };
  var asNumber = function (s) {
    var n = parseFloat(String(s).replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? null : n;
  };

  // Current page in the sidebar.
  var here = location.pathname.split("/").pop() || "index.html";
  $$("nav a[href]").forEach(function (a) {
    var href = a.getAttribute("href").split("#")[0];
    if (href === here || (here === "index.html" && (href === "" || href === "./"))) a.setAttribute("aria-current", "page");
  });

  // Tables: sort, filter, status chips.
  $$("[data-table]").forEach(function (box) {
    var table = box.querySelector("table");
    if (!table || !table.tBodies[0]) return;
    var body = table.tBodies[0];
    var rows = $$("tr", body);
    var query = "", status = "";
    var apply = function () {
      var shown = 0;
      rows.forEach(function (tr) {
        var ok = (!query || text(tr).toLowerCase().indexOf(query) !== -1) &&
          (!status || (tr.querySelector("[data-status]") || {}).textContent && text(tr.querySelector("[data-status]")).toLowerCase() === status);
        tr.hidden = !ok;
        if (ok) shown++;
      });
      var count = box.querySelector("[data-count]");
      if (count) count.textContent = shown + " of " + rows.length;
    };
    $$("input[data-filter]", box).forEach(function (input) {
      input.addEventListener("input", function () { query = input.value.trim().toLowerCase(); apply(); });
    });
    $$("[data-status-filter]", box).forEach(function (btn) {
      btn.addEventListener("click", function () {
        status = btn.getAttribute("data-status-filter").toLowerCase();
        $$("[data-status-filter]", box).forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
        apply();
      });
    });
    $$("th[data-sort]", table).forEach(function (th, col) {
      th.tabIndex = 0;
      var sort = function () {
        var dir = th.getAttribute("aria-sort") === "ascending" ? -1 : 1;
        $$("th[data-sort]", table).forEach(function (h) { h.removeAttribute("aria-sort"); });
        th.setAttribute("aria-sort", dir === 1 ? "ascending" : "descending");
        var idx = Array.prototype.indexOf.call(th.parentNode.children, th);
        rows.sort(function (a, b) {
          var x = text(a.children[idx]), y = text(b.children[idx]);
          var nx = asNumber(x), ny = asNumber(y);
          return (nx !== null && ny !== null ? nx - ny : x.localeCompare(y)) * dir;
        });
        rows.forEach(function (tr) { body.appendChild(tr); });
      };
      th.addEventListener("click", sort);
      th.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sort(); } });
    });
    apply();
  });

  // Tabs.
  $$("[data-tabs]").forEach(function (box) {
    var tabs = $$("[data-tab]", box), panels = $$("[data-panel]", box);
    var show = function (name) {
      tabs.forEach(function (t) { t.setAttribute("aria-selected", String(t.getAttribute("data-tab") === name)); });
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    };
    tabs.forEach(function (t) { t.setAttri