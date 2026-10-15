// All widget styles, added to the document once (useWidgetStyles). Prefixed so they
// never collide with the host app; colours come from CSS variables set per instance.
export const css = `
.payitgo-overlay{--payitgo-bg:#110e22;--payitgo-card:#17132d;--payitgo-border:#2a2545;--payitgo-text:#f3f1ff;--payitgo-muted:#a09cba;
  --payitgo-accent-2:color-mix(in srgb,var(--payitgo-accent) 55%,#fff);--payitgo-tint:color-mix(in srgb,var(--payitgo-accent) 16%,transparent);
  --payitgo-warn-bg:rgba(245,158,11,.1);--payitgo-warn-border:rgba(245,158,11,.3);--payitgo-warn-text:#fbbf24;
  position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;
  background:rgba(4,3,10,.62);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:payitgo-fade .18s ease-out;
  font-family:var(--payitgo-font,var(--font-inter,Inter),ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);-webkit-font-smoothing:antialiased}
.payitgo-overlay.payitgo-light{--payitgo-bg:#ffffff;--payitgo-card:#f7f5ff;--payitgo-border:#e6e3f3;--payitgo-text:#0f0b1e;--payitgo-muted:#6b6880;
  --payitgo-accent-2:var(--payitgo-accent);--payitgo-tint:color-mix(in srgb,var(--payitgo-accent) 8%,transparent);
  --payitgo-warn-bg:#fffbeb;--payitgo-warn-border:#fde68a;--payitgo-warn-text:#92400e;background:rgba(15,11,30,.45)}
.payitgo-overlay *,.payitgo-overlay *::before,.payitgo-overlay *::after{box-sizing:border-box}
.payitgo-modal{position:relative;width:min(672px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:28px;border-radius:14px;
  background:var(--payitgo-bg);border:1px solid var(--payitgo-border);color:var(--payitgo-text);box-shadow:0 30px 80px rgba(0,0,0,.45);
  animation:payitgo-rise .22s ease-out;font-size:14px;line-height:1.45;text-align:left}
.payitgo-modal:focus{outline:none}
.payitgo-close{position:absolute;top:10px;right:10px;width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:8px;
  background:transparent;color:var(--payitgo-muted);cursor:pointer}
.payitgo-close:hover{background:var(--payitgo-card);color:var(--payitgo-text)}
.payitgo-header{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding-right:28px}
.payitgo-title{margin:0;font-size:20px;font-weight:700;letter-spacing:-.01em}
.payitgo-pill{font-size:13px;color:var(--payitgo-muted);background:var(--payitgo-card);border:1px solid var(--payitgo-border);border-radius:5px;padding:3px 8px}
.payitgo-badge{font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--payitgo-muted);
  background:var(--payitgo-card);border:1px solid var(--payitgo-border);border-radius:4px;padding:5px 6px}
.payitgo-subtitle{margin:10px 0 0;color:var(--payitgo-muted)}
.payitgo-amount-card{margin-top:22px;display:flex;justify-content:space-between;gap:16px;padding:16px;border-radius:10px;
  background:var(--payitgo-card);border:1px solid var(--payitgo-border)}
.payitgo-label{font-size:11px;font-weight:500;letter-spacing:.05em;text-transform:uppercase;color:var(--payitgo-muted)}
.payitgo-amount{margin:2px 0 0;font-size:28px;font-weight:700;letter-spacing:-.02em}
.payitgo-muted{color:var(--payitgo-muted)}
.payitgo-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;font-size:12.5px;text-align:right}
.payitgo-due{font-size:12px;font-weight:500;color:var(--payitgo-accent-2);background:var(--payitgo-tint);border-radius:5px;padding:3px 8px}
.payitgo-meta-row{color:var(--payitgo-muted)}
.payitgo-meta-row strong{color:var(--payitgo-text);font-weight:600;margin-left:2px}
.payitgo-section-label{margin:24px 0 10px;font-weight:500}
.payitgo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;max-height:40vh;overflow:auto}
.payitgo-option{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px 11px 12px;border-radius:8px;cursor:pointer;text-align:left;
  font:inherit;color:inherit;background:var(--payitgo-card);border:1px solid var(--payitgo-border);transition:border-color .15s,background .15s}
.payitgo-option:hover{border-color:color-mix(in srgb,var(--payitgo-accent) 45%,var(--payitgo-border))}
.payitgo-option[aria-checked="true"]{border-color:var(--payitgo-accent);box-shadow:inset 0 0 0 1px var(--payitgo-accent);
  background:linear-gradient(90deg,var(--payitgo-tint),transparent 85%),var(--payitgo-card)}
.payitgo-option-name{display:block;font-weight:600}
.payitgo-option-sub{display:block;font-size:12px;color:var(--payitgo-muted)}
.payitgo-check{margin-left:auto;color:var(--payitgo-accent-2);flex:none}
.payitgo-coin{position:relative;flex:none;display:inline-grid;place-items:center;border-radius:50%;color:#fff;font-weight:700}
.payitgo-coin-badge{position:absolute;right:-3px;bottom:-3px;width:14px;height:14px;border-radius:50%;display:grid;place-items:center;
  font-size:8px;color:#fff;border:2px solid var(--payitgo-card)}
.payitgo-note{margin:12px 0 0;font-size:12px;line-height:1.4;color:var(--payitgo-muted)}
.payitgo-footer{display:flex;justify-content:flex-end;gap:14px;margin-top:22px}
.payitgo-btn{height:40px;padding:0 26px;border-radius:8px;font:500 14px/1 inherit;font-family:inherit;cursor:pointer;display:inline-flex;
  align-items:center;justify-content:center;gap:8px;transition:filter .15s,background .15s}
.payitgo-btn:disabled{opacity:.6;cursor:default}
.payitgo-btn-secondary{background:var(--payitgo-card);color:var(--payitgo-text);border:1px solid var(--payitgo-border)}
.payitgo-btn-secondary:hover{filter:brightness(1.15)}
.payitgo-btn-primary{background:var(--payitgo-accent);color:#fff;border:1px solid transparent;min-width:160px}
.payitgo-btn-primary:hover:not(:disabled){filter:brightness(1.1)}
a.payitgo-btn{text-decoration:none}
.payitgo-overlay :is(button,a):focus-visible{outline:2px solid var(--payitgo-accent-2);outline-offset:2px}
.payitgo-pay{display:grid;grid-template-columns:auto 1fr;gap:24px;margin-top:24px;align-items:start}
.payitgo-qr{background:#fff;padding:10px;border-radius:12px;line-height:0}
.payitgo-fields{display:flex;flex-direction:column;gap:14px;min-width:0}
.payitgo-field-box{display:flex;align-items:center;gap:8px;margin-top:6px;padding:9px 10px 9px 12px;border-radius:9px;
  background:var(--payitgo-card);border:1px solid var(--payitgo-border)}
.payitgo-field-value{flex:1;min-width:0;word-break:break-all;font:500 13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.payitgo-copy{flex:none;height:28px;padding:0 10px;border-radius:6px;font:500 12px/1 inherit;font-family:inherit;cursor:pointer;
  background:var(--payitgo-bg);color:var(--payitgo-text);border:1px solid var(--payitgo-border)}
.payitgo-timer{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;
  color:var(--payitgo-muted);background:var(--payitgo-card);border:1px solid var(--payitgo-border);border-radius:999px;padding:4px 10px}
.payitgo-timer.payitgo-urgent{color:var(--payitgo-warn-text);border-color:var(--payitgo-warn-border);background:var(--payitgo-warn-bg)}
.payitgo-warning{margin-top:18px;padding:12px 14px;border-radius:9px;font-size:12px;line-height:1.55;
  background:var(--payitgo-warn-bg);border:1px solid var(--payitgo-warn-border);color:var(--payitgo-warn-text)}
.payitgo-status{display:flex;flex-direction:column;align-items:center;text-align:center;padding:16px 0 4px}
.payitgo-status-icon{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--payitgo-tint);color:var(--payitgo-accent-2)}
.payitgo-status-icon.payitgo-success{background:rgba(16,185,129,.14);color:#10b981}
.payitgo-status h2{margin:16px 0 4px;font-size:20px;font-weight:700}
.payitgo-status p{margin:0;max-width:420px;color:var(--payitgo-muted)}
.payitgo-progress{margin-top:22px;height:8px;border-radius:99px;background:var(--payitgo-card);border:1px solid var(--payitgo-border);overflow:hidden}
.payitgo-progress>span{display:block;height:100%;background:var(--payitgo-accent);border-radius:99px;transition:width .4s ease}
.payitgo-row{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--payitgo-border)}
.payitgo-row:last-child{border-bottom:0}
.payitgo-summary{margin-top:22px;padding:4px 16px;border-radius:10px;background:var(--payitgo-card);border:1px solid var(--payitgo-border)}
.payitgo-test{margin:-6px 36px 16px 0;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:500;
  background:var(--payitgo-warn-bg);border:1px solid var(--payitgo-warn-border);color:var(--payitgo-warn-text)}
.payitgo-sim{margin:-6px 36px 16px 0;padding:10px 12px;border-radius:8px;font-size:12px;
  background:var(--payitgo-card);border:1px dashed var(--payitgo-warn-border)}
.payitgo-sim-head{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 12px;color:var(--payitgo-muted)}
.payitgo-sim-head strong{color:var(--payitgo-text);font-weight:600}
.payitgo-sim-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.payitgo-sim-btn{height:28px;padding:0 10px;border-radius:6px;font:500 12px/1 inherit;font-family:inherit;cursor:pointer;
  background:var(--payitgo-bg);color:var(--payitgo-text);border:1px solid var(--payitgo-border)}
.payitgo-sim-btn:hover:not(:disabled){border-color:var(--payitgo-accent)}
.payitgo-sim-btn:disabled{opacity:.5;cursor:default}
.payitgo-sim-note{margin-top:6px;color:var(--payitgo-muted)}
.payitgo-sim-error{color:#f43f5e;font-weight:600}
.payitgo-info{margin-top:12px;padding:12px 14px;border-radius:9px;font-size:13px;line-height:1.5;
  background:var(--payitgo-tint);border:1px solid color-mix(in srgb,var(--payitgo-accent) 40%,var(--payitgo-border))}
.payitgo-error{margin:12px 0 0;font-size:13px;font-weight:600;color:#f43f5e}
.payitgo-required{margin-left:8px;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:.06em;
  background:var(--payitgo-warn-bg);border:1px solid var(--payitgo-warn-border);color:var(--payitgo-warn-text)}
.payitgo-field-box.payitgo-field-required{border-color:var(--payitgo-warn-border);background:var(--payitgo-warn-bg)}
.payitgo-field-required .payitgo-field-value{font-size:16px;font-weight:700}
.payitgo-hint{margin-top:6px;font-size:12px;color:var(--payitgo-muted)}
.payitgo-hint-required{color:var(--payitgo-warn-text);font-weight:600}
.payitgo-link{display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:var(--payitgo-accent-2);text-decoration:none}
.payitgo-link:hover{text-decoration:underline}
.payitgo-deposits{margin-top:18px}
.payitgo-deposits ul{list-style:none;margin:6px 0 0;padding:0 14px;border-radius:9px;background:var(--payitgo-card);border:1px solid var(--payitgo-border)}
.payitgo-deposits li{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:4px 12px;padding:9px 0;border-bottom:1px solid var(--payitgo-border);font-size:13px;text-align:left}
.payitgo-deposits li:last-child{border-bottom:0}
.payitgo-tags{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}
.payitgo-tag{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;color:var(--payitgo-muted);background:var(--payitgo-bg);border:1px solid var(--payitgo-border)}
.payitgo-tag-pending{color:var(--payitgo-accent-2);background:var(--payitgo-tint)}
.payitgo-tag-confirmed{color:#10b981;background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3)}
.payitgo-tag-failed{color:#f43f5e;background:rgba(244,63,94,.1);border-color:rgba(244,63,94,.3)}
.payitgo-tag-warn{color:var(--payitgo-warn-text);background:var(--payitgo-warn-bg);border-color:var(--payitgo-warn-border)}
.payitgo-status-icon.payitgo-warn{background:var(--payitgo-warn-bg);color:var(--payitgo-warn-text)}
.payitgo-spin{animation:payitgo-spin 1s linear infinite}
.payitgo-powered{margin-top:18px;text-align:center;font-size:11.5px;color:var(--payitgo-muted)}
.payitgo-powered strong{color:var(--payitgo-text);font-weight:600}
@keyframes payitgo-fade{from{opacity:0}}
@keyframes payitgo-rise{from{opacity:0;transform:translateY(8px) scale(.985)}}
@keyframes payitgo-spin{to{transform:rotate(360deg)}}
@media (max-width:560px){
  .payitgo-sim{margin-right:0}
  .payitgo-overlay{align-items:flex-end;padding:0}
  .payitgo-modal{width:100%;max-height:92dvh;padding:24px 18px 20px;border-radius:18px 18px 0 0}
  .payitgo-amount-card{flex-direction:column}
  .payitgo-meta{align-items:flex-start;text-align:left}
  .payitgo-grid{grid-template-columns:1fr}
  .payitgo-footer .payitgo-btn{flex:1}
  .payitgo-pay{grid-template-columns:1fr;justify-items:center}
  .payitgo-fields{width:100%}
}
@media (prefers-reduced-motion:reduce){.payitgo-overlay,.payitgo-modal{animation:none}.payitgo-spin{animation-duration:3s}}
`;
