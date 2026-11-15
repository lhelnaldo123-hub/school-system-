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
  const d = await api("/fees/mine");
  m.innerHTML = `<h2>Pay fees</h2><p class="mu">Pay safely with card or mobile money (Paystack). You can pay part of a fee.</p>` + (d.length ? d.map(k => `<h3>${esc(k.student.name)} <small class="mu">${esc(k.student.className)}</small></h3>` + (k.fees.length ? k.fees.map(f => `<div class="c" style="flex-wrap:wrap"><div class="g1">
    <b>${esc(f.title)}</b> ${f.type === "exam" ? '<span class="badge">Exam fee</span>' : ""}
    <div class="mu">Due ${new Date(f.dueDate).toLocaleDateString()}</div><div class="mu">Total ${money(f.amount)} · Paid ${money(f.paid)}</div></div>`
    + (f.balance > 0 ? `<div style="min-width:150px"><input id="pa_${f.feeId}_${k.student.id}" type="number" min="1" max="${f.balance}" value="${f.balance}"><button class="y sm" onclick="payNow('${k.student.id}','${f.feeId}')">Pay now</button></div>` : '<b class="up">Paid ✓</b>') + "</div>").join("") : '<p class="mu">No fees yet.</p>')).join("")
    : '<p class="mu">No children linked yet.</p>');
};
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
