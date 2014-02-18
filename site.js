// Scans a single domain using phantomjs, keeps temporary results in phantom-running and when done, moves it to phantom-done

var fs = require('fs');
var page = require('webpage').create();
var system = require('system');

var rundir = 'phantom-running';
var donedir = 'phantom-done';



fs.exists(rundir) || fs.makeDirectory(rundir);
fs.exists(donedir) || fs.makeDirectory(donedir);


if (system.args.length === 1) {
	console.log('No url passed');
}
var url = system.args[1];
var filename = rundir + '/' + url + '.log';
var file = fs.open(filename, 'w');
console.log(url);
console.log(filename);

function logmsg(msg) {
	console.log(msg);
	file.writeLine(new Date().getTime() + ' ' + msg);
	file.flush();
}

logmsg('Scanning ' + url + ' ...');


page.onResourceRequested = function(requestData, networkRequest) {
	if(requestData.url.match(/.*\.css(\?.*)?$/)) {
		networkRequest.abort();
	}
};

page.onResourceReceived = function(response) {
	if(response.contentType && response.stage === 'end' && response.contentType.match(/javascript/i)) {
		logmsg('script: ' + response.url);
	}
};


page.open('http://' + url, function (status) {
	logmsg('Done');
	file.close();
	var donefile = filename.replace(rundir + '/', donedir + '/');
	if (fs.exists(donefile)) fs.remove(donefile);
	fs.move(filename, donefile);
	phantom.exit();
});

