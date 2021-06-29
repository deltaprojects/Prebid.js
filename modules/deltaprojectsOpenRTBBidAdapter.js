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

  // user id is required
  const userId = utils.deepAccess(bid, 'params.user.id')
  if (!userId) {
    utils.logError('Invalid bid request, missing user id in params');
    return false;
  }

  // ip address is required
  const ipAddr = utils.deepAccess(bid, 'params.device.ip')
  if (!ipAddr) {
    utils.logError('Invalid bid request, missing user id in params');
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
  const userInfo = setOnAny(validBidRequests, 'params.user')
  const deviceInfo = setOnAny(validBidRequests, 'params.device')
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
    h: screen.height,
    ...deviceInfo
  }

  // -- build user, reg
  let user = { ext: {}, ...userInfo };
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
  const videoMediaType = utils.deepAccess(bid, `mediaTypes.${VIDEO}`);
  const nativeMediaType = utils.deepAccess(bid, `mediaTypes.${NATIVE}`);
  const isDefault = !(nativeMediaType || videoMediaType)

  // banner / default
  if (bannerMediaType || isDefault) {
    impression.banner = buildImpressionBanner(bid, bannerMediaType);
  }

  // video
  if (videoMediaType && videoMediaType.context === 'instream') {
    impression.video = buildImpressionVideo(bid, videoMediaType);
  }

  // native
  if (nativeMediaType) {
    impression.native = buildImpressionNative(nativeMediaType);
  }

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

function buildImpressionVideo(bid, videoMediaType) {
  const video = { placement: 1 };

  // mimes
  video.mimes = videoMediaType.mimes || [];

  // minduratiion
  video.minduration = utils.deepAccess(bid, 'params.video.minduration');

  // maxduration
  video.maxduration = utils.deepAccess(bid, 'params.video.maxduration');

  // protoccol
  if (videoMediaType.protocols) video.protocols = videoMediaType.protocols;

  // w, h
  if (videoMediaType.playerSize && videoMediaType.playerSize.length) {
    const size = videoMediaType.playerSize[0];
    video.w = size[0];
    video.h = size[1];
  }

  // startdelay
  video.startdelay = utils.deepAccess(bid, 'params.video.startdelay');

  // api
  if (videoMediaType.api) video.api = videoMediaType.api;

  // playbackend
  if (videoMediaType.playbackmethod) video.playbackmethod = videoMediaType.playbackmethod;

  return video;
}

function buildImpressionNative(nativeMediaType) {
  const assets = [];

  // title
  const title = nativeMediaType.title;
  if (title) {
    assets.push(setAssetRequired(title, {
      title: { len: title.len },
    }));
  }

  // main
  const img = nativeMediaType.image;
  if (img) {
    assets.push(setAssetRequired(img, {
      img: {
        type: 3, // Main
        wmin: 1,
        hmin: 1,
      },
    }));
  }

  // icon
  const icon = nativeMediaType.icon;
  if (icon) {
    assets.push(setAssetRequired(icon, {
      img: {
        type: 1, // Icon
        wmin: 1,
        hmin: 1,
      },
    }));
  }

  // body
  const body = nativeMediaType.body;
  if (body) {
    assets.push(setAssetRequired(body, { data: { type: 2 } }));
  }

  // cta
  const cta = nativeMediaType.cta;
  if (cta) {
    assets.push(setAssetRequired(cta, { data: { type: 12 } }));
  }

  // sponsoredby
  const sponsoredBy = nativeMediaType.sponsoredBy;
  if (sponsoredBy) {
    assets.push(setAssetRequired(sponsoredBy, { data: { type: 1 } }));
  }

  utils._each(assets, (asset, id) => asset.id = id);
  return {
    request: JSON.stringify({
      ver: SUPPORTED_NATIVE_VER,
      assets,
    }),
    ver: SUPPORTED_NATIVE_VER,
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

      if (rtbImp.video) {
        bidObj.mediaType = VIDEO;
        bidObj.vastXml = bid.adm;
      } else if (rtbImp.native) {
        const native = parseNativeResponse(bid.adm);
        if (native) {
          bidObj.mediaType = NATIVE;
          bidObj.native = buildNativeResponse(native);
        } else {
          utils.logError('Invalid native in response', bid.adm);
        }
      } else {
        bidObj.mediaType = BANNER;
        bidObj.ad = bid.adm;
        if (bid.nurl) {
          bidObj.ad += utils.createTrackPixelHtml(decodeURIComponent(bid.nurl));
        }
      }
      if (bid.ext) {
        bidObj[BIDDER_CODE] = bid.ext;
      }
      bidResponses.push(bidObj);
    });
  });
  return bidResponses;
}

function buildNativeResponse(response) {
  const native = {};
  if (response.link) {
    native.clickUrl = response.link.url;
  }
  utils._each(response.assets, asset => {
    switch (asset.id) {
      case 1:
        native.title = asset.title.text;
        break;
      case 2:
        native.image = buildNativeImg(asset.img);
        break;
      case 3:
        native.icon = buildNativeImg(asset.img);
        break;
      case 4:
        native.body = asset.data.value;
        break;
      case 5:
        native.cta = asset.data.value;
        break;
      case 6:
        native.sponsoredBy = asset.data.value;
        break;
    }
  });
  return native;
}

function buildNativeImg(img) {
  if (img.w || img.h) {
    return {
      url: img.url,
      width: img.w,
      height: img.h,
    };
  } else {
    return img.url;
  }
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
function parseNativeResponse(adm) {
  let native = null;
  try {
    native = JSON.parse(adm);
  } catch (e) {
    utils.logError('Sortable bid adapter unable to parse native bid response:\n\n' + e);
  }
  return native;
}

function setAssetRequired(native, asset) {
  if (native.required) asset.required = 1;
  return asset;
}

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
