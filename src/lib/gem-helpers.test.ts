import { describe, expect, it } from "vitest";
import {
  buildGemContractPdfUrl,
  CHROME_PDF_VIEWER_EXTENSION_ID,
  extractGemContractId,
  extractGemContractIdQueryValue,
  extractGemDocId,
  resolveGemBidPdfSourceUrl,
  resolveGemBidPdfUrl,
  resolveGemContractFullLinkForCopy,
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

describe("resolveGemContractFullLinkForCopy", () => {
  const contractId = "dmdOUEJHbnRYWWN3NlpTMnNLUGhkc3RqN3BMakMvcWNsQmFWRVhtVHJVcz0=";

  it("returns full https link with complete contractId including trailing =", () => {
    expect(resolveGemContractFullLinkForCopy({ gemContractId: contractId })).toBe(
      `https://fulfilment.gem.gov.in/contract/fds?contractId=${contractId}`,
    );
  });

  it("rebuilds full link from truncated stored URL when gemContractId is present", () => {
    expect(
      resolveGemContractFullLinkForCopy({
        gemContractId: contractId,
        gemContractPdfUrl:
          "https://fulfilment.gem.gov.in/contract/fds?contractId=dmdOUEJHbnRYWWN3NlpTMnNLUGhkc3RqN3BMakMvcWN",
      }),
    ).toBe(`https://fulfilment.gem.gov.in/contract/fds?contractId=${contractId}`);
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
    expect(
      resolveGemContractIdForCopy({
        gemContractPdfUrl: `https://fulfilment.gem.gov.in/contract/fds?contractId=${contractIdEncoded}`,
      }),
    ).toBe(contractIdEncoded);
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
  const contractIdEncoded = encodeURIComponent(contractId);

  it("builds chrome-extension link from gemContractId", () => {
    const url = resolveGemContractPdfUrl({ gemContractId: contractId });
    expect(url).toBe(`${CHROME_PREFIX}${buildGemContractPdfUrl(contractId)}`);
  });

  it("builds source URL from gemContractId", () => {
    const url = resolveGemContractPdfSourceUrl({ gemContractId: contractId });
    expect(url).toBe(buildGemContractPdfUrl(contractId));
  });

  it("rebuilds canonical URL from stored gemContractPdfUrl with raw =", () => {
    const brokenStored = `https://fulfilment.gem.gov.in/contract/fds?contractId=${contractId}`;
    const url = resolveGemContractPdfUrl({ gemContractPdfUrl: brokenStored });
    expect(url).toBe(`${CHROME_PREFIX}${buildGemContractPdfUrl(contractId)}`);
    expect(url).toContain(contractIdEncoded);
    expect(url).not.toMatch(/contractId=.*[^%]=/);
  });

  it("prefers gemContractId over broken stored gemContractPdfUrl", () => {
    const goodId = "MnBEckVmZDFneUdidXRoQVQ3QzN0clZRdTJOdU5JelE5bTR3VHN6dTJvcz0=";
    const brokenStored = "https://fulfilment.gem.gov.in/contract/fds?contractId=broken";
    const url = resolveGemContractPdfUrl({
      gemContractId: goodId,
      gemContractPdfUrl: brokenStored,
    });
    expect(url).toBe(`${CHROME_PREFIX}${buildGemContractPdfUrl(goodId)}`);
  });

  it("extracts contractId from notes when fields are missing", () => {
    const id = "dmdOUEJHbnRYWWN3NlpTMnNLUGhkc3RqN3BMakMvcWNsQmFWRVhtVHJVcz0=";
    const url = resolveGemContractPdfUrl({
      contractNo: "GEMC-123",
      notes: `GeM contract number: GEMC-123\nGeM contractId: ${id}`,
    });
    expect(url).toBe(`${CHROME_PREFIX}${buildGemContractPdfUrl(id)}`);
  });

  it("extracts contractId when contractNo is the stored PDF URL", () => {
    const id = "MnBEckVmZDFneUdidXRoQVQ3QzN0clZRdTJOdU5JelE5bTR3VHN6dTJvcz0=";
    const stored = `https://fulfilment.gem.gov.in/contract/fds?contractId=${id}`;
    const url = resolveGemContractPdfUrl({ contractNo: stored });
    expect(url).toContain(encodeURIComponent(id));
  });
});
