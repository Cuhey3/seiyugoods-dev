const amazon = require('amazon-product-api');
const expectation = require('../util/ObjectExpectationUtil');
const { Queue, WorkerCreator } = require('../queue');

const validator = expectation.createValidator({
  "Error": [{
    "Code": ["RequestThrottled"],
    "Message": ["AWS Access Key ID: " + process.env['AWS_ID'] + ". You are submitting requests too quickly. Please retry your requests at a slower rate."]
  }]
});

const client = amazon.createClient({
  awsId: process.env['AWS_ID'],
  awsSecret: process.env['AWS_SECRET'],
  awsTag: process.env['AWS_TAG']
});

const results = [];

const myQueue = new Queue(new WorkerCreator(
  // initialProcess
  function(_item) {
    const item = Object.assign({}, _item, {
      searchIndex: "Hobbies",
      sort: "-release-date",
      itemPage: 1,
      condition: "New",
      responseGroup: 'BrowseNodes,Images,ItemAttributes,SalesRank,Variations,VariationMatrix',
      domain: 'webservices.amazon.co.jp'
    });
    return Promise.resolve(item);
  },
  // mainProcess
  function(item) {
    return Promise.resolve(item)
      .then(client.itemSearch)
      .then(function(response) {
        return Promise.resolve({
          timestamp: new Date().getTime().toString(),
          keywords: item.keywords,
          data: response,
          status: 'success'
        });
      })
      .catch(function(error) {
        const validatorResult = validator(error);
        if (!validatorResult) {
          return Promise.resolve({
            timestamp: new Date().getTime().toString(),
            keywords: item.keywords,
            data: error,
            status: 'error'
          });
        }
        else {
          item.errorType = "too_quickly_error";
          return new Promise(function(resolve, reject) {
            reject(item);
          });
        }
      });
  },
  // completeProcess
  function(item) {
    results.push(item);
    return Promise.resolve(item);
  },
  //retryProcessCreator
  function(creator) {
    const delayer = function(item) {
      return 5000;
    };
    return function(item) {
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
  }));

myQueue.start();

module.exports = {
  addTask: function(req) {
    const keywords = req.body.keywords;
    myQueue.addTask({ keywords });
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
