import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const editorSource = readFileSync(
  resolve(currentDir, "../../../components/admin/group/GroupModelsListEditor.vue"),
  "utf8",
);

describe("groups models list layout", () => {
  it("keeps the toolbar outside of the scrolling list content", () => {
    expect(editorSource).toContain('class="group-models-list__workspace"');
    expect(editorSource.indexOf('class="group-models-list__toolbar"')).toBeLessThan(
      editorSource.indexOf('class="group-models-list__rows"'),
    );
    expect(editorSource).toContain(
      ".group-models-list__rows{max-height:256px;overflow:auto}",
    );
    expect(editorSource).not.toContain("position:sticky");
  });
});
