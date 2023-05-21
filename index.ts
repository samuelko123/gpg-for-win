import os from "os";
import path from "path";
import { GpgProcess } from "./gpg";
import child_process from "child_process";
import util from "util";

const exec = util.promisify(child_process.exec);

async function main() {
  const tmpDir = path.join(os.tmpdir(), Date.now().toString());
  await exec(`mkdir "${tmpDir}"`);

  const gpg = new GpgProcess();
  // const gpg = new GpgProcess({ homeDir: tmpDir });
  const primaryKey = await gpg.createPrimaryKey("John Doe", "john_doe@gmail.com");
  const subKey = await gpg.createSubKey(primaryKey);
  console.log(await gpg.getPublicKeyBlock(subKey));
  await gpg.deleteSubKey(subKey);
  await gpg.deletePrimaryKey(primaryKey);
  console.log(await gpg.listPrivateKeys());
  console.log(await gpg.listPublicKeys());
}

main();
