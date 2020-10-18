import { compose, map, mapObjIndexed } from "https://x.nest.land/ramda@0.27.0/source/index.js";
import Either from "https://deno.land/x/functional@v1.0.0/library/Either.js";
import Task from "https://deno.land/x/functional@v1.0.0/library/Task.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import { readFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import { parseConfigurationFile, updateConfluenceContentFromLocalFile } from "./library/utilities.js";

// Configurations :: Object

// parseConfigurationFile :: String -> Task Configurations
const readAndParseConfigurationFile = compose(
  map(
    compose(
      parseConfigurationFile,
      file => new TextDecoder().decode(file.raw)
    )
  ),
  readFile,
  File.fromPath
);

if (import.meta.url === Deno.mainModule) {
  const [ confluenceContentID, filePath,, configurationFilePath ] = Deno.args;

  if (!!configurationFilePath) {
    console.debug("%cReading from the configuration file.", "color: lightblue");

    const task = compose(
      map(
        mapObjIndexed(
          (value, key) => Deno.env.set(`CONFLUENCE_${key.toUpperCase()}`, value)
        )
      ),
      readAndParseConfigurationFile
    )(`${Deno.cwd()}/${configurationFilePath}`);

    const container = await task.run();

    if (Either.Left.is(container)) {
      throw new Error(`Could not read the configurations because of an error: ${container[Symbol.for("Value")]}`);
    }
  }

  if (!Deno.env.get("CONFLUENCE_DOMAIN")) {
    throw new Error("Could not determine the Confluence domain. `export CONFLUENCE_DOMAIN={}`")
  }

  if (!Deno.env.get("CONFLUENCE_TOKEN")) {
    throw new Error("Could not determine the Confluence API token. `export CONFLUENCE_TOKEN={}`")
  }

  if (!Deno.env.get("CONFLUENCE_USERNAME")) {
    throw new Error("Could not determine the Confluence username. `export CONFLUENCE_USERNAME={}`")
  }

  const task = updateConfluenceContentFromLocalFile({
    APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
    domain: Deno.env.get("CONFLUENCE_DOMAIN"),
    username: Deno.env.get("CONFLUENCE_USERNAME")
  })
    (confluenceContentID, `${Deno.cwd()}/${filePath}`);

  const containerA = (await task.run());

  // Note: Fix nested Task
  if (Task.is(containerA.extract())) {
    const containerB = await containerA.extract().run();

    if (Either.Left.is(containerB)) {
      throw new Error(`+ Could not publish the local files because of an error: ${containerB[Symbol.for("Value")]}`);
    }
  }

  // Need a better way to access the error...
  if (Either.Left.is(containerA)) {
    throw new Error(`Could not publish the local files because of an error: ${containerA[Symbol.for("Value")]}`);
  }

  console.debug("%cAll okay", "color: green");
}