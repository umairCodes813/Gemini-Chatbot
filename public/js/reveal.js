// Smooths streamed text. The network may deliver text in bursts or after pauses;
// this reveals it at an even pace so the reply never jumps, whether it takes 1s or 10s.
export function createReveal({
  onRender,
  raf = (fn) => requestAnimationFrame(fn),
  caf = (id) => cancelAnimationFrame(id),
  now = () => performance.now(),
}) {
  const FRAME_MS = 32; // render about 30 times per second
  let target = "";
  let shown = 0;
  let frameId = 0;
  let finished = false;
  let lastPaint = -Infinity;
  let settle = null;

  const schedule = () => {
    if (!frameId) frameId = raf(tick);
  };

  function resolveWaiter() {
    if (settle) {
      settle();
      settle = null;
    }
  }

  function tick() {
    frameId = 0;
    const t = now();
    if (t - lastPaint < FRAME_MS) {
      schedule();
      return;
    }
    lastPaint = t;

    const backlog = target.length - shown;
    if (backlog > 0) {
      // Reveal a share of what is waiting: big backlogs drain fast, small ones stay natural.
      const share = Math.ceil(backlog * (finished ? 0.2 : 0.12));
      const step = Math.min(Math.max(share, 3), finished ? 120 : 60);
      shown = Math.min(target.length, shown + step);
      const last = target.charCodeAt(shown - 1);
      if (last >= 0xd800 && last <= 0xdbff && shown < target.length) shown += 1; // keep emoji whole
      onRender(target.slice(0, shown));
    }

    if (shown < target.length) schedule();
    else if (finished) resolveWaiter();
  }

  return {
    push(text) {
      target += text;
      schedule();
    },
    // Resolves once everything received has been shown.
    finish() {
      finished = true;
      if (shown >= target.length) return Promise.resolve();
      return new Promise((resolve) => {
        settle = resolve;
        schedule();
      });
    },
    // Show everything received so far immediately (used by Stop).
    flush() {
      if (frameId) caf(frameId);
      frameId = 0;
      if (shown < target.length) {
        shown = target.length;
        onRender(target);
      }
      resolveWaiter();
    },
    // Drop everything without rendering (used when a turn is undone).
    cancel() {
      if (frameId) caf(frameId);
      frameId = 0;
      resolveWaiter();
    },
  };
}
