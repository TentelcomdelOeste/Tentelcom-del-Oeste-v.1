import * as fs from "fs";
import * as path from "path";

function findImages(dir: string, collected: string[] = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === "node_modules" || file === ".git" || file === "dist" || file === ".next") continue;
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat.isDirectory()) {
        if (!["proc", "sys", "dev", "lib", "lib64", "run", "usr", "etc", "var"].some(p => filePath.startsWith("/" + p) || file === p)) {
          findImages(filePath, collected);
        }
      } else {
        const ext = path.extname(file).toLowerCase();
        if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
          collected.push(`${filePath} (${stat.size} bytes, Modified: ${new Date(stat.mtimeMs).toISOString()})`);
        }
      }
    }
  } catch (e) {
    // Silent catch for OS file access issues
  }
}

const collected: string[] = [];
findImages(".", collected);
console.log("All non-system images in current directory:");
collected.forEach(c => console.log(c));
