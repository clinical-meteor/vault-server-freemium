

let express = require('express');
let bodyParser = require('body-parser');
var OAuthServer = require('express-oauth-server');
 

var options = { 
    useErrorHandler: false, 
    continueMiddleware: false,
}

var app = express();




// configure the server-side collections. The rest of the collections
// exist in common.js and are for both client and server.
var accessTokenCollection = new Meteor.Collection('OAuth2AccessTokens');
// var clientsCollection = new Meteor.Collection('OAuth2Clients');


// // setup the node oauth2 model.
// var meteorModel = new MeteorModel(
//   accessTokenCollection,
//   refreshTokensCollection,
//   clientsCollection,
//   authCodesCollection,
//   true
// );

// console.log('meteorModel', meteorModel)


const model = {
    // // We support returning promises.
    // getAccessToken: function() {
    //     return new Promise('works!');
    // },

    // // Or, calling a Node-style callback.
    // getAuthorizationCode: function(done) {
    //     done(null, 'works!');
    // },

    // // Or, using generators.
    // getClient: function*() {
    //     yield somethingAsync();
    //     return 'works!';
    // },

    // // Or, async/wait (using Babel).
    // getUser: async function() {
    //     await somethingAsync();
    //     return 'works!';
    // }
};

// setup the exported object.
OAuthServerConfig.oauthserver = new OAuthServer({
  model: model,
  grants: ['authorization_code', 'user/*.read'],
  debug: true
});

OAuthServerConfig.collections.accessToken = accessTokenCollection;
OAuthServerConfig.collections.client = clientsCollection;


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(OAuthServerConfig.oauthserver.authorize());
//app.use(bearerToken());

app.all('/oauth/token', function(data){
  //console.log("/oauth/token", data.body);  
  OAuthServerConfig.oauthserver.grant()
});

WebApp.rawConnectHandlers.use(app);


/////////////////////
// Configure really basic identity service
////////////////////
JsonRoutes.Middleware.use(
  '/oauth/getIdentity',
  OAuthServerConfig.oauthserver.authorize()
);

JsonRoutes.add('get', '/oauth/getIdentity', function (req, res, next) {
  console.log('GET /oauth/getIdentity');

  var accessTokenStr = (req.params && req.params.access_token) || (req.query && req.query.access_token);
  var accessToken = OAuthServerConfig.collections.accessToken.findOne({
    accessToken: accessTokenStr
  });
  var user = Meteor.users.findOne(accessToken.userId);

  JsonRoutes.sendResult(
    res, {
      data: {
        id: user._id,
        email: user.emails[0].address
      }
    }
  );
});



////////////////////
// Meteor publish.
///////////////////
Meteor.publish(OAuthServerConfig.pubSubNames.authCodes, function () {
  if (!this.userId) {
    return this.ready();
  }

  return OAuthServerConfig.collections.authCode.find({
    userId: this.userId,
    expires: {
      $gt: new Date()
    }
  });
});

Meteor.publish(OAuthServerConfig.pubSubNames.refreshTokens, function () {
  if (!this.userId) {
    return this.ready();
  }

  return OAuthServerConfig.collections.refreshToken.find({
    userId: this.userId,
    expires: {
      $gt: new Date()
    }
  });
});
Meteor.publish(OAuthServerConfig.pubSubNames.clientsCollection, function () {
  // if the user isn't logged in, don't return any clients
  if (!this.userId) {
    return this.ready();
  }
  // if the user is a sysadmin, return all the clients
  if (Roles.userIsInRole(this.userId, ['sysadmin'])) {
    return OAuthServerConfig.collections.clientsCollection.find();
  } else {
    // otherwise, onlly return a user's own clients
    return OAuthServerConfig.collections.clientsCollection.find({
      'owner.reference': this.userId
    });
  }


});

////////////
// configure the meteor methods.
//////////////
var methods = {};
methods[OAuthServerConfig.methodNames.authCodeGrant] = function (clientId, redirectUri, responseType,
  scope, state) {
  // validate parameters.
  check(clientId, String);
  check(redirectUri, String);
  check(responseType, String);
  check(scope, Match.Optional(Match.OneOf(null, [String])));
  check(state, Match.Optional(Match.OneOf(null, String)));

  console.log('OAuthServerConfig.methodNames.authCodeGrant');

  if (!scope) {
    scope = [];
  }

  // validate the user is authenticated.
  var userId = this.userId;
  if (!userId) {
    return {
      success: false,
      error: 'User not authenticated.'
    };
  }

  // The oauth2-server project relies heavily on express to validate and
  // manipulate the oauth2 grant. A forthcoming version will abstract this
  // behaviour into promises.
  // That being the case, we need to get run an authorization grant as if
  // it were a promise. Warning, the following code is difficult to follow.
  // What we are doing is mocking and express app but never attaching it to
  // Meteor. This allows oauth2-server to behave as it would as if it was
  // natively attached to the webapp. The following code mocks express,
  // request, response, check and next in order to retrive the data we need.
  // Further, we are also running this in a synchronous manner. Enjoy! :)

  // create check callback that returns the user.
  var checkCallback = function (req, callback) {
    callback(
      null, // error.
      true, // user authorizes the code creation.
      {
        id: userId
      }
    );
  };

  // retrieve the grant function from oauth2-server. This method setups up the
  // this context and such. The returned method is what express would normally
  // expect when handling a URL. eg. function(req, res, next)
  var authCodeGrantFn = OAuthServerConfig.oauthserver.authCodeGrant(checkCallback);

  // make the grant function run synchronously.
  var authCodeGrantFnSync = Async.wrap(function (done) {
    // the return object.
    var response = {
      success: false,
      error: null,
      authorizationCode: null,
      redirectToUri: null
    };

    // create mock express app.
    var mockApp = express();
    var req = mockApp.request;

    //console.log('mockApp', mockApp);

    // set the request body values. In a typical express setup, the body
    // would be parsed by the body-parser package. We are cutting out
    // the middle man, so to speak.
    req.body = {
      client_id: clientId,
      response_type: responseType,
      redirect_uri: redirectUri
    };
    req.query = {};

    // listen for redirect calls.
    var res = mockApp.response;
    res.redirect = function (uri) {
      response.redirectToUri = uri;

      // we have what we need, trigger the done function with the response data.
      done(null, response);
    };

    //console.log('res', res);

    // listen for errors.
    var next = function (err) {
      response.error = err;

      // we have what we need, trigger the done function with the response data.
      done(null, response);
    };
    //console.log('next', next);

    // call the async function with the mocked params.
    authCodeGrantFn(req, res, next);
  });

  // run the auth code grant function in a synchronous manner.
  var result = authCodeGrantFnSync();

  console.log('authCodeGrantFnSync', result);


  // update the success flag.
  result.success = !result.error && !(/[?&]error=/g).test(result.redirectToUri);

  // set the authorization code.
  if (result.redirectToUri) {
    var match = result.redirectToUri.match(/[?&]code=([0-9a-f]+)/);
    if (match.length > 1) {
      result.authorizationCode = match[1];
    }

    // add the state to the url.
    if (state) {
      result.redirectToUri += '&state=' + state;
    }
  }
  console.log('OAuthServerConfig.methodNames.authCodeGrant', result);

  return result;
};

Meteor.methods(methods);