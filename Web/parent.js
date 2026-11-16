/* parent.js - parent pages + pages everyone uses (notices, account) */
const canPost = () => ["owner", "head"].includes(S.user.role);

function noticeList(a) {
  if (!a.length) return '<p class="mu">No notices.</p>';
  return a.map(n => `<div class="c" style="display:block"><b>${esc(n.title)}</b> <span class="mu">${new Date(n.createdAt).toLocaleDateString()}${n.className && n.className !== "all" ? " · " + esc(n.className) : ""}</span>
    <div style="white-space:pre-wrap;margin-top:4px">${esc(n.body)}</div>${canPost() ? `<button class="r sm" onclick="delNotice('${n._id}')">Delete</button>` : ""}</div>`).join("");
}

PP.home = async m => {
  const [fees, nt] = await Promise.all([api("/fees/mine"), api("/notices")]);
  const kids = fees.length ? fees.map(k => {
    const owed = k.fees.reduce((a, f) => a + f.balance, 0);
    return `<div class="c"><div class="g1"><b>${esc(k.student.name)}</b><div class="mu">${esc(k.student.className)}</div></div>
      <div style="text-align:right"><b class="${owed ? "dn" : "up"}">${owed ? money(owed) : "Fees paid ✓"}</b>${owed ? '<br><button class="sm y" onclick="go(\'pay\')">Pay now</button>' : ""}</div></div>`;
  }).join("") : '<p class="mu">No children linked yet. Please ask the school office to link your children to your account.</p>';
  m.innerHTML = `<h2>Welcome, ${esc(S.user.name)}</h2>${kids}
    <div class="r2"><button onclick="go('reports')">📄 Report cards</button><button class="y" onclick="go('pay')">💳 Pay fees</button></div>
    <h3>Latest notices</h3>${noticeList(nt.slice(0, 3))}`;
};

PP.reports = async m => {
  const d = await api("/reports/mine");
  window.R = d;
  m.innerHTML = "<h2>Report cards</h2>" + (d.length ? d.map((r, i) => `<div class="c"><div class="g1"><b>${esc(r.studentName)}</b>
    <div class="mu">${esc(r.term)} ${esc(r.year)} · ${r.type === "mock" ? "Mock exam" : "Terminal report"} · ${esc(r.className)}</div>
    <div class="mu">Total ${r.total} · Position ${r.position} of ${r.outOf}</div></div><button class="sm" onclick="showReport(R[${i}])">View</button></div>`).join("")
    : '<p class="mu">No report cards have been published yet. You will see them here when the school releases them.</p>');
};

const NETS = ["MTN", "Telecel (Vodafone)", "AirtelTigo"];
const METH = { cash: "Cash at the school office", momo: "Mobile Money", paystack: "Online (Paystack)" };

PP.pay = async m => {
  const [d, mw] = await Promise.all([api("/fees/mine"), api("/fees/momo/mine").catch(() => [])]);
  S.pf = d;
  const sc = S.school || {}, mo = sc.momo || {}, ps = !!sc.paystack;
  const nums = [[mo.network, mo.number, mo.name], [mo.network2, mo.number2, mo.name2]].filter(x => x[1]);
  const owes = d.some(k => k.fees.some(f => f.balance > 0));
  const how = (nums.length ? `<div class="fm"><b>📲 Pay by Mobile Money (MTN or Telecel/Vodafone)</b>`
    + nums.map(n => `<div style="margin:8px 0"><div class="mu">${esc(n[0] || "Mobile Money")}</div><div style="font-size:20px;font-weight:800;color:var(--b)">${esc(n[1])} <button class="sm g" onclick="copyNum('${esc(n[1])}')">Copy</button></div><div>${esc(n[2] || "")}</div></div>`).join("")
    + (mo.note ? `<div class="mu">${esc(mo.note)}</div>` : "")
    + `<p class="mu">1. Send the money to the number above. 2. Tap the button below, type the transaction ID from your MoMo SMS and add a picture of it. 3. The school confirms it and your balance goes down. You will get a receipt.</p>`
    + (owes ? '<button class="y" style="width:100%" onclick="momoModal()">📲 I have paid: send transaction ID</button>' : "") + "</div>" : "")
    + (ps ? '<p class="mu">You can also pay online by card or mobile money with Paystack.</p>' : "");
  const wait = mw.length ? "<h3>Waiting for the school</h3>" + mw.map(p => `<div class="c"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b> <div class="mu">${esc(p.feeId && p.feeId.title)} · ${money(p.amount)} · ${esc(p.network || "MoMo")} · ID ${esc(p.txnId)}</div>${p.status === "rejected" ? `<div class="dn">Rejected: ${esc(p.reason || "please contact the school")}</div>` : ""}</div>
    <span class="badge${p.status === "review" ? "" : " dn"}">${p.status === "review" ? "Waiting for confirmation" : "Rejected"}</span></div>`).join("") : "";
  m.innerHTML = `<h2>Pay fees</h2>${how}` + (d.length ? d.map(k => `<h3>${esc(k.student.name)} <small class="mu">${esc(k.student.className)}</small></h3>` + (k.fees.length ? k.fees.map(f => `<div class="c" style="flex-wrap:wrap"><div class="g1">
    <b>${esc(f.title)}</b> ${f.type === "exam" ? '<span class="badge">Exam fee</span>' : ""} ${f.carried ? `<span class="badge dn">Unpaid from ${esc(f.className)}</span>` : ""}
    <div class="mu">Due ${new Date(f.dueDate).toLocaleDateString()}</div><div class="mu">Total ${money(f.amount)} · Paid ${money(f.paid)}</div></div>`
    + (f.balance > 0 ? `<div style="min-width:160px"><input id="pa_${f.feeId}_${k.student.id}" type="number" min="1" max="${f.balance}" value="${f.balance}">${mo.number ? `<button class="y sm" style="width:100%" onclick="momoModal('${k.student.id}','${f.feeId}')">📲 Pay by MoMo</button>` : ""}${ps ? `<button class="sm" style="width:100%" onclick="payNow('${k.student.id}','${f.feeId}')">💳 Pay online</button>` : ""}${!mo.number && !ps ? '<span class="mu">Ask the school how to pay</span>' : ""}</div>` : '<b class="up">Paid ✓</b>') + "</div>").join("") : '<p class="mu">No fees yet.</p>')).join("")
    : '<p class="mu">No children linked yet.</p>') + wait;
};
function copyNum(n) {
  if (navigator.clipboard) navigator.clipboard.writeText(n).then(() => toast("Number copied ✅"), () => toast(n));
  else toast(n);
}

