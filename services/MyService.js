const amazon = require('../my-pa-api');
const { createValidator, isString } = require('../util/ObjectExpectationUtil');
const { Queue, WorkerCreator } = require('../queue');

const isRequestThrottledError = createValidator({
  "$": { "xmlns": "http://ecs.amazonaws.com/doc/2013-08-01/" },
  "Error": [{
    "Code": ["RequestThrottled"],
    "Message": ["AWS Access Key ID: " + process.env['AWS_ID'] + ". You are submitting requests too quickly. Please retry your requests at a slower rate."]
  }]
});

const isSignatureDoesNotMatchError = createValidator({
  "$": { "xmlns": "http://ecs.amazonaws.com/doc/2013-08-01/" },
  "Error": [{
    "Code": ["SignatureDoesNotMatch"],
    "Message": ["The request signature we calculated does not match the signature you provided. Check your AWS Secret Access Key and signing method. Consult the service documentation for details."]
  }]
});

const isValidResponse = createValidator({
  "Items": [{
    "Request": [{
      "IsValid": ["True"],
      "ItemSearchRequest": [{}]
    }],
    "TotalResults": [isString],
    "TotalPages": [isString],
    "Item": [{}]
  }]
});

const client = amazon.createClient({
  awsId: process.env["AWS_ID"],
  awsSecret: process.env["AWS_SECRET"],
  awsTag: process.env["AWS_TAG"]
});

const results = [];
const resultTimeStamps = {};

const myQueue = new Queue(new WorkerCreator(
  // initialProcess
  function(_item) {
    const item = Object.assign({}, {
      searchIndex: "Hobbies",
      sort: "-release-date",
      itemPage: 1,
      condition: "New",
      responseGroup: 'BrowseNodes,Images,ItemAttributes,SalesRank',
      domain: 'webservices.amazon.co.jp',
      aggregatedData: [],
      requestStartTime: new Date().getTime()
    }, _item);
    return Promise.resolve(item);
  },
  // mainProcess
  function(item) {
    return Promise.resolve(item)
      .then(function(item) {
        return new Promise(function(resolve, reject) {
          setTimeout(function() {
            resolve(item);
          }, 1000)
        }).then(client.itemSearch);
      })
      .then(function(response) {
        const validResponse = isValidResponse(response.data);
        if (validResponse === true) {
          console.log('valid response', JSON.stringify(response.data.Items[0].Item.length));
          item.data = response.data;
          return Promise.resolve(item);
        }
        else {
          console.log('unrecognized response', response);
          return new Promise(function(resolve, reject) {
            reject(response);
          });
        }
      });
  },
  // continuousProcessCreator
  function(creator) {
    return function(item) {
      var totalPage = Number(item.data.Items[0].TotalPages[0]);
      var itemPage = item.itemPage;
      item.aggregatedData = item.aggregatedData.concat(item.data.Items[0].Item);
      if (totalPage && itemPage < 10 && totalPage > itemPage) {
        console.log('lets continue.', totalPage, itemPage);
        item.itemPage++;
        console.log('new item page', item.itemPage);
        return Promise.resolve(item).then(creator);
      }
      else {
        console.log('continue end.', totalPage, itemPage);
        return Promise.resolve(item);
      }

    };
  },
  // completeProcess
  function(item) {
    if (!(String(item.requestStartTime) in resultTimeStamps)) {
      resultTimeStamps[String(item.requestStartTime)] = true;
      var result = {
        keywords: item.keywords,
        data: item.aggregatedData,
        itemCount: item.aggregatedData.length,
        timestamp: String(item.requestStartTime),
        processTime: new Date().getTime() - item.requestStartTime
      }
      results.push(result);
    }
    return Promise.resolve(item);
  },
  //retryProcessCreator
  function(creator) {
    const delayer = function(item) {
      return 5000;
    };
    return function(item) {
      console.log("retryProcess...", JSON.stringify(item.data));
      if (isRequestThrottledError(item.data) === true) {
        item.errorType = "request_throttoled_error";
        console.log(item.errorType);
      }
      else if (isSignatureDoesNotMatchError(item.data) === true) {
        item.errorType = "signature_does_not_match_error";
        console.log(item.errorType);
      }
      else {
        console.log('unrecognized error');
      }
      item.retryCount = (item.retryCount || 0) + 1;
      console.log('retry...');
      const delay = delayer(item);
      return new Promise(function(resolve, reject) {
        setTimeout(function() {
          resolve(item);
        }, delay);
        console.log("waiting.", delay);
      }).then(creator);
    }
  }), { period: 2000 });

myQueue.start();

module.exports = {
  addTask: function(req) {
    myQueue.addTask({ Keywords: req.body.keywords });
    return Promise.resolve({ status: 'accepted' });
  },
  getResultList: function(req) {
    return Promise.resolve(results);
  },
  findResultDetail: function(req) {
    const requestId = req.params.requestId;
    return Promise.resolve(results.find(function(result) {
      return result.timestamp === requestId;
    }));
  }
};
