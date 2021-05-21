# Overview

```
Module Name:  Delta Projects OpenRTB Bid Adapter
Module Type:  Bidder Adapter
Maintainer:   dev@deltaprojects.com
```

# Description

Connects to Delta Projects DSP for bids.

# Test Parameters
```
// define banner unit
var bannerUnit = {
  code: 'div-gpt-ad-1460505748561-0',
  mediaTypes: {
    banner: {
      sizes: [[300, 250], [300,600]],
    }
  },
  // Replace this object to test a new Adapter!
  bids: [{
    bidder: 'deltaprojectsOpenRTB',
    params: {
    }
  }]
};

// define video ad unit
var videoAdUnit = {
  code: 'video-1',
  mediaTypes: {
    video: {
      context: 'instream',
      playerSize: [640, 480],
    },
  },
  fpd: {
    context: {
      pbAdSlot: '/19968336/prebid_cache_video_adunit',
    },
  },
  bids: [
    {
      bidder: 'deltaprojectsOpenRTB',
      params: {
        ad_unit: 'instream'
      },
    },
  ],
};

// define native ad unit
var nativeAdUnit = {
    code: '/19968336/prebid_native_example_1',
    sizes: [[360, 360],],
    mediaTypes: {
      native: {
        title: {
          required: true,
        },
        image: {
          required: true,
        },
        sponsoredBy: {
          required: true,
        },
      },
    },
    bids: [
      {
        bidder: 'deltaprojectsOpenRTB',
        params: {
        
        },
      },
    ],
  };
```

