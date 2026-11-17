/* B:RIGHT 주화면 — 서비스 가이드의 업무 흐름을 화면으로 옮긴 것
   대시보드 → 근거 검토(리스트·상세) → 소명 관리(작성·수정·발송) → 소명 검토(채팅 회신·증빙 → 건별 판단 → 종결)
   현상 코멘트(반복 오지급 · 매출 대비 인센티브 · 수수료 하락) · 정책 관리(등록 · 적용 정책 확인) · 도우미(정책 변경 이력 질의)
   실데이터: bright-data.js(2월 점검 결과), bright-monthly.js(1·2월 지급 + 가상 9~12월) — 로컬 전용 */
const D = window.BD, M = window.BM;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const nf = n => Math.round(n).toLocaleString('ko-KR');
const won = n => (n > 0 ? '+' : '') + nf(n) + '원';
const man = n => { const v = n / 10000; return (Math.abs(v) >= 100 ? nf(v) : v.toFixed(Math.abs(v) < 10 ? 1 : 0).replace(/\.0$/, '')) + '만원'; };
const eok = n => (n / 1e8).toFixed(1) + '억';
const mLabel = m => `${+m.slice(5)}월`;
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { const t = new Date(d); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
const stamp = () => { const t = new Date(); return `${t.getMonth() + 1}/${t.getDate()} ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
function toast(t){ const el = $('toast'); el.textContent = t; el.className = 'show'; clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 2400); }

/* ───────── 데이터 정리 */
const KIND = c => c.res === '오지급' ? (c.dir === '덜' ? 'under' : 'over') : 'check';
const KNAME = {over:'과다지급', under:'과소지급', check:'확인 필요'};
const ini = n => (String(n || '').replace(/^\(주\)|^㈜|^주식회사\s*/, '').trim()[0] || '?');
const short = n => String(n || '').replace(/^(Agent_)?(매스에이전트|홈앤파트너)_/, '');
const CASES = D.cases.map(c => ({...c, k:KIND(c), who:short(c.agent),
  title: c.res === '오지급' ? c.cat : ((c.reasons[0]?.t || '').split(':')[0] || c.cat),
  why: c.reasons.map(r => r.t).join(' · ')}));
const BYID = Object.fromEntries(CASES.map(c => [c.id, c]));
const CNT = {total:D.counts['RUN-01'].total + D.counts['RUN-02'].total, over:0, under:0, check:0, overAmt:0, underAmt:0};
CASES.forEach(c => { CNT[c.k]++; if (c.k === 'over') CNT.overAmt += c.diff || 0; if (c.k === 'under') CNT.underAmt += c.diff || 0; });
const DOCNAME = id => D.docs[id]?.name || id;

/* ───────── 상태 (이 브라우저에만 저장) */
const KEY = 'bright-main-v4';
const S0 = () => ({view:'dash', role:'aud', f:{k:'', st:'', q:'', agent:''}, sort:['diff', -1], page:1, sel:null,
  review:{}, reqs:[], threads:{}, finals:{}, closed:false, closedAt:null, history:[],
  policy:{applied:{C1:'C1-POL-2602', C2:'C2-POL-2602'}, confirmed:false, uploads:[]}, reqSel:null, appSel:null, cmtF:'', draft:null, lt:{ap:'on', an:'on'}});
let S;
try { S = {...S0(), ...JSON.parse(localStorage.getItem(KEY) || 'null')}; } catch (e) { S = S0(); }
if (!S.reqs.length) seed();
S.view = 'dash'; S.sel = null; S.dcmt = 0; if (S.pcmp) S.pcmp.run = false;   // 어디서 나갔든 다시 들어오면 대시보드부터
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({...S, draft:null})); } catch (e) {} };

// 시연용 시작 자료: 회신까지 온 소명 1건, 작성 중 1건
function seed(){
  const a = CASES.find(c => c.k === 'over' && c.case === 'C1'), b = CASES.find(c => c.k === 'under');
  const r1 = mkReq([a.id], 'sent'); r1.sentAt = '11/12 14:20'; r1.status = 'replied';
  S.threads[r1.id] = [
    {who:'sys', t:`소명 요청서가 발송되었어요 · 회신 기한 ${r1.due}`, at:'11/12 14:20'},
    {who:'aud', t:r1.body, at:'11/12 14:20'},
    {who:'pay', t:`안녕하세요, ${a.who} 지급 담당자입니다.\n해당 건은 정책 공지 이전 유치분이라 기존 단가를 적용했습니다. 개통 확인서와 공지 메일을 첨부드립니다.`, at:'11/13 10:05', files:['개통확인서_' + a.loc.replace(/\s/g, '') + '.pdf', '정책공지메일_0201.png']},
  ];
  const r2 = mkReq([b.id], 'draft');
  S.reqs = [r1, r2];
}
function mkReq(ids, status){
  const c = BYID[ids[0]], id = 'REQ-' + String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10);
  const clause = c.reasons[0] ? `${DOCNAME(c.reasons[0].doc)} · ${c.reasons[0].anc?.row || ''}` : c.ver;
  return {id, ids:[...ids], to:c.who, toCode:c.agentCode, title:`${c.title} ${KNAME[c.k]} 건 소명 요청`,
    body:`${c.who} 지급 담당자님, 안녕하세요.\n\n2월 수수료 감사에서 아래 건이 확인되어 소명을 요청드립니다.\n\n· 대상: ${c.loc} (${c.prod})\n· 항목: ${c.title}\n· 내용: ${c.k === 'check' ? c.why : `실제 ${nf(c.actual)}원 / 정책상 ${nf(c.policy)}원 (차액 ${won(c.diff)})`}\n· 근거 조항: ${clause}\n\n지급 근거와 증빙 자료를 회신 기한까지 보내 주세요.`,
    asks:['지급 근거 설명', '개통·결합 증빙'], due:addDays(today(), 10), status, created:stamp(), sentAt:null, edited:false};
}

/* ───────── 아이콘 */
const IC = {
  dash:'<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>',
  review:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  appeal:'<path d="M4 6l8 6 8-6"/><rect x="3" y="5" width="18" height="14" rx="2.5"/>',
  answer:'<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8.5 10.5l2 2 4-4"/>',
  cmt:'<path d="M4 19V9M10 19V5M16 19v-7M21 19H3"/>',
  policy:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  start:'<path d="M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  coin:'<path d="M4.5 6.5l3 11 4.5-9 4.5 9 3-11"/><path d="M3.5 10.5h17M3.5 13.5h17"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', clip:'<path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.3 3.3 0 0 1 4.7 4.7L10.2 17.7a1.7 1.7 0 0 1-2.4-2.4L15.5 7.6"/>',
  down:'<path d="M12 4v11M7 10l5 5 5-5M4 19h16"/>', up:'<path d="M7 17L17 7M9 7h8v8"/>',
};
const svg = (k, w = 20) => `<svg viewBox="0 0 24 24" width="${w}" height="${w}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</svg>`;

/* ───────── 사이드바 */
const NAV = {
  aud:[[['dash','대시보드','dash'],['review','근거 검토','review'],['cmt','현상 코멘트','cmt'],['appeal','소명 관리','appeal'],['answer','소명 검토','answer']],
       [['policy','정책 관리','policy']]],
  pay:[[['answer','받은 소명 요청','answer']],[]],
};
const TITLE = {dash:['대시보드', '2월 판매수수료·담당예비비 지급에 대한 감사 결과입니다.'], review:['근거 검토', '오지급 후보를 한 건씩 근거와 함께 확인하고, 필요하면 소명을 요청하세요.'],
  appeal:['소명 관리', '작성한 소명 요청을 고치고 지급 담당자에게 보내요.'], answer:['소명 검토', '소명마다 회신과 증빙을 보고 판단한 뒤, 그 소명을 바로 종결해요.'],
  cmt:['현상 코멘트', '건별 판정과 별개로, 모아 봐야 보이는 흐름을 코멘트로 정리했어요.'], policy:['정책 관리', '쌓인 정책 중 이번 감사에 적용할 정책을 고르고, 두 정책을 비교해 바뀐 규칙을 확인해요.']};
function badge(id){
  if (id === 'answer') return S.reqs.filter(r => r.status === 'replied').length || '';
  if (id === 'appeal') return S.reqs.filter(r => r.status === 'draft').length || '';
  if (id === 'cmt') return COMMENTS.filter(c => c.level === '주의').length || '';
  return '';
}
function renderNav(){
  const [g1, g2] = NAV[S.role];
  const it = ([id, name, ic]) => `<a class="it ${S.view === id ? 'on' : ''}" data-go="${id}"><span class="ic">${svg(ic)}</span><span class="tx">${name}</span><span class="bd">${badge(id)}</span></a>`;
  $('nav1').innerHTML = g1.map(it).join('');
  $('nav2').innerHTML = g2.map(it).join(''); $('nav2').style.display = g2.length ? '' : 'none';
}

/* ───────── 현상 코멘트 계산 (모든 건이 아니라, 흐름이 보이는 곳에만 남긴다) */
const MONTHS = M.months, REALM = new Set(M.real);
const agentsOf = m => M.agents.filter(a => a.month === m);
const sumPay = m => agentsOf(m).reduce((s, a) => s + a.pay, 0);
const sumInet = m => agentsOf(m).reduce((s, a) => s + a.inet, 0);
const chanPay = (m, ch) => agentsOf(m).filter(a => ch === '매스에이전트' ? a.type === '매스에이전트' : a.type !== '매스에이전트').reduce((s, a) => s + a.pay, 0);
const ALLV = [...M.vcases, ...CASES.filter(c => c.case === 'C1').map(c => ({month:c.month, agent:c.who, agentCode:c.agentCode, res:c.res, dir:c.dir, cat:c.cat, diff:c.diff, v:0}))];
const COMMENTS = buildComments();
function buildComments(){
  const out = [], DOC = 'C1-POL-2602', PREV = 'C1-POL-2601', AUD = M.audited;
  const baseName = s => s.replace(/\s*\(.*\)$/, '').replace(/\s+(1G|Btv\+)$/, '').trim();
  const ruleFor = (item, doc = DOC) => D.rules.find(r => r.doc === doc && baseName(r.name) === baseName(item));
  const rulesOf = item => D.rules.filter(r => r.case === 'C1' && baseName(r.name) === baseName(item));
  const pol = r => r && {doc:r.doc, docName:D.docs[r.doc]?.name || r.doc, name:r.name, sec:r.sec, cond:r.cond, amt:r.amt, anc:r.anc};
  const eun = w => { const ch = w.trim().slice(-1), c = ch.charCodeAt(0) - 0xAC00;
    const jong = c >= 0 && c < 11172 ? c % 28 > 0 : /[A-Z]/.test(ch) ? /[LMNR]/.test(ch) : /[a-z]/.test(ch) ? !/[aeiouy]/.test(ch) : false;
    return jong ? '은' : '는'; };
  const eul = w => eun(w) === '은' ? '을' : '를', iga = w => eun(w) === '은' ? '이' : '가';
  const md = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '';
  const ym = d => d ? d.slice(0, 4) + '-' + d.slice(5, 7) : '';
  const nrm = s => s.toLowerCase().replace(/[\s↓]/g, '');
  const short = a => a.replace(/^(매스에이전트|홈앤파트너)_/, '');
  // 금액 문장을 {묶음(기가/광랜), 이름, 값} 목록으로 읽는다
  const parseAmt = t => t.split('/').map(g => { const tk = g.split('·').map(x => x.replace(/\(.*?\)/g, '').split(' + ')[0].trim());
    const head = tk[0].match(/^(기가|광랜)\s/)?.[1] || '';
    return tk.map(x => { const y = x.replace(/^(기가|광랜)\s+/, ''), v = y.match(/([\d.]+)\s*$/)?.[1]; return {head, name:y.replace(/\s*[\d.]+\s*$/, '').trim(), v}; }); });
  const valOf = (rule, head, lab) => { const gs = parseAmt(rule.amt), lab0 = (gs[0] || []).map(x => x.name);
    for (const g of gs) for (let j = 0; j < g.length; j++) if (g[j].head === head && nrm(g[j].name || lab0[j] || '') === nrm(lab)) return +g[j].v * 10000;
    return null; };
  const amtDiff = (A, B) => { const a = parseAmt(A), b = parseAmt(B), lab = (b[0] || []).map(x => x.name), o2 = [];
    b.forEach((g, gi) => g.forEach((x, j) => { if (!x.v) return; const name = x.name || lab[j] || '', o = x.name ? (a[gi] || []).find(y => y.name === x.name) : (a[gi] || [])[j];
      if (o && o.v && o.v !== x.v) o2.push({t:`${x.head ? x.head + ' ' : ''}${name} ${o.v} → ${x.v}`, name}); }));
    return o2; };
  const verNote = D.rules.find(r => r.case === 'C1' && /버전/.test(r.note || ''))?.note;
  const POLICY_T = ['version', 'boundary', 'dayband', 'gap'];

  /* 2월 오지급 건을 원인 모양별로 묶는다: 판매점 수 · 정책 버전 · 날짜 경계 · 날짜 구간 · 단가 공백 · 계산 */
  const ROWS = CASES.filter(c => c.case === 'C1' && c.res === '오지급').flatMap(c => c.items.filter(x => x.st !== 'ok' && x.p != null).map(x => ({c, x})));
  function groupsOf(cat){
    const G = {};
    ROWS.filter(r => r.x.n === cat).forEach(({c, x}) => {
      const lb = x.c.match(/(기가|광랜) × (.+?) (\d+)만원/), applied = rulesOf(cat).filter(r => r.doc === x.doc);
      let ev = null;
      if (/지급 제외/.test(x.c)) ev = {type:'excl', key:'excl|' + c.agentCode};
      else if (/없는 날짜/.test(x.c)) ev = {type:'gap', key:'gap|' + c.signup, rule:applied[0]};
      if (!ev && lb && x.a !== x.p){
        const [, head, lab] = lb, sm = ym(c.signup), om = ym(c.open);
        const other = sm !== om && rulesOf(cat).find(r => r.doc !== x.doc && r.month === om && valOf(r, head, lab) === x.a);
        if (other) ev = {type:'version', key:`version|${head}${lab}|${x.p}>${x.a}`, lab:`${head} × ${lab}`, other, sm, om, rule:applied.find(r => valOf(r, head, lab) === x.p)};
        const bnd = !ev && applied.find(r => /\(.*~.*\)/.test(r.name) && valOf(r, head, lab) === x.a && valOf(r, head, lab) !== x.p);
        if (bnd) ev = {type:'boundary', key:`boundary|${head}${lab}|${x.p}>${x.a}`, lab:`${head} × ${lab}`, other:bnd, cur:applied.find(r => r !== bnd), day:md(c.signup)};
      }
      if (!ev && /유치일/.test(x.c) && x.a !== x.p && applied[0]){
        const tk = applied[0].amt.split('·').map(s => s.trim()), hit = tk.filter(s => s.includes(`${x.a / 10000}만`)), mine = tk.find(s => s.includes(`${x.p / 10000}만`));
        if (hit.length) ev = {type:'dayband', key:`dayband|${c.signup}|${x.p}>${x.a}`, rule:applied[0], hit:hit.map(s => s.replace(/\s*\d+만.*$/, '')), mine, day:md(c.signup)};
      }
      if (!ev) ev = {type:'calc', key:`calc|${c.agentCode}|${x.p}>${x.a}`};
      const g = G[ev.key] ||= {...ev, cat, rows:[], st:new Set(), codes:new Set()};
      g.rows.push({c, x}); g.st.add(c.agent); g.codes.add(c.agentCode);
    });
    return Object.values(G).sort((a, b) => (POLICY_T.includes(b.type) && b.st.size > 1) - (POLICY_T.includes(a.type) && a.st.size > 1) || b.st.size - a.st.size || b.rows.length - a.rows.length);
  }
  const monthsOf = (code, cat) => new Set(ALLV.filter(v => v.res === '오지급' && v.agentCode === code && v.cat === cat).map(v => v.month)).size;
  // 묶음 하나 → 살펴볼 곳(사실) + 그에 맞는 확인 질문 한 쌍
  function pointOf(g){
    const n = g.rows.length, S = g.st.size, x = g.rows[0].x, c = g.rows[0].c, who = S === 1 ? short(c.agent) : `판매점 ${S}곳`;
    if (g.type === 'version') return {tag:'정책 버전 기준',
      t:`${who}의 ${n}건은 ${+g.sm.slice(5)}월에 유치하고 ${+g.om.slice(5)}월에 개통한 건이에요. '${g.lab}' 단가를 ${+g.sm.slice(5)}월 정책(${man(x.p)}) 대신 ${+g.om.slice(5)}월 정책(${man(x.a)})으로 받았어요.${verNote ? ` 규칙을 뽑을 때도 "${verNote}"라고 표시했던 부분이에요.` : ''}`,
      q:'유치월과 개통월이 다른 건에 어느 달 정책을 적용하는지 정책 담당 부서에 확인하고, 그 기준을 정책 문서에 적도록 제안하세요.'};
    if (g.type === 'boundary'){ const per = g.other.name.match(/\((.*)\)/)?.[1] || '', iho = /이후/.test(g.cur?.cond || '');
      return {tag:'날짜 경계', t:`${who}의 ${n}건은 유치일이 ${g.day}인데, '${per}' 단가(${man(x.a)})를 받았어요. 정책상으로는 '${g.cur?.cond || ''}' 단가 ${man(x.p)}이 맞아요.${iho ? ` '이후'가 그날을 포함하는지는 읽는 사람마다 다를 수 있어요.` : ''}`,
        q:`단가가 바뀌는 날(${g.day})에 유치한 건을 어느 단가로 볼지 정책 담당 부서에 확인하고, '○일부터(당일 포함)'처럼 문구를 분명히 하도록 제안하세요.`}; }
    if (g.type === 'dayband'){ const one = g.mine && !/~/.test(g.mine);
      return {tag:'날짜 구간', t:`${who}의 ${n}건은 유치일이 ${g.day}이라 정책상 ${man(x.p)}(${g.mine?.replace(/\s*\d+만.*$/, '')})인데 ${man(x.a)}을 받았어요. ${man(x.a)}은 ${g.hit.join(', ')} 단가예요.${one ? ' 이 구간은 하루짜리라 정산에서 놓치기 쉬워요.' : ''}`,
        q:`${g.day} 유치 건이 어느 구간에 속하는지 정책 담당 부서에 확인하고, 날짜 구간을 빈틈없이 적도록 제안하세요.`}; }
    if (g.type === 'gap') return {tag:'단가 공백', t:`유치일이 ${md(c.signup)}인 ${n}건(${who})은 정책에 단가가 정해지지 않은 날짜인데 ${man(x.a)}이 지급됐어요.${g.rule?.note ? ` 규칙을 뽑을 때도 "${g.rule.note}"라고 표시했어요.` : ''}`,
      q:`${g.rule?.note ? `'${g.rule.note}'` : `${md(c.signup)} 유치`} 구간에 어떤 단가를 쓸지 정책 담당 부서에 확인하세요.`};
    if (g.type === 'excl') return {tag:'정산 실수 가능성', t:`${who}의 ${n}건은 ${x.c.replace(/ → 0원$/, '').replace('조건 해당(', '조건(')}에 해당하는데 ${man(x.a)}이 지급됐어요.`,
      q:`${who}에 지급 제외 조건을 어떻게 확인하는지 소명 요청하세요.`};
    const k = monthsOf(c.agentCode, g.cat), rep = S === 1 && k >= 2;
    return {tag:S >= 3 ? '해석 차이 가능성' : '정산 실수 가능성',
      t:S === 1 ? `2월 ${n}건은 모두 ${who} 한 곳이에요. 계산 근거는 '${x.c}'인데 ${man(x.a)}이 지급됐어요.${rep ? ` 이 판매점은 점검한 ${AUD.length}개월 중 ${k}개월에 같은 항목 오지급이 있었어요.` : ''}`
        : `${who}이 같은 방식으로 ${man(x.p)} 대신 ${man(x.a)}을 받았어요(계산 근거: ${x.c}).`,
      q:S === 1 ? `${who}에 ${/번들/.test(x.c) ? '비중 계산에 쓴 번들 건수와 해당 상품 건수' : '적용한 단가와 그 근거'}를 소명 요청하세요.${rep ? ' 반복되면 정산 가이드라인 안내나 교육을 권고하세요.' : ''}`
        : '이 조항을 정산 담당자들이 어떻게 읽었는지 확인하고, 해석이 갈리면 문구를 분명히 하도록 정책 담당 부서에 제안하세요.'};
  }

  /* ① 반복 오지급 — 정책 항목 */
  const V = ALLV.filter(c => c.res === '오지급' && c.cat && !/외 \d/.test(c.cat));
  const byItem = {};
  V.forEach(c => { const r = byItem[c.cat] ||= {cat:c.cat, n:0, m:{}, st:new Set()}; r.n++; r.m[c.month] = (r.m[c.month] || 0) + 1; r.st.add(c.agentCode); });
  const run = m => { let k = 0; for (let i = AUD.length - 1; i >= 0 && m[AUD[i]]; i--) k++; return k; };
  const rank = Object.values(byItem).sort((a, b) => b.n - a.n), GROUPS = {};
  rank.filter(r => run(r.m) >= 3).slice(0, 4).map(r => { const gs = groupsOf(r.cat); GROUPS[r.cat] = gs; return {r, gs, pol:gs.some(g => POLICY_T.includes(g.type) && g.st.size > 1)}; })
    .sort((a, b) => b.pol - a.pol || b.r.n - a.r.n).forEach(({r, gs, pol:hasPol}, i) => {
      const ser = AUD.map(m => ({m, v:r.m[m] || 0})), k = run(r.m), first = ser[ser.length - k].v, last = ser.at(-1).v, nr = rank.indexOf(r) + 1;
      const others = rank.filter(x => x !== r), avgO = others.reduce((s, x) => s + x.n, 0) / Math.max(1, others.length) / AUD.length;
      const febN = gs.reduce((s, g) => s + g.rows.length, 0), febS = new Set(gs.flatMap(g => [...g.st])).size;
      const pts = gs.filter(g => POLICY_T.includes(g.type) || g.rows.length >= 2).slice(0, 3).map(pointOf);
      const top = gs.find(g => POLICY_T.includes(g.type) && g.st.size > 1), rule = top ? (top.rule || top.cur || rulesOf(r.cat).find(x => x.doc === top.rows[0].x.doc)) : ruleFor(r.cat);
      out.push({id:'P' + (i + 1), kind:'반복 오지급', level:hasPol ? '주의' : '참고', title:`'${r.cat}'에서 ${k}개월 연속 오지급이 나왔어요`,
        body:`최근 ${AUD.length}개월 동안 '${r.cat}'에서 오지급이 ${r.n}건 나왔어요. 판매점 ${r.st.size}곳에서 나왔고, 전체 오지급의 ${Math.round(r.n / V.length * 100)}%예요. ${hasPol ? `2월에는 여러 판매점이 이 정책을 같은 방식으로 잘못 계산했어요. 판매점 한 곳의 실수라기보다 정책 문구가 헷갈리게 쓰였을 수 있어서, 조항부터 확인해 볼 만해요.` : febS <= 2 ? `2월 ${febN}건은 ${febS === 1 ? '모두 판매점 한 곳' : `판매점 ${febS}곳`}에서 나왔어요. 정책 문구보다는 그 판매점의 정산 실수일 가능성이 커요.` : `2월에는 판매점마다 틀린 방식이 달라서, 판매점별로 정산을 확인해 볼 만해요.`}`,
        basis:`비교 기준: 다른 정책 항목은 한 달 평균 ${avgO.toFixed(1)}건`,
        policy:{...pol(rule), ctx:(g => g && {n:g.rows[0].x.n, c:g.rows[0].x.c, p:g.rows[0].x.p, a:g.rows[0].x.a})(top || gs[0]), row:(g => g && {cid:g.rows[0].c.id, n:g.rows[0].x.n, cnt:g.rows.length, st:g.st.size})(top || gs[0])}, points:pts, series:ser, unit:'건', bars:true, hi:ser.length - 1});
    });
  /* ① 반복 오지급 — 판매점 */
  const rep = {};
  V.forEach(c => { const r = rep[c.agentCode] ||= {name:c.agent, code:c.agentCode, m:{}, n:0, cats:{}}; r.m[c.month] = (r.m[c.month] || 0) + 1; r.n++; r.cats[c.cat] = (r.cats[c.cat] || 0) + 1; });
  const avgSt = V.length / Object.keys(rep).length / AUD.length;
  Object.values(rep).filter(r => run(r.m) >= 3).sort((a, b) => run(b.m) - run(a.m) || b.n - a.n).slice(0, 2).forEach((r, i) => {
    const k = run(r.m), cats = Object.entries(r.cats).sort((a, b) => b[1] - a[1]), ser = AUD.map(m => ({m, v:r.m[m] || 0})), pts = [];
    const shared = Object.values(GROUPS).flat().filter(g => g.codes.has(r.code) && POLICY_T.includes(g.type) && g.st.size > 1);
    shared.slice(0, 1).forEach(g => pts.push({tag:'정책 확인 먼저', t:`이 판매점의 '${g.cat}' 오지급은 다른 판매점 ${g.st.size - 1}곳과 같은 모양이에요(${pointOf(g).tag}). 판매점 실수보다 조항 문제일 수 있어요.`,
      q:`'${g.cat}' 건은 판매점 소명보다 정책 담당 부서 확인을 먼저 하세요.`}));
    if (cats.length >= 3) pts.push({tag:'정산 처리 방식', t:`오지급이 정책 항목 ${cats.length}개에 걸쳐 있어요(가장 많은 항목: '${cats[0][0]}' ${cats[0][1]}건). 특정 조항 하나보다 이 판매점의 정산 처리 방식 문제일 수 있어요.`,
      q:'이 판매점의 정산 담당자에게 정산 가이드라인 안내나 교육을 권고하세요.'});
    Object.values(GROUPS).flat().filter(g => g.codes.has(r.code) && g.st.size === 1).slice(0, 1).forEach(g => pts.push(pointOf(g)));
    if (!pts.length) pts.push({tag:'정산 실수 가능성', t:`'${cats[0][0]}'에서 ${cats[0][1]}건이 반복됐어요.`, q:`'${cats[0][0]}' 계산 방식을 이 판매점에 소명 요청하세요.`});
    out.push({id:'S' + (i + 1), kind:'반복 오지급', level:'참고', agent:r.code, title:`${r.name}에서 ${k}개월 연속 오지급이 나왔어요`,
      body:`점검한 달 중 최근 ${k}개월 내내 오지급이 있었어요. 모두 ${r.n}건으로 월평균 ${(r.n / AUD.length).toFixed(1)}건이고, 정책 항목 ${cats.length}개에 걸쳐 있어요.`,
      basis:`비교 기준: 판매점 한 곳의 월평균 오지급 ${avgSt.toFixed(1)}건`,
      policy:(() => { const own = Object.values(GROUPS).flat().filter(g => g.codes.has(r.code) && g.rows[0].x.a !== g.rows[0].x.p).sort((a, b) => b.rows.length - a.rows.length)[0], g = shared[0] || own;
        const rr = g && (g.rows.find(x => x.c.agentCode === r.code) || g.rows[0]);
        return {...pol(g ? (g.rule || g.cur || rulesOf(g.cat).find(x => x.doc === rr.x.doc) || ruleFor(g.cat)) : ruleFor(cats[0][0])), ctx:rr && {n:rr.x.n, c:rr.x.c, p:rr.x.p, a:rr.x.a}, row:rr && {cid:rr.c.id, n:rr.x.n, cnt:g.rows.length, st:g.st.size}}; })(), points:pts.slice(0, 3),
      series:ser, unit:'건', bars:true, hi:ser.length - 1});
  });

  /* ② 예상 매출 대비 인센티브 — 상품 구성별 (정책상 지급액 기준) */
  const FEE = {광랜:16500, 기가라이트:22000, 기가:27500, pop:7700, 이코노미:9900, 스탠다드:12100, All:15400}, MON = 36;
  const grp = {};
  CASES.filter(c => c.case === 'C1' && c.contract === '3년').forEach(c => {
    const m = c.prod.match(/^(광랜|기가라이트|기가) (?:\+ (pop|이코노미|스탠다드|All)|단독)$/); if (!m) return;
    const inc = c.items.reduce((s, x) => s + (x.p ?? 0), 0); if (inc <= 0) return;
    const g = grp[c.prod] ||= {prod:c.prod, net:m[1], tv:m[2] || null, rev:(FEE[m[1]] + (m[2] ? FEE[m[2]] : 0)) * MON, inc:0, n:0, parts:{}};
    g.inc += inc; g.n++; c.items.forEach(x => { if (x.p) g.parts[x.n] = (g.parts[x.n] || 0) + x.p; });
  });
  const G = Object.values(grp).filter(g => g.n >= 2).map(g => ({...g, inc:g.inc / g.n, r:g.inc / g.n / g.rev * 100})).sort((a, b) => b.r - a.r);
  const avgR = G.reduce((s, g) => s + g.r, 0) / Math.max(1, G.length);
  G.slice(0, 2).forEach((g, i) => {
    const parts = Object.entries(g.parts).map(([n, v]) => [n, v / g.n]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]), pts = [];
    const solo = Object.values(grp).find(h => h.net === g.net && !h.tv && h.n);
    let rule = ruleFor(parts[0][0]);
    if (g.tv && solo){ const so = solo.inc / solo.n, tvInc = g.inc - so, tvRev = FEE[g.tv] * MON;
      const addParts = parts.filter(([n]) => /조합|DPS|TV/.test(n)).map(([n, v]) => `${n} ${man(v)}`);
      pts.push({tag:'단가 설계', t:`${g.net} 단독(1건 ${man(so)})에 '${g.tv}'${eul(g.tv)} 더하면 인센티브가 ${man(tvInc)} 늘어나요. 늘어나는 예상 매출은 ${man(tvRev)}이라 TV 매출의 ${Math.round(tvInc / tvRev * 100)}%를 인센티브로 줘요.${addParts.length ? ` 늘어난 몫은 주로 ${addParts.join(', ')}이에요.` : ''}`,
        q:`TV를 결합할 때 더해지는 상품조합 수수료·TV 판매활성화 단가가 TV 매출에 비해 높게 잡힌 의도가 있는지 정책 담당 부서에 확인하세요.`});
      rule = ruleFor('상품조합 수수료') || rule; }
    const inv = G.find(h => h !== g && h.net === g.net && h.rev > g.rev && h.inc < g.inc);
    if (inv) pts.push({tag:'단가 순서', t:`'${g.prod}'${eun(g.prod)} '${inv.prod}'보다 요금이 낮은데 인센티브는 더 많아요(${man(g.inc)} vs ${man(inv.inc)}).`,
      q:`두 상품 구성의 단가 순서가 요금 순서와 뒤집힌 이유를 정책 담당 부서에 확인하세요.`});
    pts.push({tag:'계산 전제', t:`예상 매출은 요금표 기준 월 요금(${g.net} ${nf(FEE[g.net])}원${g.tv ? ` + ${g.tv} ${nf(FEE[g.tv])}원` : ''})에 ${MON}개월을 곱해 계산했어요. 실제 청구 요금이나 결합 할인이 다르면 비율도 달라져요.`,
      q:'실제 청구 요금(약정·결합 할인 후)으로 다시 계산해도 비율이 높게 나오는지 확인하세요.'});
    const ser = G.slice(0, 6).map(h => ({m:h.prod.replace(' + ', '+'), v:h.r}));
    out.push({id:'R' + (i + 1), kind:'매출 대비 인센티브', level:g.r >= avgR + 10 ? '주의' : '참고', title:`'${g.prod}'${eun(g.prod)} 예상 매출의 ${g.r.toFixed(0)}%가 인센티브예요`,
      body:`3년 약정 '${g.prod}' 1건에 인센티브가 평균 ${man(g.inc)} 나가요. 예상 매출 ${man(g.rev)}의 ${g.r.toFixed(0)}%로, 상품 구성 평균(${avgR.toFixed(0)}%)보다 ${(g.r - avgR).toFixed(0)}%p ${g.r >= avgR ? '높아요' : '낮아요'}.`,
      basis:`비교 기준: 상품 구성 ${G.length}개 평균 ${avgR.toFixed(0)}% · 예상 매출 = (인터넷 + TV 월 요금) × ${MON}개월`,
      split:parts.slice(0, 4), splitTitle:'인센티브 구성 (1건 평균)',
      policy:{...pol(rule), ctx:{n:rule?.name, c:`${g.net} × ${g.tv || '초 단독'}`}}, points:pts.slice(0, 3), series:ser, unit:'%', bars:true, hi:ser.findIndex(s => s.m === g.prod.replace(' + ', '+'))});
  });

  /* ③ 지속적인 수수료 하락 — 실적 감소 영향 / 건당 수수료 변화 영향. 정책 문서가 있는 1→2월만 정책 변경과 잇는다 */
  const dd = diffDocs(PREV, DOC).chg, pc = dd.find(([p]) => p.name === '상품수수료');
  const down = [pc, ...dd.filter(c => c !== pc && /부가/.test(c[1].name))].filter(Boolean).flatMap(([a, b]) => amtDiff(a.amt, b.amt).filter(d => { const m = d.t.match(/([\d.]+) → ([\d.]+)$/); return m && +m[2] < +m[1]; }));
  const codes = [...new Set(M.agents.map(a => a.code))], seqOf = code => MONTHS.map(m => M.agents.find(a => a.code === code && a.month === m));
  const unit = a => a.pay / (a.inet + a.tv), vol = a => a.inet + a.tv, pct = (a, b) => (b / a - 1) * 100;
  const peer = type => { const L = codes.map(seqOf).filter(s => s.every(Boolean) && s[0].type === type), j = L.map(s => s.at(-2)), f = L.map(s => s.at(-1));
    return {u:j.reduce((s, a, i) => s + pct(unit(a), unit(f[i])), 0) / Math.max(1, L.length), v:j.reduce((s, a, i) => s + pct(vol(a), vol(f[i])), 0) / Math.max(1, L.length)}; };
  const drops = [];
  codes.forEach(code => { const s = seqOf(code); if (s.some(x => !x)) return;
    let k = 0; for (let i = s.length - 1; i > 0 && s[i].pay < s[i - 1].pay; i--) k++;
    if (k < 2) return;
    const a = s[s.length - 1 - k], b = s.at(-1);
    drops.push({s, k, a, b, d:b.pay - a.pay, vol:(vol(b) - vol(a)) * unit(a), unit:(unit(b) - unit(a)) * vol(b)}); });
  drops.sort((x, y) => x.d - y.d).slice(0, 3).forEach((x, i) => {
    const seq = x.s.slice(-(x.k + 1)), j = x.s.at(-2), f = x.b, pr = peer(f.type), uP = pct(unit(j), unit(f)), vP = pct(vol(j), vol(f)), volMain = Math.abs(x.vol) >= Math.abs(x.unit), pts = [];
    const du = uP - pr.u, dv = vP - pr.v;
    if (uP < 0 && down.length) pts.push({tag:'정책 변경', t:`1→2월 건당 수수료가 ${man(unit(j))} → ${man(unit(f))}(${uP.toFixed(0)}%)로 내려갔어요. 같은 시기 2월 정책에서 ${down.slice(0, 3).map(d => d.t).join(', ')}(만원)으로 내려갔어요.`,
      q:`이 판매점의 2월 판매 중 단가가 내려간 상품(${[...new Set(down.map(d => d.name))].slice(0, 3).join('·')}) 비중을 확인해, 정책 변경이 줄인 몫이 얼마인지 따져 보세요.`});
    if (uP >= 0) pts.push({tag:'감소 시점', t:`1→2월 건당 수수료는 오히려 ${man(unit(j))} → ${man(unit(f))}(+${uP.toFixed(0)}%)로 올랐어요. 감소의 대부분은 2월 정책 변경 전인 ${mLabel(seq[0].month)} → ${mLabel(j.month)} 구간에서 생겼어요.`,
      q:`${mLabel(seq[0].month)}에 지급액이 컸던 이유(일시 지급·정산 몰림 등)를 지급 내역에서 먼저 확인하세요.`});
    else if (Math.abs(du) <= 7) pts.push({tag:'같은 유형과 비교', t:`1→2월 건당 수수료 변화(${uP.toFixed(0)}%)가 같은 유형(${f.type}) 평균(${pr.u.toFixed(0)}%)과 비슷해요. 정책 변경이 판매점 전반에 비슷하게 작동한 것으로 보여요.`,
      q:'2월 정책 변경이 의도한 만큼만 수수료를 줄였는지 정책 담당 부서에 확인하세요.'});
    else pts.push(du < 0 ? {tag:'같은 유형과 비교', t:`1→2월 건당 수수료가 ${uP.toFixed(0)}% 바뀌어, 같은 유형(${f.type}) 평균(${pr.u.toFixed(0)}%)보다 더 내려갔어요. 정책 변경만으로는 설명이 다 되지 않아요.`,
        q:'상품 구성이 바뀌었는지, 환수·차감이 늘었는지 지급 항목별로 확인하세요.'}
      : {tag:'같은 유형과 비교', t:`1→2월 건당 수수료 변화(${uP.toFixed(0)}%)가 같은 유형(${f.type}) 평균(${pr.u.toFixed(0)}%)보다 덜 내려갔어요. 이 판매점은 정책 변경 영향을 덜 받은 편이에요.`,
        q:'건당 수수료보다 실적 감소가 하락의 주된 이유인지 함께 보세요.'});
    const vt = `1→2월 실적은 ${vol(j)}건 → ${vol(f)}건(${vP.toFixed(0)}%)으로`;
    pts.push(dv < -10 ? {tag:'실적', t:`${vt}, 같은 유형 평균(${pr.v.toFixed(0)}%)보다 더 줄었어요.`, q:'이 판매점만의 사정(인력·영업 중단 등)이 있었는지 소명으로 확인하세요.'}
      : dv > 10 ? {tag:'실적', t:`${vt}, 같은 유형 평균(${pr.v.toFixed(0)}%)보다 덜 줄었어요. 실적만 보면 다른 판매점보다 선방한 편이에요.`, q:'실적 감소가 판매점 전반의 흐름이라면, 현재 정책이 판매를 이끄는 효과가 있는지 정책 담당 부서에 검토를 제안하세요.'}
      : {tag:'실적', t:`${vt}, 같은 유형 평균(${pr.v.toFixed(0)}%)과 비슷하게 줄었어요.`, q:'실적이 판매점 전반에서 줄었다면, 현재 정책이 판매를 이끄는 효과가 있는지 정책 담당 부서에 검토를 제안하세요.'});
    out.push({id:'D' + (i + 1), kind:'수수료 하락', level:volMain ? '참고' : '주의', agent:f.code, title:`${f.name} 수수료가 ${x.k + 1}개월 연속 줄었어요`,
      body:`${seq.map(s => `${mLabel(s.month)} ${man(s.pay)}`).join(' → ')}으로 줄었어요. 감소분 ${man(-x.d)} 중 실적 감소 영향이 ${man(-x.vol)}, 건당 수수료 변화 영향이 ${man(-x.unit)}이에요.`,
      basis:`비교 기준: 이 판매점 ${Math.round(x.d / x.a.pay * 100)}% · 같은 기간 같은 유형(${f.type}) 평균 ${(() => { const L = codes.map(seqOf).filter(s => s.every(Boolean) && s[0].type === f.type); return (L.reduce((s, q) => s + pct(q[q.length - 1 - x.k].pay, q.at(-1).pay), 0) / Math.max(1, L.length)).toFixed(0); })()}%${x.k >= 2 ? ' · 정책 변경과의 비교는 정책 문서가 있는 1→2월만 해요' : ''}`,
      split:[['실적 감소 영향', -x.vol], ['건당 수수료 변화 영향', -x.unit]], splitTitle:`감소분 나누기 (${mLabel(seq[0].month)} → ${mLabel(f.month)})`,
      policy:pc && uP < 0 ? {...pol(pc[1]), diff:amtDiff(pc[0].amt, pc[1].amt).map(d => d.t), ctx:{n:'상품수수료', c:down.map(d => d.t.replace(/\s*[\d.]+ → [\d.]+$/, '')).join(' '), diff:`1월 원문과 비교하면 ${down.map(d => d.t).join(', ')}(만원)으로 내려갔어요. 아래 2월 원문 표에서 바뀐 칸을 표시했어요.`, diffLabel:'1월 원문과 달라진 점', tagLabel:'바뀜'}} : null, points:pts, series:x.s.map(s => ({m:s.month, v:s.pay})), unit:'만원', hi:x.s.length - 1});
  });
  return out;
}

/* ───────── 차트 (SVG) */
function spark(ser, {w = 300, h = 70, color = '#2F6BFF'} = {}){
  const vs = ser.map(s => s.v), mx = Math.max(...vs) || 1, mn = Math.min(0, ...vs);
  const x = i => 8 + i * (w - 16) / Math.max(1, ser.length - 1), y = v => h - 16 - (v - mn) / (mx - mn || 1) * (h - 28);
  const pts = ser.map((s, i) => `${x(i)},${y(s.v)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:100%">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    ${ser.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.v)}" r="4" fill="${color}" stroke="${color}" stroke-width="2"><title>${esc(s.m)}</title></circle>`).join('')}
    ${ser.map((s, i) => `<text x="${x(i)}" y="${h - 2}" font-size="9.5" fill="#98A0B3" text-anchor="middle">${/^\d{4}-/.test(s.m) ? mLabel(s.m) : ''}</text>`).join('')}
  </svg>`;
}
function bars(ser, {w = 520, h = 200, color = '#2F6BFF', fmt = v => v, hi = -1} = {}){
  const T = 24, B = 26, L = 6, R = 6, mx = Math.max(...ser.map(s => s.v)) || 1, bw = (w - L - R) / ser.length, barW = Math.min(46, bw * .5);
  const y0 = h - B, H = h - T - B;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    ${[.5, 1].map(t => `<line x1="${L}" x2="${w - R}" y1="${y0 - H * t}" y2="${y0 - H * t}" stroke="#EEF1F7" stroke-dasharray="3 4"/>`).join('')}
    <line x1="${L}" x2="${w - R}" y1="${y0}" y2="${y0}" stroke="#E3E8F2"/>
    ${ser.map((s, i) => { const bh = Math.max(2, s.v / mx * H), cx = L + bw * i + bw / 2, on = i === hi || hi < 0;
      return `<rect x="${cx - barW / 2}" y="${y0 - bh}" width="${barW}" height="${bh}" rx="7" fill="${color}" opacity="${on ? 1 : .32}"><title>${esc(s.m)} ${fmt(s.v)}</title></rect>
        <text x="${cx}" y="${y0 - bh - 7}" font-size="11.5" font-weight="${on ? 800 : 600}" fill="${on ? '#14192B' : '#98A0B3'}" text-anchor="middle">${fmt(s.v)}</text>
        <text x="${cx}" y="${h - 8}" font-size="11.5" fill="${on ? '#14192B' : '#98A0B3'}" font-weight="${on ? 700 : 500}" text-anchor="middle">${/^\d{4}-/.test(s.m) ? mLabel(s.m) : esc(s.m.length > 12 ? s.m.slice(0, 11) + '…' : s.m)}</text>`; }).join('')}
  </svg>`;
}
function lines(series, {w = 520, h = 200, fmt = v => v, hi = -1} = {}){
  const all = series.flatMap(s => s.data.map(d => d.v)), mx = Math.max(...all), mn = Math.min(...all), pad = (mx - mn) * .25 || mx * .1 || 1;
  const T = series.length > 1 ? 30 : 18, B = 26, L = 42, R = 16, n = series[0].data.length;
  const x = i => L + i * (w - L - R) / (n - 1), y = v => h - B - (v - (mn - pad)) / ((mx + pad) - (mn - pad)) * (h - T - B);
  const id = 'ln' + Math.random().toString(36).slice(2, 7);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>${series.map((s, k) => `<linearGradient id="${id}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".18"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`).join('')}</defs>
    ${[0, .5, 1].map(t => { const v = (mn - pad) + ((mx + pad) - (mn - pad)) * t; return `<line x1="${L}" x2="${w - R}" y1="${y(v)}" y2="${y(v)}" stroke="#EEF1F7" stroke-dasharray="3 4"/><text x="${L - 8}" y="${y(v) + 4}" font-size="10.5" fill="#98A0B3" text-anchor="end">${fmt(v)}</text>`; }).join('')}
    ${series.map((s, k) => `<path d="M${x(0)},${h - B} ${s.data.map((d, i) => `L${x(i)},${y(d.v)}`).join(' ')} L${x(n - 1)},${h - B}Z" fill="url(#${id}${k})"/>
      <polyline points="${s.data.map((d, i) => `${x(i)},${y(d.v)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
      ${s.data.map((d, i) => `<circle cx="${x(i)}" cy="${y(d.v)}" r="${i === hi ? 5.5 : 3.5}" fill="${i === hi ? s.color : '#fff'}" stroke="${s.color}" stroke-width="2"><title>${s.name} ${mLabel(d.m)} ${fmt(d.v)}</title></circle>`).join('')}
      ${hi >= 0 ? `<text x="${x(hi)}" y="${y(s.data[hi].v) - 11}" font-size="11.5" font-weight="800" fill="#14192B" text-anchor="middle">${fmt(s.data[hi].v)}</text>` : ''}`).join('')}
    ${series[0].data.map((d, i) => `<text x="${x(i)}" y="${h - 8}" font-size="11.5" fill="${i === hi ? '#14192B' : '#98A0B3'}" font-weight="${i === hi ? 700 : 500}" text-anchor="middle">${mLabel(d.m)}</text>`).join('')}
    ${series.length > 1 ? series.map((s, i) => `<g transform="translate(${L + i * 104},4)"><rect width="12" height="4" y="5" rx="2" fill="${s.color}"/><text x="18" y="11" font-size="11.5" fill="#5A6178">${s.name}</text></g>`).join('') : ''}
  </svg>`;
}
/* ───────── 화면: 대시보드 */
function stepState(){
  const rv = Object.values(S.review).filter(v => v.ck).length;
  const sent = S.reqs.filter(r => r.status !== 'draft'), replied = S.reqs.filter(r => ['replied', 'done'].includes(r.status));
  const targets = sent.flatMap(r => r.ids), decided = targets.filter(id => S.finals[id]).length;
  const st = [
    {n:'정책 파일 등록', who:'감사인', done:true, s:`${Object.keys(D.docs).length}개 정책 등록`},
    {n:'적용 정책 확인', who:'감사인', done:S.policy.confirmed, s:S.policy.confirmed ? '확인 완료' : '확인 필요', go:'policy'},
    {n:'오지급 검증', who:'Agent', done:true, s:`후보 ${CASES.length}건 · 코멘트 ${COMMENTS.length}개`, go:'cmt'},
    {n:'건별 근거 검토', who:'감사인', done:rv >= CASES.length, s:`${rv} / ${CASES.length}건 확인`, p:rv / CASES.length, go:'review'},
    {n:'소명 요청 발송', who:'감사인', done:sent.length > 0 && !S.reqs.some(r => r.status === 'draft'), s:`발송 ${sent.length} · 작성 중 ${S.reqs.length - sent.length}`, go:'appeal'},
    {n:'회신 · 증빙 제출', who:'지급 담당자', done:sent.length > 0 && replied.length === sent.length, s:`회신 ${replied.length} / ${sent.length}건`, go:'answer'},
    {n:'건별 최종 판단', who:'감사인', done:targets.length > 0 && decided === targets.length, s:`판단 ${decided} / ${targets.length}건`, p:targets.length ? decided / targets.length : 0, go:'answer'},
    {n:'종결', who:'-', done:S.closed, s:S.closed ? `${S.closedAt} 종결` : '진행 중', go:'answer'},
  ];
  const now = st.findIndex(x => !x.done); if (now >= 0) st[now].now = true;
  return st;
}
const CFMT = {억:v => eok(v), '%':v => v.toFixed(0) + '%', 건:v => nf(v) + '건', 만원:v => man(v)};
// 대시보드에 올리는 현상 3가지: 반복 오지급 · 매출 대비 인센티브 · 수수료 하락
const KINDS3 = ['반복 오지급', '매출 대비 인센티브', '수수료 하락'];
const ofKind = k => COMMENTS.filter(c => c.kind === k);
const curOf = k => { const L = ofKind(k); return L[((S.dcI || {})[k] || 0) % L.length]; };
const dashCmts = () => KINDS3.map(curOf).filter(Boolean);
function chartFor(c, w, h){
  const fmt = CFMT[c.unit] || (v => v);
  if (c.bars) return bars(c.series, {w, h, fmt, hi:c.hi, color:'#5B86FF'});
  return lines([{name:c.title, color:'#F7787E', data:c.series}], {w, h, fmt, hi:c.hi});
}
const chartNote = () => '';
function crowHTML(k, i){
  const L = ofKind(k), c = curOf(k), n = ((S.dcI || {})[k] || 0) % L.length;
  return `<button class="crow ${i === (S.dcmt || 0) ? 'on' : ''}" data-dc="${i}"><span class="kd">${k}${L.length > 1 ? `<em>${n + 1} / ${L.length}</em>` : ''}</span><b class="rt">${esc(c.title)}</b></button>`;
}
const chartCard = c => `<div class="cc-h"><span class="tag t-blue">${c.kind}</span><h4>${esc(c.title)}</h4><button class="more" data-cc="1">자세히 보기 ›</button></div>
  <div class="cc-b" data-chart="${c.id}"></div>`;
// 10초마다 같은 종류의 다음 코멘트로 넘어간다 (마우스를 올린 줄은 멈춤)
let _hoverRow = -1;
setInterval(() => {
  if (S.view !== 'dash' || document.hidden) return;
  KINDS3.forEach((k, i) => {
    const L = ofKind(k); if (L.length < 2 || _hoverRow === i) return;
    S.dcI = S.dcI || {}; S.dcI[k] = ((S.dcI[k] || 0) + 1) % L.length;
    const row = document.querySelector(`.crow[data-dc="${i}"]`); if (!row) return;
    row.classList.add('swap');
    setTimeout(() => { row.outerHTML = crowHTML(k, i); const nr = document.querySelector(`.crow[data-dc="${i}"]`); nr && nr.classList.add('swapin'); bindRows(); }, 220);
    if (i === (S.dcmt || 0)){ const cc = $('cchart'); if (cc){ cc.classList.add('swap'); setTimeout(() => { cc.innerHTML = chartCard(curOf(k)); drawCharts(); cc.classList.remove('swap'); }, 220); } }
  });
}, 10000);
function bindRows(){ document.querySelectorAll('.crow').forEach(r => {
  r.onmouseenter = () => { _hoverRow = +r.dataset.dc; };
  r.onmouseleave = () => _hoverRow = -1; }); }
// 위반목록 도넛: 과다 · 과소 · 확인 필요 비율 (원래 원(버블) 그래프는 _backup/원그래프-버블-20261116 에 보관)
function donut(){
  const K = ['over', 'under', 'check'], tot = K.reduce((s, k) => s + CNT[k], 0) || 1, R = 78, C = 2 * Math.PI * R, GAP = 3;
  const col = {over:'#F4515A', under:'#8E1B33', check:'#FFD23F'};
  let off = 0;
  const arcs = K.map(k => { const len = CNT[k] / tot * C, d = `<circle class="arc" cx="100" cy="100" r="${R}" stroke="${col[k]}" stroke-dasharray="${Math.max(0, len - GAP)} ${C}" stroke-dashoffset="${-off}" data-go="review" data-k="${k}" data-tip="${KNAME[k]} ${CNT[k]}건 · ${Math.round(CNT[k] / tot * 100)}% · 눌러서 목록 보기"/>`; off += len; return d; }).join('');
  return `<div class="donut"><svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="${R}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="34"/><g transform="rotate(-90 100 100)">${arcs}</g></svg>
    <div class="dc"><b>${nf(tot)}</b><small>건</small><span>오지급 · 확인 필요</span></div></div>`;
}
function viewDash(){
  const rv = Object.values(S.review).filter(v => v.ck).length;
  const sent = S.reqs.filter(r => r.status !== 'draft').length, replied = S.reqs.filter(r => ['replied', 'done'].includes(r.status)).length;
  const ok = CNT.total - CASES.length, dc = dashCmts(), sel = dc[S.dcmt] || dc[0];
  return `<div class="board">
    <div class="row1">
      <div class="kpis">
        <div class="kpi" data-go="review" data-k=""><span class="ki">${svg('review', 19)}</span>
          <span class="kl">점검 대상</span><span class="kv">${nf(CNT.total)}<small>건</small></span><span class="ks">정상 ${nf(ok)}건 · ${(ok / CNT.total * 100).toFixed(1)}%</span></div>
        <div class="kpi" data-go="review" data-k="over"><span class="ki">${svg('coin', 19)}</span>
          <span class="kl">오지급 금액</span><span class="kv">${man(CNT.overAmt + Math.abs(CNT.underAmt))}</span><span class="ks">과다 ${man(CNT.overAmt)} · 과소 ${man(Math.abs(CNT.underAmt))}</span></div>
        <div class="kpi" data-go="appeal"><span class="ki">${svg('appeal', 19)}</span>
          <span class="kl">소명 요청</span><span class="kv">${S.reqs.length}<small>건</small></span><span class="ks">발송 ${sent}건 · 작성 중 ${S.reqs.length - sent}건</span></div>
        <div class="kpi" data-go="appeal"><span class="ki">${svg('check', 19)}</span>
          <span class="kl">소명 종결</span><span class="kv">${S.reqs.filter(x => x.status === 'done').length}<small>/ ${S.reqs.length}건</small></span><span class="ks">회신 ${replied}건 · 진행 중 ${S.reqs.filter(x => x.status !== 'done').length}건</span></div>
      </div>
      <article class="res" id="res">
        <h2>위반목록</h2>
        <a class="go" data-go="review" aria-label="목록 보기">${svg('up')}</a>
        <div class="lgd">${['over', 'under', 'check'].map(k => `<a data-go="review" data-k="${k}"><i style="background:${{over:'linear-gradient(90deg,#FF8A80,#F4515A)', under:'#8E1B33', check:'linear-gradient(90deg,#FFE066,#FFD23F)'}[k]}"></i>${KNAME[k]} <b>${CNT[k]}</b></a>`).join('')}</div>
        ${['over', 'under', 'check'].map(k => { const d = k === 'check' ? 32 : Math.max(12, 32 * Math.sqrt(CNT[k] / CNT.check));
          return `<a class="bub ${k}" data-go="review" data-k="${k}" data-tip="${KNAME[k]} ${CNT[k]}건 · 눌러서 목록 보기" style="--d:${d}"><span class="v"><b>${CNT[k]}</b><small>건</small></span></a>`; }).join('')}
        <div class="tip" id="tip"></div>
      </article>
    </div>
    <div class="row2">
      <div class="card cbox"><div class="cbox-h"><h4>현상 코멘트</h4><span class="x" data-go="cmt">전체 ${COMMENTS.length}개 보기 ›</span></div>
        <div class="crows">${KINDS3.map((k, i) => crowHTML(k, i)).join('')}</div></div>
      <div class="card cchart" id="cchart">${chartCard(curOf(KINDS3[S.dcmt || 0]))}</div>
    </div>
  </div>`;
}
/* ───────── 화면: 근거 검토 (리스트 + 상세) */
function rows(){
  const f = S.f, q = f.q.trim().toLowerCase();
  let r = CASES.filter(c => (!f.k || c.k === f.k) && (!f.agent || c.agentCode === f.agent)
    && (!q || [c.who, c.branch, c.title, c.loc, c.why].join(' ').toLowerCase().includes(q)));
  const [key, dir] = S.sort, val = c => ({diff:Math.abs(c.diff || 0), who:c.who, loc:+(c.loc.match(/\d+/)?.[0] || 0), k:c.k, title:c.title}[key]);
  return r.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * dir);
}
const judgeOf = c => S.review[c.id]?.j || (c.k === 'check' ? 'check' : 'over');
const JNAME = {over:'오지급', ok:'정상', check:'확인 필요'};
function viewReview(){
  const r = rows(), list = r, sel = S.sel && BYID[S.sel];
  const cnt = k => CASES.filter(c => !k || c.k === k).length;
  const th = (k, t) => `<th data-sort="${k}" class="${S.sort[0] === k ? 'on' : ''}">${t}<span class="ar">${S.sort[0] === k ? (S.sort[1] > 0 ? '↑' : '↓') : '↕'}</span></th>`;
  const agentName = S.f.agent && CASES.find(c => c.agentCode === S.f.agent)?.who;
  return `<div class="tools">
      <div class="seg">${[['', '전체'], ['over', '과다지급'], ['under', '과소지급'], ['check', '확인 필요']].map(([k, t]) => `<button data-fk="${k}" class="${S.f.k === k ? 'on' : ''}">${t}<small>${cnt(k)}</small></button>`).join('')}</div>
      ${agentName ? `<span class="chip">${esc(agentName)}<button data-act="clrAgent">×</button></span>` : ''}
      <span class="sp"></span>
      <input class="inp" id="rq" placeholder="판매점 · 항목 · 행 번호 검색" value="${esc(S.f.q)}" style="width:240px">
      <button class="btn" data-act="excel">${svg('down', 16)}Excel 다운로드</button>
    </div>
    <div class="rv ${sel ? '' : 'nodet'}">
      <div class="card" style="overflow:hidden">
        <div class="tblwrap"><table class="tbl"><thead><tr>${th('k', '구분')}${th('who', '판매점')}${th('title', '항목 · 사유')}${th('diff', '차액')}${th('loc', '원장 위치').replace('<th ', '<th class="cx" ')}<th class="cx">판단</th></tr></thead>
        <tbody>${list.map(c => `<tr class="row ${S.sel === c.id ? 'sel' : ''}" data-sel="${c.id}">
          <td><span class="tag t-${c.k}">${KNAME[c.k]}</span></td>
          <td><div class="nm"><b>${esc(c.who)}</b></div><div class="sm nm">${esc(c.hq)} · ${esc(c.branch)}</div></td>
          <td><div class="nm">${esc(c.title)}</div><div class="sm nm">${esc(c.k === 'check' ? c.cat : c.why)}</div></td>
          <td style="white-space:nowrap" class="money ${c.diff > 0 ? 'plus' : c.diff < 0 ? 'minus' : ''}">${c.diff ? won(c.diff) : '<span class="sm">판정 보류</span>'}</td>
          <td class="sm cx">${esc(c.loc)}</td>
          <td class="cx"><span class="tag t-${{over:'over', ok:'ok', check:'check'}[judgeOf(c)]}">${JNAME[judgeOf(c)]}</span></td></tr>`).join('') || `<tr><td colspan="6" class="empty">조건에 맞는 건이 없어요</td></tr>`}</tbody></table></div>
        <div class="pager"><span>${r.length}건 · 아래로 내려 모두 볼 수 있어요</span><span>소명 요청한 건 ${r.filter(c => S.reqs.some(q => q.ids.includes(c.id))).length}건</span></div>
      </div>
      ${sel ? detail(sel) : ''}
    </div>`;
}
function policyText(doc, anc){
  const b = D.docs[doc]?.blocks.find(x => x.i === anc?.i);
  if (!b) return '<span class="sm">원문 위치를 찾지 못했어요</span>';
  if (b.k === 'p') return `<mark>${esc(b.t)}</mark>`;
  const cell = x => typeof x === 'string' ? esc(x) : x.t ? `<table>${x.t.map(r => `<tr>${r.map(c => `<td>${esc(c.join(' '))}</td>`).join('')}</tr>`).join('')}</table>` : '';
  const row = b.rows.find(r => r[0].join(' / ') === anc.row) || b.rows[0];
  return `<span class="lab">${esc(row[0].join(' '))}</span>${row[1].map(x => typeof x === 'string' ? `<div><mark>${cell(x)}</mark></div>` : cell(x)).join('')}`;
}
function detail(c){
  const j = judgeOf(c), req = S.reqs.find(r => r.ids.includes(c.id));
  return `<aside class="card det">
    <div class="det-h"><div><span class="tag t-${c.k}">${KNAME[c.k]}</span><h3>${esc(c.title)}</h3><div class="sm" style="color:var(--ink-3);font-size:12.5px">${esc(c.who)} · ${esc(c.loc)}</div></div>
      <button class="x" data-act="closeDet" aria-label="닫기">×</button></div>
    ${evidence(c)}
    <div class="acts">
      <div class="judge">${[['over', '오지급'], ['ok', '정상'], ['check', '확인 필요']].map(([k, t]) => `<button class="j-${k} ${j === k ? 'on' : ''}" data-j="${k}">${t}</button>`).join('')}</div>
      <span style="flex:1"></span>
      ${req ? `<button class="btn" data-act="openReq" data-id="${req.id}">소명 ${{draft:'작성 중', sent:'발송됨', replied:'회신 도착', done:'종결'}[req.status]} ›</button>` : `<button class="btn blue" data-act="newReq" data-id="${c.id}">${svg('appeal', 16)}소명 요청 작성</button>`}
    </div>
  </aside>`;
}
/* 근거 정책 조항: 원문에서 이 건과 관련된 부분만 골라, 적용된 칸을 표시해 보여준다
   ctx = {n: 지급 항목, c: 계산 근거 문장, p: 정책상 금액, a: 실제 지급액} */
const CL_WORDS = ['기가라이트', '기가', '광랜', 'giga', '1g', 'btv+', 'all', '스탠다드', '이코노미', 'pop', '초단독', 'dps_tv', 'wings', 'oss', 'wifi7', '안심'];
const clN = s => String(s ?? '').toLowerCase().replace(/[\s↓]/g, '');
const clV = s => clN(s).replace(/\(.*?\)/g, '').replace(/만원|만|원/g, '').replace(/−/g, '-');
function clTokens(ctx){
  const t = clN(`${ctx.c || ''} ${ctx.n || ''}`), tk = CL_WORDS.filter(w => t.includes(w));
  const dm = (ctx.c || '').match(/유치일\s*(\d{4})?(\d{2})[\/.]?(\d{2})/);
  return {words:tk.filter(w => !(w === '기가' && tk.includes('기가라이트') && !t.includes('기가×'))), date:dm ? `${+dm[2]}월${+dm[3]}일` : null,
    vals:ctx.p != null ? [String(ctx.p / 10000), '+' + ctx.p / 10000] : [], amts:[...new Set([...(ctx.c || '').matchAll(/(\d+(?:\.\d+)?)만원/g)].map(m => m[1] + '만원'))]};
}
function clRule(doc, anc, n){
  const L = D.rules.filter(r => r.doc === doc && (anc?.pm ? r.anc?.pm === anc.pm : r.anc?.i === anc?.i && r.anc?.row === anc?.row));
  return L.find(r => n && clN(r.name).startsWith(clN(n).replace(/\(.*$/, '').slice(0, 4))) || L[0];
}
/* 원문 맥락: 정책 머리표(정책명·주관·대상·지급방법), 같은 정책의 다른 조항, 문서의 다른 곳에 나온 관련 원문 */
const flat = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(flat).join(' ') : x && x.t ? x.t.map(r => r.map(flat).filter(Boolean).join(' · ')).join(' / ') : '';
function polHead(doc, i){
  const B = D.docs[doc]?.blocks || [], k = B.findIndex(b => b.i === i);
  for (let j = k - 1; j >= Math.max(0, k - 4); j--){ const b = B[j];
    if (b.k === 'tbl' && b.rows[0]?.[0]?.join('') === '정책명' && JSON.stringify(b.rows).includes('정책주관부서')){
      const lab = (b.rows[2] || []).map(c => c.join('')), on = (b.rows[3] || []).map(c => c.join('').includes('○'));
      const pick = (a, z) => lab.slice(a, z).filter((_, j) => on[a + j]).join('·');
      return {name:b.rows[0][1].join(' '), dept:lab.length === 12 ? pick(0, 3) : '', ch:lab.length === 12 ? pick(3, 9) : '', pay:lab.length === 12 ? pick(9, 12) : ''}; } }
  return null;
}
const CL_STOP = new Set(['수수료', '정책', '지급', '건당', '상품', '판매', '비중', '활성화', '인센티브', '기준', '정산', '본사', '본부', '지역', '추가', '기본']);
function clWords(ctx){
  const w = String(ctx.n || '').split(/[\s()·,/]+/).filter(x => x.length >= 2 && !CL_STOP.has(x));
  if (/퀄리티/.test(ctx.n || '')) w.push('Qualit');
  return [...new Set(w)];
}
let ctx_n_holder = {};
function related(doc, skipI, words, max = 3, ctx = {}){
  ctx_n_holder = ctx;
  if (!words.length) return [];
  const B = D.docs[doc]?.blocks || [], out = [], rx = new RegExp(words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
  B.forEach((b, k) => {
    if (b.i === skipI || out.length >= max * 3) return;
    if (b.k === 'p'){ if (rx.test(b.t) && b.t.length > 8) out.push({where:polHead(doc, b.i)?.name || '', label:'', text:b.t, score:words.filter(w => new RegExp(w.replace(/[+]/g, '\\+'), 'i').test(b.t)).length}); return; }
    if (JSON.stringify(b.rows).includes('정책주관부서') || /목\s*차/.test(flat(b.rows[0]))) return;
    const name = b.rows[0]?.[0]?.join('') === '정책명' ? b.rows[0][1].join(' ') : '';
    b.rows.forEach(r => { const t = flat(r.slice(1)), lab = r[0].join(' ');
      if (t.length > 6 && rx.test(lab + ' ' + t)) out.push({where:name || polHead(doc, b.i)?.name || '', label:lab, text:t, score:words.filter(w => new RegExp(w.replace(/[+]/g, '\\+'), 'i').test(lab + ' ' + t)).length}); });
  });
  const weak = String(ctx_n_holder.n || '').split(/[\s()·,/]+/).filter(x => CL_STOP.has(x));
  out.forEach(x => { x.score += weak.filter(w => x.text.includes(w) || x.label.includes(w)).length * .5 + (weak.includes('비중') && /%/.test(x.text) ? .5 : 0); });
  const seen = new Set();
  return out.sort((a, b) => b.score - a.score).filter(x => { const k = x.text.slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, max);
}
const markW = (t, words) => words.length ? esc(t).replace(new RegExp(`(${words.map(w => esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi'), '<mark>$1</mark>') : esc(t);
let CL_LAST = {hits:[], vals:[], alts:[]};
function clause(doc, anc, ctx = {}){
  const docName = DOCNAME(doc), rule = clRule(doc, anc, ctx.n), T = clTokens(ctx);
  const head = (title, path) => `<div class="cl-h"><span class="cl-doc">${svg('policy', 13)}${esc(docName)}</span>${path ? `<span class="cl-path">${esc(path)}</span>` : ''}</div><div class="cl-t">${esc(title)}</div>`;
  const memo = rule?.note ? `<div class="cl-memo"><b>해석 메모</b>${esc(rule.note)}</div>` : '';
  const pay = ctx.p != null && ctx.a != null && ctx.p !== ctx.a ? `<span class="cl-pay">정책상 ${nf(ctx.p)}원 · 실제 ${nf(ctx.a)}원</span>` : '';
  // ── 예비비 시행품 표 (P/M 번호로 찾는다)
  CL_LAST = {hits:[], vals:[], alts:[]};
  if (anc?.pm){
    const b = D.docs[doc]?.blocks.find(x => x.k === 'tbl' && x.rows.some(r => r[3]?.[0] === anc.pm)), r = b?.rows.find(x => x[3]?.[0] === anc.pm);
    if (!r) return `<div class="cl">${head(rule?.name || anc.pm, '')}<div class="cl-none">원문 위치를 찾지 못했어요</div></div>`;
    const lines = (r[11] || []).join('\n').split('\n').map(s => s.trim()).filter(Boolean);
    const kv = lines.map(s => s.match(/^-\s*([^:]+):\s*(.*)$/)).filter(Boolean).map(m => [m[1].trim(), m[2].trim()]).filter(([, v]) => v);
    const hot = k => k === '금액' || (k === '기간' && /유치일|이전|이후|기간/.test(ctx.c || '')) || (k === '대상' && /대상|소상공인|SOHO|비중/.test(ctx.c || ''));
    const hits = kv.filter(([k]) => hot(k)); CL_LAST.kv = kv;
    return `<div class="cl">${head(`${anc.pm} ${(r[5] || []).join(' ')}`, `시행품의 ${anc.pm} · ${(r[4] || []).join('')}`)}
      ${ctx.diff ? `<div class="cl-diff ${ctx.diffLabel ? 'q' : ''}"><em>${ctx.diffLabel || '원문과 다른 점'}</em><p>${esc(ctx.diff)}</p></div>` : hits.length ? `<div class="cl-hit"><em>이 건에 적용된 기준</em><span>${hits.map(([k, v]) => `${esc(k)} <b>${esc(v)}</b>`).join(' · ')}</span>${pay}</div>` : ''}
      <dl class="cl-kv">${kv.map(([k, v]) => `<dt>${esc(k)}</dt><dd class="${hot(k) ? 'on' : ''}">${esc(v)}</dd>`).join('')}
        <dt>P/M 기간</dt><dd>${esc((r[8] || []).join(' ').replace(/\n/g, ' '))}</dd><dt>지급 제외</dt><dd>${esc((r[10] || []).join(' ').replace(/\n/g, ' · '))}</dd></dl>${memo}</div>`;
  }
  // ── 영업 인센티브 정책 표 (블록 번호 + 행 이름으로 찾는다)
  const b = D.docs[doc]?.blocks.find(x => x.i === anc?.i);
  if (!b) return `<div class="cl">${head(rule?.name || '근거 조항', '')}<div class="cl-none">원문 위치를 찾지 못했어요</div></div>`;
  if (b.k === 'p') return `<div class="cl">${head(rule?.name || '', rule?.sec)}${ctx.diff ? `<div class="cl-diff ${ctx.diffLabel ? 'q' : ''}"><em>${ctx.diffLabel || '원문과 다른 점'}</em><p>${esc(ctx.diff)}</p></div>` : ''}<p class="cl-p">${esc(b.t)}</p>${memo}</div>`;
  const row = b.rows.find(r => r[0].join(' / ') === anc.row) || b.rows[0], title = row[0].join(' ');
  const ph = polHead(doc, b.i), words = clWords(ctx), base = b.rows.find(r => r[0].join('') === '정산기준'), sib = b.rows.filter(r => r !== row && r !== base && r[0].join('') !== '정책명');
  const rel = ctx.role === 'paid' ? [] : related(doc, b.i, words, 3, ctx);
  const tables = row[1].filter(x => x && x.t), notes = row[1].filter(x => typeof x === 'string').flatMap(s => s.split('\n')).map(s => s.trim()).filter(Boolean);
  const hitTxt = [], hitVals = [], alts = [], aV = ctx.a != null ? [String(ctx.a / 10000), '+' + ctx.a / 10000] : [];
  CL_LAST = {hits:hitTxt, vals:hitVals, alts, title:row[0].join(' ')};
  const secs = tables.flatMap(tb => { const out = [], cur = []; tb.t.forEach(r => { if (r.every(c => !c.join('').trim())) { if (cur.length) out.push(cur.splice(0)); } else cur.push(r); }); if (cur.length) out.push(cur); return out; })
    .map(rows => {
      const same = rows[0].map((_, j) => j > 0 && rows.length > 2 && rows.slice(1).every(r => r[j] && r[j].join(' ').trim() && r[j].join(' ') === rows[1][j].join(' ')) && rows[1][j].join(' ').length > 12);
      same.forEach((on, j) => { if (on) notes.unshift(`${rows[0][j].join(' ')}: ${rows[1][j].join(' · ')}`); });
      rows = rows.map(r => r.filter((_, j) => !same[j]));
      if (rows.every(r => r.length === 2) && !/구분/.test(rows[0][0].join(''))){
        const kw = [...new Set((ctx.c || '').split(/[^가-힣A-Za-z0-9]+/).filter(w => w.length >= 2))];
        const score = l => (T.amts.some(m => clN(l).includes(clN(m))) ? 3 : 0) + kw.filter(w => l.includes(w)).length + (T.date && clN(l).includes(clN(T.date)) ? 3 : 0);
        const lines = rows.flatMap(r => r[1].flatMap(x => x.split('\n')).map(l => ({k:r[0].join(' '), l:l.trim()})));
        const best = lines.reduce((m, x) => score(x.l) > score(m.l) ? x : m, {l:''});
        const hit = score(best.l) >= 3;
        if (hit) hitTxt.push(`${best.k}: ${best.l}`);
        const html = `<dl class="cl-kv">${rows.map(r => `<dt>${esc(r[0].join(' '))}</dt><dd>${r[1].flatMap(x => x.split('\n')).map(l => `<div class="${hit && l.trim() === best.l ? 'on' : ''}">${esc(l.trim())}</div>`).join('')}</dd>`).join('')}</dl>`;
        return {hit, html};
      }
      const hdr = rows[0], body = rows.slice(1), cols = hdr.map((c, j) => j > 0 && T.words.some(w => clN(c.join('')) === w || clN(c.join('')).startsWith(w))), anyCol = cols.some(Boolean);
      const rowHit = body.map(r => T.words.includes(clN(r[0].join(''))) || (T.date && r.some(c => clN(c.join('')).includes(clN(T.date)))));
      const cell = body.map((r, i) => r.map((c, j) => j > 0 && ((anyCol && cols[j] && (rowHit[i] || (!body.some((_, k) => rowHit[k]) && T.vals.includes(clV(c.join(''))))))
        || (!anyCol && rowHit[i] && !!c.join('').trim()))));
      body.forEach((r, i) => r.forEach((c, j) => { if (cell[i][j] && anyCol){ hitTxt.push(`${r[0].join(' ')} × ${hdr[j].join(' ')} = ${c.join(' ')}`); hitVals.push(clV(c.join(''))); } }));
      if (!anyCol) body.forEach((r, i) => { if (rowHit[i]){ hitTxt.push(r.map(c => c.join(' ')).filter(Boolean).join(' · ')); r.forEach((c, j) => j > 0 && hitVals.push(clV(c.join('')))); } });
      const hit = cell.some(r => r.some(Boolean));
      const paid = body.map((r, i) => r.map((c, j) => hit && aV.length > 0 && j > 0 && !cell[i][j] && aV.includes(clV(c.join(''))) && (!anyCol || cols[j] || rowHit[i])));
      body.forEach((r, i) => r.forEach((c, j) => { if (paid[i][j]) alts.push(anyCol ? `${r[0].join(' ')} × ${hdr[j].join(' ')}` : r.slice(0, 2).map(x => x.join(' ')).join(' ')); }));
      const role = ctx.role === 'paid' ? 'paid' : 'on', tagOf = (i, j) => cell[i][j] && (anyCol || j === r1(i)) ? `<i class="ctag ${role}">${role === 'paid' ? '실제 지급' : ctx.tagLabel || '정책'}</i>` : paid[i][j] && (anyCol || j === r1p(i)) ? '<i class="ctag paid">실제 지급</i>' : '';
      const r1 = i => { const k = body[i].findIndex((c, j) => j > 0 && cell[i][j] && T.vals.includes(clV(c.join('')))); return k > 0 ? k : body[i].findIndex((c, j) => j > 0 && cell[i][j] && /만원|^[+\-−]?\d+$/.test(c.join('').trim())); }, r1p = i => body[i].findIndex((c, j) => j > 0 && paid[i][j]);
      return {hit, html:`<table class="cl-tb"><thead><tr>${hdr.map((c, j) => `<th class="${cols[j] ? 'col' : ''}">${esc(c.join(' '))}</th>`).join('')}</tr></thead>
        <tbody>${body.map((r, i) => `<tr class="${rowHit[i] || cell[i].some(Boolean) ? 'row' : ''}">${r.map((c, j) => `<td class="${j === 0 ? 'lab' : ''} ${cell[i][j] ? role : paid[i][j] ? 'paid' : ''}">${esc(c.join(' '))}${tagOf(i, j)}</td>`).join('')}</tr>`).join('')}</tbody></table>`};
    });
  const shown = secs.some(s => s.hit) ? secs.filter(s => s.hit) : secs, hidden = secs.length - shown.length;
  const kwN = [...new Set((ctx.c || '').split(/[^가-힣A-Za-z0-9]+/).filter(w => w.length >= 2))];
  const hotNote = s => T.words.some(w => clN(s).includes(w)) || (T.date && clN(s).includes(clN(T.date))) || kwN.filter(w => s.includes(w)).length >= 2;
  const kwB = [...new Set((ctx.c || '').split(/[^가-힣A-Za-z0-9]+/).filter(w => w.length >= 2))];
  return `<div class="cl ${ctx.role === 'paid' ? 'cl-cmp' : ''}">${ctx.role === 'paid' ? `<div class="cl-cmp-h">비교 · 실제 지급액 ${man(ctx.p)}이 나온 원문</div>` : ''}${head(title, [ph?.name, rule?.sec?.split(' · ').slice(1).join(' · ')].filter(Boolean).join(' · '))}
    ${ph && ctx.role !== 'paid' ? `<div class="cl-ph"><span>정책명 <b>${esc(ph.name)}</b></span>${ph.dept ? `<span>주관 <b>${esc(ph.dept)}</b></span>` : ''}${ph.ch ? `<span>대상 채널 <b>${esc(ph.ch)}</b></span>` : ''}${ph.pay ? `<span>지급 방법 <b>${esc(ph.pay)}</b></span>` : ''}</div>` : ''}
    ${ctx.diff ? `<div class="cl-diff ${ctx.diffLabel ? 'q' : ''}"><em>${ctx.diffLabel || '원문과 다른 점'}</em><p>${esc(ctx.diff)}</p></div>` : ctx.role === 'paid' ? '' : hitTxt.length ? `<div class="cl-hit"><em>이 건에 적용된 칸</em><span>${hitTxt.slice(0, 3).map(t => `<b>${esc(t)}</b>`).join(' · ')}</span>${pay}</div>` : pay ? `<div class="cl-hit"><em>이 건</em>${pay}</div>` : ''}
    ${secs.some(s => s.hit) ? `<div class="cl-lg">${ctx.role === 'paid' ? '' : `<span><i class="sw on"></i>${ctx.tagLabel ? '2월에 바뀐 칸' : '정책상 이 건의 칸'}</span>`}${CL_LAST.alts.length || ctx.role === 'paid' ? '<span><i class="sw paid"></i>실제 지급액과 같은 칸</span>' : ''}</div>` : ''}
    <div class="cl-tbs">${shown.map(s => s.html).join('')}</div>
    ${base && base !== row && ctx.role !== 'paid' ? `<div class="cl-base"><em>이 정책의 공통 조건 (정산기준)</em>${flat(base.slice(1)).split(/\s*■\s*|\s+-\s+|\n/).map(x => x.trim()).filter(Boolean).map(l => `<div class="${kwB.filter(w => l.includes(w)).length >= 2 ? 'on' : ''}">${esc(l)}</div>`).join('')}</div>` : ''}
    ${hidden ? `<details class="cl-rest"><summary>같은 조항의 나머지 원문 ${hidden}개 보기</summary><div class="cl-tbs">${secs.filter(x => !shown.includes(x)).map(x => x.html).join('')}</div></details>` : ''}
    ${notes.length ? `<ul class="cl-notes">${notes.map(s => `<li class="${hotNote(s) ? 'on' : ''}">${esc(s.replace(/^[■*※ㆍ·\-]\s*/, ''))}</li>`).join('')}</ul>` : ''}
    ${memo}
    ${sib.length && ctx.role !== 'paid' ? `<details class="cl-rest"><summary>'${esc(ph?.name || '이 정책')}'의 다른 조항 ${sib.length}개 보기</summary><dl class="cl-sib">${sib.map(r => `<dt>${esc(r[0].join(' '))}</dt><dd>${esc(flat(r.slice(1)).slice(0, 320))}</dd>`).join('')}</dl></details>` : ''}
    ${rel.length ? `<div class="cl-rel"><em>문서의 다른 곳에 나온 관련 원문</em><ul>${rel.map(x => `<li><span>${esc([x.where, x.label].filter(Boolean).join(' › ') || '본문')}</span><p>${markW(x.text.slice(0, 260) + (x.text.length > 260 ? '…' : ''), words)}</p></li>`).join('')}</ul></div>` : ''}</div>`;
}


/* 원문 비교에 쓰는 도우미 */
const dMD = d => d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '';
const dM = d => d ? +d.slice(5, 7) : 0;
const ATYPE = {'M/A':'매스에이전트', '홈파':'홈앤파트너'};
const josa = (w, a, b) => { const ch = String(w).trim().slice(-1), k = ch.charCodeAt(0) - 0xAC00; return (k >= 0 && k < 11172 ? k % 28 > 0 : /[0-9]/.test(ch) ? /[013678]/.test(ch) : /[LMNR]/.test(ch) || /[a-z]/.test(ch) && !/[aeiouy]/.test(ch)) ? a : b; };
function otherCell(doc, anc, ctx){
  // 같은 행 이름을 가진 다른 정책 표(다른 달 정책 · 같은 달 다른 기간)에서 이 건의 칸 값을 읽는다
  if (!anc?.row) return [];
  const out = [];
  Object.keys(D.docs).filter(d => d.slice(0, 2) === doc.slice(0, 2)).forEach(d => D.docs[d].blocks.filter(b => b.k === 'tbl' && b.rows.some(r => r[0].join(' / ') === anc.row) && !(d === doc && b.i === anc.i)).forEach(b => {
    clause(d, {i:b.i, row:anc.row}, {...ctx, a:null});
    const rule = clRule(d, {i:b.i, row:anc.row}, ctx.n), per = rule?.name.match(/\((.*)\)/)?.[1];
    if (CL_LAST.vals.length) out.push({doc:d, label:d !== doc ? `${+d.slice(-2)}월 정책` : `같은 문서의 '${per || CL_LAST.title}' 표`, v:CL_LAST.vals[0], hit:CL_LAST.hits[0]});
  }));
  return out;
}

/* 정책 원문과 비교: 원문을 그대로 보여주고, 이 건의 칸(정책)과 실제 지급액이 나온 칸을 원문 위에 표시한다 */
function exclAnc(c, doc){ const r = D.rules.find(x => x.doc === doc && x.key === 'C1-excl'); return r?.anc; }
/* 지급 항목 하나: 원문 표(정책 칸·실제 지급 칸) + 원문과 다른 점 + 실제 금액이 나온 다른 원문 */
function origItem(c, i, lead = ''){
  const out = [], q = s => `'${s}'`;
    const ctx = {n:i.n, c:i.c, p:i.p, a:i.a};
    clause(i.doc, i.anc, ctx); const hit = CL_LAST.hits[0], alts = CL_LAST.alts.slice();
    let diff = '', other = null;
    if (alts.length) diff = `원문 ${q(CL_LAST.title)} 표에서 이 건은 ${q(hit || '')} 칸에 해당해 ${man(i.p)}이에요. 실제로 지급된 ${man(i.a)}은 같은 표의 ${alts.map(q).join(', ')} 칸 값이에요.`;
    else {
      other = otherCell(i.doc, i.anc, {n:i.n, c:i.c, p:i.p}).find(o => [String(i.a / 10000), '+' + i.a / 10000].includes(o.v));
      if (other) diff = `이 건은 ${DOCNAME(i.doc)} 원문의 ${q(hit || CL_LAST.title)} 칸(${man(i.p)})을 따라야 해요. 실제로 지급된 ${man(i.a)}은 ${other.label} 원문의 같은 칸 값이에요.`;
      else if (i.p === 0 && /이전|이후|기간/.test(i.c)){ const per = (CL_LAST.kv || []).find(([k]) => k === '기간');
        diff = per ? `원문에 '기간: ${per[1]}'이라고 적혀 있어요. 이 건은 ${dMD(c.signup)}에 유치해 이 기간에 들지 않으니 지급 대상이 아닌데, ${man(i.a)}이 지급됐어요.`
          : `원문 기간 조건에 따르면 이 건(${i.c.replace(/\s*→\s*0원\s*$/, '')})은 지급 대상이 아닌데 ${man(i.a)}이 지급됐어요.`; }
      else diff = `원문 기준으로 이 건은 ${hit ? q(hit) + ' 칸, ' : ''}${man(i.p)}이에요. 실제로는 ${man(i.a)}이 지급됐고, 원문에서 같은 값은 찾지 못했어요.`;
    }
    out.push(clause(i.doc, i.anc, {...ctx, diff:lead + diff}));
    if (other){ const ob = D.docs[other.doc].blocks.find(b => b.k === 'tbl' && b.rows.some(r => r[0].join(' / ') === i.anc.row) && !(other.doc === i.doc && b.i === i.anc.i));
      if (ob) out.push(clause(other.doc, {i:ob.i, row:i.anc.row}, {n:i.n, c:i.c, p:i.a, role:'paid'})); }
  return out.join('');
}
function origView(c){
  const out = [], q = s => `'${s}'`;
  if (c.k === 'check'){
    const R = c.reasons.length ? c.reasons : c.items.filter(i => i.amb).map(i => ({r:'정책 해석 모호', t:`${i.n}: ${i.amb}`, doc:i.doc, anc:i.anc}));
    R.filter(r => r.anc).slice(0, 2).forEach(r => out.push(clause(r.doc, r.anc, {n:r.t.split(':')[0], c:r.t, diff:`${r.r} · ${r.t.replace(/\s*·\s*/g, ', ')}`, diffLabel:'원문만으로 판단하기 어려운 점'})));
    return out.join('') || '<div class="cl-none">연결된 정책 원문이 없어요</div>';
  }
  const bad = c.items.filter(i => i.st !== 'ok' && i.p != null && i.a !== i.p);
  const exI = c.excl?.length ? bad.filter(i => i.p === 0) : [];
  if (exI.length){ const i = exI[0], ea = exclAnc(c, i.doc) || i.anc;
    out.push(clause(i.doc, ea, {n:'지급 제외', c:`${c.excl.join(' ')} 지급제외`,
      diff:`원문 정산기준에 '${c.excl.join(', ')}' 건은 지급 제외라고 적혀 있어요. 이 건이 여기에 해당하는데 ${exI.map(x => `'${x.n}' ${man(x.a)}`).join(', ')}이 지급됐어요(합계 ${man(exI.reduce((s, x) => s + x.a, 0))}).`})); }
  bad.filter(i => !exI.includes(i)).slice(0, 2).forEach(i => out.push(origItem(c, i)));
  if (bad.length - exI.length > 2) out.push(`<div class="cl-none">이 밖에 ${bad.filter(i => !exI.includes(i)).slice(2).map(i => `'${i.n}'`).join(', ')}도 원문과 다르게 지급됐어요.</div>`);
  return out.join('') || '<div class="cl-none">연결된 정책 원문이 없어요</div>';
}
function evidence(c){
  const ref = c.reasons[0] || c.items.find(i => i.st !== 'ok') || c.items[0];
  const past = S.history.flatMap(h => h.items.map(x => ({...x, month:h.month}))).find(x => x.agent === c.agentCode && x.item === c.title);
  return `<dl class="meta"><dt>판매점</dt><dd>${esc(c.who)}</dd><dt>본부·지점</dt><dd>${esc(c.hq)} · ${esc(c.branch)}</dd>
      <dt>상품</dt><dd>${esc(c.prod)}</dd><dt>개통일</dt><dd>${esc(c.open)}</dd><dt>적용 정책</dt><dd>${esc(c.ver)}</dd><dt>계약</dt><dd>${esc(c.contract)}</dd></dl>
    ${past ? `<div class="why check" style="margin-bottom:12px">지난 판단 기록 · ${mLabel(past.month)} 같은 판매점·항목을 <b>${JNAME[past.v]}</b>(으)로 판단했어요${past.memo ? ` — ${esc(past.memo)}` : ''}</div>` : ''}
    <div class="why ${c.k} head">${c.k === 'check' ? `<b>정책만으로 판단하기 어려워 보류한 건이에요</b><span>${esc(c.reasons[0]?.r || '정책 해석 모호')} · ${esc(c.title)}</span>`
      : `<b>${(m => m ? `'${esc(m[1])}' 외 ${m[2]}개 항목을` : `'${esc(c.title)}'${josa(c.title, '을', '를')}`)(c.title.match(/^(.*) 외 (\d+)$/))} 정책보다 ${man(Math.abs(c.diff))} ${c.diff > 0 ? '더' : '덜'} 지급했어요</b><span>정책상 ${nf(c.policy)}원 · 실제 ${nf(c.actual)}원 · 차액 ${won(c.diff)}</span>`}</div>
    <div class="sec"><h5>정책 원문과 비교</h5>${origView(c)}</div>
    <div class="sec"><h5>항목별 계산</h5><table class="itbl"><tr><th>항목</th><th>실제</th><th>정책상</th><th>차이</th></tr>
      ${c.items.map(i => `<tr class="${i.st === 'amb' ? 'amb' : i.a !== i.p ? 'bad' : ''}"><td>${esc(i.n)}<div class="calc">${esc(i.c)}</div></td><td class="money">${nf(i.a)}</td><td class="money">${i.p == null ? '-' : nf(i.p)}</td><td class="money">${i.p == null || i.a === i.p ? '' : won(i.a - i.p)}</td></tr>`).join('')}</table></div>
    <div class="sec"><h5>원장 행</h5><div class="ledger">${svg('review', 16)}<span>${esc(D.files[c.case === 'C1' ? 'C1-PAY-2602' : 'C2-PAY-2602'] || '2월 정산자료')}</span><b style="margin-left:auto">${esc(c.loc)}</b> · 서비스 ${esc(c.svc)} · 실제 ${nf(c.actual)}원</div></div>`;
}
function excel(){
  const r = rows(), head = ['구분', '판매점', '본부', '지점', '항목·사유', '실제 지급액', '정책상 지급액', '차액', '원장 위치', '소명 요청', '판단'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [head, ...r.map(c => [KNAME[c.k], c.who, c.hq, c.branch, c.k === 'check' ? c.why : c.title, c.actual, c.policy ?? '', c.diff ?? '', c.loc, S.reqs.some(q => q.ids.includes(c.id)) ? 'Y' : '', JNAME[judgeOf(c)]])].map(x => x.map(q).join(',')).join('\r\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); a.download = `근거검토_2026-02_${r.length}건.csv`; a.click();
  toast(`${r.length}건을 Excel(CSV) 파일로 내려받았어요`);
}

/* ───────── 화면: 소명 관리 (작성 · 수정 · 발송) */
/* 진행 중 / 종결 탭 하나로 보는 긴 목록 칸 (근거 검토 탭과 같은 모양) */
function tabList(key, L, cls, row, emp){
  const on = L.filter(x => x.status !== 'done'), off = L.filter(x => x.status === 'done');
  const tab = S.lt[key] || 'on', cur = tab === 'done' ? off : on;
  return `<div class="card lone"><div class="lt"><div class="seg">${[['on', '진행 중', on.length], ['done', '종결', off.length]].map(([k, t, n]) => `<button data-lt="${key}:${k}" class="${tab === k ? 'on' : ''}">${t}<small>${n}</small></button>`).join('')}</div></div>
    <div class="${cls}">${cur.map(row).join('') || `<div class="tg2e">${tab === 'done' ? '아직 종결한 소명이 없어요' : emp}</div>`}</div></div>`;
}
const RST = {draft:['작성 중', 't-gray'], sent:['회신 대기', 't-blue'], replied:['회신 도착', 't-check'], done:['종결', 't-ok']};
function viewAppeal(){
  const r = S.reqs.find(x => x.id === S.reqSel) || S.draft;
  const left = S.draft ? `<div class="card evi"><div class="evi-h"><button class="btn sm" data-act="draftBack">‹ 소명 목록</button><span class="x">소명 대상 근거</span></div>
      ${S.draft.ids.map(id => { const c = BYID[id]; return `<div class="evi-c"><span class="tag t-${c.k}">${KNAME[c.k]}</span><h3>${esc(c.title)}</h3><div class="sub2">${esc(c.who)} · ${esc(c.loc)}</div>${evidence(c)}</div>`; }).join('')}</div>`
    : tabList('ap', S.reqs, 'reqs', x => `<div class="req ${x.id === S.reqSel ? 'sel' : ''}" data-req="${x.id}">
          <div class="nm"><b>${esc(x.title)}</b><small>${esc(x.to)} · 대상 ${x.ids.length}건 · ${x.closedAt ? '종결 ' + x.closedAt : x.sentAt ? '발송 ' + x.sentAt : '작성 ' + x.created}${x.edited ? ' · 수정됨' : ''}</small></div>
          <span class="tag ${RST[x.status][1]}">${RST[x.status][0]}</span></div>`, '진행 중인 소명이 없어요. 근거 검토 상세에서 작성해 보세요.');
  return `<div class="ap">${left}${r ? form(r) : `<div class="card empty" style="display:grid;place-items:center">왼쪽에서 요청을 고르거나, 근거 검토 상세에서 "소명 요청 작성"을 눌러 주세요.</div>`}</div>`;
}
function form(r){
  const locked = r.status === 'done';
  return `<div class="card form" id="form">
    <h3>${r.status === 'draft' ? '소명 요청서 작성' : '소명 요청서 수정'} <span class="tag ${RST[r.status][1]}" style="margin-left:6px">${RST[r.status][0]}</span></h3>
    <div class="fld"><label>받는 사람</label><input class="inp" value="${esc(r.to)} 지급 담당자" disabled></div>
    <div class="fld"><label>대상 건 <span class="cnt">${r.ids.length}건</span></label>
      <div class="tgt">${r.ids.map(id => { const c = BYID[id]; return `<div class="tg"><span class="tag t-${c.k}">${KNAME[c.k]}</span><b>${esc(c.title)}</b><small>${esc(c.loc)}</small>
        <span class="money ${c.diff > 0 ? 'plus' : c.diff < 0 ? 'minus' : ''}">${c.diff ? won(c.diff) : '판정 보류'}</span>${r.ids.length > 1 && !locked ? `<button class="rm" data-rm="${id}" aria-label="빼기">×</button>` : ''}</div>`; }).join('')}</div>
      </div>
    <div class="fld"><label>제목</label><input class="inp" id="fTitle" value="${esc(r.title)}" ${locked ? 'disabled' : ''}></div>
    <div class="fld"><label>요청 내용 (근거 조항 · 의심 사유)</label><textarea id="fBody" ${locked ? 'disabled' : ''}>${esc(r.body)}</textarea></div>
    <div class="fld"><label>요청 자료</label><div class="pills">${['지급 근거 설명', '개통·결합 증빙', '정책 공지·협의 문서', '기타 자료'].map(a => `<label class="pill2"><input type="checkbox" data-ask="${a}" ${r.asks.includes(a) ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${a}</span></label>`).join('')}</div></div>
    <div class="fld"><label>회신 기한 (요청일 + 10일)</label><input class="inp" type="date" id="fDue" value="${r.due}" ${locked ? 'disabled' : ''} style="width:200px"></div>
    <div class="acts">
      ${r.status === 'draft' ? `<button class="btn" data-act="saveReq">저장</button><button class="btn blue" data-act="sendReq">지급 담당자에게 발송</button>${S.reqs.includes(r) ? '<button class="btn" data-act="delReq" style="margin-left:auto">삭제</button>' : ''}`
        : locked ? `<button class="btn" data-go="answer">소명 검토 보기 ›</button>` : `<button class="btn pri" data-act="saveReq">수정 내용 저장</button><button class="btn" data-act="goThread">소명 검토(채팅) ›</button>`}
    </div></div>`;
}
function readForm(r){
  if (!$('form') || r.status === 'done') return;
  r.title = $('fTitle').value.trim() || r.title; r.body = $('fBody').value; r.due = $('fDue').value || r.due;
  r.asks = [...document.querySelectorAll('[data-ask]')].filter(x => x.checked).map(x => x.dataset.ask);
}

/* ───────── 화면: 소명 검토 (메일함 — 받은편지함 · 보낸편지함 · 종결) */
function mbFolder(r, pay){ return r.status === 'done' ? 'done' : (r.status === 'replied') !== pay ? 'in' : 'sent'; }
function viewAnswer(){
  const pay = S.role === 'pay', all = S.reqs.filter(r => r.status !== 'draft'), F = S.mbox || 'in';
  const seen = S.seen ||= {}, mails = r => (S.threads[r.id] || []).filter(m => m.who !== 'sys');
  const unread = r => mbFolder(r, pay) === 'in' && mails(r).length > (seen[r.id] || 0);
  const list = all.filter(r => mbFolder(r, pay) === F).sort((a, b) => String((S.threads[b.id] || []).at(-1)?.at).localeCompare(String((S.threads[a.id] || []).at(-1)?.at)));
  if (!list.find(r => r.id === S.appSel)) S.appSel = list[0]?.id || null;
  const r = list.find(x => x.id === S.appSel), closed = r && r.status === 'done';
  const me = pay ? 'pay' : 'aud', who = (w, r) => w === 'aud' ? '감사인 김브밴' : `${r.to} 지급 담당자`;
  const subj = (r, k) => `${k ? 'RE: ' : ''}[소명 요청] ${r.title}`;
  const folders = [['in', '받은편지함', 'review'], ['sent', '보낸편지함', 'appeal'], ['done', '종결', 'check']];
  const cnt = f => all.filter(x => mbFolder(x, pay) === f).length, ucnt = all.filter(unread).length;
  const ms = r ? mails(r) : [], open = S.mopen ||= {};
  if (r) seen[r.id] = ms.length;
  const judged = r ? r.ids.filter(id => S.finals[id]?.v).length : 0;
  const mailHTML = (m, k) => { const isOpen = k === ms.length - 1 || open[`${r.id}:${k}`], ini2 = m.who === 'aud' ? '김' : ini(r.to);
    return `<article class="ml ${isOpen ? 'open' : ''}">
      <header data-act="mtoggle" data-k="${r.id}:${k}"><span class="av ${m.who}">${esc(ini2)}</span>
        <div class="ml-from"><b>${esc(who(m.who, r))}</b><small>${isOpen ? `받는 사람 · ${esc(who(m.who === 'aud' ? 'pay' : 'aud', r))}` : esc((m.t || '').replace(/\s+/g, ' ').slice(0, 80))}</small></div>
        ${m.files?.length ? `<span class="ml-clip">${svg('clip', 14)}${m.files.length}</span>` : ''}<time>${esc(m.at)}</time></header>
      ${isOpen ? `<div class="ml-body">${esc(m.t || '')}</div>${m.files?.length ? `<div class="ml-att">${m.files.map(f => `<span class="att"><i>${esc(f.split('.').pop().toUpperCase().slice(0, 4))}</i>${esc(f)}</span>`).join('')}</div>` : ''}` : ''}
    </article>`; };
  return `<div class="mb ${pay ? 'pay' : ''}">
    <nav class="card mb-f">
      ${pay ? '' : `<button class="btn blue mb-new" data-go="appeal">${svg('appeal', 16)}소명 요청 쓰기</button>`}
      ${folders.map(([k, t, ic]) => `<button class="mb-fi ${F === k ? 'on' : ''}" data-mb="${k}">${svg(ic, 16)}<span>${t}</span><em>${k === 'in' && ucnt ? `<b>${ucnt}</b>` : cnt(k) || ''}</em></button>`).join('')}
    </nav>
    <section class="card mb-l">
      <div class="mb-lh"><h3>${folders.find(f => f[0] === F)[1]}</h3><span>${list.length}통</span></div>
      <div class="mb-items">${list.map(x => { const m = mails(x).at(-1), u = unread(x);
        return `<button class="mi ${x.id === S.appSel ? 'on' : ''} ${u ? 'unread' : ''}" data-app="${x.id}">
          <div class="mi-t"><b>${esc(m ? who(m.who, x) : x.to)}</b><time>${esc(m?.at || x.sentAt || '')}</time></div>
          <div class="mi-s">${u ? '<i class="dot"></i>' : ''}${esc(subj(x, mails(x).length > 1))}</div>
          <div class="mi-p">${esc((m?.t || '').replace(/\s+/g, ' ').slice(0, 70))}</div>
          <div class="mi-f"><span class="tag ${RST[x.status][1]}">${RST[x.status][0]}</span>${mails(x).some(y => y.files?.length) ? `<span class="mi-clip">${svg('clip', 13)}</span>` : ''}<span class="mi-due">기한 ${esc(x.due)}</span></div>
        </button>`; }).join('') || `<div class="mb-empty">${{in:'받은 메일이 없어요', sent:'보낸 메일이 없어요', done:'종결한 소명이 없어요'}[F]}</div>`}</div>
    </section>
    <section class="card mb-r">${r ? `
      <div class="rd-h"><h2>${esc(subj(r, false))}</h2>
        <div class="rd-meta"><span class="tag ${RST[r.status][1]}">${RST[r.status][0]}</span><span>${esc(r.to)}</span><span>대상 ${r.ids.length}건</span><span>회신 기한 ${esc(r.due)}</span></div></div>
      <div class="rd-b" id="conv">
        ${ms.map(mailHTML).join('')}
        ${pay ? '' : `<section class="rd-j"><div class="rd-jh"><h4>최종 판단</h4><span>${judged} / ${r.ids.length}건</span></div>
          ${r.ids.map(id => { const c = BYID[id], f = S.finals[id] || {};
            return `<div class="rj"><div class="rj-t"><span class="tag t-${c.k}">${KNAME[c.k]}</span><b>${esc(c.title)}</b><small>${esc(c.loc)} · ${c.diff ? won(c.diff) : '판정 보류'}</small></div>
              <div class="judge">${[['ok', '정상'], ['over', '오지급']].map(([k, t]) => `<button class="j-${k} ${f.v === k ? 'on' : ''}" data-fin="${id}" data-v="${k}" ${closed ? 'disabled' : ''}>${t}</button>`).join('')}</div>
              <input class="inp" data-memo="${id}" placeholder="판단 메모 (다음 달 감사에 함께 보여요)" value="${esc(f.memo || '')}" ${closed ? 'disabled' : ''}></div>`; }).join('')}
          ${closed ? `<div class="rd-done">${esc(r.closedAt || '')} 종결 · 판단을 기록했어요</div>` : `<button class="btn pri" data-act="closeReq" ${judged === r.ids.length ? '' : 'disabled'}>이 소명 종결</button>`}
        </section>`}
      </div>
      ${closed ? '' : S.cmpOpen ? `<div class="rd-c">
          <div class="rd-cf"><span>받는 사람</span><b>${esc(who(me === 'aud' ? 'pay' : 'aud', r))}</b></div>
          <div class="rd-cf"><span>제목</span><b>${esc(subj(r, true))}</b></div>
          <textarea id="cm" data-mail="1" placeholder="${pay ? '소명 내용을 쓰고 증빙 파일을 첨부하세요' : '추가로 확인할 내용이나 요청할 자료를 쓰세요'}"></textarea>
          <div class="pend" id="pend"></div>
          <div class="rd-ca"><button class="btn" data-act="attach">${svg('clip', 15)}파일 첨부</button><span style="flex:1"></span><button class="btn" data-act="cancelReply">취소</button><button class="btn blue" id="cmSend">보내기</button></div>
        </div>` : `<div class="rd-rb"><button class="btn" data-act="reply">${svg('appeal', 15)}${pay ? '소명 회신 쓰기' : '답장'}</button></div>`}
    ` : `<div class="mb-empty big">메일을 골라 주세요</div>`}</section>
  </div>`;
}

/* ───────── 화면: 현상 코멘트 */
function viewCmt(){
  const kinds = KINDS3.filter(k => COMMENTS.some(c => c.kind === k));
  if (!kinds.includes(S.cmtF)) S.cmtF = kinds[0];
  const list = COMMENTS.filter(c => c.kind === S.cmtF), sel = list.find(c => c.id === S.cmtSel) || list[0];
  const desc = {'반복 오지급':'오지급이 되풀이되는 정책 항목과 판매점, 그 조항에서 해석이 갈릴 수 있는 곳', '매출 대비 인센티브':'상품 구성별로 예상 매출에 비해 인센티브가 큰 곳과 그 단가 조항', '수수료 하락':'수수료가 계속 줄어든 판매점, 실적 감소 때문인지 단가 변경 때문인지'}[S.cmtF];
  return `<div class="tools"><div class="seg">${kinds.map(k => `<button data-cf="${k}" class="${S.cmtF === k ? 'on' : ''}">${k}<small>${COMMENTS.filter(c => c.kind === k).length}</small></button>`).join('')}</div>
      <span style="font-size:13px;color:var(--ink-2)">${desc}</span></div>
    <div class="cv">
      <div class="card cl2">${list.map(c => `<button class="ci2 ${c === sel ? 'on' : ''}" data-cs="${c.id}">
          <b>${esc(c.title)}</b>${c.policy ? `<small>관련 정책 · ${esc(c.policy.name)}</small>` : ''}</button>`).join('')}</div>
      <div class="card cd2">
        <div style="display:flex;align-items:center;gap:8px"><span class="tag t-blue">${sel.kind}</span></div>
        <p class="cd2-lead">${esc(sel.body)}</p>
        <div class="cd2-sec"><h5>관련 데이터</h5><div class="cd2-c" data-chart="${sel.id}"></div><div class="basis">${esc(sel.basis || '')}</div></div>
        ${sel.split ? (() => { const mx = Math.max(...sel.split.map(x => Math.abs(x[1]))) || 1; return `<div class="cd2-sec"><h5>${sel.splitTitle}</h5><div class="spl">${sel.split.map(([n, v]) => `<div class="sp-r"><span>${esc(n)}</span><i><b style="width:${Math.abs(v) / mx * 100}%"></b></i><em>${man(v)}</em></div>`).join('')}</div></div>`; })() : ''}
        ${sel.policy ? `<div class="cd2-sec"><h5>관련 정책</h5><div class="pol">
          ${sel.policy.diff ? `<div class="pol-q"><em>2월 변경</em><span>${sel.policy.diff.map(t => `<span class="dchip">${esc(t)}</span>`).join('')}<small class="u">(만원)</small></span></div>` : ''}
          ${(() => { const r = sel.policy.row, c = r && BYID[r.cid], it = c && c.items.find(x => x.n === r.n);
            return it && it.p != null && it.a !== it.p ? origItem(c, it, `${r.cnt > 1 ? `2월 ${r.st > 1 ? `판매점 ${r.st}곳의 ` : ''}${r.cnt}건이 같은 모양이에요. ` : ''}대표 건(${c.who}) 기준으로 보면, `)
              : clause(sel.policy.doc, sel.policy.anc, sel.policy.ctx || {}); })()}
        </div></div>` : ''}
        ${sel.points.length ? `<div class="cd2-sec"><h5>살펴볼 곳</h5><ol class="pts">${sel.points.map(x => `<li><span class="ptag">${esc(x.tag)}</span><p>${esc(x.t)}</p></li>`).join('')}</ol></div>` : ''}
        ${sel.agent && CASES.some(x => x.agentCode === sel.agent) ? `<div class="cd2-f"><button class="btn" data-act="agentList" data-code="${sel.agent}">이 판매점 2월 오지급 후보 보기 ›</button></div>` : ''}
      </div>
    </div>`;
}
/* ───────── 화면: 정책 관리 (등록 · 적용 정책 확인). 변경 이력은 도우미에게 묻는다 */
// 두 정책 파일의 추출 규칙을 맞대어 바뀐 규칙만 뽑는다 (같은 규칙 = 같은 key + 기본 이름)
function diffDocs(a, b){
  const base = r => r.key + '|' + r.name.replace(/\s*\(.*\)$/, '').replace(/\s+/g, ' ').trim();
  const A = Object.fromEntries(D.rules.filter(r => r.doc === a).map(r => [base(r), r])), B = Object.fromEntries(D.rules.filter(r => r.doc === b).map(r => [base(r), r]));
  const out = {add:[], chg:[], del:[], same:0};
  Object.keys(B).forEach(k => { if (!A[k]) out.add.push(B[k]); else if (A[k].amt !== B[k].amt || A[k].cond !== B[k].cond) out.chg.push([A[k], B[k]]); else out.same++; });
  Object.keys(A).forEach(k => { if (!B[k]) out.del.push(A[k]); });
  return out;
}
function viewPolicy(){
  const docs = Object.entries(D.docs).map(([id, d]) => ({id, ...d, cs:id.slice(0, 2), month:'2026-' + id.slice(-2), n:D.rules.filter(r => r.doc === id).length}))
    .sort((x, y) => y.month.localeCompare(x.month) || x.cs.localeCompare(y.cs));
  const pc = S.pcmp ||= {a:'C1-POL-2601', b:'C1-POL-2602', run:false};
  const opt = sel => docs.map(d => `<option value="${d.id}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  const r = pc.run ? diffDocs(pc.a, pc.b) : null, cross = pc.a.slice(0, 2) !== pc.b.slice(0, 2);
  const row = (kind, t, x, y) => `<div class="dr ${kind}"><span class="tag ${{add:'t-ok', chg:'t-blue', del:'t-gray'}[kind]}">${t}</span>
      <div class="dr-b"><b>${esc((y || x).name)}</b><small>${esc((y || x).sec)}</small>
      ${kind === 'chg' ? `${x.cond !== y.cond ? `<div class="dv"><em>조건</em><s>${esc(x.cond)}</s><span>${esc(y.cond)}</span></div>` : ''}${x.amt !== y.amt ? `<div class="dv"><em>금액</em><s>${esc(x.amt)}</s><span>${esc(y.amt)}</span></div>` : ''}`
        : `<div class="dv"><em>${kind === 'add' ? '내용' : '이전'}</em><span class="${kind === 'del' ? 'gone' : ''}">${esc(x.cond)} · ${esc(x.amt)}</span></div>`}</div></div>`;
  return `<div class="pg2">
    <div class="pcol">
      <div class="card"><div class="card-h"><h3>등록된 정책</h3><span class="x">${docs.length}개 · 적용할 정책을 고르세요</span></div>
        <div class="plist">
          ${docs.map(d => { const on = S.policy.applied[d.cs] === d.id; return `<div class="prow ${on ? 'cur' : ''}" data-apply="${d.cs}:${d.id}"><span class="radio ${on ? 'on' : ''}"></span>
            <div class="nm"><b>${esc(d.name)}</b><small>${d.cs === 'C1' ? 'Case1 판매수수료' : 'Case2 담당예비비'} · ${mLabel(d.month)} · 규칙 ${d.n}개</small></div>${on ? '<span class="tag t-blue">적용 중</span>' : ''}</div>`; }).join('')}</div>
        <div style="padding:0 22px 18px">${S.policy.confirmed ? '<span class="tag t-ok">적용 정책 확인 완료</span>' : '<button class="btn pri" data-act="confirmPol" style="width:100%">선택한 정책으로 감사 진행</button>'}</div></div>
    </div>
    <div class="card cmp">
      <div class="card-h"><h3>정책 변경사항 비교</h3><span class="x">두 정책 파일을 골라 바뀐 규칙만 뽑아 보여 드려요</span></div>
      <div class="pick">
        <label><span>기준 정책</span><select class="inp" id="pa">${opt(pc.a)}</select></label>
        <span class="arrow">→</span>
        <label><span>비교할 정책</span><select class="inp" id="pb">${opt(pc.b)}</select></label>
        <button class="btn blue" data-act="runCmp" ${pc.a === pc.b ? 'disabled' : ''}>바뀐 규칙 추출</button>
      </div>
      ${pc.a === pc.b ? '<p class="cmp-note">서로 다른 두 정책을 골라 주세요.</p>' : cross ? '<p class="cmp-note">Case가 다른 정책끼리 비교하고 있어요. 같은 Case의 정책을 고르면 더 정확해요.</p>' : ''}
      ${!r ? `<div class="empty" style="padding:60px 20px">비교할 두 정책을 고르고 <b>바뀐 규칙 추출</b>을 누르세요.</div>` : `
        <div class="sumc"><div><b>${r.chg.length}</b><span>변경</span></div><div><b>${r.add.length}</b><span>신규</span></div><div><b>${r.del.length}</b><span>삭제</span></div><div class="mute"><b>${r.same}</b><span>그대로</span></div></div>
        <div class="dlist">
          ${r.chg.length ? `<h5>변경된 규칙</h5>${r.chg.map(([x, y]) => row('chg', '변경', x, y)).join('')}` : ''}
          ${r.add.length ? `<h5>새로 생긴 규칙</h5>${r.add.map(x => row('add', '신규', x)).join('')}` : ''}
          ${r.del.length ? `<h5>없어진 규칙</h5>${r.del.map(x => row('del', '삭제', x)).join('')}` : ''}
          ${!r.chg.length && !r.add.length && !r.del.length ? '<div class="empty">두 정책 사이에 바뀐 규칙이 없어요.</div>' : ''}
        </div>
        <p class="cmp-note" style="margin:6px 24px 20px">${esc(D.docs[pc.a].name)} → ${esc(D.docs[pc.b].name)} · 각 정책 원문에서 추출한 규칙 기준</p>`}
    </div>
  </div>`;
}
/* ───────── 렌더 */
function drawCharts(){ document.querySelectorAll('[data-chart]').forEach(el => { const c = COMMENTS.find(x => x.id === el.dataset.chart), w = el.clientWidth, h = el.clientHeight; if (c && w > 40 && h > 40) el.innerHTML = chartFor(c, w, h); }); }
addEventListener('resize', () => drawCharts());
let _lastView = null;
const VIEWS = {dash:viewDash, review:viewReview, appeal:viewAppeal, answer:viewAnswer, cmt:viewCmt, policy:viewPolicy};
function render(){
  if (!NAV[S.role].flat().some(n => n[0] === S.view)) S.view = NAV[S.role][0][0][0];
  const [t, sub] = TITLE[S.view] || ['', '']; $('title').textContent = S.role === 'pay' && S.view === 'answer' ? '받은 소명 요청' : t;
  $('subtitle').textContent = S.role === 'pay' ? `${S.reqs.find(r => r.id === S.appSel)?.to || '판매점'} 지급 담당자 화면 · 감사인의 요청에 회신하고 증빙을 제출하세요.` : sub;
  $('hd').classList.toggle('dash-hd', S.view === 'dash');
  const keep = S.view === _lastView ? document.querySelector('.tblwrap')?.scrollTop : 0, sameView = S.view === _lastView; _lastView = S.view;
  if (!sameView){ $('view').className = 'view'; void $('view').offsetWidth; }
  $('view').innerHTML = VIEWS[S.view]();
  if (keep) { const tw = document.querySelector('.tblwrap'); if (tw) tw.scrollTop = keep; }
  renderNav(); window.fillOrbs && fillOrbs(); bindView(); requestAnimationFrame(drawCharts); save();
}
function bindView(){
  const rq = $('rq'); if (rq) rq.oninput = () => { S.f.q = rq.value; S.page = 1; const p = rq.selectionStart; render(); $('rq').focus(); $('rq').setSelectionRange(p, p); };
  const conv = $('conv'); if (conv && S.view !== 'answer') conv.scrollTop = 1e9; if (S.cmpOpen && $('cm')) $('cm').focus();
  const cm = $('cm'); if (cm){ const s = $('cmSend'); cm.oninput = () => { s.classList.toggle('on', !!cm.value.trim() || pending.length > 0); cm.style.height = 'auto'; cm.style.height = Math.min(cm.scrollHeight, 120) + 'px'; };
    cm.onkeydown = e => { if (!cm.dataset.mail && e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMsg(); } }; s.onclick = sendMsg; showPending(); }
  const ac = $('addCase'); if (ac) ac.onchange = () => { const r = curReq(); if (ac.value){ readForm(r); r.ids.push(ac.value); render(); } };
  document.querySelectorAll('[data-memo]').forEach(i => i.onchange = () => { (S.finals[i.dataset.memo] ||= {}).memo = i.value; save(); });
  ['pa', 'pb'].forEach(k => { const el = $(k); if (el) el.onchange = () => { S.pcmp[k === 'pa' ? 'a' : 'b'] = el.value; S.pcmp.run = false; render(); }; });
  const drop = $('drop'); if (drop){ drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upPol(e.dataTransfer.files); }; }
  bindRows(); requestAnimationFrame(drawCharts);
  const res = $('res'); if (res) res.querySelectorAll('.bub').forEach(el => {
    el.onmouseenter = () => { const t = $('tip'), r = el.getBoundingClientRect(), c = res.getBoundingClientRect(); t.textContent = el.dataset.tip; t.style.left = (r.left + r.width / 2 - c.left) + 'px'; t.style.top = (r.top - c.top) + 'px'; t.style.opacity = 1; };
    el.onmouseleave = () => $('tip').style.opacity = 0; });
}
const curReq = () => S.reqs.find(x => x.id === S.reqSel) || S.draft;
function go(v, opt = {}){ Object.assign(S, opt); S.view = v; $('chat').classList.remove('open'); render(); scrollTo(0, 0); }

/* 첨부 */
let pending = [], pickFor = '';
function showPending(){ const p = $('pend'); if (p) p.innerHTML = pending.map((f, i) => `<span class="chip">${esc(f)}<button data-unpend="${i}">×</button></span>`).join(''); }
$('filePick').onchange = e => { const fs = [...e.target.files].map(f => f.name); e.target.value = '';
  if (pickFor === 'pol') return upPol(fs.map(n => ({name:n})));
  pending.push(...fs); showPending(); $('cmSend')?.classList.add('on'); };
function upPol(files){
  [...files].forEach(f => { if (!/\.(docx|xlsx|xlsb)$/i.test(f.name)) return toast(`${f.name} · Word, Excel 파일만 등록할 수 있어요`); S.policy.uploads.unshift({n:f.name, s:'방금 등록 · 정책 내용 추출 대기'}); });
  render(); toast('정책 파일을 등록했어요. 추출이 끝나면 적용 정책으로 고를 수 있어요');
}
function sendMsg(){
  const r = S.reqs.find(x => x.id === S.appSel), t = $('cm').value.trim(); if (!r || r.status === 'done' || (!t && !pending.length)) return;
  const who = S.role === 'pay' ? 'pay' : 'aud';
  (S.threads[r.id] ||= []).push({who, t, at:stamp(), files:[...pending]}); pending = []; S.cmpOpen = false;
  if (who === 'pay' && r.status === 'sent') r.status = 'replied';
  if (who === 'aud' && r.status === 'replied' && !r.ids.every(id => S.finals[id])) { /* 추가 요청이면 회신 대기로 되돌림 */ r.status = 'sent'; S.threads[r.id].push({who:'sys', t:'추가 소명을 요청했어요 · 회신 대기로 돌아갔어요', at:stamp()}); }
  S.mbox = mbFolder(r, who === 'pay');
  render(); toast(who === 'pay' ? '소명 회신 메일을 보냈어요' : '메일을 보냈어요');
}

/* ───────── 클릭 한 곳에서 처리 */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-go],[data-act],[data-fk],[data-fst],[data-sort],[data-pg],[data-sel],[data-j],[data-req],[data-rm],[data-app],[data-fin],[data-cf],[data-cs],[data-dc],[data-cc],[data-lt],[data-apply],[data-unpend],[data-mb]');
  if (!t) return;
  const d = t.dataset;
  if (d.lt){ const [k, v] = d.lt.split(':'); S.lt[k] = v;
    const L = (k === 'an' ? S.reqs.filter(x => x.status !== 'draft') : S.reqs).filter(x => (v === 'done') === (x.status === 'done'));
    if (k === 'an') { S.appSel = L[0]?.id || null; pending = []; } else if (!S.draft) S.reqSel = L[0]?.id || null;
    return render(); }
  if (d.go){
    if (d.go === 'start') return location.href = 'start.html';
    const opt = {}; if (d.k != null){ opt.f = {...S.f, k:d.k, agent:''}; opt.page = 1; } if (d.st){ opt.f = {...(opt.f || S.f), st:d.st}; opt.page = 1; }
    if (d.go === 'answer' && S.view !== 'answer'){ opt.appSel = S.reqSel || S.appSel; const q = S.reqs.find(x => x.id === opt.appSel); if (q) opt.mbox = mbFolder(q, S.role === 'pay'); }
    return go(d.go, opt);
  }
  if (d.fk != null){ S.f.k = d.fk; S.page = 1; return render(); }
  if (d.fst != null){ S.f.st = d.fst; S.page = 1; return render(); }
  if (d.sort){ S.sort = [d.sort, S.sort[0] === d.sort ? -S.sort[1] : -1]; return render(); }
  if (d.pg){ S.page += +d.pg; return render(); }
  if (d.sel){ S.sel = S.sel === d.sel ? null : d.sel; return render(); }
  if (d.j){ (S.review[S.sel] ||= {}).j = d.j; render(); return toast(`판단을 '${JNAME[d.j]}'(으)로 바꿨어요`); }
  if (d.req){ readForm(curReq() || {}); S.reqSel = d.req; S.draft = null; return render(); }
  if (d.rm){ const r = curReq(); readForm(r); r.ids = r.ids.filter(x => x !== d.rm); return render(); }
  if (d.app){ S.appSel = d.app; pending = []; S.cmpOpen = false; return render(); }
  if (d.mb){ S.mbox = d.mb; S.appSel = null; S.cmpOpen = false; pending = []; return render(); }
  if (d.fin){ const f = S.finals[d.fin] ||= {}; f.v = d.v; f.at = stamp();
    render(); return toast(`'${BYID[d.fin].title}' 건을 ${d.v === 'ok' ? '정상' : '오지급'}으로 판단했어요`); }
  if (d.cf != null){ S.cmtF = d.cf; S.cmtSel = null; return render(); }
  if (d.cs){ S.cmtSel = d.cs; return render(); }
  if (d.dc != null){ S.dcmt = +d.dc; document.querySelectorAll('.crow').forEach(r => r.classList.toggle('on', r.dataset.dc === d.dc)); const cc = $('cchart'); if (cc){ cc.innerHTML = chartCard(curOf(KINDS3[S.dcmt])); drawCharts(); } return; }
  if (d.cc != null){ const k = KINDS3[S.dcmt || 0], c = curOf(k); return go('cmt', {cmtF:k, cmtSel:c.id}); }
  if (d.apply){ const [cs, id] = d.apply.split(':'); S.policy.applied[cs] = id; S.policy.confirmed = false; return render(); }
  if (d.unpend != null){ pending.splice(+d.unpend, 1); return showPending(); }
  const act = d.act;
  if (act === 'closeDet'){ S.sel = null; return render(); }
  if (act === 'draftBack'){ S.draft = null; return render(); }
  if (act === 'clrAgent'){ S.f.agent = ''; return render(); }
  if (act === 'excel') return excel();
  if (act === 'newReq'){ const r = mkReq([d.id], 'draft'); S.draft = r; S.reqSel = null; return go('appeal'); }
  if (act === 'openReq'){ return go('appeal', {reqSel:d.id, draft:null}); }
  if (act === 'saveReq'){ const r = curReq(); readForm(r); if (r === S.draft){ S.reqs.unshift(r); S.reqSel = r.id; S.draft = null; } else if (r.status !== 'draft'){ r.edited = true; (S.threads[r.id] ||= []).push({who:'sys', t:'감사인이 소명 요청서를 수정했어요', at:stamp()}); }
    render(); return toast('소명 요청서를 저장했어요'); }
  if (act === 'sendReq'){ const r = curReq(); readForm(r); if (r === S.draft){ S.reqs.unshift(r); S.draft = null; } S.reqSel = r.id;
    r.status = 'sent'; r.sentAt = stamp(); S.threads[r.id] = [{who:'sys', t:`소명 요청서가 발송되었어요 · 회신 기한 ${r.due}`, at:r.sentAt}, {who:'aud', t:r.body, at:r.sentAt}];
    render(); return toast(`${r.to} 지급 담당자에게 발송했어요. 소명 검토에서 회신을 확인하세요`); }
  if (act === 'delReq'){ S.reqs = S.reqs.filter(x => x.id !== S.reqSel); S.reqSel = null; render(); return toast('작성 중인 요청을 지웠어요'); }
  if (act === 'goThread'){ const q = S.reqs.find(x => x.id === S.reqSel); return go('answer', {appSel:S.reqSel, mbox:q ? mbFolder(q, S.role === 'pay') : 'in'}); }
  if (act === 'reply'){ S.cmpOpen = true; return render(); }
  if (act === 'cancelReply'){ S.cmpOpen = false; pending = []; return render(); }
  if (act === 'mtoggle'){ (S.mopen ||= {})[t.dataset.k] = !S.mopen[t.dataset.k]; return render(); }
  if (act === 'attach'){ pickFor = 'msg'; return $('filePick').click(); }
  if (act === 'pickPol'){ pickFor = 'pol'; return $('filePick').click(); }
  if (act === 'closeReq'){ const r = S.reqs.find(x => x.id === S.appSel); if (!r || !r.ids.every(id => S.finals[id]?.v)) return;
    r.status = 'done'; r.closedAt = stamp();
    S.history.unshift({month:'2026-02', at:r.closedAt, reqId:r.id, title:r.to, items:r.ids.map(id => ({agent:BYID[id].agentCode, item:BYID[id].title, v:S.finals[id].v, memo:S.finals[id].memo || ''}))});
    (S.threads[r.id] ||= []).push({who:'sys', t:'감사인이 이 소명을 종결했어요', at:r.closedAt}); S.mbox = 'done';
    render(); return toast(`${r.to} 소명을 종결했어요`); }
  if (act === 'confirmPol'){ S.policy.confirmed = true; render(); return toast('적용 정책을 확인했어요'); }
  if (act === 'runCmp'){ S.pcmp.run = true; render(); return toast('바뀐 규칙을 추출했어요'); }
  if (act === 'agentList'){ return go('review', {f:{k:'', st:'', q:'', agent:d.code}, page:1, sel:null}); }
});

/* ───────── 역할 · 세션 · 사이드바 */
$('role').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.role = b.dataset.r; [...$('role').children].forEach(x => x.classList.toggle('on', x === b));
  $('av').textContent = S.role === 'pay' ? '담' : '김'; $('av').title = S.role === 'pay' ? '지급 담당자' : '김브밴 · 감사인'; S.view = NAV[S.role][0][0][0]; render(); };
[...$('role').children].forEach(x => x.classList.toggle('on', x.dataset.r === S.role));
$('av').textContent = S.role === 'pay' ? '담' : '김'; $('av').title = S.role === 'pay' ? '지급 담당자' : '김브밴 · 감사인';
const sb = $('sb'); sb.addEventListener('mouseenter', () => sb.classList.add('open')); sb.addEventListener('mouseleave', () => sb.classList.remove('open'));
/* 세션: 로그인한 때부터 1시간. 연장하면 다시 1시간, 끝나면 로그인 화면으로 */
const AUTH = (() => { try { return JSON.parse(sessionStorage.getItem('bright-auth') || 'null') || {at:Date.now()}; } catch (e) { return {at:Date.now()}; } })();
const fmt = s => `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
const leftSec = () => Math.max(0, 3600 - Math.floor((Date.now() - AUTH.at) / 1000));
const logout = () => { try { sessionStorage.removeItem('bright-auth'); } catch (e) {} location.href = 'login.html'; };
$('tm').textContent = fmt(leftSec());
setInterval(() => { const l = leftSec(); $('tm').textContent = fmt(l); if (!l) logout(); }, 1000);
$('ext').onclick = () => { AUTH.at = Date.now(); try { sessionStorage.setItem('bright-auth', JSON.stringify(AUTH)); } catch (e) {} $('tm').textContent = fmt(leftSec()); toast('로그인을 1시간 연장했어요'); };
$('logout').onclick = e => { e.preventDefault(); logout(); };

/* ───────── 도우미: 정책 변경 이력 · 판매점/정책별 조회 · 사용 안내 */
const chat = $('chat'), q = $('q'), send = $('send');
function openBot(ask){ chat.classList.add('open'); if (!$('msgs').children.length) greet(); if (ask) setTimeout(() => answer(ask), 200); else setTimeout(() => q.focus(), 200); }
function greet(){ bubble('안녕하세요, B:RIGHT 도우미예요. 정책 변경 이력, 판매점·정책별 조회, 감사 진행 방법을 물어보세요.', 'b');
  $('sugg').innerHTML = ['태산네트웍스 어때?', '퀄리티 비중 규칙 알려줘', '소명 요청은 어떻게 해?', '감사 순서 알려줘'].map(s => `<button>${s}</button>`).join(''); }
$('sugg').onclick = e => { const b = e.target.closest('button'); if (b) answer(b.textContent); };
$('botbtn').onclick = () => chat.classList.contains('open') ? chat.classList.remove('open') : openBot();
$('close').onclick = () => chat.classList.remove('open');
addEventListener('keydown', e => { if (e.key === 'Escape') chat.classList.remove('open'); });
q.addEventListener('input', () => { send.classList.toggle('on', !!q.value.trim()); q.style.height = 'auto'; q.style.height = Math.min(q.scrollHeight, 120) + 'px'; });
q.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); ask(); } });
send.onclick = ask;
function bubble(t, who){ const d = document.createElement('div'); d.className = 'm ' + who; d.textContent = t; $('msgs').appendChild(d); $('msgs').scrollTop = 1e9; }
function ask(){ const t = q.value.trim(); if (!t) return; q.value = ''; q.style.height = '24px'; send.classList.remove('on'); answer(t); }
function answer(t){
  bubble(t, 'u'); document.querySelectorAll('.orb').forEach(o => o.classList.add('busy'));
  setTimeout(() => { bubble(reply(t), 'b'); document.querySelectorAll('.orb').forEach(o => o.classList.remove('busy')); }, 550);
}
function policyDiff(cs){
  const by = m => Object.fromEntries(D.rules.filter(r => r.case === cs && r.month === m).map(r => [r.key + '|' + r.name.replace(/\s*\(.*\)$/, ''), r]));
  const a = by('2026-01'), b = by('2026-02'), out = [];
  Object.keys(b).forEach(k => { if (!a[k]) out.push(`신규 · ${b[k].name}: ${b[k].amt}`); else if (a[k].amt !== b[k].amt || a[k].cond !== b[k].cond) out.push(`변경 · ${b[k].name}: ${a[k].amt} → ${b[k].amt}`); });
  Object.keys(a).forEach(k => { if (!b[k]) out.push(`삭제 · ${a[k].name}`); });
  return out;
}
function reply(t){
  const s = t.replace(/\s/g, '');
  if (/바뀐|변경|달라|이력|히스토리/.test(s)){
    const c1 = policyDiff('C1'), c2 = policyDiff('C2');
    return `1월 → 2월 정책 변경 이력이에요.\n\n[Case1 판매수수료] ${c1.length}건\n${c1.slice(0, 5).map(x => '· ' + x).join('\n') || '· 바뀐 규칙 없음'}${c1.length > 5 ? `\n· 외 ${c1.length - 5}건` : ''}\n\n[Case2 담당예비비] ${c2.length}건\n${c2.slice(0, 4).map(x => '· ' + x).join('\n') || '· 바뀐 규칙 없음'}${c2.length > 4 ? `\n· 외 ${c2.length - 4}건` : ''}\n\n금액은 정책 원문에서 추출한 값이에요.`;
  }
  const norm = x => x.replace(/\(주\)|㈜|주식회사|[()\s]|S\+$/g, '');
  const febA = M.agents.filter(a => a.month === '2026-02'), words = t.replace(/어때|알려줘|어떤가|판매점|\?|은|는/g, ' ').split(/\s+/).map(norm).filter(w => w.length >= 2);
  const ag = febA.filter(a => norm(a.name).length >= 2 && s.includes(norm(a.name))).sort((x, y) => norm(y.name).length - norm(x.name).length)[0]
    || febA.filter(a => words.some(w => norm(a.name).includes(w))).sort((x, y) => Math.abs(norm(x.name).length - words[0].length) - Math.abs(norm(y.name).length - words[0].length))[0];
  if (ag){
    const cs = CASES.filter(c => c.agentCode === ag.code), jan = M.agents.find(a => a.month === '2026-01' && a.code === ag.code);
    return `${ag.name} (${ag.type} · ${ag.hq} ${ag.branch})\n\n· 2월 지급 공급가 ${nf(ag.pay)}원, 초고속 ${ag.inet}건 · TV ${ag.tv}건\n· 초고속 1건당 ${man(ag.pay / Math.max(1, ag.inet))}${jan ? ` (1월 ${man(jan.pay / Math.max(1, jan.inet))})` : ''}\n· 2월 오지급 후보 ${cs.filter(c => c.res === '오지급').length}건 · 확인 필요 ${cs.filter(c => c.k === 'check').length}건\n\n근거 검토에서 이 판매점 건만 모아 볼 수 있어요.`;
  }
  const rule = D.rules.filter(r => r.month === '2026-02').find(r => s.includes(r.name.replace(/\s*\(.*\)$/, '').replace(/\s/g, '').slice(0, 5)) || s.includes(r.sec.replace(/\s/g, '').slice(0, 5)));
  if (rule || /규칙|정책별|조항/.test(s)){
    const rs = rule ? [rule] : D.rules.filter(r => r.month === '2026-02').slice(0, 4);
    return rs.map(r => `[${r.name}] ${DOCNAME(r.doc)}\n· 조건: ${r.cond}\n· 금액: ${r.amt}\n· 위치: ${r.sec}${r.st === '검토 필요' ? '\n· 추출 상태: 검토 필요' : ''}`).join('\n\n');
  }
  if (/순서|흐름|어떻게|도움|사용|방법|가이드/.test(s))
    return '감사는 이렇게 진행돼요.\n\n1. 첫 화면에서 정책 파일과 지급내역을 올리고, 정책 관리에서 적용 정책을 확인\n2. Agent가 정책과 지급내역을 비교해 오지급 후보와 현상 코멘트를 만듦\n3. 대시보드 → 근거 검토에서 건별 근거를 확인\n4. 상세 화면에서 "소명 요청 작성" → 소명 관리에서 발송\n5. 지급 담당자가 채팅으로 회신·증빙 제출\n6. 소명 검토에서 건별로 정상/오지급 판단\n7. 모두 판단하면 저장하고 종결 (판단은 다음 달에 다시 보여요)';
  if (/소명/.test(s)) return '근거 검토에서 건을 열고 상세 화면 아래 "소명 요청 작성"을 누르세요. 소명 관리에서 내용을 고치고 발송하면, 소명 검토에서 지급 담당자의 회신과 증빙을 볼 수 있어요.';
  return '이렇게 물어볼 수 있어요.\n· 1월에서 2월로 바뀐 정책 알려줘\n· (판매점 이름) 어때?\n· (항목 이름) 규칙 알려줘\n· 감사 순서 알려줘';
}

/* 시작 */
if (new URLSearchParams(location.search).has('from')) document.body.classList.add('intro');
render();
