import { join } from "path";
import fs from "fs";


export function generateMigrationCommon(scriptsDir: string, name: string, type: string) {
  if (name.length < 1) throw Error("name argument required")
  const timestamp = new Date().toISOString().replace(/\..+/, "").replace(/[^0-9]/g, "")
  const migrationPath = join(scriptsDir, `${timestamp}_${name}.sql`);

  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true });
  }

  const migrationScripts = `-- +migrator UP
-- +migrator statement BEGIN

-- +migrator statement END


-- +migrator DOWN
-- +migrator statement BEGIN

-- +migrator statement END
`
  fs.writeFileSync(migrationPath, migrationScripts);

  console.log(`✓ ${type} created: ${timestamp}_${name}.sql`);
}