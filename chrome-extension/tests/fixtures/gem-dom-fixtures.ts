/** Realistic GeM Seller Bids card markup for DOM fixture tests. */
export const GEM_SELLER_BIDS_LISTING = `
<div id="seller-bids-list" class="row">
  <div class="card border block shadow margin-top-10" data-flexhrm-bid="GEM/2026/B/7590568">
    <div class="card-body">
      <span class="bid-no">BID NO: GEM/2026/B/7590568</span>
      <div>Items: Facility Management Services - Manpower</div>
      <div>Quantity: Project / Lumpsum Based</div>
      <div>Ministry/State Name Ministry Of Education</div>
      <div>Organisation Name Kendriya Vidyalaya Sangathan</div>
      <div>Consignee Reporting/Officer: Shankar Singh</div>
      <div>Address: 342306, KVS Campus, Govt Primary School</div>
      <div>Start Date: 27-05-2026 10:43 AM</div>
      <div>End Date: 17-06-2026 3:00 PM</div>
      <div>Not participated</div>
      <a href="https://bidplus.gem.gov.in/showbidDocument/123456">Bid Doc Hash: View</a>
    </div>
  </div>
  <div class="card border block shadow margin-top-10" data-flexhrm-bid="GEM/2026/B/7616472">
    <div class="card-body">
      <span class="bid-no">BID NO: GEM/2026/B/7616472</span>
      <div>Items: Security Manpower Service (Version 2.0)</div>
      <div>Quantity: 12 Months</div>
      <div>Start Date: 01-06-2026 10:00:00</div>
      <div>End Date: 18-06-2026 13:00:00</div>
      <div>Participated</div>
      <div>Technical Evaluation</div>
    </div>
  </div>
</div>
`;

export const GEM_FULFILMENT_ORDERS_TABLE = `
<table class="table table-bordered">
  <thead>
    <tr>
      <th>Contract No</th>
      <th>Buyer</th>
      <th>Seller</th>
      <th>Bid Number</th>
      <th>Contract Date</th>
      <th>Total</th>
      <th>Status</th>
      <th>Product</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>
        GEMC-511687705641397
        <a href="https://fulfilment.gem.gov.in/contract/fds?contractId=abc123">View</a>
      </td>
      <td>Parag Tandon</td>
      <td>PENTEC WATER (INDIA)</td>
      <td>GEM/2021/B/1108459</td>
      <td>31/03/2021 11:14</td>
      <td>₹ 79500.00</td>
      <td>Order placed (accepted by seller)</td>
      <td>Facility Management Services - Manpower</td>
    </tr>
  </tbody>
</table>
`;
