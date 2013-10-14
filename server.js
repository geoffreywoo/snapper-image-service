var azure = require('azure');
var http = require('http');

var retryOperations = new azure.ExponentialRetryPolicyFilter();
var blobService = azure.createBlobService().withFilter(retryOperations);

containerName = 'test'

blobService.createContainerIfNotExists(containerName
    , {publicAccessLevel : 'blob'}
    , function(error){
        if(!error){
            // Container exists and is public
        }
    });

/*
blobService.createBlockBlobFromFile(containerName
    , 'test1'
    , 'test1.txt'
    , function(error){
        if(!error){
            // File has been uploaded
        }
    });

http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('Hello World\n');
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
*/