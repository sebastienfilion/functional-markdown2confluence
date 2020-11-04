import { compose, map } from "https://x.nest.land/ramda@0.27.0/source/index.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import { readFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import { handleCommand } from "./library/commands.js";
import { parseConfigurationFile, safeExtract } from "./library/utilities.js";

if (import.meta.url === Deno.mainModule) {
  const containerA = handleCommand(Deno.args);

  const containerB = await containerA.run();

  console.log(containerB);

  safeExtract("Failed to run the command.", containerB);

  console.debug("%cAll okay", "color: green");
}