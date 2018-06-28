"use strict";

require("dotenv").config({
	silent : true
});

var express = require("express");
var bodyParser = require("body-parser");
var watson = require("watson-developer-cloud");
var Cloudant = require("cloudant");
var vcapServices = require("vcap_services");
var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');

var WORKSPACE_ID = vcapServices.WORKSPACE_ID || process.env.WORKSPACE_ID || "<workspace-id>";

var vodafone, idea, airtel = false;

var app = express();

app.use(express.static("./public"));
app.use(bodyParser.json());

var cloudantv = vcapServices.getCredentials("cloudantvNoSQLDB");
var cv = vcapServices.getCredentials("conversation");


var conversation = watson.conversation({
	url : "https://gateway.watsonplatform.net/conversation/api",
	username : cv.username || '',
	password : cv.password || '',
	version_date : process.env.CONVERSATION_VERSION_DATE,
	version : process.env.CONVERSATION_VERSION
});

var discovery = new DiscoveryV1({
  username: process.env.DISCOVERY_USERNAME,
  password: process.env.DISCOVERY_PASSWORD,
  version_date: DiscoveryV1.VERSION_DATE_2017_04_27
});

var usersMap;
var cloudant = Cloudant({account:cloudantv.username, password:cloudantv.password});
var db = cloudant.db.use(process.env.CLOUDANT_DB_NAME);


function loadUserData() {
	usersMap = new Map();
	db.list({include_docs:true}, function (err, data) {
		if (err) {
			throw err;
		}
		for (var i = 0; i < data.rows.length; i++) {
			var userDetails = [data.rows[i].doc.name, data.rows[i].doc.mobileNumber, data.rows[i].doc.emailId, data.rows[i].doc.address];
			usersMap.set(data.rows[i].doc.userName, userDetails);
		}
	});
}

loadUserData();

app.post("/api/sendmessage", function(req, res) {
		var workspace = WORKSPACE_ID;
	if (!workspace || workspace === "<workspace-id>") {
		return res.json({
		  "output": {
			"text": "Your app is yet to be configured with environment variable."
			}
		});
	}

	var userName = req.body.context.userName;

	getPerson(userName, function(err, person) {

		if(err){
			console.log("Error occurred while getting person data ::", err);
			return res.status(err.code || 500).json(err);
		}

		var payload = {
			workspace_id : workspace,
			context : {
				"name" : person.name,
				"userName" : person.userName,
				"emailId" : person.emailId,
				"address" : person.address,
				"mobileNumber" : person.mobileNumber,
			},
			input : {}
		};

		if (req.body) {
			if (req.body.input) {
				payload.input = req.body.input;
			}
			if (req.body.context) {
				payload.context = req.body.context;
				payload.context.name = person.name;
				payload.context.userName = person.userName;
				payload.context.emailId = person.emailId;
				payload.context.address = person.address;
				payload.context.mobileNumber = person.mobileNumber;
			}
		}

		callconversation(payload);

	});

	function callconversation(payload) {
		conversation.message(payload, function(err, data) {
			if (err) {
				console.log("Error occurred while invoking Conversation. ::", err);
				return res.status(err.code || 500).json(err);
			}
			if (data.context && data.context.updateEmail && data.context.updateEmail !== '') {
				updateEmail(userName, data.context.updateEmail);
				data.context.updateEmail = '';
			} else if (data.context && data.context.updateAddress && data.context.updateAddress !== '') {
				updateAddress(userName, data.context.updateAddress);
				data.context.updateAddress = '';
			}

			vodafone = false;
			idea = false;
			airtel = false;

			if (data.intents[0] && data.intents[0].intent) {
				if (data.intents[0].intent == 'plans' ) {
					if (data.entities[0].entity == 'service_provider' && data.entities[0].value == 'Vodafone') {
						vodafone = true;
					} else if (data.entities[0].entity == 'service_provider' && data.entities[0].value == 'Idea') {
						idea = true;
					} else if (data.entities[0].entity == 'service_provider' && data.entities[0].value == 'Airtel') {
						airtel = true;
					}
				}
			}

			if(vodafone){
			discovery.query({
			    environment_id: process.env.DISCOVERY_ENVIRONMENT_ID,
			    collection_id: process.env.DISCOVERY_COLLECTION_ID,
			    query: 'enriched_text.entities.text:Vodafone Plan',
					passages: 'true'
			  }, function(err, response) {
			        if (err) {
			          console.error(err);
			        } else {
			          console.log(JSON.stringify(response, null, 2));
								var disResponse = response.passages[0].passage_text;
								data.output.text = disResponse;
								return res.json(data);
			        }
			   });
			} else if (airtel) {
				discovery.query({
				    environment_id: process.env.DISCOVERY_ENVIRONMENT_ID,
				    collection_id: process.env.DISCOVERY_COLLECTION_ID,
				    query: 'enriched_text.entities.text:Bharti Airtel',
						passages: 'true'
				  }, function(err, response) {
				        if (err) {
				          console.error(err);
				        } else {
				          console.log(JSON.stringify(response, null, 2));
									var disResponse = response.passages[0].passage_text;
									data.output.text = disResponse;
									return res.json(data);
				        }
				   });
			}
			else{
			return res.json(data);
		  }

		});
	}

});

function updateEmail(username, email) {
	db.find({selector:{userName:username}}, function(err, result) {
	  if (err) {
	    throw err;
	  }
	  var user = {
			"_id": result.docs[0]._id,
	    "_rev" : result.docs[0]._rev,
			"userName" : result.docs[0].userName,
			"name" : result.docs[0].name,
	    "emailId": email,
			"mobileNumber" : result.docs[0].mobileNumber,
			"address" : result.docs[0].address
	  };
	  db.insert(user, function(err, body) {
			if (err) {
				throw err;
			}
			usersMap = null;
			loadUserData();
		});
	});
}

function updateAddress(username, address) {
	db.find({selector:{userName:username}}, function(err, result) {
	  if (err) {
	    throw err;
	  }
	  var user = {
			"_id": result.docs[0]._id,
	    "_rev" : result.docs[0]._rev,
			"userName" : result.docs[0].userName,
			"name" : result.docs[0].name,
	    "emailId": result.docs[0].emailId,
			"mobileNumber" : result.docs[0].mobileNumber,
			"address" : address
	  };
	  db.insert(user, function(err, body) {
			if (err) {
				throw err;
			}
			usersMap = null;
			loadUserData();
		});
	});
}

 app.post("/api/validateuser", function(req, res) {
	 var userName = req.body.input.userName;
	 var output = {};
	 getPerson(userName, function(err, person) {
		 if (err) {
			 console.log("Error occurred while getting person data ::", err);
			 return res.status(err.code || 500).json(err);
		 }
		 if (person) {
			 output = {
				 "valid": "yes"
			 };
		 } else {
			 output = {
				 "valid": "no"
			 };
		 }
		 return res.json(output);
	});
});

function getPerson(userName, callback) {
	var person = {};
	if (usersMap !== undefined && usersMap !== null) {
		if (usersMap.has(userName)) {
			var userDetails = usersMap.get(userName);
			person = {
				"userName": userName,
				"name": userDetails[0],
				"mobileNumber": userDetails[1],
				"emailId": userDetails[2],
				"address": userDetails[3]
			};
		} else {
			person = null;
		}
		callback(null, person);
	} else {
		loadUserData();
	}
	return;
}

module.exports = app;
