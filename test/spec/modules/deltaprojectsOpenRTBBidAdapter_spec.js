import { expect } from 'chai';
import {
  BIDDER_CODE,
  BIDDER_ENDPOINT_URL,
  spec,
  SUPPORTED_NATIVE_VER,
} from 'modules/deltaprojectsOpenRTBBidAdapter.js';

describe('deltaprojectsOpenRTBBidAdapter', function() {
  describe('isBidRequestValid', function () {
    function makeBid() {
      return {
        'bidder': BIDDER_CODE,
        'params': {
          'tagId': '403370',
          'siteId': 'example.com',
        },
        'adUnitCode': 'adunit-code',
        'sizes': [
          [300, 250],
        ],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
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
    const bidRequests = [
      {
        'bidder': BIDDER_CODE,
        'params': {
          'tagId': '403370',
          'siteId': 'example.com',
        },
        'sizes': [
          [300, 250],
        ],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
      },
      {
        'bidder': BIDDER_CODE,
        'params': {
          'tagId': '403371',
          'siteId': 'example.com',
        },
        'sizes': [
          [300, 250],
        ],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
        'mediaTypes': {
          'native': {
            'body': { 'required': true, 'sendId': true },
            'clickUrl': { 'required': true, 'sendId': true },
            'cta': { 'required': true, 'sendId': true },
            'icon': { 'required': true, 'sendId': true },
            'image': { 'required': true, 'sendId': true },
            'sponsoredBy': { 'required': true, 'sendId': true },
            'title': { 'required': true, 'sendId': true, 'len': 100 },
          },
        },
      },
    ];

    const bannerRequest = spec.buildRequests(bidRequests, {refererInfo: { referer: 'http://example.com/page?param=val' }})[0];
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
      expect(bannerRequestBody.imp[0].banner.format[0].w).to.equal(300);
      expect(bannerRequestBody.imp[0].banner.format[0].h).to.equal(250);
    });

    it('sets domain and href correctly', function () {
      expect(bannerRequestBody.site.domain).to.equal('example.com');
      expect(bannerRequestBody.site.page).to.equal('http://example.com/page?param=val');
    });

    const nativeRequest = spec.buildRequests(bidRequests, {refererInfo: { referer: 'http://example.com/page?param=val' }})[1];
    const nativeRequestBody = nativeRequest.data;
    it('should have the version in native object set for native bid', function() {
      expect(nativeRequestBody.imp[0].native.ver).to.equal(SUPPORTED_NATIVE_VER);
    });

    it('should have the assets set for native bid', function() {
      const assets = JSON.parse(nativeRequestBody.imp[0].native.request).assets;
      expect(assets[0]).to.deep.equal({'title': {'len': 100}, 'required': 1, 'id': 0});
      expect(assets[1]).to.deep.equal({'img': {'type': 3, 'wmin': 1, 'hmin': 1}, 'required': 1, 'id': 1});
      expect(assets[2]).to.deep.equal({'img': {'type': 1, 'wmin': 1, 'hmin': 1}, 'required': 1, 'id': 2});
      expect(assets[3]).to.deep.equal({'data': {'type': 2}, 'required': 1, 'id': 3});
      expect(assets[4]).to.deep.equal({'data': {'type': 12}, 'required': 1, 'id': 4});
      expect(assets[5]).to.deep.equal({'data': {'type': 1}, 'required': 1, 'id': 5});
    });

    const videoBidRequests = [{
      'bidder': BIDDER_CODE,
      'params': {
        'tagId': '403370',
        'siteId': 'example.com',
        'video': {
          'minduration': 5,
          'maxduration': 10,
          'startdelay': 0
        }
      },
      'bidId': '30b31c1838de1e',
      'bidderRequestId': '22edbae2733bf6',
      'auctionId': '1d1a030790a475',
      'mediaTypes': {
        'video': {
          'context': 'instream',
          'mimes': ['video/x-ms-wmv'],
          'playerSize': [[400, 300]],
          'api': [0],
          'protocols': [2, 3],
          'playbackmethod': [1]
        }
      }
    }];
    const videoRequest = spec.buildRequests(videoBidRequests, {refererInfo: { referer: 'http://localhost:9876/' }})[0];
    const videoRequestBody = videoRequest.data;

    it('should include video params', () => {
      const video = videoRequestBody.imp[0].video;
      expect(video.mimes).to.deep.equal(['video/x-ms-wmv']);
      expect(video.w).to.equal(400);
      expect(video.h).to.equal(300);
      expect(video.api).to.deep.equal([0]);
      expect(video.protocols).to.deep.equal([2, 3]);
      expect(video.playbackmethod).to.deep.equal([1]);
      expect(video.minduration).to.equal(5);
      expect(video.maxduration).to.equal(10);
      expect(video.startdelay).to.equal(0);
    });

    it('sets domain and href correctly', function () {
      expect(videoRequestBody.site.domain).to.equal('localhost');
      expect(videoRequestBody.site.page).to.equal('http://localhost:9876/');
    });

    const gdprBidRequests = [{
      'bidder': BIDDER_CODE,
      'params': {
        'tagId': '403370',
        'siteId': 'example.com',
        'floor': 0.21,
        'keywords': {},
        'floorSizeMap': {}
      },
      'sizes': [
        [300, 250]
      ],
      'bidId': '30b31c1838de1e',
      'bidderRequestId': '22edbae2733bf6',
      'auctionId': '1d1a030790a475'
    }];
    const consentString = 'BOJ/P2HOJ/P2HABABMAAAAAZ+A==';

    function getGdprRequestBody(gdprApplies, consentString) {
      const gdprRequest = spec.buildRequests(gdprBidRequests, {'gdprConsent': {
        'gdprApplies': gdprApplies,
        'consentString': consentString
      },
      refererInfo: {
        referer: 'http://localhost:9876/'
      }})[0];
      return gdprRequest.data;
    }

    it('should handle gdprApplies being present and true', function() {
      const gdprRequestBody = getGdprRequestBody(true, consentString);
      expect(gdprRequestBody.regs.ext.gdpr).to.equal(1);
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdprApplies being present and false', function() {
      const gdprRequestBody = getGdprRequestBody(false, consentString);
      expect(gdprRequestBody.regs.ext.gdpr).to.equal(0);
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdprApplies being undefined', function() {
      const gdprRequestBody = getGdprRequestBody(undefined, consentString);
      expect(gdprRequestBody.regs).to.deep.equal({ext: {}});
      expect(gdprRequestBody.user.ext.consent).to.equal(consentString);
    })

    it('should handle gdprConsent being undefined', function() {
      const gdprRequest = spec.buildRequests(gdprBidRequests, {refererInfo: { referer: 'http://localhost:9876/' }})[0];
      const gdprRequestBody = gdprRequest.data;
      expect(gdprRequestBody.regs).to.deep.equal({ ext: {} });
      expect(gdprRequestBody.user).to.deep.equal({ ext: {} });
    })
  });

  describe('interpretResponse', function () {
    const bidRequests = [
      {
        'bidder': BIDDER_CODE,
        'params': {
          'tagId': '403370',
          'siteId': 'example.com',
          'currency': 'USD'
        },
        'sizes': [
          [300, 250],
        ],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
      }
    ];
    const request = spec.buildRequests(bidRequests, {refererInfo: { referer: 'http://example.com/page?param=val' }})[0];
    function makeResponse() {
      return {
        body: {
          'id': '5e5c23a5ba71e78',
          'seatbid': [
            {
              'bid': [
                {
                  'id': '6vmb3isptf',
                  'crid': 'deltaprojectsOpenRTBscreative',
                  'impid': '322add653672f68',
                  'price': 1.22,
                  'adm': '<!-- creative -->',
                  'attr': [5],
                  'h': 90,
                  'nurl': 'http://nurl',
                  'w': 728,
                }
              ],
              'seat': 'MOCK'
            }
          ],
          'bidid': '5e5c23a5ba71e78',
          'cur': 'USD'
        }
      };
    }
    const expectedBid = {
      'requestId': '322add653672f68',
      'cpm': 1.22,
      'width': 728,
      'height': 90,
      'creativeId': 'deltaprojectsOpenRTBscreative',
      'dealId': null,
      'currency': 'USD',
      'netRevenue': true,
      'mediaType': 'banner',
      'ttl': 60,
      'ad': '<!-- creative --><div style="position:absolute;left:0px;top:0px;visibility:hidden;"><img src="http://nurl"></div>'
    };

    const nativeBidRequests = [
      {
        'bidder': BIDDER_CODE,
        'params': {
          'tagId': '403371',
          'siteId': 'example.com',
        },
        'sizes': [
          [300, 250],
        ],
        'bidId': '30b31c1838de1e',
        'bidderRequestId': '22edbae2733bf6',
        'auctionId': '1d1a030790a475',
        'mediaTypes': {
          'native': {
            'body': { 'required': true, 'sendId': true },
            'clickUrl': { 'required': true, 'sendId': true },
            'cta': { 'required': true, 'sendId': true },
            'icon': { 'required': true, 'sendId': true },
            'image': { 'required': true, 'sendId': true },
            'sponsoredBy': { 'required': true, 'sendId': true },
            'title': { 'required': true, 'sendId': true, 'len': 100 },
          },
        },
      },
    ];
    const nativeRequest = spec.buildRequests(nativeBidRequests, {refererInfo: { referer: 'http://example.com/page?param=val' }})[0];
    function makeNativeResponse() {
      return {
        body: {
          'id': '5e5c23a5ba71e77',
          'seatbid': [
            {
              'bid': [
                {
                  'id': '6vmb3isptf',
                  'crid': 'deltaprojectsOpenRTBscreative',
                  'impid': '322add653672f67',
                  'price': 1.55,
                  'adm': '{"link":{"clicktrackers":[],"url":"https://www.deltaprojectsOpenRTB.com/"},"assets":[{"title":{"text":"Ads With deltaprojectsOpenRTB"},"id":1},{"img":{"w":790,"url":"https://path.to/image","h":294},"id":2},{"img":{"url":"https://path.to/icon"},"id":3},{"data":{"value":"Body here"},"id":4},{"data":{"value":"Learn More"},"id":5},{"data":{"value":"deltaprojectsOpenRTB"},"id":6}],"imptrackers":[],"ver":1}',
                  'ext': {'ad_format': 'native'},
                  'h': 90,
                  'nurl': 'http://nurl',
                  'w': 728
                }
              ],
              'seat': 'MOCK'
            }
          ],
          'bidid': '5e5c23a5ba71e77',
          'cur': 'USD'
        }
      };
    }
    const expectedNativeBid = {
      'requestId': '322add653672f67',
      'cpm': 1.55,
      'width': 728,
      'height': 90,
      'creativeId': 'deltaprojectsOpenRTBscreative',
      'dealId': null,
      'currency': 'USD',
      'netRevenue': true,
      'deltaprojectsOpenRTB': { 'ad_format': 'native' },
      'mediaType': 'native',
      'ttl': 60,
      'native': {
        'clickUrl': 'https://www.deltaprojectsOpenRTB.com/',
        'title': 'Ads With deltaprojectsOpenRTB',
        'image': {'url': 'https://path.to/image', 'height': 294, 'width': 790},
        'icon': 'https://path.to/icon',
        'body': 'Body here',
        'cta': 'Learn More',
        'sponsoredBy': 'deltaprojectsOpenRTB'
      }
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
          'id': '5e5c23a5ba71e78',
          'seatbid': []
        }
      };
      let result = spec.interpretResponse(response, request);
      expect(result.length).to.equal(0);
    });

    it('should get the correct native bid response', function () {
      let result = spec.interpretResponse(makeNativeResponse(), nativeRequest);
      expect(result.length).to.equal(1);
      expect(result[0]).to.deep.equal(expectedNativeBid);
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
