import {
  chain,
  compose,
  cond,
  converge,
  curry,
  equals,
  head,
  ifElse,
  isNil,
  map,
  mergeRight,
  prop
} from "https://x.nest.land/ramda@0.27.0/source/index.js";

import Task from "https://deno.land/x/functional@v1.0.0/library/Task.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import { readFile, writeFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import {
  collectFiles,
  injectOptions,
  insideOut,
  log,
  mergeDocumentationBlocks,
  negotiateConfluenceContentsFromLocalFiles,
  parseConfigurationFile,
  resolveConfluenceContentFromConfluenceContent,
  resolveConfluenceContentFromFile
} from "./utilities.js";
import { createConfluenceContent, updateConfluenceContent } from "./confluence.js";

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

export const handleCommand = cond([
  [
    compose(equals('collect'), head),
    ([ , targetFilePath, ...sourceFilePathList ]) => handleCollectCommand({}, targetFilePath, sourceFilePathList)
  ],
  [
    compose(equals('publish'), head),
    injectOptions(
      readAndParseConfigurationFile,
      curry(
        ([ , ...sourceFilePathList ], configurations) =>
          handlePublishCommand(
            mergeRight(
              {
                APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
                domain: Deno.env.get("CONFLUENCE_DOMAIN"),
                space: Deno.env.get("CONFLUENCE_SPACE"),
                username: Deno.env.get("CONFLUENCE_USERNAME")
              },
              configurations
            )
          )(sourceFilePathList)
      )
    )
  ],
  [
    _ => true,
    ([ command ]) => {
      throw new Error(`The command ${command} is unknown.`);
    }
  ]
]);

export const handleCollectCommand = curry(
  (options, targetFilePath, sourceFilePathList) => compose(
    chain(writeFile({})),
    map(mergeDocumentationBlocks(`${Deno.cwd()}/${targetFilePath}`)),
    collectFiles,
    map(path => `${Deno.cwd()}/${path}`)
  )(sourceFilePathList)
);

export const handlePublishCommand = curry(
  (options, sourceFilePathList) => compose(
    chain(
      compose(
        insideOut(Task),
        map(
          ifElse(
            compose(isNil, prop('ID')),
            createConfluenceContent(options),
            updateConfluenceContent(options)
          )
        )
      )
    ),
    chain(
      // File[] -> Task ConfluenceContent[]
      negotiateConfluenceContentsFromLocalFiles(
        options,
        resolveConfluenceContentFromFile,
        resolveConfluenceContentFromConfluenceContent
      )
    ),
    // String[] -> Task File[]
    collectFiles,
    map(path => `${Deno.cwd()}/${path}`)
  )(sourceFilePathList)
);
