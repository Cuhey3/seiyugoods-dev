const amazon = require('amazon-product-api');
const expectation = require('../util/ObjectExpectationUtil');
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

module.exports = {
  search: function(req) {
    return client.itemSearch({
      searchIndex: "Hobbies",
      keywords: req.body.keywords,
      sort: "-release-date",
      itemPage: 1,
      condition: "New",
      responseGroup: 'BrowseNodes,Images,ItemAttributes,SalesRank,Variations,VariationMatrix',
      domain: 'webservices.amazon.co.jp'
    });
  },
  addTask: function(req) {
    const keywords = req.body.keywords;
    client.itemSearch({
      searchIndex: "Hobbies",
      keywords,
      sort: "-release-date",
      itemPage: 1,
      condition: "New",
      responseGroup: 'BrowseNodes,Images,ItemAttributes,SalesRank,Variations,VariationMatrix',
      domain: 'webservices.amazon.co.jp'
    }).then(function(response) {
      results.push({
        timestamp: new Date().getTime().toString(),
        keywords,
        data: response,
        status: 'success'
      });
      while (results.length > 100) {
        results.shift();
      }
    }).catch(function(error) {
      const validatorResult = validator(error);
      results.push({
        timestamp: new Date().getTime().toString(),
        keywords,
        data: error,
        status: 'error',
        errorType: validatorResult === true ? "too quickly error" : ""
      });
      while (results.length > 100) {
        results.shift();
      }
    });
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
