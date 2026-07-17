import * as fs from "fs";
import * as path from "path";

function search(dir: string) {
  try {
    const list = fs.readdirSync(dir);
    for (const f of list) {
       const p = path.join(dir, f);
       let stat;
       try {
         stat = fs.statSync(p);
       } catch {
         continue;
       }
       if (f === "package.json") {
         console.log("package.json in:", p);
       }
       if (stat.isDirectory()) {
         if (!["proc", "sys", "dev", "lib", "lib32", "lib64", "run", "usr", "etc", "var", "node_modules"].includes(f)) {
           search(p);
         }
       }
    }
  } catch (err) {
    // Ignore direct access restrictions or reading errors
  }
}

search("/");
console.log("Done searching.");
