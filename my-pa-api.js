var request = require('request'),
  parseXML = require('xml2js').parseString;

var generateQueryString = function(query, method, credentials) {
  var unsignedString = '';
  var domain = query.domain || 'webservices.amazon.com';
  var params = formatQueryParams(query, method, credentials);
  // generate query
  unsignedString = Object.keys(params).map(function(key) {
    return key + "=" + encodeURIComponent(params[key]).replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16);
    });
  }).join("&")

  var signature = encodeURIComponent(generateSignature('GET\n' + domain + '\n/onca/xml\n' + unsignedString, credentials.awsSecret)).replace(/\+/g, '%2B');
  var queryString = 'https://' + domain + '/onca/xml?' + unsignedString + '&Signature=' + signature;

  return queryString;
};

var runQuery = function(credentials, method) {
  try {
    return function(query, cb) {
      var req = query.request || request;
      delete query.request;
      var url = generateQueryString(query, method, credentials);

      var p = new Promise(function(resolve, reject) {
        var success = function(results) {
          if (typeof cb === 'function') {
            cb.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
          }
          else {
            resolve(results);
          }
        };

        var failure = function(err) {
          if (typeof cb === 'function') {
            cb.call(null, err);
          }
          else {
            reject(err);
          }
        };


        req(url, function(err, response, body) {
          if (err) {
            console.log('err1');
            query.data = err;
            failure(query);
          }
          else if (!response) {
            console.log('err2');
            failure("No response (check internet connection)");
          }
          else if (response.statusCode !== 200) {
            parseXML(body, function(err, resp) {
              if (err) {
                console.log('err3');

                query.data = err
                failure(query);
              }
              else {
                console.log('err4');
                query.data = resp[method + 'ErrorResponse'];
                failure(query);
              }
            });
          }
          else {
            parseXML(body, function(err, resp) {
              if (err) {
                console.log('err5');

                query.data = err
                failure(query);
              }
              else {
                var respObj = resp[method + 'Response'];
                query.data = respObj;
                success(query);
              }
            });
          }
        });
      });

      if (typeof cb !== 'function') {
        return p;
      }
    };
  }
  catch (e) {
    console.log(e);
  }
};

var createClient = function(credentials) {
  return {
    itemSearch: runQuery(credentials, 'ItemSearch'),
    itemLookup: runQuery(credentials, 'ItemLookup'),
    browseNodeLookup: runQuery(credentials, 'BrowseNodeLookup')
  };
};

exports.createClient = createClient;

var crypto = require('crypto');

var generateSignature = function(stringToSign, awsSecret) {
  var hmac = crypto.createHmac('sha256', awsSecret);
  var signature = hmac.update(stringToSign).digest('base64');
  return signature;
};

var sort = function(object) {
  var sortedObject = {};
  var keys = Object.keys(object).sort();
  for (var i = 0; i < keys.length; i++) {
    sortedObject[keys[i]] = object[keys[i]];
  };
  return sortedObject;
}

var capitalize = function(string) {
  return string[0].toUpperCase() + string.slice(1)
}

var setDefaultParams = function(params, defaultParams) {
  for (var param in defaultParams) {
    if (typeof params[param] === 'undefined') {
      params[param] = defaultParams[param];
    }
  }
  return params;
}

var formatQueryParams = function(query, method, credentials) {
  var params = {};

  // format query keys
  for (var param in query) {
    var capitalized = capitalize(param);
    params[capitalized] = query[param];
  }

  if (method === 'ItemSearch') {
    // Default
    params = setDefaultParams(params, {
      SearchIndex: 'All',
      Condition: 'All',
      ResponseGroup: 'ItemAttributes',
      Keywords: '',
      ItemPage: '1'
    });

  }
  else {
    // TBD
  }

  // Constants
  params['Version'] = '2013-08-01';

  // Common params
  params['AWSAccessKeyId'] = credentials.awsId;
  // awsTag is associated with domain, so it ought to be defineable in query.
  params['AssociateTag'] = query.awsTag || credentials.awsTag;
  params['Timestamp'] = new Date().toISOString();
  params['Service'] = 'AWSECommerceService';
  params['Operation'] = method;

  // sort
  params = sort(params);
  return params;
}
