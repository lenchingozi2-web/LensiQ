/** Data packets can beat browser audio jitter buffering by a fraction of a second. */
export class SpokenCueQueue {
  private pending = new Set<ReturnType<typeof setTimeout>>();
  private leadCompensationMs: number;
  constructor(leadCompensationMs = 180) { this.leadCompensationMs = leadCompensationMs; }
  schedule(apply: () => void) {
    const timer = setTimeout(() => { this.pending.delete(timer); apply(); }, this.leadCompensationMs);
    this.pending.add(timer);
  }
  clear() { for (const timer of this.pending) clearTimeout(timer); this.pending.clear(); }
}
