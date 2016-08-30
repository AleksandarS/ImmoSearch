"use strict";
var immobilien = [
	//Berlin - Friedrichshain, Maobit, Mitte, Kreuzberg, Prenzlauer Berg, Tiergarten, Wedding
	{ type: "immonet", url: "http://www.immonet.de/immobiliensuche/sel.do?pageoffset=1&listsize=25&objecttype=1&locationname=Berlin&acid=&actype=&district=7605&district=7876&district=7889&district=54793&district=7899&district=7926&district=7930&ajaxIsRadiusActive=true&sortby=19&suchart=1&radius=0&pCatMTypeStoragefield=1_2&pcatmtypes=1_2&parentcat=1&marketingtype=2&fromprice=&toprice=800&fromarea=&toarea=&fromplotarea=&toplotarea=&fromrooms=2&torooms=3%2C5&absenden=Ergebnisse+anzeigen&objectcat=-1&wbs=-1&fromyear=&toyear=&fulltext="},
	//Berlin - Friedrichshain, Mitte, Kreuzberg, Prenzlauer Berg, Tiergarten, Wedding
	{ type: "immobilienscout24", url: "https://www.immobilienscout24.de/Suche/S-2/Wohnung-Miete/Berlin/Berlin/Mitte-Mitte_Kreuzberg-Kreuzberg_Friedrichshain-Friedrichshain_Prenzlauer-Berg-Prenzlauer-Berg_Wedding-Wedding_Tiergarten-Tiergarten/2,00-3,50/-/EURO--800,00/-/-/false?enteredFrom=result_list"}
];

var PushbulletKey = "XXXXX"; // Pushbullet API token

var request 	= require('request'),
	cheerio 	= require('cheerio'),
	MongoClient = require('mongodb').MongoClient,
	mongodbUrl 	= 'mongodb://localhost:27017/immosearch';

go();

setInterval( function() {
	go();
},  60 * 1000);

function go() {

	immobilien.forEach( function(item, index) {

		if( item.type == "immonet" ) {
			immonetPage(item.url);
		}

		if( item.type == "immobilienscout24" ) {
			immoscoutPage(item.url);
		}

	});

}

function saveObject(type,id, object) {

	MongoClient.connect(mongodbUrl, function(err, db) {

		if( err ) {
		    console.log('Unable to connect to the mongoDB server. Error:', err);
		} else {

			var collection = db.collection('immoObjects');

			collection.insertOne({
			      type: type,
			      their_id: id,
			      our_id: type + "_" + id,
			      created: Date.now()
			   }, function(err, result) {
	      			if( err ) {
	        			if( err.code != 11000 ) {
	        				console.log(err);
	        			}
	      			} else {
	      				pingMe(type,object);
	      			}
		      		db.close();
	    		});
		}
	});
}

function pingMe(type,object) {
	console.log("New apartment with " + trimmer(object.rooms) + " rooms at " + trimmer(object.place)+ " posted on "+type+".");
	var options = { method: 'POST',
	  url: 'https://api.pushbullet.com/v2/pushes',
	  headers: 
	   { 
	     'cache-control': 'no-cache',
	     'content-type': 'application/json',
	     'access-token': PushbulletKey },
	  body: 
	   { body: 'Portal: '+type+' \nRooms: '+trimmer(object.rooms)+'\nPrice: '+trimmer(object.price)+'\nLocation: '+ trimmer(object.place)+ '\n\nURL: '+object.url,
	     title: 'New apartment on '+type,
	     type: 'note' },
	  json: true };

	request(options, function(error, response, body) {
	  if( error ) throw new Error( error );

	});
}

function immonetPage(url) {
	request(url, function(error, response, html) {
		if( !error ) {
		    var $ = cheerio.load(html);
		    console.log("immonet going");
		    $( '.listViewLeft > div' ).each(function(i, elem) {
		    	if( !$(this).hasClass('clearfix') ) {
		    		if( $(this).hasClass('recoSeparator') ) {
		    			return false;
		    		}
		    		if( !$(this).find('.title').text().toLowerCase().includes('sozialwohnung') && !$(this).find('.title').text().toLowerCase().includes('wbs') && !$(this).find('.title').text().toLowerCase().includes('wohnberechtigungsschein') ) {
						immonetSingle($(this));
		    		}

		    	}
			});

		}else{
		    console.log(error);
		}
	});	
}

function immonetSingle(element) {
	var id 		= element.find('.objImgLink').attr('href').substring(9),
		url 	= "http://www.immonet.de" + element.find('.objImgLink').attr('href'),
		price 	= element.find('.listObjPrice .fsLarge').text(),
		place 	= element.find('.listObject .toggleTransparency > .selListItem > .fsSmall.lhMiddle').text().replace(/\s+/g, " ").split(" in ")[1],
		rooms	= element.find('.objDetails li:nth-child(2)').html().replace(/\s+/g, "").split("<br>")[0],
		img 	= element.find('.objImgLink img').attr('src');

	request( url, function(error, response, html) {
		if( !error ) {
		    if ( !multiSearchOr(html, ["WBS", "SOZIALWOHNUNG", "WOHNBERECHTIGUNGSSCHEIN"]) ) {
		    	var object = {id:id,url:url,price:price,place:place,rooms:rooms,img:img};
		    	saveObject("immonet",id, object);
		    }
		}else{
		    immonetSingle(element);
		}
	});
}

function immoscoutPage(url) {
	request( url, function(error, response, html) {
		if( !error ) {
		    var $ = cheerio.load(html);
		    
		    console.log("immoscout going");
		    $( '#resultListItems > li.result-list__listing > article' ).each(function(i, elem) {
		    	
		    	if( $(this).find('a h5').html() != null ) {
		    		var objectTitle = $(this).find('a h5').html().replace(/\s+/g, " ").split("</span>")[1].substring(8);
		    	
		    		if( !objectTitle.toLowerCase().includes('sozialwohnung') && !objectTitle.toLowerCase().includes('wbs') && !objectTitle.toLowerCase().includes('wohnberechtigungsschein') ){
						immoscoutSingle($(this));
		    		}
		    	}
			});

		}else{
		    console.log(error);
		}
	});	
}

function immoscoutSingle(element) {
	var id = element.find('.gallery-container a').attr('href').substring(8);
	var url = "https://www.immobilienscout24.de" + element.find('a').attr('href');
	var price = element.find('.result-list-entry__criteria dl:nth-child(1) dd').text();
	element.find('.result-list-entry__criteria dl:nth-child(3) dd .onlySmall').remove();
	var rooms = element.find('.result-list-entry__criteria dl:nth-child(3) dd').html();
	request(url, function(error, response, html){
		if( !error ) {

		    if ( !multiSearchOr(html, ["WBS", "SOZIALWOHNUNG", "WOHNBERECHTIGUNGSSCHEIN"]) ) {

		    	var $ = cheerio.load(html);
		    	var place = $('#is24-main > div > div > a:nth-child(4)').text();
		    	var img = $('meta[property="og:image"]').attr('content');
		    	var object = {id:id,url:url,price:price,place:place,rooms:rooms,img:img};
		    	saveObject("immoscout",id, object);
		    }
		} else {
		    immonetSingle(element);
		}
	}); 
}
function trimmer(str) {

	if ( typeof str != 'undefined' ) {
		return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
	}
    return '';
}

function multiSearchOr(text, searchWords) {
  var searchExp = new RegExp(searchWords.join("|"),"gi");
  return (searchExp.test(text))?true:false;
}