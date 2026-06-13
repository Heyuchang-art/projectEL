import path from "path";
import { compileWorkflowToSkill } from "../backend/src/compiler.js";

const skillId = process.argv[2];
if (!skillId) {
  console.error("Usage: npx tsx scripts/compile-skill.ts <skillId>");
  process.exit(1);
}

const workspaceCwd = process.cwd();
const jsonPath = path.join(workspaceCwd, "skills", skillId, "workflow.json");
const outputPath = path.join(workspaceCwd, ".pi", "skills", skillId, "SKILL.md");

console.log(`Compiling skill "${skillId}"...`);
console.log(`Source: ${jsonPath}`);
console.log(`Destination: ${outputPath}`);

compileWorkflowToSkill(jsonPath, outputPath)
  .then(() => {
    console.log("✨ Compilation successful!");
  })
  .catch((err) => {
    console.error("❌ Compilation failed:", err);
    process.exit(1);
  });
