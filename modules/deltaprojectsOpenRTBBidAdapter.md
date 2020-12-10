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
    var adUnits = [
        code: '/19968336/prebid_native_example_1',
        sizes: [
            [360, 360]
        ],
        mediaTypes: {
            native: {
                image: {
                    required: false,
                    sizes: [100, 50]
                },
                title: {
                    required: false,
                    len: 140
                },
                sponsoredBy: {
                    required: false
                },
                clickUrl: {
                    required: false
                },
                body: {
                    required: false
                },
                icon: {
                    required: false,
                    sizes: [50, 50]
                }
            }
        },
        bids: [{
            bidder: 'deltaprojectsOpenRTB',
            params: {
                mid: 606169,                  // required
                adxDomain: 'adx.adform.net',  // optional
                siteId: '23455',              // optional
                priceType: 'gross',            // optional, default is 'net'
                publisher: {                  // optional block
                  id: "2706",
                  name: "Publishers Name",
                  domain: "publisher.com"
                }
            }
        }]
    ];
```

