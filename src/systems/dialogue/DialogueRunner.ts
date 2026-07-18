export type DialogueLine = {
  speaker: string;
  portraitKey: string | null;
  text: string;
};

/** Pure dialogue state — advance / skip without Phaser. */
export class DialogueRunner {
  readonly lines: DialogueLine[];
  private index = 0;

  constructor(lines: DialogueLine[]) {
    this.lines = lines.slice();
  }

  get lineIndex(): number {
    return this.index;
  }

  get current(): DialogueLine | null {
    if (this.index < 0 || this.index >= this.lines.length) return null;
    return this.lines[this.index] ?? null;
  }

  get done(): boolean {
    return this.index >= this.lines.length;
  }

  /** Advance to next line. Returns the new current line, or null if finished. */
  advance(): DialogueLine | null {
    if (this.done) return null;
    this.index += 1;
    return this.current;
  }

  /** Jump past the end (skip remaining). */
  skip(): void {
    this.index = this.lines.length;
  }

  /** Reset to first line. */
  reset(): void {
    this.index = 0;
  }
}
