const amazon = require('amazon-product-api');

const client = amazon.createClient({
  awsId: process.env['AWS_ID'],
  awsSecret: process.env['AWS_SECRET'],
  awsTag: process.env['AWS_TAG']
});


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
  }
};
