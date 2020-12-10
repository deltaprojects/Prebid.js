// jshint esversion: 6, es3: false, node: true
'use strict';

import {
  registerBidder
} from '../src/adapters/bidderFactory.js';
import {
  BANNER
} from '../src/mediaTypes.js';
import * as utils from '../src/utils.js';
import { config } from '../src/config.js';

const BIDDER_CODE = 'deltaprojectsOpenRTB';

const NATIVE_PARAMS = {
  title: {
    id: 0,
    name: 'title'
  },
  icon: {
    id: 2,
    type: 1,
    name: 'img'
  },
  image: {
    id: 3,
    type: 3,
    name: 'img'
  },
  sponsoredBy: {
    id: 5,
    name: 'data',
    type: 1
  },
  body: {
    id: 4,
    name: 'data',
    type: 2
  },
  cta: {
    id: 1,
    type: 12,
    name: 'data'
  }
}

export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER],
  isBidRequestValid: bid => !!bid.params.mid,
  buildRequests: buildRequest,
  interpretResponse: buildResponse
};

registerBidder(spec);

function buildResponse(serverResponse, { bids }) {
  if (!serverResponse.body) {
    return;
  }
  const { seatbid, cur } = serverResponse.body;

  const bidResponses = flatten(seatbid.map(seat => seat.bid)).reduce((result, bid) => {
    result[bid.impid - 1] = bid;
    return result;
  }, []);

  return bids.map((bid, id) => {
    const bidResponse = bidResponses[id];
    if (bidResponse) {
      const res = {
        ad: bidResponse.adm,
        requestId: bid.bidId,
        cpm: bidResponse.price,
        creativeId: bidResponse.crid,
        ttl: 360,
        width: bidResponse.w,
        height: bidResponse.h,
        netRevenue: bid.netRevenue === 'net',
        currency: cur,
        mediaType: BANNER,
        bidderCode: BIDDER_CODE
      };
      return res;
    }
  }).filter(Boolean);
}

function buildRequest(validBidRequests, bidderRequest) {
  const page = bidderRequest.refererInfo.referer;
  const adxDomain = 'testdomain:3001';
  const ua = navigator.userAgent;
  const pt = setOnAny(validBidRequests, 'params.pt') || setOnAny(validBidRequests, 'params.priceType') || 'net';
  const tid = validBidRequests[0].transactionId;
  const test = setOnAny(validBidRequests, 'params.test');
  const publisher = setOnAny(validBidRequests, 'params.publisher');
  const siteId = setOnAny(validBidRequests, 'params.siteId');
  const currency = config.getConfig('currency.adServerCurrency');
  const cur = currency && [currency];

  const imp = validBidRequests.map((bid, id) => {
    bid.netRevenue = pt;
    const assets = utils._map(bid.nativeParams, (bidParams, key) => {
      const props = NATIVE_PARAMS[key];
      const asset = {
        required: bidParams.required & 1,
      };
      if (props) {
        asset.id = props.id;
        let wmin, hmin, w, h;
        let aRatios = bidParams.aspect_ratios;

        if (aRatios && aRatios[0]) {
          aRatios = aRatios[0];
          wmin = aRatios.min_width || 0;
          hmin = aRatios.ratio_height * wmin / aRatios.ratio_width | 0;
        }

        if (bidParams.sizes) {
          const sizes = flatten(bidParams.sizes);
          w = sizes[0];
          h = sizes[1];
        }

        asset[props.name] = {
          len: bidParams.len,
          type: props.type,
          wmin,
          hmin,
          w,
          h
        };

        return asset;
      }
    }).filter(Boolean);

    return {
      id: id + 1,
      tagid: bid.params.mid,
      native: {
        request: {
          assets
        }
      }
    };
  });

  const request = {
    id: bidderRequest.auctionId,
    site: { id: siteId, page, publisher },
    device: { ua },
    source: { tid, fd: 1 },
    ext: { pt },
    cur,
    imp
  };

  if (test) {
    request.is_debug = !!test;
    request.test = 1;
  }
  if (utils.deepAccess(bidderRequest, 'gdprConsent.gdprApplies')) {
    request.user = { ext: { consent: bidderRequest.gdprConsent.consentString } };
    request.regs = { ext: { gdpr: bidderRequest.gdprConsent.gdprApplies & 1 } };
  }

  return {
    method: 'POST',
    url: '//' + adxDomain + '/test',
    data: JSON.stringify(request),
    options: {
      contentType: 'application/json'
    },
    bids: validBidRequests
  };
}

function setOnAny(collection, key) {
  for (let i = 0, result; i < collection.length; i++) {
    result = utils.deepAccess(collection[i], key);
    if (result) {
      return result;
    }
  }
}

function flatten(arr) {
  return [].concat(...arr);
}
