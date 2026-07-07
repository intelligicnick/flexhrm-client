import { describe, expect, it } from "vitest";
import {
  buildGemContractPdfUrl,
  CHROME_PDF_VIEWER_EXTENSION_ID,
  extractGemContractId,
  extractGemContractIdQueryValue,
  extractGemDocId,
  resolveGemBidPdfSourceUrl,
  resolveGemBidPdfUrl,
  resolveGemContractId,
  resolveGemContractIdForCopy,
  resolveGemContractPdfSourceUrl,
  resolveGemContractPdfUrl,
  unwrapChromePdfViewerUrl,
  wrapChromePdfViewerUrl,
} from "./gem-helpers";

const CHROME_PREFIX = `chrome-extension://${CHROME_PDF_VIEWER_EXTENSION_ID}/`;

describe("gem-helpers chrome PDF viewer URLs", () => {
  it("wraps GeM tender PDF URLs", () => {
    const source = "https://bidplus.gem.gov.in/showbidDocument/9184926";
    expect(wrapChromePdfViewerUrl(source)).toBe(`${CHROME_PREFIX}${source}`);
  });

  it("wraps GeM contract PDF URLs", () => {
    const contractId = "SE85WXlFRndqK3RYcFd2TGF2dWtHeVJEYTNKMEhlK3F2NW1JYlhmTGRhbz0=";
    const source = buildGemContractPdfUrl(contractId);
    expect(wrapChromePdfViewerUrl(source)).toBe(`${CHROME_PREFIX}${source}`);
  });

  it("unwraps chrome-extension PDF URLs", () => {
    const source = "https://bidplus.gem.gov.in/showbidDocument/9184926";
    const wrapped = `${CHROME_PREFIX}${source}`;
    expect(unwrapChromePdfViewerUrl(wrapped)).toBe(source);
  });
});

describe("extractGemContractId", () => {
  const contractId = "dmdOUEJHbnRYWWN3NlpTMnNLUGhkc3RqN3BMakMvcWNsQmFWRVhtVHJVcz0=";

  it("pulls full contractId including trailing = from fulfilment PDF URL", () => {
    const url = buildGemContractPdfUrl(contractId);
    expect(extractGemContractId(url)).toBe(contractId);
  });

  it("pulls contractId from chrome-extension wrapped URL", () => {
    const contractId = "SE85WXlFRndqK3RYcFd2TGF2dWtHeVJEYTNKMEhlK3F2NW1JYlhmTGRhbz0=";
    const wrapped = `${CHROME_PREFIX}${buildGemContractPdfUrl(contractId)}`;
    expect(extractGemContractId(wrapped)).toBe(contractId);
  });

  it("decodes percent-encoded trailing =", () => {
    const url = `https://fulfilment.gem.gov.in/contract/fds?contractId=${encodeURIComponent(contractId)}`;
    expect(extractGemContractId(url)).toBe(contractId);
  });
});

describe("resolveGemContractId", () => {
  const contractId = "dmdOUEJHbnRYWWN3NlpTMnNLUGhkc3RqN3BMakMvcWNsQmFWRVhtVHJVcz0=";

  it("returns stored gemContractId with trailing =", () => {
    expect(resolveGemContractId({ gemContractId: contractId })).toBe(contractId);
  });

  it("extracts from gemContractPdfUrl when gemContractId is missing", () => {
    expect(
      resolveGemContractId({ gemContractPdfUrl: buildGemContractPdfUrl(contractId) }),
    ).toBe(contractId);
  });
});

describe("resolveGemContractIdForCopy", () => {
  const contractIdEncoded = "MnBEckVmZDFneUdidXRoQVQ3QzN0clZRdTJOdU5JelE5bTR3VHN6dTJvcz0%3D";
  const contractIdDecoded = "MnBEckVmZDFneUdidXRoQVQ3QzN0clZRdTJOdU5JelE5bTR3VHN6dTJvcz0=";
  const chromePdfUrl = `${CHROME_PREFIX}https://fulfilment.gem.gov.in/contract/fds?contractId=${contractIdEncoded}`;

  it("copies everything after contractId= from chrome-extension PDF URL", () => {
    expect(
      resolveGemContractIdForCopy({
        gemContractPdfUrl: `https://fulfilment.gem.gov.in/contract/fds?contractId=${contractIdEncoded}`,
      }),
    ).toBe(contractIdEncoded);
  });

  it("extracts raw query value from wrapped chrome-extension link", () => {
    expect(extractGemContractIdQueryValue(chromePdfUrl)).toBe(contractIdEncoded);
    expect(resolveGemContractIdForCopy({ gemContractPdfUrl: chromePdfUrl })).toBe(contractIdEncoded);
  });

  it("encodes stored decoded gemContractId for copy", () => {
    expect(resolveGemContractIdForCopy({ gemContractId: contractIdDecoded })).toBe(contractIdEncoded);
  });
});

describe("resolveGemBidPdfUrl", () => {
  it("builds chrome-extension link from gemDocUrl", () => {
    const url = resolveGemBidPdfUrl({ gemDocUrl: "https://bidplus.gem.gov.in/showbidDocument/9184926" });
    expect(url).toBe(
      `${CHROME_PREFIX}https://bidplus.gem.gov.in/showbidDocument/9184926`,
    );
  });

  it("extracts doc id from wrapped URLs", () => {
    expect(extractGemDocId(`${CHROME_PREFIX}https://bidplus.gem.gov.in/showbidDocument/9184926`)).toBe(
      "9184926",
    );
  });
});

describe("resolveGemContractPdfUrl", () => {
  const contractId = "SE85WXlFRndqK3RYcFd2TGF2dWtHeVJEYTNKMEhlK3F2NW1JYlhmTGRhbz0=";

  it("builds chrome-extension link from gemContractId", () => {
    const url = resolveGemContractPdfUrl({ gemContractId: contractId });
    expect(url).toBe(`${CHROME_PREFIX}${buildGemContractPdfUrl(contractId)}`);
  });

  it("builds source URL from gemContractId", () => {
    const url = resolveGemContractPdfSourceUrl({ gemContractId: contractId });
    expect(url).toBe(buildGemContractPdfUrl(contractId));
  });

  it("prefers stored gemContractPdfUrl", () => {
    const source = buildGemContractPdfUrl(contractId);
    const url = resolveGemContractPdfUrl({ gemContractPdfUrl: source });
    expect(url).toBe(`${CHROME_PREFIX}${source}`);
  });
});
