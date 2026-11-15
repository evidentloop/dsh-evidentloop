import type { Range } from "../types.js";
export interface Git {
  root: string;
  run(args: string[]): Buffer;
}
export function createGit(root: string): Git;
export function rangeOf(git: Git, target?: string): Range;
export function branchLabelOf(git: Git, ref: string): string;
