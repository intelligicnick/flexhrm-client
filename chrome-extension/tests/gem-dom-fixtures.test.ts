import { describe, expect, it } from 'vitest';
import {
  GEM_FULFILMENT_ORDERS_TABLE,
  GEM_SELLER_BIDS_LISTING,
} from './fixtures/gem-dom-fixtures';

describe('GeM DOM fixtures', () => {
  it('extracts multiple seller-bids cards from listing fixture', async () => {
    document.body.innerHTML = GEM_SELLER_BIDS_LISTING;
    const { extractGemTendersFromPage, findTenderCards } = await import(
      '../src/modules/tenders/gem-extractor'
    );

    expect(findTenderCards().length).toBe(2);

    const tenders = extractGemTendersFromPage();
    expect(tenders.map((t) => t.bidNo).sort()).toEqual([
      'GEM/2026/B/7590568',
      'GEM/2026/B/7616472',
    ]);
    expect(tenders[0].ministry).toContain('Ministry Of Education');
    expect(tenders[0].status).toBe('not_filed');
    expect(tenders[1].gemParticipation.toLowerCase()).toContain('participated');
  });

  it('extracts fulfilment orders table from fixture', async () => {
    document.body.innerHTML = GEM_FULFILMENT_ORDERS_TABLE;
    const { extractGemOrdersFromPage } = await import(
      '../src/modules/contracts/gem-orders-extractor'
    );

    const orders = extractGemOrdersFromPage();
    expect(orders).toHaveLength(1);
    expect(orders[0].contractNo).toBe('GEMC-511687705641397');
    expect(orders[0].tenderBidNo).toBe('GEM/2021/B/1108459');
    expect(orders[0].gemContractPdfUrl).toContain('fulfilment.gem.gov.in');
  });
});
