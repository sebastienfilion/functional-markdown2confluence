import { assert, assertEquals } from "https://deno.land/std@0.70.0/testing/asserts.ts";
import { curry } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import Either from "https://deno.land/x/functional@v1.0.0/library/Either.js";
import File from "https://deno.land/x/functional_io@v0.4.2/library/File.js";
import Task from "https://deno.land/x/functional@v1.0.0/library/Task.js";

import {
  assertableStream,
  extractDocumentationBlocks,
  injectOptions,
  mergeDocumentationBlocks,
  negotiateConfluenceContentsFromLocalFiles,
  parseConfigurationFile,
  resolveConfluenceContentIDFromFile,
  resolveTitleFromFileName,
  resolveConfluenceContentFromFile,
  safeExtract
} from "./utilities.js";
import { ConfluenceContent } from "./confluence.js";

const sampleA = `[//]: <> (4242)

# Markdown2Confluence

Simple CLI to publish local Markdown files to Confluence.
`;

const sampleB = `# Markdown2Confluence

Simple CLI to publish local Markdown files to Confluence.
`;

const sampleC = `import Request from "https://deno.land/x/functional_io@v0.4.1/library/Request.js";

/**
 * The \`ConfluenceContent\` type represent content retrieved from Confluence.
 * It has three attributes: the first is the ID, the second is a typed array named "raw" and, the third is an object
 * containing all the meta data.
 * The \`ConfluenceContent\` type is mostly interoperable with the Functional IO library's \`Resource\`, \`File\`, \`Request\`
 * and \`Response\`.
 *
 * The \`ConfluenceContent\` type implements the following algebras:
 * - [x] Bifunctor
 * - [x] Applicative
 *
 * ### Example
 *
 * \`\`\`js
 * const confluenceContent = ConfluenceContent("424242", new Uint8Array([ 65, 66, 67, 68, 69 ]), {});
 * \`\`\`
 */

export const ConfluenceContent = factorizeType("ConfluenceContent", [ "ID", "raw", "meta" ]);
`;

const sampleC2 = `The \`ConfluenceContent\` type represent content retrieved from Confluence.
It has three attributes: the first is the ID, the second is a typed array named "raw" and, the third is an object
containing all the meta data.
The \`ConfluenceContent\` type is mostly interoperable with the Functional IO library's \`Resource\`, \`File\`, \`Request\`
and \`Response\`.

The \`ConfluenceContent\` type implements the following algebras:
- [x] Bifunctor
- [x] Applicative

### Example

\`\`\`js
const confluenceContent = ConfluenceContent("424242", new Uint8Array([ 65, 66, 67, 68, 69 ]), {});
\`\`\`
`;

const sampleD = `import Request from "https://deno.land/x/functional_io@v0.4.1/library/Request.js";

/**
 * The \`ConfluenceContent\` type represent content retrieved from Confluence.
 * It has three attributes: the first is the ID, the second is a typed array named "raw" and, the third is an object
 * containing all the meta data.
 * The \`ConfluenceContent\` type is mostly interoperable with the Functional IO library's \`Resource\`, \`File\`, \`Request\`
 * and \`Response\`.
 */
 
/**
 * The \`ConfluenceContent\` type implements the following algebras:
 * - [x] Bifunctor
 * - [x] Applicative
 *
 * ### Example
 *
 * \`\`\`js
 * const confluenceContent = ConfluenceContent("424242", new Uint8Array([ 65, 66, 67, 68, 69 ]), {});
 * \`\`\`
 */

export const ConfluenceContent = factorizeType("ConfluenceContent", [ "ID", "raw", "meta" ]);
`;

const sampleD2 = [
  `The \`ConfluenceContent\` type represent content retrieved from Confluence.
It has three attributes: the first is the ID, the second is a typed array named "raw" and, the third is an object
containing all the meta data.
The \`ConfluenceContent\` type is mostly interoperable with the Functional IO library's \`Resource\`, \`File\`, \`Request\`
and \`Response\`.
`,
  `The \`ConfluenceContent\` type implements the following algebras:
- [x] Bifunctor
- [x] Applicative

### Example

\`\`\`js
const confluenceContent = ConfluenceContent("424242", new Uint8Array([ 65, 66, 67, 68, 69 ]), {});
\`\`\`
`
];

const sampleD3 = sampleD2.join('\n\n');

const sampleE = 'hogePiyoFuga';
const sampleF = 'hoge_piyo_fuga';
const sampleG = 'hoge-piyo-fuga';
const sampleH = 'hoge-piyoFuga';

// Deno.test(
//   "assertableStream",
//   async () => {
//     function* asyncList () {
//       yield 24;
//       yield 32;
//       yield 42;
//     }
//
//     assertEquals(
//       (await assertableStream(
//         _ => true,
//         x => x,
//         asyncList()
//       ).run()).toString(),
//       Either.Right([ 24, 32, 42 ]).toString()
//     );
//
//     assertEquals(
//       (await assertableStream(
//         x => x === 42,
//         x => x * 2,
//         asyncList()
//       ).run()).toString(),
//       Either.Right([ 84 ]).toString()
//     );
//   }
// );

Deno.test(
  "extractDocumentationBlocks",
  () => assertEquals(
    extractDocumentationBlocks(sampleC),
    [
      sampleC2
    ]
  )
);

Deno.test(
  "extractDocumentationBlocks -- multiple blocks",
  () => assertEquals(
    extractDocumentationBlocks(sampleD),
    sampleD2
  )
);

Deno.test(
  "injectOptions -- with configurations",
  async () => {
    assertEquals(
      (await injectOptions(
        _ => Task.of({ hoge: 'hoge' }),
        curry(
          (argumentList, configurations) => {
            assertEquals(argumentList, []);
            assertEquals(configurations, { hoge: 'hoge' });

            return Task.of(42);
          }
        )
      )([ '--configurations', `${Deno.cwd()}/fuga` ]).run()).toString(),
      'Either.Right(42)'
    )
  }
);