/* the form where a parent types the transaction ID and adds the picture */
function momoModal(sid, fid) {
  const kids = (S.pf || []).filter(k => k.fees.some(f => f.balance > 0)), mo = (S.school || {}).momo || {};
  if (!kids.length) return toast("Nothing is owed right now");
  sid = sid || kids[0].student.id;
  const pre = $("#pa_" + fid + "_" + sid), amt = pre ? +pre.value : 0;
  S.mp = { proof: "" };
  openModal(`<h3>Send proof of MoMo payment</h3><p class="mu">Fill in what is on your MoMo SMS${mo.number ? " (paid to " + esc(mo.number) + ")" : ""}.</p>
    <label class="l1">Child</label><select id="mp_s" onchange="mpKid()">${kids.map(k => `<option value="${k.student.id}"${k.student.id === sid ? " selected" : ""}>${esc(k.student.name)}</option>`).join("")}</select>
    <label class="l1">Paying for</label><select id="mp_f" onchange="mpFee()"></select>
    <label class="l1">Amount you sent (GHS)</label><input id="mp_a" type="number" min="1" step="0.01">
    <label class="l1">Network you paid with</label><select id="mp_w"><option value="">Choose…</option>${NETS.map(n => `<option>${n}</option>`).join("")}</select>
    <label class="l1">Transaction ID (from the MoMo SMS)</label><input id="mp_t" placeholder="e.g. 7458123456" autocapitalize="characters" autocomplete="off">
    <label class="l1">Number you paid from (optional)</label><input id="mp_n" inputmode="tel">
    <label class="l1">Picture of the payment (screenshot or photo of the SMS)</label><input type="file" accept="image/*" onchange="momoPick(this)"><img id="mp_i" style="max-width:100%;max-height:260px;margin-top:6px;display:none">
    <div class="noprint"><button class="y" onclick="momoSend()">Send to school</button><button class="g" onclick="closeModal()">Cancel</button></div>`);
  mpKid(fid, amt);
}
function mpKid(fid, amt) {
  const k = (S.pf || []).find(x => String(x.student.id) === $("#mp_s").value), fs = k ? k.fees.filter(f => f.balance > 0) : [];
  $("#mp_f").innerHTML = fs.map(f => `<option value="${f.feeId}"${String(f.feeId) === String(fid) ? " selected" : ""}>${esc(f.title)} (owing ${money(f.balance)})</option>`).join("");
  mpFee(amt);
}
function mpFee(amt) {
  const k = (S.pf || []).find(x => String(x.student.id) === $("#mp_s").value), f = k && k.fees.find(z => String(z.feeId) === $("#mp_f").value);
  if (f) { $("#mp_a").max = f.balance; $("#mp_a").value = amt > 0 && amt <= f.balance ? amt : f.balance; }
}
async function momoPick(inp) {
  if (!inp.files[0]) return;
  try { S.mp.proof = await imgShrink(inp.files[0], 900, .7, "image/jpeg"); const i = $("#mp_i"); i.src = S.mp.proof; i.style.display = "block"; }
  catch (e) { toast("Could not read that picture"); }
}
async function momoSend() {
  const x = S.mp, t = $("#mp_t").value.trim();
  if (!$("#mp_f").value) return toast("Choose what you are paying for");
  if (!$("#mp_w").value) return toast("Choose the network you paid with");
  if (t.length < 6) return toast("Type the transaction ID from your MoMo SMS");
  if (!x.proof) return toast("Add the picture of the payment first");
  busy(true);
  try { await api("/fees/momo", "POST", { studentId: $("#mp_s").value, feeId: $("#mp_f").value, amount: +$("#mp_a").value, network: $("#mp_w").value, txnId: t, payerNumber: $("#mp_n").value, proof: x.proof }); closeModal(); toast("Sent ✅ The school will confirm it soon"); go("pay"); }
  catch (e) { toast(e.message); }
  busy(false);
}
async function payNow(sid, fid) {
  const v = +$("#pa_" + fid + "_" + sid).value;
  busy(true);
  try { const j = await api("/paystack/init", "POST", { studentId: sid, feeId: fid, amount: v }); location.href = j.url; }
  catch (e) { busy(false); toast(e.message); }
}
async function verifyPaid(ref) {
  busy(true);
  try { const j = await api("/paystack/verify/" + encodeURIComponent(ref)); toast(j.status === "success" ? "Payment successful ✅" : "Payment " + j.status); go("history"); }
  catch (e) { toast(e.message); }
  busy(false);
}

