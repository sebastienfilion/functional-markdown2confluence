import { encode } from "https://deno.land/std@0.74.0/encoding/base64.ts";
import { curry } from "https://x.nest.land/ramda@0.27.0/source/index.js";

import { fetch } from "https://deno.land/x/functional_io@v0.4.1/library/browser_safe.js";
import { factorizeType } from "https://deno.land/x/functional@v1.0.0/library/factories.js";
import Request from "https://deno.land/x/functional_io@v0.4.1/library/Request.js";

/**
 * The `ConfluenceContent` type represent content retrieved from Confluence.
 * It has three attributes: the first is the ID, the second is a typed array named "raw" and, the third is an object
 * containing all the meta data.
 * The `ConfluenceContent` type is mostly interoperable with the Functional IO library's `Resource`, `File`, `Request`
 * and `Response`.
 *
 * The `ConfluenceContent` type implements the following algebras:
 * - [x] Bifunctor
 * - [x] Applicative
 *
 * ### Example
 *
 * ```js
 * const confluenceContent = ConfluenceContent("424242", new Uint8Array([ 65, 66, 67, 68, 69 ]), {});
 * ```
 */

export const ConfluenceContent = factorizeType("ConfluenceContent", [ "ID", "raw", "meta" ]);

ConfluenceContent.fromBuffer = function (_buffer) {

  return ConfluenceContent(null, _buffer, {});
};

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

// parseResponse :: String -> Uint8Array -> ConfluenceContent
const parseResponse = curry(
  (bodyType, _buffer) => {
    const { id: confluenceContentID, body, ...meta } = JSON.parse(new TextDecoder().decode(_buffer));

    return ConfluenceContent(
      confluenceContentID,
      new TextEncoder().encode((body[bodyType] || body[Object.keys(body)[0]]).value),
      meta
    );
  }
);

export const archiveConfluenceContent = curry(
  ({ APIToken, domain, username, bodyType = "editor" }, confluenceContent) =>
    fetch(
      Request(
        {
          cache: "default",
          headers: {
            "Authorization": `Basic ${encode(`${username}:${APIToken}`)}`
          },
          method: "DELETE",
          mode: "cors",
          url: `https://${domain}/wiki/rest/api/content/${confluenceContent.ID}`
        },
        new Uint8Array([])
      )
    )
);

export const createConfluenceContent = curry(
  ({ APIToken, domain, username, bodyType = "editor" }, confluenceContent) =>
    fetch(
      Request(
        {
          cache: "default",
          headers: {
            "Authorization": `Basic ${encode(`${username}:${APIToken}`)}`,
            "Content-Type": "application/json"
          },
          method: "POST",
          mode: "cors",
          url: `https://${domain}/wiki/rest/api/content`
        },
        new TextEncoder().encode(
          JSON.stringify(
            {
              body: {
                [bodyType]: {
                  representation: bodyType,
                  value: new TextDecoder().decode(confluenceContent.raw)
                }
              },
              space: {
                key: confluenceContent.meta.space
              },
              status: confluenceContent.meta.status,
              title: confluenceContent.meta.title,
              type: confluenceContent.meta.type,
            }
          )
        )
      )
    )
      .map(response => response.chain(parseResponse(bodyType)))
);

export const destroyConfluenceContent = curry(
  ({ APIToken, domain, username, bodyType = "editor" }, confluenceContent) =>
    fetch(
      Request(
        {
          cache: "default",
          headers: {
            "Authorization": `Basic ${encode(`${username}:${APIToken}`)}`
          },
          method: "DELETE",
          mode: "cors",
          url: `https://${domain}/wiki/rest/api/content/${confluenceContent.ID}?status=trashed`
        },
        new Uint8Array([])
      )
    )
);

export const retrieveConfluenceContent = curry(
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
          url: `https://${domain}/wiki/rest/api/content/${confluenceContent.ID}?status=any&expand=body.${bodyType},version`
        },
        new Uint8Array([])
      )
    )
      .map(response => response.chain(parseResponse(bodyType)))
);

export const updateConfluenceContent = curry(
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
              body: {
                [bodyType]: {
                  representation: bodyType,
                  value: new TextDecoder().decode(confluenceContent.raw)
                }
              },
              id: confluenceContent.ID,
              status: confluenceContent.meta.status,
              title: confluenceContent.meta.title,
              type: confluenceContent.meta.type,
              version: {
                number: ++confluenceContent.meta.version.number
              }
            }
          )
        )
      )
    )
      .map(response => response.chain(parseResponse(bodyType)))
);