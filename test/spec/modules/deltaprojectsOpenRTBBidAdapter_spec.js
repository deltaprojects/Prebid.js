import { expect } from 'chai';
import {
  BIDDER_CODE,
  BIDDER_ENDPOINT_URL,
  spec,
} from 'modules/deltaprojectsOpenRTBBidAdapter.js';

const BID_REQ_REFER = 'http://example.com/page?param=val'

describe('deltaprojectsOpenRTBBidAdapter', function() {
  describe('isBidRequestValid', function () {
    function makeBid() {
      return {
        bidder: BIDDER_CODE,
        params: {
          publisher: {
            id: '4' // required
          },
        },
        adUnitCode: 'adunit-code',
        sizes: [
          [300, 250],
        ],
        bidId: '30b31c1838de1e',
        bidderRequestId: '22edbae2733bf6',
        auctionId: '1d1a030790a475',
      };
    }

    it('should return true when bidder set correctly', function () {
      expect(spec.isBidRequestValid(makeBid())).to.equal(true);
    });

    it('should return false when bidder not set correctly', function () {
      let bid = makeBid();
      delete bid.bidder;
      expect(spec.isBidRequestValid(bid)).to.equal(false);
    });
  });

  describe('buildRequests', function () {
    const BIDREQ = {
      bidder: BIDDER_CODE,
      params: {
        tagId: '403370',
        siteId: 'example.com',
      },
      sizes: [
        [300, 250],
      ],
      bidId: '30b31c1838de1e',
      bidderRequestId: '22edbae2733bf6',
      auctionId: '1d1a030790a475',
    }
    const bidRequests = [BIDREQ];

    const bannerRequest = spec.buildRequests(bidRequests, {refererInfo: { referer: BID_REQ_REFER }})[0];
    const bannerRequestBody = bannerRequest.data;
    it('send bid request to the correct endpoint URL', function () {
      expect(bannerRequest.url).to.equal(BIDDER_ENDPOINT_URL);
    });

    it('sends bid request to our endpoint via POST', function () {
      expect(bannerRequest.method).to.equal('POST');
    });

    it('sends screen dimensions', function () {
      expect(bannerRequestBody.device.w).to.equal(screen.width);
      expect(bannerRequestBody.device.h).to.equal(screen.height);
    });

    it('includes the ad size in the bid request', function () {
      expect(bannerRequestBody.imp[0].banner.format[0].w).to.equal(BIDREQ.sizes[0][0]);
      expect(bannerRequestBody.imp[0].banner.format[0].h).to.equal(BIDREQ.sizes[0][1]);
    });

    it('sets domain and href correctly', function () {
      expect(bannerRequestBody.site.domain).to.equal(BIDREQ.params.siteId);
      expect(bannerRequestBody.site.page).to.equal(BID_REQ_REFER);
    });

    const gdprBidRequests = [{
      bidder: BIDDER_CODE,
      params: {
        tagId: '403370',
        siteId: 'example.com',
        floor: 0.21,
        keywords: {},
        floorSizeMap: {}
      },
      sizes: [
        [300, 250]
      ],
      bidId: '30b31c1838de1e',
      bidderRequestId: '22edbae2733bf6',
      auctionId: '1d1a030790a475'
    }];
    const consentString = 'BOJ/P2HOJ/P2HABABMAAAAAZ+A==';

    const GDPR_REQ_REFERER = 'http://localhost:9876/'
    function getGdprRequestBody(gdprApplies, consentString) {
      const gdprRequest = spec.buildRequests(gdprBidRequests, {
        gdprConsent: {
          gdprApplies: gdprApplies,
          consentString: consentString,
        },
        refererInfo: {
          referer: GDPR_REQ_REFERER,
        },
      })[0];
      return gdprRequest.data;
    }

    it('should handle gdpr applies being present and true', function() {
      const gdprRequestBody = getGdprRequestBody(true, consentString);
      expect(gdprRequestBody.regs.ext.gdpr).to.equal(1);
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdpr applies being present and false', function() {
      const gdprRequestBody = getGdprRequestBody(false, consentString);
      expect(gdprRequestBody.regs.ext.gdpr).to.equal(0);
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdpr applies  being undefined', function() {
      const gdprRequestBody = getGdprRequestBody(undefined, consentString);
      expect(gdprRequestBody.regs).to.deep.equal({ext: {}});
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdpr consent being undefined', function() {
      const gdprRequest = spec.buildRequests(gdprBidRequests, {refererInfo: { referer: GDPR_REQ_REFERER }})[0];
      const gdprRequestBody = gdprRequest.data;
      expect(gdprRequestBody.regs).to.deep.equal({ ext: {} });
      expect(gdprRequestBody.user).to.deep.equal({ ext: {} });
    })
  });

  describe('interpretResponse', function () {
    const bidRequests = [
      {
        bidder: BIDDER_CODE,
        params: {
          tagId: '403370',
          siteId: 'example.com',
          currency: 'USD',
        },
        sizes: [
          [300, 250],
        ],
        bidId: '30b31c1838de1e',
        bidderRequestId: '22edbae2733bf6',
        auctionId: '1d1a030790a475',
      },
    ];
    const request = spec.buildRequests(bidRequests, {refererInfo: { referer: BID_REQ_REFER }})[0];
    function makeResponse() {
      return {
        body: {
          id: '5e5c23a5ba71e78',
          seatbid: [
            {
              bid: [
                {
                  id: '6vmb3isptf',
                  crid: 'deltaprojectsOpenRTBscreative',
                  impid: '322add653672f68',
                  price: 1.22,
                  adm: '<!-- creative -->',
                  attr: [5],
                  h: 90,
                  nurl: 'http://nurl',
                  w: 728,
                }
              ],
              seat: 'MOCK'
            }
          ],
          bidid: '5e5c23a5ba71e78',
          cur: 'USD'
        }
      };
    }
    const expectedBid = {
      requestId: '322add653672f68',
      cpm: 1.22,
      width: 728,
      height: 90,
      creativeId: 'deltaprojectsOpenRTBscreative',
      dealId: null,
      currency: 'USD',
      netRevenue: true,
      mediaType: 'banner',
      ttl: 60,
      ad: '<!-- creative --><div style="position:absolute;left:0px;top:0px;visibility:hidden;"><img src="http://nurl"></div>'
    };

    it('should get the correct bid response', function () {
      let result = spec.interpretResponse(makeResponse(), request);
      expect(result.length).to.equal(1);
      expect(result[0]).to.deep.equal(expectedBid);
    });

    it('should handle a missing crid', function () {
      let noCridResponse = makeResponse();
      delete noCridResponse.body.seatbid[0].bid[0].crid;
      const fallbackCrid = noCridResponse.body.seatbid[0].bid[0].id;
      let noCridResult = Object.assign({}, expectedBid, {'creativeId': fallbackCrid});
      let result = spec.interpretResponse(noCridResponse, request);
      expect(result.length).to.equal(1);
      expect(result[0]).to.deep.equal(noCridResult);
    });

    it('should handle a missing nurl', function () {
      let noNurlResponse = makeResponse();
      delete noNurlResponse.body.seatbid[0].bid[0].nurl;
      let noNurlResult = Object.assign({}, expectedBid);
      noNurlResult.ad = '<!-- creative -->';
      let result = spec.interpretResponse(noNurlResponse, request);
      expect(result.length).to.equal(1);
      expect(result[0]).to.deep.equal(noNurlResult);
    });

    it('handles empty bid response', function () {
      let response = {
        body: {
          id: '5e5c23a5ba71e78',
          seatbid: []
        }
      };
      let result = spec.interpretResponse(response, request);
      expect(result.length).to.equal(0);
    });

    it('should keep custom properties', () => {
      const customProperties = {test: 'a test message', param: {testParam: 1}};
      const expectedResult = Object.assign({}, expectedBid, {[spec.code]: customProperties});
      const response = makeResponse();
      response.body.seatbid[0].bid[0].ext = customProperties;
      const result = spec.interpretResponse(response, request);
      expect(result.length).to.equal(1);
      expect(result[0]).to.deep.equal(expectedResult);
    });
  });
});