/* ----- payments + receipts ----- */
PP.history = async m => {
  const d = await api("/fees/history");
  window.H = d;
  m.innerHTML = "<h2>Payments and receipts</h2>" + (d.length ? d.map((p, i) => `<div class="c"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b>
    <div class="mu">${esc(p.feeId && p.feeId.title)} · ${new Date(p.paidAt).toLocaleDateString()}</div><div class="mu">${esc(METH[p.method] || p.method)}${p.network ? " · " + esc(p.network) : ""} · ${esc(p.receiptNo)}</div></div>
    <div style="text-align:right"><b>${money(p.amount)}</b><br><button class="sm g" onclick="receipt(${i})">🧾 Receipt</button></div></div>`).join("") : '<p class="mu">No payments yet.</p>');
};
function receiptText(p) {
  const sc = S.school || {}, st = p.studentId || {};
  return "🧾 PAYMENT RECEIPT\n" + (sc.invoiceName || sc.name || "") + "\nReceipt no: " + (p.receiptNo || p.reference) + "\nStudent: " + (st.name || "") + "\nPaid for: " + ((p.feeId && p.feeId.title) || "") +
    "\nAmount paid: " + money(p.amount) + (p.txnId ? "\nTransaction ID: " + p.txnId : "") + "\nBalance left: " + money(p.balanceAfter) + "\nDate: " + new Date(p.paidAt).toLocaleDateString() + "\nThank you.";
}
function receiptHTML(p) {
  const sc = S.school || {}, st = p.studentId || {}, f = p.feeId || {};
  const row = (a, b) => `<tr><td class="l">${a}</td><td class="l">${b}</td></tr>`;
  return `<div class="rc"><div class="rh"><div class="lo2">${logoHTML()}</div><div><h2>${esc(sc.invoiceName || sc.name)}</h2><p>${esc(sc.address || "")} ${esc(sc.phone || "")}</p></div></div>
    <div class="rbn">PAYMENT RECEIPT</div><div style="height:10px"></div>
    <table class="rt2">${row("Receipt no.", "<b>" + esc(p.receiptNo || p.reference) + "</b>")}${row("Date", new Date(p.paidAt).toLocaleString())}
    ${row("Student", esc(st.name) + (st.className ? " (" + esc(st.className) + ")" : ""))}${row("Paid for", esc(f.title))}
    ${row("Method", esc(METH[p.method] || p.method) + (p.network ? " · " + esc(p.network) : ""))}${p.txnId ? row("Transaction ID", esc(p.txnId)) : ""}
    ${row("Fee total", money(p.feeTotal))}${row("<b>Amount paid</b>", "<b>" + money(p.amount) + "</b>")}${row("Balance left on this fee", money(p.balanceAfter))}</table>
    <div style="text-align:center;margin:14px 0 4px"><span style="display:inline-block;border:3px solid #0a7d3b;color:#0a7d3b;font-weight:900;letter-spacing:3px;padding:3px 14px;border-radius:8px;transform:rotate(-5deg)">PAID</span></div>
    <p class="ky">Thank you. This receipt was issued by ${esc(sc.invoiceName || sc.name)}.</p></div>`;
}
/* phone = the parent's number when the school sends it; empty = the person picks who gets it */
function receiptModal(p, phone) {
  window.RCP = { p, phone: phone || "" };
  openModal(receiptHTML(p) + `<div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="y" onclick="shareReceipt()">💬 Send on WhatsApp</button><button class="g" onclick="closeModal()">Close</button></div>`);
}
function shareReceipt() {
  const x = window.RCP;
  if (x.phone) window.open(wa(x.phone, receiptText(x.p)), "_blank");
  else if (navigator.share) navigator.share({ title: "Receipt", text: receiptText(x.p) }).catch(() => { });
  else window.open(wa("", receiptText(x.p)), "_blank");
}
function receipt(i) { receiptModal(H[i]); }

