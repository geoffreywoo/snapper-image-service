var http = require('http')
var port = process.env.PORT || 1337;
var azure = require('azure');

var retryOperations = new azure.ExponentialRetryPolicyFilter();
var blobService = azure.createBlobService().withFilter(retryOperations);

http.createServer(function(req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello Azure\n');
}).listen(port);