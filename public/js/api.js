var Api = (function() {
  var requestPayload;
  var responsePayload;
  var messageEndpoint = '/api/sendmessage';

  return {
    sendRequest : sendRequest,
    validate : validate,

    getRequestPayload: function() {
      return requestPayload;
    },
    setRequestPayload: function(newPayloadStr) {
      requestPayload = JSON.parse(newPayloadStr);
    },
    getResponsePayload: function() {
      return responsePayload;
    },
    setResponsePayload: function(newPayloadStr) {
      responsePayload = JSON.parse(newPayloadStr);
    }
  };

  function sendRequest(text, context) {

    var payloadToWatson = {};
    if (text) {
      payloadToWatson.input = {
        text: text
      };
    }

    if (context) {
      payloadToWatson.context = context;
    } else {
    	payloadToWatson.context = {userName : sessionStorage.userName};
    }

    var httpp = new XMLHttpRequest();
    httpp.open('POST', messageEndpoint, true);
    httpp.setRequestHeader('Content-type', 'application/json');

    httpp.onreadystatechange = function() {
      if (httpp.readyState === 4 && httpp.status === 200 && httpp.responseText) {
        Api.setResponsePayload(httpp.responseText);
        document.getElementById('lblName').innerHTML=JSON.parse(httpp.response).context.userName;
        document.getElementById('lblEmail').innerHTML=JSON.parse(httpp.response).context.emailId;
        document.getElementById('lblAddress').innerHTML=JSON.parse(httpp.response).context.address;
      }

  		var jsonResponse = JSON.parse(httpp.responseText);

    };

    var params = JSON.stringify(payloadToWatson);

    if (Object.getOwnPropertyNames(payloadToWatson).length !== 0) {
      Api.setRequestPayload(params);
    }

    httpp.send(params);
  }

  function validate(userName) {
    var payloadToService = {};
    if (userName) {
      payloadToService.input = {
        userName : userName
      };
    }
    var http = new XMLHttpRequest();
    http.open('POST', '/api/validateuser', true);
    http.setRequestHeader('Content-type', 'application/json');
    http.onreadystatechange = function() {
      if (http.readyState === 4 && http.status === 200 && http.responseText) {
        if (JSON.parse(http.response).valid === 'yes') {
          window.location = '/chat.html';
        } else {
          window.alert('Invalid userName');
          return;
        }
      }
    };
    var params = JSON.stringify(payloadToService);
    http.send(params);
  }

}());
