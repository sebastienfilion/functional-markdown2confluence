import { blue } from "https://deno.land/std@0.76.0/fmt/colors.ts";
import { walk } from "https://deno.land/std@0.76.0/fs/mod.ts";
import {
  ap,
  always,
  append,
  chain,
  complement,
  compose,
  converge,
  curry,
  either,
  equals,
  flip,
  gte,
  head,
  ifElse,
  isNil,
  join,
  last,
  length,
  lift,
  map,
  match,
  or,
  prop,
  reduce,
  replace,
  split,
  test,
  trim,
  useWith,
  when
} from "https://x.nest.land/ramda@0.27.0/source/index.js";

import { Marked } from "https://deno.land/x/markdown@v2.0.0/mod.ts";
import Either from "https://deno.land/x/functional@v1.0.0/library/Either.js";
import Buffer from "https://deno.land/x/functional_io@v0.4.2/library/Buffer.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import Task from "../../functional/library/Task.js";
import { readFile } from "https://deno.land/x/functional_io@v0.4.2/library/fs.js";

import {
  ConfluenceContent,
  createConfluenceContent,
  retrieveConfluenceContent,
  updateConfluenceContent
} from "./confluence.js";

export const insideOut = curry(
  (T, list) => list.reduce(
    (accumulator, x) => lift(append)(x, accumulator),
    T.of([])
  )
);

// stream :: ((a, b) -> a) -> a -> AsyncIterable b -> a
export const stream = curry(
  async (binaryFunction, accumulator, iterator) => {
    for await (const data of iterator) {
      const value = binaryFunction(accumulator, data);
      if (value && !Either.Left.is(value)) accumulator = [ ...accumulator, value ];
    }

    return accumulator;
  }
);

// assertableStream :: (a -> Boolean) -> (a -> a) -> AsyncIterable a -> Task a[]
export const assertableStream = curry(
  (assertValue, unaryFunction, iterator) => compose(
    map(
      list => list.reduce(
        (container, value) => container.map(accumulator => [ ...accumulator, value.extract() ]),
        Either.Right([])
      )
    ),
    promise => Task(_ => promise.then(Either.of)),
    stream(
      compose(
        chain(unaryFunction),
        (_, value) => assertValue(value) ? Either.Right(value) : Either.left(value)
      ),
      []
    )
  )(iterator)
);

// safeExtract :: String -> Either a -> a
export const safeExtract = curry(
  (message, container) => container.fold({
    Left: error => {
      throw new Error(`${message} Error: ${
        (error.hasOwnProperty('raw')) ? new TextDecoder().decode(error.raw) : error.message
      }`)
    },
    Right: value => value
  })
);

