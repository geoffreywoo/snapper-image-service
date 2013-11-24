var http = require('http');
var express = require("express");
var app = express();
var port = process.env.PORT || 1337;
var azure = require('azure');
var path = require('path');
var fs = require('fs');
var gm = require('gm');
var request = require('request');

//var temp = require("temp");
//temp.track();

//config stuff for local dev
//comment out for prod

var nconf = require('nconf');
nconf.env().file({ file: 'config.json'});
var name = nconf.get("AZURE_STORAGE_ACCOUNT")
var key = nconf.get("AZURE_STORAGE_ACCESS_KEY");
console.log(name);
console.log(key);


app.use(express.logger());
app.use(express.bodyParser());

var retryOperations = new azure.ExponentialRetryPolicyFilter();

//dev
var blobService = azure.createBlobService(name,key).withFilter(retryOperations);

//prod
//var blobService = azure.createBlobService().withFilter(retryOperations);

origContainerName = 'original';
puffedContainerName = 'puffed';
imgContainerName = 'img';

blobService.createContainerIfNotExists(origContainerName
    , {publicAccessLevel : 'blob'}
    , function(error){
        if(!error){
            console.log('original container up')
        }
    });

blobService.createContainerIfNotExists(puffedContainerName
    , {publicAccessLevel : 'blob'}
    , function(error){
        if(!error){
            console.log('puffed container up')
        }
    });

blobService.createContainerIfNotExists(imgContainerName
    , {publicAccessLevel : 'blob'}
    , function(error){
        if(!error){
            console.log('img container up')
        }
    });


// only called when its 200
var sendResponse = function (response, error, data) {
  var responseObj;
  responseObj = data;
  response.setHeader("Content-Type", "text/plain");
  response.send(responseObj);
}

// only called when its 200
var sendJSONResponse = function (response, error, data) {
  var responseObj;
  if (error) {
    responseObj = {"ok": false, "error": error}
  } else {
    if (data !== undefined && data !== null) {
      var elementsArray;
      if (data instanceof Array) {
        elementsArray = data;
      } else if (typeof data === 'number') {
        elementsArray = [data];
      } else {
        elementsArray = new Array(data);
      }
      responseObj = {"ok": true, "elements": elementsArray}
    } else {
      responseObj = {"ok": true};
    }
  }
  response.setHeader("Content-Type", "application/json");
  response.send(responseObj);
}

app.get('/', function(request, response) {
  sendResponse(response, null, 'snapper images');
});

function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 10; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function generateBlurPhoto(picPath, callback) {
  var newPicPath = picPath + 'blur';
  gm(picPath)
  .blur(75,33)
  .write(newPicPath, function (err) {
    if (err) {
      return null;
      console.log(err);
    } else {
      callback(newPicPath);
    }
  });
}

function generateAbstractPhoto(picPath, callback) {
  var newPicPath = picPath + 'abstract';
  gm(picPath)
  .blur(75,33)
  .segment(0.3,1.5)
  .write(newPicPath, function (err) {
    if (err) {
      return null;
      console.log(err);
    } else {
      callback(newPicPath);
    }
  });
}

function generatePaintPhoto(picPath, callback) {
  var newPicPath = picPath + 'paint';
  gm(picPath)
  .paint(30)
  .write(newPicPath, function (err) {
    if (err) {
      return null;
      console.log(err);
    } else {
      callback(newPicPath);
    }
  });
}

function generatePuffedPhoto(picPath, nameOfOriginalPicFilename) {
  console.log(picPath);
  var callback = function(puffedPicPath) {
    blobService.createBlockBlobFromFile(
      puffedContainerName
      , nameOfOriginalPicFilename
      , puffedPicPath
      , function(err) {
        if(!err){
          console.log('uploaded puffed blob')
        } else {
          console.log('upload puffed failed')
        }
      }
    );
  }

  var puffingStyle = Math.floor((Math.random()*3));
  console.log(puffingStyle);

  if (puffingStyle == 0) {
    generateBlurPhoto(picPath, callback);
  } else if (puffingStyle == 1) {
    generateAbstractPhoto(picPath, callback);
  } else {
    generatePaintPhoto(picPath, callback);
  }
}

