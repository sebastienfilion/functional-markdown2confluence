import {
  compose,
  curry,
  lift,
  map,
  prop,
  reduce,
  split,
  test,
  trim,
  useWith,
  when
} from "https://x.nest.land/ramda@0.27.0/source/index.js";

import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import { readFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import { ConfluenceContent, retrieveContentByID, updateContentByID } from "./confluence.js";

// parseConfigurationFile :: String -> Object
export const parseConfigurationFile = compose(
  reduce(
    (accumulator, [ key, value ]) =>
      (key != "" && value != "")
        ? ({ ...accumulator, [key]: value })
        : accumulator,
    {}
  ),
  map(
    compose(
      split(/\s*=\s*/),
      trim
    )
  ),
  split("\n")
);

// retrieveFileFromPath :: String -> Task File
const retrieveFileFromPath = compose(
  readFile,
  File.fromPath
);

// retrieveConfluenceContentFromID :: Options -> String -> Task ConfluenceContent
const retrieveConfluenceContentFromID = options => compose(
  retrieveContentByID(options),
  ConfluenceContent.fromID
);

// updateConfluenceFromBuffer :: Options -> ConfluenceContent -> Buffer -> Task ConfluenceContent
export const updateConfluenceFromBuffer = options => compose(
  updateContentByID(options),
  curry(
    // Discard the existing content
    (confluenceContent, buffer) => confluenceContent.map(_ => buffer.raw)
  )
);

// updateConfluenceContentFromLocalFile :: Options -> String -> String -> Task ConfluenceContent
export const updateConfluenceContentFromLocalFile = options => useWith(
  lift(updateConfluenceFromBuffer(options)),
  [
    retrieveConfluenceContentFromID(options),
    compose(
      map(
        when(
          compose(
            test(/\.md/),
            prop("path")
          ),
          map(_buffer => new TextEncoder().encode(Marked.parse(new TextDecoder().decode(_buffer)).content))
        )
      ),
      retrieveFileFromPath
    )
  ]
);