// prepareConfluenceContent :: Uint8Array -> Uint8Array
export const prepareContentForPublication = compose(
  html => new TextEncoder().encode(html),
  markdown => Marked.parse(markdown).content,
  replace(/^\s*#\s*.*$/m, ''),
  replace(/^\s*\[\/\/\]\:\s*\<\>\s*\((.+)\)\s*$/m, ''),
  _buffer => new TextDecoder().decode(_buffer)
);

// resolveConfluenceContentFromFile :: Option -> File -> () -> Task ConfluenceContent
export const resolveConfluenceContentFromFile = curry(
  (options, file, _) => {
    const title = resolveTitleFromFile(file);

    return Task.of(
      ConfluenceContent(null, prepareContentForPublication(file.raw), { space: options.space, title, type: 'page' })
    );
  }
);

// resolveConfluenceContentFromConfluenceContent :: Options -> File -> String -> Task ConfluenceContent
export const resolveConfluenceContentFromConfluenceContent = curry(
  (options, file, confluenceContentID) => compose(
    map(
      task => task.bimap(
        _ => prepareContentForPublication(file.raw),
        meta => ({ ...meta, title: resolveTitleFromFile(file) })
      ),
    ),
    retrieveConfluenceContentFromID(options)
  )(confluenceContentID)
);

// negotiateConfluenceContentFromLocalFile ::
// Options -> (Options -> File -> () -> ConfluenceContent) -> (Options -> File -> String -> ConfluenceContent) -> File[] -> Task ConfluenceContent[]
export const negotiateConfluenceContentsFromLocalFiles = curry(
  (options, resolveLeft, resolveRight) => compose(
    insideOut(Task),
    map(
      ap(
        curry(
          (file, container) => container.fold({
            Left: resolveLeft(options, file),
            Right: resolveRight(options, file)
          })
        ),
        compose(
          resolveConfluenceContentIDFromFile,
          file => new TextDecoder().decode(file.raw)
        )
      )
    )
  )
);

// collectFiles :: String[] -> Task File[]
export const collectFiles = compose(
  insideOut(Task),
  map(
    compose(
      readFile,
      File.fromPath
    )
  )
);

// collectFilesForBlob :: Directory -> String -> Task File[]
export const collectFilesForBlob = curry(
  (directory, blob) => assertableStream(
    compose(
      pattern => _file => test(pattern, _file.path),
      compose(pattern => new RegExp(pattern), replace(/\*\*|\*/g, '.*'), replace('.', '\\.'))
    )(blob),
    compose(
      readFile,
      File.of
    ),
    walk(directory.path)
  )
);

// extractDocumentationBlocks :: String -> String[]
export const extractDocumentationBlocks = compose(
  map(replace(/^\/\*\*\s*\n|^\s\*\s*?(?=\n)|^\s\*\s|^\s*\*\/\s*/gm, "")),
  match(/^\/\*\*\s*\n*((\s*?\*\s*.+\s*\n)+?)\s*\*\/\s*$/gm)
);

// injectOptions :: (String -> Task Object) -> (Array -> Task Object -> Task a) -> Task a
export const injectOptions = curry(
  (readConfigurations, binaryFunction) => ap(
    curry((argumentList, configurations) => configurations.chain(binaryFunction(argumentList))),
    compose(
      path => path ? readConfigurations(path) : Task.of({}),
      argumentList => {
        const flagIndex = argumentList.findIndex(either(equals('--configurations'), equals('-c')));

        if (flagIndex >= 0) return argumentList[flagIndex + 1];
      }
    )
  )
);

// mergeDocumentationBlocks :: File[] -> File
export const mergeDocumentationBlocks = curry(
  (targetFilePath, sourceFileList) => compose(
    buffer => File(targetFilePath, buffer.raw, 0),
    reduce(
      (accumulator, value) => Buffer(
        accumulator.raw.length > 0
          ? new Uint8Array([ ...accumulator.raw, 10, 10, ...value.raw ])
          : new Uint8Array([ ...value.raw ])
      ),
      Buffer.empty()
    ),
    map(
      map(
        compose(
          text => new TextEncoder().encode(text),
          join('\n\n'),
          extractDocumentationBlocks,
          _buffer => new TextDecoder().decode(_buffer)
        )
      )
    )
  )(sourceFileList)
);

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

// resolveConfluenceContentIDFromFile :: String -> Either null String
export const resolveConfluenceContentIDFromFile = compose(
  ifElse(
    compose(flip(gte)(1), length),
    compose(Either.Right, prop(1)),
    always(Either.Left(null))
  ),
  match(/\[\/\/\]\:\s*\<\>\s*\((.+)\)/)
);

// retrieveFileFromPath :: String -> Task File
const retrieveFileFromPath = compose(
  readFile,
  File.fromPath
);

// createConfluenceContentFromFile :: Options -> File -> Task ConfluenceContent
export const createConfluenceContentFromFile = options => converge(
  (title, _buffer) =>
    createConfluenceContent(options)(ConfluenceContent(null, _buffer, { space: options.space, title, type: 'page' })),
  [
    file =>
      compose(head, match(/^#\s*.*$/))(new TextDecoder().decode(file.raw)) ||
      compose(
        resolveTitleFromFileName,
        last,
        match(/(?:.*\/)(.*?)(?:\.[a-z]+)*$/)
      )(file.path),
    prop('raw')
  ]
);

export const log = message => x => console.debug(blue(message), x) || x;

// retrieveConfluenceContentFromID :: Options -> String -> Task ConfluenceContent
export const retrieveConfluenceContentFromID = options => compose(
  retrieveConfluenceContent(options),
  ConfluenceContent.fromID
);

const shiftFirstLetterToUpperCase = replace(new RegExp('^\\${0,2}([a-z])'), (match) => match.toUpperCase());

// resolveTitleFromFileName :: String -> String
export const resolveTitleFromFileName = compose(
  join(' '),
  map(shiftFirstLetterToUpperCase),
  split(/(?=[A-Z0-9])|\-|\_/)
);

const resolveTitleFromFile = converge(
  or,
  [
    compose(
      when(complement(isNil), replace(/\s*#\s*/, '')),
      head,
      match(/^#\s*.*$/m),
      _buffer => new TextDecoder().decode(_buffer),
      prop('raw')
    ),
    compose(
      resolveTitleFromFileName,
      last,
      match(/(?:.*\/)(.*?)(?:\.[a-z]+)*$/),
      prop('path')
    )
  ]
);

// updateConfluenceFromBuffer :: Options -> ConfluenceContent -> Buffer -> Task ConfluenceContent
export const updateConfluenceFromBuffer = options => compose(
  updateConfluenceContent(options),
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
