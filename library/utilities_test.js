import { assert, assertEquals } from "https://deno.land/std@0.70.0/testing/asserts.ts";

import { parseConfigurationFile } from "./utilities.js";

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
)