// jshint esversion: 6, es3: false, node: true
'use strict';

import { registerBidder } from '../src/adapters/bidderFactory.js';
import { BANNER, NATIVE, VIDEO } from '../src/mediaTypes.js';
import * as utils from '../src/utils.js';
import find from 'core-js-pure/features/array/find';

export const BIDDER_CODE = 'deltaprojectsOpenRTB';
export const SUPPORTED_NATIVE_VER = '1.2';
export const BIDDER_ENDPOINT_URL = 'https://d5p.de17a.com/dogfight/prebid';
export const USERSYNC_URL = 'https://userservice.de17a.com/getuid/prebid';

/** -- isBidRequestValid --**/
function isBidRequestValid(bid) {
  if (!bid) return false;

  if (bid.bidder !== BIDDER_CODE) return false;

  // publisher id is required
  const publisherId = utils.deepAccess(bid, 'params.publisher.id')
  if (!publisherId) {
    utils.logError('Invalid bid request, missing publisher id in params');
    return false;
  }

  return true;
}

/** -- Build requests --**/
function buildRequests(validBidRequests, bidderRequest) {
  /** == shared ==**/
  // -- build id
  const id = bidderRequest.auctionId;

  // -- build site
  const loc = utils.parseUrl(bidderRequest.refererInfo.referer);
  const publisher = setOnAny(validBidRequests, 'params.publisher');
  const siteId = setOnAny(validBidRequests, 'params.siteId');
  const site = {
    id: siteId,
    domain: loc.hostname,
    page: loc.href,
    ref: loc.href,
    publisher,
  };

  // -- build device
  const ua = navigator.userAgent;
  const device = {
    ua,
    w: screen.width,
    h: screen.height
  }

  // -- build user, reg
  let user = { ext: {} };
  const regs = { ext: {} };
  const gdprConsent = bidderRequest && bidderRequest.gdprConsent;
  if (gdprConsent) {
    user.ext = { consent: gdprConsent.consentString };
    if (typeof gdprConsent.gdprApplies == 'boolean') {
      regs.ext.gdpr = gdprConsent.gdprApplies ? 1 : 0
    }
  }

  // -- build tmax
  let tmax = (bidderRequest && bidderRequest.timeout > 0) ? bidderRequest.timeout : undefined;

  // build bid specific
  return validBidRequests.map(validBidRequest => {
    const openRTBRequest = buildOpenRTBRequest(validBidRequest, id, site, device, user, tmax, regs);
    return {
      method: 'POST',
      url: BIDDER_ENDPOINT_URL,
      data: openRTBRequest,
      options: { contentType: 'application/json' },
      bids: [validBidRequest],
    };
  });
}

function buildOpenRTBRequest(validBidRequest, id, site, device, user, tmax, regs) {
  // build impression
  const impression = buildImpression(validBidRequest);

  // build test
  const test = utils.deepAccess(validBidRequest, 'params.test') ? 1 : 0

  // build cur
  const currency = utils.deepAccess(validBidRequest, 'params.currency');
  const cur = currency && [currency];

  // build source
  const source = {
    tid: validBidRequest.transactionId,
    fd: 1,
  }

  return {
    id,
    imp: [impression],
    site,
    device,
    user,
    test,
    tmax,
    cur,
    source,
    regs,
    ext: {},
  };
}

function buildImpression(bid) {
  const impression = {
    id: bid.bidId,
    tagid: bid.params.tagId,
    ext: {},
  };

  const bannerMediaType = utils.deepAccess(bid, `mediaTypes.${BANNER}`);
  impression.banner = buildImpressionBanner(bid, bannerMediaType);

  // bidfloor
  if (bid.params.floor) {
    impression.bidfloor = bid.params.floor;
  }

  // ext
  if (bid.params.bidderParams) {
    utils._each(bid.params.bidderParams, (params, partner) => {
      impression.ext[partner] = params;
    });
  }
  return impression;
}

function buildImpressionBanner(bid, bannerMediaType) {
  const bannerSizes = (bannerMediaType && bannerMediaType.sizes) || bid.sizes;
  return {
    format: utils._map(bannerSizes, ([width, height]) => ({ w: width, h: height })),
  };
}

/** -- Interpret response --**/
function interpretResponse(serverResponse, { data: rtbRequest }) {
  if (!serverResponse.body) {
    utils.logWarn('Response body is invalid, return !!');
    return [];
  }

  const { body: { id, seatbid, cur } } = serverResponse;
  if (!id || !seatbid) {
    utils.logWarn('Id / seatbid of response is invalid, return !!');
    return [];
  }

  const rtbReqImps = rtbRequest.imp;
  const bidResponses = [];

  utils._each(seatbid, seatbid => {
    utils._each(seatbid.bid, bid => {
      const rtbImp = rtbReqImps.length === 1 ? rtbReqImps[0] : find(rtbReqImps, imp => imp.id === bid.impid);
      const bidObj = {
        requestId: bid.impid,
        cpm: parseFloat(bid.price),
        width: parseInt(bid.w),
        height: parseInt(bid.h),
        creativeId: bid.crid || bid.id,
        dealId: bid.dealid || null,
        currency: cur,
        netRevenue: true,
        ttl: 60,
      };

      if (rtbImp.video || rtbImp.native) {
        utils.logError('Did not support media type video and native');
        return;
      }

      bidObj.mediaType = BANNER;
      bidObj.ad = bid.adm;
      if (bid.nurl) {
        bidObj.ad += utils.createTrackPixelHtml(decodeURIComponent(bid.nurl));
      }
      if (bid.ext) {
        bidObj[BIDDER_CODE] = bid.ext;
      }
      bidResponses.push(bidObj);
    });
  });
  return bidResponses;
}

/** -- On Bid Won -- **/
function onBidWon(bid) {
  // eslint-disable-next-line no-template-curly-in-string
  if (bid.ad.includes('${AUCTION_PRICE:B64}')) {
    // eslint-disable-next-line no-template-curly-in-string
    bid.ad = bid.ad.replaceAll('${AUCTION_PRICE:B64}', Math.round(bid.cpm * 1000000))
  }
}

/** -- Get user syncs --**/
function getUserSyncs(syncOptions, serverResponses, gdprConsent, uspConsent) {
  const syncs = []

  if (syncOptions.pixelEnabled) {
    let gdpr_params;
    if (gdprConsent) {
      if(typeof gdprConsent.gdprApplies === 'boolean') {
        gdpr_params = `?gdpr=${Number(gdprConsent.gdprApplies)}&gdpr_consent=${gdprConsent.consentString}`;
      } else {
        gdpr_params = `?gdpr_consent=${gdprConsent.consentString}`;
      }
    } else {
      gdpr_params = '';
    }
    syncs.push({
      type: 'image',
      url: USERSYNC_URL + gdpr_params
    });
  }
  return syncs;
}

/** -- Helper methods --**/
function setOnAny(collection, key) {
  for (let i = 0, result; i < collection.length; i++) {
    result = utils.deepAccess(collection[i], key);
    if (result) {
      return result;
    }
  }
}

/** -- Register -- */
export const spec = {
  code: BIDDER_CODE,
  supportedMediaTypes: [BANNER],
  isBidRequestValid,
  buildRequests,
  interpretResponse,
  onBidWon,
  getUserSyncs,
};

registerBidder(spec);
