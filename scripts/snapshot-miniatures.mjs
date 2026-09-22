/**
 * Storyboard miniatures for the chooser cards — plans/04-os-chooser.md "Visual target" (`CHOOSE-CARD-01`).
 * Until an OS's real home exists (its route still renders the preview stub), its card shows the owner's storyboard
 * miniature of that home (plans/visual-targets/storyboard.html `.snap`), rendered full-page here and encoded by
 * capture-snapshots.mjs exactly like a live capture. The landscape markup and CSS are the frame's, verbatim; the
 * frame sizes the miniature at 1 em = 10 % of its width, so `html { font-size: 10vw }` reproduces it at any size.
 * Portrait versions (phones) keep the same wallpapers, pieces and proportions, stacked the way each OS's phone layout
 * stacks them, with the identity in the middle band a phone card crops to.
 */

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{font-size:10vw}
html,body{width:100%;height:100%;overflow:hidden}
.snap{position:absolute;inset:0;overflow:hidden}
.snap i,.snap span{position:absolute;display:block}
.sn-ios{background:linear-gradient(160deg,#2a1d63,#6c3aa3 50%,#e27a86)}
.sn-mac{background:linear-gradient(150deg,#1f4f7a,#3f78a8 40%,#e3a873)}
.sn-win{background:radial-gradient(70% 90% at 50% 110%,#7fc0ff,#2f6fe0 40%,#0b1f5c 80%)}
.sn-and{background:linear-gradient(165deg,#0d3a30,#1f6a57 50%,#9ad7b9)}
.sn-lnx{background:#0c1016}
.snap .mw{left:7%;top:16%;width:24%;height:44%;border-radius:.35em;background:rgb(255 255 255 / .85)}
.snap .mg{right:7%;top:18%;width:56%;display:grid;grid-template-columns:repeat(4,1fr);gap:.35em}
.snap .mg b{display:block;aspect-ratio:1;border-radius:24%;background:rgb(255 255 255 / .85)}
.snap .mg.circ{left:50%;right:auto;transform:translateX(-50%);top:38%;width:48%}.snap .mg.circ b{border-radius:50%}
.snap .md{left:33%;width:34%;bottom:7%;height:12%;border-radius:99em;background:rgb(255 255 255 / .38)}
.snap .mb{left:0;right:0;top:0;height:7%;background:rgb(255 255 255 / .6)}
.snap .mwin{border-radius:.3em;background:rgb(255 255 255 / .92);box-shadow:0 .2em .5em rgb(0 0 0 / .3)}.snap .mwin.sq{border-radius:.15em}
.snap .mt{left:0;right:0;bottom:0;height:11%;background:rgb(236 242 250 / .85)}.snap .mt.tbl{background:#e3f1e9}
.snap .ms{left:30%;right:30%;top:9%;height:10%;border-radius:99em;background:#e7f3ec}
.snap .ml{left:8%;right:8%;top:14%;display:flex;flex-direction:column;gap:.45em}.snap .ml i{position:static;height:.32em;border-radius:1em;background:#77849a}.snap .ml i.g{background:#7ee6a5}
/* portrait: the same pieces, placed for a phone-shaped page */
.pt .mw{left:8%;top:16%;width:84%;height:13%}
.pt .mg{left:8%;right:auto;top:34%;width:84%;row-gap:.6em}
.pt .mg.circ{left:50%;top:40%;width:80%}
.pt .md{left:8%;width:84%;bottom:3%;height:6.5%;border-radius:.9em}
.pt .mb{height:3.2%}
.pt .mt{height:6%}
.pt .ms{left:8%;right:8%;top:7%;height:4.5%}
.pt .ml{top:8%;gap:.5em}
`;

const b = (n) => '<b></b>'.repeat(n);
const lines = (widths) =>
  widths.map(([w, green]) => `<i${green ? ' class="g"' : ''} style="width:${w}%"></i>`).join('');

/** The frame's five miniatures (plans/visual-targets/storyboard.html, `#chooser`). */
const LANDSCAPE = {
  ios: `<div class="snap sn-ios"><i class="mw"></i><span class="mg">${b(6)}</span><i class="md"></i></div>`,
  macos: `<div class="snap sn-mac"><i class="mb"></i><i class="mwin" style="left:14%;top:22%;width:48%;height:46%"></i><i class="mwin" style="left:34%;top:34%;width:44%;height:40%"></i><i class="md"></i></div>`,
  windows: `<div class="snap sn-win"><i class="mwin sq" style="left:4%;top:6%;width:45%;height:76%"></i><i class="mwin sq" style="left:51%;top:6%;width:45%;height:76%"></i><i class="mt"></i></div>`,
  android: `<div class="snap sn-and"><i class="ms"></i><span class="mg circ">${b(4)}</span><i class="mt tbl"></i></div>`,
  linux: `<div class="snap sn-lnx"><span class="ml">${lines([[62], [40], [52, true], [70], [30, true]])}</span></div>`,
};

const PORTRAIT = {
  ios: `<div class="snap sn-ios pt"><i class="mw"></i><span class="mg">${b(12)}</span><i class="md"></i></div>`,
  macos: `<div class="snap sn-mac pt"><i class="mb"></i><i class="mwin" style="left:6%;top:30%;width:70%;height:24%"></i><i class="mwin" style="left:24%;top:42%;width:70%;height:24%"></i><i class="md"></i></div>`,
  windows: `<div class="snap sn-win pt"><i class="mwin sq" style="left:5%;top:3%;width:90%;height:44%"></i><i class="mwin sq" style="left:5%;top:49%;width:90%;height:43%"></i><i class="mt"></i></div>`,
  android: `<div class="snap sn-and pt"><i class="ms"></i><span class="mg circ">${b(8)}</span><i class="mt tbl"></i></div>`,
  linux: `<div class="snap sn-lnx pt"><span class="ml">${lines([
    [62],
    [40],
    [52, true],
    [70],
    [30, true],
    [58],
    [44],
    [66, true],
    [36],
    [72],
    [48, true],
    [60],
    [34],
    [54, true],
    [68],
    [42],
    [26, true],
  ])}</span></div>`,
};

/** A complete HTML document drawing `os`'s miniature to fill the viewport. */
export function miniatureHtml(os, orientation) {
  const body = (orientation === 'portrait' ? PORTRAIT : LANDSCAPE)[os];
  if (!body) throw new Error(`no miniature for ${os} ${orientation}`);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}