//curl -i -X POST -F "pic=@test1.txt" localhost:5000/upload
app.post('/uploadDouble', function (req, res) {
  //console.log(req);
  console.log(req.files);
	console.log(req.files.pic);
	console.log(req.files.pic.path);

  var filename = makeid();
  
  //upload normal photo
  blobService.createBlockBlobFromFile(
    origContainerName
    , filename
    , req.files.pic.path
    , function(err) {
      if(!err){
        console.log('uploaded blob')
        sendJSONResponse(res, null, filename);

        generatePuffedPhoto(req.files.pic.path,filename);

      } else {
        console.log('upload failed')
        sendResponse(res, 'upload failed', null);
      }
    }
  );
});

//curl -i -X POST -F "pic=@test1.txt" localhost:5000/upload
app.post('/upload', function (req, res) {
  //console.log(req);
  console.log(req.files);
  console.log(req.files.pic);
  console.log(req.files.pic.path);

  var filename = makeid();
  
  //upload normal photo
  blobService.createBlockBlobFromFile(
    imgContainerName
    , filename
    , req.files.pic.path
    , function(err) {
      if(!err){
        console.log('uploaded blob')
        sendJSONResponse(res, null, filename);

        generatePuffedPhoto(req.files.pic.path,filename);

      } else {
        console.log('upload failed')
        sendResponse(res, 'upload failed', null);
      }
    }
  );
});

var storageCoreURL = "http://snappermap.blob.core.windows.net/"

app.put('/swap/:uri', function (req, res) {
  var sourceUri = storageCoreURL + imgContainerName + '/' + req.params.uri;
  blobService.copyBlob(
    sourceUri 
    , origContainerName
    , req.params.uri
    , function(err) {
      if (!err){
        var sourceUri2 = storageCoreURL + puffedContainerName + '/' + req.params.uri;
          blobService.copyBlob(
            sourceUri2 
            , imgContainerName
            , req.params.uri
            , function(err) {
              if (!err){
                console.log('puff to img OK');
                sendJSONResponse(res, null, 'OK');
              } else {
                console.log('puff to img fail');
                sendJSONResponse(res, err, null);
              }
            }
          );
      } else {
        console.log('img to orig fail');
        sendJSONResponse(res, err, null);
      }
    }
  );
});

app.post('/blur', function (req, res) {
  var filename = makeid();

  var path1 = req.files.pic.path;
  console.log(path1);

  gm(path1)
  .blur(75,33)
  .write(path1, function (err) {
    if (err) console.log(err);
    else {
      blobService.createBlockBlobFromFile(
        containerName
        , filename
        , path1
        , function(err) {
          if(!err){
            console.log('uploaded blob')
            sendJSONResponse(res, null, filename);
          } else {
            console.log(err)
            sendResponse(res, err, null);
          }
        }
      );
    }
  });
});

app.post('/abstract', function (req, res) {
  var filename = makeid();

  var path1 = req.files.pic.path;
  console.log(path1);

  gm(path1)
  .blur(75,33)
  .segment(0.3,1.5)
  .write(path1, function (err) {
    if (err) console.log(err);
    else {
      blobService.createBlockBlobFromFile(
        containerName
        , filename
        , path1
        , function(err) {
          if(!err){
            console.log('uploaded blob')
            sendJSONResponse(res, null, filename);
          } else {
            console.log(err)
            sendResponse(res, err, null);
          }
        }
      );
    }
  });
});

app.post('/paint', function (req, res) {
  var filename = makeid();

  var path1 = req.files.pic.path;
  console.log(path1);

  gm(path1)
  .paint(30)
  .write(path1, function (err) {
    if (err) console.log(err);
    else {
      blobService.createBlockBlobFromFile(
        containerName
        , filename
        , path1
        , function(err) {
          if(!err){
            console.log('uploaded blob')
            sendJSONResponse(res, null, filename);
          } else {
            console.log(err)
            sendResponse(res, err, null);
          }
        }
      );
    }
  });
});

app.del('/delete/:name', function (req, res) {
  blobService.deleteBlob(containerName
  , req.params.name
  , function(error){
    if(!error){
      console.log('deleted')
      sendJSONResponse(res, null, null);
    } else {
      console.log('deleted failed')
      sendResponse(res, 'delete failed', null);
    }
  });
});

app.listen(port, function() {
  console.log("Listening on " + port);
});