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

PP.pay = async m => {
  const [d, mw] = await Promise.all([api("/fees/mine"), api("/fees/momo/mine").catch(() => [])]);
  const sc = S.school || {}, mo = sc.momo || {}, ps = !!sc.paystack;
  const how = (mo.number ? `<div class="fm"><b>📲 Pay by ${esc(mo.network || "Mobile Money")}</b><div style="font-size:20px;font-weight:800;color:var(--b);margin:4px 0">${esc(mo.number)}</div><div>${esc(mo.name || "")}</div>${mo.note ? `<div class="mu">${esc(mo.note)}</div>` : ""}
    <p class="mu">1. Send the money to this number. 2. Tap "Pay by MoMo" on the fee below and add the transaction ID and a screenshot. 3. The school confirms it and your balance goes down.</p></div>` : "")
    + (ps ? '<p class="mu">You can also pay online by card or mobile money with Paystack.</p>' : "");
  const wait = mw.length ? "<h3>Waiting for the school</h3>" + mw.map(p => `<div class="c"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b> <div class="mu">${esc(p.feeId && p.feeId.title)} · ${money(p.amount)} · ID ${esc(p.txnId)}</div>${p.status === "rejected" ? `<div class="dn">Rejected: ${esc(p.reason || "please contact the school")}</div>` : ""}</div>
    <span class="badge${p.status === "review" ? "" : " dn"}">${p.status === "review" ? "Waiting for confirmation" : "Rejected"}</span></div>`).join("") : "";
  m.innerHTML = `<h2>Pay fees</h2>${how}` + (d.length ? d.map(k => `<h3>${esc(k.student.name)} <small class="mu">${esc(k.student.className)}</small></h3>` + (k.fees.length ? k.fees.map(f => `<div class="c" style="flex-wrap:wrap"><div class="g1">
    <b>${esc(f.title)}</b> ${f.type === "exam" ? '<span class="badge">Exam fee</span>' : ""} ${f.carried ? `<span class="badge dn">Unpaid from ${esc(f.className)}</span>` : ""}
    <div class="mu">Due ${new Date(f.dueDate).toLocaleDateString()}</div><div class="mu">Total ${money(f.amount)} · Paid ${money(f.paid)}</div></div>`
    + (f.balance > 0 ? `<div style="min-width:160px"><input id="pa_${f.feeId}_${k.student.id}" type="number" min="1" max="${f.balance}" value="${f.balance}">${mo.number ? `<button class="y sm" style="width:100%" onclick="momoModal('${k.student.id}','${f.feeId}')">📲 Pay by MoMo</button>` : ""}${ps ? `<button class="sm" style="width:100%" onclick="payNow('${k.student.id}','${f.feeId}')">💳 Pay online</button>` : ""}${!mo.number && !ps ? '<span class="mu">Ask the school how to pay</span>' : ""}</div>` : '<b class="up">Paid ✓</b>') + "</div>").join("") : '<p class="mu">No fees yet.</p>')).join("")
    : '<p class="mu">No children linked yet.</p>') + wait;
};
function momoModal(sid, fid) {
  const amt = +$("#pa_" + fid + "_" + sid).value || 0, mo = (S.school || {}).momo || {};
  S.mp = { sid, fid, proof: "" };
  openModal(`<h3>Send proof of MoMo payment</h3><p class="mu">Paid to ${esc(mo.number)} (${esc(mo.name || mo.network || "")}). Fill in what is on your MoMo SMS.</p>
    <label class="l1">Amount you sent (GHS)</label><input id="mp_a" type="number" min="1" value="${amt}">
    <label class="l1">Transaction ID (from the SMS)</label><input id="mp_t" placeholder="e.g. 7458123456" autocapitalize="characters">
    <label class="l1">Number you paid from (optional)</label><input id="mp_n" inputmode="tel">
    <label class="l1">Screenshot of the payment</label><input type="file" accept="image/*" onchange="momoPick(this)"><img id="mp_i" style="max-width:100%;max-height:260px;margin-top:6px;display:none">
    <div class="noprint"><button class="y" onclick="momoSend()">Send to school</button><button class="g" onclick="closeModal()">Cancel</button></div>`);
}
async function momoPick(inp) {
  if (!inp.files[0]) return;
  try { S.mp.proof = await imgShrink(inp.files[0], 900, .7, "image/jpeg"); const i = $("#mp_i"); i.src = S.mp.proof; i.style.display = "block"; }
  catch (e) { toast("Could not read that picture"); }
}
async function momoSend() {
  const x = S.mp;
  if (!x.proof) return toast("Add the screenshot first");
  busy(true);
  try { await api("/fees/momo", "POST", { studentId: x.sid, feeId: x.fid, amount: +$("#mp_a").value, txnId: $("#mp_t").value, payerNumber: $("#mp_n").value, proof: x.proof }); closeModal(); toast("Sent ✅ The school will confirm it soon"); go("pay"); }
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

PP.history = async m => {
  const d = await api("/fees/history");
  window.H = d;
  m.innerHTML = "<h2>Recent payments</h2>" + (d.length ? d.map((p, i) => `<div class="c"><div class="g1"><b>${esc(p.studentId && p.studentId.name)}</b>
    <div class="mu">${esc(p.feeId && p.feeId.title)} · ${new Date(p.paidAt).toLocaleDateString()}</div></div>
    <div style="text-align:right"><b>${money(p.amount)}</b><br><button class="sm g" onclick="receipt(${i})">Receipt</button></div></div>`).join("") : '<p class="mu">No payments yet.</p>');
};
function receipt(i) {
  const p = H[i], sc = S.school;
  openModal(`<div class="rc"><div class="rh"><div class="lo2">${logoHTML()}</div><div><h2>${esc(sc.invoiceName || sc.name)}</h2><p>${esc(sc.address || "")} ${esc(sc.phone || "")}</p></div></div>
    <div class="rbn">PAYMENT RECEIPT</div><div style="height:10px"></div>
    <table class="rt2"><tr><td class="l">Receipt no.</td><td class="l">${esc(p.reference)}</td></tr>
    <tr><td class="l">Date</td><td class="l">${new Date(p.paidAt).toLocaleString()}</td></tr>
    <tr><td class="l">Student</td><td class="l">${esc(p.studentId && p.studentId.name)}</td></tr>
    <tr><td class="l">Paid for</td><td class="l">${esc(p.feeId && p.feeId.title)}</td></tr>
    <tr><td class="l"><b>Amount paid</b></td><td class="l"><b>${money(p.amount)}</b></td></tr>
    <tr><td class="l">Method</td><td class="l">${esc(p.method)}</td></tr></table>
    <p class="ky">Thank you. This receipt was issued by ${esc(sc.invoiceName || sc.name)}.</p></div>
    <div class="noprint"><button onclick="window.print()">🖨 Print / Save PDF</button><button class="g" onclick="closeModal()">Close</button></div>`);
}

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
