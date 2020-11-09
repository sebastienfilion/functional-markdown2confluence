import {
  ap,
  chain,
  complement,
  compose,
  cond,
  curry,
  equals,
  filter,
  head,
  match,
  map,
  mergeRight,
  prop,
  test,
  zipWith
} from "https://x.nest.land/ramda@0.27.0/source/index.js";

import Task from "https://deno.land/x/functional@v1.0.0/library/Task.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import { readFile, writeFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import {
  collectFiles,
  decodeRaw,
  encodeText,
  injectOptions,
  insideOut,
  log,
  mergeDocumentationBlocks,
  negotiateConfluenceContentsFromLocalFiles,
  parseConfigurationFile,
  prepareContentForPublication,
  resolveConfluenceContentFromConfluenceContent,
  resolveConfluenceContentFromFile, resolveTitleFromFile,
  resolveTitleFromFileName,
  mapBuffer, resolveConfluenceContentIDFromFile
} from "./utilities.js";
import { ConfluenceContent, createConfluenceContent, updateConfluenceContent } from "./confluence.js";

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
    compose(equals('prepare'), head),
    injectOptions(
      readAndParseConfigurationFile,
      curry(
        ([ , ...sourceFilePathList ], configurations) =>
          handlePrepareCommand(
            mergeRight(
              {
                APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
                domain: Deno.env.get("CONFLUENCE_DOMAIN"),
                space: Deno.env.get("CONFLUENCE_SPACE"),
                username: Deno.env.get("CONFLUENCE_USERNAME")
              },
              configurations
            ),
            sourceFilePathList
          )
      )
    )
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
            ),
            sourceFilePathList
          )
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

// annotateLocalFiles :: File[] -> ConfluenceContent[] -> Task File[]
export const annotateLocalFiles = curry(
  (fileList, confluenceContentList) =>
    compose(
      insideOut(Task),
      zipWith(
        (file, confluenceContent) =>
          compose(
            map(_ => confluenceContent),
            writeFile({}),
            mapBuffer(text => `${text}\n\n[//]: <> (${confluenceContent.ID})\n`)
          )(file),

      )
    )(fileList, confluenceContentList)
);

export const handlePrepareCommand = curry(
  (options, sourceFilePathList) => compose(
    chain(
      compose(
        // File[] -> ConfluenceContent[] -> Task File[]
        ap(
          curry((fileList, task) => task.chain(annotateLocalFiles(fileList))),
          // File[] -> Task ConfluenceContent[]
          compose(
            insideOut(Task),
            map(
              compose(
                createConfluenceContent(options),
                file => {
                  const title = resolveTitleFromFile(file);

                  return ConfluenceContent(
                    null,
                    encodeText("This file has been created automatically."),
                    { space: options.space, status: 'draft', title, type: 'page' }
                  );
                }
              )
            )
          )
        ),
        // File[] -> File[]
        filter(
          compose(
            complement(test(/\[\/\/\]\:\s*\<\>\s*\((.+)\)/)),
            file => decodeRaw(file.raw)
          )
        )
      )
    ),
    // String[] -> Task File[]
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
          compose(
            chain(updateConfluenceContent(options)),
            ap(
              resolveConfluenceContentFromConfluenceContent(options),
              compose(prop(1), match(/\[\/\/\]\:\s*\<\>\s*\((.+)\)/), decodeRaw, prop('raw'))
            )
          )
        ),
      )
    ),
    // String[] -> Task File[]
    collectFiles,
    map(path => `${Deno.cwd()}/${path}`)
  )(sourceFilePathList)
);
