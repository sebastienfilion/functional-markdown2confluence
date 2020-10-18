import { encode } from "https://deno.land/std@0.74.0/encoding/base64.ts";
import { curry } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import { fetch } from "https://deno.land/x/functional_io@v0.4.1/library/browser_safe.js";
import { factorizeType } from "https://deno.land/x/functional@v1.0.0/library/factories.js";
import Request from "https://deno.land/x/functional_io@v0.4.1/library/Request.js";

// parseResponse :: String -> Response -> ConfluenceContent
const parseResponse = curry(
  (bodyType, response) => {
    const { id: confluenceContentID, body, ...meta } = JSON.parse(new TextDecoder().decode(response.raw));

    return ConfluenceContent(
      confluenceContentID,
      new TextEncoder().encode((body[bodyType] || body[Object.keys(body)[0]]).value),
      meta
    );
  }
)

export const ConfluenceContent = factorizeType("ConfluenceContent", [ "ID", "raw", "meta" ]);

ConfluenceContent.fromID = function (contentID) {

  return ConfluenceContent(contentID, new Uint8Array([]), {});
};

ConfluenceContent.prototype.ap = ConfluenceContent.prototype["fantasy-land/ap"] = function (container) {

  return ConfluenceContent(this.ID, container.raw(this.raw), this.meta);
};

ConfluenceContent.prototype.bimap = ConfluenceContent.prototype["fantasy-land/bimap"] = function (unaryFunctionA, unaryFunctionB) {

  return ConfluenceContent(this.ID, unaryFunctionA(this.raw), unaryFunctionB(this.meta));
};

ConfluenceContent.prototype.concat = ConfluenceContent.prototype["fantasy-land/concat"] = function (container) {

  return ConfluenceContent(this.ID, new Uint8Array([ ...this.raw, ...container.raw ]), this.meta);
};

ConfluenceContent.prototype.map = ConfluenceContent.prototype["fantasy-land/map"] = function (unaryFunction) {

  return ConfluenceContent(this.ID, unaryFunction(this.raw), this.meta);
};

export const retrieveContentByID = curry(
  ({ APIToken, domain, username, bodyType = "editor" }, confluenceContent) =>
    fetch(
      Request(
        {
          cache: "default",
          headers: {
            "Authorization": `Basic ${encode(`${username}:${APIToken}`)}`
          },
          method: "GET",
          mode: "cors",
          url: `https://${domain}/wiki/rest/api/content/${confluenceContent.ID}?expand=body.${bodyType},version`
        },
        new Uint8Array([])
      )
    )
      .map(parseResponse(bodyType))
);

export const updateContentByID = curry(
  ({ APIToken, domain, username, bodyType = "editor" }, confluenceContent) =>
    fetch(
      Request(
        {
          cache: "default",
          headers: {
            "Authorization": `Basic ${encode(`${username}:${APIToken}`)}`,
            "Content-Type": "application/json"
          },
          method: "PUT",
          mode: "cors",
          url: `https://${domain}/wiki/rest/api/content/${confluenceContent.ID}`
        },
        new TextEncoder().encode(
          JSON.stringify(
            {
              id: confluenceContent.ID,
              version: {
                number: ++confluenceContent.meta.version.number
              },
              title: confluenceContent.meta.title,
              type: confluenceContent.meta.type,
              body: {
                [bodyType]: {
                  representation: bodyType,
                  value: new TextDecoder().decode(confluenceContent.raw)
                }
              }
            }
          )
        )
      )
    )
      .map(parseResponse(bodyType))
);