/* ----- shared: notices ----- */
P.notices = async m => {
  const a = await api("/notices");
  const form = canPost() ? `<div class="fm"><b>Send a notice</b><input id="nt_t" placeholder="Title"><textarea id="nt_b" rows="3" placeholder="Message"></textarea>
    <div class="r2"><select id="nt_a"><option value="all">Everyone</option><option value="parents">Parents only</option><option value="teachers">Teachers only</option></select>
    <select id="nt_c"><option value="all">All classes</option>${opts(S.school.classes)}</select></div><button class="y" onclick="postNotice()">Post notice</button></div>` : "";
  m.innerHTML = "<h2>Notices</h2>" + form + noticeList(a);
};
async function postNotice() {
  busy(true);
  try { await api("/notices", "POST", { title: $("#nt_t").value, body: $("#nt_b").value, audience: $("#nt_a").value, className: $("#nt_c").value }); toast("Notice posted"); go("notices"); }
  catch (e) { toast(e.message); }
  busy(false);
}
async function delNotice(id) { if (!confirm("Delete this notice?")) return; await api("/notices/" + id, "DELETE"); go("notices"); }

/* ----- shared: account ----- */
P.account = m => {
  const link = location.origin + "/?school=" + S.school.code;
  m.innerHTML = `<h2>Account</h2><div class="fm"><b>${esc(S.user.name)}</b><div class="mu">${ROLE[S.user.role]} · ${esc(S.school.name)}</div></div>
    ${S.user.role !== "parent" ? `<div class="fm"><b>School app link</b><p class="mu">Send this link to parents and teachers. School code: <b>${esc(S.school.code)}</b></p><input readonly value="${esc(link)}" onclick="this.select()"><button class="sm" onclick="shareApp()">Share link</button></div>` : ""}
    <div class="fm"><b>Change password</b><input id="op" type="password" placeholder="Old password"><input id="np" type="password" placeholder="New password (6+ characters)"><button onclick="chPw()">Save password</button></div>
    ${P.look ? '<button class="g" onclick="go(\'look\')">🎨 Appearance (dark mode, colours, text size)</button>' : ""}
    <button class="r" onclick="logout()">Sign out</button>`;
};
function shareApp() {
  const link = location.origin + "/?school=" + S.school.code, t = "Open the " + S.school.name + " app: " + link;
  if (navigator.share) navigator.share({ title: S.school.name, text: t }).catch(() => { });
  else window.open("https://wa.me/?text=" + encodeURIComponent(t));
}
async function chPw() {
  if (($("#np").value || "").length < 6) return toast("New password must be 6+ characters");
  try { await api("/auth/change-password", "POST", { oldPassword: $("#op").value, newPassword: $("#np").value }); toast("Password changed ✅"); $("#op").value = ""; $("#np").value = ""; }
  catch (e) { toast(e.message); }
}

/* =====================================================================
   EXTRAS (all in this one file): appearance, staff receipts, WhatsApp, MoMo SMS check
   ===================================================================== */

/* ---------- APPEARANCE (each phone keeps its own choice) ---------- */
const LOOKS = {
  school: ["School colours"], blue: ["Blue & Gold", "#0b2a8f", "#f5b800"], green: ["Green", "#0a6b3a", "#f5b800"],
  purple: ["Purple", "#5b2a9a", "#ffb300"], red: ["Red", "#b3261e", "#ffd54f"], teal: ["Teal", "#00766c", "#ff9800"],
  pink: ["Pink", "#c2185b", "#ffd54f"], black: ["Dark grey", "#2b3245", "#f5b800"]
};
const getLook = () => Object.assign({ mode: "light", color: "school", size: 100 }, J("look", {}));

(function () {
  const st = document.createElement("style");
  st.textContent = `
  main{zoom:var(--zm,1)}
  html[data-mode=dark]{color-scheme:dark}
  html[data-mode=dark] body{background:#0e1322;color:#e7eaf6}
  html[data-mode=dark] h3{color:#e7eaf6}
  html[data-mode=dark] input,html[data-mode=dark] select,html[data-mode=dark] textarea{background:#1a2138;color:#e7eaf6;border-color:#38426a}
  html[data-mode=dark] button.g{background:#29335a;color:#d5dcff}
  html[data-mode=dark] a{color:#9db4ff}
  html[data-mode=dark] .mu,html[data-mode=dark] .st small,html[data-mode=dark] .nt small{color:#9aa5c6}
  html[data-mode=dark] .c,html[data-mode=dark] .fm,html[data-mode=dark] .lb,html[data-mode=dark] #side,html[data-mode=dark] .st div,html[data-mode=dark] .tw,html[data-mode=dark] .t td.pn,html[data-mode=dark] .mc,html[data-mode=dark] .sbsh{background:#171e34;color:#e7eaf6}
  html[data-mode=dark] .mi{color:#e7eaf6;border-bottom-color:#232c4a}
  html[data-mode=dark] .mi.on{background:#222c52;color:#fff}
  html[data-mode=dark] .nt{background:#171e34;color:#e7eaf6;border-color:#2a3558}
  html[data-mode=dark] .nt.un{background:#2a2540}
  html[data-mode=dark] .t td{border-bottom-color:#2a3558}
  html[data-mode=dark] .badge,html[data-mode=dark] .bar,html[data-mode=dark] .ac button.off{background:#29335a;color:#d5dcff}
  html[data-mode=dark] .lgpv{background:#1a2138;border-color:#38426a}
  html[data-mode=dark] .lb h2,html[data-mode=dark] label.l1,html[data-mode=dark] main>h2{color:#9db4ff}
  html[data-mode=dark] #bz{background:#0e1322cc;color:#9db4ff}
  html[data-mode=dark] .pwr .tg{color:#9db4ff}
  .lk{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}
  .lk button{flex:1;min-width:88px;margin:0;background:#e6ebf8;color:#1b2133;border:3px solid transparent}
  .lk button.on{border-color:var(--y);background:var(--b);color:#fff}
  .sw{display:inline-block;width:18px;height:18px;border-radius:50%;vertical-align:middle;margin-right:6px;border:2px solid #fff}`;
  document.head.appendChild(st);
})();

