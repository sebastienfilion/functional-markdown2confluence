import { assert, assertEquals } from "https://deno.land/std@0.70.0/testing/asserts.ts";
import { v4 } from "https://deno.land/std@0.76.0/uuid/mod.ts";
import { compose, map } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import { emptyDir as _emptyDir, ensureDir as _ensureDir } from "https://deno.land/std@0.70.0/fs/mod.ts";
import Either from "https://deno.land/x/functional@v1.0.0/library/Either.js";
import Task from "../../functional/library/Task.js";


import { handleCollectCommand, handleCommand, handlePublishCommand } from "./commands.js";
import { archiveConfluenceContent, ConfluenceContent, createConfluenceContent } from "./confluence.js";
import { safeExtract, insideOut } from "./utilities.js";

// archiveAllConfluenceContent :: Options -> ConfluenceContent[] -> Task Response[]
const archiveAllConfluenceContent = (options) => compose(
  insideOut(Task),
  map(archiveConfluenceContent(options))
);

Deno.test(
  "handleCollectCommand",
  async () => {
    await _ensureDir(`${Deno.cwd()}/dump`);
    await _emptyDir(`${Deno.cwd()}/dump`);
    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/hoge`,
      `/**
 * Hoge
 */`
    );

    const containerA = handleCollectCommand({}, 'dump/piyo', [ 'dump/hoge' ]);
    const promise = containerA.run();

    assert(Task.is(containerA));
    assert(promise instanceof Promise);

    const containerB = await promise;

    assert(Either.Right.is(containerB));
    assertEquals(
      containerB.toString(),
      `Either.Right(File("${Deno.cwd()}/dump/piyo", 72,111,103,101,10, 0))`
    );

    await Deno.remove(`${Deno.cwd()}/dump/hoge`);
    await Deno.remove(`${Deno.cwd()}/dump/piyo`);
  }
);

Deno.test(
  "handlePublishCommand: Create file",
  async () => {
    const sanityID = v4.generate();
    const options = {
      APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
      domain: Deno.env.get("CONFLUENCE_DOMAIN"),
      space: Deno.env.get("CONFLUENCE_SPACE"),
      username: Deno.env.get("CONFLUENCE_USERNAME")
    };
    await _ensureDir(`${Deno.cwd()}/dump`);
    await _emptyDir(`${Deno.cwd()}/dump`);

    console.debug(`%c\nSanity ID: ${sanityID}`, 'color: lightblue');

    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/piyo`,
      `# Piyo (${sanityID})
## Testing creating files
This file was autogenerated and published from a Markdown file.  
\`${sanityID}\`
`
    );

    const containerA = handlePublishCommand(options, [ 'dump/piyo' ]);
    const promise = containerA.run();

    assert(Task.is(containerA));
    assert(promise instanceof Promise);

    const containerB = await promise;

    assert(Either.Right.is(containerB));

    const confluenceContentList = safeExtract("Failed to run or unpack the command.", containerB);

    assert(
      confluenceContentList instanceof Array
      && confluenceContentList.every(container => ConfluenceContent.is(container)),
      confluenceContentList.toString()
    );

    await Deno.remove(`${Deno.cwd()}/dump/piyo`);

    const containerC = await archiveAllConfluenceContent(options)(confluenceContentList).run();

    const requestList = safeExtract("Failed to cleanup", containerC)

    try {
      assert(
        requestList.every(request => request.headers.status === 200)
      );
    } catch (error) {
      console.debug(`%cCould not archive the Confluence content.`, 'color: orange');
    }
  }
);

