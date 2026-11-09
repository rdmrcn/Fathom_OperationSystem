try {
  var t = localStorage.getItem("fathom-theme");
  if (!t) {
    var raw = localStorage.getItem("fathom-ui-v1");
    if (raw) {
      var parsed = JSON.parse(raw);
      t = parsed && parsed.state && parsed.state.theme;
    }
  }
  if (t === "light") document.documentElement.classList.remove("dark");
  if (t === "dark") document.documentElement.classList.add("dark");
} catch (e) {
  /* private mode / blocked storage */
}