function applyAppearance() {
  const l = getLook(), r = document.documentElement, dark = l.mode === "dark" || (l.mode === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  r.dataset.mode = dark ? "dark" : "light";
  r.style.setProperty("--zm", String((l.size || 100) / 100));
  const c = LOOKS[l.color];
  if (c && c[1]) { r.style.setProperty("--b", c[1]); r.style.setProperty("--y", c[2]); const tc = $("#tc"); if (tc) tc.content = c[1]; }
}
const _applyLook = applyLook;
applyLook = function () { _applyLook(); applyAppearance(); };
applyAppearance();

function setLook(k, v) {
  const l = getLook(); l[k] = v; localStorage.setItem("look", JSON.stringify(l));
  if (k === "color" && v === "school" && S.school) brand(S.school); else applyAppearance();
  if (S.page === "look") go("look");
}
P.look = m => {
  const l = getLook();
  const row = (key, list) => `<div class="lk">${list.map(o => `<button class="${String(l[key]) === String(o[0]) ? "on" : ""}" onclick="setLook('${key}',${typeof o[0] === "number" ? o[0] : "'" + o[0] + "'"})">${o[1]}</button>`).join("")}</div>`;
  m.innerHTML = `<h2>Appearance</h2><p class="mu">This changes how the app looks on THIS phone only. The school's own colours are set by the owner in School Settings.</p>
    <div class="fm"><b>Mode</b>${row("mode", [["light", "☀️ Light"], ["dark", "🌙 Dark"], ["auto", "📱 Automatic"]])}</div>
    <div class="fm"><b>Colour</b><div class="lk">${Object.keys(LOOKS).map(k => `<button class="${l.color === k ? "on" : ""}" onclick="setLook('color','${k}')">${LOOKS[k][1] ? `<span class="sw" style="background:${LOOKS[k][1]}"></span>` : "🏫 "}${LOOKS[k][0]}</button>`).join("")}</div></div>
    <div class="fm"><b>Text size</b>${row("size", [[90, "Small"], [100, "Normal"], [112, "Large"], [125, "Extra large"]])}</div>
    <p class="mu">Report cards and receipts always print in their normal look.</p>`;
};

/* side menu: add Appearance for everyone, Receipts for head/owner */
["parent", "teacher", "head", "owner"].forEach(r => {
  const M = MENU[r], i = M.findIndex(x => x[0] === "account");
  M.splice(i < 0 ? M.length : i, 0, ["look", "🎨", "Appearance"]);
  if (r === "head" || r === "owner") { const j = M.findIndex(x => x[0] === "momo"); M.splice(j + 1, 0, ["receipts", "🧾", "Receipts"]); }
});

/* ---------- STAFF: receipts page ---------- */
PS.receipts = async m => {
  const d = await api("/fees/receipts");
  window.RL = d;
  m.innerHTML = `<h2>Receipts</h2><p class="mu">Every confirmed payment (cash, MoMo and online). Tap Receipt to print it or send it to the parent on WhatsApp.</p>
    <input placeholder="🔍 Search student, receipt no. or transaction ID" oninput="filterList('#rcl',this.value)"><div id="rcl">`
    + (d.length ? d.map((p, i) => `<div class="c"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b> <span class="mu">${esc(p.studentId && p.studentId.className)}</span>
      <div class="mu">${esc(p.feeId && p.feeId.title)} · ${new Date(p.paidAt).toLocaleDateString()}</div><div class="mu">${esc(METH[p.method] || p.method)}${p.network ? " · " + esc(p.network) : ""} · ${esc(p.receiptNo)} ${esc(p.txnId || "")}</div></div>
      <div style="text-align:right"><b>${money(p.amount)}</b><br><button class="sm g" onclick="staffReceipt(${i})">🧾 Receipt</button></div></div>`).join("") : '<p class="mu">No payments yet.</p>') + "</div>";
};
function staffReceipt(i) {
  const p = RL[i], par = ((p.studentId && p.studentId.parents) || []).find(x => x && x.phone);
  receiptModal(p, par ? par.phone : "");
}
/* open the receipt of one payment right after it was recorded or approved */
async function receiptById(id) {
  busy(true);
  try {
    const d = await api("/fees/receipts"), p = d.find(x => String(x._id) === String(id));
    if (!p) throw new Error("Receipt not found yet. Open the Receipts page.");
    const par = ((p.studentId && p.studentId.parents) || []).find(x => x && x.phone);
    receiptModal(p, par ? par.phone : "");
  } catch (e) { toast(e.message); }
  busy(false);
}

/* ---------- MoMo: the app checks the transaction IDs against the school's own MoMo SMS ---------- */
function smsCheck(p, text) {
  const id = String(p.txnId || "").replace(/\s+/g, "").toLowerCase(), low = text.toLowerCase();
  if (id.length < 6 || !low.includes(id)) return { found: false };
  let block = "";
  for (const b of text.split(/\n\s*\n+/)) if (b.toLowerCase().includes(id)) { block = b; break; }
  if (block.length > 600) { const k = block.toLowerCase().indexOf(id); block = block.slice(Math.max(0, k - 220), k + 220); }
  const amts = [...block.matchAll(/(?:GHS|GH₵|GHC|₵|cedis?)\s*([\d,]+(?:\.\d{1,2})?)/gi)].map(x => parseFloat(x[1].replace(/,/g, "")));
  return { found: true, amts, ok: amts.some(a => Math.abs(a - p.amount) < 0.01), text: block.replace(/\s+/g, " ").trim().slice(0, 140) };
}
function smsRun() {
  const text = $("#sms_box").value;
  if (text.trim().length < 10) return toast("Paste your MoMo messages first");
  window.MC = MO.map(p => smsCheck(p, text));
  MO.forEach((p, i) => {
    const r = MC[i], el = $("#mo_st" + i);
    el.innerHTML = !r.found ? '<span class="dn">❌ Not found in your messages</span>'
      : r.ok ? `<span class="up">✅ Found in your SMS, amount matches</span><div class="mu">${esc(r.text)}</div>`
        : `<span class="dn">⚠️ ID found but the amount is different (SMS: ${r.amts.map(a => money(a)).join(", ") || "?"})</span><div class="mu">${esc(r.text)}</div>`;
  });
  const n = MC.filter(r => r.found && r.ok).length;
  $("#sms_res").innerHTML = n ? `<button class="y" style="width:100%" onclick="smsApproveAll()">✅ Approve the ${n} payment(s) that match</button>` : '<p class="mu">Nothing matched yet.</p>';
}
async function smsApproveAll() {
  const ids = MO.map((p, i) => (MC[i] && MC[i].found && MC[i].ok) ? p : null).filter(Boolean);
  if (!ids.length || !confirm("Approve " + ids.length + " payment(s) that were found in your MoMo SMS?")) return;
  busy(true);
  let ok = 0;
  for (const p of ids) { try { await api("/fees/momo/" + p._id + "/approve", "POST", { amount: p.amount }); ok++; } catch (e) { } }
  busy(false);
  toast("Approved " + ok + " of " + ids.length + " ✅"); go("momo");
}

/* ---------- things that live in staff.js are replaced AFTER all files have loaded ---------- */
function installExtras() {
  applyAppearance();

  PS.momo = async m => {
    const d = await api("/fees/momo/review");
    window.MO = d; window.MC = [];
    m.innerHTML = `<h2>MoMo payments to confirm</h2><p class="mu">Approve only what you can see in your own MoMo account. Or let the app check for you: paste your MoMo SMS messages below and it will tell you which payments are really in them.</p>
      ${d.length ? `<div class="fm"><b>🔍 Check against my MoMo SMS</b><textarea id="sms_box" rows="4" placeholder="Paste the MoMo messages received on the school's number here (you can paste many)"></textarea><button class="sm" onclick="smsRun()">Check now</button><div id="sms_res"></div></div>` : ""}`
      + (d.length ? d.map((p, i) => `<div class="c" style="display:block"><div style="display:flex;gap:8px"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b> <span class="mu">${esc(p.studentId && p.studentId.className)}</span>
        <div class="mu">${esc(p.feeId && p.feeId.title)}</div></div><b>${money(p.amount)}</b></div>
        <div class="mu">${p.network ? "<b>" + esc(p.network) + "</b> · " : ""}Transaction ID: <b>${esc(p.txnId)}</b>${p.payerNumber ? " · Paid from " + esc(p.payerNumber) : ""}</div>
        <div class="mu">${esc(p.parentId && p.parentId.name)} ${esc(p.parentId && p.parentId.phone || "")} · ${new Date(p.createdAt).toLocaleString()}</div><div id="mo_st${i}"></div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px"><button class="sm g" onclick="momoProof(${i})">🖼 See screenshot</button>
        <input id="mo_a${i}" type="number" value="${p.amount}" style="width:100px;margin:0"><button class="sm" onclick="momoOk(${i})">✅ Approve</button><button class="sm r" onclick="momoNo(${i})">Reject</button></div></div>`).join("")
        : '<p class="up">Nothing waiting. 🎉</p>');
  };

  window.momoOk = async function (i) {
    const p = MO[i], amt = +$("#mo_a" + i).value;
    if (!confirm("Approve " + money(amt) + " for " + p.studentId.name + "? Only do this if the money is in your MoMo account.")) return;
    busy(true);
    try {
      const j = await api("/fees/momo/" + p._id + "/approve", "POST", { amount: amt });
      toast("Payment confirmed ✅");
      const phone = p.parentId && p.parentId.phone;
      const txt = "Dear parent, we have received GHS " + amt.toFixed(2) + " for " + p.studentId.name + " (" + (p.feeId && p.feeId.title) + "). Transaction ID: " + p.txnId + ". Your receipt is in the school app under Payments. Thank you. " + (S.school.invoiceName || S.school.name);
      go("momo");
      openModal(`<h3>✅ Payment confirmed</h3><p class="mu">The parent can see the receipt in the app.</p><div class="noprint"><button class="y" style="width:100%" onclick="receiptById('${j.id}')">🧾 View / print receipt</button>${phone ? `<a href="${wa(phone, txt)}" target="_blank"><button style="width:100%">💬 Tell ${esc(p.parentId.name)} on WhatsApp</button></a>` : ""}<button class="g" onclick="closeModal()">Close</button></div>`);
    } catch (e) { toast(e.message); }
    busy(false);
  };

  window.recCash = async function (sid, fid) {
    busy(true);
    try { const j = await api("/fees/cash", "POST", { studentId: sid, feeId: fid, amount: +$("#cs_" + fid).value }); toast("Payment recorded ✅"); closeModal(); go("owing"); busy(false); return receiptById(j._id); }
    catch (e) { toast(e.message); }
    busy(false);
  };

  PS.owing = async m => {
    const d = await api("/fees/owing");
    window.OW = d;
    const sum = d.reduce((a, x) => a + x.owed, 0), ch = (S.school.reminder || {}).channel === "whatsapp" ? "WhatsApp" : "SMS";
    const msg = x => `Dear parent, ${x.name} owes ${money(x.owed)} at ${S.school.name}. Please pay through the school app. Thank you.`;
    m.innerHTML = `<h2>Who owes</h2><p class="mu">${d.length} student(s) owe ${money(sum)}. <b>WhatsApp chat</b> opens WhatsApp on your phone (free). <b>Send reminder</b> sends by the school's ${ch} setting from the server.</p>
      ${d.length ? `<button class="y" style="width:100%" onclick="remindAll()">📤 Send reminders to everyone who owes (${ch})</button>` : ""}
      <input placeholder="🔍 Search student or parent" oninput="filterList('#owl',this.value)"><div id="owl">` + (d.length ? d.map((x, i) => `<div class="c" style="display:block"><div style="display:flex"><div class="g1"><b>${esc(x.name)}</b> <span class="mu">${esc(x.className)}</span></div><b class="dn">${money(x.owed)}</b></div>
      ${(x.parents || []).map(p => `<div class="mu">${esc(p.name)} ${esc(p.phone || "")}</div>${p.phone ? `<a href="tel:${esc(p.phone)}"><button class="sm g">📞 Call</button></a> <a href="${wa(p.phone, msg(x))}" target="_blank"><button class="sm g">💬 WhatsApp chat</button></a>` : ""}`).join("")}
      <div><button class="sm y" onclick="remindOne(${i})">📤 Send reminder</button> <button class="sm" onclick="cashModal(${i})">Record cash payment</button></div></div>`).join("") : '<p class="up">Nobody owes. 🎉</p>') + "</div>";
  };

  window.momoBlock = function (s) {
    const m = s.momo || {};
    return `<div class="fm"><b>Mobile money (parents pay, then type the transaction ID and add a picture)</b><p class="mu">Parents see these numbers. You confirm each payment under "MoMo payments".</p>
      <label class="l1">Network (1st number)</label><input id="mo_nw" value="${esc(m.network || "MTN MoMo")}" placeholder="MTN MoMo">
      <label class="l1">MoMo number</label><input id="mo_no" value="${esc(m.number || "")}" placeholder="0244000000" inputmode="tel">
      <label class="l1">Name on the account</label><input id="mo_nm" value="${esc(m.name || "")}">
      <label class="l1">Network (2nd number, optional)</label><input id="mo_nw2" value="${esc(m.network2 || "")}" placeholder="Telecel Cash (Vodafone)">
      <label class="l1">2nd MoMo number (optional)</label><input id="mo_no2" value="${esc(m.number2 || "")}" placeholder="0204000000" inputmode="tel">
      <label class="l1">Name on the 2nd account</label><input id="mo_nm2" value="${esc(m.name2 || "")}">
      <label class="l1">Note to parents (optional)</label><input id="mo_nt" value="${esc(m.note || "")}" placeholder="e.g. Use the student's name as reference"></div>`;
  };

  window.saveSettings = async function () {
    const body = {
      name: $("#st_n").value.trim(), invoiceName: $("#st_i").value.trim(), motto: $("#st_m").value.trim(),
      address: $("#st_ad").value.trim(), phone: $("#st_ph").value.trim(),
      colors: { primary: $("#st_p").value, accent: $("#st_a").value },
      reportTheme: $("#st_th").value, reportLayout: $("#st_ly").value,
      ink: { font: $("#st_if").value, color: $("#st_ic").value },
      momo: { network: $("#mo_nw").value.trim(), number: $("#mo_no").value.trim(), name: $("#mo_nm").value.trim(), note: $("#mo_nt").value.trim(), network2: $("#mo_nw2").value.trim(), number2: $("#mo_no2").value.trim(), name2: $("#mo_nm2").value.trim() },
      reportTpl: Object.assign({ top: +$("#tp_top").value || 0, side: +$("#tp_side").value || 0, bot: +$("#tp_bot").value || 0, hideHead: $("#tp_hd").checked }, S.rmTpl ? { img: "" } : S.newTpl ? { img: S.newTpl } : {}),
      classes: lines("#st_cl"), subjects: lines("#st_sb"),
      reminder: { enabled: $("#st_re").checked, channel: $("#st_ch").value, monthsLimit: +$("#st_ml").value, dayOfMonth: +$("#st_dy").value, message: $("#st_ms").value.trim() }
    };
    if (!body.name) return toast("School name cannot be empty");
    if (S.newLogo) body.logo = S.newLogo;
    busy(true);
    try {
      const s = await api("/school/mine", "PUT", body);
      try { localStorage.removeItem("rcLayout"); } catch (e) { }
      S.school = null; brand(s);
      localStorage.setItem("brand", JSON.stringify(pub(s)));
      localStorage.removeItem("sbInk"); applyLook();
      buildMenu(); toast("Saved ✅"); go("settings");
    } catch (e) { toast(e.message); }
    busy(false);
  };

  const _settings = PS.settings;
  PS.settings = async m => {
    await _settings(m);
    const h = m.querySelector("h2");
    if (h) h.insertAdjacentHTML("afterend", '<button class="g" style="width:100%" onclick="go(\'look\')">🎨 App appearance: dark mode, colours, text size (this phone)</button>');
    [...m.querySelectorAll("p.mu")].forEach(p => { if (p.textContent.includes("next step")) p.textContent = "Reminders go out automatically at 8am on that day. If WhatsApp cannot send, the SMS is used instead."; });
    let w = { whatsapp: false, template: false, sms: false };
    try { w = await api("/reminders/status"); } catch (e) { }
    const save = m.querySelector("button.y[onclick='saveSettings()']");
    if (save) save.insertAdjacentHTML("beforebegin", `<div class="fm"><b>WhatsApp</b>
      <p>${w.whatsapp ? "✅ WhatsApp is connected on the server." + (w.template ? "" : " (No template name set: plain messages reach only parents who wrote to your number in the last 24 hours.)") : "⚠️ WhatsApp is not connected yet. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_ID (and WHATSAPP_TEMPLATE) in Render > Environment."}</p>
      <p class="mu">Without it, the <b>WhatsApp chat</b> buttons on the "Who owes", "Receipts" and "MoMo" pages still work: they open WhatsApp on your phone with the message ready.</p>
      <label class="l1">Send a test to this number (blank = the phone number on your account)</label><input id="wt_no" inputmode="tel" placeholder="0244123456">
      <div class="r2"><button class="sm" onclick="testMsg('whatsapp')">Test WhatsApp</button><button class="sm g" onclick="testMsg('sms')">Test SMS</button></div></div>`);
  };
}
async function remindOne(i) {
  busy(true);
  try { const j = await api("/reminders/send", "POST", { studentId: OW[i].id, smsFallback: true }); toast("Reminder sent by " + (j.via === "whatsapp" ? "WhatsApp" : "SMS") + " ✅"); }
  catch (e) { toast(e.message); }
  busy(false);
}
async function remindAll() {
  if (!confirm("Send a reminder to every parent who owes?")) return;
  busy(true);
  try { const j = await api("/reminders/run", "POST", {}); toast("Sent " + j.sent + " of " + j.total + (j.failed ? " (" + j.failed + " failed)" : "") + " ✅"); }
  catch (e) { toast(e.message); }
  busy(false);
}
async function testMsg(channel) {
  busy(true);
  try { const j = await api("/reminders/test", "POST", { channel, phone: $("#wt_no").value.trim() }); toast("Test sent by " + (j.via === "whatsapp" ? "WhatsApp" : "SMS") + " ✅"); }
  catch (e) { toast(e.message); }
  busy(false);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installExtras); else installExtras();