Deno.test(
  "handlePublishCommand: Update file",
  async () => {
    const sanityID = v4.generate();
    const options = {
      APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
      domain: Deno.env.get("CONFLUENCE_DOMAIN"),
      space: Deno.env.get("CONFLUENCE_SPACE"),
      username: Deno.env.get("CONFLUENCE_USERNAME")
    };
    await _ensureDir(`${Deno.cwd()}/dump`);
    await _emptyDir(`${Deno.cwd()}/dump`);

    console.debug(`%c\nSanity ID: ${sanityID}`, 'color: lightblue');

    const containerZ = await createConfluenceContent(
      options,
      ConfluenceContent(
        null,
        new TextEncoder().encode(
          `<p>This file has been autogenerated for testing purpose.</p><code>${sanityID}</code>`
        ),
        {
          title: `Hoge (${sanityID})`,
          type: 'page',
          space: Deno.env.get("CONFLUENCE_SPACE")
        }
      )
    ).run();

    const confluenceContentA = safeExtract("Failed to create the original Confluence content.", containerZ);

    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/hoge`,
      `# Hoge (${sanityID})
## Testing updating file
This file was autogenerated and published from a Markdown file.  
\`${sanityID}\`  
[//]: <> (${confluenceContentA.ID})`
    );

    const containerA = handlePublishCommand(options, [ 'dump/hoge' ]);
    const promise = containerA.run();

    assert(Task.is(containerA));
    assert(promise instanceof Promise);

    const containerB = await promise;

    const confluenceContentList = safeExtract("Failed to run or unpack the command.", containerB);

    assert(
      confluenceContentList instanceof Array
      && confluenceContentList.every(container => ConfluenceContent.is(container)),
      confluenceContentList.toString()
    );

    await Deno.remove(`${Deno.cwd()}/dump/hoge`);

    const containerC = await archiveAllConfluenceContent(options)([ confluenceContentA, ...confluenceContentList ]).run();

    const requestList = safeExtract("Failed to cleanup.", containerC)

    try {
      assert(
        requestList.every(request => request.headers.status === 200)
      );
    } catch (error) {
      console.debug(`%cCould not archive the Confluence content.`, 'color: orange');
    }
  }
);

Deno.test(
  "handleCommand collect",
  async () => {
    await _ensureDir(`${Deno.cwd()}/dump`);
    await _emptyDir(`${Deno.cwd()}/dump`);
    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/hoge`,
      `/**
 * Hoge
 */`
    );

    const containerA = handleCommand([ 'collect', 'dump/piyo', 'dump/hoge' ]);
    const promise = containerA.run();

    assert(Task.is(containerA));
    assert(promise instanceof Promise);

    const containerB = await promise;

    assert(Either.Right.is(containerB));
    assertEquals(
      containerB.toString(),
      `Either.Right(File("${Deno.cwd()}/dump/piyo", 72,111,103,101,10, 0))`
    );

    await Deno.remove(`${Deno.cwd()}/dump/hoge`);
    await Deno.remove(`${Deno.cwd()}/dump/piyo`);
  }
);

Deno.test(
  "handleCommand publish",
  async () => {
    const sanityIDList = [ v4.generate(), v4.generate() ];
    const options = {
      APIToken: Deno.env.get("CONFLUENCE_TOKEN"),
      domain: Deno.env.get("CONFLUENCE_DOMAIN"),
      space: Deno.env.get("CONFLUENCE_SPACE"),
      username: Deno.env.get("CONFLUENCE_USERNAME")
    };
    await _ensureDir(`${Deno.cwd()}/dump`);
    await _emptyDir(`${Deno.cwd()}/dump`);

    console.debug(`%c\nSanity ID: ${sanityIDList.join(', ')}`, 'color: lightblue');

    const containerZ = await createConfluenceContent(
      options,
      ConfluenceContent(
        null,
        new TextEncoder().encode(
          `<p>This file has been autogenerated for testing purpose.</p><code>${sanityIDList[0]}</code>`
        ),
        {
          title: `Hoge (${sanityIDList[0]})`,
          type: 'page',
          space: Deno.env.get("CONFLUENCE_SPACE")
        }
      )
    ).run();

    const confluenceContentA = safeExtract("Failed to create the original Confluence content.", containerZ);

    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/hoge`,
      `# Hoge (${sanityIDList[0]})
## Testing updating file
This file was autogenerated and published from a Markdown file.  
\`${sanityIDList[0]}\`  
[//]: <> (${confluenceContentA.ID})`
    );

    await Deno.writeTextFile(
      `${Deno.cwd()}/dump/piyo`,
      `# Piyo (${sanityIDList[1]})
## Testing creating files
This file was autogenerated and published from a Markdown file.  
\`${sanityIDList[1]}\`
`
    );

    const containerA = handleCommand([ 'publish', 'dump/hoge', 'dump/piyo' ]);
    const promise = containerA.run();

    assert(Task.is(containerA));
    assert(promise instanceof Promise);

    const containerB = await promise;

    const confluenceContentList = safeExtract("Failed to run or unpack the command.", containerB);

    assert(
      confluenceContentList instanceof Array
      && confluenceContentList.every(container => ConfluenceContent.is(container)),
      confluenceContentList.toString()
    );

    await Deno.remove(`${Deno.cwd()}/dump/hoge`);

    const containerC = await archiveAllConfluenceContent(options)([ confluenceContentA, ...confluenceContentList ]).run();

    const requestList = safeExtract("Failed to cleanup.", containerC)

    try {
      assert(
        requestList.every(request => request.headers.status === 200)
      );
    } catch (error) {
      console.debug(`%cCould not archive the Confluence content.`, 'color: orange');
    }
  }
);