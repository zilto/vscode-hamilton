import * as path from "path";

export function pathToPosix(anyPath: string): string {
  return anyPath.split(path.sep).join(path.posix.sep);
}
