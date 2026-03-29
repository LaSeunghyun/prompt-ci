/**
 * Simple line-based progress display using in-place updates.
 */

export function createProgress(total: number): {
  update(current: number): void;
  done(): void;
} {
  return {
    update(current: number): void {
      process.stdout.write(`\rRunning... [${current}/${total}]`);
    },
    done(): void {
      process.stdout.write('\n');
    },
  };
}