Deno.test(
  "injectOptions -- without configurations",
  async () => {
    assertEquals(
      (await injectOptions(
        _ => Task.of({ hoge: 'hoge' }),
        curry(
          (argumentList, configurations) => {
            assertEquals(argumentList, []);
            assertEquals(configurations, {});

            return Task.of(42);
          }
        )
      )([]).run()).toString(),
      'Either.Right(42)'
    )
  }
);

Deno.test(
  "mergeDocumentationBlocks",
  () => {
    assertEquals(
      mergeDocumentationBlocks(
        `${Deno.cwd()}/fuga`,
        [
          File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(sampleC), 0)
        ]
      ),
      File(`${Deno.cwd()}/fuga`, new TextEncoder().encode(`${sampleC2}`), 0)
    )
  }
);

Deno.test(
  "mergeDocumentationBlocks: multiple",
  () => {
    assertEquals(
      mergeDocumentationBlocks(
        `${Deno.cwd()}/fuga`,
        [
          File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(sampleC), 0),
          File(`${Deno.cwd()}/piyo`, new TextEncoder().encode(sampleD), 0)
        ]
      ),
      File(`${Deno.cwd()}/fuga`, new TextEncoder().encode(`${sampleC2}\n\n${sampleD3}`), 0)
    )
  }
);

Deno.test(
  "negotiateConfluenceContentFromLocalFile",
  async () => {
    const resolveLeft = curry((options, file, _) => Task.of(ConfluenceContent(null, file.raw, {})));
    const resolveRight = curry(
      (options, file, confluenceContentID) => Task.of(ConfluenceContent(confluenceContentID, file.raw, {}))
    );
    const negotiateConfluenceContentFromLocalFileMock = negotiateConfluenceContentsFromLocalFiles(
      {},
      resolveLeft,
      resolveRight
    );

    const containerA = await negotiateConfluenceContentFromLocalFileMock(
      [
        File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(`# Hoge Piyo`), 0)
      ]
    ).run();

    const [ confluenceContentA ] = safeExtract('Failed to extract the Confluence content.', containerA);

    assert(ConfluenceContent.is(confluenceContentA) && confluenceContentA.ID === null, confluenceContentA.toString());

    const containerB = await negotiateConfluenceContentFromLocalFileMock(
      [
        File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(`# Hoge Piyo\n[//]: <> (4242)`), 0)
      ]
    ).run();

    const [ confluenceContentB ] = safeExtract('Failed to extract the Confluence content.', containerB);

    assert(ConfluenceContent.is(confluenceContentB) && confluenceContentB.ID === "4242", confluenceContentB.toString());

    const containerC = await negotiateConfluenceContentFromLocalFileMock(
      [
        File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(`# Hoge Piyo`), 0),
        File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(`# Hoge Piyo\n[//]: <> (4242)`), 0)
      ]
    ).run();

    const confluenceContentList = safeExtract('Failed to extract the Confluence content.', containerC);

    assert(
      ConfluenceContent.is(confluenceContentList[0]) && confluenceContentList[0].ID === null,
      confluenceContentList[0].toString()
    );

    assert(
      ConfluenceContent.is(confluenceContentList[1]) && confluenceContentList[1].ID === "4242",
      confluenceContentList[0].toString()
    );
  }
)

Deno.test(
  "parseConfigurationFile",
  () => assertEquals(
    parseConfigurationFile(
`domain={DOMAIN}  
  token={TOKEN}
username= {USERNAME}
`
    ),
    {
      token: "{TOKEN}",
      domain: "{DOMAIN}",
      username: "{USERNAME}"
    }
  )
);

Deno.test(
  "resolveConfluenceContentIDFromFile - Right",
  () => assertEquals(
    resolveConfluenceContentIDFromFile(sampleA).toString(),
    `Either.Right("4242")`
  )
);

Deno.test(
  "resolveConfluenceContentIDFromFile - Left",
  () => assertEquals(
    resolveConfluenceContentIDFromFile(sampleB).toString(),
    `Either.Left(null)`
  )
);

Deno.test(
  "resolveTitleFromFileName",
  () => {
    assertEquals(resolveTitleFromFileName(sampleE), "Hoge Piyo Fuga");
    assertEquals(resolveTitleFromFileName(sampleF), "Hoge Piyo Fuga");
    assertEquals(resolveTitleFromFileName(sampleG), "Hoge Piyo Fuga");
    assertEquals(resolveTitleFromFileName(sampleH), "Hoge Piyo Fuga");
  }
);

Deno.test(
  "resolveConfluenceContentFromFile",
  async () => {
    const  containerA = await resolveConfluenceContentFromFile(
      { space: Deno.env.get("CONFLUENCE_SPACE") },
      File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(``), 0),
      null
    ).run();

    const confluenceContentA = safeExtract('Failed to resolve a Confluence content from File.', containerA);

    assert(ConfluenceContent.is(confluenceContentA), confluenceContentA.toString());

    assertEquals(confluenceContentA.meta.title, 'Hoge');

    const  containerB = await resolveConfluenceContentFromFile(
      { space: Deno.env.get("CONFLUENCE_SPACE") },
      File(`${Deno.cwd()}/hoge`, new TextEncoder().encode(`# Hoge Piyo`), 0),
      null
    ).run();

    const confluenceContentB = safeExtract('Failed to resolve a Confluence content from File.', containerB);

    assert(ConfluenceContent.is(confluenceContentB), confluenceContentB.toString());

    assertEquals(confluenceContentB.meta.title, 'Hoge Piyo');
  }
)
